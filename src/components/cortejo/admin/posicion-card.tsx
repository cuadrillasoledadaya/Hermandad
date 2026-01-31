'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eliminarPosicion } from '@/lib/cortejo-admin';
import type { CortejoEstructura } from '@/lib/cortejo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface PosicionCardProps {
    posicion: CortejoEstructura;
    tieneAsignacion?: boolean;
}

export function PosicionCard({ posicion, tieneAsignacion = false }: PosicionCardProps) {
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: () => eliminarPosicion(posicion.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cortejo-admin'] });
            toast.success('Posición eliminada correctamente');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Error al eliminar posición');
        }
    });

    const iconoTipo = {
        vara: '🎋',
        insignia: '🚩',
        bocina: '📯',
        nazareno: '👤',
        cruz_guia: '✝️',
        paso: '⛪'
    }[posicion.tipo] || '📍';

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{iconoTipo}</span>
                            <div>
                                <p className="font-medium text-slate-900">{posicion.nombre}</p>
                                <p className="text-xs text-slate-500">
                                    Pos: {posicion.posicion} · {posicion.lado || 'centro'}
                                    {tieneAsignacion && <span className="ml-2 text-emerald-600">· Asignada</span>}
                                </p>
                            </div>
                        </div>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={tieneAsignacion}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white">
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar posición?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Se eliminará permanentemente la posición:<br />
                                    <strong>{posicion.nombre}</strong>
                                    <br /><br />
                                    Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate()}
                                >
                                    Eliminar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
