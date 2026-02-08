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
        // Intentar con timeout de 2 segundos
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 2000);
        });

        const supabaseQuery = supabase
            .from('configuracion_precios')
            .select('*')
            .eq('id', 1)
            .single();

        const { data, error } = await Promise.race([supabaseQuery, timeoutPromise]);

        if (error) {
            throw error;
        }

        // Si se obtuvo correctamente, guardar en IndexedDB para uso offline (SOLO CLIENTE)
        if (data && typeof window !== 'undefined') {
            try {
                const { initDB } = await import('./db');
                const db = await initDB();
                await db.put('configuracion', data);
            } catch (dbError) {
                console.warn('Could not cache config to IndexedDB:', dbError);
            }
        }

        return data as PreciosConfig;
    } catch (err) {
        console.warn('Fetching from Supabase failed, trying IndexedDB:', err);

        // Intentar leer de IndexedDB (SOLO CLIENTE)
        if (typeof window === 'undefined') {
            console.log('Using default prices (SSR)');
            return PRECIOS_DEFAULTS;
        }

        try {
            const { initDB } = await import('./db');
            const db = await initDB();
            const cachedConfig = await db.get('configuracion', 1);
            if (cachedConfig) {
                console.log('Using cached configuration from IndexedDB');
                return cachedConfig as PreciosConfig;
            }
        } catch (dbError) {
            console.error('IndexedDB also failed:', dbError);
        }

        console.warn('Falling back to default prices');
        return PRECIOS_DEFAULTS;
    }
}
