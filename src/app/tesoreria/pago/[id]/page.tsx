'use client';

import { useState, useEffect, use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getHermanoById, getPagosByHermano, deletePago } from '@/lib/brothers';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Wallet, Trash2, Calendar, Euro } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MONTHS_FULL, getActiveSeason, getConceptString } from '@/lib/treasury';

export default function NuevoPagoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const [amount, setAmount] = useState('10');

    // Initial month index in season (Mar=0)
    const realMonth = new Date().getMonth();
    const initialSeasonMonthIdx = (realMonth + 12 - 2) % 12;

    const [selectedMonth, setSelectedMonth] = useState(initialSeasonMonthIdx);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const { data: activeSeason } = useQuery({
        queryKey: ['active-season'],
        queryFn: getActiveSeason,
    });

    // Initialize year when active season is loaded
    useEffect(() => {
        if (activeSeason?.anio && selectedYear === new Date().getFullYear()) {
            setSelectedYear(activeSeason.anio);
        }
    }, [activeSeason, selectedYear]);

    const { data: hermano, isLoading: loadingHermano } = useQuery({
        queryKey: ['hermano', id],
        queryFn: () => getHermanoById(id),
    });

    const { data: pagosBrother = [] } = useQuery({
        queryKey: ['pagos-brother', id],
        queryFn: () => getPagosByHermano(id),
    });

    const paymentMutation = useMutation({
        mutationFn: async () => {
            const conceptoStandard = getConceptString(selectedYear, selectedMonth);

            const { data, error } = await supabase
                .from('pagos')
                .insert([{
                    id_hermano: id,
                    cantidad: parseFloat(amount),
                    concepto: conceptoStandard,
                    anio: selectedYear,
                    fecha_pago: new Date().toISOString().split('T')[0]
                }]);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            queryClient.invalidateQueries({ queryKey: ['pagos-brother', id] });
            toast.success('Pago registrado correctamente');
        },
        onError: () => {
            toast.error('Error al registrar el pago');
        }
    });

    const deletePaymentMutation = useMutation({
        mutationFn: (pagoId: string) => deletePago(pagoId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            queryClient.invalidateQueries({ queryKey: ['pagos-brother', id] });
            toast.success('Pago eliminado correctamente');
        },
        onError: () => {
            toast.error('Error al eliminar el pago');
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
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Cantidad (€)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="text-center text-xl font-bold border-primary/20 focus-visible:ring-primary h-12"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="month">Mes</Label>
                                <select
                                    id="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="flex h-12 w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 appearance-none cursor-pointer"
                                >
                                    {MONTHS_FULL.map((month, idx) => (
                                        <option key={idx} value={idx}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Año</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="border-primary/20 focus-visible:ring-primary h-12 text-center"
                                    required
                                />
                            </div>
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
                                onClick={() => router.push('/tesoreria')}
                                className="w-full"
                            >
                                Volver a Tesorería
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 pt-8 border-t">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            Pagos Recientes
                        </h4>

                        <div className="space-y-3">
                            {pagosBrother.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg italic">
                                    No hay pagos registrados para este hermano.
                                </p>
                            ) : (
                                pagosBrother.slice(0, 5).map((pago) => (
                                    <div key={pago.id} className="flex items-center justify-between p-3 border rounded-lg bg-card group hover:border-primary/30 transition-all">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                                <Euro className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{pago.cantidad}€ <span className="text-xs font-normal text-muted-foreground ml-2">— {pago.concepto}</span></p>
                                                <p className="text-[10px] text-muted-foreground">{format(new Date(pago.fecha_pago), "d 'de' MMMM, yyyy", { locale: es })}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                            onClick={() => {
                                                if (confirm('¿Estás seguro de que deseas eliminar este pago?')) {
                                                    deletePaymentMutation.mutate(pago.id);
                                                }
                                            }}
                                            disabled={deletePaymentMutation.isPending}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
