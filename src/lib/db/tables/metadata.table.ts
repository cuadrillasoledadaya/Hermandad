import { db, Metadata } from '../database';

export const metadataRepo = {
    async get(key: string): Promise<any | undefined> {
        try {
            const record = await db.metadata.get(key);
            return record?.value;
        } catch (error) {
            console.warn(`⚠️ [DB] Error obteniendo metadata ${key}:`, error);
            return undefined;
        }
    },

    async set(key: string, value: any): Promise<void> {
        try {
            await db.metadata.put({
                key,
                value,
                updated_at: Date.now()
            });
        } catch (error) {
            console.error(`❌ [DB] Error guardando metadata ${key}:`, error);
        }
    },

    async delete(key: string): Promise<void> {
        try {
            await db.metadata.delete(key);
        } catch (error) {
            console.error(`❌ [DB] Error borrando metadata ${key}:`, error);
        }
    }
};
