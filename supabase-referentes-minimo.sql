-- Referentes geográficos con muestra mínima por colegio
-- Aplicado en Supabase el 2026-07-20 (migración: gestion_referentes_minimo_10_estudiantes_por_colegio)
--
-- Los referentes Nacional / Región / Departamento / Municipio de las vistas "Desviación por
-- Competencias" y "Desviación por Componentes" promedian COLEGIOS, no estudiantes: cada colegio
-- pesa igual sin importar cuántos alumnos calificados tenga. Eso hacía que un colegio a medio
-- calificar moviera la referencia de su municipio tanto como uno completo.
--
-- Caso real (GO-3, Biología, Betulia): el municipio mostraba 65 en "Explicación de Fenómenos"
-- porque un colegio con UN solo estudiante calificado (80) se promediaba con el otro, que tenía
-- 24 (50,8). Con el corte de 10 estudiantes, ese colegio deja de contar hasta que avance.
--
-- Reglas:
--   * Solo cuentan los colegios con >= 10 estudiantes calificados en ESA competencia/componente.
--   * El PLANTEL nunca se filtra: cada colegio ve sus propios datos aunque tenga pocos alumnos.
--   * Si ningún colegio del grupo alcanza el mínimo, el promedio sale NULL y la interfaz lo pinta
--     como "—" y sin barra (ColegioDashboard.jsx ya maneja prom == null).

