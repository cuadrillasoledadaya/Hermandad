'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { syncManager } from '@/lib/sync/sync-manager';
import { mutationsRepo } from '@/lib/db/tables/mutations.table';

interface SyncContextType {
    isOnline: boolean;
    isSyncing: boolean;
    pendingMutations: number;
    forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
    isOnline: true,
    isSyncing: false,
    pendingMutations: 0,
    forceSync: async () => { },
});

export const useSync = () => useContext(SyncContext);

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingMutations, setPendingMutations] = useState(0);


    const { user, loading: authLoading } = useAuth();

    // Monitor Network Status
    useEffect(() => {
        const unsubscribe = networkMonitor.subscribe((state) => {
            setIsOnline(state.isOnline);
        });
        setIsOnline(networkMonitor.getState().isOnline);
        return () => unsubscribe();
    }, []);

    // Monitor Sync Status
    useEffect(() => {
        const unsubscribe = syncManager.subscribe((syncing) => {
            setIsSyncing(syncing);
            // Actualizar cuenta de pendientes cuando termina de sincronizar
            if (!syncing) {
                mutationsRepo.getPendingCount().then(setPendingMutations);
            }
        });
        return () => unsubscribe();
    }, []);

    // Monitor Pending Mutations Count
    useEffect(() => {
        // Escuchar cambios en la DB para actualizar el contador
        const updateCount = () => {
            mutationsRepo.getPendingCount().then(setPendingMutations);
        };

        window.addEventListener('dexie-mutation-changed', updateCount);
        // Inicial
        updateCount();

        return () => window.removeEventListener('dexie-mutation-changed', updateCount);
    }, []);

    // Initial Data Preload (Legacy logic preserved but simplified)
    useEffect(() => {
        if (!user || authLoading) return;

        const preload = async () => {
            if (networkMonitor.getState().isOnline) {
                try {
                    // Trigger a sync of the queue first
                    await syncManager.processQueue();

                    // Here we can trigger SWR prefetching if needed, 
                    // but for now relying on Serwist's runtime caching is better strategies.
                } catch (e) {
                    console.error('Error in initial sync:', e);
                }
            }
        };

        preload();
    }, [user, authLoading]);

    const forceSync = useCallback(async () => {
        await syncManager.processQueue();
    }, []);

    const value = {
        isOnline,
        isSyncing,
        pendingMutations,
        forceSync
    };

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
}
