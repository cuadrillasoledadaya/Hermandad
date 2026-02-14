import { supabase } from './supabase';
import { getPreciosConfig } from './configuracion';
import { offlineInsert, offlineUpdate, offlineDelete } from './offline-mutation';
import { papeletasRepo } from './db/tables/papeletas.table';

// =====================================================
// TIPOS Y CONSTANTES
// =====================================================

export const TIPOS_PAPELETA = {
    cruz_guia: 'Cruz de Guía',
    vara: 'Vara',
    insignia: 'Insignia',
    bocina: 'Bocina',
    nazareno: 'Nazareno',
    costalero: 'Costalero',
    farol: 'Farol'
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
    tramo: number | null;
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
    hermano?: {
        nombre: string;
        apellidos: string;
    };
    tipo: TipoPapeleta;
    tramo?: number; // Nuevo campo opcional
    importe?: number;
    anio?: number;
}

/**
 * Obtiene el precio configurado para un tipo de papeleta
 */
export async function getPrecioPapeleta(tipo: TipoPapeleta): Promise<number> {
    const config = await getPreciosConfig();
    switch (tipo) {
        case 'nazareno': return config.papeleta_nazareno;
        case 'costalero': return config.papeleta_costalero;
        case 'insignia': return config.papeleta_insignia;
        case 'vara': return config.papeleta_vara;
        case 'bocina': return config.papeleta_bocina;
        case 'cruz_guia': return config.papeleta_cruz_guia;
        case 'farol': return config.papeleta_farol;
        default: return PRECIO_PAPELETA_DEFAULT;
    }
}

/**
 * Confirma o revierte la presencia de un hermano en el templo
 */
export async function setPresenciaConfirmada(idPapeleta: string, confirmada: boolean): Promise<void> {
    const { error } = await supabase
        .from('papeletas_cortejo')
        .update({ presencia_confirmada: confirmada })
        .eq('id', idPapeleta);

    if (error) throw error;
}

/**
 * Obtiene el estado global de la estación de penitencia
 */
export async function getEstadoEstacionPenitencia(): Promise<boolean> {
    const { data, error } = await supabase
        .from('configuracion_global')
        .select('valor')
        .eq('clave', 'estacion_penitencia_activa')
        .single();

    if (error) {
        if (error.code === 'PGRST116') return false;
        throw error;
    }
    return data.valor as boolean;
}

/**
 * Activa o desactiva el modo estación de penitencia globalmente
 */
export async function setEstadoEstacionPenitencia(activa: boolean): Promise<void> {
    const { error } = await supabase
        .from('configuracion_global')
        .upsert({ clave: 'estacion_penitencia_activa', valor: activa, updated_at: new Date().toISOString() });

    if (error) throw error;

    // Si se desactiva, opcionalmente podríamos resetear todas las presencias de ese año
    // Pero el usuario pidió "ir al estado inicial todas las papeletas vendidas sin más"
    if (!activa) {
        const year = new Date().getFullYear();
        const { error: resetError } = await supabase
            .from('papeletas_cortejo')
            .update({ presencia_confirmada: false })
            .eq('anio', year);
        if (resetError) throw resetError;
    }
}

/**
 * Vende una papeleta de cortejo y crea el pago asociado
 */
