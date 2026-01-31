import { supabase } from './supabase';

export interface PreciosConfig {
    id: number;
    cuota_mensual_hermano: number;
    papeleta_nazareno: number;
    papeleta_costalero: number;
    papeleta_insignia: number;
    papeleta_vara: number;
    papeleta_bocina: number;
    papeleta_cruz_guia: number;
}

export const PRECIOS_DEFAULTS: PreciosConfig = {
    id: 1,
    cuota_mensual_hermano: 10,
    papeleta_nazareno: 15,
    papeleta_costalero: 15,
    papeleta_insignia: 15,
    papeleta_vara: 15,
    papeleta_bocina: 15,
    papeleta_cruz_guia: 15,
};

export async function getPreciosConfig(): Promise<PreciosConfig> {
    try {
        const { data, error } = await supabase
            .from('configuracion_precios')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('Error fetching precios config:', error);
            return PRECIOS_DEFAULTS;
        }

        return data as PreciosConfig;
    } catch (err) {
        console.error('Exception fetching precios config:', err);
        return PRECIOS_DEFAULTS;
    }
}
