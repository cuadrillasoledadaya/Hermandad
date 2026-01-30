
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllPagos() {
    const { data: pagos, error } = await supabase
        .from('pagos')
        .select(`
            id,
            concepto,
            tipo_pago,
            anio,
            hermano:hermanos(nombre, apellidos)
        `)
        .eq('anio', 2026);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Todos los Pagos 2026:');
    if (!pagos || pagos.length === 0) {
        console.log('No hay pagos.');
    } else {
        pagos.forEach(p => {
            console.log(`- [${p.tipo_pago}] ${p.concepto} | Hermano: ${p.hermano?.nombre} ${p.hermano?.apellidos}`);
        });
    }
}

checkAllPagos();
