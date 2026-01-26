import { differenceInMonths, startOfMonth, format } from 'date-fns';

export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE';

export interface Hermano {
    id: string;
    nombre: string;
    apellidos: string;
    fecha_alta: string;
    numero_hermano: number;
}

export interface Pago {
    id_hermano: string;
    fecha_pago: string;
    cantidad: number;
    concepto: string;
    anio: number;
}

const CUOTA_MENSUAL = 10; // This should be configurable later

export function calculateHermanoStatus(hermano: Hermano, pagos: Pago[]): PaymentStatus {
    const altaDate = startOfMonth(new Date(hermano.fecha_alta));
    const today = startOfMonth(new Date());

    const monthsSinceAlta = Math.max(0, differenceInMonths(today, altaDate) + 1);
    const totalRequired = monthsSinceAlta * CUOTA_MENSUAL;

    const totalPaid = pagos.reduce((acc, pago) => acc + pago.cantidad, 0);

    // Deuda actual (teórica)
    const debt = totalRequired - totalPaid;

    if (debt <= 0) {
        return 'PAID';
    } else if (debt <= CUOTA_MENSUAL) {
        // Si solo debe el mes actual, lo marcamos como pendiente (blanco)
        return 'PENDING';
    } else {
        // Si debe más de un mes o el mes de gracia ha pasado
        return 'OVERDUE';
    }
}

export function getMonthStatusForYear(hermano: Hermano, pagos: Pago[], year: number, month: number): PaymentStatus {
    // Logic to determine status for a specific month/year cell in the grid
    // This is slightly different from the global status
    const cellDate = new Date(year, month);
    const altaDate = startOfMonth(new Date(hermano.fecha_alta));

    if (cellDate < altaDate) return 'PAID'; // Before registration, essentially "not applicable" but shown as paid/neutral

    const conceptString = `${format(cellDate, 'MMM')}-${year}`;
    const hasPaidThisMonth = pagos.find(p => p.concepto.includes(conceptString) || (p.anio === year && new Date(p.fecha_pago).getMonth() === month));

    if (hasPaidThisMonth) return 'PAID';

    const today = startOfMonth(new Date());
    if (cellDate < today) return 'OVERDUE';

    return 'PENDING';
}
