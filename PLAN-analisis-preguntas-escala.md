# Plan: análisis por pregunta que escale a 1M de estudiantes

**Escrito:** 20 jul 2026 · **Repos:** `portal` (lectura) · `plataforma-interna` (escritura) ·
BD `bmspwsbhsjkamjywvvde`

---

## ESTADO: fases 0–4 EJECUTADAS y VERIFICADAS (20 jul, madrugada)

Todo lo hecho es **aditivo**: tablas y funciones nuevas que nada en producción lee todavía. El
sistema sigue funcionando exactamente igual que antes. Falta el switch (fases 5–7).

| Fase | Estado | Resultado |
|---|---|---|
| 0 · backup | ✅ | `_backup_analisis_20260721` — 99.314 filas, 200 colegios, 2 pruebas |
| 1 · `preguntas_prueba` | ✅ | 254 preguntas × 2 pruebas. **0 diferencias** contra el backup en materia, competencia, componente, estándar, tarea, dificultad, respuesta, sesión y nro_sesión |
| 2 · `stats_pregunta_colegio` | ✅ | 391 pares colegio×prueba, 99.314 filas. `refrescar_stats_colegio` |
| 3 · `stats_pregunta_nacional` | ✅ | 254 gpos × 2 pruebas. `refrescar_stats_nacional` |
| 4 · `analisis_preguntas_v2` (vista) | ✅ | **0 diferencias en las 99.314 filas**, sin sobrantes ni faltantes |

### Lo medido

| Operación | Antes | Ahora |
|---|---|---|
| Refrescar el análisis tras guardar un lote | 4.500 ms (prueba entera) | **17 ms** (por colegio) |
| Leer el análisis de un colegio | tabla materializada | **2,1 ms** (254 filas, todo por índice) |

La verificación de la fase 4, que es la que decide si esto sirve:

```
filas_comparadas 99.314 · dif_pct_colegio 0 · dif_pct_nacional 0 · dif_oportunidad 0
dif_materia 0 · dif_rta 0 · solo_en_nueva 0 · solo_en_vieja 0
```

### Falta (el switch — hacer con calma, sin lote corriendo)

- **Fase 5 · ✅ HECHA (21 jul 2026).** El portal lee la RPC `get_analisis_preguntas` (v2)
  y AdminAnalisis de plataforma-interna también. Ver `PLAN-referentes-vivos-escala.md`.
- **Fase 6 · ✅ HECHA (21 jul 2026).** Cola `stats_pendientes` + `procesar_stats_pendientes`
  con estado y reintento (drenada por el cron del omr-worker cada minuto). Encolan: upsert
  de resultados, borrar, omr-worker y omr-pendientes. AdminResultados llama el drenado
  ESPERADO con error visible. El mismo movimiento extendió el patrón a percentiles, tablero,
  promedios, competencias, componentes y distribución (referentes vivos a escala).
- **Fase 7** · retirar `analisis_preguntas`, `calcular_analisis_preguntas`, la acción
  'analisis_preguntas' del API y el backup — tras unos días de soak con lo nuevo.

### Rollback

Nada que revertir mientras no se toque el switch. Si se quisiera deshacer:
`drop view analisis_preguntas_v2; drop table stats_pregunta_nacional, stats_pregunta_colegio,
preguntas_prueba; drop function refrescar_stats_colegio, refrescar_stats_nacional,
poblar_preguntas_prueba;`

### Pendiente de decidir antes de la fase 5

`analisis_preguntas_v2` **deriva** `pct_nacional` en vez de leerlo congelado. Es más correcto
—nunca queda viejo— pero un colegio puede ver ese número moverse entre visitas sin haber hecho
nada. Hoy coinciden exactamente porque el recálculo global se corrió hace minutos. Si se
prefiere estabilidad, hay que congelarlo **por corte de fecha**, no por accidente de cuándo
corrió el último recálculo.

---

## El problema, en una frase

`calcular_analisis_preguntas` desenrolla el JSONB `detalle` de **todos** los estudiantes de
la prueba y reescribe `analisis_preguntas` entera, en cada guardado.

Medido el 19 jul sobre GO-3 con 6.141 estudiantes:

| | Hoy | Proyectado a 1M estudiantes |
|---|---|---|
| Elementos JSON recorridos | 1,56 M | ~254 M (163×) |
| Duración de la RPC | ~4,5 s (AR-3: 5,4 s) | **~13–15 min** |
| Filas reescritas por corrida | 49.276 | ~2,5 M por prueba |

