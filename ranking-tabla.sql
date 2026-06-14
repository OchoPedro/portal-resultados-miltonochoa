-- Tabla de ranking de colegios Colombia (Saber 11)
CREATE TABLE IF NOT EXISTS ranking_colegios (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  anio             INTEGER NOT NULL,
  puesto_anio      INTEGER NOT NULL,
  puesto_periodo   INTEGER,
  codigo           TEXT,
  nombre           TEXT    NOT NULL,
  departamento     TEXT,
  ciudad           TEXT,
  calendario       TEXT,
  naturaleza       TEXT,
  jornada          TEXT,
  eval_estudiantes INTEGER,
  lectura_critica  NUMERIC(6,3),
  matematicas      NUMERIC(6,3),
  ciencias_sociales NUMERIC(6,3),
  ciencias_naturales NUMERIC(6,3),
  ingles           NUMERIC(6,3),
  ponderado        NUMERIC(8,3),
  puntaje_global   INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(anio, codigo)
);

CREATE INDEX IF NOT EXISTS ranking_anio_puesto_idx ON ranking_colegios(anio, puesto_anio);
CREATE INDEX IF NOT EXISTS ranking_nombre_idx      ON ranking_colegios USING gin(to_tsvector('simple', nombre));
CREATE INDEX IF NOT EXISTS ranking_depto_idx       ON ranking_colegios(anio, departamento);
