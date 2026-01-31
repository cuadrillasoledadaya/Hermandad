
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPositionNames() {
    console.log('--- Corrigiendo nombres de posiciones (v1.0.99) ---');

    const { data: posiciones, error } = await supabase
        .from('cortejo_estructura')
        .select('id, nombre, tipo');

    if (error) {
        console.error('Error:', error);
        return;
    }

    for (const pos of posiciones) {
        if (pos.nombre.toLowerCase().includes('insignia') && pos.tipo === 'vara') {
            const nuevoNombre = pos.nombre.replace(/Insignia/g, 'Vara').replace(/insignia/g, 'vara');
            console.log(`Renombrando: "${pos.nombre}" -> "${nuevoNombre}"`);

            await supabase
                .from('cortejo_estructura')
                .update({ nombre: nuevoNombre })
                .eq('id', pos.id);
        }
    }

    console.log('--- Nombres corregidos ---');
}

fixPositionNames();
