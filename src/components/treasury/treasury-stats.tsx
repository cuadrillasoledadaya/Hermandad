'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getHermanos, type Pago } from '@/lib/brothers';
import { getActiveSeason, getMonthStatusForYear, MONTHS } from '@/lib/treasury';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from '@/lib/utils';

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
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pagos')
                .select('*')
                .eq('anio', effectiveYear);
            if (error) throw error;
            return data as Pago[];
        },
    });

    if (loadingSeason || loadingHermanos || loadingPagos) {
        return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-pulse">
                {[1, 2].map((i) => (
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
        </div>
    );
}
