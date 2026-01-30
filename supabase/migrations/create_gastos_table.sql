-- =====================================================
-- TABLA DE GASTOS - Sistema de Tesorería
-- =====================================================
-- Esta tabla almacena todos los gastos de la Hermandad
-- con categorización y control de acceso por roles.
-- =====================================================

-- 1. Crear la tabla gastos
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Flores', 'Velas', 'Mantenimiento', 'Eventos', 'Otros')),
  cantidad DECIMAL(10,2) NOT NULL CHECK (cantidad > 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_created_at ON gastos(created_at DESC);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de seguridad

-- Política SELECT: Todos los usuarios autenticados pueden leer gastos
CREATE POLICY "Usuarios autenticados pueden ver gastos"
  ON gastos
  FOR SELECT
  TO authenticated
  USING (true);

-- Política INSERT: Solo SUPERADMIN y JUNTA pueden crear gastos
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden crear gastos"
  ON gastos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- Política UPDATE: Solo SUPERADMIN y JUNTA pueden actualizar gastos
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden actualizar gastos"
  ON gastos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- Política DELETE: Solo SUPERADMIN y JUNTA pueden eliminar gastos
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden eliminar gastos"
  ON gastos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- 5. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gastos_updated_at
  BEFORE UPDATE ON gastos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Comentarios para documentación
COMMENT ON TABLE gastos IS 'Gastos generales de la Hermandad con categorización y control de acceso';
COMMENT ON COLUMN gastos.concepto IS 'Descripción del gasto';
COMMENT ON COLUMN gastos.categoria IS 'Categoría: Flores, Velas, Mantenimiento, Eventos, Otros';
COMMENT ON COLUMN gastos.cantidad IS 'Importe del gasto en euros';
COMMENT ON COLUMN gastos.fecha IS 'Fecha en que se realizó el gasto';
COMMENT ON COLUMN gastos.notas IS 'Notas adicionales opcionales';
