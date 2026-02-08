-- 1. MEJORAS DE RENDIMIENTO: ÍNDICES EN FOREIGN KEYS
CREATE INDEX IF NOT EXISTS idx_avisos_internos_autor_id ON public.avisos_internos(autor_id);
CREATE INDEX IF NOT EXISTS idx_configuracion_precios_updated_by ON public.configuracion_precios(updated_by);
CREATE INDEX IF NOT EXISTS idx_gastos_created_by ON public.gastos(created_by);
CREATE INDEX IF NOT EXISTS idx_papeletas_id_ingreso ON public.papeletas_cortejo(id_ingreso);
CREATE INDEX IF NOT EXISTS idx_papeletas_posicion ON public.papeletas_cortejo(id_posicion_asignada);

-- 2. LIMPIEZA DE ÍNDICES NO UTILIZADOS
DROP INDEX IF EXISTS idx_hermanos_numero;
DROP INDEX IF EXISTS idx_papeletas_anio;
DROP INDEX IF EXISTS idx_gastos_categoria;

-- 3. SEGURIDAD: TABLA HERMANOS (Solo lectura para el propio hermano, edición solo admin/junta)
DROP POLICY IF EXISTS "Users can update their own data" ON public.hermanos;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.hermanos;
DROP POLICY IF EXISTS "Enable read access for users to their own profile" ON public.hermanos;
DROP POLICY IF EXISTS "authenticated_read_hermanos" ON public.hermanos;
DROP POLICY IF EXISTS "admin_manage_hermanos" ON public.hermanos;

-- SELECT balanceado: Hermano solo ve su fila, Admin/Junta ven todo
CREATE POLICY "Lectura hermanos" ON public.hermanos
FOR SELECT TO authenticated
USING (id = auth.uid() OR (SELECT public.is_admin()));

-- INSERT/UPDATE/DELETE: Restringido a Admin/Junta
CREATE POLICY "Gestion hermanos admin" ON public.hermanos
FOR ALL TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- 4. SEGURIDAD: AVISOS INTERNOS (Solo admin/junta gestiona)
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.avisos_internos;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.avisos_internos;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.avisos_internos;

CREATE POLICY "Gestion avisos admin" ON public.avisos_internos
FOR ALL TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- 5. SEGURIDAD: PUBLICACIONES REDES (Solo admin/junta gestiona)
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.publicaciones_redes;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.publicaciones_redes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.publicaciones_redes;

CREATE POLICY "Gestion RRSS admin" ON public.publicaciones_redes
FOR ALL TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- 6. LIMPIEZA DE POLÍTICAS REDUNDANTES EN PAGOS Y CORTEJO
DROP POLICY IF EXISTS "Allow all write pagos" ON public.pagos;
DROP POLICY IF EXISTS "Restaurar lectura pagos admins" ON public.pagos;
DROP POLICY IF EXISTS "Restaurar gestion pagos admins" ON public.pagos;
DROP POLICY IF EXISTS "Ver propios pagos" ON public.pagos;

CREATE POLICY "Lectura pagos" ON public.pagos
FOR SELECT TO authenticated
USING (id_hermano = auth.uid() OR (SELECT public.is_admin()));

CREATE POLICY "Gestion pagos admin" ON public.pagos
FOR ALL TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- Limpieza cortejo_asignaciones
DROP POLICY IF EXISTS "Restaurar escritura cortejo asignaciones" ON public.cortejo_asignaciones;
DROP POLICY IF EXISTS "Solo JUNTA y SUPERADMIN pueden asignar posiciones" ON public.cortejo_asignaciones;
DROP POLICY IF EXISTS "Solo JUNTA y SUPERADMIN pueden actualizar asignaciones" ON public.cortejo_asignaciones;
DROP POLICY IF EXISTS "Solo JUNTA y SUPERADMIN pueden eliminar asignaciones" ON public.cortejo_asignaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver asignaciones del cortejo" ON public.cortejo_asignaciones;
DROP POLICY IF EXISTS "Lectura cortejo asignaciones" ON public.cortejo_asignaciones;

CREATE POLICY "Lectura cortejo asignaciones" ON public.cortejo_asignaciones
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestion cortejo asignaciones admin" ON public.cortejo_asignaciones
FOR ALL TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));
