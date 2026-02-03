'use client';

import { useOfflineSync } from '@/hooks/use-offline-sync';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { Button } from './button';
import { useState, useEffect } from 'react';

export function OfflineBanner() {
    const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [prevOnline, setPrevOnline] = useState(isOnline);
    const [prevSyncing, setPrevSyncing] = useState(isSyncing);

    // Ajustar estado durante el render cuando cambian las props/hooks
    // (Patrón recomendado en React para evitar useEffect innecesarios)
    if (isOnline !== prevOnline) {
        setPrevOnline(isOnline);
        if (!isOnline) {
            setIsVisible(true);
            setIsDismissed(false);
        }
    }

    if (isSyncing !== prevSyncing) {
        setPrevSyncing(isSyncing);
        if (isSyncing) {
            setIsVisible(true);
            setIsDismissed(false);
        }
    }

    // Efecto para auto-ocultar después de un tiempo
    useEffect(() => {
        if (!isVisible || isDismissed) return;

        let delay = 0;
        if (!isOnline) {
            delay = 8000;
        } else if (isSyncing) {
            return; // No ocultar mientras sincroniza
        } else if (pendingCount > 0) {
            delay = 5000;
        } else {
            // Todo ok
            delay = 3000;
        }

        if (delay > 0) {
            const timer = setTimeout(() => setIsVisible(false), delay);
            return () => clearTimeout(timer);
        }
    }, [isOnline, isSyncing, pendingCount, isVisible, isDismissed]);

    // No mostrar si fue cerrado manualmente o si está oculto
    if (!isVisible || isDismissed) {
        return null;
    }

    const handleDismiss = () => {
        setIsDismissed(true);
        setIsVisible(false);
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 p-3 transition-all duration-300 ${isOnline ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black'
                }`}
            style={{
                animation: 'slideUp 0.3s ease-out'
            }}
        >
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-2 flex-1">
                    {!isOnline && <WifiOff className="w-5 h-5" />}
                    <span className="font-medium">
                        {!isOnline
                            ? '⚠️ Sin conexión a Internet. Los cambios se guardarán localmente.'
                            : isSyncing
                                ? '🔄 Sincronizando cambios...'
                                : pendingCount > 0
                                    ? `✓ ${pendingCount} cambio${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar`
                                    : '✓ Todos los cambios sincronizados'
                        }
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {isOnline && pendingCount > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={syncNow}
                            disabled={isSyncing}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sincronizar
                        </Button>
                    )}

                    {/* Botón para cerrar manualmente */}
                    <button
                        onClick={handleDismiss}
                        className={`p-1 rounded-full hover:bg-black/10 transition-colors ${isOnline ? 'hover:bg-white/20' : 'hover:bg-black/10'
                            }`}
                        aria-label="Cerrar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}
