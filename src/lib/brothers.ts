import { supabase } from './supabase';

export interface Hermano {
    id: string;
    numero_hermano: number | null;
    nombre: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    fecha_alta: string;
    activo: boolean;
}

export interface Pago {
    id: string;
    id_hermano: string;
    fecha_pago: string;
    cantidad: number;
    concepto: string;
    anio: number;
}

export async function getHermanos() {
    const { data, error } = await supabase
        .from('hermanos')
        .select('*')
        .order('numero_hermano', { ascending: true });

    if (error) throw error;
    return data as Hermano[];
}

export async function recalibrarNumeros() {
    const { error } = await supabase.rpc('recalibrar_numeros_hermano');
    if (error) throw error;
    return true;
}

export async function createHermano(hermano: Omit<Hermano, 'id' | 'numero_hermano' | 'activo'>) {
    // 1. Insert the new brother
    const { data, error } = await supabase
        .from('hermanos')
        .insert([hermano])
        .select()
        .single();

    if (error) throw error;

    // 2. Trigger a recalibration to ensure the number is correct by seniority
    await recalibrarNumeros();

    return data;
}

export async function getHermanoById(id: string) {
    const { data, error } = await supabase
        .from('hermanos')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as Hermano;
}

export async function updateHermano(id: string, updates: Partial<Hermano>) {
    const { data, error } = await supabase
        .from('hermanos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // If seniority relevant fields change, recalibrate
    if (updates.fecha_alta) {
        await recalibrarNumeros();
    }

    return data;
}

export async function deleteHermano(id: string) {
    const { error } = await supabase
        .from('hermanos')
        .delete()
        .eq('id', id);

    if (error) throw error;

    // Recalibrate after deletion
    await recalibrarNumeros();
}

export async function getPagosByHermano(id_hermano: string, anio?: number) {
    let query = supabase
        .from('pagos')
        .select('*')
        .eq('id_hermano', id_hermano)
        .order('fecha_pago', { ascending: false });

    if (anio) {
        query = query.eq('anio', anio);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Pago[];
}

export async function deletePago(id: string) {
    const { error } = await supabase
        .from('pagos')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
