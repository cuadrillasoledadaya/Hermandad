-- =====================================================
-- MIGRACIÓN: Corrección de Roles y Autenticación
-- Fecha: 2026-01-30
-- =====================================================

-- 1. Añadir columna 'rol' a tabla 'hermanos' si no existe
ALTER TABLE hermanos
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'HERMANO';

-- 2. Actualizar roles existentes (temporalmente asignar SUPERADMIN al usuario actual si es necesario)
-- Puedes descomentar y editar esto si conoces el ID o Email de un admin
-- UPDATE hermanos SET rol = 'SUPERADMIN' WHERE email = 'admin@hermandad.com';

-- 3. Crear índice para búsquedas rápidas por rol
CREATE INDEX IF NOT EXISTS idx_hermanos_rol ON hermanos(rol);

-- 4. Comentarios
COMMENT ON COLUMN hermanos.rol IS 'Rol del usuario: SUPERADMIN, JUNTA, HERMANO';
