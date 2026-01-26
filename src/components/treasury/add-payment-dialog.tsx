'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AddPaymentProps {
    id_hermano: string;
    nombre_hermano: string;
}

export function AddPaymentDialog({ id_hermano, nombre_hermano }: AddPaymentProps) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('10');
    const [concepto, setConcepto] = useState('');
    const queryClient = useQueryClient();

    const paymentMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase
                .from('pagos')
                .insert([{
                    id_hermano,
                    cantidad: parseFloat(amount),
                    concepto: concepto || `Cuota ${new Date().getFullYear()}`,
                    anio: new Date().getFullYear(),
                    fecha_pago: new Date().toISOString().split('T')[0]
                }]);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            toast.success('Pago registrado correctamente');
            setOpen(false);
        },
        onError: () => {
            toast.error('Error al registrar el pago');
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10">
                    <PlusCircle className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Pago: {nombre_hermano}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Cantidad (€)</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="concepto">Concepto</Label>
                        <Input
                            id="concepto"
                            placeholder="Ej. Cuota Ene-Feb"
                            value={concepto}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConcepto(e.target.value)}
                        />
                    </div>
                    <Button
                        className="w-full"
                        onClick={() => paymentMutation.mutate()}
                        disabled={paymentMutation.isPending}
                    >
                        {paymentMutation.isPending ? 'Registrando...' : 'Confirmar Pago'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
