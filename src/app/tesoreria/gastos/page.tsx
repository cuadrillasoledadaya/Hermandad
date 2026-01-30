import { AddExpenseDialog } from '@/components/treasury/add-expense-dialog';
import { ExpensesList } from '@/components/treasury/expenses-list';
import { useAuth } from '@/components/providers/auth-provider';

export default function GastosPage() {
    const { role } = useAuth();
    const canAddExpense = role === 'SUPERADMIN' || role === 'JUNTA';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Gestión de Gastos</h2>
                    <p className="text-muted-foreground">
                        Control de gastos generales de la Hermandad.
                    </p>
                </div>
                {canAddExpense && <AddExpenseDialog />}
            </div>

            <ExpensesList />
        </div>
    );
}
