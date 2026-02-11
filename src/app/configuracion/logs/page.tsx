'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { getSystemLogs, clearSystemLogs, LogEntry } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Trash2, RefreshCw, Copy, AlertTriangle, AlertCircle,
    Info, Database, CloudOff, HardDriveDownload,
    Search, Filter, Download, Eye, ChevronDown, ChevronUp,
    User, Monitor, Globe, Clock, Hash
} from 'lucide-react';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { db, type MutationQueueItem } from '@/lib/db/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function LogsPage() {
    const { role } = useAuth();
    const { pendingCount, clearQueue, processMutations, isSyncing } = useOfflineSync();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [mutations, setMutations] = useState<MutationQueueItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await getSystemLogs(500); // Aumentamos a 500 para mejor diagnóstico
            const mutationList = await db.mutations.where('status').equals('pending').toArray();
            setLogs(data);
            setMutations(mutationList);
        } catch (error) {
            console.error('Error cargando logs:', error);
            toast.error('Error al cargar la bitácora');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === 'SUPERADMIN' || role === 'JUNTA') {
            loadLogs();
        }
    }, [role]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
            return matchesSearch && matchesLevel;
        });
    }, [logs, searchTerm, levelFilter]);

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

    const exportLogs = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `logs_hermandad_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success('Archivo de logs generado');
    };

    const toggleExpand = (id?: number) => {
        if (!id) return;
        setExpandedLogs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (role !== 'SUPERADMIN' && role !== 'JUNTA') {
        return <div className="p-8 text-center text-red-500">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#1a2b4b]">Centro de Diagnóstico</h1>
                    <p className="text-muted-foreground text-sm italic">Monitoreo proactivo y registro técnico de eventos</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={exportLogs} disabled={logs.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadLogs}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refrescar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClear}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Limpiar Bitácora
                    </Button>
                </div>
            </div>

            {/* Barra de Herramientas de Filtrado */}
            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar en mensajes o detalles..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['all', 'info', 'warn', 'error'] as const).map((level) => (
                            <Button
                                key={level}
                                variant={levelFilter === level ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setLevelFilter(level)}
                                className={`capitalize ${levelFilter === level
                                        ? level === 'error' ? 'bg-red-600 hover:bg-red-700' :
                                            level === 'warn' ? 'bg-orange-600 hover:bg-orange-700' :
                                                level === 'info' ? 'bg-blue-600 hover:bg-blue-700' : ''
                                        : ''
                                    }`}
                            >
                                {level}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

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

                        <Button variant="destructive" className="bg-red-600 text-white hover:bg-red-700 border-red-800" onClick={async () => {
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
                        <div className="mt-4 space-y-2">
                            <p className="text-xs text-orange-700 font-semibold">
                                Detalle de Operaciones ({mutations.length}):
                            </p>
                            <div className="bg-slate-50 dark:bg-slate-900 rounded border max-h-60 overflow-y-auto p-2 font-mono text-[10px]">
                                {mutations.map((m, idx) => (
                                    <div key={m.id || idx} className="text-xs border-b last:border-0 py-2">
                                        <div className="flex justify-between font-bold">
                                            <span className="uppercase text-orange-600">{m.type} {m.table}</span>
                                            <span>Reintentos: {m.retryCount || 0}</span>
                                        </div>
                                        <div className="text-muted-foreground mt-1 break-all">
                                            {JSON.stringify(m.data)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Listado de Logs */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <span className="text-sm font-medium">Mostrando {filteredLogs.length} de {logs.length} registros</span>
                    {filteredLogs.length < logs.length && (
                        <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setLevelFilter('all'); }} className="h-8 text-blue-600">
                            Limpiar filtros
                        </Button>
                    )}
                </div>

                {filteredLogs.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            {loading ? 'Consultando IndexedDB...' : 'No se encontraron registros activos para los criterios seleccionados.'}
                        </CardContent>
                    </Card>
                ) : (
                    filteredLogs.map((log) => {
                        const isExpanded = expandedLogs.has(log.id!);
                        const breadcrumbsData = log.breadcrumbs ? JSON.parse(log.breadcrumbs) : [];

                        return (
                            <Card key={log.id} className={`${log.level === 'error' ? 'border-l-4 border-l-red-500 shadow-red-100/10' :
                                    log.level === 'warn' ? 'border-l-4 border-l-orange-500 shadow-orange-100/10' :
                                        'border-l-4 border-l-blue-500 shadow-blue-100/10'
                                } transition-all duration-200 hover:shadow-md overflow-hidden`}>
                                <CardContent className="p-0">
                                    <div
                                        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 flex justify-between items-start gap-4"
                                        onClick={() => toggleExpand(log.id)}
                                    >
                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${log.level === 'error' ? 'bg-red-100 text-red-700' :
                                                        log.level === 'warn' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {log.level}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                                                </span>
                                                <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(log.timestamp), 'dd MMM yyyy', { locale: es })}
                                                </span>
                                                {log.networkStatus && (
                                                    <span className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded border ${log.networkStatus === 'online' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'
                                                        }`}>
                                                        <Globe className="w-3 h-3" />
                                                        {log.networkStatus}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`font-semibold text-sm ${log.level === 'error' ? 'text-red-900 dark:text-red-100' : ''}`}>
                                                {log.message}
                                            </p>
                                            {log.url && (
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate max-w-md">
                                                    <Globe className="w-3 h-3" /> {log.url}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); copyLog(log); }}>
                                                <Copy className="w-4 h-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 pt-4">
                                            {/* Metadatos Rápidos */}
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                                <div className="bg-white dark:bg-slate-800 p-2 rounded border text-[10px] space-y-1">
                                                    <div className="text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Usuario</div>
                                                    <div className="font-mono truncate">{log.userId || 'No autenticado'}</div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-2 rounded border text-[10px] space-y-1">
                                                    <div className="text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Sesión</div>
                                                    <div className="font-mono truncate">{log.sessionId || 'N/A'}</div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-2 rounded border text-[10px] space-y-1 col-span-2">
                                                    <div className="text-muted-foreground flex items-center gap-1"><Monitor className="w-3 h-3" /> User Agent</div>
                                                    <div className="truncate">{log.userAgent || 'Desconocido'}</div>
                                                </div>
                                            </div>

                                            {/* Detalles Técnicos */}
                                            {log.details && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Database className="w-3 h-3" /> Detalles JSON / Stack Trace
                                                    </h4>
                                                    <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto max-h-60 whitespace-pre-wrap font-mono scrollbar-thin">
                                                        {typeof log.details === 'string'
                                                            ? (log.details.startsWith('{') ? JSON.stringify(JSON.parse(log.details), null, 2) : log.details)
                                                            : JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Breadcrumbs (Pasos previos) */}
                                            {breadcrumbsData.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> Historial de Acciones (Breadcrumbs)
                                                    </h4>
                                                    <div className="relative border-l-2 border-slate-300 dark:border-slate-700 ml-2 pl-4 space-y-3 py-1">
                                                        {breadcrumbsData.map((bc: any, i: number) => (
                                                            <div key={i} className="relative text-[11px]">
                                                                <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full border-2 bg-white dark:bg-slate-800 ${bc.level === 'error' ? 'border-red-500' :
                                                                        bc.level === 'warn' ? 'border-orange-500' :
                                                                            'border-blue-500'
                                                                    }`} />
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[9px]">{bc.category}</span>
                                                                        <span className="text-muted-foreground text-[9px]">{format(new Date(bc.timestamp), 'HH:mm:ss')}</span>
                                                                    </div>
                                                                    <div className="text-slate-800 dark:text-slate-200">{bc.message}</div>
                                                                    {bc.data && (
                                                                        <div className="text-[9px] text-muted-foreground italic truncate max-w-full">
                                                                            Data: {JSON.stringify(bc.data)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Botón de pánico/Desarrollo - Solo en LOCALHOST para pruebas */}
            {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                <div className="fixed bottom-4 right-4 z-50">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="bg-black/5 text-[9px] hover:bg-black/10"
                        onClick={() => {
                            // Simulamos un error para probar
                            throw new Error('Test Error: Probando sistema de logs avanzado');
                        }}
                    >
                        Probar Auto-Log
                    </Button>
                </div>
            )}
        </div>
    );
}
