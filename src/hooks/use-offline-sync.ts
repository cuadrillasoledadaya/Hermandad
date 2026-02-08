'use client';

import { useEffect, useCallback, useState } from 'react';
import { useNetworkStatus } from './use-network-status';
import { getPendingMutations, removeMutation, incrementRetryCount } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/error-handler';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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

        const sanitizeDataForSupabase = (data: unknown) => {
            if (Array.isArray(data)) {
                return data.map(item => {
                    const clean = { ...(item as Record<string, unknown>) };
                    delete clean.hermano;
                    delete clean.posicion;
                    delete clean.ingreso;
                    delete clean._offline;
                    return clean;
                });
            }
            const clean = { ...(data as Record<string, unknown>) };
            delete clean.hermano;
            delete clean.posicion;
            delete clean.ingreso;
            delete clean._offline;
            return clean;
        };

        for (const mutation of pending) {
            try {
                let result: { data: unknown; error: { code: string; message: string } | null };
                const cleanedData = sanitizeDataForSupabase(mutation.data);

                switch (mutation.type) {
                    case 'insert':
                        // Re-asignar número si es provisional (<= 0) para papeletas_cortejo
                        if (mutation.table === 'papeletas_cortejo') {
                            const data = mutation.data as { numero: number; anio: number; id_ingreso?: string };
                            if ((typeof data.numero === 'number' && data.numero <= 0) || (typeof data.numero === 'string' && parseInt(data.numero) <= 0)) {
                                try {
                                    const { data: ultima } = await supabase
                                        .from('papeletas_cortejo')
                                        .select('numero')
                                        .eq('anio', data.anio)
                                        .order('numero', { ascending: false })
                                        .limit(1)
                                        .maybeSingle();

                                    const nuevoNumero = ultima ? (ultima as { numero: number }).numero + 1 : 1;
                                    data.numero = nuevoNumero;
                                    (cleanedData as Record<string, unknown>).numero = nuevoNumero; // Actualizar también los datos limpios

                                    console.log(`🔄 Re-asignando número real ${nuevoNumero} a papeleta provisional`);

                                    // Intentar actualizar el concepto en la tabla de pagos vinculada
                                    if (data.id_ingreso) {
                                        const { data: pago } = await supabase
                                            .from('pagos')
                                            .select('concepto')
                                            .eq('id', data.id_ingreso)
                                            .maybeSingle();

                                        if (pago && (pago as { concepto: string }).concepto.includes('(Pendiente)')) {
                                            const nuevoConcepto = (pago as { concepto: string }).concepto.replace('(Pendiente)', `#${nuevoNumero}`);
                                            await supabase
                                                .from('pagos')
                                                .update({ concepto: nuevoConcepto })
                                                .eq('id', data.id_ingreso);
                                        }
                                    }
                                } catch (err) {
                                    console.error('Error re-asignando número:', err);
                                }
                            }
                        }
                        result = await supabase.from(mutation.table).insert(cleanedData);
                        break;
                    case 'update':
                        if (Array.isArray(mutation.data)) throw new Error('Bulk update not supported');
                        result = await supabase.from(mutation.table).update(cleanedData).eq('id', (mutation.data as Record<string, unknown>).id);
                        break;
                    case 'delete':
                        if (Array.isArray(mutation.data)) throw new Error('Bulk delete not supported');
                        result = await supabase.from(mutation.table).delete().eq('id', (mutation.data as Record<string, unknown>).id);
                        break;
                }

                if (result.error) {
                    const error = result.error;
                    // Si el error es una violación de unicidad en el número de papeleta
                    const isPapeletaNumberConflict =
                        mutation.table === 'papeletas_cortejo' &&
                        error.code === '23505' &&
                        error.message?.toLowerCase().includes('numero');

                    if (isPapeletaNumberConflict) {
                        console.log('⚠️ [SYNC] Conflicto de número de papeleta detectado, forzando re-asignación en el próximo intento...');
                        // Marcamos como número provisional para que la lógica superior lo re-asigne en el siguiente ciclo
                        if (!Array.isArray(mutation.data)) {
                            (mutation.data as Record<string, unknown>).numero = -1;
                        }
                        throw error;
                    }

                    throw error;
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
                    toast.error(`Error sincronizando ${mutation.table}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
            // Invalidar queries para forzar refetch tras sincronización exitosa
            queryClient.invalidateQueries({ queryKey: ['hermanos'] });
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            queryClient.invalidateQueries({ queryKey: ['papeletas_cortejo'] });

            showSuccess(`¡Sincronizado!`, `${successCount} cambios enviados a la nube`);
        }
        if (errorCount > 0) {
            showError(`${errorCount} cambios fallidos`, 'No se pudieron sincronizar algunos cambios');
        }
    }, [isOnline, queryClient]);

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
            // Sincronizar hermanos (5s timeout)
            const { data: hermanos, error: hermanosError } = await Promise.race([
                supabase.from('hermanos').select('*').order('numero_hermano', { ascending: true }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]).catch(() => ({ data: null, error: null }));

            if (!hermanosError && hermanos) {
                const { saveHermanosLocal } = await import('@/lib/db');
                await saveHermanosLocal(hermanos);
            }

            // Sincronizar Papeletas del año actual (5s timeout)
            const anioActual = new Date().getFullYear();
            const { data: papeletas, error: papError } = await Promise.race([
                supabase.from('papeletas_cortejo').select('*').eq('anio', anioActual),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]).catch(() => ({ data: null, error: null }));

            if (!papError && papeletas) {
                const { savePapeletasLocal } = await import('@/lib/db');
                await savePapeletasLocal(papeletas);
            }

            // Sincronizar Pagos del año actual (5s timeout)
            const { data: pagos, error: pagosError } = await Promise.race([
                supabase.from('pagos').select('*').eq('anio', anioActual),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]).catch(() => ({ data: null, error: null }));

            if (!pagosError && pagos) {
                const { savePagosLocal } = await import('@/lib/db');
                await savePagosLocal(pagos);
            }

            // Sincronizar configuración de precios (3s timeout)
            const { data: config, error: configError } = await Promise.race([
                supabase.from('configuracion_precios').select('*').eq('id', 1).single(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]).catch(() => ({ data: null, error: null }));

            if (!configError && config) {
                const { initDB } = await import('@/lib/db');
                const dbInstance = await initDB();
                await dbInstance.put('configuracion', config);
            }
        } catch (err) {
            // Silencioso en fondo
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

    // Verificar pendientes al montar y cuando cambian las mutaciones
    useEffect(() => {
        checkPending();

        const handleMutationChange = () => {
            console.log('🔄 [SYNC] Detectado cambio en cola de mutaciones, actualizando...');
            checkPending();
        };

        window.addEventListener('offline-mutation-changed', handleMutationChange);
        return () => {
            window.removeEventListener('offline-mutation-changed', handleMutationChange);
        };
    }, [checkPending]);

    // Sincronizar datos maestros al montar si ya estamos online
    useEffect(() => {
        if (isOnline) {
            syncMasterData();
        }
        // Solo ejecutar una vez al montar
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Limpiar cola manualmente
    const clearQueue = async () => {
        const { clearMutationQueue } = await import('@/lib/db');
        await clearMutationQueue();
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
