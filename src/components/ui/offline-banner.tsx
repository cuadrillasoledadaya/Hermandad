'use client';

import { useState, useEffect } from 'react';
import { useSync } from '@/components/providers/sync-provider';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingMutations, forceSync } = useSync();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Mostrar/ocultar banner
  useEffect(() => {
    if (!isOnline || pendingMutations > 0 || isSyncing) {
      setIsVisible(true);
      setIsDismissed(false);
    } else if (pendingMutations === 0 && !isSyncing && isOnline) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingMutations, isSyncing]);

  const handleSync = async () => {
    if (!isOnline || pendingMutations === 0) return;

    try {
      await forceSync();
      toast.success('Sincronización iniciada');
    } catch (err: any) {
      toast.error('Error al iniciar sincronización');
    }
  };

  if (!isVisible || isDismissed) return null;

  // Determinar apariencia
  let bgColor = 'bg-green-500';
  let textColor = 'text-white';
  let Icon = Wifi;
  let message = '✓ Todo sincronizado';

  if (!isOnline) {
    bgColor = 'bg-yellow-500';
    textColor = 'text-black';
    Icon = WifiOff;
    message = `⚠️ Sin conexión. ${pendingMutations} cambios pendientes.`;
  } else if (isSyncing) {
    bgColor = 'bg-blue-500';
    Icon = RefreshCw;
    message = '🔄 Sincronizando...';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (pendingMutations > 0) {
    bgColor = 'bg-orange-500';
    message = `📦 ${pendingMutations} cambios pendientes`;
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-3 ${bgColor} ${textColor} transition-all duration-300`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="font-medium">{message}</span>
        </div>

        <div className="flex items-center gap-2">
          {isOnline && pendingMutations > 0 && !isSyncing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              className="h-8"
            >
              Sincronizar
            </Button>
          )}

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
