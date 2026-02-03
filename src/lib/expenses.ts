import { supabase } from './supabase';
import { offlineInsert, offlineUpdate, offlineDelete } from './offline-mutation';

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

    const { success, data, error } = await offlineInsert('gastos', {
        ...expense,
        created_by: user.id
    });

    if (!success) throw new Error(error || 'Error creando gasto');
    return data as Expense;
}

/**
 * Actualizar un gasto existente
 */
export async function updateExpense(
    id: string,
    updates: UpdateExpenseInput
): Promise<Expense> {
    const { success, data, error } = await offlineUpdate('gastos', { ...updates, id });

    if (!success) throw new Error(error || 'Error actualizando gasto');
    return data as Expense;
}

/**
 * Eliminar un gasto
 */
export async function deleteExpense(id: string): Promise<void> {
    const { success, error } = await offlineDelete('gastos', id);

    if (!success) throw new Error(error || 'Error eliminando gasto');
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

/**
 * Obtener estadísticas de gastos del mes anterior
 */
export async function getPreviousMonthExpenseStats(): Promise<{
    total: number;
    byCategory: Record<ExpenseCategory, number>;
    count: number;
}> {
    const now = new Date();
    // Obtener el mes anterior
    const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const expenses = await getExpensesByMonth(previousYear, previousMonth);

    return {
        total: calculateTotalExpenses(expenses),
        byCategory: groupExpensesByCategory(expenses),
        count: expenses.length
    };
}

/**
 * Obtener promedio de gastos mensuales de los últimos N meses
 */
export async function getAverageMonthlyExpenses(months: number = 3): Promise<number> {
    const now = new Date();
    let totalExpenses = 0;
    let monthsWithData = 0;

    for (let i = 0; i < months; i++) {
        const targetMonth = now.getMonth() - i;
        const targetYear = now.getFullYear();

        // Calcular año y mes correctos (manejar cambio de año)
        const adjustedDate = new Date(targetYear, targetMonth, 1);
        const finalYear = adjustedDate.getFullYear();
        const finalMonth = adjustedDate.getMonth();

        const expenses = await getExpensesByMonth(finalYear, finalMonth);

        if (expenses.length > 0) {
            totalExpenses += calculateTotalExpenses(expenses);
            monthsWithData++;
        }
    }

    return monthsWithData > 0 ? totalExpenses / monthsWithData : 0;
}

