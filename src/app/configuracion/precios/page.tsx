'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Euro, Save, Loader2, BadgeInfo } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

interface PreciosConfig {
    id: number;
    cuota_mensual_hermano: number;
    papeleta_nazareno: number;
    papeleta_costalero: number;
    papeleta_insignia: number;
    papeleta_vara: number;
    papeleta_bocina: number;
    papeleta_cruz_guia: number;
}

export default function PreciosPage() {
    const { role } = useAuth();
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<Partial<PreciosConfig>>({});

    const { data: config, isLoading } = useQuery<PreciosConfig>({
        queryKey: ['configuracion-precios'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('configuracion_precios')
                .select('*')
                .eq('id', 1)
                .single();
            if (error) throw error;
            return data as PreciosConfig;
        },
    });


    const updatePricesMutation = useMutation({
        mutationFn: async (newData: Partial<PreciosConfig>) => {
            const { error } = await supabase
                .from('configuracion_precios')
                .update(newData)
                .eq('id', 1);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configuracion-precios'] });
            setDraft({}); // Clear draft on success
            toast.success('Precios actualizados correctamente');
        },
        onError: (error: Error) => {
            toast.error('Error al actualizar precios: ' + error.message);
        }
    });

    if (role !== 'SUPERADMIN' && role !== 'JUNTA') {
        return (
            <div className="p-12 text-center">
                <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
            </div>
        );
    }

    const handleChange = (field: keyof PreciosConfig, value: string) => {
        setDraft(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const getValue = (field: keyof PreciosConfig) => {
        if (draft[field] !== undefined) return draft[field];
        return config?.[field] ?? 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalData = { ...config, ...draft };
        updatePricesMutation.mutate(finalData);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                    <Euro className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configuración de Precios</h1>
                    <p className="text-slate-500 text-sm">Establece los importes fijos para cuotas y papeletas de sitio.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="border-amber-100 shadow-sm">
                    <CardHeader className="bg-amber-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
                            <BadgeInfo className="w-5 h-5" />
                            Cuota de Hermano
                        </CardTitle>
                        <CardDescription>Importe mensual que deben abonar los hermanos.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="max-w-xs space-y-2">
                            <Label htmlFor="cuota_mensual">Importe Mensual (€)</Label>
                            <div className="relative">
                                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    id="cuota_mensual"
                                    type="number"
                                    step="0.01"
                                    className="pl-10 text-lg font-bold"
                                    value={getValue('cuota_mensual_hermano')}
                                    onChange={(e) => handleChange('cuota_mensual_hermano', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg">Papeletas de Sitio</CardTitle>
                        <CardDescription>Precios por categoría para la salida procesional.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label>Nazareno (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={getValue('papeleta_nazareno')}
                                    onChange={(e) => handleChange('papeleta_nazareno', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Costalero (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={getValue('papeleta_costalero')}
                                    onChange={(e) => handleChange('papeleta_costalero', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Vara (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={getValue('papeleta_vara')}
                                    onChange={(e) => handleChange('papeleta_vara', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Insignia (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={getValue('papeleta_insignia')}
                                    onChange={(e) => handleChange('papeleta_insignia', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Bocina (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={getValue('papeleta_bocina')}
                                    onChange={(e) => handleChange('papeleta_bocina', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cruz de Guía (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={getValue('papeleta_cruz_guia')}
                                    onChange={(e) => handleChange('papeleta_cruz_guia', e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button
                        type="submit"
                        className="bg-primary hover:bg-primary/90 px-8 h-12 text-lg"
                        disabled={updatePricesMutation.isPending || isLoading}
                    >
                        {updatePricesMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                            <Save className="w-5 h-5 mr-2" />
                        )}
                        Guardar Cambios
                    </Button>
                </div>
            </form>
        </div>
    );
}
