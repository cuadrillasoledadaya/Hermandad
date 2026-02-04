import { supabase } from '@/lib/supabase';

export interface CandidatoSorteo {
    id_papeleta: string;
    id_hermano: string;
    nombre: string;
    apellidos: string;
    numero_hermano: number | null;
    antiguedad_hermandad: string | null;
    fecha_pago: string;
    tramo: number | null; // Nuevo campo
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

    const { data: allTickets, error: allError } = await supabase
        .from('papeletas_cortejo')
        .select(`
            id,
            fecha_pago,
            tramo,
            hermanos(
                id,
                nombre,
                apellidos,
                numero_hermano,
                fecha_alta
            )
        `)
        .ilike('estado', 'pagada')
        .ilike('tipo', tipo)
        .is('id_posicion_asignada', null)
        .order('fecha_pago', { ascending: true });

    if (allError) {
        console.error('[Sorteo] Fatal Error fetching tickets:', allError);
        throw allError;
    }

    console.log(`[Sorteo] Candidates found for '${tipo}': ${allTickets?.length || 0}`);

    if (!allTickets) return [];

    return allTickets.map((p) => {
        const h = Array.isArray(p.hermanos) ? p.hermanos[0] : p.hermanos;
        return {
            id_papeleta: p.id,
            id_hermano: h ? h.id : '',
            nombre: h ? h.nombre : 'Desconocido',
            apellidos: h ? h.apellidos : '',
            numero_hermano: h ? h.numero_hermano : 0,
            antiguedad_hermandad: h ? h.fecha_alta : null,
            fecha_pago: p.fecha_pago,
            tramo: p.tramo,
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

    interface RawHueco {
        id: string;
        nombre: string;
        tramo: number;
        posicion: number;
        asignaciones: { id: string }[];
    }

    // Cast data for safer processing
    const data = rawData as unknown as RawHueco[];

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
    // 1. Agrupar candidatos y huecos por Tramo
    // Nota: orden_global de hueco ya incluye el tramo (tramo * 1000 + posicion)
    // El tramo 'null' se sorteara de forma global o segun tipo.

    // Filtramos candidatos que coincidan con los tramos representados en los huecos
    // En el MVP, simplemente asignamos candidatos a huecos que tengan el MISMO tramo.

    const asignaciones: ResultadoSorteo[] = [];

    // Lista de tramos presentes
    const tramos = Array.from(new Set([...candidatos.map(c => c.tramo), ...huecos.map(h => Math.floor(h.orden_global / 1000))]));

    for (const tr of tramos) {
        const candidatosTramo = candidatos.filter(c => c.tramo === tr);
        const huecosTramo = huecos.filter(h => Math.floor(h.orden_global / 1000) === tr);

        if (candidatosTramo.length === 0 || huecosTramo.length === 0) continue;

        // A) Ordenar Candidatos del Tramo
        const tOrdenados = [...candidatosTramo].sort((a, b) => {
            if (criterio === 'antiguedad') {
                const numA = a.numero_hermano ?? 999999;
                const numB = b.numero_hermano ?? 999999;
                return numA - numB;
            }
            return new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime();
        });

        // B) Ordenar Huecos del Tramo
        // Regla: A mayor antigüedad, más cerca del paso (Mayor orden_global dentro del tramo)
        const hOrdenados = [...huecosTramo].sort((a, b) => {
            if (criterio === 'antiguedad') {
                return b.orden_global - a.orden_global; // DESC
            }
            return a.orden_global - b.orden_global; // ASC
        });

        const max = Math.min(tOrdenados.length, hOrdenados.length);
        for (let i = 0; i < max; i++) {
            asignaciones.push({
                candidato: tOrdenados[i],
                posicion: hOrdenados[i]
            });
        }
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
