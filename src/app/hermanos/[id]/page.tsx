'use client';

import { useState, use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHermanoById, updateHermano, deleteHermano, type Hermano } from '@/lib/brothers';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function FichaHermanoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: hermano, isLoading } = useQuery({
        queryKey: ['hermano', id],
        queryFn: () => getHermanoById(id),
    });

    const [formData, setFormData] = useState({
        nombre: '',
        apellidos: '',
        email: '',
        telefono: '',
        direccion: '',
        fecha_alta: '',
        activo: true,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    if (hermano && !isInitialized) {
        setFormData({
            nombre: hermano.nombre,
            apellidos: hermano.apellidos,
            email: hermano.email || '',
            telefono: hermano.telefono || '',
            direccion: hermano.direccion || '',
            fecha_alta: hermano.fecha_alta,
            activo: hermano.activo,
        });
        setIsInitialized(true);
    }

    const updateMutation = useMutation({
        mutationFn: (updates: Partial<Hermano>) => updateHermano(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hermanos'] });
            queryClient.invalidateQueries({ queryKey: ['hermano', id] });
            toast.success('Datos actualizados correctamente');
            setIsEditing(false);
        },
        onError: (error: Error) => {
            toast.error('Error al actualizar: ' + error.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteHermano(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hermanos'] });
            toast.success('Hermano eliminado y censo recalibrado');
            router.push('/hermanos');
        },
        onError: (error: Error) => {
            toast.error('Error al eliminar: ' + error.message);
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!hermano) return <div className="p-8 text-center text-muted-foreground">Hermano no encontrado</div>;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    return (
        <div className="max-w-2xl mx-auto py-6 px-4">
            <Card className="border-primary/10 shadow-lg overflow-hidden">
                <CardHeader className="bg-primary/5 border-b pb-8">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                {hermano.nombre[0]}{hermano.apellidos[0]}
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-bold">{hermano.nombre} {hermano.apellidos}</CardTitle>
                                <CardDescription className="flex items-center mt-1">
                                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-bold mr-2">
                                        Nº {hermano.numero_hermano || '---'}
                                    </span>
                                    {hermano.activo ? 'Activo' : 'Baja'}
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción eliminará al hermano del censo permanentemente. Los números de los demás hermanos se recalibrarán automáticamente.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700">
                                            Eliminar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            {!isEditing && (
                                <Button onClick={() => setIsEditing(true)} variant="outline">
                                    Editar Perfil
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="nombre">Nombre</Label>
                                <Input
                                    id="nombre"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                    disabled={!isEditing}
                                    className={cn("border-primary/20", !isEditing && "bg-muted/50 cursor-not-allowed border-transparent")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apellidos">Apellidos</Label>
                                <Input
                                    id="apellidos"
                                    value={formData.apellidos}
                                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                                    required
                                    disabled={!isEditing}
                                    className={cn("border-primary/20", !isEditing && "bg-muted/50 cursor-not-allowed border-transparent")}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="telefono">Teléfono</Label>
                                <Input
                                    id="telefono"
                                    type="tel"
                                    value={formData.telefono}
                                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    disabled={!isEditing}
                                    className={cn("border-primary/20", !isEditing && "bg-muted/50 cursor-not-allowed border-transparent")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    disabled={!isEditing}
                                    className={cn("border-primary/20", !isEditing && "bg-muted/50 cursor-not-allowed border-transparent")}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="direccion">Dirección</Label>
                            <Input
                                id="direccion"
                                value={formData.direccion}
                                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                disabled={!isEditing}
                                className={cn("border-primary/20", !isEditing && "bg-muted/50 cursor-not-allowed border-transparent")}
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
                                disabled={!isEditing}
                                className={cn("border-primary/20", !isEditing && "bg-muted/50 cursor-not-allowed border-transparent")}
                            />
                        </div>

                        {isEditing && (
                            <div className="flex justify-end gap-3 pt-4 animate-in fade-in slide-in-from-bottom-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsEditing(false);
                                        // Reset form data to original values
                                        if (hermano) {
                                            setFormData({
                                                nombre: hermano.nombre,
                                                apellidos: hermano.apellidos,
                                                email: hermano.email || '',
                                                telefono: hermano.telefono || '',
                                                direccion: hermano.direccion || '',
                                                fecha_alta: hermano.fecha_alta,
                                                activo: hermano.activo,
                                            });
                                        }
                                    }}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="min-w-[150px]"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
