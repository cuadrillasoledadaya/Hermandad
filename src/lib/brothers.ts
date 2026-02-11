import { supabase } from './supabase';
import { offlineInsert, offlineUpdate, offlineDelete } from './offline-mutation';
import { hermanosRepo } from './db/tables/hermanos.table';
import { pagosRepo } from './db/tables/pagos.table';

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
    try {
        // Timeout de 1 segundo para caer rápido a offline
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        const supabasePromise = supabase
            .from('hermanos')
            .select('*')
            .order('numero_hermano', { ascending: true });

        const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

        if (error) {
            if (error.message?.toLowerCase().includes('fetch') || !error.code) throw new Error('offline');
            throw error;
        }

        // Cachear en IndexedDB para offline
        if (data && typeof window !== 'undefined') {
            try {
                await hermanosRepo.bulkSync(data);
                console.log('💾 [CENSO] Datos cacheados en IndexedDB:', data.length, 'hermanos');
            } catch (cacheError) {
                console.warn('⚠️ Error cacheando hermanos:', cacheError);
            }
        }

        return data as Hermano[];
    } catch (e) {
        const errorMsg = (e as Error).message;
        if (errorMsg === 'offline' || errorMsg?.includes('fetch') || errorMsg === 'timeout') {
            console.log('📦 [CENSO] Offline/timeout - Leyendo desde IndexedDB');

            // Intentar con nueva base de datos primero
            try {
                const localData = await hermanosRepo.getAll({ activo: true });
                if (localData.length > 0) {
                    console.log('📦 [CENSO] Usando', localData.length, 'hermanos de IndexedDB');
                    return localData.map(h => {
                        const { _syncStatus, _lastModified, _version, ...clean } = h as any;
                        return clean as Hermano;
                    });
                }
            } catch (dexieError) {
                console.warn('⚠️ Error leyendo de Dexie:', dexieError);
            }

            // Si no hay datos locales, retornar array vacío
            console.warn('⚠️ [CENSO] No hay datos locales disponibles');
            return [];
        }
        throw e;
    }
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

    // 2. Trigger a recalibration only if online, with race condition protection
    if (!offline) {
        await recalibrarNumerosWithLock();
    }

    return data;
}

/**
 * Recalibra números con protección contra race conditions
 */
async function recalibrarNumerosWithLock() {
    const { db } = await import('./db/database');
    const lockKey = 'recalibracion_lock';

    // Verificar si hay una recalibración en proceso
    const lock = await db.getSyncMetadata(lockKey);
    const now = Date.now();

    // Si el lock tiene menos de 10 segundos, hay una recalibración en proceso
    if (lock && (now - lock) < 10000) {
        console.log('⏳ Recalibración ya en proceso, omitiendo...');
        return;
    }

    // Establecer lock
    await db.setSyncMetadata(lockKey, now);

    try {
        await recalibrarNumeros();
    } finally {
        // Liberar lock
        await db.setSyncMetadata(lockKey, null);
    }
}

export async function getHermanoById(id: string): Promise<Hermano | null> {
    try {
        // Timeout de 1 segundo para caer rápido a offline
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        const supabasePromise = supabase
            .from('hermanos')
            .select('*')
            .eq('id', id)
            .single();

        const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

        if (error) {
            if (error.message?.toLowerCase().includes('fetch') || !error.code) throw new Error('offline');
            throw error;
        }

        // Cachear en IndexedDB
        if (data && typeof window !== 'undefined') {
            await hermanosRepo.bulkSync([data]);
        }

        return data as Hermano;
    } catch (e) {
        const errorMsg = (e as Error).message;
        if (errorMsg === 'offline' || errorMsg?.includes('fetch') || errorMsg === 'timeout') {
            console.log('📦 [HERMANO] Usando datos locales para ID:', id);
            // Intentar con nueva base de datos Dexie
            try {
                const localData = await hermanosRepo.getById(id);
                if (localData) {
                    const { _syncStatus, _lastModified, _version, ...clean } = localData as any;
                    return clean as Hermano;
                }
            } catch (dbError) {
                console.error('Error leyendo de IndexedDB:', dbError);
            }

            // Si no está en caché, retornar null en lugar de lanzar error
            console.warn('⚠️ [HERMANO] No encontrado en caché:', id);
            return null;
        }
        throw e;
    }
}

export async function updateHermano(id: string, updates: Partial<Hermano>) {
    const { success, data, offline, error } = await offlineUpdate('hermanos', { ...updates, id });

    if (!success) throw new Error(error || 'Error actualizando hermano');

    // If seniority relevant fields change and online, recalibrate with lock
    if (!offline && updates.fecha_alta) {
        await recalibrarNumerosWithLock();
    }

    return data as Hermano;
}

export async function deleteHermano(id: string) {
    const { success, offline, error } = await offlineDelete('hermanos', id);

    if (!success) throw new Error(error || 'Error eliminando hermano');

    // Recalibrate after deletion if online, with lock protection
    if (!offline) {
        await recalibrarNumerosWithLock();
    }
}

