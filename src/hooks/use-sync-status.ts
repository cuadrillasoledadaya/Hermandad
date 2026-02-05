import { useEffect, useState } from 'react';
import { useOfflineStore } from '@/stores/offline-store';
import { db } from '@/lib/db/database';

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const storeIsSyncing = useOfflineStore((state) => state.isSyncing);
  const storeLastSync = useOfflineStore((state) => state.lastSync);
  const storeSyncError = useOfflineStore((state) => state.syncError);

  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await db.mutations
          .where('status')
          .equals('pending')
          .count();
        setPendingCount(count);
        setIsLoading(false);
      } catch (err) {
        console.error('Error obteniendo pending count:', err);
        setIsLoading(false);
      }
    };

    updatePendingCount();
    
    // Actualizar cada 5 segundos
    const interval = setInterval(updatePendingCount, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    pendingCount,
    isSyncing: storeIsSyncing,
    lastSync: storeLastSync,
    syncError: storeSyncError,
    isLoading
  };
}
