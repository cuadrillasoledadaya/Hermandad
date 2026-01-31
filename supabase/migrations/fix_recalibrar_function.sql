-- =====================================================
-- FIX: RECALIBRAR NUMEROS HERMANO (Qualified Names)
-- =====================================================
-- El fix de seguridad anterior rompió esta función porque 
-- referenciaba tablas sin "public.". Aquí la redefinimos correctamente.

CREATE OR REPLACE FUNCTION public.recalibrar_numeros_hermano()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' -- Mantenemos seguridad estricta
AS $$
BEGIN
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY fecha_alta ASC, created_at ASC) as nuevo_numero
        FROM public.hermanos -- AHORA CON PUBLIC.
        WHERE activo = TRUE
    )
    UPDATE public.hermanos -- AHORA CON PUBLIC.
    SET numero_hermano = ranked.nuevo_numero
    FROM ranked
    WHERE public.hermanos.id = ranked.id;
END;
$$;
