'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createExpense, EXPENSE_CATEGORIES, type CreateExpenseInput, type ExpenseCategory } from '@/lib/expenses';

export function AddExpenseDialog() {
    const [open, setOpen] = useState(false);
    const [concepto, setConcepto] = useState('');
    const [categoria, setCategoria] = useState<ExpenseCategory>('Otros');
    const [cantidad, setCantidad] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [notas, setNotas] = useState('');

    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: (data: CreateExpenseInput) => createExpense(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast.success('Gasto registrado correctamente');
            resetForm();
            setOpen(false);
        },
        onError: (error) => {
            console.error('Error creating expense:', error);
            toast.error('Error al registrar el gasto');
        }
    });

    const resetForm = () => {
        setConcepto('');
        setCategoria('Otros');
        setCantidad('');
        setFecha(new Date().toISOString().split('T')[0]);
        setNotas('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!concepto.trim()) {
            toast.error('El concepto es obligatorio');
            return;
        }

        if (!cantidad || parseFloat(cantidad) <= 0) {
            toast.error('La cantidad debe ser mayor a 0');
            return;
        }

        createMutation.mutate({
            concepto: concepto.trim(),
            categoria,
            cantidad: parseFloat(cantidad),
            fecha,
            notas: notas.trim() || undefined
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Añadir Gasto
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                    <DialogDescription>
                        Añade un gasto de la Hermandad con su categoría correspondiente.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="concepto">Concepto *</Label>
                        <Input
                            id="concepto"
                            placeholder="Ej: Flores para altar principal"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría *</Label>
                            <select
                                id="categoria"
                                value={categoria}
                                onChange={(e) => setCategoria(e.target.value as ExpenseCategory)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                required
                            >
                                {EXPENSE_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cantidad">Cantidad (€) *</Label>
                            <Input
                                id="cantidad"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fecha">Fecha *</Label>
                        <Input
                            id="fecha"
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notas">Notas (opcional)</Label>
                        <Textarea
                            id="notas"
                            placeholder="Información adicional sobre el gasto..."
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex-1"
                        >
                            {createMutation.isPending ? 'Guardando...' : 'Guardar Gasto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
