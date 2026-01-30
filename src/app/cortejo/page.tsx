'use client';

import { useQuery } from '@tanstack/react-query';
import { getCortejoCompleto, getEstadisticasCortejo } from '@/lib/cortejo';
import { Card } from '@/components/ui/card';
import { Loader2, Church, User, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

export default function CortejoPage() {
    const { role } = useAuth();
    const canManage = role === 'SUPERADMIN' || role === 'JUNTA';

    const { data: cortejo, isLoading: loadingCortejo } = useQuery({
        queryKey: ['cortejo-completo'],
        queryFn: () => getCortejoCompleto(),
    });

    const { data: stats } = useQuery({
        queryKey: ['cortejo-stats'],
        queryFn: () => getEstadisticasCortejo(),
    });

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
            <div>
                <h2 className="text-2xl font-bold tracking-tight">🔱 Cortejo Procesional</h2>
                <p className="text-muted-foreground">
                    Organización y estructura del cortejo de la Hermandad.
                </p>
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
                                                        <button className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition">
                                                            Quitar
                                                        </button>
                                                    ) : (
                                                        <button className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition">
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
        </div>
    );
}
