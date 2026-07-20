-- Promedios de referencia (departamento y región) del Reporte de Plantel del Ranking
-- Aplicado en Supabase el 2026-07-20 (migración: rpc_ranking_referencias)
--
-- Antes: el navegador descargaba TODAS las filas del departamento y de la región entera y
-- promediaba en JS. Para un colegio de la región Andina (11 departamentos, media Colombia)
-- son 34.216 filas traídas en 35 peticiones ESTRICTAMENTE SECUENCIALES — páginas de 1000 con
-- await en cada vuelta — para terminar mostrando 5 filas por bloque. De ahí los ~9 segundos.
--
-- Ahora: 1 petición, 10 filas, ~126 ms del lado del servidor.
--
-- Equivalencia con el cálculo anterior (las columnas son numeric/int, no texto):
--   * AVG() ignora NULL y divide por el conteo de no-nulos = el `sumar()` del JS, que saltaba
--     null/''/NaN llevando un contador por campo.
--   * total_colegios = COUNT(*) del año, incluidas filas con campos nulos (era `v.n`).
--   * Se excluye el propio plantel del promedio que lo compara (era .neq('codigo', codigo)).
-- Verificado contra el cálculo viejo: coincidencia exacta a 6 decimales en los 5 años, y los
-- conteos de filas también.
--
-- Además arregla un riesgo silencioso: la paginación llamaba .range() SIN ORDER BY, y Postgres
-- no garantiza el mismo orden entre consultas, así que entre página y página se podían repetir
-- u omitir filas. Agregando en la base el problema desaparece.
--
-- SECURITY INVOKER (por defecto): respeta la RLS de ranking_colegios, no la elude.
-- Probado con los roles authenticated (colegio) y anon (ranking público).

CREATE OR REPLACE FUNCTION public.get_ranking_referencias(
  p_codigo       text,
  p_anios        int[],
  p_departamento text,
  p_region_depts text[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  WITH base AS (
    SELECT anio, lectura_critica, matematicas, ciencias_sociales,
           ciencias_naturales, ingles, ponderado, puntaje_global,
           departamento
    FROM ranking_colegios
    WHERE anio = ANY(p_anios)
      AND codigo IS DISTINCT FROM p_codigo
  ),
  dept AS (
    SELECT anio,
      AVG(lectura_critica)    AS lectura_critica,
      AVG(matematicas)        AS matematicas,
      AVG(ciencias_sociales)  AS ciencias_sociales,
      AVG(ciencias_naturales) AS ciencias_naturales,
      AVG(ingles)             AS ingles,
      AVG(ponderado)          AS ponderado,
      AVG(puntaje_global)     AS puntaje_global,
      COUNT(*)                AS total_colegios
    FROM base WHERE departamento = p_departamento GROUP BY anio
  ),
  region AS (
    SELECT anio,
      AVG(lectura_critica)    AS lectura_critica,
      AVG(matematicas)        AS matematicas,
      AVG(ciencias_sociales)  AS ciencias_sociales,
      AVG(ciencias_naturales) AS ciencias_naturales,
      AVG(ingles)             AS ingles,
      AVG(ponderado)          AS ponderado,
      AVG(puntaje_global)     AS puntaje_global,
      COUNT(*)                AS total_colegios
    FROM base WHERE departamento = ANY(p_region_depts) GROUP BY anio
  )
  SELECT jsonb_build_object(
    'dept',   COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.anio) FROM dept d),   '[]'::jsonb),
    'region', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.anio) FROM region r), '[]'::jsonb)
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_ranking_referencias(text, int[], text, text[]) TO authenticated, anon;
