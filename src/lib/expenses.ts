import { supabase } from './supabase';

// ============================================
// TIPOS Y CONSTANTES
// ============================================

export const EXPENSE_CATEGORIES = [
    'Flores',
    'Velas',
    'Mantenimiento',
    'Eventos',
    'Otros'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface Expense {
    id: string;
    concepto: string;
    categoria: ExpenseCategory;
    cantidad: number;
    fecha: string; // ISO date string
    notas?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateExpenseInput {
    concepto: string;
    categoria: ExpenseCategory;
    cantidad: number;
    fecha: string;
    notas?: string;
}

export interface UpdateExpenseInput {
    concepto?: string;
    categoria?: ExpenseCategory;
    cantidad?: number;
    fecha?: string;
    notas?: string;
}

// ============================================
// FUNCIONES CRUD
// ============================================

/**
 * Obtener todos los gastos ordenados por fecha descendente
 */
export async function getExpenses(): Promise<Expense[]> {
    const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) throw error;
    return data as Expense[];
}

/**
 * Obtener gastos por rango de fechas
 */
export async function getExpensesByDateRange(
    startDate: string,
    endDate: string
): Promise<Expense[]> {
    const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: false });

    if (error) throw error;
    return data as Expense[];
}

/**
 * Obtener gastos de un mes específico
 */
export async function getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    return getExpensesByDateRange(startDate, endDate);
}

/**
 * Obtener gastos por categoría
 */
export async function getExpensesByCategory(categoria: ExpenseCategory): Promise<Expense[]> {
    const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .eq('categoria', categoria)
        .order('fecha', { ascending: false });

    if (error) throw error;
    return data as Expense[];
}

/**
 * Crear un nuevo gasto
 */
export async function createExpense(expense: CreateExpenseInput): Promise<Expense> {
    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase
        .from('gastos')
        .insert([{
            ...expense,
            created_by: user.id
        }])
        .select()
        .single();

    if (error) throw error;
    return data as Expense;
}

/**
 * Actualizar un gasto existente
 */
export async function updateExpense(
    id: string,
    updates: UpdateExpenseInput
): Promise<Expense> {
    const { data, error } = await supabase
        .from('gastos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data as Expense;
}

/**
 * Eliminar un gasto
 */
export async function deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
        .from('gastos')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// FUNCIONES DE UTILIDAD Y CÁLCULOS
// ============================================

/**
 * Calcular el total de gastos de un array
 */
export function calculateTotalExpenses(expenses: Expense[]): number {
    return expenses.reduce((total, expense) => total + Number(expense.cantidad), 0);
}

/**
 * Agrupar gastos por categoría con totales
 */
export function groupExpensesByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
    const grouped = expenses.reduce((acc, expense) => {
        const categoria = expense.categoria;
        acc[categoria] = (acc[categoria] || 0) + Number(expense.cantidad);
        return acc;
    }, {} as Record<ExpenseCategory, number>);

    // Asegurar que todas las categorías existen
    EXPENSE_CATEGORIES.forEach(cat => {
        if (!grouped[cat]) grouped[cat] = 0;
    });

    return grouped;
}

/**
 * Calcular balance neto (ingresos - gastos)
 */
export function calculateNetBalance(ingresos: number, gastos: number): number {
    return ingresos - gastos;
}

/**
 * Obtener estadísticas de gastos del mes actual
 */
export async function getCurrentMonthExpenseStats(): Promise<{
    total: number;
    byCategory: Record<ExpenseCategory, number>;
    count: number;
}> {
    const now = new Date();
    const expenses = await getExpensesByMonth(now.getFullYear(), now.getMonth());

    return {
        total: calculateTotalExpenses(expenses),
        byCategory: groupExpensesByCategory(expenses),
        count: expenses.length
    };
}
