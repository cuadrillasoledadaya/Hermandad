-- =====================================================
-- FIX URGENTE: RESTAURAR PRIVILEGIOS DE SUPERADMIN
-- Soluciona el problema de recursión infinita en las políticas RLS
-- =====================================================

-- 1. Crear función segura para comprobar rol (SECURITY DEFINER)
-- Esta función se ejecuta con permisos elevados para leer el rol
-- "saltándose" el bloqueo que te impide ver que eres admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM hermanos
    WHERE id = auth.uid()
    AND rol IN ('SUPERADMIN', 'JUNTA')
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO service_role;

-- 2. Actualizar políticas para usar is_admin() y recuperar acceso

-- 2.1 HERMANOS (Aquí estaba el bloqueo principal)
DROP POLICY IF EXISTS "Admins ven todos los hermanos" ON hermanos;
CREATE POLICY "Restaurar lectura admins" ON hermanos
    FOR SELECT TO authenticated
    USING (is_admin());

DROP POLICY IF EXISTS "Admins gestionan hermanos" ON hermanos;
CREATE POLICY "Restaurar gestion admins" ON hermanos
    FOR ALL TO authenticated
    USING (is_admin());

-- 2.2 PAGOS
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos') THEN
        DROP POLICY IF EXISTS "Admins ven todos los pagos" ON pagos;
        CREATE POLICY "Restaurar lectura pagos admins" ON pagos
            FOR SELECT TO authenticated
            USING (is_admin());

        DROP POLICY IF EXISTS "Admins gestionan pagos" ON pagos;
        CREATE POLICY "Restaurar gestion pagos admins" ON pagos
            FOR ALL TO authenticated
            USING (is_admin());
    END IF;
END $$;

-- 2.3 CORTEJO ESTRUCTURA
DROP POLICY IF EXISTS "Escritura cortejo estructura" ON cortejo_estructura;
CREATE POLICY "Restaurar escritura cortejo estructura" ON cortejo_estructura
    FOR ALL TO authenticated
    USING (is_admin());

-- 2.4 CORTEJO ASIGNACIONES
DROP POLICY IF EXISTS "Escritura cortejo asignaciones" ON cortejo_asignaciones;
CREATE POLICY "Restaurar escritura cortejo asignaciones" ON cortejo_asignaciones
    FOR ALL TO authenticated
    USING (is_admin());

-- 2.5 PAPELETAS
DROP POLICY IF EXISTS "Solo admins gestionan papeletas" ON papeletas_cortejo;
CREATE POLICY "Restaurar gestion papeletas" ON papeletas_cortejo
    FOR ALL TO authenticated
    USING (is_admin());

-- 2.6 TEMPORADAS
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temporadas') THEN
        DROP POLICY IF EXISTS "Admins gestionan temporadas" ON temporadas;
        CREATE POLICY "Restaurar gestion temporadas" ON temporadas
            FOR ALL TO authenticated
            USING (is_admin());
    END IF;
END $$;
