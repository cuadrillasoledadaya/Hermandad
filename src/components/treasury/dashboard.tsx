'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { getHermanos, type Hermano } from '@/lib/brothers';
import { getMonthStatusForYear } from '@/lib/treasury';
import { cn } from '@/lib/utils';
import { AddPaymentDialog } from './add-payment-dialog';
import { useAuth } from '@/components/providers/auth-provider';

interface Pago {
    id_hermano: string;
    fecha_pago: string;
    cantidad: number;
    concepto: string;
    anio: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function TreasuryDashboard() {
    const currentYear = new Date().getFullYear();
    const { role } = useAuth();
    const canPay = role === 'SUPERADMIN' || role === 'JUNTA';

    const { data: hermanos = [], isLoading: loadingHermanos } = useQuery({
        queryKey: ['hermanos'],
        queryFn: getHermanos,
    });

    const { data: pagos = [], isLoading: loadingPagos } = useQuery<Pago[]>({
        queryKey: ['pagos', currentYear],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pagos')
                .select('*')
                .eq('anio', currentYear);
            if (error) throw error;
            return data;
        },
    });

    if (loadingHermanos || loadingPagos) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground animate-pulse text-sm">Cargando datos de tesorería...</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/30">
                        <TableHead className="w-[200px] sticky left-0 bg-card z-10 font-bold border-r">Hermano</TableHead>
                        {MONTHS.map((month) => (
                            <TableHead key={month} className="text-center min-w-[60px] font-bold">{month}</TableHead>
                        ))}
                        {canPay && <TableHead className="text-center font-bold">Acción</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {hermanos.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={13} className="text-center h-48 text-muted-foreground">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <p>No hay hermanos registrados en el censo.</p>
                                    <p className="text-xs">Usa el apartado de Hermanos para dar de alta nuevos registros.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        hermanos.map((hermano) => (
                            <TableRow key={hermano.id} className="hover:bg-muted/20">
                                <TableCell className="font-medium sticky left-0 bg-card z-10 border-r whitespace-nowrap">
                                    <span className="text-primary/60 mr-2">{hermano.numero_hermano}.</span>
                                    {hermano.nombre} {hermano.apellidos}
                                </TableCell>
                                {MONTHS.map((_, index) => {
                                    const status = getMonthStatusForYear(hermano, pagos.filter(p => p.id_hermano === hermano.id), currentYear, index);
                                    return (
                                        <TableCell
                                            key={index}
                                            className={cn(
                                                "w-12 h-10 transition-colors border-r last:border-r-0 text-center p-0",
                                                status === 'PAID' && "bg-green-100/40",
                                                status === 'PENDING' && "bg-white",
                                                status === 'OVERDUE' && "bg-red-100/40"
                                            )}
                                        />
                                    );
                                })}
                                {canPay && (
                                    <TableCell className="text-center p-1">
                                        <AddPaymentDialog
                                            id_hermano={hermano.id}
                                            nombre_hermano={`${hermano.nombre} ${hermano.apellidos}`}
                                        />
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
