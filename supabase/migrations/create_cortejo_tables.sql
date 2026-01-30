-- =====================================================
-- SISTEMA DE GESTIÓN DEL CORTEJO PROCESIONAL
-- =====================================================
-- Tablas para gestionar la organización visual del cortejo
-- con asignaciones de hermanos a posiciones específicas
-- =====================================================

-- 1. Tabla de Estructura del Cortejo (posiciones disponibles)
CREATE TABLE IF NOT EXISTS cortejo_estructura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL, -- 'Cruz de Guía', 'Insignia 1A', 'Nazareno Fila 1 Derecha'
  tipo TEXT NOT NULL CHECK (tipo IN ('cruz_guia', 'insignia', 'nazareno', 'paso')),
  tramo INTEGER NOT NULL, -- 0=Cruz Guía, 1-3=Tramos
  posicion INTEGER NOT NULL, -- Orden dentro del tramo
  lado TEXT CHECK (lado IN ('centro', 'derecha', 'izquierda')),
  paso_asociado TEXT CHECK (paso_asociado IN ('vera_cruz', 'santo_entierro', 'soledad')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tramo, posicion, lado)
);

-- 2. Tabla de Asignaciones (hermanos asignados a posiciones)
CREATE TABLE IF NOT EXISTS cortejo_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_hermano UUID REFERENCES hermanos(id) ON DELETE CASCADE,
  id_posicion UUID REFERENCES cortejo_estructura(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL, -- Temporada
  numero_papeleta INTEGER, -- Número sorteado (opcional)
  fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notas TEXT,
  UNIQUE(id_hermano, anio), -- Un hermano, una posición por año
  UNIQUE(id_posicion, anio) -- Una posición, un hermano por año
);

-- 3. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_cortejo_estructura_tipo ON cortejo_estructura(tipo);
CREATE INDEX IF NOT EXISTS idx_cortejo_estructura_tramo ON cortejo_estructura(tramo, posicion);
CREATE INDEX IF NOT EXISTS idx_cortejo_asignaciones_anio ON cortejo_asignaciones(anio);
CREATE INDEX IF NOT EXISTS idx_cortejo_asignaciones_hermano ON cortejo_asignaciones(id_hermano, anio);

-- 4. Habilitar Row Level Security
ALTER TABLE cortejo_estructura ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortejo_asignaciones ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS - cortejo_estructura

-- Lectura: todos los autenticados
CREATE POLICY "Usuarios autenticados pueden ver estructura del cortejo"
  ON cortejo_estructura
  FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo SUPERADMIN y JUNTA
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden modificar estructura"
  ON cortejo_estructura
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- 6. Políticas RLS - cortejo_asignaciones

-- Lectura: todos los autenticados
CREATE POLICY "Usuarios autenticados pueden ver asignaciones del cortejo"
  ON cortejo_asignaciones
  FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo SUPERADMIN y JUNTA
CREATE POLICY "Solo JUNTA y SUPERADMIN pueden asignar posiciones"
  ON cortejo_asignaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

CREATE POLICY "Solo JUNTA y SUPERADMIN pueden actualizar asignaciones"
  ON cortejo_asignaciones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

CREATE POLICY "Solo JUNTA y SUPERADMIN pueden eliminar asignaciones"
  ON cortejo_asignaciones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hermanos
      WHERE hermanos.id = auth.uid()
      AND hermanos.rol IN ('SUPERADMIN', 'JUNTA')
    )
  );

-- 7. Poblar con estructura inicial del cortejo

-- Cruz de Guía (Tramo 0)
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado) VALUES
  ('Cruz de Guía', 'cruz_guia', 0, 1, 'centro');

-- TRAMO 1 (antes del Cristo de la Vera Cruz)
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado) VALUES
  ('Insignia 1A', 'insignia', 1, 1, 'derecha'),
  ('Insignia 1B', 'insignia', 1, 2, 'izquierda');

-- Nazarenos Tramo 1 (10 filas de ejemplo)
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado)
SELECT 
  'Nazareno Fila ' || n || ' Derecha',
  'nazareno',
  1,
  10 + n, -- posición después de insignias
  'derecha'
FROM generate_series(1, 10) AS n;

INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado)
SELECT 
  'Nazareno Fila ' || n || ' Izquierda',
  'nazareno',
  1,
  10 + n,
  'izquierda'
FROM generate_series(1, 10) AS n;

-- Paso 1: Cristo de la Vera Cruz
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado, paso_asociado) VALUES
  ('Cristo de la Vera Cruz', 'paso', 1, 100, 'centro', 'vera_cruz');

-- TRAMO 2 (antes del Santo Entierro)
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado) VALUES
  ('Insignia 2A', 'insignia', 2, 1, 'derecha'),
  ('Insignia 2B', 'insignia', 2, 2, 'izquierda');

-- Nazarenos Tramo 2
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado)
SELECT 
  'Nazareno Fila ' || n || ' Derecha',
  'nazareno',
  2,
  10 + n,
  'derecha'
FROM generate_series(1, 10) AS n;

INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado)
SELECT 
  'Nazareno Fila ' || n || ' Izquierda',
  'nazareno',
  2,
  10 + n,
  'izquierda'
FROM generate_series(1, 10) AS n;

-- Paso 2: Santo Entierro
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado, paso_asociado) VALUES
  ('Santo Entierro', 'paso', 2, 100, 'centro', 'santo_entierro');

-- TRAMO 3 (antes de María Santísima)
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado) VALUES
  ('Insignia 3A', 'insignia', 3, 1, 'derecha'),
  ('Insignia 3B', 'insignia', 3, 2, 'izquierda');

-- Nazarenos Tramo 3
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado)
SELECT 
  'Nazareno Fila ' || n || ' Derecha',
  'nazareno',
  3,
  10 + n,
  'derecha'
FROM generate_series(1, 10) AS n;

INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado)
SELECT 
  'Nazareno Fila ' || n || ' Izquierda',
  'nazareno',
  3,
  10 + n,
  'izquierda'
FROM generate_series(1, 10) AS n;

-- Paso 3: María Santísima en su Soledad
INSERT INTO cortejo_estructura (nombre, tipo, tramo, posicion, lado, paso_asociado) VALUES
  ('María Santísima en su Soledad', 'paso', 3, 100, 'centro', 'soledad');

-- 8. Comentarios para documentación
COMMENT ON TABLE cortejo_estructura IS 'Estructura fija del cortejo procesional con todas las posiciones disponibles';
COMMENT ON TABLE cortejo_asignaciones IS 'Asignaciones de hermanos a posiciones del cortejo por temporada';
COMMENT ON COLUMN cortejo_estructura.tipo IS 'Tipo de posición: cruz_guia, insignia, nazareno, paso';
COMMENT ON COLUMN cortejo_estructura.tramo IS '0=Cruz Guía, 1-3=Tramos del cortejo';
COMMENT ON COLUMN cortejo_asignaciones.numero_papeleta IS 'Número de papeleta sorteada (si aplica)';
