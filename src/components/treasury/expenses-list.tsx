'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenses, deleteExpense, type Expense, EXPENSE_CATEGORIES } from '@/lib/expenses';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar, Euro, Flower2, Flame, Wrench, PartyPopper, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

// Helper para obtener el icono de cada categoría
const getCategoryIcon = (categoria: string) => {
    switch (categoria) {
        case 'Flores': return Flower2;
        case 'Velas': return Flame;
        case 'Mantenimiento': return Wrench;
        case 'Eventos': return PartyPopper;
        case 'Otros': return Package;
        default: return Package;
    }
};

export function ExpensesList() {
    const { role } = useAuth();
    const canDelete = role === 'SUPERADMIN' || role === 'JUNTA';
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');

    const queryClient = useQueryClient();

    const { data: expenses = [], isLoading } = useQuery<Expense[]>({
        queryKey: ['expenses'],
        queryFn: getExpenses,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast.success('Gasto eliminado correctamente');
        },
        onError: () => {
            toast.error('Error al eliminar el gasto');
        }
    });

    const handleDelete = (expense: Expense) => {
        if (confirm(`¿Eliminar el gasto "${expense.concepto}" de ${expense.cantidad}€?`)) {
            deleteMutation.mutate(expense.id);
        }
    };

    // Obtener años únicos de los gastos
    const years = Array.from(new Set(expenses.map(e => new Date(e.fecha).getFullYear()))).sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) years.unshift(currentYear);

    const filteredExpenses = expenses.filter(expense => {
        // Filtro por categoría
        if (selectedCategory !== 'all' && expense.categoria !== selectedCategory) return false;

        const expenseDate = new Date(expense.fecha);

        // Filtro por mes
        if (selectedMonth !== 'all' && expenseDate.getMonth().toString() !== selectedMonth) return false;

        // Filtro por año
        if (selectedYear !== 'all' && expenseDate.getFullYear().toString() !== selectedYear) return false;

        return true;
    });

    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.cantidad), 0);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground animate-pulse text-sm">Cargando gastos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50 p-4 rounded-lg border">
                {/* Filtros por categoría */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={selectedCategory === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory('all')}
                    >
                        Todos
                    </Button>
                    {EXPENSE_CATEGORIES.map((cat) => (
                        <Button
                            key={cat}
                            variant={selectedCategory === cat ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </Button>
                    ))}
                </div>

                {/* Filtros por fecha */}
                <div className="flex gap-2 w-full md:w-auto">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px] bg-white">
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los meses</SelectItem>
                            {Array.from({ length: 12 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                    {format(new Date(0, i), 'MMMM', { locale: es }).charAt(0).toUpperCase() + format(new Date(0, i), 'MMMM', { locale: es }).slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px] bg-white">
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Resumen */}
            <Card className="p-4 bg-slate-50 border-2">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Total {selectedCategory === 'all' ? 'General' : selectedCategory}</p>
                        <p className="text-3xl font-bold text-primary">{total.toFixed(2)}€</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Número de gastos</p>
                        <p className="text-2xl font-semibold">{filteredExpenses.length}</p>
                    </div>
                </div>
            </Card>

            {/* Lista de gastos */}
            {filteredExpenses.length === 0 ? (
                <Card className="p-12 text-center border-2 border-dashed">
                    <p className="text-muted-foreground">No hay gastos registrados con los filtros seleccionados.</p>
                </Card>
            ) : (
                <>
                    {/* Vista Mobile */}
                    <div className="block md:hidden space-y-3">
                        {filteredExpenses.map((expense) => (
                            <Card key={expense.id} className="p-4 hover:border-primary/30 transition-all">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1",
                                                expense.categoria === 'Flores' && "bg-pink-100 text-pink-700",
                                                expense.categoria === 'Velas' && "bg-amber-100 text-amber-700",
                                                expense.categoria === 'Mantenimiento' && "bg-blue-100 text-blue-700",
                                                expense.categoria === 'Eventos' && "bg-purple-100 text-purple-700",
                                                expense.categoria === 'Otros' && "bg-slate-100 text-slate-700"
                                            )}>
                                                {(() => {
                                                    const Icon = getCategoryIcon(expense.categoria);
                                                    return <Icon className="w-3 h-3" />;
                                                })()}
                                                {expense.categoria}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(expense.fecha), "d 'de' MMM, yyyy", { locale: es })}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-sm">{expense.concepto}</p>
                                        {expense.notas && (
                                            <p className="text-xs text-muted-foreground italic">{expense.notas}</p>
                                        )}
                                        <div className="flex items-center gap-1 text-lg font-bold text-red-600">
                                            <Euro className="w-4 h-4" />
                                            {Number(expense.cantidad).toFixed(2)}
                                        </div>
                                    </div>
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0"
                                            onClick={() => handleDelete(expense)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* Vista Desktop */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border-2 border-slate-200 bg-white">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b-2 border-slate-200">
                                <tr>
                                    <th className="text-left p-4 font-bold">Fecha</th>
                                    <th className="text-left p-4 font-bold">Concepto</th>
                                    <th className="text-left p-4 font-bold">Categoría</th>
                                    <th className="text-right p-4 font-bold">Cantidad</th>
                                    {canDelete && <th className="text-center p-4 font-bold">Acción</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                                            {format(new Date(expense.fecha), "dd/MM/yyyy")}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-semibold">{expense.concepto}</p>
                                            {expense.notas && (
                                                <p className="text-xs text-muted-foreground mt-1">{expense.notas}</p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-bold uppercase inline-flex items-center gap-1.5",
                                                expense.categoria === 'Flores' && "bg-pink-100 text-pink-700",
                                                expense.categoria === 'Velas' && "bg-amber-100 text-amber-700",
                                                expense.categoria === 'Mantenimiento' && "bg-blue-100 text-blue-700",
                                                expense.categoria === 'Eventos' && "bg-purple-100 text-purple-700",
                                                expense.categoria === 'Otros' && "bg-slate-100 text-slate-700"
                                            )}>
                                                {(() => {
                                                    const Icon = getCategoryIcon(expense.categoria);
                                                    return <Icon className="w-3.5 h-3.5" />;
                                                })()}
                                                {expense.categoria}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-red-600">
                                            {Number(expense.cantidad).toFixed(2)}€
                                        </td>
                                        {canDelete && (
                                            <td className="p-4 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => handleDelete(expense)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
