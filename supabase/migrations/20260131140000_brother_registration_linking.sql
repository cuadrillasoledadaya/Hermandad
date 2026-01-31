-- =====================================================
-- MIGRACIÓN: Sistema de Registro Automático de Hermanos
-- Fecha: 2026-01-31
-- =====================================================

-- 1. Asegurar ON UPDATE CASCADE en las claves foráneas que apuntan a hermanos
ALTER TABLE cortejo_asignaciones
DROP CONSTRAINT IF EXISTS cortejo_asignaciones_id_hermano_fkey,
ADD CONSTRAINT cortejo_asignaciones_id_hermano_fkey 
    FOREIGN KEY (id_hermano) REFERENCES hermanos(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE papeletas_cortejo
DROP CONSTRAINT IF EXISTS papeletas_cortejo_id_hermano_fkey,
ADD CONSTRAINT papeletas_cortejo_id_hermano_fkey 
    FOREIGN KEY (id_hermano) REFERENCES hermanos(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Asegurar que el email de hermanos es único
UPDATE hermanos SET email = NULL WHERE email = '';
ALTER TABLE hermanos DROP CONSTRAINT IF EXISTS hermanos_email_unique;
ALTER TABLE hermanos ADD CONSTRAINT hermanos_email_unique UNIQUE (email);

-- 3. Función para vincular el usuario de Auth con el registro de Hermano
CREATE OR REPLACE FUNCTION public.handle_new_user_linking()
RETURNS TRIGGER AS $$
DECLARE
    found_hermano_id UUID;
BEGIN
    SELECT id INTO found_hermano_id
    FROM public.hermanos
    WHERE email = NEW.email;

    IF found_hermano_id IS NOT NULL THEN
        UPDATE public.hermanos
        SET id = NEW.id,
            updated_at = NOW()
        WHERE id = found_hermano_id;
        
        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'Este correo electrónico no está registrado con ningún hermano.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_link ON auth.users;
CREATE TRIGGER on_auth_user_created_link
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_linking();
