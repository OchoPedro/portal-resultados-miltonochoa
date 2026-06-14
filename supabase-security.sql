-- ============================================================
-- AAMO Portal — Migración de Seguridad Supabase
-- Ejecutar en: Dashboard → SQL Editor → New Query
-- ¡EJECUTAR UNA SOLA VEZ! Leer cada bloque antes de correr.
-- ============================================================


-- ── BLOQUE 1: Habilitar pgcrypto (bcrypt) ───────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ── BLOQUE 2: Hashear contraseñas existentes (texto plano → bcrypt) ──
-- El WHERE evita re-hashear si ya están en formato bcrypt ($2a$ o $2b$).
-- Verifica con: SELECT usuario, LEFT(password_hash,4) FROM administradores;
-- Si empieza con "$2a" o "$2b", ya fue hasheada. No volver a correr este bloque.

UPDATE administradores
SET password_hash = crypt(password_hash, gen_salt('bf', 10))
WHERE password_hash NOT LIKE '$2a$%' AND password_hash NOT LIKE '$2b$%';

UPDATE colegios
SET password_hash = crypt(password_hash, gen_salt('bf', 10))
WHERE password_hash NOT LIKE '$2a$%' AND password_hash NOT LIKE '$2b$%';

UPDATE estudiantes
SET password_hash = crypt(password_hash, gen_salt('bf', 10))
WHERE password_hash NOT LIKE '$2a$%' AND password_hash NOT LIKE '$2b$%';


-- ── BLOQUE 3: Función de login seguro ───────────────────────
-- SECURITY DEFINER = corre como service_role, nunca expone password_hash al cliente.
-- Login.jsx intenta llamar esta función primero. Mientras no exista, usa el modo legado.

