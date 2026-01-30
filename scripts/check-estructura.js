
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEstructura() {
    const { data: posiciones, error } = await supabase
        .from('cortejo_estructura')
        .select('*')
        .order('tramo', { ascending: true })
        .order('posicion', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Posiciones del Cortejo:');
    posiciones.forEach(p => {
        console.log(`- Tramo ${p.tramo} | Pos ${p.posicion} | ${p.nombre} [${p.tipo}] (${p.lado || 'centro'})`);
    });
}

checkEstructura();
