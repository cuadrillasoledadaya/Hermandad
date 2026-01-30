
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPapeletas() {
    const { data: papeletas, error } = await supabase
        .from('papeletas_cortejo')
        .select(`
            id,
            numero,
            anio,
            tipo,
            estado,
            hermano:hermanos(nombre, apellidos)
        `)
        .eq('anio', 2026);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Papeletas 2026:');
    if (!papeletas || papeletas.length === 0) {
        console.log('No se encontraron papeletas.');
    } else {
        papeletas.forEach(p => {
            console.log(`- #${p.numero} [${p.tipo}] (${p.estado}): ${p.hermano?.nombre} ${p.hermano?.apellidos}`);
        });
    }
}

checkPapeletas();
