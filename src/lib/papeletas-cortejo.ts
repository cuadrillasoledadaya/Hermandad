import { supabase } from './supabase';

// =====================================================
// TIPOS Y CONSTANTES
// =====================================================

export const TIPOS_PAPELETA = {
    cruz_guia: 'Cruz de Guía',
    vara: 'Vara',
    insignia: 'Insignia',
    bocina: 'Bocina',
    nazareno: 'Nazareno',
    costalero: 'Costalero'
} as const;

export const ESTADOS_PAPELETA = {
    pagada: 'Pagada',
    asignada: 'Asignada',
    cancelada: 'Cancelada'
} as const;

export const PRECIO_PAPELETA_DEFAULT = 15.00;

export type TipoPapeleta = keyof typeof TIPOS_PAPELETA;
export type EstadoPapeleta = keyof typeof ESTADOS_PAPELETA;

export interface PapeletaCortejo {
    id: string;
    id_hermano: string;
    numero: number;
    anio: number;
    tipo: TipoPapeleta;
    estado: EstadoPapeleta;
    importe: number;
    fecha_pago: string;
    id_ingreso: string | null;
    id_posicion_asignada: string | null;
    fecha_asignacion: string | null;
    created_at: string;
    updated_at: string;
}

export interface PapeletaConDetalles extends PapeletaCortejo {
    hermano: {
        id: string;
        nombre: string;
        apellidos: string;
    };
    posicion?: {
        id: string;
        nombre: string;
        tipo: string;
        tipo_insignia?: string;
    };
    ingreso?: {
        id: string;
        tipo_pago?: string;
    };
}

// =====================================================
// FUNCIONES DE VENTA
// =====================================================

export interface VenderPapeletaInput {
    id_hermano: string;
    tipo: TipoPapeleta;
    importe?: number;
    anio?: number;
}

/**
 * Vende una papeleta de cortejo y crea el pago asociado
 */
export async function venderPapeleta(input: VenderPapeletaInput): Promise<PapeletaCortejo> {
    const year = input.anio || new Date().getFullYear();
    const importe = input.importe || PRECIO_PAPELETA_DEFAULT;

    // 1. Obtener el siguiente número de papeleta disponible
    const { data: ultimaPapeleta, error: numError } = await supabase
        .from('papeletas_cortejo')
        .select('numero')
        .eq('anio', year)
        .order('numero', { ascending: false })
        .limit(1)
        .single();

    if (numError && numError.code !== 'PGRST116') throw numError;

    const siguienteNumero = ultimaPapeleta ? ultimaPapeleta.numero + 1 : 1;

    // 2. Crear el pago en tesorería (tabla pagos)
    const { data: pago, error: pagoError } = await supabase
        .from('pagos')
        .insert({
            id_hermano: input.id_hermano,
            cantidad: importe,
            fecha_pago: new Date().toISOString(),
            anio: year,
            tipo_pago: 'papeleta_cortejo',
            concepto: `Papeleta #${siguienteNumero} - ${TIPOS_PAPELETA[input.tipo]}`
        })
        .select()
        .single();

    if (pagoError) throw pagoError;

    // 3. Crear la papeleta
    const { data: papeleta, error: papeletaError } = await supabase
        .from('papeletas_cortejo')
        .insert({
            id_hermano: input.id_hermano,
            numero: siguienteNumero,
            anio: year,
            tipo: input.tipo,
            importe,
            id_ingreso: pago.id,
            estado: 'pagada'
        })
        .select()
        .single();

    if (papeletaError) throw papeletaError;

    // 4. Actualizar el pago con la referencia a la papeleta
    await supabase
        .from('pagos')
        .update({ id_papeleta: papeleta.id })
        .eq('id', pago.id);

    return papeleta;
}

/**
 * Cancela una papeleta (marca como cancelada, no elimina)
 */
export async function cancelarPapeleta(id_papeleta: string): Promise<void> {
    const { error } = await supabase
        .from('papeletas_cortejo')
        .update({ estado: 'cancelada' })
        .eq('id', id_papeleta);

    if (error) throw error;
}

// =====================================================
// FUNCIONES DE CONSULTA
// =====================================================

/**
 * Obtiene todas las papeletas de un año con detalles
 */
export async function getPapeletasDelAnio(anio?: number): Promise<PapeletaConDetalles[]> {
    const year = anio || new Date().getFullYear();

    const { data, error } = await supabase
        .from('papeletas_cortejo')
        .select(`
            *,
            hermano:hermanos(id, nombre, apellidos),
            posicion:cortejo_estructura(id, nombre, tipo, tipo_insignia),
            ingreso:pagos(id, tipo_pago)
        `)
        .eq('anio', year)
        .order('numero', { ascending: true });

    if (error) throw error;
    return data as unknown as PapeletaConDetalles[];
}

/**
 * Obtiene papeletas pendientes de asignar (estado = pagada)
 */
