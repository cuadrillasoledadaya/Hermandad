import { differenceInMonths, startOfMonth } from 'date-fns';
import { type Hermano, type Pago } from './brothers';
import { supabase } from './supabase';
import { getPreciosConfig } from './configuracion';

// Helper to get formatted concept string for a season month
export function getConceptString(seasonYear: number, seasonMonthIdx: number) {
    const { calendarYear } = getCalendarMonthAndYear(seasonYear, seasonMonthIdx);
    const shortMonth = MONTHS[seasonMonthIdx];
    const fullMonth = MONTHS_FULL[seasonMonthIdx];
    return `Cuota ${fullMonth} (${shortMonth}-${calendarYear})`;
}

export async function getActiveSeason() {
    try {
        // Timeout de 1 segundo para caer rápido a offline
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 1000);
        });

        const supabaseQuery = supabase
            .from('temporadas')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();

        const { data, error } = await Promise.race([supabaseQuery, timeoutPromise]);

        if (error) {
            if (error.message?.toLowerCase().includes('fetch') || !error.code) throw new Error('offline');
            throw error;
        }

        // Cachear en meta para offline
        if (data && typeof window !== 'undefined') {
            const { setSyncMetadata } = await import('./db');
            await setSyncMetadata('active_season', data);
        }

        return data;
    } catch (e) {
        const errorMsg = (e as Error).message;
        if (errorMsg === 'offline' || errorMsg?.includes('fetch') || errorMsg === 'timeout') {
            console.log('📦 [TREASURY] Offline/timeout detected (Season), fetching from metadata');
            const { getSyncMetadata } = await import('./db');
            const cached = await getSyncMetadata('active_season');
            if (cached) return cached;

            // Retornar temporada por defecto si no hay cache
            const currentYear = new Date().getFullYear();
            console.log('📦 [TREASURY] Usando temporada por defecto:', currentYear);
            return { id: 1, anio: currentYear, is_active: true, fecha_inicio: `${currentYear}-03-01`, fecha_fin: `${currentYear + 1}-02-28` };
        }
        throw e;
    }
}

export const MONTHS = ['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb'];
export const MONTHS_FULL = ['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero'];

// Helper to convert season index (0=Mar, 11=Feb) to calendar month and year offset
export function getCalendarMonthAndYear(seasonYear: number, seasonMonthIdx: number) {
    const calendarMonth = (seasonMonthIdx + 2) % 12;
    const yearOffset = seasonMonthIdx >= 10 ? 1 : 0;
    return { calendarMonth, calendarYear: seasonYear + yearOffset };
}

export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE';

export async function calculateHermanoStatus(hermano: Hermano, pagos: Pago[]): Promise<PaymentStatus> {
    const config = await getPreciosConfig();
    const cuotaMensual = config.cuota_mensual_hermano;

    const altaDate = startOfMonth(new Date(hermano.fecha_alta));
    const today = startOfMonth(new Date());

    const monthsSinceAlta = Math.max(0, differenceInMonths(today, altaDate) + 1);
    const totalRequired = monthsSinceAlta * cuotaMensual;

    const totalPaid = pagos.reduce((acc, pago) => acc + pago.cantidad, 0);

    // Deuda actual (teórica)
    const debt = totalRequired - totalPaid;

    if (debt <= 0) {
        return 'PAID';
    } else if (debt <= cuotaMensual) {
        // Si solo debe el mes actual, lo marcamos como pendiente (blanco)
        return 'PENDING';
    } else {
        // Si debe más de un mes o el mes de gracia ha pasado
        return 'OVERDUE';
    }
}

export function getMonthStatusForYear(hermano: Hermano, pagos: Pago[], seasonYear: number, seasonMonthIdx: number): PaymentStatus {
    const { calendarMonth, calendarYear } = getCalendarMonthAndYear(seasonYear, seasonMonthIdx);
    const cellDate = new Date(calendarYear, calendarMonth);
    const altaDate = startOfMonth(new Date(hermano.fecha_alta));

    if (cellDate < altaDate) return 'PAID';

    const shortMonth = MONTHS[seasonMonthIdx];
    const fullMonth = MONTHS_FULL[seasonMonthIdx];

    // Check if there's a payment for this specific season month
    // We search by concept or by the base season year + specific month
    const hasPaidThisMonth = pagos.find(p => {
        const concept = p.concepto.toLowerCase();
        const matchesConcept = concept.includes(`${shortMonth.toLowerCase()}-${seasonYear}`) ||
            concept.includes(`${fullMonth.toLowerCase()}`);
        return matchesConcept && p.anio === seasonYear;
    });

    if (hasPaidThisMonth) return 'PAID';

    const today = startOfMonth(new Date());
    if (cellDate < today) return 'OVERDUE';

    return 'PENDING';
}

export function getPendingMonthsForSeason(hermano: Hermano, pagos: Pago[], seasonYear: number): number[] {
    const pending: number[] = [];
    const altaDate = startOfMonth(new Date(hermano.fecha_alta));
    const today = startOfMonth(new Date());

    for (let i = 0; i < 12; i++) {
        const { calendarMonth, calendarYear } = getCalendarMonthAndYear(seasonYear, i);
        const cellDate = new Date(calendarYear, calendarMonth);

        // Skip if before alta
        if (cellDate < altaDate) continue;

        // Skip if future month (beyond today)
        if (cellDate > today) continue;

        const status = getMonthStatusForYear(hermano, pagos, seasonYear, i);
        if (status === 'OVERDUE' || status === 'PENDING') {
            pending.push(i);
        }
    }

    return pending;
}
