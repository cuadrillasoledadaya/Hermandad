'use client';

import { useEffect, useCallback, useState } from 'react';
import { useNetworkStatus } from './use-network-status';
import { db } from '@/lib/db/database';
import { mutationsRepo } from '@/lib/db/tables/mutations.table';
import { papeletasRepo } from '@/lib/db/tables/papeletas.table';
import { pagosRepo } from '@/lib/db/tables/pagos.table';
import { createClient, supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/error-handler';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { syncManager } from '@/lib/sync/sync-manager';

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
    const queryClient = useQueryClient();

    // Verificar cuántas mutaciones pendientes hay
    const checkPending = useCallback(async () => {
        const count = await mutationsRepo.getPendingCount();
        setStatus(prev => ({ ...prev, pendingCount: count }));
    }, []);

    // Procesar mutaciones pendientes
    const processMutations = useCallback(async () => {
        if (!isOnline || status.isSyncing) return;

        // Ahora delegamos TODO el peso al SyncManager unificado
        const { syncManager } = await import('@/lib/sync/sync-manager');
        await syncManager.processQueue();

        // El estado local se actualiza a través de los efectos que escuchan al SyncManager
    }, [isOnline, status.isSyncing]);

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

        // Evitar sincronizaciones maestras demasiado frecuentes (mínimo 5 minutos)
        const LAST_SYNC_KEY = 'hermandad_last_master_sync';
        const now = Date.now();
        const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0');
        if (now - lastSync < 5 * 60 * 1000) {
            console.log('⏳ [SYNC] Sincronización maestra omitida (hace menos de 5 min)');
            return;
        }

        const supabase = createClient();

        try {
            console.log('🔄 [SYNC] Iniciando sincronización de datos maestros...');
            localStorage.setItem(LAST_SYNC_KEY, now.toString());

            // Sincronizar hermanos (15s timeout para 1000 registros)
            const { data: hermanos, error: hermanosError } = await Promise.race([
                supabase.from('hermanos').select('*').order('numero_hermano', { ascending: true }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
            ]).catch(() => ({ data: null, error: null }));

            if (!hermanosError && hermanos) {
                const { hermanosRepo } = await import('@/lib/db/tables/hermanos.table');
                await hermanosRepo.bulkSync(hermanos);
            }
            // ... resto de sincronizaciones con mayor margen
            const anioActual = new Date().getFullYear();
            const { data: papeletas, error: papError } = await Promise.race([
                supabase.from('papeletas_cortejo').select('*').eq('anio', anioActual),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
            ]).catch(() => ({ data: null, error: null }));

            if (!papError && papeletas) {
                const { papeletasRepo } = await import('@/lib/db/tables/papeletas.table');
                await papeletasRepo.saveAll(papeletas);
            }

            const { data: pagos, error: pagosError } = await Promise.race([
                supabase.from('pagos').select('*').eq('anio', anioActual),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
            ]).catch(() => ({ data: null, error: null }));

            if (!pagosError && pagos) {
                const { pagosRepo } = await import('@/lib/db/tables/pagos.table');
                await pagosRepo.bulkSync(pagos);
            }

            const { data: config, error: configError } = await Promise.race([
                supabase.from('configuracion_precios').select('*').eq('id', 1).single(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]).catch(() => ({ data: null, error: null }));

            if (!configError && config) {
                await db.configuracion.put({ ...config, id: 1, _syncStatus: 'synced', _lastModified: Date.now() });
            }

            // Invalidad queries tras sincronización exitosa
            queryClient.invalidateQueries({ queryKey: ['hermanos'] });
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            queryClient.invalidateQueries({ queryKey: ['papeletas_cortejo'] });
            queryClient.invalidateQueries({ queryKey: ['papeletas_stats'] });

            console.log('✅ [SYNC] Sincronización maestra completada');
        } catch (err) {
            console.warn('⚠️ [SYNC] Error en sincronización maestra:', err);
        }
    }, [isOnline]);

    // Sincronizar automáticamente cuando volvemos online o cambia el foco
    useEffect(() => {
        if (!isOnline) return;

        // 1. Sincronizar al volver online (pequeña espera para estabilidad)
        const timer = setTimeout(() => {
            syncMasterData();
            processMutations();
        }, 1000);

        // 2. Sincronización periódica de fondo (cada 60 segundos si hay pendientes)
        const interval = setInterval(() => {
            if (status.pendingCount > 0) {
                console.log('🔄 [AUTO-SYNC] Ejecutando sincronización periódica...');
                processMutations();
            }
        }, 60000);

        // 3. Sincronizar al recuperar el foco de la ventana (ej. al volver del móvil)
        const handleFocus = () => {
            console.log('🔄 [AUTO-SYNC] Ventana enfocada, sincronizando...');
            processMutations();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [isOnline, syncMasterData, processMutations, status.pendingCount]);

    // Monitor del SyncManager para actualizar estado de UI
    useEffect(() => {
        const unsubscribe = syncManager.subscribe((isSyncing: boolean) => {
            setStatus(prev => ({ ...prev, isSyncing }));
            if (!isSyncing) {
                checkPending();
            }
        });
        return () => unsubscribe();
    }, [checkPending]);

    // Limpiar cola manualmente
    const clearQueue = async () => {
        await mutationsRepo.clearAll();
        setStatus(prev => ({ ...prev, pendingCount: 0, error: null }));
    };

    return {
        ...status,
        isOnline,
        syncNow: processMutations,
        refreshPending: checkPending,
        checkPending,
        processMutations,
        syncMasterData,
        clearQueue // Nueva función
    };
}
