'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { venderPapeleta, TIPOS_PAPELETA, TipoPapeleta, PRECIO_PAPELETA_DEFAULT } from '@/lib/papeletas-cortejo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Receipt, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function VenderPapeletaDialog() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'hermano' | 'detalles'>('hermano');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedHermano, setSelectedHermano] = useState<any>(null);
    const [tipo, setTipo] = useState<TipoPapeleta>('nazareno');
    const [importe, setImporte] = useState(PRECIO_PAPELETA_DEFAULT);

    const queryClient = useQueryClient();

    // Buscar hermanos
    const { data: hermanos, isLoading: loadingHermanos } = useQuery({
        queryKey: ['hermanos-search', searchTerm],
        queryFn: async () => {
            if (searchTerm.length < 2) return [];
            const { data } = await supabase
                .from('hermanos')
                .select('id, nombre, apellidos')
                .or(`nombre.ilike.%${searchTerm}%,apellidos.ilike.%${searchTerm}%`)
                .limit(5);
            return data || [];
        },
        enabled: searchTerm.length >= 2,
    });

    const venderMutation = useMutation({
        mutationFn: venderPapeleta,
        onSuccess: (papeleta) => {
            queryClient.invalidateQueries({ queryKey: ['papeletas-cortejo'] });
            queryClient.invalidateQueries({ queryKey: ['cortejo-stats'] });
            toast.success(`Papeleta #${papeleta.numero} vendida correctamente`);
            setOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            console.error('Error al vender papeleta:', error);
            toast.error(error.message || 'Error al procesar la venta');
        },
    });

    const resetForm = () => {
        setStep('hermano');
        setSearchTerm('');
        setSelectedHermano(null);
        setTipo('nazareno');
        setImporte(PRECIO_PAPELETA_DEFAULT);
    };

    const handleSelectHermano = (hermano: any) => {
        setSelectedHermano(hermano);
        setStep('detalles');
    };

    const handleSubmit = () => {
        if (!selectedHermano) return;

        venderMutation.mutate({
            id_hermano: selectedHermano.id,
            tipo,
            importe: Number(importe)
        });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button className="bg-[#1a2b4b] hover:bg-[#2a3b5b] text-white">
                    <Receipt className="w-4 h-4 mr-2" />
                    Vender Papeleta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white">
                <DialogHeader>
                    <DialogTitle>Venta de Papeleta de Sitio</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {step === 'hermano' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Buscar Hermano</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nombre o Apellidos..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="min-h-[200px] border rounded-md p-2 space-y-1">
                                {loadingHermanos ? (
                                    <div className="flex justify-center p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : hermanos?.length === 0 && searchTerm.length >= 2 ? (
                                    <p className="text-sm text-center text-muted-foreground p-4">
                                        No se encontraron hermanos con ese nombre.
                                    </p>
                                ) : hermanos?.map((hermano) => (
                                    <button
                                        key={hermano.id}
                                        onClick={() => handleSelectHermano(hermano)}
                                        className="w-full text-left p-3 hover:bg-slate-50 rounded-md transition-colors flex items-center justify-between group"
                                    >
                                        <span className="font-medium">
                                            {hermano.nombre} {hermano.apellidos}
                                        </span>
                                        <UserPlus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                                {searchTerm.length < 2 && (
                                    <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                                        <Search className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">Escribe para buscar...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-md border flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Hermano</p>
                                    <p className="font-medium text-lg">{selectedHermano.nombre} {selectedHermano.apellidos}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setStep('hermano')}>
                                    Cambiar
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Sitio</Label>
                                    <Select
                                        value={tipo}
                                        onValueChange={(val) => setTipo(val as TipoPapeleta)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(TIPOS_PAPELETA).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Importe (€)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={importe}
                                        onChange={(e) => setImporte(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={handleSubmit}
                                    disabled={venderMutation.isPending}
                                >
                                    {venderMutation.isPending && (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    )}
                                    Confirmar Venta
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
