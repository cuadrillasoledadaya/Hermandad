'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { agregarPosicion, type NuevaPosicion } from '@/lib/cortejo-admin';
import type { PosicionTipo, Lado } from '@/lib/cortejo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddPosicionDialogProps {
    tramoInicial?: number;
}

export function AddPosicionDialog({ tramoInicial = 1 }: AddPosicionDialogProps) {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState<NuevaPosicion>({
        nombre: '',
        tipo: 'vara',
        tramo: tramoInicial,
        posicion: 1,
        lado: 'centro'
    });
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => agregarPosicion(formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cortejo-admin'] });
            toast.success('Posición añadida correctamente');
            setOpen(false);
            setFormData({ nombre: '', tipo: 'vara', tramo: tramoInicial, posicion: 1, lado: 'centro' });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Error al añadir posición');
        }
    });

    const updateForm = (key: keyof NuevaPosicion, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#1a2b4b] hover:bg-[#2a3b5b] text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Posición
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white">
                <DialogHeader>
                    <DialogTitle>Añadir Posición Individual</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={formData.tipo} onValueChange={(v) => updateForm('tipo', v as PosicionTipo)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vara">🎋 Vara</SelectItem>
                                    <SelectItem value="insignia">🚩 Insignia</SelectItem>
                                    <SelectItem value="bocina">📯 Bocina</SelectItem>
                                    <SelectItem value="nazareno">👤 Nazareno</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Tramo</Label>
                            <Select value={formData.tramo.toString()} onValueChange={(v) => updateForm('tramo', Number(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Cruz de Guía</SelectItem>
                                    <SelectItem value="1">Tramo 1</SelectItem>
                                    <SelectItem value="2">Tramo 2</SelectItem>
                                    <SelectItem value="3">Tramo 3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                            placeholder="Ej: Vara 4A, Bocina 3 Vera Cruz..."
                            value={formData.nombre}
                            onChange={(e) => updateForm('nombre', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Posición (orden)</Label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={formData.posicion}
                                onChange={(e) => updateForm('posicion', Number(e.target.value))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Lado</Label>
                            <Select value={formData.lado} onValueChange={(v) => updateForm('lado', v as Lado)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="centro">Centro</SelectItem>
                                    <SelectItem value="izquierda">Izquierda</SelectItem>
                                    <SelectItem value="derecha">Derecha</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-[#1a2b4b] hover:bg-[#2a3b5b] text-white"
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending || !formData.nombre}
                        >
                            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Añadir
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
