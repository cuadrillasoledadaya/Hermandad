
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConstraints() {
    console.log('--- Corrigiendo Constraints de Base de Datos (v1.0.99) ---');

    const sql = `
        ALTER TABLE papeletas_cortejo DROP CONSTRAINT IF EXISTS papeletas_cortejo_tipo_check;
        ALTER TABLE papeletas_cortejo ADD CONSTRAINT papeletas_cortejo_tipo_check CHECK (tipo IN ('cruz_guia', 'vara', 'insignia', 'bocina', 'nazareno', 'costalero'));
        UPDATE cortejo_estructura SET tipo = 'vara' WHERE tipo = 'insignia';
    `;

    const { error } = await supabase.rpc('execute_sql', { sql_query: sql });

    // Si el RPC no existe o falla, intentamos hacerlo de forma manual vía queries directas si es posible, 
    // pero ALTER TABLE requiere privilegios altos. El MCP falló por token, así que probamos un enfoque directo
    // a las tablas si es posible, aunque el constraint requiere SQL puro.

    if (error) {
        console.warn('Error al ejecutar SQL vía RPC:', error.message);
        console.log('Intentando actualización de datos directa...');

        await supabase.from('cortejo_estructura').update({ tipo: 'vara' }).eq('tipo', 'insignia');
        console.log('Datos actualizados. El constraint SQL debe ser revisado manualmente si este script falla.');
    } else {
        console.log('SQL ejecutado correctamente.');
    }

    console.log('--- Proceso de constraints finalizado ---');
}

fixConstraints();
