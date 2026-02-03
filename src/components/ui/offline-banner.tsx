'use client';

import { useOfflineSync } from '@/hooks/use-offline-sync';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from './button';

export function OfflineBanner() {
    const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();

    // No mostrar nada si estamos online y no hay pendientes
    if (isOnline && pendingCount === 0 && !isSyncing) {
        return null;
    }

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-50 p-3 ${isOnline ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black'
            }`}>
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-2">
                    {!isOnline && <WifiOff className="w-5 h-5" />}
                    <span className="font-medium">
                        {!isOnline
                            ? 'Sin conexión a Internet. Los cambios se guardarán localmente.'
                            : isSyncing
                                ? 'Sincronizando cambios...'
                                : `${pendingCount} cambios pendientes de sincronizar`
                        }
                    </span>
                </div>

                {isOnline && pendingCount > 0 && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={syncNow}
                        disabled={isSyncing}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sincronizar ahora
                    </Button>
                )}
            </div>
        </div>
    );
}
