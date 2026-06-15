-- ============================================================
-- SEGURIDAD: Row Level Security para portal Milton Ochoa
-- ============================================================
-- Cómo aplicar:
--   1. Abre Supabase Dashboard → SQL Editor
--   2. Pega todo este archivo y ejecuta
--   3. Verifica en Authentication → Policies que las políticas aparecen
--
-- IMPORTANTE: el service_role key SIEMPRE bypasea RLS (úsalo solo en el servidor)
-- ============================================================

-- ── Helpers para leer los claims del JWT firmado por /api/auth ───────────────

CREATE OR REPLACE FUNCTION public.jwt_app_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'app_role',
    'anon'
  )
$$;

CREATE OR REPLACE FUNCTION public.jwt_colegio_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'colegio_id',
    'null'
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.jwt_est_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'est_id',
    'null'
  )::uuid
$$;

-- ── Activar RLS en tablas sensibles ─────────────────────────────────────────

ALTER TABLE public.colegios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_estudiante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_ia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pruebas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_competencia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_preguntas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparativos_salon    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparativos_gestion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colegio_anios         ENABLE ROW LEVEL SECURITY;

-- ranking_colegios es información pública (igual que la página web del ICFES)
-- NO se activa RLS aquí para que la pestaña Ranking siga cargando sin auth

-- ── Borrar políticas antiguas si existiesen ──────────────────────────────────

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
           AND tablename IN (
             'colegios','estudiantes','resultados_estudiante','analisis_ia',
             'administradores','pruebas','notas_competencia','analisis_preguntas',
             'comparativos_salon','comparativos_gestion','colegio_anios'
           )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── TABLA: administradores ───────────────────────────────────────────────────
-- Solo los admins pueden ver/modificar este tabla

CREATE POLICY "admins_todo" ON public.administradores
  FOR ALL USING (public.jwt_app_role() = 'admin');

-- ── TABLA: colegios ──────────────────────────────────────────────────────────

-- Admin: acceso total
CREATE POLICY "colegios_admin" ON public.colegios
  FOR ALL USING (public.jwt_app_role() = 'admin');

-- Colegio: solo se ve a sí mismo
CREATE POLICY "colegios_self_read" ON public.colegios
  FOR SELECT USING (
    public.jwt_app_role() = 'colegio'
    AND id = public.jwt_colegio_id()
  );

-- ── TABLA: pruebas ───────────────────────────────────────────────────────────

-- Admin: todo
CREATE POLICY "pruebas_admin" ON public.pruebas
  FOR ALL USING (public.jwt_app_role() = 'admin');

-- Colegio y estudiante: solo leer pruebas activas
CREATE POLICY "pruebas_read" ON public.pruebas
  FOR SELECT USING (
    public.jwt_app_role() IN ('colegio', 'estudiante')
    AND activa = true
  );

-- ── TABLA: estudiantes ───────────────────────────────────────────────────────

-- Admin: todo
CREATE POLICY "estudiantes_admin" ON public.estudiantes
  FOR ALL USING (public.jwt_app_role() = 'admin');

-- Colegio: solo sus propios estudiantes
CREATE POLICY "estudiantes_colegio" ON public.estudiantes
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
  );

-- Estudiante: solo su propio registro
CREATE POLICY "estudiantes_self" ON public.estudiantes
  FOR SELECT USING (
    public.jwt_app_role() = 'estudiante'
    AND id = public.jwt_est_id()
  );

-- ── TABLA: resultados_estudiante ─────────────────────────────────────────────

CREATE POLICY "resultados_admin" ON public.resultados_estudiante
  FOR ALL USING (public.jwt_app_role() = 'admin');

CREATE POLICY "resultados_colegio" ON public.resultados_estudiante
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
  );

-- Estudiante: solo sus propios resultados
CREATE POLICY "resultados_est" ON public.resultados_estudiante
  FOR SELECT USING (
    public.jwt_app_role() = 'estudiante'
    AND estudiante_id = public.jwt_est_id()
  );

-- ── TABLA: analisis_ia ───────────────────────────────────────────────────────

CREATE POLICY "analisis_admin" ON public.analisis_ia
  FOR ALL USING (public.jwt_app_role() = 'admin');

-- Colegio: solo sus análisis publicados (publicado = true)
CREATE POLICY "analisis_colegio_read" ON public.analisis_ia
  FOR SELECT USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
    AND publicado = true
  );

-- ── TABLAS auxiliares: misma lógica admin / colegio ─────────────────────────

CREATE POLICY "nc_admin" ON public.notas_competencia
  FOR ALL USING (public.jwt_app_role() = 'admin');
CREATE POLICY "nc_colegio" ON public.notas_competencia
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND estudiante_id IN (
      SELECT id FROM public.estudiantes WHERE colegio_id = public.jwt_colegio_id()
    )
  );

CREATE POLICY "ap_admin" ON public.analisis_preguntas
  FOR ALL USING (public.jwt_app_role() = 'admin');
CREATE POLICY "ap_colegio" ON public.analisis_preguntas
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
  );

CREATE POLICY "cs_admin" ON public.comparativos_salon
  FOR ALL USING (public.jwt_app_role() = 'admin');
CREATE POLICY "cs_colegio" ON public.comparativos_salon
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
  );

CREATE POLICY "cg_admin" ON public.comparativos_gestion
  FOR ALL USING (public.jwt_app_role() = 'admin');
CREATE POLICY "cg_colegio" ON public.comparativos_gestion
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
  );

CREATE POLICY "ca_admin" ON public.colegio_anios
  FOR ALL USING (public.jwt_app_role() = 'admin');
CREATE POLICY "ca_colegio" ON public.colegio_anios
  FOR ALL USING (
    public.jwt_app_role() = 'colegio'
    AND colegio_id = public.jwt_colegio_id()
  );

-- ── Verificación final ───────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
