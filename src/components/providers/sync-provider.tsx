'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { db } from '@/lib/db/database';
import { networkMonitor } from '@/lib/sync/network-monitor';

interface PreloadStatus {
    hermanos: boolean;
    pagos: boolean;
    papeletas: boolean;
    configuracion: boolean;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>({
        hermanos: false,
        pagos: false,
        papeletas: false,
        configuracion: false
    });
    const { user, loading: authLoading } = useAuth();

    const isAuthPage = pathname === '/login' || pathname === '/register';

    const preloadData = useCallback(async () => {
        if (!user) return;

        console.log('[SyncProvider] Iniciando precarga...');

        try {
            const network = networkMonitor.getState();
            if (!network.isOnline) {
                console.log('[SyncProvider] Sin conexión, usando datos locales');
                return;
            }

            // Precargar en paralelo sin bloquear
            await Promise.allSettled([
                // Hermanos
                import('@/lib/brothers').then(({ getHermanos }) =>
                    getHermanos().then(data => {
                        console.log('[SyncProvider] Hermanos:', data.length);
                        setPreloadStatus(prev => ({ ...prev, hermanos: true }));
                    })
                ),

                // Pagos
                import('@/lib/brothers').then(({ getPagosDelAnio }) =>
                    getPagosDelAnio(new Date().getFullYear()).then(data => {
                        console.log('[SyncProvider] Pagos:', data.length);
                        setPreloadStatus(prev => ({ ...prev, pagos: true }));
                    })
                ),

                // Configuración
                import('@/lib/configuracion').then(({ getPreciosConfig }) =>
                    getPreciosConfig().then(() => {
                        setPreloadStatus(prev => ({ ...prev, configuracion: true }));
                    })
                ),

                // Temporada
                import('@/lib/treasury').then(({ getActiveSeason }) =>
                    getActiveSeason().then(() => {
                        console.log('[SyncProvider] Temporada cargada');
                    })
                )
            ]);

            console.log('[SyncProvider] Precarga completada');
        } catch (err) {
            console.error('[SyncProvider] Error:', err);
        }
    }, [user]);

    useEffect(() => {
        // En páginas de auth, mostrar inmediatamente
        if (isAuthPage) {
            setIsLoading(false);
            return;
        }

        // Esperar autenticación
        if (authLoading) return;

        // Si no hay usuario, mostrar app (middleware redirigirá si es necesario)
        if (!user) {
            setIsLoading(false);
            return;
        }

        // Usuario autenticado: precargar y mostrar
        setIsLoading(false);
        preloadData();

        // Precargar periódicamente
        const interval = setInterval(() => {
            if (networkMonitor.getState().isOnline) {
                preloadData();
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [isAuthPage, authLoading, user, preloadData]);

    // No mostrar loader bloqueante - la app debe ser visible inmediatamente
    // El QueryProvider y componentes individuales manejarán sus propios estados de carga
    return <>{children}</>;
}