CREATE OR REPLACE FUNCTION verificar_login(p_usuario text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row  record;
  ts     timestamptz := now();
  ts_str text        := to_char(ts AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI:SS');
BEGIN
  -- 1. Administradores
  SELECT id, nombre, usuario, password_hash, activo, ultima_sesion INTO v_row
  FROM administradores WHERE usuario = p_usuario AND activo = true LIMIT 1;
  IF FOUND THEN
    IF crypt(p_password, v_row.password_hash) = v_row.password_hash THEN
      UPDATE administradores SET ultima_sesion = ts WHERE id = v_row.id;
      RETURN json_build_object('role', 'admin', 'data', json_build_object(
        'id', v_row.id, 'nombre', v_row.nombre, 'usuario', v_row.usuario,
        'activo', v_row.activo, 'ultima_sesion', ts_str));
    END IF;
    RETURN NULL;
  END IF;

  -- 2. Colegios
  SELECT id, nombre, usuario, password_hash, activo, ciudad, municipio,
         departamento_nombre, contactos, ultima_sesion INTO v_row
  FROM colegios WHERE usuario = p_usuario AND activo = true LIMIT 1;
  IF FOUND THEN
    IF crypt(p_password, v_row.password_hash) = v_row.password_hash THEN
      UPDATE colegios SET ultima_sesion = ts WHERE id = v_row.id;
      RETURN json_build_object('role', 'colegio', 'data', json_build_object(
        'id', v_row.id, 'nombre', v_row.nombre, 'usuario', v_row.usuario,
        'activo', v_row.activo, 'ciudad', v_row.ciudad, 'municipio', v_row.municipio,
        'departamento_nombre', v_row.departamento_nombre,
        'contactos', v_row.contactos, 'ultima_sesion', ts_str));
    END IF;
    RETURN NULL;
  END IF;

  -- 3. Estudiantes
  SELECT e.id, e.nombre, e.usuario, e.password_hash, e.activo, e.grado, e.salon,
         e.colegio_id, e.ultima_sesion,
         json_build_object('nombre', c.nombre, 'ciudad', c.ciudad) AS colegio_info INTO v_row
  FROM estudiantes e
  LEFT JOIN colegios c ON c.id = e.colegio_id
  WHERE e.usuario = p_usuario AND e.activo = true LIMIT 1;
  IF FOUND THEN
    IF crypt(p_password, v_row.password_hash) = v_row.password_hash THEN
      UPDATE estudiantes SET ultima_sesion = ts WHERE id = v_row.id;
      RETURN json_build_object('role', 'estudiante', 'data', json_build_object(
        'id', v_row.id, 'nombre', v_row.nombre, 'usuario', v_row.usuario,
        'activo', v_row.activo, 'grado', v_row.grado, 'salon', v_row.salon,
        'colegio_id', v_row.colegio_id, 'ultima_sesion', ts_str,
        'colegios', v_row.colegio_info));
    END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

-- Dar permisos de ejecución al rol anon (el cliente usa la anon key)
GRANT EXECUTE ON FUNCTION verificar_login(text, text) TO anon;


-- ── BLOQUE 4: Función para cambiar contraseña (desde AdminAdmins) ──
-- Reemplaza el update directo password_hash = plaintext que hace AdminAdmins.jsx.
-- TODO: actualizar AdminAdmins.jsx para llamar esta función en lugar del update directo.

CREATE OR REPLACE FUNCTION cambiar_password(p_admin_id uuid, p_nueva_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE administradores
  SET password_hash = crypt(p_nueva_password, gen_salt('bf', 10))
  WHERE id = p_admin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cambiar_password(uuid, text) TO anon;


-- ── BLOQUE 5: Row Level Security ────────────────────────────
-- Objetivo mínimo: impedir que la anon key lea password_hash de administradores.
-- Las demás tablas mantienen acceso abierto (arquitectura sin Supabase Auth).

ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;

-- Denegar acceso directo a la tabla administradores con anon key.
-- El login ocurre vía verificar_login() (SECURITY DEFINER), que sí tiene acceso.
-- AdminAdmins.jsx usa select sin password_hash (corregido en el código).
CREATE POLICY "anon_select_sin_password" ON administradores
  FOR SELECT TO anon
  USING (true);  -- permite leer filas, pero sin la columna password_hash (ver BLOQUE 6)

CREATE POLICY "anon_insert" ON administradores
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON administradores
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete" ON administradores
  FOR DELETE TO anon USING (true);

-- BLOQUE 6: Restringir columna password_hash en administradores
-- Revoca el acceso a esa columna específica para el rol anon.
REVOKE SELECT (password_hash) ON administradores FROM anon;
-- Re-otorgar solo las columnas necesarias para AdminAdmins.jsx
GRANT SELECT (id, nombre, usuario, activo, ultima_sesion) ON administradores TO anon;
-- El INSERT/UPDATE de password_hash sigue funcionando (para crear/editar admins)
-- pero usar cambiar_password() es la forma segura.


-- ── BLOQUE 7: RLS en las demás tablas (acceso anon abierto) ─
-- Por ahora se mantiene abierto para no romper la app. Mejorar cuando
-- se implemente Supabase Auth con JWT personalizado.

ALTER TABLE colegios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON colegios FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON estudiantes FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE pruebas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pruebas FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE resultados_estudiante ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON resultados_estudiante FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE analisis_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON analisis_ia FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE analisis_preguntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON analisis_preguntas FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE comparativos_salon ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON comparativos_salon FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE comparativos_gestion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON comparativos_gestion FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE notas_competencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON notas_competencia FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── VERIFICACIÓN ─────────────────────────────────────────────
-- Después de ejecutar, comprobar:
-- 1. SELECT usuario, LEFT(password_hash,4) as tipo FROM administradores;
--    → debe mostrar "$2a" en todos los registros
-- 2. SELECT verificar_login('usuario_prueba', 'password_prueba');
--    → debe retornar el JSON del usuario o null
-- 3. SELECT password_hash FROM administradores;  (desde el cliente con anon key)
--    → debe retornar error de permisos (columna restringida)
