'use client';

import { useState } from 'react';
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
    const [expandedBrotherId, setExpandedBrotherId] = useState<string | null>(null);

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

    if (hermanos.length === 0) {
        return (
            <div className="bg-white rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
                <p>No hay hermanos registrados en el censo.</p>
                <p className="text-xs">Usa el apartado de Hermanos para dar de alta nuevos registros.</p>
            </div>
        );
    }

    const currentMonthIndex = new Date().getMonth();

    return (
        <div className="space-y-4">
            {/* VISTA MÓVIL: Tarjetas Expansibles */}
            <div className="block md:hidden space-y-3">
                {hermanos.map((hermano) => {
                    const isExpanded = expandedBrotherId === hermano.id;
                    const brotherPagos = pagos.filter(p => p.id_hermano === hermano.id);
                    const isOverdue = MONTHS.slice(0, currentMonthIndex).some((_, idx) =>
                        getMonthStatusForYear(hermano, brotherPagos, currentYear, idx) === 'OVERDUE'
                    );

                    return (
                        <div
                            key={hermano.id}
                            className={cn(
                                "relative bg-white border-2 rounded-xl transition-all overflow-hidden",
                                isExpanded ? "border-primary shadow-md" : "border-slate-100 shadow-sm",
                                isOverdue && !isExpanded && "border-red-100"
                            )}
                        >
                            {/* Indicador de Morosidad Flotante */}
                            {isOverdue && (
                                <div className="absolute -top-1 -left-1 z-30">
                                    <div className="flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded-full shadow-lg border-2 border-white animate-pulse">
                                        <span className="text-[10px] font-black">!</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center p-3 gap-3">
                                <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                    {hermano.numero_hermano?.toString().padStart(3, '0')}
                                </span>
                                <button
                                    onClick={() => setExpandedBrotherId(isExpanded ? null : hermano.id)}
                                    className="flex-1 text-left font-semibold text-slate-800"
                                >
                                    {hermano.nombre} {hermano.apellidos}
                                </button>
                                {canPay && (
                                    <Link href={`/tesoreria/pago/${hermano.id}`}>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-primary bg-slate-50 border shadow-sm">
                                            <PlusCircle className="h-5 w-5" />
                                        </Button>
                                    </Link>
                                )}
                            </div>

                            {isExpanded && (
                                <div className="border-t-2 border-primary/10 bg-slate-50/50 p-3 pt-0">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-3">Estado Mensual {currentYear}</p>
                                    <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-none snap-x">
                                        {MONTHS.map((month, index) => {
                                            const status = getMonthStatusForYear(hermano, brotherPagos, currentYear, index);
                                            return (
                                                <div
                                                    key={index}
                                                    className={cn(
                                                        "min-w-[50px] flex flex-col items-center gap-1 p-2 rounded-lg border shadow-sm snap-start",
                                                        status === 'PAID' ? "bg-green-100 border-green-200" :
                                                            status === 'OVERDUE' ? "bg-red-100 border-red-200" : "bg-white border-slate-200"
                                                    )}
                                                >
                                                    <span className="text-[9px] font-bold uppercase text-slate-500">{month}</span>
                                                    <span className={cn(
                                                        "text-xs font-black",
                                                        status === 'PAID' ? "text-green-700" :
                                                            status === 'OVERDUE' ? "text-red-700" : "text-slate-300"
                                                    )}>
                                                        {status === 'PAID' ? "✓" : status === 'OVERDUE' ? "!" : "•"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] text-center text-slate-400 mt-2 italic">Desliza para ver todos los meses</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* VISTA DESKTOP: Tabla Robusta */}
            <div className="hidden md:block overflow-x-auto rounded-xl border-2 border-slate-200 bg-white shadow-sm">
                <Table className="min-w-[1000px] border-collapse">
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-[200px] sticky left-0 bg-white z-20 font-bold border-r-2 border-slate-200 px-4">Hermano</TableHead>
                            {MONTHS.map((month) => (
                                <TableHead key={month} className="text-center w-[60px] font-bold border-r border-slate-100">{month}</TableHead>
                            ))}
                            {canPay && <TableHead className="text-center font-bold bg-white sticky right-0 z-20 border-l-2 border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.02)]">Acción</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {hermanos.map((hermano) => {
                            const brotherPagos = pagos.filter(p => p.id_hermano === hermano.id);
                            const isOverdue = MONTHS.slice(0, currentMonthIndex).some((_, idx) =>
                                getMonthStatusForYear(hermano, brotherPagos, currentYear, idx) === 'OVERDUE'
                            );

                            return (
                                <TableRow key={hermano.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-semibold sticky left-0 bg-white z-10 border-r-2 border-slate-200 whitespace-nowrap px-4 py-3">
                                        <div className="flex items-center">
                                            {isOverdue && (
                                                <div className="mr-2 flex items-center justify-center w-4 h-4 bg-red-600 text-white rounded-full scale-75 shadow-sm">
                                                    <span className="text-[8px] font-black">!</span>
                                                </div>
                                            )}
                                            <span className="text-primary/60 mr-2 text-[10px] font-mono opacity-70">{hermano.numero_hermano?.toString().padStart(3, '0')}</span>
                                            <span className="text-sm">{hermano.nombre} {hermano.apellidos}</span>
                                        </div>
                                    </TableCell>
                                    {MONTHS.map((_, index) => {
                                        const status = getMonthStatusForYear(hermano, brotherPagos, currentYear, index);
                                        return (
                                            <TableCell
                                                key={index}
                                                className={cn(
                                                    "w-[60px] h-12 transition-colors border-r border-slate-100 last:border-r-0 text-center p-0",
                                                    status === 'PAID' && "bg-green-50/50",
                                                    status === 'PENDING' && "bg-white",
                                                    status === 'OVERDUE' && "bg-red-50/50"
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
                                        <TableCell className="text-center p-0 sticky right-0 bg-white z-10 border-l-2 border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.02)]">
                                            <Link href={`/tesoreria/pago/${hermano.id}`}>
                                                <Button variant="ghost" size="icon" className="h-12 w-full text-primary hover:bg-primary/5 rounded-none">
                                                    <PlusCircle className="h-5 w-5" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
