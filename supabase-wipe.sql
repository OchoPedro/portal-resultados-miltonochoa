-- ============================================================
-- AAMO Portal — Borrado completo de datos de prueba
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ⚠️  IRREVERSIBLE — hacer backup antes si es necesario
-- ============================================================

-- El orden importa: primero las tablas dependientes, luego las principales

DELETE FROM notas_competencia;
DELETE FROM comparativos_salon;
DELETE FROM comparativos_gestion;
DELETE FROM analisis_ia;
DELETE FROM analisis_preguntas;
DELETE FROM resultados_estudiante;
DELETE FROM estudiantes;
DELETE FROM pruebas;
DELETE FROM colegios;

-- administradores NO se borra para no perder el acceso.
-- Si quieres resetear admins también, descomenta:
-- DELETE FROM administradores;

-- ── Verificación ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM colegios)            AS colegios,
  (SELECT COUNT(*) FROM estudiantes)         AS estudiantes,
  (SELECT COUNT(*) FROM pruebas)             AS pruebas,
  (SELECT COUNT(*) FROM resultados_estudiante) AS resultados,
  (SELECT COUNT(*) FROM administradores)     AS admins;
-- Debe mostrar 0 en todo excepto admins
