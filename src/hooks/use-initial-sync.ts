import { useEffect } from 'react';
import { db } from '@/lib/db/database';
import { createClient } from '@/lib/supabase';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { useOfflineStore } from '@/stores/offline-store';

// Hook que sincroniza datos de Supabase a IndexedDB al cargar
export function useInitialSync() {
  const setNetworkStatus = useOfflineStore((state) => state.setNetworkStatus);
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  useEffect(() => {
    let mounted = true;

    const syncData = async () => {
      const network = networkMonitor.getState();
      
      if (!network.isOnline) {
        console.log('[InitialSync] Sin conexión, usando datos locales');
        return;
      }

      try {
        console.log('[InitialSync] Cargando datos de Supabase...');
        const supabase = createClient();

        // Cargar hermanos
        const { data: hermanos, error: hError } = await supabase
          .from('hermanos')
          .select('*')
          .order('numero_hermano', { ascending: true });

        if (hError) throw hError;

        if (hermanos && mounted) {
          // Guardar en IndexedDB
          await db.transaction('rw', db.hermanos, async () => {
            // Solo actualizar los que no tienen cambios pendientes
            for (const h of hermanos) {
              const local = await db.hermanos.get(h.id);
              if (!local || local._syncStatus === 'synced') {
                await db.hermanos.put({
                  ...h,
                  _syncStatus: 'synced',
                  _lastModified: Date.now(),
                  _version: 1
                });
              }
            }
          });
          console.log(`[InitialSync] ${hermanos.length} hermanos sincronizados`);
        }

        // Cargar papeletas del año actual
        const year = new Date().getFullYear();
        const { data: papeletas, error: pError } = await supabase
          .from('papeletas_cortejo')
          .select('*')
          .eq('anio', year);

        if (pError) throw pError;

        if (papeletas && mounted) {
          await db.transaction('rw', db.papeletas, async () => {
            for (const p of papeletas) {
              const local = await db.papeletas.get(p.id);
              if (!local || local._syncStatus === 'synced') {
                await db.papeletas.put({
                  ...p,
                  _syncStatus: 'synced',
                  _lastModified: Date.now()
                });
              }
            }
          });
          console.log(`[InitialSync] ${papeletas.length} papeletas sincronizadas`);
        }

        // Actualizar contador de pendientes
        const pending = await db.mutations.where('status').equals('pending').count();
        setPendingCount(pending);

      } catch (err) {
        console.error('[InitialSync] Error:', err);
      }
    };

    // Ejecutar sync inicial
    syncData();

    // Suscribirse a cambios de red
    const unsubscribe = networkMonitor.subscribe((status) => {
      setNetworkStatus({ isOnline: status.isOnline, connectionType: status.connectionType });
      
      // Si volvemos a online, reintentar sync
      if (status.isOnline) {
        syncData();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setNetworkStatus, setPendingCount]);
}
