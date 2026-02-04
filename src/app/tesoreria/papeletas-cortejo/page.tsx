'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPapeletasDelAnio, getEstadisticasPapeletas } from '@/lib/papeletas-cortejo';
import { Card } from '@/components/ui/card';
import { Loader2, Search, Filter } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { VenderPapeletaDialog } from '@/components/cortejo/vender-papeleta-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';
import { eliminarPapeleta } from '@/lib/papeletas-cortejo';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button'; // Ensure Button is imported if not already, or keep existing

export default function PapeletasPage() {
    const { role } = useAuth();
    const canManage = role === 'SUPERADMIN' || role === 'JUNTA';
    const [filterEstado, setFilterEstado] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Delete state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [papeletaToDelete, setPapeletaToDelete] = useState<{ id: string, numero: number } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const queryClient = useQueryClient(); // Need queryClient for invalidation

    const { data: papeletas, isLoading } = useQuery({
        queryKey: ['papeletas-cortejo'],
        queryFn: () => getPapeletasDelAnio(),
    });

    const { data: stats } = useQuery({
        queryKey: ['papeletas-stats'],
        queryFn: () => getEstadisticasPapeletas(),
    });

    const filteredPapeletas = papeletas?.filter(p => {
        const matchesSearch =
            p.hermano?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.hermano?.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.numero.toString().includes(searchTerm);

        const matchesEstado = filterEstado === 'all' || p.estado === filterEstado;

        return matchesSearch && matchesEstado;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const handleDeleteClick = (id: string, numero: number) => {
        setPapeletaToDelete({ id, numero });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent auto-close
        if (!papeletaToDelete) return;

        setIsDeleting(true);
        try {
            await eliminarPapeleta(papeletaToDelete.id);
            toast.success(`Papeleta #${papeletaToDelete.numero} eliminada correctamente`);
            setDeleteDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['papeletas-cortejo'] });
            queryClient.invalidateQueries({ queryKey: ['papeletas-stats'] });
        } catch (error: unknown) {
            console.error('Error deleting:', error);
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al eliminar: ' + msg);
        } finally {
            setIsDeleting(false);
            setPapeletaToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">🎫 Papeletas de Sitio</h2>
                    <p className="text-muted-foreground">
                        Gestión de venta y control de papeletas para el cortejo.
                    </p>
                </div>
                {canManage && <VenderPapeletaDialog />}
            </div>

            {/* Estadísticas */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 bg-white border-l-4 border-l-blue-500">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Total Vendidas</p>
                        <p className="text-2xl font-black">{stats.total_vendidas}</p>
                    </Card>
                    <Card className="p-4 bg-white border-l-4 border-l-green-500">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Recaudado</p>
                        <p className="text-2xl font-black text-green-600">
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(stats.ingresos_totales)}
                        </p>
                    </Card>
                    <Card className="p-4 bg-white border-l-4 border-l-amber-500">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Pendientes Asignar</p>
                        <p className="text-2xl font-black text-amber-600">{stats.total_pendientes}</p>
                    </Card>
                    <Card className="p-4 bg-white border-l-4 border-l-purple-500">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Insignias</p>
                        <p className="text-2xl font-black text-purple-600">{stats.por_tipo.insignia}</p>
                    </Card>
                </div>
            )}

            {/* Filtros y Lista */}
            <Card className="p-4 bg-white">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por hermano o número..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={filterEstado} onValueChange={setFilterEstado}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="pagada">Pagada (Pendiente)</SelectItem>
                            <SelectItem value="asignada">Asignada</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nº</th>
                                <th className="px-4 py-3 font-medium">Hermano</th>
                                <th className="px-4 py-3 font-medium">Tipo</th>
                                <th className="px-4 py-3 font-medium">Importe</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Posición Asignada</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredPapeletas?.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                        No se encontraron papeletas.
                                    </td>
                                </tr>
                            ) : (
                                filteredPapeletas?.map((papeleta) => (
                                    <tr key={papeleta.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-bold text-slate-700">
                                            {papeleta.numero > 0 ? (
                                                `#${papeleta.numero}`
                                            ) : (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold whitespace-nowrap">
                                                    OFFLINE
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {papeleta.hermano?.nombre} {papeleta.hermano?.apellidos}
                                        </td>
                                        <td className="px-4 py-3 capitalize">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${papeleta.tipo === 'vara'
                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                : papeleta.tipo === 'bocina'
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    : papeleta.tipo === 'costalero'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}>
                                                {papeleta.tipo === 'vara' ? 'Vara / Insignia' : papeleta.tipo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(papeleta.importe)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${papeleta.estado === 'asignada'
                                                ? 'bg-green-100 text-green-700'
                                                : papeleta.estado === 'pagada'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}>
                                                {papeleta.estado === 'pagada' ? 'Pendiente' : papeleta.estado}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {papeleta.posicion ? (
                                                <span className="text-slate-700 font-medium">{papeleta.posicion.nombre}</span>
                                            ) : (
                                                <span className="text-xs italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {format(new Date(papeleta.fecha_pago), 'dd MMM yyyy', { locale: es })}
                                        </td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteClick(papeleta.id, papeleta.numero)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar la papeleta {papeletaToDelete?.numero && papeletaToDelete.numero > 0 ? `#${papeletaToDelete.numero}` : '(OFFLINE)'}.
                            Esta acción eliminará también el cobro asociado y liberará cualquier posición asignada.
                            <br /><br />
                            <span className="font-bold text-red-600">Esta acción no se puede deshacer.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
