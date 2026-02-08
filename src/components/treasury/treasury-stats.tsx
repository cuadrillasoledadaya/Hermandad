'use client';

import { useQuery } from '@tanstack/react-query';
import { getHermanos, type Pago, getPagosDelAnio } from '@/lib/brothers';
import { getActiveSeason, getMonthStatusForYear, MONTHS } from '@/lib/treasury';
import { getCurrentMonthExpenseStats } from '@/lib/expenses';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign } from 'lucide-react';

export function TreasuryStats() {
    const { data: activeSeason, isLoading: loadingSeason } = useQuery({
        queryKey: ['active-season'],
        queryFn: getActiveSeason,
    });

    const effectiveYear = activeSeason?.anio || new Date().getFullYear();

    const { data: hermanos = [], isLoading: loadingHermanos } = useQuery({
        queryKey: ['hermanos'],
        queryFn: getHermanos,
    });

    const { data: pagos = [], isLoading: loadingPagos } = useQuery<Pago[]>({
        queryKey: ['pagos', effectiveYear],
        queryFn: () => getPagosDelAnio(effectiveYear),
    });

    const { data: expenseStats, isLoading: loadingExpenses } = useQuery({
        queryKey: ['expense-stats-current-month'],
        queryFn: getCurrentMonthExpenseStats,
    });

    if (loadingSeason || loadingHermanos || loadingPagos || loadingExpenses) {
        return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-slate-100 rounded-xl" />
                ))}
            </div>
        );
    }

    const realMonth = new Date().getMonth();
    const currentSeasonMonthIndex = (realMonth + 12 - 2) % 12;

    const stats = hermanos.reduce((acc, hermano) => {
        const brotherPagos = pagos.filter(p => p.id_hermano === hermano.id);
        const isOverdue = MONTHS.slice(0, currentSeasonMonthIndex + 1).some((_, idx) =>
            getMonthStatusForYear(hermano, brotherPagos, effectiveYear, idx) !== 'PAID'
        );

        if (isOverdue) {
            acc.overdue++;
        } else {
            acc.paid++;
        }
        return acc;
    }, { paid: 0, overdue: 0 });

    const total = hermanos.length || 1;
    const paidPercentage = Math.round((stats.paid / total) * 100);
    const overduePercentage = Math.round((stats.overdue / total) * 100);

    // Calcular ingresos del mes actual (solo cuotas)
    const now = new Date();
    const thisMonthPagos = pagos.filter(p => {
        const pagoDate = new Date(p.fecha_pago);
        return pagoDate.getMonth() === now.getMonth() && pagoDate.getFullYear() === now.getFullYear();
    });
    const monthlyIncome = thisMonthPagos.reduce((sum, p) => sum + Number(p.cantidad), 0);

    // Gastos del mes (desde expenseStats)
    const monthlyExpenses = expenseStats?.total || 0;

    // Balance neto
    const netBalance = monthlyIncome - monthlyExpenses;

    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="bg-green-50/50 border-green-100 shadow-sm">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold uppercase text-green-700 tracking-wider">Al día</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-3xl font-black text-green-600">{paidPercentage}%</div>
                    <p className="text-[10px] text-green-600/60 font-medium mt-1">{stats.paid} hermanos</p>
                </CardContent>
            </Card>

            <Card className="bg-red-50/50 border-red-100 shadow-sm">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold uppercase text-red-700 tracking-wider">Cuotas Pendientes</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-3xl font-black text-red-600">{overduePercentage}%</div>
                    <p className="text-[10px] text-red-600/60 font-medium mt-1">{stats.overdue} hermanos</p>
                </CardContent>
            </Card>

            <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold uppercase text-blue-700 tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Ingresos Mes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-3xl font-black text-blue-600">{monthlyIncome.toFixed(2)}€</div>
                    <p className="text-[10px] text-blue-600/60 font-medium mt-1">{thisMonthPagos.length} pagos</p>
                </CardContent>
            </Card>

            <Card className={`shadow-sm ${netBalance >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50/50 border-orange-100'}`}>
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${netBalance >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                        <DollarSign className="w-3 h-3" />
                        Balance Neto
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className={`text-3xl font-black ${netBalance >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}€
                    </div>
                    <p className={`text-[10px] font-medium mt-1 ${netBalance >= 0 ? 'text-emerald-600/60' : 'text-orange-600/60'}`}>
                        Gastos: {monthlyExpenses.toFixed(2)}€
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
