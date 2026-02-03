import { initDB } from './db';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
    id?: number;
    level: LogLevel;
    message: string;
    details?: string | object;
    timestamp: number;
    userAgent?: string;
    url?: string;
}

export async function logSystem(level: LogLevel, message: string, details?: unknown) {
    try {
        const db = await initDB();

        let detailsStr = '';
        if (details) {
            if (details instanceof Error) {
                detailsStr = JSON.stringify({
                    name: details.name,
                    message: details.message,
                    stack: details.stack
                });
            } else if (typeof details === 'object') {
                try {
                    detailsStr = JSON.stringify(details);
                } catch {
                    detailsStr = String(details);
                }
            } else {
                detailsStr = String(details);
            }
        }

        const entry: LogEntry = {
            level,
            message,
            details: detailsStr,
            timestamp: Date.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            url: typeof window !== 'undefined' ? window.location.href : ''
        };

        await db.add('system_logs', entry);

        // Mantener solo los últimos 1000 logs para no llenar IndexedDB
        // Esto es una optimización simple
        const count = await db.count('system_logs');
        if (count > 1000) {
            const tx = db.transaction('system_logs', 'readwrite');
            const cursor = await tx.store.openCursor(null, 'next'); // oldest first
            if (cursor) {
                await cursor.delete();
                // Podríamos borrar más en bloque, pero esto borra al menos uno cada vez
            }
            await tx.done;
        }

    } catch (e) {
        console.error('Failed to write to system log:', e);
    }
}

export async function getSystemLogs(limit = 100): Promise<LogEntry[]> {
    try {
        const db = await initDB();
        const logs = await db.getAllFromIndex('system_logs', 'timestamp');
        return logs.reverse().slice(0, limit);
    } catch (e) {
        console.error('Failed to read system logs:', e);
        return [];
    }
}

export async function clearSystemLogs() {
    try {
        const db = await initDB();
        await db.clear('system_logs');
    } catch (e) {
        console.error('Failed to clear system logs:', e);
    }
}
