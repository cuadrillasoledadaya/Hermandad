import { queueMutation } from './db';

// Tipo de operación de base de datos
interface MutationOptions {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: Record<string, unknown>;
}

// Función principal para realizar mutations con soporte offline
export async function offlineMutation(options: MutationOptions): Promise<{ success: boolean; offline: boolean; data?: unknown; error?: string }> {
    try {
        let url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${options.table}`;

        // Para UPDATE y DELETE, necesitamos especificar el ID en la URL
        if (options.type !== 'insert' && options.data?.id) {
            url += `?id=eq.${options.data.id}`;
        }

        // Si es INSERT, necesitamos que devuelva el objeto creado
        if (options.type === 'insert') {
            // Header Prefer: return=representation es necesario para que devuelva el objeto
            // Pero Supabase JS lo añade automáticamente. Aquí hacemos fetch directo.
            // Para mantener consistencia con el cliente JS, añadimos param select o header
            url += '?select=*';
        }

        // Intentar hacer la operación online primero
        const response = await fetch(url, {
            method: options.type === 'delete' ? 'DELETE' : options.type === 'insert' ? 'POST' : 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                'Prefer': 'return=representation' // Para que devuelva los datos (importante para insert/update)
            },
            body: options.type !== 'delete' ? JSON.stringify(options.data) : undefined,
        });

        if (response.ok) {
            let responseData = null;
            try {
                if (options.type !== 'delete') {
                    const json = await response.json();
                    responseData = json && json.length > 0 ? json[0] : json;
                }
            } catch {
                // Ignore json parse error if empty body (e.g. delete)
            }
            return { success: true, offline: false, data: responseData };
        }

        // Si falló por conexión, guardar en cola
        if (!navigator.onLine || response.status === 0) {
            await queueMutation(options);
            return { success: true, offline: true };
        }

        return { success: false, offline: false, error: `Error ${response.status}: ${response.statusText}` };

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
