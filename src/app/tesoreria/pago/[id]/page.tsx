'use client';

import { useState, use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getHermanoById } from '@/lib/brothers';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';

export default function NuevoPagoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const [amount, setAmount] = useState('10');
    const [concepto, setConcepto] = useState('');

    const { data: hermano, isLoading: loadingHermano } = useQuery({
        queryKey: ['hermano', id],
        queryFn: () => getHermanoById(id),
    });

    const paymentMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase
                .from('pagos')
                .insert([{
                    id_hermano: id,
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
            router.push('/tesoreria');
        },
        onError: () => {
            toast.error('Error al registrar el pago');
        }
    });

    if (loadingHermano) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!hermano) return <div>Hermano no encontrado</div>;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        paymentMutation.mutate();
    };

    return (
        <div className="max-w-md mx-auto py-6">
            <Card className="border-primary/10 shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Wallet className="text-primary w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Registrar Pago</CardTitle>
                    <CardDescription>
                        Hermano: <span className="font-semibold text-foreground">{hermano.nombre} {hermano.apellidos}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Cantidad (€)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="text-center text-xl font-bold border-primary/20 focus-visible:ring-primary"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="concepto">Concepto</Label>
                            <Input
                                id="concepto"
                                placeholder={`Ej. Cuota ${new Date().toLocaleString('es-ES', { month: 'long' })}`}
                                value={concepto}
                                onChange={(e) => setConcepto(e.target.value)}
                                className="border-primary/20 focus-visible:ring-primary"
                            />
                        </div>

                        <div className="flex flex-col gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={paymentMutation.isPending}
                                className="w-full bg-primary hover:bg-primary/90 h-12 text-lg"
                            >
                                {paymentMutation.isPending ? 'Procesando...' : 'Confirmar Cobro'}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.back()}
                                className="w-full"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
