'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHermanos, recalibrarNumeros, type Hermano } from '@/lib/brothers';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Mail, Phone, Calendar } from 'lucide-react';
import { AddBrotherDialog } from './add-brother-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/components/providers/auth-provider';

export function BrothersList() {
    const queryClient = useQueryClient();
    const { role } = useAuth();
    const canManage = role === 'SUPERADMIN' || role === 'JUNTA';

    const { data: hermanos = [], isLoading } = useQuery({
        queryKey: ['hermanos'],
        queryFn: getHermanos,
    });

    const recalibrateMutation = useMutation({
        mutationFn: recalibrarNumeros,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hermanos'] });
            toast.success('Numeración recalibrada correctamente');
        },
        onError: () => {
            toast.error('Error al recalibrar la numeración');
        }
    });

    if (isLoading) {
        return <div className="text-center py-10">Cargando censo...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Listado General</h3>
                {canManage && (
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => recalibrateMutation.mutate()}
                            disabled={recalibrateMutation.isPending}
                        >
                            <RefreshCcw className={recalibrateMutation.isPending ? "animate-spin mr-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                            Recalibrar Números
                        </Button>
                        <AddBrotherDialog />
                    </div>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {hermanos.length === 0 ? (
                    <div className="col-span-full p-12 border-2 border-dashed rounded-xl text-center text-muted-foreground">
                        No hay hermanos en el censo actual.
                    </div>
                ) : (
                    hermanos.map((hermano) => (
                        <div key={hermano.id} className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                    Nº {hermano.numero_hermano || '---'}
                                </Badge>
                                {hermano.activo ? (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Activo</Badge>
                                ) : (
                                    <Badge variant="secondary">Baja</Badge>
                                )}
                            </div>
                            <h4 className="font-bold text-lg mb-1">{hermano.nombre} {hermano.apellidos}</h4>
                            <div className="space-y-1.5 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                    <Mail className="h-3.5 w-3.5 mr-2" />
                                    {hermano.email || 'Sin email'}
                                </div>
                                <div className="flex items-center">
                                    <Phone className="h-3.5 w-3.5 mr-2" />
                                    {hermano.telefono || 'Sin teléfono'}
                                </div>
                                <div className="flex items-center">
                                    <Calendar className="h-3.5 w-3.5 mr-2" />
                                    Alta: {format(new Date(hermano.fecha_alta), 'd MMM yyyy', { locale: es })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
