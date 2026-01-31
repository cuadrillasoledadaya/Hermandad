'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { obtenerPosicionesPorTramo } from '@/lib/cortejo-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddFilaNazarenosDialog } from '@/components/cortejo/admin/add-fila-nazarenos-dialog';
import { AddPosicionDialog } from '@/components/cortejo/admin/add-posicion-dialog';
import { PosicionCard } from '@/components/cortejo/admin/posicion-card';

export default function CortejoAdminPage() {
    const [tramoSeleccionado, setTramoSeleccionado] = useState(0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Tabs por Tramo */}
                <Tabs value={tramoSeleccionado.toString()} onValueChange={(v) => setTramoSeleccionado(Number(v))}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="0">Cruz de Guía</TabsTrigger>
                        <TabsTrigger value="1">Tramo 1</TabsTrigger>
                        <TabsTrigger value="2">Tramo 2</TabsTrigger>
                        <TabsTrigger value="3">Tramo 3</TabsTrigger>
                    </TabsList>

                    {[0, 1, 2, 3].map(tramo => (
                        <TabsContent key={tramo} value={tramo.toString()}>
                            <TramoContent tramo={tramo} />
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    );
}

function TramoContent({ tramo }: { tramo: number }) {
    const { data: posiciones, isLoading } = useQuery({
        queryKey: ['cortejo-admin', tramo],
        queryFn: () => obtenerPosicionesPorTramo(tramo)
    });

    if (isLoading) {
        return <div className="text-center py-8">Cargando...</div>;
    }

    const tiposOrden = ['cruz_guia', 'vara', 'insignia', 'bocina', 'nazareno', 'paso'];
    const tiposPresentes = tiposOrden.filter(tipo => (posiciones && posiciones[tipo]?.length > 0));

    return (
        <div className="space-y-6">
            {/* Botones de Acción */}
            <div className="flex gap-3 justify-end">
                {tramo >= 1 && tramo <= 3 && <AddFilaNazarenosDialog tramoInicial={tramo} />}
                <AddPosicionDialog tramoInicial={tramo} />
            </div>

            {/* Posiciones por Tipo */}
            {tiposPresentes.map(tipo => {
                const posicionesTipo = posiciones?.[tipo] || [];
                const labels: Record<string, string> = {
                    cruz_guia: '✝️ Cruz de Guía',
                    vara: '🎋 Varas',
                    insignia: '🚩 Insignias',
                    bocina: '📯 Bocinas',
                    nazareno: '👤 Nazarenos',
                    paso: '⛪ Pasos'
                };

                return (
                    <Card key={tipo}>
                        <CardHeader>
                            <CardTitle className="text-lg">{labels[tipo]}</CardTitle>
                            <CardDescription>{posicionesTipo.length} posiciones</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {posicionesTipo.map(pos => (
                                    <PosicionCard key={pos.id} posicion={pos} />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {tiposPresentes.length === 0 && (
                <Card>
                    <CardContent className="py-8 text-center text-slate-500">
                        No hay posiciones en este tramo
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
