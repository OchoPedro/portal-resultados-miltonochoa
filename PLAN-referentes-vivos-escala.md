# Plan: referentes vivos que escalan a 5M de estudiantes

## ✅ EJECUTADO COMPLETO (21 jul 2026, misma noche)

Verificación dorada: las 7 RPCs comparadas contra su salida anterior con claims forjados —
tablero 407/407, percentil_geo 13.110/13.110 estudiantes, percentil_est 300/300,
promedios 407/407, competencias 407/407, componentes 407/407, distribución 32 + 395.706
conteos set-based. **0 diferencias en todo.** Medido después: tablero 9 ms, percentiles
16 ms, competencias 34 ms, componentes 43 ms, distribución 10 ms (antes 0.1–1.5 s c/u).
Backfill: 407 pares, 0 errores. Cola probada end-to-end. Grants cerrados (la vista v2
bypaseaba RLS con grant a authenticated — revocado). Commits: portal `1653488`,
plataforma-interna `e25da4b` + `457ef29` (omr-pendientes y AdminAnalisis, hallados por grep).
Pendiente solo: fase 7 (retirar lo viejo tras soak) e IRT (decisión aparte).

**Escrito:** 21 jul 2026 · **Decisión del usuario:** el referente territorial (municipio /
departamento / región / nacional) se queda **VIVO** — se compara contra toda la población
calificada, no contra un corte congelado. Con la muestra **visible** en pantalla
("Referente nacional: N estudiantes · actualizado <fecha>"). Los puntajes individuales y de
plantel no cambian por lo que hagan otros colegios (ya era así: `puntaje_global` es criterial).

Extiende y cierra `PLAN-analisis-preguntas-escala.md` (fases 0–4 ya hechas). Repos:
`portal` (lectura) · `plataforma-interna` (escritura) · BD `bmspwsbhsjkamjywvvde`.

---

## El problema

Cinco superficies de lectura recorren la población **entera** en cada carga de dashboard:

| RPC | Qué hace hoy | A 5M |
|---|---|---|
| `get_percentil_geografico` / `_estudiante` | 4× `PERCENT_RANK()` sobre todos los resultados y descarta el 99,9% | decenas de segundos por carga |
| `get_tablero_gestion` | agrega la prueba completa por colegio en 4 ramas + `mejores` | segundos por carga |
| `get_promedios_area_estudiante` | AVG de 10 columnas sobre toda la prueba × 5 alcances | segundos por carga |
| `get_competencias_gestion` / `_componentes` | barren `notas_competencia`/`notas_componente` completas | ~150M filas por carga |
| `get_distribucion_pregunta` | desenrolla el JSONB `detalle` de TODA la prueba por clic | minutos por clic |

Además la escritura del análisis sigue fire-and-forget (fase 6 pendiente del plan anterior).

## La solución: agregar al escribir (mismo patrón ya verificado en fases 0–4)

**Percentil sin ordenar:** `puntaje_global` es entero 0–500 → la distribución de cualquier
territorio cabe en ≤501 contadores. Percentil = suma acumulada / total. Index scan, no sort.
`PERCENT_RANK` se reproduce exacto: `ROUND(100 × n_debajo/(N−1))`, y `N=1 → 100`.

### Tablas nuevas (todas aditivas, RLS activado sin políticas = solo service role y RPCs)

1. `stats_puntaje_colegio (prueba_id, colegio_id, grado, puntaje, n)` — histograma por colegio.
2. `stats_puntaje_territorio (prueba_id, ambito∈{municipio,departamento}, codigo, grado, puntaje, n)`
   — región y nacional se derivan al leer sumando departamentos (≤16k filas), con los MISMOS
   arreglos de región hardcodeados de las funciones actuales.
3. `stats_tablero_colegio (prueba_id, colegio_id, {sum,n,max}×7 compuestos)` — mat, cn, soc,
   lc, ing, def, gbl con las fórmulas exactas del tablero (2-1/3, 0.9×3+0.3/3, 1.2+1.8/3).
   El referente nacional del tablero es promedio-de-promedios-por-colegio: se reproduce con
   `AVG(sum/n)` por colegio. `mejores` = `MAX(max_*)`.
4. `stats_areas_colegio (prueba_id, colegio_id, grado, {sum,n}×10 asignaturas)` — promedios
   por estudiante (no por colegio): alcance = `SUM(sums)/SUM(ns)`.
5. `stats_competencia_colegio (prueba_id, colegio_id, materia, competencia, suma_nota, n, …)`
6. `stats_componente_colegio (…, componente, …)` — 5 y 6 alimentan el promedio-por-colegio
   con el corte `n_est ≥ 10` que ya existe; la desviación del plantel sigue viva (es un
   colegio, indexado, barato a cualquier escala).
