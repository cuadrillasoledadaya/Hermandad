import { openDB, IDBPDatabase } from 'idb';

const DATABASE_NAME = 'hermandad_offline_db';
const DATABASE_VERSION = 3; // Incrementamos versión para añadir papeletas_cortejo

// Cola de operaciones pendientes (para cuando estamos offline)
export interface MutationQueueItem {
    id?: number;
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: Record<string, unknown> | Record<string, unknown>[];
    timestamp: number;
    retryCount: number;
}

export async function initDB(): Promise<IDBPDatabase> {
    return openDB(DATABASE_NAME, DATABASE_VERSION, {
        upgrade(db, oldVersion) {
            // Versión 1
            if (oldVersion < 1) {
                const hermanosStore = db.createObjectStore('hermanos', { keyPath: 'id' });
                hermanosStore.createIndex('email', 'email', { unique: true });
                hermanosStore.createIndex('numero_hermano', 'numero_hermano', { unique: true });
                hermanosStore.createIndex('activo', 'activo', { unique: false });

                const pagosStore = db.createObjectStore('pagos', { keyPath: 'id' });
                pagosStore.createIndex('hermano_id', 'hermano_id', { unique: false });
                pagosStore.createIndex('fecha', 'fecha', { unique: false });

                db.createObjectStore('mutation_queue', { keyPath: 'id', autoIncrement: true });

                db.createObjectStore('sync_metadata', { keyPath: 'key' });
            }

            // Versión 2
            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains('configuracion')) {
                    db.createObjectStore('configuracion', { keyPath: 'id' });
                }
            }

            // Versión 3 - Añadir store para papeletas_cortejo
            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains('papeletas_cortejo')) {
                    const papeletasStore = db.createObjectStore('papeletas_cortejo', { keyPath: 'id' });
                    papeletasStore.createIndex('id_hermano', 'id_hermano', { unique: false });
                    papeletasStore.createIndex('anio', 'anio', { unique: false });
                }
            }
        },
    });
}

// Función para guardar datos de hermanos en local
export async function saveHermanosLocal(hermanos: Record<string, unknown>[]) {
    const db = await initDB();
    const tx = db.transaction('hermanos', 'readwrite');
    const store = tx.objectStore('hermanos');

    // Limpiar datos antiguos y guardar nuevos
    await store.clear();
    for (const hermano of hermanos) {
        await store.put(hermano);
    }

    await tx.done;
}

// Función para obtener hermanos de local
export async function getHermanosLocal(): Promise<Record<string, unknown>[]> {
    const db = await initDB();
    return db.getAll('hermanos');
}

// Función para guardar pagos en local
export async function savePagosLocal(pagos: Record<string, unknown>[]) {
    const db = await initDB();
    const tx = db.transaction('pagos', 'readwrite');
    const store = tx.objectStore('pagos');

    await store.clear();
    for (const pago of pagos) {
        await store.put(pago);
    }

    await tx.done;
}

// Función para obtener pagos de local
export async function getPagosLocal(): Promise<Record<string, unknown>[]> {
    const db = await initDB();
    return db.getAll('pagos');
}

// Función para guardar papeletas en local
export async function savePapeletasLocal(papeletas: Record<string, unknown>[]) {
    const db = await initDB();
    const tx = db.transaction('papeletas_cortejo', 'readwrite');
    const store = tx.objectStore('papeletas_cortejo');

    await store.clear();
    for (const papeleta of papeletas) {
        await store.put(papeleta);
    }

    await tx.done;
}

// Función para obtener papeletas de local
export async function getPapeletasLocal(): Promise<Record<string, unknown>[]> {
    const db = await initDB();
    return db.getAll('papeletas_cortejo');
}

// Función para añadir una sola papeleta (usada tras venta offline)
export async function addPapeletaLocal(papeleta: Record<string, unknown>) {
    const db = await initDB();
    await db.put('papeletas_cortejo', papeleta);
}

// Función para añadir un solo pago (usada tras venta offline)
export async function addPagoLocal(pago: Record<string, unknown>) {
    const db = await initDB();
    await db.put('pagos', pago);
}

// AÑADIR UNA MUTACIÓN A LA COLA (cuando estamos offline)
export async function queueMutation(mutation: Omit<MutationQueueItem, 'id' | 'timestamp' | 'retryCount'>) {
    const db = await initDB();
    const item: MutationQueueItem = {
        ...mutation,
        timestamp: Date.now(),
        retryCount: 0
    };
    await db.add('mutation_queue', item);

    // OPTIMISTIC UPDATE: Si es un INSERT, guardamos los datos inmediatamente en la tabla local
    // para que las queries puedan mostrarlo mientras se sincroniza
    if (mutation.type === 'insert') {
        const storeName = mutation.table;

        // Verificar que el store existe
        if (db.objectStoreNames.contains(storeName)) {
            if (Array.isArray(mutation.data)) {
                // Bulk insert
                const tx = db.transaction(storeName, 'readwrite');
                for (const record of mutation.data) {
                    const withId = {
                        ...record,
                        id: record.id || crypto.randomUUID(),
                        _offline: true // Marcar como pendiente de sincronización
                    };
                    await tx.store.put(withId);
                }
                await tx.done;
            } else {
                // Single insert
                const withId = {
                    ...mutation.data,
                    id: mutation.data.id || crypto.randomUUID(),
                    _offline: true
                };
                await db.put(storeName, withId);
            }
        }
    }
}

// OBTENER TODAS LAS MUTACIONES PENDIENTES
export async function getPendingMutations(): Promise<MutationQueueItem[]> {
    const db = await initDB();
    return db.getAll('mutation_queue');
}

// ELIMINAR UNA MUTACIÓN YA PROCESADA
export async function removeMutation(id: number) {
    const db = await initDB();
    await db.delete('mutation_queue', id);
}

// ACTUALIZAR CONTADOR DE REINTENTOS
export async function incrementRetryCount(id: number) {
    const db = await initDB();
    const tx = db.transaction('mutation_queue', 'readwrite');
    const store = tx.objectStore('mutation_queue');
    const item = await store.get(id);
    if (item) {
        item.retryCount += 1;
        await store.put(item);
    }
    await tx.done;
}

// GUARDAR METADATA DE SINCRONIZACIÓN
export async function setSyncMetadata(key: string, value: unknown) {
    const db = await initDB();
    await db.put('sync_metadata', { key, value, timestamp: Date.now() });
}

// OBTENER METADATA DE SINCRONIZACIÓN
export async function getSyncMetadata(key: string): Promise<unknown | undefined> {
    const db = await initDB();
    const result = await db.get('sync_metadata', key);
    return result?.value;
}
