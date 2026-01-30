'use client';

import { useState } from 'react';
import { SidebarWrapper } from '@/components/layout/sidebar-wrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCandidatosNazarenos, getHuecosLibresNazarenos, simularSorteo, confirmarAsignacionMasiva, type ResultadoSorteo } from '@/lib/sorteo';
import { Loader2, Users, ArrowRight, Save, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SorteoPage() {
    const queryClient = useQueryClient();
    const [criterio, setCriterio] = useState<'antiguedad' | 'orden_llegada'>('antiguedad');
    const [simulacion, setSimulacion] = useState<ResultadoSorteo[] | null>(null);

    // 1. Fetch Datos
    const { data: candidatos = [], isLoading: loadingCandidatos } = useQuery({
        queryKey: ['sorteo-candidatos'],
        queryFn: getCandidatosNazarenos
    });

    const { data: huecos = [], isLoading: loadingHuecos } = useQuery({
        queryKey: ['sorteo-huecos'],
        queryFn: () => getHuecosLibresNazarenos() // Sin filtro tramo por ahora, global nazarenos
    });

    // 2. Mutación Confirmar
    const confirmarMutation = useMutation({
        mutationFn: confirmarAsignacionMasiva,
        onSuccess: () => {
            toast.success("Asignaciones guardadas correctamente");
            setSimulacion(null);
            queryClient.invalidateQueries({ queryKey: ['sorteo-candidatos'] });
            queryClient.invalidateQueries({ queryKey: ['sorteo-huecos'] });
            queryClient.invalidateQueries({ queryKey: ['cortejo-completo'] }); // Para la vista principal
        },
        onError: (err) => {
            toast.error("Error al guardar: " + err.message);
        }
    });

    const handleSimular = () => {
        const result = simularSorteo(candidatos, huecos, criterio);
        setSimulacion(result);
        toast.info(`Simulación completada. ${result.length} posibles asignaciones.`);
    };

    const handleConfirmar = () => {
        if (!simulacion) return;
        confirmarMutation.mutate(simulacion);
    };

    const loading = loadingCandidatos || loadingHuecos;

    return (
        <SidebarWrapper>
            <div className="p-6">
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-[#1a2b4b]">Sorteo de Sitios</h1>
                            <p className="text-slate-500">Asignación automática de posiciones para tramos con alta demanda.</p>
                        </div>
                        {simulacion && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setSimulacion(null)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="bg-[#d4af37] hover:bg-[#b0902d] text-white"
                                    onClick={handleConfirmar}
                                    disabled={confirmarMutation.isPending}
                                >
                                    {confirmarMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    <Save className="w-4 h-4 mr-2" />
                                    Confirmar Asignación
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Demanda (Solicitantes)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{candidatos.length}</div>
                                <p className="text-xs text-muted-foreground">Papeletas pagadas sin sitio</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Oferta (Huecos Libres)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-600">{huecos.length}</div>
                                <p className="text-xs text-muted-foreground">Posiciones de cirio vacías</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Cobertura</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {candidatos.length > 0 ?
                                        Math.min(100, Math.round((huecos.length / candidatos.length) * 100))
                                        : 100}%
                                </div>
                                <p className="text-xs text-muted-foreground">Solicitudes que pueden cubrirse</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Controles y Listas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Panel Izquierdo: Configuración y Candidatos */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Configuración</CardTitle>
                                    <CardDescription>Define cómo se ordenarán los candidatos</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Criterio de Prioridad</label>
                                        <Select value={criterio} onValueChange={(v: 'antiguedad' | 'orden_llegada') => setCriterio(v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="antiguedad">Antigüedad (Nº Hermano)</SelectItem>
                                                <SelectItem value="orden_llegada">Orden de Pago (Fecha)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button className="w-full" onClick={handleSimular} disabled={loading || candidatos.length === 0 || huecos.length === 0}>
                                        <Shuffle className="w-4 h-4 mr-2" />
                                        Simular Asignación
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Candidatos en Espera</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                                    ) : (
                                        <div className="h-[400px] overflow-auto border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Hno.</TableHead>
                                                        <TableHead>Nombre</TableHead>
                                                        <TableHead>Antigüedad</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {candidatos.map((c) => (
                                                        <TableRow key={c.id_papeleta}>
                                                            <TableCell>{c.numero_hermano || '-'}</TableCell>
                                                            <TableCell>{c.nombre} {c.apellidos}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {new Date(c.antiguedad_hermandad || 0).getFullYear()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {candidatos.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="text-center py-4">No hay candidatos pendientes</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Panel Derecho: Resultados Simulación */}
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle>Resultados de Simulación</CardTitle>
                                <CardDescription>
                                    {simulacion ?
                                        `Se asignarían ${simulacion.length} plazas.` :
                                        "Ejecuta una simulación para ver los resultados."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 min-h-[400px]">
                                {!simulacion ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                                        <Users className="w-16 h-16" />
                                        <p>Esperando simulación...</p>
                                    </div>
                                ) : (
                                    <div className="h-[600px] overflow-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Hermano</TableHead>
                                                    <TableHead><ArrowRight className="w-4 h-4" /></TableHead>
                                                    <TableHead>Posición Asignada</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {simulacion.map((res, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>
                                                            <div className="font-medium">{res.candidato.nombre} {res.candidato.apellidos}</div>
                                                            <div className="text-xs text-muted-foreground mr-2">Hno: {res.candidato.numero_hermano}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <ArrowRight className="w-4 h-4 text-emerald-500" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                {res.posicion.nombre}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </SidebarWrapper>
    );
}