export async function venderPapeleta(input: VenderPapeletaInput): Promise<PapeletaCortejo> {
    const year = input.anio || new Date().getFullYear();
    const importe = input.importe ?? await getPrecioPapeleta(input.tipo);

    // 0. Validación: Verificar si el hermano ya tiene papeleta este año
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));

            const validationQuery = supabase
                .from('papeletas_cortejo')
                .select('id, numero')
                .eq('id_hermano', input.id_hermano)
                .eq('anio', year)
                .neq('estado', 'cancelada')
                .maybeSingle();

            // @ts-expect-error - Promise race typing
            const { data: existingPapeleta, error: checkError } = await Promise.race([validationQuery, timeoutPromise]);

            if (checkError) {
                // Si es un error de red, lo ignoramos y seguimos (se validará en sync)
                if (checkError.message?.toLowerCase().includes('fetch') || !checkError.code) {
                    console.warn('Network error during validation, skipping online check');
                } else {
                    throw checkError;
                }
            } else if (existingPapeleta) {
                throw new Error(`Este hermano ya tiene la papeleta #${existingPapeleta.numero} activa para este año.`);
            }
        }
    } catch (e) {
        const error = e as Error;
        if (error.message?.includes('ya tiene la papeleta')) throw error;
        console.warn('Error verifying existing papeleta, proceeding offline:', error);
    }

    // 1. Obtener el siguiente número de papeleta disponible (optimista si offline)
    let siguienteNumero = -1;
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));

            const numberQuery = supabase
                .from('papeletas_cortejo')
                .select('numero')
                .eq('anio', year)
                .order('numero', { ascending: false })
                .limit(1)
                .maybeSingle();

            // @ts-expect-error - Promise race typing
            const { data: ultimaPapeleta, error: numError } = await Promise.race([numberQuery, timeoutPromise]);

            if (numError) {
                // Fallo de red o timeout, usar lógica offline
                throw numError;
            } else {
                siguienteNumero = ultimaPapeleta ? ultimaPapeleta.numero + 1 : 1;
            }
        } else {
            throw new Error('offline');
        }
    } catch {
        // Lógica offline o error de red: Buscar el número negativo más bajo para este año en IndexedDB
        try {
            const localPapeletas = await papeletasRepo.getAll();
            const numerosProvisionales = localPapeletas
                .filter(p => p.anio === year)
                .map(p => p.numero)
                .filter(n => typeof n === 'number' && n < 0)
                .sort((a, b) => a - b); // [-3, -2, -1]

            siguienteNumero = numerosProvisionales.length > 0 ? numerosProvisionales[0] - 1 : -1;
            console.log(`Modo offline: Asignando número provisional ${siguienteNumero}`);
        } catch (dbErr) {
            console.error('Error calculando número provisional:', dbErr);
            siguienteNumero = -1; // Fallback extremo
        }
    }

    // Generar IDs cliente para mantener integridad referencial offline
    const pagoId = crypto.randomUUID();
    const papeletaId = crypto.randomUUID();

    // 2. Crear el pago en tesorería (tabla pagos)
    const pagoData = {
        id: pagoId,
        id_hermano: input.id_hermano,
        cantidad: importe,
        fecha_pago: new Date().toISOString(),
        anio: year,
        tipo_pago: 'papeleta_cortejo',
        concepto: `Papeleta ${siguienteNumero > 0 ? '#' + siguienteNumero : '(Pendiente)'} - ${TIPOS_PAPELETA[input.tipo]}`,
        id_papeleta: papeletaId // Vinculación cruzada anticipada
    };

    const { success: pagoSuccess, error: pagoError } = await offlineInsert('pagos', pagoData);

    if (!pagoSuccess) throw new Error(pagoError || 'Error creando pago');

    // 3. Crear la papeleta
    const papeletaData = {
        id: papeletaId,
        id_hermano: input.id_hermano,
        hermano: input.hermano, // OPTIMISTIC: Para visualización offline
        numero: siguienteNumero,
        anio: year,
        tipo: input.tipo,
        tramo: input.tramo || null,
        importe,
        id_ingreso: pagoId,
        estado: 'pagada' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { success: papeletaSuccess, data: papeleta, error: papeletaError } = await offlineInsert('papeletas_cortejo', papeletaData);

    if (!papeletaSuccess) {
        // Rollback pago si falla papeleta
        await offlineDelete('pagos', pagoId);
        throw new Error(papeletaError || 'Error creando papeleta');
    }

    return (papeleta || papeletaData) as PapeletaCortejo;
}

/**
 * Cancela una papeleta (marca como cancelada, no elimina)
 */
/**
 * Cancela una papeleta (marca como cancelada, no elimina)
 */
export async function cancelarPapeleta(id_papeleta: string): Promise<void> {
    const { success, error } = await offlineUpdate('papeletas_cortejo', {
        id: id_papeleta,
        estado: 'cancelada'
    });

    if (!success) throw new Error(error || 'Error cancelando papeleta');
}

