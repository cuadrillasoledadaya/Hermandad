-- =====================================================
-- MIGRACIÓN: Robustez en Registro de Hermanos
-- Fecha: 2026-01-31
-- =====================================================

-- 1. Añadir ON UPDATE CASCADE a tablas adicionales si existen
DO $$ 
BEGIN
    -- Tabla PAGOS
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pagos_id_hermano_fkey') THEN
            ALTER TABLE public.pagos DROP CONSTRAINT pagos_id_hermano_fkey;
        END IF;
        ALTER TABLE public.pagos 
            ADD CONSTRAINT pagos_id_hermano_fkey 
            FOREIGN KEY (id_hermano) REFERENCES public.hermanos(id) 
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Tabla INGRESOS
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ingresos') THEN
        -- Buscar el nombre de la constraint que apunta a hermanos
        -- A veces se llama ingresos_id_hermano_fkey o similar
        DECLARE
            const_name TEXT;
        BEGIN
            SELECT constraint_name INTO const_name
            FROM information_schema.key_column_usage
            WHERE table_name = 'ingresos' 
              AND column_name = 'id_hermano' 
              AND table_schema = 'public'
            LIMIT 1;

            IF const_name IS NOT NULL THEN
                EXECUTE 'ALTER TABLE public.ingresos DROP CONSTRAINT ' || const_name;
            END IF;
            
            ALTER TABLE public.ingresos 
                ADD CONSTRAINT ingresos_id_hermano_fkey 
                FOREIGN KEY (id_hermano) REFERENCES public.hermanos(id) 
                ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo actualizar constraint en ingresos';
        END;
    END IF;
END $$;

-- 2. Mejorar la función de vínculo (más robusta y case-insensitive)
CREATE OR REPLACE FUNCTION public.handle_new_user_linking()
RETURNS TRIGGER AS $$
DECLARE
    found_hermano_id UUID;
    hermano_nombre TEXT;
BEGIN
    -- Buscamos el hermano por email (sin distinguir mayúsculas/minúsculas)
    SELECT id, nombre || ' ' || apellidos INTO found_hermano_id, hermano_nombre
    FROM public.hermanos
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;

    IF found_hermano_id IS NOT NULL THEN
        -- Vinculamos actualizando el ID (esto se propaga por los CASCADE)
        UPDATE public.hermanos
        SET id = NEW.id,
            updated_at = NOW()
        WHERE id = found_hermano_id;
        
        -- Opcional: Podríamos actualizar metadatos del usuario aquí si fuera necesario
        RETURN NEW;
    ELSE
        -- Error descriptivo que Supabase Auth debería propagar
        RAISE EXCEPTION 'EL EMAIL % NO ESTÁ REGISTRADO. Contacte con la Hermandad para dar de alta su correo en su ficha de hermano.', NEW.email;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asegurar que el trigger está activo
DROP TRIGGER IF EXISTS on_auth_user_created_link ON auth.users;
CREATE TRIGGER on_auth_user_created_link
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_linking();
