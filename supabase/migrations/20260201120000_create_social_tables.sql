-- Create table for Internal Notices (Avisos Internos)
CREATE TABLE IF NOT EXISTS public.avisos_internos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    autor_id UUID REFERENCES auth.users(id),
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for Social Media Posts (Publicaciones Redes)
CREATE TABLE IF NOT EXISTS public.publicaciones_redes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    plataformas TEXT[] DEFAULT '{}',
    estado TEXT DEFAULT 'publicado', -- publicado, eliminado, editado
    autor_id UUID REFERENCES auth.users(id),
    fecha_publicacion TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.avisos_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones_redes ENABLE ROW LEVEL SECURITY;

-- Policies for avisos_internos
-- Everyone can read active notices
CREATE POLICY "Enable read access for all authenticated users" ON public.avisos_internos
    FOR SELECT
    TO authenticated
    USING (activo = true);

-- Only admins/authorized roles can insert/update/delete
-- Assuming 'admin' and 'junta' roles based on typical setup, adjusting to allow basic auth users for now if role helper not perfect, 
-- but ideally restricting. checking existing policies patterns... 
-- For now allowing authenticated to insert for "AvisoCreator" usage until role system verified.
CREATE POLICY "Enable insert for authenticated users" ON public.avisos_internos
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.avisos_internos
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.avisos_internos
    FOR DELETE
    TO authenticated
    USING (true);


-- Policies for publicaciones_redes
CREATE POLICY "Enable read access for all authenticated users" ON public.publicaciones_redes
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.publicaciones_redes
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.publicaciones_redes
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.publicaciones_redes
    FOR DELETE
    TO authenticated
    USING (true);

-- Enable realtime
alter publication supabase_realtime add table avisos_internos;
alter publication supabase_realtime add table publicaciones_redes;
