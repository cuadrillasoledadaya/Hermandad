'use client';

import { useQuery } from '@tanstack/react-query';
import { getCortejoCompleto, getEstadisticasCortejo } from '@/lib/cortejo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Church, User, Users, Shield } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { AsignarPapeletaDialog } from '@/components/cortejo/asignar-papeleta-dialog';
import { useState, useEffect } from 'react';
import { PosicionTipo } from '@/lib/cortejo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quitarAsignacionDePapeleta } from '@/lib/papeletas-cortejo';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function CortejoPage() {
    const { role } = useAuth();
    const canManage = role === 'SUPERADMIN' || role === 'JUNTA';
    const queryClient = useQueryClient();

    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedPosicion, setSelectedPosicion] = useState<{ id: string, nombre: string, tipo: PosicionTipo, tramo: number } | null>(null);
    const [papeletaToUnassign, setPapeletaToUnassign] = useState<string | null>(null);

    const quitarAsignacionMutation = useMutation({
        mutationFn: quitarAsignacionDePapeleta,
        onSuccess: () => {
            toast.success("Asignación eliminada correctamente");
            queryClient.invalidateQueries({ queryKey: ['cortejo_completo'] });
            queryClient.invalidateQueries({ queryKey: ['cortejo_stats'] });
            queryClient.invalidateQueries({ queryKey: ['papeletas_pendientes'] });
            setPapeletaToUnassign(null);
        },
        onError: (error: Error) => {
            toast.error(error.message || "Error al eliminar asignación");
        }
    });

    const handleAssignClick = (pos: { id: string, nombre: string, tipo: PosicionTipo, tramo: number }) => {
        setSelectedPosicion(pos);
        setAssignDialogOpen(true);
    };

    const handleUnassignClick = (papeletaId: string) => {
        setPapeletaToUnassign(papeletaId);
    };

    const { data: cortejo, isLoading: loadingCortejo } = useQuery({
        queryKey: ['cortejo_completo'],
        queryFn: () => getCortejoCompleto(),
    });

    const { data: stats } = useQuery({
        queryKey: ['cortejo_stats'],
        queryFn: () => getEstadisticasCortejo(),
    });

    // Suscripciones Realtime
    useEffect(() => {
        const channel = supabase
            .channel('cortejo_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cortejo_asignaciones' },
                () => {
                    console.log('🔔 [REALTIME] Cambio en asignaciones, refrescando cortejo...');
                    queryClient.invalidateQueries({ queryKey: ['cortejo_completo'] });
                    queryClient.invalidateQueries({ queryKey: ['cortejo_stats'] });
                    queryClient.invalidateQueries({ queryKey: ['papeletas_pendientes'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'papeletas_cortejo' },
                () => {
                    console.log('🔔 [REALTIME] Cambio en papeletas, refrescando stats...');
                    queryClient.invalidateQueries({ queryKey: ['cortejo_stats'] });
                    queryClient.invalidateQueries({ queryKey: ['papeletas_pendientes'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cortejo_estructura' },
                () => {
                    console.log('🔔 [REALTIME] Cambio en estructura, refrescando vista...');
                    queryClient.invalidateQueries({ queryKey: ['cortejo_completo'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    if (loadingCortejo) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">
                {canManage && (
                    <div className="flex gap-2">
                        <Link href="/cortejo/admin">
                            <Button variant="outline" className="gap-2">
                                <Shield className="w-4 h-4" />
                                Gestionar Estructura
                            </Button>
                        </Link>
                        <Link href="/cortejo/sorteo">
                            <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                                <Users className="w-4 h-4" />
                                Sorteo de Varas
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Estadísticas */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                        <p className="text-xs font-bold uppercase text-blue-700 tracking-wider mb-1">Total Posiciones</p>
                        <p className="text-2xl font-black text-blue-600">{stats.total_posiciones}</p>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                        <p className="text-xs font-bold uppercase text-green-700 tracking-wider mb-1">Asignadas</p>
                        <p className="text-2xl font-black text-green-600">{stats.posiciones_ocupadas}</p>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
                        <p className="text-xs font-bold uppercase text-orange-700 tracking-wider mb-1">Libres</p>
                        <p className="text-2xl font-black text-orange-600">{stats.posiciones_libres}</p>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                        <p className="text-xs font-bold uppercase text-purple-700 tracking-wider mb-1">Con Papeleta</p>
                        <p className="text-2xl font-black text-purple-600">{stats.hermanos_con_papeleta}</p>
                    </Card>
                </div>
            )}

            {/* Cortejo por tramos */}
            <div className="space-y-6">
                {cortejo?.map((tramo) => (
                    <Card key={tramo.numero} className="p-6 bg-white">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            {tramo.numero === 0 ? (
                                <>✝️ {tramo.nombre}</>
                            ) : (
                                <>🎗️ {tramo.nombre}</>
                            )}
                        </h3>

                        <div className="space-y-3">
                            {tramo.posiciones.map((pos) => {
                                const esPaso = pos.tipo === 'paso';
                                const tieneAsignacion = !!pos.asignacion;

                                if (esPaso) {
                                    return (
                                        <Card key={pos.id} className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-300">
                                            <div className="flex items-center gap-3">
                                                <Church className="w-6 h-6 text-amber-700" />
                                                <div>
                                                    <p className="font-bold text-amber-900">{pos.nombre}</p>
                                                    <p className="text-xs text-amber-700">Ver módulo de relevos para costaleros</p>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                }

                                return (
                                    <Card
                                        key={pos.id}
                                        className={`p-4 ${tieneAsignacion
                                            ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-emerald-300'
                                            : 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                {pos.tipo === 'cruz_guia' && <Church className="w-5 h-5 text-slate-700" />}
                                                {pos.tipo === 'insignia' && <Users className="w-5 h-5 text-slate-700" />}
                                                {pos.tipo === 'nazareno' && <User className="w-5 h-5 text-slate-700" />}

                                                <div>
                                                    <p className="font-semibold text-sm">{pos.nombre}</p>
                                                    {tieneAsignacion ? (
                                                        <p className="text-xs text-emerald-700 font-medium">
                                                            👤 {pos.asignacion?.hermano?.nombre} {pos.asignacion?.hermano?.apellidos}
                                                            {pos.asignacion?.numero_papeleta && (
                                                                <span className="ml-2 text-emerald-600">
                                                                    📄 #{pos.asignacion.numero_papeleta}
                                                                </span>
                                                            )}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-500">Posición vacía</p>
                                                    )}
                                                </div>
                                            </div>

                                            {canManage && (
                                                <div className="flex gap-2">
                                                    {tieneAsignacion ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (pos.asignacion?.id_papeleta) {
                                                                    handleUnassignClick(pos.asignacion.id_papeleta);
                                                                } else {
                                                                    toast.error("No se encontró ID de papeleta asociada");
                                                                }
                                                            }}
                                                            className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition"
                                                        >
                                                            Quitar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleAssignClick({ id: pos.id, nombre: pos.nombre, tipo: pos.tipo, tramo: pos.tramo })}
                                                            className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition"
                                                        >
                                                            Asignar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Diálogo de Asignación */}
            {
                selectedPosicion && (
                    <AsignarPapeletaDialog
                        open={assignDialogOpen}
                        onOpenChange={setAssignDialogOpen}
                        posicionId={selectedPosicion.id}
                        posicionNombre={selectedPosicion.nombre}
                        posicionTipo={selectedPosicion.tipo}
                        posicionTramo={selectedPosicion.tramo}
                    />
                )
            }

            {/* Diálogo de confirmación para quitar asignación */}
            <AlertDialog open={!!papeletaToUnassign} onOpenChange={(open) => !open && setPapeletaToUnassign(null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar asignación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción liberará la posición. La papeleta del hermano volverá a estar en estado &quot;Pagada&quot; y podrá ser asignada de nuevo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                if (papeletaToUnassign) {
                                    quitarAsignacionMutation.mutate(papeletaToUnassign);
                                }
                            }}
                        >
                            {quitarAsignacionMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
