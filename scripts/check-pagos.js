
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oujxepmqqocznwoebhno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anhlcG1xcW9jem53b2ViaG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDYwNDMsImV4cCI6MjA4NTAyMjA0M30.j5b7-oKu5w-T07iOVIB8dLVykSZPgzRCM7b6j3iB_z8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPagos() {
    const { data: pagos, error } = await supabase
        .from('pagos')
        .select('*')
        .eq('tipo_pago', 'papeleta_cortejo')
        .eq('anio', 2026);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Pagos Papeletas 2026:');
    pagos.forEach(p => {
        console.log(`- Pago ID: ${p.id}, Papeleta Ref: ${p.id_papeleta}, Concepto: ${p.concepto}`);
    });
}

checkPagos();
