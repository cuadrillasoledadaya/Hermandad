import { queueMutation } from './db';

// Tipo de operación de base de datos
interface MutationOptions {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: Record<string, unknown>;
}

// Función principal para realizar mutations con soporte offline
export async function offlineMutation(options: MutationOptions): Promise<{ success: boolean; offline: boolean; error?: string }> {
    try {
        // Intentar hacer la operación online primero
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${options.table}`, {
            method: options.type === 'delete' ? 'DELETE' : options.type === 'insert' ? 'POST' : 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
            body: options.type !== 'delete' ? JSON.stringify(options.data) : undefined,
        });

        if (response.ok) {
            return { success: true, offline: false };
        }

        // Si falló por conexión, guardar en cola
        if (!navigator.onLine || response.status === 0) {
            await queueMutation(options);
            return { success: true, offline: true };
        }

        return { success: false, offline: false, error: `Error ${response.status}` };

    } catch (error) {
        // Error de red: guardar en cola
        if (!navigator.onLine || (error instanceof TypeError && error.message.includes('fetch'))) {
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
