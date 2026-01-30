-- =====================================================
-- MIGRACIÓN: Sistema de Papeletas del Cortejo
-- Versión: v1.0.78
-- Fecha: 2026-01-30
-- =====================================================

-- 1. Actualizar tabla cortejo_estructura con tipos de insignia
ALTER TABLE cortejo_estructura
ADD COLUMN tipo_insignia VARCHAR(20),
ADD COLUMN nombre_especifico VARCHAR(100);

COMMENT ON COLUMN cortejo_estructura.tipo_insignia IS 'Tipo específico de insignia: cirio, vara, bocina, estandarte';
COMMENT ON COLUMN cortejo_estructura.nombre_especifico IS 'Nombre específico del estandarte (ej: Estandarte de San Juan)';

-- 2. Actualizar datos existentes de insignias con tipos
-- Asumiendo que las 2 insignias del Tramo 1 son: 1 cirio, 1 vara
UPDATE cortejo_estructura
SET tipo_insignia = 'cirio'
WHERE tipo = 'insignia' AND tramo = 1 AND posicion = 1;

UPDATE cortejo_estructura
SET tipo_insignia = 'vara'
WHERE tipo = 'insignia' AND tramo = 1 AND posicion = 2;

-- Tramo 2: 1 bocina, 1 cirio
UPDATE cortejo_estructura
SET tipo_insignia = 'bocina'
WHERE tipo = 'insignia' AND tramo = 2 AND posicion = 1;

UPDATE cortejo_estructura
SET tipo_insignia = 'cirio'
WHERE tipo = 'insignia' AND tramo = 2 AND posicion = 2;

-- Tramo 3: 1 estandarte, 1 vara
UPDATE cortejo_estructura
SET tipo_insignia = 'estandarte'
WHERE tipo = 'insignia' AND tramo = 3 AND posicion = 1;

UPDATE cortejo_estructura
SET tipo_insignia = 'vara'
WHERE tipo = 'insignia' AND tramo = 3 AND posicion = 2;

-- 3. Actualizar tabla ingresos con tipo y referencia a papeleta
ALTER TABLE ingresos
ADD COLUMN tipo_ingreso VARCHAR(30) DEFAULT 'cuota',
ADD COLUMN id_papeleta UUID;

COMMENT ON COLUMN ingresos.tipo_ingreso IS 'Tipo de ingreso: cuota, papeleta_cortejo, donacion, otro';
COMMENT ON COLUMN ingresos.id_papeleta IS 'Referencia a papeleta del cortejo si aplica';

-- Actualizar ingresos existentes
UPDATE ingresos SET tipo_ingreso = 'cuota' WHERE tipo_ingreso IS NULL;

-- 4. Crear tabla papeletas_cortejo
CREATE TABLE papeletas_cortejo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Hermano que compra
    id_hermano UUID NOT NULL REFERENCES hermanos(id) ON DELETE CASCADE,
    
    -- Información de la papeleta
    numero INT NOT NULL,
    anio INT NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('insignia', 'nazareno', 'costalero')),
    
    -- Estado del proceso
    estado VARCHAR(20) NOT NULL DEFAULT 'pagada' CHECK (estado IN ('pagada', 'asignada', 'cancelada')),
    
    -- Financiero
    importe DECIMAL(10,2) NOT NULL,
    fecha_pago TIMESTAMP NOT NULL DEFAULT NOW(),
    id_ingreso UUID REFERENCES ingresos(id) ON DELETE SET NULL,
    
    -- Asignación
    id_posicion_asignada UUID REFERENCES cortejo_estructura(id) ON DELETE SET NULL,
    fecha_asignacion TIMESTAMP,
    
    -- Auditoría
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(numero, anio),
    CHECK (importe > 0)
);

-- Índices para rendimiento
CREATE INDEX idx_papeletas_hermano ON papeletas_cortejo(id_hermano);
CREATE INDEX idx_papeletas_anio ON papeletas_cortejo(anio);
CREATE INDEX idx_papeletas_estado ON papeletas_cortejo(estado);
CREATE INDEX idx_papeletas_tipo ON papeletas_cortejo(tipo);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_papeletas_cortejo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_papeletas_cortejo_updated_at
    BEFORE UPDATE ON papeletas_cortejo
    FOR EACH ROW
    EXECUTE FUNCTION update_papeletas_cortejo_updated_at();

-- 5. Row Level Security (RLS)

-- Habilitar RLS
ALTER TABLE papeletas_cortejo ENABLE ROW LEVEL SECURITY;

-- Política: SELECT - Todos los autenticados pueden ver papeletas
CREATE POLICY "Papeletas visibles para autenticados"
ON papeletas_cortejo FOR SELECT
TO authenticated
USING (true);

-- Política: INSERT/UPDATE/DELETE - Solo SUPERADMIN y JUNTA
CREATE POLICY "Solo admins gestionan papeletas"
ON papeletas_cortejo FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hermanos
        WHERE id = auth.uid()
        AND rol IN ('SUPERADMIN', 'JUNTA')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hermanos
        WHERE id = auth.uid()
        AND rol IN ('SUPERADMIN', 'JUNTA')
    )
);

-- 6. Agregar foreign key bidireccional en ingresos
ALTER TABLE ingresos
ADD CONSTRAINT fk_ingresos_papeleta
FOREIGN KEY (id_papeleta)
REFERENCES papeletas_cortejo(id)
ON DELETE SET NULL;

-- 7. Comentarios en tabla
COMMENT ON TABLE papeletas_cortejo IS 'Gestión completa del ciclo de vida de papeletas del cortejo procesional';
COMMENT ON COLUMN papeletas_cortejo.estado IS 'Estado: pagada (vendida), asignada (posición asignada), cancelada (reembolsada)';
COMMENT ON COLUMN papeletas_cortejo.tipo IS 'Tipo de posición: insignia, nazareno, costalero';