Y se invoca `fire-and-forget` desde el navegador, con el error yendo solo a `console.error`
([AdminResultados.jsx:1074](../plataforma-interna/src/pages/admin/AdminResultados.jsx:1074)).
Por eso el análisis se quedó congelado desde el 18 jul sin que nadie se enterara: 75 de 194
colegios de GO-3 sin filas.

### El nudo real

`pct_nacional` está **denormalizado en cada fila**. Cualquier colegio nuevo cambia el nacional,
y por lo tanto obliga a reescribir la prueba completa. Recalcular todo no es descuido: es la
consecuencia forzosa del modelo. Mientras el nacional viva dentro de la fila del colegio, no
hay cron ni índice que salve esto.

---

## El cambio de fondo

**Agregar al escribir, no al leer.** Tres piezas nuevas y una que desaparece.

### Pieza 1 — `preguntas_prueba` (normalizar la estructura)

Hoy la estructura de la prueba vive en `pruebas.estructura_excel->'raw'` y se re-parsea con
`EXECUTE format(...)` en cada corrida, detectando los índices de columna del header cada vez.
Eso convierte la lectura en un parseo en vez de un JOIN.

```sql
create table preguntas_prueba (
  prueba_id          uuid not null references pruebas(id) on delete cascade,
  gpos               int  not null,           -- posición global (1..254)
  sesion             int,
  nro_sesion         int,
  materia            text,
  estandar           text,
  competencia        text,
  componente         text,
  tarea              text,
  dificultad         text,
  respuesta_correcta text,
  primary key (prueba_id, gpos)
);
```

Se llena UNA vez, al cargar/actualizar la clave de la prueba. Reusar la lógica de detección de
header que ya está dentro de `calcular_analisis_preguntas` (columnas `Rta` y `Dificul%`),
extrayéndola a `poblar_preguntas_prueba(p_prueba_id)`.

**Ojo:** esa función hoy devuelve `jsonb_build_object('error', ...)` en vez de lanzar excepción
cuando no encuentra las columnas, y el endpoint solo mira el error de Postgres — un fallo de
estructura pasa como `ok: true`. Al extraerla, que **lance excepción**.

### Pieza 2 — `stats_pregunta_colegio` (el agregado)

```sql
create table stats_pregunta_colegio (
  prueba_id      uuid not null references pruebas(id)  on delete cascade,
  colegio_id     uuid not null references colegios(id) on delete cascade,
  gpos           int  not null,
  evaluados      int  not null default 0,
  correctas      int  not null default 0,
  actualizado_at timestamptz not null default now(),
  primary key (prueba_id, colegio_id, gpos)
);
```

Refresco **por colegio**, no por prueba:

```sql
create function refrescar_stats_colegio(p_prueba_id uuid, p_colegio_id uuid) returns int
-- DELETE de ese colegio + INSERT desde resultados_estudiante filtrando
-- (prueba_id, colegio_id). Con idx_resultados_prueba_colegio (creado el 20 jul)
-- es un Index Scan: 0,25 ms para localizar las filas.
```

Idempotente por diseño: borra y reinserta las ~254 filas de ESE colegio. Nada de sumas
incrementales con deltas — recalificar un estudiante no puede inflar el conteo.

**Costo:** proporcional al colegio (24–390 estudiantes), no al histórico. Guardar un lote
cuesta lo mismo el día 1 que con un millón cargados. Ese es el punto entero del rediseño.

### Pieza 3 — el nacional, materializado y aparte

```sql
create table stats_pregunta_nacional (
  prueba_id uuid not null references pruebas(id) on delete cascade,
  gpos      int  not null,
  evaluados int  not null,
  correctas int  not null,
  actualizado_at timestamptz not null default now(),
  primary key (prueba_id, gpos)
);
```

Se deriva con `GROUP BY gpos` sobre `stats_pregunta_colegio`: a escala nacional son
10.000 colegios × 254 = 2,5M filas, no 1M estudiantes × 254 = 254M. **Dos órdenes de magnitud
menos.**

No hace falta que sea instantáneo — el nacional cambia poco entre lotes. Refrescarlo desde
`omr-worker` (ya corre por cron cada minuto) cuando haya stats más nuevos que el nacional.

### Pieza 4 — la lectura

`analisis_preguntas` **deja de ser tabla**. Pasa a ser una vista o RPC por colegio:

```sql
select pp.*, sc.evaluados, sc.correctas,
       round(sc.correctas::numeric / nullif(sc.evaluados,0) * 100)::int as pct_colegio,
       round(sn.correctas::numeric / nullif(sn.evaluados,0) * 100)::int as pct_nacional
from   preguntas_prueba pp
join   stats_pregunta_colegio  sc using (prueba_id, gpos)
join   stats_pregunta_nacional sn using (prueba_id, gpos)
where  sc.colegio_id = ? and pp.prueba_id = ?
```

