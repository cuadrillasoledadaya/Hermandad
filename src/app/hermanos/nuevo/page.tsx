'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createHermano } from '@/lib/brothers';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

import { useAutoScroll } from '@/hooks/use-auto-scroll';

export default function NuevoHermanoPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Auto-scroll para mejorar UX en móviles
    const formRef = useAutoScroll({ block: 'center', delay: 300 });

    const [formData, setFormData] = useState({
        nombre: '',
        apellidos: '',
        email: '',
        telefono: '',
        direccion: '',
        fecha_alta: new Date().toISOString().split('T')[0],
    });

    const mutation = useMutation({
        mutationFn: createHermano,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hermanos'] });
            toast.success('Hermano registrado y censo recalibrado por antigüedad');
            router.push('/hermanos');
        },
        onError: (error: Error) => {
            toast.error('Error al registrar: ' + error.message);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Normalizar strings vacíos a null para evitar problemas en Supabase (ej: email único)
        const cleanData = {
            ...formData,
            email: formData.email.trim() || null,
            telefono: formData.telefono.trim() || null,
            direccion: formData.direccion.trim() || null
        };

        mutation.mutate(cleanData);
    };

    return (
        <div className="max-w-2xl mx-auto py-6">
            <Card className="border-primary/10 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-primary">Alta de Nuevo Hermano</CardTitle>
                    <CardDescription>
                        Completa los datos del nuevo integrante. El número de hermano se asignará automáticamente según su antigüedad.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="nombre">Nombre</Label>
                                <Input
                                    id="nombre"
                                    placeholder="Nombre del hermano"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                    className="border-primary/20 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apellidos">Apellidos</Label>
                                <Input
                                    id="apellidos"
                                    placeholder="Apellidos completos"
                                    value={formData.apellidos}
                                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                                    required
                                    className="border-primary/20 focus-visible:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="telefono">Teléfono</Label>
                                <Input
                                    id="telefono"
                                    type="tel"
                                    placeholder="600 000 000"
                                    value={formData.telefono}
                                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    className="border-primary/20 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="border-primary/20 focus-visible:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="direccion">Dirección</Label>
                            <Input
                                id="direccion"
                                placeholder="Calle, Número, Piso..."
                                value={formData.direccion}
                                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                className="border-primary/20 focus-visible:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fecha_alta">Fecha de Ingreso</Label>
                            <Input
                                id="fecha_alta"
                                type="date"
                                value={formData.fecha_alta}
                                onChange={(e) => setFormData({ ...formData, fecha_alta: e.target.value })}
                                required
                                className="border-primary/20 focus-visible:ring-primary"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={mutation.isPending}
                                className="bg-primary hover:bg-primary/90 min-w-[150px]"
                            >
                                {mutation.isPending ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Registrando...</span>
                                    </div>
                                ) : 'Registrar Hermano'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
