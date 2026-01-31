import { supabase } from '@/lib/supabase';

export interface CandidatoSorteo {
    id_papeleta: string;
    id_hermano: string;
    nombre: string;
    apellidos: string;
    numero_hermano: number | null;
    antiguedad_hermandad: string | null; // fecha ingreso
    fecha_pago: string;
}

export interface HuecoLibre {
    id_posicion: string;
    nombre: string; // "Tramo 1 - Pareja 3 - Izquierda"
    orden_global: number;
}

export interface ResultadoSorteo {
    candidato: CandidatoSorteo;
    posicion: HuecoLibre;
}

export async function getCandidatos(tipo: string): Promise<CandidatoSorteo[]> {
    // Debug log
    console.log(`[Sorteo] Fetching candidatos for tipo: ${tipo}`);

    const { data, error } = await supabase
        .from('papeletas_cortejo')
        .select(`
            id,
            fecha_pago,
            hermanos(
                id,
                nombre,
                apellidos,
                numero_hermano,
                fecha_ingreso
            )
        `)
        .ilike('estado', 'pagada') // Case insensitive check for 'pagada', 'Pagada', etc.
        .ilike('tipo', tipo)
        .is('id_posicion_asignada', null)
        .order('fecha_pago', { ascending: true });

    if (error) {
        console.error('[Sorteo] Error fetching candidatos:', error);
        throw error;
    }

    console.log(`[Sorteo] Found ${data?.length || 0} candidates`);

    return data.map((p) => {
        const h = Array.isArray(p.hermanos) ? p.hermanos[0] : p.hermanos;
        return {
            id_papeleta: p.id,
            id_hermano: h ? h.id : '',
            nombre: h ? h.nombre : 'Desconocido',
            apellidos: h ? h.apellidos : '',
            numero_hermano: h ? h.numero_hermano : 0,
            antiguedad_hermandad: h ? h.fecha_ingreso : null,
            fecha_pago: p.fecha_pago,
        };
    }) as CandidatoSorteo[];
}

export async function getHuecosLibres(tipo: string, tramoId?: string): Promise<HuecoLibre[]> {
    let query = supabase
        .from('cortejo_estructura')
        .select(`
            id,
            nombre,
            tramo,
            posicion,
            asignaciones: cortejo_asignaciones(id)
            `)
        .eq('tipo', tipo);

    if (tramoId) {
        query = query.eq('parent_id', tramoId);
    }

    const { data: rawData, error } = await query
        .order('tramo', { ascending: true })
        .order('posicion', { ascending: true });

    if (error) throw error;

    // Cast data for safer processing
    const data = rawData as unknown as { id: string; nombre: string; tramo: number; posicion: number; asignaciones: any[] }[];

    // Filtrar los que NO tienen asignación (array vacio)
    const libres = data.filter((pos) => pos.asignaciones.length === 0);

    return libres.map((pos) => ({
        id_posicion: pos.id,
        nombre: pos.nombre,
        orden_global: ((pos.tramo || 99) * 1000) + (pos.posicion || 0)
    }));
}

export function simularSorteo(
    candidatos: CandidatoSorteo[],
    huecos: HuecoLibre[],
    criterio: 'antiguedad' | 'orden_llegada' = 'antiguedad'
): ResultadoSorteo[] {
    // 1. Ordenar Candidatos
    const candidatosOrdenados = [...candidatos].sort((a, b) => {
        if (criterio === 'antiguedad') {
            // Menor número de hermano va primero (o fecha ingreso más antigua)
            const numA = a.numero_hermano ?? 999999;
            const numB = b.numero_hermano ?? 999999;
            return numA - numB;
        } else {
            // Orden llegada (fecha pago)
            return new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime();
        }
    });

    // 2. Ordenar Huecos (por orden de cortejo)
    const huecosOrdenados = [...huecos].sort((a, b) => a.orden_global - b.orden_global);

    // 3. Asignar
    const asignaciones: ResultadoSorteo[] = [];
    const max = Math.min(candidatosOrdenados.length, huecosOrdenados.length);

    for (let i = 0; i < max; i++) {
        asignaciones.push({
            candidato: candidatosOrdenados[i],
            posicion: huecosOrdenados[i]
        });
    }

    return asignaciones;
}

export async function confirmarAsignacionMasiva(resultados: ResultadoSorteo[]) {
    // Esto debería hacerse idealmente en una transacción o RPC para atomicidad.
    // Por ahora, iteramos (no es lo más eficiente pero funciona para MVP).
    const updates = resultados.map(async (res) => {
        // 1. Crear asignación en cortejo_asignaciones
        const { error: assignError } = await supabase
            .from('cortejo_asignaciones')
            .insert({
                id_posicion: res.posicion.id_posicion,
                id_hermano: res.candidato.id_hermano,
                anio: new Date().getFullYear(), // O la temporada activa
                forma_asignacion: 'sorteo'
            });

        if (assignError) throw assignError;

        // 2. Actualizar papeleta con id_posicion_asignada
        const { error: papeletaError } = await supabase
            .from('papeletas_cortejo')
            .update({
                id_posicion_asignada: res.posicion.id_posicion,
                estado: 'asignada'
            })
            .eq('id', res.candidato.id_papeleta);

        if (papeletaError) throw papeletaError;
    });

    await Promise.all(updates);
}
