-- =====================================================
-- FIX DE SEGURIDAD: HABILITAR RLS Y POLÍTICAS
-- Fecha: 2026-01-31
-- =====================================================

-- 1. Habilitar RLS en todas las tablas críticas
ALTER TABLE IF EXISTS hermanos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cortejo_estructura ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cortejo_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS papeletas_cortejo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ingresos ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para HERMANOS
-- Permitir que cada usuario lea su propio perfil (para verificar login/rol)
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON hermanos;
CREATE POLICY "Usuarios ven su propio perfil" ON hermanos
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Permitir que ADMIN y JUNTA vean todos los hermanos (gestión)
DROP POLICY IF EXISTS "Admins ven todos los hermanos" ON hermanos;
CREATE POLICY "Admins ven todos los hermanos" ON hermanos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hermanos h
            WHERE h.id = auth.uid() 
            AND h.rol IN ('SUPERADMIN', 'JUNTA')
        )
    );

-- Permitir que ADMIN y JUNTA editen hermanos
DROP POLICY IF EXISTS "Admins gestionan hermanos" ON hermanos;
CREATE POLICY "Admins gestionan hermanos" ON hermanos
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hermanos h
            WHERE h.id = auth.uid() 
            AND h.rol IN ('SUPERADMIN', 'JUNTA')
        )
    );

-- 3. Políticas para PAGOS (Tabla 'pagos', no 'gastos')
-- Si la tabla existe, aplicar políticas
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos') THEN
        
        -- Ver sus propios pagos
        DROP POLICY IF EXISTS "Ver propios pagos" ON pagos;
        CREATE POLICY "Ver propios pagos" ON pagos
            FOR SELECT TO authenticated
            USING (id_hermano = auth.uid());

        -- Admins ven todo
        DROP POLICY IF EXISTS "Admins ven todos los pagos" ON pagos;
        CREATE POLICY "Admins ven todos los pagos" ON pagos
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM hermanos h
                    WHERE h.id = auth.uid() 
                    AND h.rol IN ('SUPERADMIN', 'JUNTA')
                )
            );

        -- Admins gestionan pagos
        DROP POLICY IF EXISTS "Admins gestionan pagos" ON pagos;
        CREATE POLICY "Admins gestionan pagos" ON pagos
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM hermanos h
                    WHERE h.id = auth.uid() 
                    AND h.rol IN ('SUPERADMIN', 'JUNTA')
                )
            );
    END IF;
END $$;

-- 4. Políticas para TEMPORADAS
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temporadas') THEN
        
        -- Todos ven las temporadas (para selects, etc)
        DROP POLICY IF EXISTS "Temporadas visibles para todos" ON temporadas;
        CREATE POLICY "Temporadas visibles para todos" ON temporadas
            FOR SELECT TO authenticated
            USING (true);

        -- Solo admins gestionan
        DROP POLICY IF EXISTS "Admins gestionan temporadas" ON temporadas;
        CREATE POLICY "Admins gestionan temporadas" ON temporadas
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM hermanos h
                    WHERE h.id = auth.uid() 
                    AND h.rol IN ('SUPERADMIN', 'JUNTA')
                )
            );
    END IF;
END $$;

-- 5. Asegurar políticas de CORTEJO (si faltan)
-- Lectura pública para autenticados
DROP POLICY IF EXISTS "Lectura cortejo estructura" ON cortejo_estructura;
CREATE POLICY "Lectura cortejo estructura" ON cortejo_estructura
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Lectura cortejo asignaciones" ON cortejo_asignaciones;
CREATE POLICY "Lectura cortejo asignaciones" ON cortejo_asignaciones
    FOR SELECT TO authenticated USING (true);

-- Escritura solo Admins
DROP POLICY IF EXISTS "Escritura cortejo estructura" ON cortejo_estructura;
CREATE POLICY "Escritura cortejo estructura" ON cortejo_estructura
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hermanos h WHERE h.id = auth.uid() AND h.rol IN ('SUPERADMIN', 'JUNTA')
        )
    );

DROP POLICY IF EXISTS "Escritura cortejo asignaciones" ON cortejo_asignaciones;
CREATE POLICY "Escritura cortejo asignaciones" ON cortejo_asignaciones
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hermanos h WHERE h.id = auth.uid() AND h.rol IN ('SUPERADMIN', 'JUNTA')
        )
    );

