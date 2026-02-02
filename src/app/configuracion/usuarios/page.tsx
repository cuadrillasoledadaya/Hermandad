'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldCheck, Search, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

interface Brother {
    id: string;
    nombre: string;
    apellidos: string;
    numero_hermano: number | null;
    rol: string;
}

export default function UsuariosPage() {
    const { role } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: brothers = [], isLoading } = useQuery<Brother[]>({
        queryKey: ['hermanos-roles'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('hermanos')
                .select('id, nombre, apellidos, numero_hermano, rol')
                .order('numero_hermano', { ascending: true });
            if (error) throw error;
            return data as Brother[];
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ id, newRole }: { id: string; newRole: string }) => {
            const { error } = await supabase
                .from('hermanos')
                .update({ rol: newRole })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hermanos-roles'] });
            toast.success('Rol actualizado correctamente');
        },
        onError: (error: Error) => {
            toast.error('Error al actualizar el rol: ' + error.message);
        }
    });

    if (role !== 'SUPERADMIN' && role !== 'JUNTA') {
        return (
            <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-slate-900">Acceso Restringido</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Esta sección solo es accesible para usuarios con el rol de SUPERADMIN o JUNTA.
                </p>
            </div>
        );
    }

    const filteredBrothers = brothers.filter(b =>
        `${b.nombre} ${b.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.numero_hermano?.toString() || '').includes(searchTerm)
    );

    const getRoleBadge = (rol: string) => {
        switch (rol) {
            case 'SUPERADMIN': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 transition-none">SUPERADMIN</Badge>;
            case 'JUNTA': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 transition-none">JUNTA</Badge>;
            default: return <Badge variant="outline" className="text-slate-500">HERMANO</Badge>;
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 py-6 px-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestión de Usuarios y Roles</h1>
                    <p className="text-slate-500 text-sm">Asigna cargos y privilegios de acceso a los hermanos.</p>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar hermano por nombre o número..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                    <TableHead className="w-20">Nº Hno</TableHead>
                                    <TableHead>Nombre Completo</TableHead>
                                    <TableHead>Rol Actual</TableHead>
                                    <TableHead className="text-right">Asignar Nuevo Rol</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Cargando hermanos...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredBrothers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No se encontraron resultados para &quot;{searchTerm}&quot;
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredBrothers.map((brother) => (
                                        <TableRow key={brother.id} className="hover:bg-slate-50/50">
                                            <TableCell className="font-medium">{brother.numero_hermano || '-'}</TableCell>
                                            <TableCell>{brother.nombre} {brother.apellidos}</TableCell>
                                            <TableCell>{getRoleBadge(brother.rol)}</TableCell>
                                            <TableCell className="text-right">
                                                <Select
                                                    defaultValue={brother.rol}
                                                    onValueChange={(value) => updateRoleMutation.mutate({ id: brother.id, newRole: value })}
                                                    disabled={updateRoleMutation.isPending}
                                                >
                                                    <SelectTrigger className="w-[180px] ml-auto h-8 text-xs">
                                                        <SelectValue placeholder="Cambiar rol" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="HERMANO">HERMANO</SelectItem>
                                                        <SelectItem value="JUNTA">JUNTA DE GOBIERNO</SelectItem>
                                                        <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
