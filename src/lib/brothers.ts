import { supabase } from './supabase';

export interface Hermano {
    id: string;
    numero_hermano: number;
    nombre: string;
    apellidos: string;
    email: string | null;
    direccion: string | null;
    fecha_alta: string;
    activo: boolean;
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
    const { data, error } = await supabase
        .from('hermanos')
        .insert([hermano])
        .select()
        .single();

    if (error) throw error;

    // After adding a new brother, we should probably recalibrate or just assign the next number.
    // The requirement says "recalibración anual", so maybe just assigning the next number for now.
    const { count } = await supabase.from('hermanos').select('*', { count: 'exact', head: true });
    await supabase.from('hermanos').update({ numero_hermano: (count || 0) + 1 }).eq('id', data.id);

    return data;
}
