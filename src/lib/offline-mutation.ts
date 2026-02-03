import { supabase } from './supabase';
import { queueMutation } from './db';

// Tipo de operación de base de datos
interface MutationOptions {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: Record<string, unknown>;
}

// Función principal para realizar mutations con soporte offline
export async function offlineMutation(options: MutationOptions): Promise<{ success: boolean; offline: boolean; data?: unknown; error?: string }> {
    // Si sabemos que estamos offline, ni siquiera intentamos
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueMutation(options);
        return { success: true, offline: true };
    }

    try {
        let result: { data: unknown; error: { code?: string; message: string } | null } = { data: null, error: null };

        // Intentar la operación con el cliente de Supabase (gestiona Auth automáticamente)
        switch (options.type) {
            case 'insert':
                result = await supabase.from(options.table).insert(options.data).select().single();
                break;
            case 'update':
                result = await supabase.from(options.table).update(options.data).eq('id', options.data.id).select().single();
                break;
            case 'delete':
                result = await supabase.from(options.table).delete().eq('id', options.data.id);
                break;
        }

        if (result.error) {
            // Si el error es de conexión (pero navigator.onLine dijo que sí), guardamos en cola
            // Supabase suele devolver un error con code vacío o mensajes de fetch para red
            const isNetworkError = !result.error.code ||
                result.error.message?.toLowerCase().includes('fetch') ||
                result.error.message?.toLowerCase().includes('network');

            if (isNetworkError) {
                await queueMutation(options);
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
            errorMessage.includes('connection');

        if (isNetworkError) {
            await queueMutation(options);
            return { success: true, offline: true };
        }

        return { success: false, offline: false, error: String(error) };
    }
}

// Helper para inserts
export async function offlineInsert(table: string, data: Record<string, unknown>) {
    return offlineMutation({ type: 'insert', table, data });
}

// Helper para updates
export async function offlineUpdate(table: string, data: Record<string, unknown>) {
    return offlineMutation({ type: 'update', table, data });
}

// Helper para deletes
export async function offlineDelete(table: string, id: string | number) {
    return offlineMutation({ type: 'delete', table, data: { id } });
}
