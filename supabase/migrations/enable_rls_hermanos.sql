-- Enable RLS on hermanos table
ALTER TABLE hermanos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own data
CREATE POLICY "Enable read access for users to their own profile" ON "public"."hermanos"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create policy to allow admins and junta to read all brothers
CREATE POLICY "Enable read access for admins and junta" ON "public"."hermanos"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM hermanos WHERE rol IN ('SUPERADMIN', 'JUNTA')
  )
);
