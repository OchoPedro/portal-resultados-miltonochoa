-- Tabla `regiones`: una sola fuente para el mapa departamento → región
-- Aplicado en Supabase el 2026-07-20 (migraciones: nivel1_tabla_regiones,
-- nivel1_alias_departamentos, nivel1_rpcs_leen_tabla_regiones)
--
-- ANTES el mapa estaba escrito a mano en NUEVE lugares: 3 archivos del portal
-- (RankingNacional, ReporteAgrupado, ReportePlantel), 4 de plataforma-interna (AdminRanking,
-- AdminAnalisis, ReporteAgrupado, ReportePlantel) y dentro del SQL de get_competencias_gestion
-- y get_componentes_gestion.
--
-- ── EL BUG QUE DESTAPÓ ──────────────────────────────────────────────────────────────────────
-- Las dos tablas escriben los departamentos distinto:
--
--   colegios.departamento_nombre                              ranking_colegios.departamento
--   'BOGOTÁ, D.C.'      (con coma)                            'BOGOTÁ D.C.'
--   'NORTE DE SANTANDER'                                      'NORTE SANTANDER'
--   'QUINDIO'           (sin tilde)                           'QUINDÍO'
--   'ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA'  'SAN ANDRÉS'
--
-- El CASE de las RPC llevaba las grafías de `ranking_colegios` pero leía el departamento de
-- `colegios`. Consecuencias, las dos silenciosas:
--
--   1. Para los 3.136 colegios con grafía divergente (2.313 de ellos en Bogotá) no había match
--      con ninguna rama → caía en ELSE ARRAY[v_dpto] y su "región" era su propio departamento.
--   2. Para TODOS los demás, el array de la región tampoco reconocía a esos departamentos, así
--      que la región venía incompleta:
--
--        región Andina:  6.993 colegios reconocidos → 10.107 reales  (faltaban 3.114)
--        región Caribe:  5.022 colegios reconocidos →  5.044 reales  (faltaban 22)
--
-- Es decir: la columna "Andina" del comparativo excluía a Bogotá entera. Un número plausible
-- con una etiqueta que mentía, imposible de detectar a ojo.
--
-- La tabla registra AMBAS grafías apuntando a la misma región, así el mapa deja de depender de
-- que alguien escriba el nombre igual en cada tabla. Cobertura: 20.444 de 20.444 colegios.

CREATE TABLE IF NOT EXISTS regiones (
  departamento text PRIMARY KEY,
  region       text NOT NULL
);

ALTER TABLE regiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regiones_lectura ON regiones;
CREATE POLICY regiones_lectura ON regiones FOR SELECT TO authenticated, anon USING (true);

INSERT INTO regiones (departamento, region) VALUES
  ('ANTIOQUIA','Andina'), ('BOGOTÁ D.C.','Andina'), ('BOYACÁ','Andina'), ('CALDAS','Andina'),
  ('CUNDINAMARCA','Andina'), ('HUILA','Andina'), ('NORTE SANTANDER','Andina'),
  ('QUINDÍO','Andina'), ('RISARALDA','Andina'), ('SANTANDER','Andina'), ('TOLIMA','Andina'),
  ('ATLÁNTICO','Caribe'), ('BOLÍVAR','Caribe'), ('CESAR','Caribe'), ('CÓRDOBA','Caribe'),
  ('LA GUAJIRA','Caribe'), ('MAGDALENA','Caribe'), ('SUCRE','Caribe'), ('SAN ANDRÉS','Caribe'),
  ('CAUCA','Pacífica'), ('CHOCÓ','Pacífica'), ('NARIÑO','Pacífica'), ('VALLE DEL CAUCA','Pacífica'),
  ('ARAUCA','Orinoquía'), ('CASANARE','Orinoquía'), ('META','Orinoquía'), ('VICHADA','Orinoquía'),
  ('AMAZONAS','Amazonía'), ('CAQUETÁ','Amazonía'), ('GUAINÍA','Amazonía'),
  ('GUAVIARE','Amazonía'), ('PUTUMAYO','Amazonía'), ('VAUPÉS','Amazonía'),
  -- Grafías alternas de `colegios` (mismo departamento, otro nombre)
  ('BOGOTÁ, D.C.', 'Andina'),
  ('NORTE DE SANTANDER', 'Andina'),
  ('QUINDIO', 'Andina'),
  ('ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA', 'Caribe')
ON CONFLICT (departamento) DO UPDATE SET region = EXCLUDED.region;

-- En get_competencias_gestion y get_componentes_gestion, el CASE de 20 líneas se reemplazó por:
--
--   SELECT COALESCE(array_agg(r2.departamento), ARRAY[v_dpto]) INTO v_region
--   FROM regiones r1 JOIN regiones r2 ON r2.region = r1.region
--   WHERE r1.departamento = v_dpto;
--
-- (ver supabase-referentes-minimo.sql para el cuerpo completo de esas funciones)

-- ── PENDIENTE ───────────────────────────────────────────────────────────────────────────────
-- Quedan 7 copias del mapa en el front. Esas leen `ranking_colegios`, que sí usa las grafías
-- canónicas, así que NO tienen el bug — pero siguen siendo copias que pueden divergir. Migrarlas
-- a leer esta tabla es el resto del nivel 1.
