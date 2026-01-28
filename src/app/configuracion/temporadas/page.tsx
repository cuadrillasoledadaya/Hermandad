'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, Plus, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

interface Temporada {
    id: string;
    nombre: string;
    anio: number;
    is_active: boolean;
    created_at: string;
}

export default function TemporadasPage() {
    const { role } = useAuth();
    const queryClient = useQueryClient();
    const [newSeasonName, setNewSeasonName] = useState('');
    const [newSeasonYear, setNewSeasonYear] = useState(new Date().getFullYear());

    const { data: temporadas = [], isLoading } = useQuery<Temporada[]>({
        queryKey: ['temporadas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('temporadas')
                .select('*')
                .order('anio', { ascending: false });
            if (error) throw error;
            return data as Temporada[];
        },
    });

    const createSeasonMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase
                .from('temporadas')
                .insert([{ nombre: newSeasonName, anio: newSeasonYear, is_active: false }]);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['temporadas'] });
            toast.success('Temporada creada correctamente');
            setNewSeasonName('');
        },
        onError: () => toast.error('Error al crear la temporada')
    });

    const activateSeasonMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('temporadas')
                .update({ is_active: true })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['temporadas'] });
            toast.success('Temporada activada correctamente');
        },
        onError: () => toast.error('Error al activar la temporada')
    });

    if (role !== 'SUPERADMIN' && role !== 'JUNTA') {
        return (
            <div className="p-12 text-center">
                <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 py-4">
            <Card className="border-primary/10 shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Nueva Temporada</CardTitle>
                            <CardDescription>Crea un nuevo ciclo de trabajo para la Hermandad.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            createSeasonMutation.mutate();
                        }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre</Label>
                            <Input
                                id="nombre"
                                placeholder="Ej: Temporada 2024-25"
                                value={newSeasonName}
                                onChange={(e) => setNewSeasonName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="anio">Año Base</Label>
                            <Input
                                id="anio"
                                type="number"
                                value={newSeasonYear}
                                onChange={(e) => setNewSeasonYear(parseInt(e.target.value))}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={createSeasonMutation.isPending} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Crear Temporada
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {isLoading ? (
                    <p>Cargando temporadas...</p>
                ) : temporadas.length === 0 ? (
                    <div className="col-span-2 p-12 bg-white border-2 border-dashed rounded-xl text-center text-muted-foreground">
                        <p>No hay temporadas creadas.</p>
                    </div>
                ) : (
                    temporadas.map((temp) => (
                        <Card
                            key={temp.id}
                            className={cn(
                                "relative transition-all border-2",
                                temp.is_active ? "border-primary shadow-md bg-primary/[0.02]" : "border-slate-100 hover:border-slate-200"
                            )}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{temp.nombre}</CardTitle>
                                        <CardDescription>Año {temp.anio}</CardDescription>
                                    </div>
                                    {temp.is_active ? (
                                        <CheckCircle2 className="w-6 h-6 text-primary" />
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] uppercase font-bold tracking-widest text-primary hover:bg-primary/5"
                                            onClick={() => activateSeasonMutation.mutate(temp.id)}
                                            disabled={activateSeasonMutation.isPending}
                                        >
                                            Activar
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full font-bold",
                                        temp.is_active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {temp.is_active ? 'ACTIVA' : 'INACTIVA'}
                                    </span>
                                    <span className="text-slate-400">Creada el {new Date(temp.created_at).toLocaleDateString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
