import { initDB } from './db';

/**
 * Limpia completamente toda la base de datos IndexedDB local.
 * ADVERTENCIA: Esta operación eliminará TODOS los datos locales:
 * - Hermanos cacheados
 * - Papeletas cacheadas
 * - Pagos cacheados
 * - Cola de mutaciones offline
 * - Logs del sistema
 * - Metadata de sincronización
 * 
 * Después de esto, se recargará todo desde Supabase al volver a cargar la app.
 */
export async function clearAllLocalData(): Promise<void> {
    try {
        const db = await initDB();

        // Lista de todas las tablas/stores a limpiar
        const storesToClear = [
            'hermanos',
            'pagos',
            'papeletas_cortejo',
            'configuracion',
            'system_logs',
            'mutation_queue',
            'sync_metadata'
        ];

        // Limpiar cada store
        for (const storeName of storesToClear) {
            if (db.objectStoreNames.contains(storeName)) {
                await db.clear(storeName);
            }
        }

        console.log('✅ Base de datos local completamente limpiada');
    } catch (error) {
        console.error('❌ Error limpiando base de datos local:', error);
        throw error;
    }
}

/**
 * Borra completamente la base de datos IndexedDB y luego recarga la página.
 * Esto fuerza una sincronización completa con Supabase desde cero.
 */
export async function resetAndReload(): Promise<void> {
    await clearAllLocalData();

    // Limpiar también React Query cache del localStorage si existe
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('REACT_QUERY') || key.startsWith('hermandad'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.error('Error limpiando localStorage:', error);
    }

    // Recargar la página para forzar una sincronización completa
    window.location.reload();
}
