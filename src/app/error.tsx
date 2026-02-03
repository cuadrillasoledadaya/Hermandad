'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Loguear error a consola o servicio de tracking
        console.error('Error en ruta:', error);
    }, [error]);

    return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
            <p className="text-gray-600 mb-4 text-center max-w-md">
                Ha ocurrido un error al cargar esta página. Puedes intentar recargar.
            </p>
            <div className="flex gap-3">
                <Button onClick={reset} variant="default">
                    Intentar de nuevo
                </Button>
                <Button onClick={() => window.location.href = '/'} variant="outline">
                    Ir al inicio
                </Button>
            </div>
            {process.env.NODE_ENV === 'development' && (
                <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto max-w-full">
                    {error.message}
                    {error.stack}
                </pre>
            )}
        </div>
    );
}
