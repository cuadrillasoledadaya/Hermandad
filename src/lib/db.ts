import { openDB, IDBPDatabase } from 'idb';

export interface DBConfig {
    name: string;
    version: number;
}

const DATABASE_NAME = 'hermandad_offline_db';
const DATABASE_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase> {
    return openDB(DATABASE_NAME, DATABASE_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('hermanos')) {
                db.createObjectStore('hermanos', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('pagos')) {
                db.createObjectStore('pagos', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('mutation_queue')) {
                db.createObjectStore('mutation_queue', { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}
