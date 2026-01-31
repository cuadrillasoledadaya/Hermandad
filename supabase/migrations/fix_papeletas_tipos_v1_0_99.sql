-- =====================================================
-- MIGRACIÓN: Fix Papeletas Cortejo Tipo Check Constraint
-- Versión: v1.0.99
-- Fecha: 2026-01-31
-- =====================================================

-- 1. Eliminar el constraint antiguo
ALTER TABLE papeletas_cortejo DROP CONSTRAINT IF EXISTS papeletas_cortejo_tipo_check;

-- 2. Agregar el nuevo constraint con todos los tipos
ALTER TABLE papeletas_cortejo 
ADD CONSTRAINT papeletas_cortejo_tipo_check 
CHECK (tipo IN ('cruz_guia', 'vara', 'insignia', 'bocina', 'nazareno', 'costalero'));

-- 3. Verificar que no hay datos 'insignia' en cortejo_estructura (ya los cambiamos a 'vara')
-- Este UPDATE es por seguridad, ya debería estar hecho
UPDATE cortejo_estructura SET tipo = 'vara' WHERE tipo = 'insignia';
