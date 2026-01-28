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
import { getHermanos, type Pago } from '@/lib/brothers';
import { getMonthStatusForYear } from '@/lib/treasury';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
            return data as Pago[];
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
        <div className="overflow-x-auto rounded-lg border bg-white shadow-inner">
            <Table className="min-w-[1100px] border-collapse">
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="w-[200px] sticky left-0 bg-white z-20 font-bold border-r-2 border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Hermano</TableHead>
                        {MONTHS.map((month) => (
                            <TableHead key={month} className="text-center w-[60px] font-bold border-r border-slate-100">{month}</TableHead>
                        ))}
                        {canPay && <TableHead className="text-center font-bold bg-white sticky right-0 z-20 border-l-2 border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Acción</TableHead>}
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
                                <TableCell className="font-semibold sticky left-0 bg-white z-10 border-r-2 border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] whitespace-nowrap px-4">
                                    <span className="text-primary/60 mr-2 text-xs font-mono">{hermano.numero_hermano?.toString().padStart(3, '0')}</span>
                                    {hermano.nombre} {hermano.apellidos}
                                </TableCell>
                                {MONTHS.map((_, index) => {
                                    const status = getMonthStatusForYear(hermano, pagos.filter(p => p.id_hermano === hermano.id), currentYear, index);
                                    return (
                                        <TableCell
                                            key={index}
                                            className={cn(
                                                "w-[60px] h-12 transition-colors border-r border-slate-100 last:border-r-0 text-center p-0",
                                                status === 'PAID' && "bg-green-50",
                                                status === 'PENDING' && "bg-white",
                                                status === 'OVERDUE' && "bg-red-50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-full h-full flex items-center justify-center",
                                                status === 'PAID' && "text-green-700 font-bold",
                                                status === 'OVERDUE' && "text-red-700 font-bold"
                                            )}>
                                                {status === 'PAID' && "✓"}
                                                {status === 'OVERDUE' && "!"}
                                            </div>
                                        </TableCell>
                                    );
                                })}
                                {canPay && (
                                    <TableCell className="text-center p-0 sticky right-0 bg-white z-10 border-l-2 border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                        <Link href={`/tesoreria/pago/${hermano.id}`}>
                                            <Button variant="ghost" size="icon" className="h-12 w-full text-primary hover:bg-primary/5 rounded-none">
                                                <PlusCircle className="h-5 w-5" />
                                            </Button>
                                        </Link>
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
