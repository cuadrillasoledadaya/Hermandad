-- =====================================================
-- MIGRACIÓN: Fix Constraints para nuevos tipos
-- Versión: v1.0.99
-- Fecha: 2026-01-31
-- =====================================================

-- 1. Fix constraint de cortejo_estructura (permite vara)
ALTER TABLE cortejo_estructura DROP CONSTRAINT IF EXISTS cortejo_estructura_tipo_check;
ALTER TABLE cortejo_estructura 
ADD CONSTRAINT cortejo_estructura_tipo_check 
CHECK (tipo IN ('cruz_guia', 'vara', 'insignia', 'nazareno', 'paso', 'bocina'));

-- 2. Fix constraint de papeletas_cortejo
ALTER TABLE papeletas_cortejo DROP CONSTRAINT IF EXISTS papeletas_cortejo_tipo_check;
ALTER TABLE papeletas_cortejo 
ADD CONSTRAINT papeletas_cortejo_tipo_check 
CHECK (tipo IN ('cruz_guia', 'vara', 'insignia', 'bocina', 'nazareno', 'costalero'));

-- 3. Actualizar datos de cortejo_estructura (si quedó alguno sin cambiar)
UPDATE cortejo_estructura SET tipo = 'vara' WHERE tipo = 'insignia';