export async function getPagosByHermano(id_hermano: string, anio?: number): Promise<Pago[]> {
    try {
        console.log(`🔍 [PAGOS] Solicitando pagos del hermano ${id_hermano} (Online)...`);

        // 1. Intentar obtener de Supabase con timeout de 1 segundo
        let query = supabase
            .from('pagos')
            .select('*')
            .eq('id_hermano', id_hermano)
            .order('fecha_pago', { ascending: false });

        if (anio) {
            query = query.eq('anio', anio);
        }

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        const { data, error } = await Promise.race([query, timeoutPromise]);

        if (error) {
            console.error('❌ [PAGOS] Error en query Supabase:', error);
            throw error;
        }

        if (typeof window === 'undefined') return (data || []) as Pago[];

        // Cachear en IndexedDB nueva
        if (data && data.length > 0) {
            try {
                await pagosRepo.bulkSync(data);
            } catch (cacheError) {
                console.warn('⚠️ Error cacheando pagos:', cacheError);
            }
        }

        // 2. Combinar con datos locales (System A)
        // Buscamos pagos en Dexie que están pendientes
        const localPagos = await pagosRepo.getByHermano(id_hermano);
        const offlineOnly = localPagos.filter(p => p._syncStatus === 'pending');

        if (offlineOnly.length > 0) {
            console.log(`📦 [PAGOS] Combinando con ${offlineOnly.length} pagos locales no sincronizados`);
            const serverIds = new Set(data?.map(p => p.id) || []);
            const merged = [...(data || [])];

            for (const offline of offlineOnly) {
                if (!serverIds.has(offline.id)) {
                    // Si el año coincide (si se especificó año)
                    if (!anio || offline.anio === anio) {
                        merged.push(offline);
                    }
                }
            }
            return merged.sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago));
        }

        return (data || []) as Pago[];
    } catch (e) {
        console.warn('⚠️ [PAGOS] Fallo fetch online or timeout, intentando local:', e);
        if (typeof window === 'undefined') return [];

        // Intentar con nueva base de datos primero
        try {
            const localData = await pagosRepo.getByHermano(id_hermano, { anio });
            if (localData.length > 0) {
                console.log(`📦 [PAGOS] Usando ${localData.length} pagos de IndexedDB nueva`);
                return localData.map(p => {
                    const { _syncStatus, _lastModified, ...clean } = p as any;
                    return clean;
                });
            }
        } catch (dexieError) {
            console.warn('⚠️ Error con IndexedDB nueva:', dexieError);
        }

        return [];
    }
}

/**
 * Obtiene todos los pagos de un año específico, mezclando servidor y local
 */
export async function getPagosDelAnio(anio: number): Promise<Pago[]> {
    try {
        console.log(`🔍 [PAGOS] Solicitando pagos del año ${anio} (Online)...`);

        // Timeout de 1 segundo para caer rápido a offline
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        const supabasePromise = supabase
            .from('pagos')
            .select('*')
            .eq('anio', anio);

        const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

        if (error) {
            console.error('❌ [PAGOS] Error en query Supabase:', error);
            throw error;
        }

        // Cachear en IndexedDB
        if (data && typeof window !== 'undefined') {
            try {
                const { db } = await import('./db/database');
                await db.transaction('rw', db.pagos, async () => {
                    for (const p of data) {
                        await db.pagos.put({
                            ...p,
                            _syncStatus: 'synced',
                            _lastModified: Date.now()
                        } as any);
                    }
                });
                console.log('💾 [PAGOS] Datos cacheados en IndexedDB:', data.length, 'pagos');
            } catch (cacheError) {
                console.warn('⚠️ Error cacheando pagos:', cacheError);
            }
        }

        if (typeof window === 'undefined') return (data || []) as Pago[];

        // Combinar con locales
        try {
            const localPagos = await pagosRepo.getAll();
            const offlineOnly = localPagos.filter(p => p.anio === anio && p._syncStatus === 'pending');

            if (offlineOnly.length > 0) {
                console.log(`📦 [PAGOS] Combinando con ${offlineOnly.length} pagos locales no sincronizados`);
                const serverIds = new Set(data?.map(p => p.id) || []);
                const merged = [...(data || [])];
                for (const offline of offlineOnly) {
                    if (!serverIds.has(offline.id)) {
                        merged.push(offline);
                    }
                }
                return merged as Pago[];
            }
        } catch (localError) {
            console.warn('⚠️ Error leyendo pagos locales:', localError);
        }

        return (data || []) as Pago[];
    } catch (e) {
        console.warn('⚠️ [PAGOS] Fallo fetch online/timeout, intentando local:', e);
        if (typeof window === 'undefined') return [];

        // Intentar con nueva base de datos primero
        try {
            const { db } = await import('./db/database');
            const localData = await db.pagos.filter(p => p.anio === anio).toArray();
            if (localData.length > 0) {
                console.log(`📦 [PAGOS] Usando ${localData.length} pagos de IndexedDB nueva`);
                return localData.map(p => {
                    const { _syncStatus, _lastModified, ...clean } = p as any;
                    return clean;
                });
            }
        } catch (dexieError) {
            console.warn('⚠️ Error con IndexedDB nueva:', dexieError);
        }

        return [];
    }
}

export async function deletePago(id: string) {
    const { success, error } = await offlineDelete('pagos', id);
    if (!success) throw new Error(error || 'Error eliminando pago');
}
export async function searchHermanos(term: string): Promise<BrotherSearchResult[]> {
    // Validación básica
    if (term.length < 2) return [];

    // SIEMPRE usar búsqueda local para resultados consistentes y relevantes
    const allHermanos = await hermanosRepo.getAll();
    const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const results = allHermanos
        .map((h: Hermano) => {
            const nombre = (h.nombre as string || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const apellidos = (h.apellidos as string || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const fullName = `${nombre} ${apellidos}`;

            // Calcular relevancia
            let score = 0;

            // Coincidencia exacta al inicio del nombre (máxima prioridad)
            if (nombre.startsWith(normalizedTerm)) {
                score = 1000;
            }
            // Coincidencia exacta al inicio de apellidos
            else if (apellidos.startsWith(normalizedTerm)) {
                score = 900;
            }
            // Coincidencia al inicio del nombre completo
            else if (fullName.startsWith(normalizedTerm)) {
                score = 800;
            }
            // Coincidencia en cualquier parte del nombre
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
