-- =====================================================
-- CORRECCIÓN DE POLÍTICAS RLS - Tabla Gastos
-- =====================================================
-- Fecha: 2026-02-01
-- Problema: Las políticas RLS referencian tabla 'profiles' 
-- que no existe. Deben usar tabla 'hermanos' con campo 'rol'
-- =====================================================

-- 1. Eliminar políticas RLS incorrectas que referencian 'profiles'
DROP POLICY IF EXISTS "Solo JUNTA y SUPERADMIN pueden crear gastos" ON gastos;
DROP POLICY IF EXISTS "Solo JUNTA y SUPERADMIN pueden actualizar gastos" ON gastos;
DROP POLICY IF EXISTS "Solo JUNTA y SUPERADMIN pueden eliminar gastos" ON gastos;

-- 2. Recrear políticas RLS correctas usando 'hermanos.rol'

-- Política INSERT: Solo SUPERADMIN y JUNTA pueden crear gastos
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden crear gastos"
  ON gastos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- Política UPDATE: Solo SUPERADMIN y JUNTA pueden actualizar gastos
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden actualizar gastos"
  ON gastos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- Política DELETE: Solo SUPERADMIN y JUNTA pueden eliminar gastos
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden eliminar gastos"
  ON gastos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- 3. Comentario de documentación
COMMENT ON TABLE gastos IS 'Gastos generales de la Hermandad - Políticas RLS corregidas para usar hermanos.rol';
