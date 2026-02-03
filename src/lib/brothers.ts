import { supabase } from './supabase';
import { offlineInsert, offlineUpdate, offlineDelete } from './offline-mutation';

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

export interface BrotherSearchResult {
    id: string;
    nombre: string;
    apellidos: string;
    tiene_papeleta?: boolean;
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
    // 1. Insert the new brother using offline system
    const { success, data, offline, error } = await offlineInsert('hermanos', hermano);

    if (!success) throw new Error(error || 'Error creando hermano');

    // 2. Trigger a recalibration only if online
    if (!offline) {
        await recalibrarNumeros();
    }

    return data;
}

export async function getHermanoById(id: string) {
    try {
        const { data, error } = await supabase
            .from('hermanos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.message?.toLowerCase().includes('fetch') || !error.code) throw new Error('offline');
            throw error;
        }
        return data as Hermano;
    } catch (e) {
        if ((e as Error).message === 'offline' || (e as Error).message?.includes('fetch')) {
            const { initDB } = await import('./db');
            const db = await initDB();
            const data = await db.get('hermanos', id);
            if (data) return data as Hermano;
        }
        throw e;
    }
}

export async function updateHermano(id: string, updates: Partial<Hermano>) {
    const { success, data, offline, error } = await offlineUpdate('hermanos', { ...updates, id });

    if (!success) throw new Error(error || 'Error actualizando hermano');

    // If seniority relevant fields change and online, recalibrate
    if (!offline && updates.fecha_alta) {
        await recalibrarNumeros();
    }

    return data as Hermano;
}

export async function deleteHermano(id: string) {
    const { success, offline, error } = await offlineDelete('hermanos', id);

    if (!success) throw new Error(error || 'Error eliminando hermano');

    // Recalibrate after deletion if online
    if (!offline) {
        await recalibrarNumeros();
    }
}

export async function getPagosByHermano(id_hermano: string, anio?: number) {
    try {
        let query = supabase
            .from('pagos')
            .select('*')
            .eq('id_hermano', id_hermano)
            .order('fecha_pago', { ascending: false });

        if (anio) {
            query = query.eq('anio', anio);
        }

        const { data, error } = await query;
        if (error) {
            if (error.message?.toLowerCase().includes('fetch') || !error.code) throw new Error('offline');
            throw error;
        }
        return data as Pago[];
    } catch (e) {
        if ((e as Error).message === 'offline' || (e as Error).message?.includes('fetch')) {
            const { getPagosLocal } = await import('./db');
            const allPagos = await getPagosLocal();

            let filtered = (allPagos as unknown as Pago[]).filter(p => p.id_hermano === id_hermano);
            if (anio) {
                filtered = filtered.filter(p => p.anio === anio);
            }
            return filtered.sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago));
        }
        throw e;
    }
}

export async function deletePago(id: string) {
    const { success, error } = await offlineDelete('pagos', id);
    if (!success) throw new Error(error || 'Error eliminando pago');
}
export async function searchHermanos(term: string): Promise<BrotherSearchResult[]> {
    // Validación básica
    if (term.length < 2) return [];

    try {
        // Timeout de 2 segundos
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 2000);
        });

        const supabaseQuery = supabase.rpc('search_hermanos', { term });

        const { data, error } = await Promise.race([supabaseQuery, timeoutPromise]);

        if (error) throw error;

        return data as BrotherSearchResult[];
    } catch (e) {
        const error = e as Error;
        console.warn('Online search failed, using local search:', error.message);

        // Búsqueda local mejorada
        const { getHermanosLocal } = await import('./db');
        const allHermanos = await getHermanosLocal();
        const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const results = allHermanos
            .map((h: Record<string, unknown>) => {
                const nombre = (h.nombre as string || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const apellidos = (h.apellidos as string || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const fullName = `${nombre} ${apellidos}`;

                // Calcular relevancia
                let score = 0;

                // Coincidencia exacta al inicio (máxima prioridad)
                if (nombre.startsWith(normalizedTerm) || apellidos.startsWith(normalizedTerm)) {
                    score = 1000;
                }
                // Coincidencia al inicio del nombre completo
                else if (fullName.startsWith(normalizedTerm)) {
                    score = 900;
                }
                // Coincidencia en cualquier palabra del nombre
                else if (nombre.includes(normalizedTerm)) {
                    score = 500;
                }
                // Coincidencia en apellidos
                else if (apellidos.includes(normalizedTerm)) {
                    score = 400;
                }
                // No coincide
                else {
                    score = 0;
                }

                return {
                    id: h.id as string,
                    nombre: h.nombre as string,
                    apellidos: h.apellidos as string,
                    score
                };
            })
            .filter(h => h.score > 0)
            .sort((a, b) => {
                // Ordenar por score descendente, y luego alfabéticamente
                if (b.score !== a.score) return b.score - a.score;
                return `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`);
            })
            .slice(0, 10)
            .map(({ score, ...rest }) => rest); // Eliminar el score del resultado final

        return results;
    }
}