7. `stats_marcada_colegio (prueba_id, colegio_id, gpos, marcada, n)` — distribución de
   opciones marcadas por pregunta; reemplaza el desenrollado del JSONB por clic.
8. `stats_pendientes (prueba_id, colegio_id, creado_at, intentos, ultimo_error)` — la cola.

### Funciones

- `refrescar_stats_colegio_completo(prueba, colegio)` — delete+insert idempotente de las
  tablas 1,3,4,5,6,7 de ESE colegio + `refrescar_stats_colegio` (preguntas, ya existe).
  Costo proporcional al colegio. Conserva el filtro `jsonb_typeof(detalle)='array'`.
- `refrescar_stats_territorio(prueba)` — reconstruye la tabla 2 + `refrescar_stats_nacional`.
- `procesar_stats_pendientes(max)` — drena la cola par por par con EXCEPTION por par
  (un colegio malo no bloquea el resto), incrementa `intentos`, guarda `ultimo_error`,
  y al final refresca territorio de cada prueba tocada. Devuelve conteos.

### Ruta de escritura (fase 6 — nunca más fire-and-forget)

- `portal-resultados.js` acción `upsert` a `resultados_estudiante`/`notas_*`: **encola** los
  pares (prueba, colegio) del lote — esperado y con error al cliente si falla.
- Acción `borrar`: encola el par afectado.
- Nueva acción `refrescar_stats`: drena la cola (la llama AdminResultados al final del
  guardado, **esperada**, con el error visible en pantalla).
- `omr-worker` (cron cada minuto): encola tras calificar y **drena la cola en cada tick**
  aunque no haya trabajo OMR — ese es el reintento. Una fila que persista con `intentos`
  altos queda visible en `stats_pendientes` con su `ultimo_error`.

### Lectura (mismas firmas, el portal casi no cambia)

Las 7 RPCs se reescriben con `CREATE OR REPLACE` conservando firma y forma del resultado.
Nuevas: `get_analisis_preguntas(prueba, colegio)` (fase 5: lee el join de v2 con el chequeo
`jwt_app_role()` estándar) y `get_muestra_referente(prueba, colegio)` → tamaños de muestra
por alcance + fecha de actualización, para la línea visible en el portal.

### Muestra visible (decisión del usuario)

En Tablero de Gestión y Listado de Notas del ColegioDashboard:
"Referente nacional: N estudiantes · actualizado <fecha>" (y el alcance elegido en Listado).

## Verificación que no se salta

1. **Captura dorada:** con claims forjados (`set_config('request.jwt.claims', …)`) se llama
   cada RPC actual para TODOS los pares colegio×prueba y se guarda la salida jsonb en tablas
   `_golden_*`. (percentil_estudiante y distribucion: muestra representativa; el resto: todo.)
2. Verificaciones set-based old-vs-new completas para percentiles (13k×4 números), tablero,
   promedios, competencias, componentes y marcada. **Se exige 0 diferencias.**
3. Tras el swap: re-captura con las mismas llamadas y comparación jsonb exacta contra `_golden_*`.

## Cosas finas que muerden (verificadas en el código actual)

- El percentil por municipio compara SOLO el nombre del municipio (sin departamento):
  municipios homónimos se mezclan. **Se reproduce igual** (0-diff); arreglarlo es decisión aparte.
- Tres mapeos de región distintos conviven (arrays hardcodeados en percentil/tablero, tabla
  `regiones` en competencias, CASE con grafías en distribucion). Cada RPC conserva EL SUYO.
- `notas_competencia`/`notas_componente` tienen unique por (est,prueba,materia,comp) →
  `COUNT(*) = COUNT(DISTINCT estudiante_id)`; se guarda un solo `n`.
- El tablero NO filtra por grado; percentiles y promedios de área SÍ. Las tablas lo reflejan.
- `sociales`/`ciudadanas` van con `COALESCE(...,0)` en el tablero (nunca NULL); las demás
  columnas propagan NULL y el AVG las ignora → por eso se guardan `sum` y `n` POR columna.
- Borrar un colegio cascadea las stats por FK; el territorio queda viejo hasta el próximo
  drenaje de esa prueba (aceptado, raro).

## Fuera de alcance (deliberado)

- **IRT**: nadie lo lee aún; norma congelada por corte se decide aparte. `calibrarIRT` queda como está.
- **Fase 7** (retirar `analisis_preguntas` + `calcular_analisis_preguntas`): tras días de
  soak con lo nuevo en producción, no hoy. El endpoint viejo queda pero el cliente ya no lo llama.
- Municipios homónimos y unificación de mapeos de región.

## Rollback

- RPCs: se conserva el cuerpo viejo (captura en `_golden_defs`); `CREATE OR REPLACE` de vuelta.
- Escritura: revert de los commits en plataforma-interna; el path viejo (`calcular_analisis_preguntas`) sigue existiendo.
- Tablas nuevas: DROP (nada viejo depende de ellas).
