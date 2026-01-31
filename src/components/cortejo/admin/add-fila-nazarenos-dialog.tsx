'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { agregarFilaNazarenos } from '@/lib/cortejo-admin';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddFilaNazarenosDialogProps {
    tramoInicial?: number;
}

export function AddFilaNazarenosDialog({ tramoInicial = 1 }: AddFilaNazarenosDialogProps) {
    const [open, setOpen] = useState(false);
    const [tramo, setTramo] = useState(tramoInicial);
    const [numeroFila, setNumeroFila] = useState(11);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => agregarFilaNazarenos(tramo, numeroFila),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cortejo-admin'] });
            toast.success(`Fila ${numeroFila} añadida correctamente`);
            setOpen(false);
            setNumeroFila(numeroFila + 1);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Error al añadir fila');
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Fila de Nazarenos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white">
                <DialogHeader>
                    <DialogTitle>Añadir Fila de Nazarenos</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tramo</Label>
                        <Select value={tramo.toString()} onValueChange={(v) => setTramo(Number(v))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Tramo 1</SelectItem>
                                <SelectItem value="2">Tramo 2</SelectItem>
                                <SelectItem value="3">Tramo 3</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Número de Fila</Label>
                        <Input
                            type="number"
                            min="1"
                            max="50"
                            value={numeroFila}
                            onChange={(e) => setNumeroFila(Number(e.target.value))}
                        />
                        <p className="text-xs text-slate-500">
                            Se crearán: Nazareno Fila {numeroFila} Izquierda + Derecha
                        </p>
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Crear Fila
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
