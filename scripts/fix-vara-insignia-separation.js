
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixVaraInsigniaNames() {
    console.log('--- Separando Varas e Insignias (v1.1.00) ---\n');

    const { data: posiciones, error } = await supabase
        .from('cortejo_estructura')
        .select('*')
        .order('tramo')
        .order('posicion');

    if (error) {
        console.error('Error:', error);
        return;
    }

    for (const pos of posiciones) {
        let updates = null;

        // Identificar posiciones que deben ser VARAS (pos 1 y 2, a los lados)
        if ((pos.posicion === 1 || pos.posicion === 2) && pos.tramo >= 1 && pos.tramo <= 3) {
            const letra = pos.posicion === 1 ? 'A' : 'B';
            const nuevoNombre = `Vara ${pos.tramo}${letra}`;

            if (pos.nombre !== nuevoNombre || pos.tipo !== 'vara') {
                updates = {
                    nombre: nuevoNombre,
                    tipo: 'vara'
                };
                console.log(`✅ ${pos.nombre} → ${nuevoNombre} (tipo: vara)`);
            }
        }

        // Identificar posiciones que deben ser INSIGNIAS (pos 5, centro)
        if (pos.posicion === 5 && pos.tramo >= 1 && pos.tramo <= 3) {
            const nuevoNombre = `Insignia Tramo ${pos.tramo}`;

            if (pos.nombre !== nuevoNombre || pos.tipo !== 'insignia') {
                updates = {
                    nombre: nuevoNombre,
                    tipo: 'insignia'
                };
                console.log(`🚩 ${pos.nombre} → ${nuevoNombre} (tipo: insignia)`);
            }
        }

        if (updates) {
            await supabase
                .from('cortejo_estructura')
                .update(updates)
                .eq('id', pos.id);
        }
    }

    console.log('\n--- Separación completada ---');
}

fixVaraInsigniaNames();
