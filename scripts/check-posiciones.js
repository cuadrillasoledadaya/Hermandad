
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPosiciones() {
    const { data: posiciones, error } = await supabase
        .from('cortejo_estructura')
        .select('id, nombre, tipo')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Primeras 10 Posiciones:');
    posiciones.forEach(p => {
        console.log(`- ${p.nombre} [${p.tipo}]`);
    });
}

checkPosiciones();
