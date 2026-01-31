-- =====================================================
-- FIX DE SEGURIDAD: FUNCIONES INSEGURAS (SOLUCIÓN SEGURA)
-- =====================================================

DO $$
BEGIN
    -- 1. handle_new_user
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
        ALTER FUNCTION handle_new_user() SET search_path = '';
    END IF;

    -- 2. update_updated_at_column
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        ALTER FUNCTION update_updated_at_column() SET search_path = '';
    END IF;

    -- 3. recalibrar_numeros_hermano
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalibrar_numeros_hermano') THEN
        ALTER FUNCTION recalibrar_numeros_hermano() SET search_path = '';
    END IF;

    -- 4. set_only_one_season_active
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_only_one_season_active') THEN
        ALTER FUNCTION set_only_one_season_active() SET search_path = '';
    END IF;
    
    -- 5. update_papeletas_cortejo_updated_at
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_papeletas_cortejo_updated_at') THEN
        ALTER FUNCTION update_papeletas_cortejo_updated_at() SET search_path = '';
    END IF;

END $$;

