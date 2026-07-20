-- Reporte Desviación de Proyectos Especiales — agregación en la base
-- Aplicado en Supabase el 2026-07-20 (migración: rpc_proyecto_desviacion)
-- Consumido por: plataforma-interna/api/comercial-proyecto-desviacion.js
--
-- ── EL PROBLEMA ─────────────────────────────────────────────────────────────────────────────
-- El endpoint traía todo al servidor y recortaba en JS:
--
--   Al abrir la pestaña   12.942 filas (`prueba_id` de todo el proyecto) en ~14 peticiones
--                         encadenadas, para contar en JS y mostrar dos números.
--   Al elegir la prueba    6.158 filas con `respuestas` y las 10 asignaturas (~2 MB) en ~8
--                         peticiones, para quedarse con 762. El 88% se descartaba DESPUÉS
--                         de haber viajado.
--
-- Medido en la base: el conteo es 10 ms y el reporte 53 ms, usando idx_resultados_prueba_colegio.
--
-- ── LA COMPLICACIÓN ─────────────────────────────────────────────────────────────────────────
-- Los colegios del proyecto viven en la BD de plataforma-interna y los resultados aquí: son dos
-- proyectos Supabase distintos, no se pueden unir con JOIN. Por eso la lista de colegios llega
-- como parámetro (253 uuids) en vez de derivarse del proyecto.
--
-- ── EQUIVALENCIA VERIFICADA ─────────────────────────────────────────────────────────────────
-- Se comparó la salida de la RPC contra una réplica literal del algoritmo JS (array ordenado,
-- slice(0,2) y slice(-2), Set de solapamiento), sobre los colegios de Santander:
--
--   GO-3: 762 filas vs 762 — 0 solo-en-JS, 0 solo-en-RPC
--   AR-3: 777 filas vs 777 — 0 solo-en-JS, 0 solo-en-RPC, 0 nombres nulos
--
-- El detalle que hace que coincidan son los DOS desempates distintos: el JS ordenaba desc por
-- puntaje sobre una lista que venía .order('id') y el sort de JS es estable, así que en empate
-- mandaba el id menor; los peores salían de slice(-2) de esa misma lista, o sea el id MAYOR
-- primero. De ahí `id ASC` para mejores y `id DESC` para peores.
--
-- SECURITY INVOKER (por defecto): corre con el JWT authenticated/app_role=admin que ya usa
-- portalClient(), sujeta a la misma RLS y a los mismos GRANTs por columna. No amplía privilegios.

-- ── 1. Conteo de resultados por prueba (llena el desplegable) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_proyecto_pruebas_conteo(p_colegio_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.codigo), '[]'::jsonb)
  FROM (
    SELECT p.id, p.codigo, p.nombre, p.grados, COUNT(*) AS n_estudiantes
    FROM resultados_estudiante re
    JOIN pruebas p ON p.id = re.prueba_id
    WHERE re.colegio_id = ANY(p_colegio_ids)
    GROUP BY p.id, p.codigo, p.nombre, p.grados
  ) t;
$function$;