254 filas por consulta, todo por índice. Nada que borrar y reinsertar nunca más.

---

## Orden de ejecución

Cada fase deja el sistema funcionando. Nada se retira hasta que lo nuevo esté verificado
contra lo viejo.

| # | Fase | Toca | Reversible |
|---|---|---|---|
| 0 | Medir base: guardar la salida actual de `analisis_preguntas` para AR-3 y GO-3 en una tabla `_backup_analisis_20260721` | BD | — |
| 1 | `preguntas_prueba` + `poblar_preguntas_prueba` + backfill de las 2 pruebas | BD | Drop |
| 2 | `stats_pregunta_colegio` + `refrescar_stats_colegio` + backfill de los 391 pares colegio×prueba | BD | Drop |
| 3 | `stats_pregunta_nacional` + refresco en `omr-worker` | BD + plataforma-interna | Drop + revert |
| 4 | Nueva RPC de lectura. **Comparar fila por fila contra el backup de la fase 0 — deben coincidir exacto** | BD | — |
| 5 | `portal` lee la RPC nueva | portal | Revert |
| 6 | Escritura: `guardar` llama `refrescar_stats_colegio` por cada colegio del lote, vía worker con estado y reintento — **nunca fire-and-forget** | plataforma-interna | Revert |
| 7 | Retirar `analisis_preguntas` y `calcular_analisis_preguntas` | BD | Backup fase 0 |

### La verificación que no se salta (fase 4)

```sql
-- Debe devolver 0 filas antes de tocar el portal
select * from _backup_analisis_20260721 b
full outer join (select * from nueva_lectura(...)) n
  on n.colegio_id = b.colegio_id and n.gpos = b.nro_pregunta
where b.pct_colegio is distinct from n.pct_colegio
   or b.pct_nacional is distinct from n.pct_nacional;
```

---

## Detalles finos que muerden

- **`detalle` nulo o no-array.** La función actual ya filtra `jsonb_typeof(detalle) = 'array'`;
  conservarlo en `refrescar_stats_colegio` o los conteos se desalinean.
- **Borrado selectivo.** `accion: 'borrar'` en
  [portal-resultados.js](../plataforma-interna/api/portal-resultados.js) borra resultados y
  `analisis_preguntas`. Tiene que pasar a llamar `refrescar_stats_colegio` — si no, quedan stats
  de estudiantes que ya no existen.
- **Recalificación.** `omr-worker` usa `upsert ... ignoreDuplicates: true` ("gana la primera").
  Aun cuando no cambie el resultado, hay que refrescar el colegio: pudieron entrar estudiantes
  nuevos en el mismo lote.
- **`pct_nacional` deja de estar congelado.** Hoy queda fijo hasta el próximo recálculo global;
  con la vista se recalcula al leer. Es más correcto, pero un colegio puede ver su
  `pct_nacional` moverse entre visitas sin que él haya hecho nada. **Decisión consciente:** si
  se prefiere estabilidad, congelar el nacional por corte (fecha) en vez de por accidente.
- **Mínimo de muestra.** El corte de ≥10 estudiantes que se aplicó el 20 jul vive en
  `get_competencias_gestion` / `get_componentes_gestion`, que recorren `notas_competencia`
  completo en cada carga de dashboard. **Mismo problema de escala, misma solución:** un
  `stats_competencia_colegio` análogo. Hoy no duele (6.000 estudiantes); a 1M sí.

---

## Hallazgo aparte, del mismo tamaño

`calibrarIRT` en [AdminResultados.jsx:1086](../plataforma-interna/src/pages/admin/AdminResultados.jsx:1086)
lee **todos los `detalle` de la prueba, de todos los colegios, en el navegador**:

```js
const { data: todos } = await supabase
  .from('resultados_estudiante')
  .select('id,estudiante_id,detalle')
```

Hoy son 66 MB de tabla. A 1M de estudiantes es del orden de 5 GB al cliente: imposible. La
calibración IRT tiene que bajar a la base (o a un worker) en el mismo movimiento. No es parte
de este plan, pero **muere por la misma causa** y conviene atacarlo en la misma sesión.

---

## Antes de empezar

- No ejecutar con un lote de calificación corriendo. Santander va en 77,9 % (12.896/16.556 al
  19 jul); coordinar una ventana sin cargas.
- El cron `omr-worker` corre **cada minuto**. Considerar pausarlo durante las fases 2–3.
- Contexto: [[project-portal-resultados]] · [[santander-estado-calificacion]]
