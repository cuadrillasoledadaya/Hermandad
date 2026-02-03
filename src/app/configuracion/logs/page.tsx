'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { getSystemLogs, clearSystemLogs, LogEntry } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, RefreshCw, Copy, AlertTriangle, AlertCircle, Info, Database, CloudOff, HardDriveDownload } from 'lucide-react';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { resetAndReload } from '@/lib/db-clear';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function LogsPage() {
    const { role } = useAuth();
    const { pendingCount, clearQueue, processMutations, isSyncing } = useOfflineSync();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getSystemLogs(200); // Últimos 200 logs
        setLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        let mounted = true;

        async function fetchInitialLogs() {
            if (role === 'SUPERADMIN' || role === 'JUNTA') {
                const data = await getSystemLogs(200);
                if (mounted) {
                    setLogs(data);
                    setLoading(false);
                }
            }
        }

        fetchInitialLogs();

        return () => { mounted = false; };
    }, [role]);

    const handleClear = async () => {
        if (confirm('¿Estás seguro de borrar todos los logs?')) {
            await clearSystemLogs();
            await loadLogs();
            toast.success('Logs borrados');
        }
    };

    const copyLog = (log: LogEntry) => {
        const text = JSON.stringify(log, null, 2);
        navigator.clipboard.writeText(text);
        toast.success('Log copiado al portapapeles');
    };

    // Permitimos ver logs a roles de administración
    if (role !== 'SUPERADMIN' && role !== 'JUNTA') {
        return <div className="p-8 text-center text-red-500">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[#1a2b4b]">Logs del Sistema</h1>
                    <p className="text-muted-foreground">Registro técnico de errores para depuración</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadLogs}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refrescar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClear}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Borrar Todo
                    </Button>
                </div>
            </div>

            {/* Sección Sincronización */}
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="w-5 h-5 text-orange-600" />
                        Cola de Sincronización Offline
                    </CardTitle>
                    <CardDescription>
                        Gestiona los cambios pendientes de subir a la nube.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="bg-white dark:bg-slate-900 p-2 rounded border px-4 flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Pendientes:</span>
                            <span className="font-bold text-xl">{pendingCount}</span>
                        </div>

                        <Button variant="outline" onClick={() => processMutations()} disabled={pendingCount === 0 || isSyncing}>
                            {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Forzar Sincronización
                        </Button>

                        <Button variant="destructive" onClick={async () => {
                            if (confirm('¿Estás seguro? Se perderán los cambios offline no guardados (ventas, etc).')) {
                                await clearQueue();
                                toast.success('Cola de sincronización vaciada');
                            }
                        }} disabled={pendingCount === 0}>
                            <CloudOff className="mr-2 h-4 w-4" />
                            Descartar Todo (Reset)
                        </Button>
                    </div>
                    {pendingCount > 0 && (
                        <p className="text-xs text-orange-700 mt-2">
                            Advertencia: Tienes {pendingCount} operaciones esperando conexión. Si las descartas, los datos creados offline se perderán permanentemente.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Sección Limpiar Base de Datos Local */}
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <HardDriveDownload className="w-5 h-5 text-red-600" />
                        Limpiar Cache Local (IndexedDB)
                    </CardTitle>
                    <CardDescription>
                        Borra TODOS los datos locales y recarga desde Supabase. Útil cuando web y PWA no coinciden.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="bg-white dark:bg-slate-900 p-3 rounded border text-sm">
                            <p className="font-semibold mb-2">⚠️ Esta acción borrará:</p>
                            <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground ml-2">
                                <li>Todos los hermanos descargados</li>
                                <li>Todas las papeletas cacheadas</li>
                                <li>Todos los pagos descargados</li>
                                <li>Cola de sincronización offline</li>
                                <li>Logs del sistema</li>
                            </ul>
                            <p className="text-xs text-red-600 font-semibold mt-3">
                                💡 Al recargar, todo se descargará nuevamente desde Supabase (nube).
                            </p>
                        </div>

                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={async () => {
                                if (confirm('⚠️ ¿ESTÁS SEGURO?\n\nSe borrarán TODOS los datos locales de IndexedDB.\n\nSi tienes cambios pendientes de sincronizar, SE PERDERÁN.\n\nDespués de confirmar, la app se recargará y descargará todo desde Supabase.')) {
                                    try {
                                        toast.loading('Limpiando base de datos local...');
                                        await resetAndReload();
                                        // La página se recargará automáticamente
                                    } catch (error) {
                                        toast.error('Error al limpiar la base de datos');
                                        console.error(error);
                                    }
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Limpiar Todo y Recargar desde Supabase
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {logs.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            {loading ? 'Cargando logs...' : 'No hay logs registrados.'}
                        </CardContent>
                    </Card>
                ) : (
                    logs.map((log, index) => (
                        <Card key={log.id || `${log.timestamp}-${index}`} className={log.level === 'error' ? 'border-l-4 border-l-red-500' : ''}>
                            <CardContent className="p-4 pt-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            {log.level === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                                                log.level === 'warn' ? <AlertTriangle className="w-4 h-4 text-orange-500" /> :
                                                    <Info className="w-4 h-4 text-blue-500" />}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${log.level === 'error' ? 'bg-red-100 text-red-700' :
                                                log.level === 'warn' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {log.level}
                                            </span>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-sm break-all">{log.message}</p>
                                        {log.details && (
                                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded mt-2 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        )}
                                        {log.url && <p className="text-[10px] text-muted-foreground mt-1 truncate">Ruta: {log.url}</p>}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => copyLog(log)} title="Copiar log">
                                        <Copy className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
