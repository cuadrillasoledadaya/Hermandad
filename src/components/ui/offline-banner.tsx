'use client';

import { useEffect, useState } from 'react';
import { useOfflineStore } from '@/stores/offline-store';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { syncManager } from '@/lib/sync/sync-manager';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Usar Zustand store
  const isOnline = useOfflineStore((state) => state.isOnline);
  const pendingCount = useOfflineStore((state) => state.pendingCount);
  const isSyncing = useOfflineStore((state) => state.isSyncing);
  const syncError = useOfflineStore((state) => state.syncError);
  
  const setNetworkStatus = useOfflineStore((state) => state.setNetworkStatus);
  const setSyncing = useOfflineStore((state) => state.setSyncing);
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);
  const setSyncError = useOfflineStore((state) => state.setSyncError);

  // Suscribirse a cambios de red
  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((status) => {
      setNetworkStatus({ 
        isOnline: status.isOnline, 
        connectionType: status.connectionType 
      });
    });

    return () => unsubscribe();
  }, [setNetworkStatus]);

  // Actualizar contador de pendientes periódicamente
  useEffect(() => {
    const updatePending = async () => {
      try {
        const { db } = await import('@/lib/db/database');
        const count = await db.mutations.where('status').equals('pending').count();
        setPendingCount(count);
      } catch (err) {
        console.error('Error contando pendientes:', err);
      }
    };

    updatePending();
    const interval = setInterval(updatePending, 5000);
    return () => clearInterval(interval);
  }, [setPendingCount]);

  // Auto-sincronizar cuando volvemos online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        handleSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, isSyncing]);

  // Mostrar/ocultar banner
  useEffect(() => {
    if (!isOnline || pendingCount > 0 || isSyncing || syncError) {
      setIsVisible(true);
      setIsDismissed(false);
    } else if (pendingCount === 0 && !isSyncing && isOnline && !syncError) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, isSyncing, syncError]);

  const handleSync = async () => {
    if (!isOnline || pendingCount === 0) return;

    setSyncing(true);
    setSyncError(null);

    try {
      const result = await syncManager.sync({
        strategy: 'server-wins',
        batchSize: 10
      });

      if (result.success) {
        toast.success(`✅ Sincronizado: ${result.processed - result.failed}/${result.processed}`);
      } else {
        setSyncError(`${result.failed} errores`);
        toast.error(`❌ ${result.errors.length} errores`);
      }

      // Actualizar contador
      const { db } = await import('@/lib/db/database');
      const count = await db.mutations.where('status').equals('pending').count();
      setPendingCount(count);
    } catch (err: any) {
      setSyncError(err.message);
      toast.error('Error de sincronización');
    } finally {
      setSyncing(false);
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
    message = `⚠️ Sin conexión. ${pendingCount} cambios pendientes.`;
  } else if (isSyncing) {
    bgColor = 'bg-blue-500';
    Icon = RefreshCw;
    message = '🔄 Sincronizando...';
  } else if (syncError) {
    bgColor = 'bg-red-500';
    Icon = AlertCircle;
    message = `❌ Error: ${syncError}`;
  } else if (pendingCount > 0) {
    bgColor = 'bg-orange-500';
    message = `📦 ${pendingCount} cambios pendientes`;
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-3 ${bgColor} ${textColor} transition-all duration-300`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="font-medium">{message}</span>
        </div>

        <div className="flex items-center gap-2">
          {isOnline && pendingCount > 0 && !isSyncing && (
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
