import { supabase } from './supabase';
import type { CortejoEstructura, PosicionTipo, Lado } from './cortejo';

// =====================================================
// ADMIN: Gestión Dinámica del Cortejo
// =====================================================

export interface NuevaPosicion {
    nombre: string;
    tipo: PosicionTipo;
    tramo: number;
    posicion: number;
    lado?: Lado;
    tipo_insignia?: string;
}

export interface ReordenData {
    id: string;
    posicion: number;
}

// =====================================================
// CRUD Functions
// =====================================================

/**
 * Añade una fila completa de nazarenos (izquierda + derecha)
 */
export async function agregarFilaNazarenos(
    tramo: number,
    numeroFila: number
): Promise<void> {
    const nuevasPosiciones = [
        {
            nombre: `Nazareno Fila ${numeroFila} Izquierda`,
            tipo: 'nazareno' as PosicionTipo,
            tramo,
            posicion: numeroFila + 10, // Offset para nazarenos
            lado: 'izquierda' as Lado
        },
        {
            nombre: `Nazareno Fila ${numeroFila} Derecha`,
            tipo: 'nazareno' as PosicionTipo,
            tramo,
            posicion: numeroFila + 10,
            lado: 'derecha' as Lado
        }
    ];

    const { error } = await supabase
        .from('cortejo_estructura')
        .insert(nuevasPosiciones);

    if (error) throw error;
}

/**
 * Elimina una fila completa de nazarenos
 * Valida que no tengan papeletas asignadas
 */
export async function eliminarFilaNazarenos(
    tramo: number,
    numeroFila: number
): Promise<void> {
    // 1. Buscar las posiciones de la fila
    const { data: posiciones, error: fetchError } = await supabase
        .from('cortejo_estructura')
        .select('id, nombre')
        .eq('tramo', tramo)
        .eq('tipo', 'nazareno')
        .eq('posicion', numeroFila + 10);

    if (fetchError) throw fetchError;
    if (!posiciones || posiciones.length === 0) {
        throw new Error('No se encontraron posiciones para esta fila');
    }

    // 2. Validar que no tengan papeletas asignadas
    const ids = posiciones.map(p => p.id);
    const { data: asignaciones, error: asigError } = await supabase
        .from('cortejo_asignaciones')
        .select('id')
        .in('id_posicion', ids)
        .eq('anio', new Date().getFullYear());

    if (asigError) throw asigError;
    if (asignaciones && asignaciones.length > 0) {
        throw new Error('No se puede eliminar: hay papeletas asignadas en esta fila');
    }

    // 3. Eliminar las posiciones
    const { error: deleteError } = await supabase
        .from('cortejo_estructura')
        .delete()
        .in('id', ids);

    if (deleteError) throw deleteError;
}

/**
 * Añade una posición individual al cortejo
 */
export async function agregarPosicion(data: NuevaPosicion): Promise<void> {
    const { error } = await supabase
        .from('cortejo_estructura')
        .insert(data);

    if (error) throw error;
}

/**
 * Elimina una posición individual
 * Valida que no tenga papeleta asignada
 */
export async function eliminarPosicion(id: string): Promise<void> {
    // 1. Validar que no tenga papeleta asignada
    const { data: asignaciones, error: asigError } = await supabase
        .from('cortejo_asignaciones')
        .select('id')
        .eq('id_posicion', id)
        .eq('anio', new Date().getFullYear());

    if (asigError) throw asigError;
    if (asignaciones && asignaciones.length > 0) {
        throw new Error('No se puede eliminar: hay una papeleta asignada en esta posición');
    }

    // 2. Eliminar la posición
    const { error: deleteError } = await supabase
        .from('cortejo_estructura')
        .delete()
        .eq('id', id);

    if (deleteError) throw deleteError;
}

/**
 * Reordena posiciones dentro de un tramo
 */
export async function reordenarPosiciones(
    tramo: number,
    reordenamientos: ReordenData[]
): Promise<void> {
    // Actualizar cada posición en batch
    const updates = reordenamientos.map(({ id, posicion }) =>
        supabase
            .from('cortejo_estructura')
            .update({ posicion })
            .eq('id', id)
    );

    await Promise.all(updates);
}

/**
 * Obtiene todas las posiciones de un tramo agrupadas por tipo
 */
export async function obtenerPosicionesPorTramo(tramo: number) {
    const { data, error } = await supabase
        .from('cortejo_estructura')
        .select('*')
        .eq('tramo', tramo)
        .order('posicion', { ascending: true });

    if (error) throw error;

    // Agrupar por tipo
    const grouped: Record<string, CortejoEstructura[]> = {};
    data?.forEach(pos => {
        if (!grouped[pos.tipo]) grouped[pos.tipo] = [];
        grouped[pos.tipo].push(pos);
    });

    return grouped;
}
