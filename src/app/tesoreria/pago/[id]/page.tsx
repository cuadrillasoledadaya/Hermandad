'use client';

import { useState, use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHermanoById, getPagosByHermano, deletePago } from '@/lib/brothers';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showError, showSuccess } from '@/lib/error-handler';
import { offlineInsert } from '@/lib/offline-mutation';
import { addPagoLocal } from '@/lib/db';
import { Wallet, Trash2, Calendar, Euro, Check } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { MONTHS_FULL, getActiveSeason, getConceptString, getPendingMonthsForSeason, getCalendarMonthAndYear } from '@/lib/treasury';
import { cn } from '@/lib/utils';
import { getPreciosConfig } from '@/lib/configuracion';

export default function NuevoPagoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const [overrideAmount, setOverrideAmount] = useState<string | null>(null);
    const [overrideYear, setOverrideYear] = useState<number | null>(null);

    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);

    const { data: config } = useQuery({
        queryKey: ['configuracion-precios'],
        queryFn: getPreciosConfig,
    });

    const { data: activeSeason } = useQuery({
        queryKey: ['active-season'],
        queryFn: getActiveSeason,
    });

    const fee = config?.cuota_mensual_hermano ?? 1.8;
    const selectedYear = overrideYear ?? activeSeason?.anio ?? new Date().getFullYear();

    const { data: hermano, isLoading: loadingHermano } = useQuery({
        queryKey: ['hermano', id],
        queryFn: () => getHermanoById(id),
    });

    const { data: pagosBrother = [] } = useQuery({
        queryKey: ['pagos-brother', id],
        queryFn: () => getPagosByHermano(id),
    });

    // Auto-calculate amount based on selected months
    const autoAmount = (selectedMonths.length * fee).toFixed(2);
    const amount = overrideAmount ?? autoAmount;

    const toggleMonth = (idx: number) => {
        setSelectedMonths(prev =>
            prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx].sort((a, b) => a - b)
        );
        setOverrideAmount(null);
    };

    const selectAllPending = () => {
        if (!hermano) return;
        const pending = getPendingMonthsForSeason(hermano, pagosBrother, selectedYear);
        setSelectedMonths(pending);
        setOverrideAmount(null);
    };

    const paymentMutation = useMutation({
        mutationFn: async () => {
            if (selectedMonths.length === 0) throw new Error('Selecciona al menos un mes');

            // Create insertion records
            const records = selectedMonths.map(mIdx => ({
                id_hermano: id,
                cantidad: fee,
                concepto: getConceptString(selectedYear, mIdx),
                anio: selectedYear,
                fecha_pago: new Date().toISOString().split('T')[0]
            }));

            const { offline, error, data } = await offlineInsert('pagos', records);

            if (!offline && error) throw new Error(error);

            // Si es offline, guardamos en el store local para que la UI se actualice
            if (offline) {
                for (const record of records) {
                    await addPagoLocal({
                        ...record,
                        id: crypto.randomUUID(), // ID temporal para la UI
                        offline: true
                    });
                }
            }

            return { offline, data };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['pagos-brother', id] });
            queryClient.invalidateQueries({ queryKey: ['hermano-status'] });
            setSelectedMonths([]);
            setOverrideAmount(null);
            setOverrideYear(null);

            if (result.offline) {
                showSuccess('Pago guardado (Modo Offline)', 'Se sincronizará cuando vuelvas a tener conexión');
            } else {
                showSuccess('¡Cobro registrado!', 'Los pagos se han guardado correctamente');
            }
        },
        onError: (error: Error) => {
            showError('Error al registrar el pago', error);
        }
    });

    const deletePaymentMutation = useMutation({
        mutationFn: (pagoId: string) => deletePago(pagoId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pagos-brother', id] });
            showSuccess('Pago eliminado');
        },
        onError: () => {
            showError('Error al eliminar el pago');
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
        if (selectedMonths.length === 0) {
            showError('Atención', 'Selecciona al menos un mes para cobrar');
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
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-bold">Meses de la Temporada</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={selectAllPending}
                                    className="text-[10px] h-7 bg-primary/5 hover:bg-primary/10 border-primary/20"
                                >
                                    Elegir Todo lo Pendiente
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-2 border rounded-xl bg-slate-50/50 custom-scrollbar">
                                {MONTHS_FULL.map((month, idx) => {
                                    const { calendarMonth, calendarYear } = getCalendarMonthAndYear(selectedYear, idx);
                                    const cellDate = startOfMonth(new Date(calendarYear, calendarMonth));
                                    const altaDate = startOfMonth(new Date(hermano.fecha_alta));

                                    // Skip if before alta
                                    if (cellDate < altaDate) return null;

                                    // Check status
                                    const isPaid = pagosBrother.some(p => {
                                        const shortMonth = month.substring(0, 3);
                                        return p.anio === selectedYear && p.concepto.includes(shortMonth);
                                    });

                                    // If paid, hide from select as requested
                                    if (isPaid) return null;

                                    const isSelected = selectedMonths.includes(idx);

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => toggleMonth(idx)}
                                            className={cn(
                                                "flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                                                isSelected
                                                    ? "bg-primary/5 border-primary/30 shadow-sm"
                                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-7 h-7 rounded-xl border-[3.5px] flex items-center justify-center transition-all flex-shrink-0",
                                                isSelected
                                                    ? "bg-slate-900 border-slate-900"
                                                    : "bg-white border-slate-900"
                                            )}>
                                                {isSelected && <Check className="w-5 h-5 text-white stroke-[3.5]" />}
                                            </div>
                                            <span className={cn(
                                                "text-sm font-semibold leading-none",
                                                isSelected ? "text-slate-900" : "text-slate-700"
                                            )}>{month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="year">Año Temporada</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    value={selectedYear}
                                    onChange={(e) => setOverrideYear(parseInt(e.target.value))}
                                    className="border-primary/20 focus-visible:ring-primary h-12 text-center"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Total a Cobrar (€)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.10"
                                    value={amount}
                                    onChange={(e) => setOverrideAmount(e.target.value)}
                                    className="text-center text-xl font-bold border-primary/20 focus-visible:ring-primary h-12"
                                    required
                                />
                            </div>
                        </div>

                        {selectedMonths.length > 0 && (
                            <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 animate-in fade-in zoom-in-95">
                                <p className="text-xs text-center text-slate-600">
                                    Se registrarán <span className="font-bold text-primary">{selectedMonths.length} cuotas</span> por un total de <span className="font-bold text-primary">{amount}€</span>.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                type="submit"
                                disabled={paymentMutation.isPending || selectedMonths.length === 0}
                                className="w-full bg-primary hover:bg-primary/90 h-12 text-lg font-bold shadow-lg shadow-primary/20"
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
