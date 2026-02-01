'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Aviso {
    id: string;
    titulo: string;
    contenido: string;
    fecha_creacion: string;
}

export function DashboardAvisos() {
    const [latestAviso, setLatestAviso] = useState<Aviso | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLatest() {
            try {
                const { data, error } = await supabase
                    .from('avisos_internos')
                    .select('*')
                    .eq('activo', true)
                    .order('fecha_creacion', { ascending: false })
                    .limit(1)
                    .single();

                if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "Row not found"
                setLatestAviso(data);
            } catch (error) {
                console.error('Error fetching latest aviso:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchLatest();
    }, []);

    if (loading) return <div className="h-40 bg-slate-50 animate-pulse rounded-lg" />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Último Aviso</h3>
                <Link href="/redes-sociales">
                    <Button variant="link" className="text-primary text-xs p-0 h-auto">Ver todos</Button>
                </Link>
            </div>

            {!latestAviso ? (
                <Card className="border-dashed border-2 bg-slate-50">
                    <CardContent className="flex flex-col items-center justify-center py-6 text-slate-400">
                        <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No hay avisos recientes</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                {latestAviso.titulo}
                            </CardTitle>
                            <span className="text-xs text-slate-400">
                                {new Date(latestAviso.fecha_creacion).toLocaleDateString()}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm line-clamp-3 text-slate-600">
                            {latestAviso.contenido}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