-- ── 2. El reporte, ya recortado ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_proyecto_desviacion(
  p_prueba_id   uuid,
  p_colegio_ids uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  WITH todas AS (
    SELECT re.id, re.estudiante_id, re.colegio_id, re.puntaje_global, re.desempeno_pct,
           re.mat_cuantitativo, re.mat_especifico, re.lectura_critica, re.sociales, re.ciudadanas,
           re.cn_quimica, re.cn_fisica, re.cn_biologia, re.cn_cts, re.ingles,
           -- Un estudiante que dejó la hoja en blanco, o que presentó UNA sola sesión, no es un
           -- caso atípico de desempeño: es un dato incompleto. Como la sesión ausente cuenta como
           -- no respondida, su puntaje queda deprimido por un problema de datos y copa siempre los
           -- dos puestos de abajo, tapando a los que de verdad rindieron bajo.
           -- Sesión 1 = preguntas 1..120, sesión 2 = 121..254. 'X' = no respondida, '?' = ilegible.
           -- Si `respuestas` no viene o no mide 254 NO se descarta: ante un formato inesperado es
           -- mejor mostrar de más que esconder a alguien.
           (re.respuestas IS NOT NULL AND length(re.respuestas) = 254
              AND substring(re.respuestas from 1   for 120) ~ '^[X?]+$') AS s1_vacia,
           (re.respuestas IS NOT NULL AND length(re.respuestas) = 254
              AND substring(re.respuestas from 121 for 134) ~ '^[X?]+$') AS s2_vacia
    FROM resultados_estudiante re
    WHERE re.prueba_id = p_prueba_id
      AND re.colegio_id = ANY(p_colegio_ids)
      AND re.puntaje_global IS NOT NULL
  ),
  validas AS (
    SELECT * FROM todas WHERE NOT (s1_vacia OR s2_vacia)
  ),
  rankeadas AS (
    SELECT v.*,
      COUNT(*)     OVER (PARTITION BY v.colegio_id)                                              AS n_colegio,
      ROW_NUMBER() OVER (PARTITION BY v.colegio_id ORDER BY v.puntaje_global DESC, v.id ASC)     AS rn_mejor,
      ROW_NUMBER() OVER (PARTITION BY v.colegio_id ORDER BY v.puntaje_global ASC,  v.id DESC)    AS rn_peor
    FROM validas v
  ),
  elegidas AS (
    -- Con 4 o menos estudiantes mejores y peores se solapan: manda 'mejor', para no repetir al
    -- mismo estudiante en las dos mitades (igual que el Set `usados` del endpoint original).
    SELECT r.*, CASE WHEN r.rn_mejor <= 2 THEN 'mejor' ELSE 'peor' END AS tipo
    FROM rankeadas r
    WHERE r.rn_mejor <= 2 OR r.rn_peor <= 2
  )
  SELECT jsonb_build_object(
    'filas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tipo', e.tipo, 'colegio_id', e.colegio_id, 'estudiante_id', e.estudiante_id,
        'n_colegio', e.n_colegio,
        'puntaje_global', e.puntaje_global, 'desempeno_pct', e.desempeno_pct,
        'mat_cuantitativo', e.mat_cuantitativo, 'mat_especifico', e.mat_especifico,
        'lectura_critica', e.lectura_critica, 'sociales', e.sociales, 'ciudadanas', e.ciudadanas,
        'cn_quimica', e.cn_quimica, 'cn_fisica', e.cn_fisica, 'cn_biologia', e.cn_biologia,
        'cn_cts', e.cn_cts, 'ingles', e.ingles,
        -- Nombre resuelto aquí: antes eran ~4 peticiones extra en lotes de 200.
        -- SOLO columnas con GRANT para `authenticated`. Pedir `documento` o `genero` no devuelve
        -- la columna vacía: hace fallar la consulta ENTERA — ya pasó, y el reporte salió sin
        -- NINGÚN nombre. `usuario` sí está concedido y en esta base es el mismo documento.
        'nombre', es.nombre, 'usuario', es.usuario, 'grado', es.grado
      ) ORDER BY e.colegio_id, e.tipo, e.puntaje_global DESC)
      FROM elegidas e LEFT JOIN estudiantes es ON es.id = e.estudiante_id
    ), '[]'::jsonb),
    -- Un reporte que filtra en silencio se lee como si hubiera cubierto a todos; además el número
    -- de descartados es señal de problemas de escaneo o de emparejamiento de sesiones.
    'descartados', jsonb_build_object(
      'en blanco',     (SELECT COUNT(*) FROM todas WHERE s1_vacia AND s2_vacia),
      'sin sesión 1',  (SELECT COUNT(*) FROM todas WHERE s1_vacia AND NOT s2_vacia),
      'sin sesión 2',  (SELECT COUNT(*) FROM todas WHERE s2_vacia AND NOT s1_vacia)
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_proyecto_pruebas_conteo(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_proyecto_desviacion(uuid, uuid[]) TO authenticated;
