'use client';

import { WifiOff, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export default function OfflinePage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <WifiOff className="w-10 h-10 text-amber-600" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">
                Sección no disponible offline
            </h1>

            <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                Esta página aún no ha sido guardada en tu dispositivo.
                Para acceder a ella sin internet, debes haberla visitado al menos una vez mientras estabas online.
            </p>

            <Card className="p-6 bg-slate-50 border-slate-200 max-w-sm w-full mb-8">
                <h2 className="text-sm font-bold uppercase text-slate-500 mb-4 tracking-wider text-left">
                    ¿Qué puedes hacer?
                </h2>
                <ul className="text-left space-y-3 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                        Vuelve al panel principal para gestionar datos ya cacheados.
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                        Revisa tu conexión a internet para cargar esta página.
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                        Una vez cargada, estará disponible incluso sin internet.
                    </li>
                </ul>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                    <Link href="/">
                        <Home className="w-4 h-4 mr-2" />
                        Ir al Inicio
                    </Link>
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver atrás
                </Button>
            </div>

            <p className="mt-12 text-xs text-slate-400 font-medium">
                Hermandad de la Soledad • Modo Offline Inteligente
            </p>
        </div>
    );
}
