'use client';

import { AddExpenseDialog } from '@/components/treasury/add-expense-dialog';
import { ExpensesList } from '@/components/treasury/expenses-list';
import { useAuth } from '@/components/providers/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { getCurrentMonthExpenseStats } from '@/lib/expenses';
import { Card } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';

export default function GastosPage() {
    const { role } = useAuth();
    const canAddExpense = role === 'SUPERADMIN' || role === 'JUNTA';

    const { data: stats } = useQuery({
        queryKey: ['expense-stats-current-month'],
        queryFn: getCurrentMonthExpenseStats,
    });

    return (
        <div className="space-y-6">
            {/* Header con estadísticas */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
                    {canAddExpense && <AddExpenseDialog />}
                </div>

                {/* Resumen rápido */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
                        <p className="text-xs font-bold uppercase text-red-700 tracking-wider mb-1">Total Mes</p>
                        <p className="text-2xl font-black text-red-600">
                            {stats?.total.toFixed(2) || '0.00'}€
                        </p>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1">Nº Gastos</p>
                        <p className="text-2xl font-black text-slate-600">
                            {stats?.count || 0}
                        </p>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 col-span-2 md:col-span-1">
                        <p className="text-xs font-bold uppercase text-purple-700 tracking-wider mb-1 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            Mayor Categoría
                        </p>
                        <p className="text-lg font-black text-purple-600">
                            {stats?.byCategory && Object.entries(stats.byCategory).reduce((max, [cat, val]) =>
                                val > (stats.byCategory[max as keyof typeof stats.byCategory] || 0) ? cat : max, 'Otros'
                            )}
                        </p>
                    </Card>
                </div>
            </div>

            <ExpensesList />
        </div>
    );
}
