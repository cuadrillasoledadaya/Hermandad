import { supabase } from './supabase';
import { db } from './db';

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

        // Supabase query
        const supabaseQuery = supabase
            .from('configuracion_precios')
            .select('*')
            .eq('id', 1)
            .single();

        const { data, error } = await Promise.race([supabaseQuery, timeoutPromise]) as any;

        if (error) {
            throw error;
        }

        // Si se obtuvo correctamente, guardar en IndexedDB para uso offline (SOLO CLIENTE)
        if (data && typeof window !== 'undefined') {
            try {
                // Asegurar que db y db.configuracion existen (Dexie singleton)
                if (db && db.configuracion) {
                    await db.configuracion.put({
                        ...data,
                        id: 1,
                        _syncStatus: 'synced',
                        _lastModified: Date.now()
                    });
                }
            } catch (dbError) {
                console.warn('Could not cache config to IndexedDB:', dbError);
            }
        }

        return data as PreciosConfig;
    } catch (err) {
        console.warn('Fetching from Supabase failed, trying IndexedDB:', err);

        // Intentar leer de IndexedDB (SOLO CLIENTE)
        if (typeof window === 'undefined') {
            return PRECIOS_DEFAULTS;
        }

        try {
            if (db && db.configuracion) {
                const cachedConfig = await db.configuracion.get(1);
                if (cachedConfig) {
                    return cachedConfig as unknown as PreciosConfig;
                }
            }
        } catch (dbError) {
            console.error('IndexedDB also failed:', dbError);
        }

        return PRECIOS_DEFAULTS;
    }
}
