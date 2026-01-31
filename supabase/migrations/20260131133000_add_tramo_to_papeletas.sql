-- =====================================================
-- MIGRACIÓN: Añadir Tramo a Papeletas de Cortejo
-- Versión: v1.1.14
-- Fecha: 2026-01-31
-- =====================================================

-- 1. Añadir columna tramo
ALTER TABLE papeletas_cortejo 
ADD COLUMN tramo INT;

-- 2. Comentario explicativo
COMMENT ON COLUMN papeletas_cortejo.tramo IS 'Tramo del cortejo (0: Cruz Guía, 1, 2, 3)';

-- 3. Actualizar datos existentes si es necesario (asumir tramo 1 por defecto para las ya vendidas si no se sabe)
-- Pero mejor dejarlo null para lo antiguo y que se rellene en lo nuevo.
