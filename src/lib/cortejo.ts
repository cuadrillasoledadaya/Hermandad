import { supabase } from './supabase';

// =====================================================
// TIPOS Y CONSTANTES
// =====================================================

export const PASO_NOMBRES = {
    vera_cruz: 'Cristo de la Vera Cruz',
    santo_entierro: 'Santo Entierro',
    soledad: 'María Santísima en su Soledad'
} as const;

export type PasoId = keyof typeof PASO_NOMBRES;

export type PosicionTipo = 'cruz_guia' | 'insignia' | 'nazareno' | 'paso';
export type Lado = 'centro' | 'derecha' | 'izquierda';

export interface CortejoEstructura {
    id: string;
    nombre: string;
    tipo: PosicionTipo;
    tramo: number;
    posicion: number;
    lado: Lado | null;
    paso_asociado: PasoId | null;
    created_at: string;
}

export interface CortejoAsignacion {
    id: string;
    id_hermano: string;
    id_posicion: string;
    anio: number;
    numero_papeleta: number | null;
    fecha_asignacion: string;
    notas: string | null;
}

export interface PosicionConAsignacion extends CortejoEstructura {
    asignacion?: CortejoAsignacion & {
        hermano?: {
            id: string;
            nombre: string;
            apellidos: string;
        };
    };
}

export interface TramoData {
    numero: number;
    nombre: string;
    posiciones: PosicionConAsignacion[];
}

// =====================================================
// FUNCIONES DE CONSULTA
// =====================================================

/**
 * Obtiene toda la estructura del cortejo con asignaciones del año actual
 */
export async function getCortejoCompleto(anio?: number): Promise<TramoData[]> {
    const year = anio || new Date().getFullYear();

    // Obtener todas las posiciones
    const { data: posiciones, error: posError } = await supabase
        .from('cortejo_estructura')
        .select('*')
        .order('tramo', { ascending: true })
        .order('posicion', { ascending: true });

    if (posError) throw posError;

    // Obtener asignaciones del año
    const { data: asignaciones, error: asigError } = await supabase
        .from('cortejo_asignaciones')
        .select(`
            *,
            hermano:hermanos(id, nombre, apellidos)
        `)
        .eq('anio', year);

    if (asigError) throw asigError;

    // Mapear asignaciones por id_posicion
    const asignacionesMap = new Map(
        asignaciones?.map(a => [a.id_posicion, a]) || []
    );

    // Combinar estructura con asignaciones
    const posicionesConAsignacion: PosicionConAsignacion[] = (posiciones || []).map(pos => ({
        ...pos,
        asignacion: asignacionesMap.get(pos.id)
    }));

    // Agrupar por tramos
    const tramos: TramoData[] = [];
    const tramoMap = new Map<number, PosicionConAsignacion[]>();

    posicionesConAsignacion.forEach(pos => {
        if (!tramoMap.has(pos.tramo)) {
            tramoMap.set(pos.tramo, []);
        }
        tramoMap.get(pos.tramo)!.push(pos);
    });

    // Convertir a array ordenado
    Array.from(tramoMap.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([numero, posiciones]) => {
            const nombreTramo =
                numero === 0 ? 'Cruz de Guía' :
                    `Tramo ${numero}`;

            tramos.push({
                numero,
                nombre: nombreTramo,
                posiciones
            });
        });

    return tramos;
}

/**
 * Obtiene solo las posiciones de un tipo específico
 */
export async function getPosicionesPorTipo(
    tipo: PosicionTipo,
    anio?: number
): Promise<PosicionConAsignacion[]> {
    const year = anio || new Date().getFullYear();

    const { data: posiciones, error: posError } = await supabase
        .from('cortejo_estructura')
        .select('*')
        .eq('tipo', tipo)
        .order('tramo', { ascending: true })
        .order('posicion', { ascending: true });

    if (posError) throw posError;

    const { data: asignaciones, error: asigError } = await supabase
        .from('cortejo_asignaciones')
        .select(`
            *,
            hermano:hermanos(id, nombre, apellidos)
        `)
        .eq('anio', year)
        .in('id_posicion', posiciones?.map(p => p.id) || []);

    if (asigError) throw asigError;

    const asignacionesMap = new Map(
        asignaciones?.map(a => [a.id_posicion, a]) || []
    );

    return (posiciones || []).map(pos => ({
        ...pos,
        asignacion: asignacionesMap.get(pos.id)
    }));
}