export async function getPapeletasPendientes(
    tipo?: TipoPapeleta,
    anio?: number
): Promise<PapeletaConDetalles[]> {
    const year = anio || new Date().getFullYear();

    let query = supabase
        .from('papeletas_cortejo')
        .select(`
            *,
            hermano:hermanos(id, nombre, apellidos)
        `)
        .eq('anio', year)
        .eq('estado', 'pagada')
        .order('numero', { ascending: true });

    if (tipo) {
        query = query.eq('tipo', tipo);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as unknown as PapeletaConDetalles[];
}

/**
 * Obtiene una papeleta por ID
 */
export async function getPapeleta(id: string): Promise<PapeletaConDetalles> {
    const { data, error } = await supabase
        .from('papeletas_cortejo')
        .select(`
            *,
            hermano:hermanos(id, nombre, apellidos),
            posicion:cortejo_estructura(id, nombre, tipo, tipo_insignia),
            ingreso:pagos(id, tipo_pago)
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as unknown as PapeletaConDetalles;
}

// =====================================================
// FUNCIONES DE ASIGNACIÓN
// =====================================================

/**
 * Asigna una papeleta a una posición específica del cortejo
 */
export async function asignarPosicionAPapeleta(
    id_papeleta: string,
    id_posicion: string
): Promise<void> {
    // 1. Verificar que la papeleta está en estado 'pagada'
    const { data: papeleta, error: papError } = await supabase
        .from('papeletas_cortejo')
        .select('estado, tipo')
        .eq('id', id_papeleta)
        .single();

    if (papError) throw papError;

    if (papeleta.estado !== 'pagada') {
        throw new Error('La papeleta ya está asignada o cancelada');
    }

    // 2. Verificar que la posición está libre
    const { data: posicion, error: posError } = await supabase
        .from('cortejo_estructura')
        .select('tipo, tipo_insignia')
        .eq('id', id_posicion)
        .single();

    if (posError) throw posError;

    // 3. Verificar que el tipo coincide (1:1 Estricto)
    const matchesType = papeleta.tipo === (posicion.tipo as any);

    if (!matchesType) {
        const tipoLabel = (TIPOS_PAPELETA as any)[papeleta.tipo] || papeleta.tipo;
        throw new Error(`El tipo de papeleta (${tipoLabel}) no coincide con el tipo de posición (${posicion.tipo})`);
    }

    // 4. Verificar que no está ya ocupada
    const { data: asignacionExistente, error: asigError } = await supabase
        .from('cortejo_asignaciones')
        .select('id')
        .eq('id_posicion', id_posicion)
        .eq('anio', new Date().getFullYear())
        .single();

    if (asigError && asigError.code !== 'PGRST116') throw asigError;

    if (asignacionExistente) {
        throw new Error('Esta posición ya está ocupada');
    }

    // 5. Obtener datos de la papeleta para crear la asignación
    const papeletaCompleta = await getPapeleta(id_papeleta);

    // 6. Crear la asignación en cortejo_asignaciones
    const { error: createError } = await supabase
        .from('cortejo_asignaciones')
        .insert({
            id_hermano: papeletaCompleta.id_hermano,
            id_posicion,
            anio: papeletaCompleta.anio,
            numero_papeleta: papeletaCompleta.numero,
            id_papeleta: id_papeleta
        });

    if (createError) throw createError;

    // 7. Actualizar la papeleta
    const { error: updateError } = await supabase
        .from('papeletas_cortejo')
        .update({
            estado: 'asignada',
            id_posicion_asignada: id_posicion,
            fecha_asignacion: new Date().toISOString()
        })
        .eq('id', id_papeleta);

    if (updateError) throw updateError;
}

/**
 * Quita la asignación de una papeleta (vuelve a estado 'pagada')
 */
export async function quitarAsignacionDePapeleta(id_papeleta: string): Promise<void> {
    // 1. Obtener la papeleta
    const papeleta = await getPapeleta(id_papeleta);

    if (papeleta.estado !== 'asignada') {
        throw new Error('La papeleta no está asignada');
    }

    // 2. Eliminar la asignación del cortejo
    if (papeleta.id_posicion_asignada) {
        const { error: deleteError } = await supabase
            .from('cortejo_asignaciones')
            .delete()
            .eq('id_posicion', papeleta.id_posicion_asignada)
            .eq('anio', papeleta.anio);

        if (deleteError) throw deleteError;
    }

    // 3. Actualizar la papeleta
    const { error: updateError } = await supabase
        .from('papeletas_cortejo')
        .update({
            estado: 'pagada',
            id_posicion_asignada: null,
            fecha_asignacion: null
        })
        .eq('id', id_papeleta);

    if (updateError) throw updateError;
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

export interface PapeletasStats {
    total_vendidas: number;
    total_asignadas: number;
    total_pendientes: number;
    total_canceladas: number;
    ingresos_totales: number;
    por_tipo: {
        insignia: number;
        nazareno: number;
        costalero: number;
    };
}

/**
 * Obtiene estadísticas de papeletas para un año
 */
export async function getEstadisticasPapeletas(anio?: number): Promise<PapeletasStats> {
    const year = anio || new Date().getFullYear();

    const { data: papeletas, error } = await supabase
        .from('papeletas_cortejo')
        .select('estado, tipo, importe')
        .eq('anio', year);

    if (error) throw error;

    const stats: PapeletasStats = {
        total_vendidas: papeletas?.length || 0,
        total_asignadas: papeletas?.filter(p => p.estado === 'asignada').length || 0,
        total_pendientes: papeletas?.filter(p => p.estado === 'pagada').length || 0,
        total_canceladas: papeletas?.filter(p => p.estado === 'cancelada').length || 0,
        ingresos_totales: papeletas?.reduce((sum, p) => sum + Number(p.importe), 0) || 0,
        por_tipo: {
            insignia: papeletas?.filter(p => p.tipo === 'insignia').length || 0,
            nazareno: papeletas?.filter(p => p.tipo === 'nazareno').length || 0,
            costalero: papeletas?.filter(p => p.tipo === 'costalero').length || 0
        }
    };

    return stats;
}
