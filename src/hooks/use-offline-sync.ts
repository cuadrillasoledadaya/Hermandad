'use client';

import { useEffect, useCallback, useState } from 'react';
import { useNetworkStatus } from './use-network-status';
import { getPendingMutations, removeMutation, incrementRetryCount } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/error-handler';

interface SyncStatus {
    isSyncing: boolean;
    pendingCount: number;
    lastSync: Date | null;
    error: string | null;
}

export function useOfflineSync() {
    const { isOnline } = useNetworkStatus();
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        pendingCount: 0,
        lastSync: null,
        error: null,
    });

    // Verificar cuántas mutaciones pendientes hay
    const checkPending = useCallback(async () => {
        const pending = await getPendingMutations();
        setStatus(prev => ({ ...prev, pendingCount: pending.length }));
    }, []);

    // Procesar mutaciones pendientes
    const processMutations = useCallback(async () => {
        if (!isOnline) return;

        const pending = await getPendingMutations();
        if (pending.length === 0) return;

        setStatus(prev => ({ ...prev, isSyncing: true, error: null }));
        const supabase = createClient();
        let successCount = 0;
        let errorCount = 0;

        for (const mutation of pending) {
            try {
                let result;

                switch (mutation.type) {
                    case 'insert':
                        result = await supabase.from(mutation.table).insert(mutation.data);
                        break;
                    case 'update':
                        if (Array.isArray(mutation.data)) throw new Error('Bulk update not supported');
                        result = await supabase.from(mutation.table).update(mutation.data).eq('id', mutation.data.id);
                        break;
                    case 'delete':
                        if (Array.isArray(mutation.data)) throw new Error('Bulk delete not supported');
                        result = await supabase.from(mutation.table).delete().eq('id', mutation.data.id);
                        break;
                }

                if (result.error) {
                    throw result.error;
                }

                // Éxito: eliminar de la cola
                if (mutation.id) {
                    await removeMutation(mutation.id);
                }
                successCount++;

            } catch (error) {
                console.error('Error procesando mutation:', mutation, error);
                errorCount++;

                // Incrementar contador de reintentos
                if (mutation.id) {
                    await incrementRetryCount(mutation.id);
                }

                // Si ha fallado muchas veces, mostrar error
                if (mutation.retryCount >= 3) {
                    setStatus(prev => ({ ...prev, error: `Fallo al sincronizar ${mutation.table}` }));
                }
            }
        }

        setStatus(prev => ({
            ...prev,
            isSyncing: false,
            pendingCount: pending.length - successCount,
            lastSync: new Date(),
        }));

        if (successCount > 0) {
            showSuccess(`¡Sincronizado!`, `${successCount} cambios enviados a la nube`);
        }
        if (errorCount > 0) {
            showError(`${errorCount} cambios fallidos`, 'No se pudieron sincronizar algunos cambios');
        }
    }, [isOnline]);

    // Escuchar mensajes del Service Worker
    useEffect(() => {
        if (typeof navigator === 'undefined') return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PROCESS_MUTATIONS') {
                processMutations();
            }
        };

        navigator.serviceWorker?.addEventListener('message', handleMessage);

        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleMessage);
        };
    }, [processMutations]);

    // Sincronizar datos maestros cuando volvemos online
    const syncMasterData = useCallback(async () => {
        if (!isOnline) return;

        const supabase = createClient();

        try {
            // Sincronizar hermanos
            const { data: hermanos, error: hermanosError } = await Promise.race([
                supabase.from('hermanos').select('*'),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);

            if (!hermanosError && hermanos) {
                const { saveHermanosLocal } = await import('@/lib/db');
                await saveHermanosLocal(hermanos);
                console.log(`✅ Sincronizados ${hermanos.length} hermanos a IndexedDB`);
            }

            // Sincronizar configuración de precios
            const { data: config, error: configError } = await Promise.race([
                supabase.from('configuracion_precios').select('*').eq('id', 1).single(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);

            if (!configError && config) {
                const { initDB } = await import('@/lib/db');
                const db = await initDB();
                await db.put('configuracion', config);
                console.log('✅ Configuración de precios sincronizada a IndexedDB');
            }
        } catch (err) {
            console.warn('No se pudieron sincronizar datos maestros:', err);
        }
    }, [isOnline]);

    // Sincronizar automáticamente cuando volvemos online
    useEffect(() => {
        if (isOnline) {
            // Pequeña espera para asegurar conexión estable
            const timer = setTimeout(() => {
                syncMasterData(); // Primero sincronizar datos maestros
                processMutations(); // Luego procesar cambios pendientes
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, syncMasterData, processMutations]);

    // Verificar pendientes al montar
    useEffect(() => {
        checkPending();
    }, [checkPending]);

    return {
        ...status,
        isOnline,
        syncNow: processMutations,
        refreshPending: checkPending,
    };
}
