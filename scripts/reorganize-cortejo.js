
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function reorganizeCortejo() {
    console.log('--- Iniciando Reorganización del Cortejo (v1.0.98) ---');

    // 1. Renombrar todas las 'insignia' actuales a 'vara'
    console.log('Cambiando insignias actuales a varas...');
    const { error: errorVaras } = await supabase
        .from('cortejo_estructura')
        .update({ tipo: 'vara' })
        .eq('tipo', 'insignia');

    if (errorVaras) console.error('Error al renombrar a varas:', errorVaras);

    // 2. Insertar Bocinas delante de los pasos
    // Los pasos son tramos 1 (Vera Cruz), 2 (Santo Entierro), 3 (Soledad) con pos 100
    console.log('Insertando Bocinas...');
    const bocinas = [
        { nombre: 'Bocina 1 Vera Cruz', tipo: 'bocina', tramo: 1, posicion: 90, lado: 'izquierda', paso_asociado: 'vera_cruz' },
        { nombre: 'Bocina 2 Vera Cruz', tipo: 'bocina', tramo: 1, posicion: 90, lado: 'derecha', paso_asociado: 'vera_cruz' },
        { nombre: 'Bocina 1 Santo Entierro', tipo: 'bocina', tramo: 2, posicion: 90, lado: 'izquierda', paso_asociado: 'santo_entierro' },
        { nombre: 'Bocina 2 Santo Entierro', tipo: 'bocina', tramo: 2, posicion: 90, lado: 'derecha', paso_asociado: 'santo_entierro' },
        { nombre: 'Bocina 1 Soledad', tipo: 'bocina', tramo: 3, posicion: 90, lado: 'izquierda', paso_asociado: 'soledad' },
        { nombre: 'Bocina 2 Soledad', tipo: 'bocina', tramo: 3, posicion: 90, lado: 'derecha', paso_asociado: 'soledad' }
    ];

    const { error: errorBocinas } = await supabase
        .from('cortejo_estructura')
        .upsert(bocinas);
    if (errorBocinas) console.error('Error al insertar bocinas:', errorBocinas);

    // 3. Insertar Insignias en medio de las varas de cada tramo
    // Tramo 1: actuales varas en pos 1 y 2. Añadimos insignia en pos 1.5 -> pos 5
    // Vamos a insertar insignias centrales para cada tramo
    console.log('Insertando Insignias centrales...');
    const insignias = [
        { nombre: 'Insignia Tramo 1', tipo: 'insignia', tramo: 1, posicion: 5, lado: 'centro' },
        { nombre: 'Insignia Tramo 2', tipo: 'insignia', tramo: 2, posicion: 5, lado: 'centro' },
        { nombre: 'Insignia Tramo 3', tipo: 'insignia', tramo: 3, posicion: 5, lado: 'centro' }
    ];

    const { error: errorInsignias } = await supabase
        .from('cortejo_estructura')
        .upsert(insignias);
    if (errorInsignias) console.error('Error al insertar insignias:', errorInsignias);

    console.log('--- Reorganización Completada ---');
}

reorganizeCortejo();
