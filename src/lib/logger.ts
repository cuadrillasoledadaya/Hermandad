import { db, type LogEntry } from './db/database';
export type { LogEntry };

export type LogLevel = 'info' | 'warn' | 'error';

// ============================================
// BREADCRUMBS SYSTEM
// ============================================

export interface Breadcrumb {
    timestamp: number;
    category: string;
    message: string;
    level?: LogLevel;
    data?: any;
}

class BreadcrumbManager {
    private static instance: BreadcrumbManager;
    private breadcrumbs: Breadcrumb[] = [];
    private readonly MAX_BREADCRUMBS = 20;

    private constructor() { }

    static getInstance(): BreadcrumbManager {
        if (!BreadcrumbManager.instance) {
            BreadcrumbManager.instance = new BreadcrumbManager();
        }
        return BreadcrumbManager.instance;
    }

    add(category: string, message: string, level: LogLevel = 'info', data?: any) {
        this.breadcrumbs.push({
            timestamp: Date.now(),
            category,
            message,
            level,
            data
        });

        if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
            this.breadcrumbs.shift();
        }
    }

    get(): Breadcrumb[] {
        return [...this.breadcrumbs];
    }

    clear() {
        this.breadcrumbs = [];
    }
}

export const breadcrumbs = BreadcrumbManager.getInstance();

// ============================================
// SESSION & METADATA
// ============================================

let currentSessionId = '';
if (typeof window !== 'undefined') {
    currentSessionId = sessionStorage.getItem('log_session_id') || '';
    if (!currentSessionId) {
        currentSessionId = Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem('log_session_id', currentSessionId);
    }
}

let currentUserId = '';
export function setLogUserId(userId: string) {
    currentUserId = userId;
}

function getNetworkStatus(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    return navigator.onLine ? 'online' : 'offline';
}

// ============================================
// LOGGING CORE
// ============================================

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
            url: typeof window !== 'undefined' ? window.location.href : '',
            sessionId: currentSessionId,
            userId: currentUserId,
            networkStatus: getNetworkStatus(),
            breadcrumbs: JSON.stringify(BreadcrumbManager.getInstance().get())
        };

        await db.table('system_logs').add(entry);

        // También enviamos a consola en desarrollo
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
            const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
            console[consoleMethod](`[LOG:${level.toUpperCase()}] ${message}`, details || '');
        }

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

// Helper para errores críticos
export async function reportError(message: string, error?: unknown, category = 'exception') {
    breadcrumbs.add(category, message, 'error', error);
    await logSystem('error', message, error);
}

// ============================================
// GLOBAL LISTENERS INITIALIZATION
// ============================================

let listenersInitialized = false;

export function initGlobalErrorLogging() {
    if (typeof window === 'undefined' || listenersInitialized) return;

    window.onerror = (message, source, lineno, colno, error) => {
        logSystem('error', 'Global Window Error', {
            message: String(message),
            source,
            lineno,
            colno,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : null
        });
    };

    window.onunhandledrejection = (event) => {
        logSystem('error', 'Unhandled Promise Rejection', {
            reason: event.reason instanceof Error ? {
                name: event.reason.name,
                message: event.reason.message,
                stack: event.reason.stack
            } : event.reason
        });
    };

    // Tracking de navegación (breadcrumbs)
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
        breadcrumbs.add('navigation', `To: ${args[2]}`, 'info');
        return originalPushState.apply(this, args);
    };

    // Click tracking básico
    window.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const label = target.innerText || target.getAttribute('aria-label') || target.tagName;
        if (label && label.length < 50) {
            breadcrumbs.add('ui', `Click: ${label.trim()}`, 'info');
        }
    }, true);

    listenersInitialized = true;
    logSystem('info', 'Sistema de logs avanzado inicializado', { sessionId: currentSessionId });
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
        BreadcrumbManager.getInstance().clear();
    } catch (e) {
        console.error('Failed to clear system logs:', e);
    }
}