/**
 * Elimina completamente una papeleta, su asignación y su pago asociado.
 * Solo para administradores.
 */
export async function eliminarPapeleta(id_papeleta: string): Promise<void> {
    // 1. Obtener datos de la papeleta para saber qué borrar
    const { data: papeleta, error: getError } = await supabase
        .from('papeletas_cortejo')
        .select('id, anio, id_posicion_asignada, id_ingreso')
        .eq('id', id_papeleta)
        .single();

    if (getError) throw getError;

    // 2. Si tiene asignación de puesto, borrarla en cortejo_asignaciones
    if (papeleta.id_posicion_asignada) {
        // Necesitamos el ID de la asignación. Lo buscamos.
        const { data: asignacion } = await supabase
            .from('cortejo_asignaciones')
            .select('id')
            .eq('id_posicion', papeleta.id_posicion_asignada)
            .eq('anio', papeleta.anio)
            .maybeSingle();

        if (asignacion) {
            const { success: delAsigSuccess, error: delAsigError } = await offlineDelete('cortejo_asignaciones', asignacion.id);
            if (!delAsigSuccess) throw new Error(delAsigError || 'Error borrando asignación');
        }
    }

    // 3. Eliminar la papeleta
    // Primero desvinculamos el pago para evitar constraints si las hubiera (offlineUpdate maneja esto en cola)
    if (papeleta.id_ingreso) {
        await offlineUpdate('pagos', { id: papeleta.id_ingreso, id_papeleta: null });
    }

    const { success: delPapSuccess, error: delPapError } = await offlineDelete('papeletas_cortejo', id_papeleta);
    if (!delPapSuccess) throw new Error(delPapError || 'Error borrando papeleta');

    // 4. Eliminar el pago asociado
    if (papeleta.id_ingreso) {
        const { success: delPagoSuccess, error: delPagoError } = await offlineDelete('pagos', papeleta.id_ingreso);
        if (!delPagoSuccess) {
            console.error('Error borrando pago de papeleta eliminada:', delPagoError);
        }
    }
}

// =====================================================
// FUNCIONES DE CONSULTA
// =====================================================

/**
 * Obtiene todas las papeletas de un año con detalles
 */
export async function getPapeletasDelAnio(anio?: number): Promise<PapeletaConDetalles[]> {
    const year = anio || new Date().getFullYear();

    try {
        console.log(`🔍 [PAPELETAS] Solicitando papeletas del año ${year} (Online)...`);

        // Timeout de 1 segundo para caer rápido a offline
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        // Añadimos una cabecera para intentar saltar caches de navegador si las hubiera
        const supabaseQuery = supabase
            .from('papeletas_cortejo')
            .select(`
                *,
                hermano:hermanos(id, nombre, apellidos),
                posicion:cortejo_estructura(id, nombre, tipo, tipo_insignia),
                ingreso:pagos(id, tipo_pago)
            `)
            .eq('anio', year)
            .order('numero', { ascending: true });

        const { data, error } = await Promise.race([supabaseQuery, timeoutPromise]);

        if (error) {
            console.error('❌ [PAPELETAS] Error en query Supabase:', error);
            throw error;
        }

        const count = data?.length || 0;
        console.log(`✅ [PAPELETAS] Recibidas ${count} papeletas del servidor`);

        if (data) {
            // Guardar en local para futuras consultas offline (SOLO CLIENTE)
            if (typeof window !== 'undefined') {
                await papeletasRepo.saveAll(data);

                // COMBINAR CON OPTIMISTIC: Añadir los que tenemos en local como pending
                // que aún no están en el servidor (esto es vital para el dispositivo que lo crea)
                const localPapeletas = await papeletasRepo.getAll();
                const offlineOnly = localPapeletas.filter((p: any) => p._syncStatus === 'pending' && p.anio === year);

                if (offlineOnly.length > 0) {
                    console.log(`📦 [PAPELETAS] Combinando con ${offlineOnly.length} cambios locales no sincronizados`);
                    const serverIds = new Set(data.map(p => p.id));
                    const merged = [...data];

                    for (const offline of offlineOnly) {
                        if (!serverIds.has(offline.id)) {
                            merged.push(offline);
                        }
                    }
                    return merged as unknown as PapeletaConDetalles[];
                }
            }

            return data as unknown as PapeletaConDetalles[];
        }
        return [] as PapeletaConDetalles[];
    } catch (e) {
        console.error('⚠️ [PAPELETAS] Fallo fetch online, intentando local:', e);
        if (typeof window === 'undefined') return [] as PapeletaConDetalles[];
        const localData = await papeletasRepo.getAll();
        const filtered = localData.filter((p: any) => p.anio === year);
        console.log(`📦 [PAPELETAS] Cargadas ${filtered.length} papeletas de cache local (Offline Mode)`);
        return filtered as unknown as PapeletaConDetalles[];
    }
}

