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
