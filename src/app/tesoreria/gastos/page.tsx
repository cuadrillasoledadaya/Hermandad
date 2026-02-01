'use client';

import { AddExpenseDialog } from '@/components/treasury/add-expense-dialog';
import { ExpensesList } from '@/components/treasury/expenses-list';
import { useAuth } from '@/components/providers/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { getCurrentMonthExpenseStats, getPreviousMonthExpenseStats, getAverageMonthlyExpenses } from '@/lib/expenses';
import { Card } from '@/components/ui/card';
import { TrendingDown, Calendar, BarChart3, ArrowLeftRight } from 'lucide-react';

export default function GastosPage() {
    const { role } = useAuth();
    const canAddExpense = role === 'SUPERADMIN' || role === 'JUNTA';

    const { data: currentMonthStats } = useQuery({
        queryKey: ['expense-stats-current-month'],
        queryFn: getCurrentMonthExpenseStats,
    });

    const { data: previousMonthStats } = useQuery({
        queryKey: ['expense-stats-previous-month'],
        queryFn: getPreviousMonthExpenseStats,
    });

    const { data: averageMonthly } = useQuery({
        queryKey: ['expense-average-monthly'],
        queryFn: () => getAverageMonthlyExpenses(3),
    });

    // Obtener nombre del mes actual y anterior
    const currentMonthName = new Date().toLocaleDateString('es-ES', { month: 'long' });
    const previousMonthName = new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('es-ES', { month: 'long' });

    // Obtener la categoría con mayor gasto del mes actual
    const topCategory = currentMonthStats?.byCategory && Object.entries(currentMonthStats.byCategory).reduce((max, [cat, val]) =>
        val > (currentMonthStats.byCategory[max as keyof typeof currentMonthStats.byCategory] || 0) ? cat : max, 'Otros'
    );

    return (
        <div className="space-y-6">
            {/* Header con botón */}
            <div className="flex justify-end">
                {canAddExpense && <AddExpenseDialog />}
            </div>

            {/* Estadísticas compactas - 4 bocadillos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Mes Actual */}
                <Card className="p-3 bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-red-600" />
                        <p className="text-[10px] font-bold uppercase text-red-700 tracking-wider">
                            {currentMonthName}
                        </p>
                    </div>
                    <p className="text-2xl font-black text-red-600">
                        {currentMonthStats?.total.toFixed(2) || '0.00'}€
                    </p>
                    <p className="text-[10px] text-red-600/70 mt-0.5">
                        {currentMonthStats?.count || 0} gastos
                    </p>
                </Card>

                {/* Mes Anterior */}
                <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                        <p className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">
                            {previousMonthName}
                        </p>
                    </div>
                    <p className="text-2xl font-black text-blue-600">
                        {previousMonthStats?.total.toFixed(2) || '0.00'}€
                    </p>
                    <p className="text-[10px] text-blue-600/70 mt-0.5">
                        {previousMonthStats?.count || 0} gastos
                    </p>
                </Card>

                {/* Promedio Mensual */}
                <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-3.5 h-3.5 text-green-600" />
                        <p className="text-[10px] font-bold uppercase text-green-700 tracking-wider">
                            Promedio 3M
                        </p>
                    </div>
                    <p className="text-2xl font-black text-green-600">
                        {averageMonthly?.toFixed(2) || '0.00'}€
                    </p>
                    <p className="text-[10px] text-green-600/70 mt-0.5">
                        últimos 3 meses
                    </p>
                </Card>

                {/* Mayor Categoría del Mes */}
                <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-3.5 h-3.5 text-purple-600" />
                        <p className="text-[10px] font-bold uppercase text-purple-700 tracking-wider">
                            Top Categoría
                        </p>
                    </div>
                    <p className="text-lg font-black text-purple-600 truncate">
                        {topCategory || 'N/A'}
                    </p>
                    <p className="text-[10px] text-purple-600/70 mt-0.5">
                        {currentMonthStats?.byCategory?.[topCategory as keyof typeof currentMonthStats.byCategory]?.toFixed(2) || '0.00'}€
                    </p>
                </Card>
            </div>

            <ExpensesList />
        </div>
    );
}
