
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeCortejo() {
    console.log('--- Analizando estructura actual del cortejo ---\n');

    const { data: posiciones, error } = await supabase
        .from('cortejo_estructura')
        .select('id, nombre, tipo, tramo, posicion, lado')
        .order('tramo', { ascending: true })
        .order('posicion', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('POSICIONES ACTUALES:\n');

    const byTramo = {};
    posiciones.forEach(p => {
        if (!byTramo[p.tramo]) byTramo[p.tramo] = [];
        byTramo[p.tramo].push(p);
    });

    for (const [tramo, poss] of Object.entries(byTramo)) {
        console.log(`\n📍 TRAMO ${tramo}:`);
        poss.forEach(p => {
            const tipoIcon = p.tipo === 'vara' ? '🎋' : p.tipo === 'insignia' ? '🚩' : p.tipo === 'bocina' ? '📯' : p.tipo === 'cruz_guia' ? '✝️' : '👤';
            console.log(`  ${tipoIcon} [${p.tipo.toUpperCase().padEnd(10)}] ${p.nombre} (pos: ${p.posicion}, lado: ${p.lado || 'centro'})`);
        });
    }
}

analyzeCortejo();