/**
 * Obtiene todas las asignaciones de un año con detalles
 */
export interface AsignacionConDetalles extends CortejoAsignacion {
    hermano: {
        id: string;
        nombre: string;
        apellidos: string;
    };
    posicion: CortejoEstructura;
}

export async function getAsignacionesDelAnio(anio?: number): Promise<AsignacionConDetalles[]> {
    const year = anio || new Date().getFullYear();

    const { data, error } = await supabase
        .from('cortejo_asignaciones')
        .select(`
            *,
            hermano:hermanos(id, nombre, apellidos),
            posicion:cortejo_estructura(*)
        `)
        .eq('anio', year)
        .order('numero_papeleta', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data as AsignacionConDetalles[];
}

// =====================================================
// FUNCIONES DE ASIGNACIÓN
// =====================================================

export interface AsignarPosicionInput {
    id_hermano: string;
    id_posicion: string;
    anio?: number;
    numero_papeleta?: number;
    notas?: string;
}

/**
 * Asigna un hermano a una posición del cortejo
 */
export async function asignarPosicion(input: AsignarPosicionInput): Promise<CortejoAsignacion> {
    const year = input.anio || new Date().getFullYear();

    // Validación: verificar que el hermano no tiene ya una posición este año
    const { data: existente, error: checkError } = await supabase
        .from('cortejo_asignaciones')
        .select('id')
        .eq('id_hermano', input.id_hermano)
        .eq('anio', year)
        .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError;

    if (existente) {
        throw new Error('Este hermano ya tiene una posición asignada en esta temporada');
    }

    // Validación: verificar que la posición no está ocupada
    const { data: posicionOcupada, error: posError } = await supabase
        .from('cortejo_asignaciones')
        .select('id')
        .eq('id_posicion', input.id_posicion)
        .eq('anio', year)
        .single();

    if (posError && posError.code !== 'PGRST116') throw posError;

    if (posicionOcupada) {
        throw new Error('Esta posición ya está ocupada');
    }

    // Crear asignación
    const { data, error } = await supabase
        .from('cortejo_asignaciones')
        .insert({
            id_hermano: input.id_hermano,
            id_posicion: input.id_posicion,
            anio: year,
            numero_papeleta: input.numero_papeleta || null,
            notas: input.notas || null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Elimina una asignación
 */
export async function quitarAsignacion(id_asignacion: string): Promise<void> {
    const { error } = await supabase
        .from('cortejo_asignaciones')
        .delete()
        .eq('id', id_asignacion);

    if (error) throw error;
}

/**
 * Actualiza una asignación existente
 */
export async function actualizarAsignacion(
    id_asignacion: string,
    updates: Partial<Pick<CortejoAsignacion, 'numero_papeleta' | 'notas'>>
): Promise<CortejoAsignacion> {
    const { data, error } = await supabase
        .from('cortejo_asignaciones')
        .update(updates)
        .eq('id', id_asignacion)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Resetea todas las asignaciones de un año
 */
export async function resetearAsignaciones(anio?: number): Promise<void> {
    const year = anio || new Date().getFullYear();

    const { error } = await supabase
        .from('cortejo_asignaciones')
        .delete()
        .eq('anio', year);

    if (error) throw error;
}

// =====================================================
// FUNCIONES DE PAPELETAS
// =====================================================

export interface HermanoConPapeleta {
    id: string;
    nombre: string;
    apellidos: string;
    numero_papeleta: number | null;
    posicion_asignada: string | null;
    estado: 'asignado' | 'pendiente' | 'sin_papeleta';
}

interface AsignacionConPosicion {
    id_hermano: string;
    numero_papeleta: number | null;
    posicion: { nombre: string } | null;
}

/**
 * Obtiene todos los hermanos con su estado de papeleta
 */
export async function getHermanosConPapeletas(anio?: number): Promise<HermanoConPapeleta[]> {
    const year = anio || new Date().getFullYear();

    // Obtener todos los hermanos
    const { data: hermanos, error: hermError } = await supabase
        .from('hermanos')
        .select('id, nombre, apellidos')
        .order('apellidos');

    if (hermError) throw hermError;

    // Obtener asignaciones del año
    const { data: asignaciones, error: asigError } = await supabase
        .from('cortejo_asignaciones')
        .select(`
            id_hermano,
            numero_papeleta,
            posicion:cortejo_estructura(nombre)
        `)
        .eq('anio', year);

    if (asigError) throw asigError;

    const asignacionesMap = new Map<string, AsignacionConPosicion>(
        (asignaciones as unknown as AsignacionConPosicion[])?.map(a => [a.id_hermano, a]) || []
    );

    return (hermanos || []).map(hermano => {
        const asig = asignacionesMap.get(hermano.id);

        let estado: 'asignado' | 'pendiente' | 'sin_papeleta';
        if (asig && asig.posicion) {
            estado = 'asignado';
        } else if (asig && asig.numero_papeleta !== null) {
            estado = 'pendiente';
        } else {
            estado = 'sin_papeleta';
        }

        return {
            ...hermano,
            numero_papeleta: asig?.numero_papeleta || null,
            posicion_asignada: asig?.posicion?.nombre || null,
            estado
        };
    });
}

/**
 * Asigna número de papeleta a un hermano
 */
export async function asignarPapeleta(
    id_hermano: string,
    numero_papeleta: number,
    anio?: number
): Promise<void> {
    const year = anio || new Date().getFullYear();

    // Buscar si el hermano ya tiene asignación este año
    const { data: asignacion, error: findError } = await supabase
        .from('cortejo_asignaciones')
        .select('id')
        .eq('id_hermano', id_hermano)
        .eq('anio', year)
        .single();

    if (findError && findError.code !== 'PGRST116') throw findError;

    if (asignacion) {
        // Actualizar papeleta existente
        const { error } = await supabase
            .from('cortejo_asignaciones')
            .update({ numero_papeleta })
            .eq('id', asignacion.id);

        if (error) throw error;
    }
    // Si no tiene asignación aún, solo guardamos el número de papeleta
    // (se asignará posición después)
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

export interface CortejoStats {
    total_posiciones: number;
    posiciones_ocupadas: number;
    posiciones_libres: number;
    hermanos_con_papeleta: number;
    hermanos_sin_papeleta: number;
}

/**
 * Obtiene estadísticas del cortejo de un año
 */
export async function getEstadisticasCortejo(anio?: number): Promise<CortejoStats> {
    const year = anio || new Date().getFullYear();

    // Total de posiciones (excluyendo pasos)
    const { count: totalPosiciones, error: posError } = await supabase
        .from('cortejo_estructura')
        .select('*', { count: 'exact', head: true })
        .neq('tipo', 'paso');

    if (posError) throw posError;

    // Posiciones ocupadas
    const { count: posicionesOcupadas, error: ocupError } = await supabase
        .from('cortejo_asignaciones')
        .select('*', { count: 'exact', head: true })
        .eq('anio', year);

    if (ocupError) throw ocupError;

    // Hermanos con papeleta
    const { count: conPapeleta, error: papError } = await supabase
        .from('cortejo_asignaciones')
        .select('*', { count: 'exact', head: true })
        .eq('anio', year)
        .not('numero_papeleta', 'is', null);

    if (papError) throw papError;

    return {
        total_posiciones: totalPosiciones || 0,
        posiciones_ocupadas: posicionesOcupadas || 0,
        posiciones_libres: (totalPosiciones || 0) - (posicionesOcupadas || 0),
        hermanos_con_papeleta: conPapeleta || 0,
        hermanos_sin_papeleta: (posicionesOcupadas || 0) - (conPapeleta || 0)
    };
}