CREATE OR REPLACE FUNCTION public.get_competencias_gestion(p_prueba_id uuid, p_colegio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_dpto   TEXT;
  v_mun    TEXT;
  v_region TEXT[];
  v_result JSONB;
  c_min_est CONSTANT INT := 10;  -- mínimo de estudiantes para que un colegio pese en el referente
BEGIN

  IF NOT (
    jwt_app_role() = 'admin'
    OR (jwt_app_role() = 'colegio' AND p_colegio_id = jwt_colegio_id())
    OR (jwt_app_role() = 'estudiante' AND p_colegio_id = jwt_est_colegio_id())
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT departamento_nombre, municipio INTO v_dpto, v_mun
  FROM colegios WHERE id = p_colegio_id;

  v_region := CASE
    WHEN v_dpto IN ('ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA')
      THEN ARRAY['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA']
    WHEN v_dpto IN ('ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS')
      THEN ARRAY['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS']
    WHEN v_dpto IN ('CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA')
      THEN ARRAY['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA']
    WHEN v_dpto IN ('ARAUCA','CASANARE','META','VICHADA')
      THEN ARRAY['ARAUCA','CASANARE','META','VICHADA']
    WHEN v_dpto IN ('AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS')
      THEN ARRAY['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS']
    ELSE ARRAY[v_dpto]
  END;

  WITH base AS (
    SELECT
      nc.materia,
      nc.competencia,
      nc.nota,
      nc.estudiante_id,
      e.colegio_id,
      co.departamento_nombre,
      co.municipio
    FROM notas_competencia nc
    JOIN estudiantes e ON e.id = nc.estudiante_id
    JOIN colegios co ON co.id = e.colegio_id
    WHERE nc.prueba_id = p_prueba_id
      AND nc.nota IS NOT NULL
  ),
  -- Promedio por colegio (para que cada colegio pese igual en comparativos geográficos).
  -- n_est: cuántos estudiantes calificados sostienen ese promedio.
  por_colegio AS (
    SELECT materia, competencia, colegio_id, departamento_nombre, municipio,
      AVG(nota) AS avg_nota,
      COUNT(DISTINCT estudiante_id) AS n_est
    FROM base
    GROUP BY materia, competencia, colegio_id, departamento_nombre, municipio
  ),
  -- Plantel: desviación calculada desde notas individuales de estudiantes (no de promedios por colegio)
  plantel_raw AS (
    SELECT materia, competencia,
      ROUND(AVG(nota)::NUMERIC, 1)    AS prom,
      ROUND(STDDEV(nota)::NUMERIC, 1) AS desv
    FROM base
    WHERE colegio_id = p_colegio_id
    GROUP BY materia, competencia
  )
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.materia, t.competencia) INTO v_result
  FROM (
    SELECT
      pc.materia,
      pc.competencia,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est THEN pc.avg_nota END)::NUMERIC, 1)  AS nac_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est THEN pc.avg_nota END)::NUMERIC, 1) AS nac_desv,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = ANY(v_region) THEN pc.avg_nota END)::NUMERIC, 1) AS reg_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = ANY(v_region) THEN pc.avg_nota END)::NUMERIC, 1) AS reg_desv,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = v_dpto THEN pc.avg_nota END)::NUMERIC, 1) AS dpto_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = v_dpto THEN pc.avg_nota END)::NUMERIC, 1) AS dpto_desv,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est AND pc.municipio = v_mun THEN pc.avg_nota END)::NUMERIC, 1) AS ciudad_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est AND pc.municipio = v_mun THEN pc.avg_nota END)::NUMERIC, 1) AS ciudad_desv,
      pr.prom  AS plantel_prom,
      pr.desv  AS plantel_desv
    FROM por_colegio pc
    LEFT JOIN plantel_raw pr ON pr.materia = pc.materia AND pr.competencia = pc.competencia
    GROUP BY pc.materia, pc.competencia, pr.prom, pr.desv
  ) t;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_componentes_gestion(p_prueba_id uuid, p_colegio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_dpto   TEXT; v_mun TEXT; v_region TEXT[]; v_result JSONB;
  c_min_est CONSTANT INT := 10;
BEGIN

  IF NOT (
    jwt_app_role() = 'admin'
    OR (jwt_app_role() = 'colegio' AND p_colegio_id = jwt_colegio_id())
    OR (jwt_app_role() = 'estudiante' AND p_colegio_id = jwt_est_colegio_id())
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT departamento_nombre, municipio INTO v_dpto, v_mun FROM colegios WHERE id = p_colegio_id;
  v_region := CASE
    WHEN v_dpto IN ('ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA')
      THEN ARRAY['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA']
    WHEN v_dpto IN ('ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS')
      THEN ARRAY['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS']
    WHEN v_dpto IN ('CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA')
      THEN ARRAY['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA']
    WHEN v_dpto IN ('ARAUCA','CASANARE','META','VICHADA')
      THEN ARRAY['ARAUCA','CASANARE','META','VICHADA']
    WHEN v_dpto IN ('AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS')
      THEN ARRAY['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS']
    ELSE ARRAY[v_dpto]
  END;
  WITH base AS (
    SELECT nc.materia, nc.componente, nc.nota, nc.estudiante_id, e.colegio_id, co.departamento_nombre, co.municipio
    FROM notas_componente nc
    JOIN estudiantes e ON e.id = nc.estudiante_id
    JOIN colegios co ON co.id = e.colegio_id
    WHERE nc.prueba_id = p_prueba_id AND nc.nota IS NOT NULL
  ),
  por_colegio AS (
    SELECT materia, componente, colegio_id, departamento_nombre, municipio,
      AVG(nota) AS avg_nota,
      COUNT(DISTINCT estudiante_id) AS n_est
    FROM base GROUP BY materia, componente, colegio_id, departamento_nombre, municipio
  ),
  plantel_raw AS (
    SELECT materia, componente,
      ROUND(AVG(nota)::NUMERIC, 1) AS prom,
      ROUND(STDDEV(nota)::NUMERIC, 1) AS desv
    FROM base WHERE colegio_id = p_colegio_id
    GROUP BY materia, componente
  )
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.materia, t.componente) INTO v_result
  FROM (
    SELECT pc.materia, pc.componente,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est THEN pc.avg_nota END)::NUMERIC, 1)   AS nac_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est THEN pc.avg_nota END)::NUMERIC, 1) AS nac_desv,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = ANY(v_region) THEN pc.avg_nota END)::NUMERIC, 1) AS reg_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = ANY(v_region) THEN pc.avg_nota END)::NUMERIC, 1) AS reg_desv,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = v_dpto THEN pc.avg_nota END)::NUMERIC, 1) AS dpto_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est AND pc.departamento_nombre = v_dpto THEN pc.avg_nota END)::NUMERIC, 1) AS dpto_desv,
      ROUND(AVG(CASE WHEN pc.n_est >= c_min_est AND pc.municipio = v_mun THEN pc.avg_nota END)::NUMERIC, 1) AS ciudad_prom,
      ROUND(STDDEV(CASE WHEN pc.n_est >= c_min_est AND pc.municipio = v_mun THEN pc.avg_nota END)::NUMERIC, 1) AS ciudad_desv,
      pr.prom AS plantel_prom, pr.desv AS plantel_desv
    FROM por_colegio pc
    LEFT JOIN plantel_raw pr ON pr.materia = pc.materia AND pr.componente = pc.componente
    GROUP BY pc.materia, pc.componente, pr.prom, pr.desv
  ) t;
  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$function$;