/**
 * Obtiene papeletas pendientes de asignar (estado = pagada)
 */
export async function getPapeletasPendientes(
    tipo?: TipoPapeleta,
    tramo?: number,
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

    if (tramo !== undefined && tramo !== null) {
        query = query.eq('tramo', tramo);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as unknown as PapeletaConDetalles[];
}

/**
 * Obtiene una papeleta por ID
 */
export async function getPapeleta(id: string): Promise<PapeletaConDetalles> {
    try {
        // Timeout de 1 segundo para caer rápido a offline
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        const supabaseQuery = supabase
            .from('papeletas_cortejo')
            .select(`
                *,
                hermano:hermanos(id, nombre, apellidos),
                posicion:cortejo_estructura(id, nombre, tipo, tipo_insignia),
                ingreso:pagos(id, tipo_pago)
            `)
            .eq('id', id)
            .single();

        const { data, error } = await Promise.race([supabaseQuery, timeoutPromise]);

        if (error) throw error;
        return data as unknown as PapeletaConDetalles;
    } catch (e) {
        console.warn('⚠️ [PAPELETAS] Fallo getPapeleta online, intentando local:', e);
        if (typeof window === 'undefined') throw e;

        // Intentar buscar en el array local de papeletas
        const localData = await papeletasRepo.getAll();
        const found = localData.find((p: any) => p.id === id);

        if (found) {
            return found as unknown as PapeletaConDetalles;
        }
        throw e;
    }
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
    const matchesType = papeleta.tipo === (posicion.tipo as TipoPapeleta);

    if (!matchesType) {
        const tipoLabel = TIPOS_PAPELETA[papeleta.tipo as keyof typeof TIPOS_PAPELETA] || papeleta.tipo;
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
    // NOTA: offlineDelete requiere ID. Aquí borramos por id_posicion + anio. 
    // Necesitamos buscar el ID de la asignación primero.
    if (papeleta.id_posicion_asignada) {
        const { data: asignacion, error: fetchError } = await supabase
            .from('cortejo_asignaciones')
            .select('id')
            .eq('id_posicion', papeleta.id_posicion_asignada)
            .eq('anio', papeleta.anio)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (asignacion) {
            const { success: delSuccess, error: deleteError } = await offlineDelete('cortejo_asignaciones', asignacion.id);
            if (!delSuccess) throw new Error(deleteError || 'Error borrando asignación');
        }
    }

    // 3. Actualizar la papeleta
    const { success: updateSuccess, error: updateError } = await offlineUpdate('papeletas_cortejo', {
        id: id_papeleta,
        estado: 'pagada',
        id_posicion_asignada: null,
        fecha_asignacion: null
    });

    if (!updateSuccess) throw new Error(updateError || 'Error actualizando papeleta');
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
            insignia: papeletas?.filter(p => ['insignia', 'cruz_guia', 'vara', 'bocina'].includes(p.tipo)).length || 0,
            nazareno: papeletas?.filter(p => p.tipo === 'nazareno').length || 0,
            costalero: papeletas?.filter(p => p.tipo === 'costalero').length || 0
        }
    };

    return stats;
}
