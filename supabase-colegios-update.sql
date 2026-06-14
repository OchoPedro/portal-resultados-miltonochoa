-- ─────────────────────────────────────────────────────────────
-- 1. Nuevas columnas en la tabla colegios
-- ─────────────────────────────────────────────────────────────
ALTER TABLE colegios
  ADD COLUMN IF NOT EXISTS calendario TEXT,
  ADD COLUMN IF NOT EXISTS naturaleza TEXT,
  ADD COLUMN IF NOT EXISTS jornada    TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla de años históricos por colegio
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colegio_anios (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  colegio_id  UUID    NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  anio        INTEGER NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE,
  fecha_cierre DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(colegio_id, anio)
);

-- Solo un año puede estar activo por colegio
CREATE UNIQUE INDEX IF NOT EXISTS colegio_anios_activo_uq
  ON colegio_anios(colegio_id)
  WHERE activo = TRUE;
