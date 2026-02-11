import { supabase } from './supabase';
import { mutationsRepo } from './db/tables/mutations.table';

// Tipo de operación de base de datos
interface MutationOptions {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: Record<string, unknown> | Record<string, unknown>[];
}

// Función principal para realizar mutations con soporte offline
export async function offlineMutation(options: MutationOptions): Promise<{ success: boolean; offline: boolean; data?: unknown; error?: string }> {
    // Si sabemos que estamos offline, ni siquiera intentamos
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await mutationsRepo.add({
            type: options.type,
            table: options.table as any,
            data: options.data,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            status: 'pending',
            priority: 1
        });
        return { success: true, offline: true };
    }

    try {
        let result: { data: unknown; error: { code?: string; message: string } | null } = { data: null, error: null };

        // TIMEOUT PROTECTION: No esperar más de 15 segundos por Supabase (aumentado de 8s)
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 15000);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitizeData = (data: any) => {
            if (Array.isArray(data)) {
                return data.map(item => {
                    const { hermano, posicion, ingreso, _offline, _syncStatus, _lastModified, _version, ...rest } = item;
                    return rest;
                });
            }
            const { hermano, posicion, ingreso, _offline, _syncStatus, _lastModified, _version, ...rest } = data;
            return rest;
        };

        const cleanedData = sanitizeData(options.data);

        const supabaseOperation = (async () => {
            switch (options.type) {
                case 'insert':
                    if (Array.isArray(cleanedData)) {
                        return await supabase.from(options.table).insert(cleanedData).select();
                    } else {
                        return await supabase.from(options.table).insert(cleanedData).select().single();
                    }
                case 'update':
                    if (Array.isArray(cleanedData)) throw new Error('Bulk update not supported yet');
                    return await supabase.from(options.table).update(cleanedData).eq('id', cleanedData.id).select().single();
                case 'delete':
                    if (Array.isArray(options.data)) throw new Error('Bulk delete not supported yet');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return await supabase.from(options.table).delete().eq('id', (options.data as any).id);
            }
        })();

        result = await Promise.race([supabaseOperation, timeoutPromise]);

        if (result.error) {
            // Si el error es de conexión (pero navigator.onLine dijo que sí), guardamos en cola
            // Supabase suele devolver un error con code vacío o mensajes de fetch para red
            const isNetworkError = !result.error.code ||
                result.error.message?.toLowerCase().includes('fetch') ||
                result.error.message?.toLowerCase().includes('network');

            if (isNetworkError) {
                await mutationsRepo.add({
                    type: options.type,
                    table: options.table as any,
                    data: options.data,
                    timestamp: Date.now(),
                    retryCount: 0,
                    maxRetries: 3,
                    status: 'pending',
                    priority: 1
                });
                return { success: true, offline: true };
            }

            return { success: false, offline: false, error: result.error.message };
        }

        return { success: true, offline: false, data: result.data };

    } catch (error) {
        // Error inesperado o de red no capturado por Supabase
        const errorMessage = String(error).toLowerCase();
        const isNetworkError = errorMessage.includes('fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection');

        if (isNetworkError) {
            await mutationsRepo.add({
                type: options.type,
                table: options.table as any,
                data: options.data,
                timestamp: Date.now(),
                retryCount: 0,
                maxRetries: 3,
                status: 'pending',
                priority: 1
            });
            return { success: true, offline: true };
        }

        return { success: false, offline: false, error: String(error) };
    }
}

// Helper para inserts
export async function offlineInsert(table: string, data: Record<string, unknown> | Record<string, unknown>[]) {
    return offlineMutation({ type: 'insert', table, data });
}

// Helper para updates
export async function offlineUpdate(table: string, data: Record<string, unknown> | Record<string, unknown>[]) {
    return offlineMutation({ type: 'update', table, data });
}

// Helper para deletes
export async function offlineDelete(table: string, id: string | number) {
    return offlineMutation({ type: 'delete', table, data: { id } });
}