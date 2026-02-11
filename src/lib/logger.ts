import { db, type LogEntry } from './db/database';
export type { LogEntry };

export type LogLevel = 'info' | 'warn' | 'error';

export async function logSystem(level: LogLevel, message: string, details?: unknown) {
    try {
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

        await db.table('system_logs').add(entry);

        // Mantener solo los últimos 1000 logs
        const count = await db.table('system_logs').count();
        if (count > 1000) {
            const first = await db.table('system_logs').toCollection().first();
            if (first && first.id) {
                await db.table('system_logs').delete(first.id);
            }
        }

    } catch (e) {
        console.error('Failed to write to system log:', e);
    }
}

export async function getSystemLogs(limit = 100): Promise<LogEntry[]> {
    try {
        const logs = await db.table('system_logs')
            .orderBy('timestamp')
            .reverse()
            .limit(limit)
            .toArray();
        return logs;
    } catch (e) {
        console.error('Failed to read system logs:', e);
        return [];
    }
}

export async function clearSystemLogs() {
    try {
        await db.table('system_logs').clear();
    } catch (e) {
        console.error('Failed to clear system logs:', e);
    }
}
