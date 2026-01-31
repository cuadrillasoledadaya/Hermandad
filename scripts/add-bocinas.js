
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addBocinas() {
    console.log('--- Agregando Bocinas delante de los pasos (v1.1.01) ---\n');

    // Primero verificar si ya existen bocinas
    const { data: existing, error: checkError } = await supabase
        .from('cortejo_estructura')
        .select('*')
        .eq('tipo', 'bocina');

    if (checkError) {
        console.error('Error al verificar bocinas:', checkError);
        return;
    }

    console.log(`Bocinas existentes: ${existing.length}`);

    if (existing.length >= 6) {
        console.log('✅ Las bocinas ya están insertadas.');
        existing.forEach(b => console.log(`  📯 ${b.nombre}`));
        return;
    }

    // Insertar las 6 bocinas (2 por paso)
    const bocinas = [
        { nombre: 'Bocina 1 Vera Cruz', tipo: 'bocina', tramo: 1, posicion: 90, lado: 'izquierda' },
        { nombre: 'Bocina 2 Vera Cruz', tipo: 'bocina', tramo: 1, posicion: 90, lado: 'derecha' },
        { nombre: 'Bocina 1 Santo Entierro', tipo: 'bocina', tramo: 2, posicion: 90, lado: 'izquierda' },
        { nombre: 'Bocina 2 Santo Entierro', tipo: 'bocina', tramo: 2, posicion: 90, lado: 'derecha' },
        { nombre: 'Bocina 1 Soledad', tipo: 'bocina', tramo: 3, posicion: 90, lado: 'izquierda' },
        { nombre: 'Bocina 2 Soledad', tipo: 'bocina', tramo: 3, posicion: 90, lado: 'derecha' }
    ];

    console.log('\n📯 Insertando bocinas:');

    for (const bocina of bocinas) {
        const { error } = await supabase
            .from('cortejo_estructura')
            .insert(bocina);

        if (error) {
            console.error(`  ❌ Error al insertar ${bocina.nombre}:`, error.message);
        } else {
            console.log(`  ✅ ${bocina.nombre}`);
        }
    }

    console.log('\n--- Bocinas agregadas ---');
}

addBocinas();
