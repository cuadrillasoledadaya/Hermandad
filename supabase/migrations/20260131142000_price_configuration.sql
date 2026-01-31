-- Migración para la configuración de precios centralizada
-- Fecha: 2026-01-31

CREATE TABLE IF NOT EXISTS public.configuracion_precios (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Solo una fila permitida
    cuota_mensual_hermano DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    papeleta_nazareno DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    papeleta_costalero DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    papeleta_insignia DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    papeleta_vara DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    papeleta_bocina DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    papeleta_cruz_guia DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insertar valores iniciales si no existen
INSERT INTO public.configuracion_precios (id, cuota_mensual_hermano, papeleta_nazareno, papeleta_costalero, papeleta_insignia, papeleta_vara, papeleta_bocina, papeleta_cruz_guia)
VALUES (1, 10.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.configuracion_precios ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Cualquier usuario autenticado puede leer precios"
ON public.configuracion_precios FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo SUPERADMIN y JUNTA pueden modificar precios"
ON public.configuracion_precios FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.hermanos
        WHERE id = auth.uid()
        AND rol IN ('SUPERADMIN', 'JUNTA')
    )
);

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER set_updated_at_config_precios
BEFORE UPDATE ON public.configuracion_precios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.configuracion_precios IS 'Tabla de configuración central para precios de cuotas y papeletas';
