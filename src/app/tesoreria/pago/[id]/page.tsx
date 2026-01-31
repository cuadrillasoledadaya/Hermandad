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
import { MONTHS_FULL, getActiveSeason, getConceptString, getPendingMonthsForSeason } from '@/lib/treasury';
import { getPreciosConfig } from '@/lib/configuracion';

export default function NuevoPagoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const [overrideAmount, setOverrideAmount] = useState<string | null>(null);
    const [overrideYear, setOverrideYear] = useState<number | null>(null);

    // Initial month index in season (Mar=0)
    const realMonth = new Date().getMonth();
    const initialSeasonMonthIdx = (realMonth + 12 - 2) % 12;

    const [selectedMonth, setSelectedMonth] = useState<number | 'FULL_YEAR'>(initialSeasonMonthIdx);

    const { data: config } = useQuery({
        queryKey: ['configuracion-precios'],
        queryFn: getPreciosConfig,
    });

    const { data: activeSeason } = useQuery({
        queryKey: ['active-season'],
        queryFn: getActiveSeason,
    });

    const fee = config?.cuota_mensual_hermano ?? 1.8;
    const amount = overrideAmount ?? (selectedMonth === 'FULL_YEAR' ? (fee * 12).toString() : fee.toString());
    const selectedYear = overrideYear ?? activeSeason?.anio ?? new Date().getFullYear();

    const numMonthsDetected = Math.floor(parseFloat(amount) / fee) || 0;

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
            const monthsToPay: number[] = [];

            if (selectedMonth === 'FULL_YEAR') {
                for (let i = 0; i < 12; i++) monthsToPay.push(i);
            } else {
                // Smart assignment logic
                const pending = getPendingMonthsForSeason(hermano!, pagosBrother, selectedYear);

                // Always include the selected month if it's not already paid (or even if it is, as per user requirement)
                let remainingMonths = numMonthsDetected;

                // If the selected month is pending, we prioritize it as requested: "asigne como pagadas el mes que se selecione"
                if (!monthsToPay.includes(selectedMonth)) {
                    monthsToPay.push(selectedMonth);
                    remainingMonths--;
                }

                // Fill with pending/arrears
                for (const m of pending) {
                    if (remainingMonths <= 0) break;
                    if (!monthsToPay.includes(m)) {
                        monthsToPay.push(m);
                        remainingMonths--;
                    }
                }

                // If still months left, fill with next months
                let nextMonth = selectedMonth + 1;
                while (remainingMonths > 0 && nextMonth < 12) {
                    if (!monthsToPay.includes(nextMonth)) {
                        monthsToPay.push(nextMonth);
                        remainingMonths--;
                    }
                    nextMonth++;
                }
            }

            // Create insertion records
            const records = monthsToPay.map(mIdx => ({
                id_hermano: id,
                cantidad: fee, // We split the total into individual 1-month payments for audit Trail
                concepto: getConceptString(selectedYear, mIdx),
                anio: selectedYear,
                fecha_pago: new Date().toISOString().split('T')[0]
            }));

            const { error } = await supabase
                .from('pagos')
                .insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            queryClient.invalidateQueries({ queryKey: ['pagos-brother', id] });
            queryClient.invalidateQueries({ queryKey: ['hermano-status'] });
            setOverrideAmount(null);
            setOverrideYear(null);
            toast.success('Pago(s) registrado(s) correctamente');
        },
        onError: (error: Error) => {
            toast.error('Error al registrar el pago: ' + error.message);
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

        if (selectedMonth === 'FULL_YEAR' && parseFloat(amount) < (fee * 12)) {
            toast.error(`El importe para año completo debe ser al menos ${(fee * 12).toFixed(2)}€`);
            return;
        }

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
                                step="0.10"
                                value={amount}
                                onChange={(e) => setOverrideAmount(e.target.value)}
                                className="text-center text-xl font-bold border-primary/20 focus-visible:ring-primary h-12"
                                required
                            />
                            {numMonthsDetected > 0 && (
                                <p className="text-center text-xs text-primary font-medium bg-primary/5 py-1 rounded-full animate-in fade-in slide-in-from-top-1">
                                    ✨ Cubre {numMonthsDetected} {numMonthsDetected === 1 ? 'mes' : 'meses'} de cuota
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="month">Periodo</Label>
                                <select
                                    id="month"
                                    value={selectedMonth}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedMonth(val === 'FULL_YEAR' ? 'FULL_YEAR' : parseInt(val));
                                        setOverrideAmount(null); // Reset to automatic calculation based on selection
                                    }}
                                    className="flex h-12 w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 appearance-none cursor-pointer"
                                >
                                    {MONTHS_FULL.map((month, idx) => (
                                        <option key={idx} value={idx}>{month}</option>
                                    ))}
                                    <option value="" disabled className="border-t">——————</option>
                                    <option value="FULL_YEAR" className="font-bold text-primary">📅 AÑO COMPLETO</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Año</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    value={selectedYear}
                                    onChange={(e) => setOverrideYear(parseInt(e.target.value))}
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
