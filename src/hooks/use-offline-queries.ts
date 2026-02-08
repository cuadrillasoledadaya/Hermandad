import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import { db } from '@/lib/db/database';
import { networkMonitor } from '@/lib/sync/network-monitor';

// Query robusta con fallback a IndexedDB
export function useHermanosQuery() {
  return useQuery({
    queryKey: ['hermanos'],
    queryFn: async () => {
      const network = networkMonitor.getState();
      
      // Si estamos online, intentar Supabase primero
      if (network.isOnline) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('hermanos')
            .select('*')
            .order('numero_hermano', { ascending: true });

          if (error) throw error;

          // Guardar en IndexedDB para uso offline
          if (data) {
            await db.transaction('rw', db.hermanos, async () => {
              for (const h of data) {
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
          }

          return data || [];
        } catch (err) {
          console.log('[useHermanosQuery] Falló Supabase, usando local');
          // Fallback a IndexedDB
          const localData = await db.hermanos.toArray();
          return localData.map(h => ({
            ...h,
            // Eliminar campos internos antes de devolver
            _syncStatus: undefined,
            _lastModified: undefined,
            _version: undefined
          }));
        }
      }
      
      // Modo offline: usar solo IndexedDB
      const localData = await db.hermanos.toArray();
      return localData.map(h => ({
        ...h,
        _syncStatus: undefined,
        _lastModified: undefined,
        _version: undefined
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 60 * 24, // 24 horas
  });
}

export function usePapeletasQuery(anio?: number) {
  const year = anio || new Date().getFullYear();
  
  return useQuery({
    queryKey: ['papeletas', year],
    queryFn: async () => {
      const network = networkMonitor.getState();
      
      if (network.isOnline) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('papeletas_cortejo')
            .select('*')
            .eq('anio', year);

          if (error) throw error;

          if (data) {
            await db.transaction('rw', db.papeletas, async () => {
              for (const p of data) {
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
          }

          return data || [];
        } catch (err) {
          console.log('[usePapeletasQuery] Falló Supabase, usando local');
          const localData = await db.papeletas.where('anio').equals(year).toArray();
          return localData.map(p => ({
            ...p,
            _syncStatus: undefined,
            _lastModified: undefined
          }));
        }
      }
      
      const localData = await db.papeletas.where('anio').equals(year).toArray();
      return localData.map(p => ({
        ...p,
        _syncStatus: undefined,
        _lastModified: undefined
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function usePagosQuery(idHermano?: string) {
  return useQuery({
    queryKey: ['pagos', idHermano],
    queryFn: async () => {
      const network = networkMonitor.getState();
      
      if (!idHermano) return [];
      
      if (network.isOnline) {
        try {
          const supabase = createClient();
          let query = supabase
            .from('pagos')
            .select('*')
            .order('fecha_pago', { ascending: false });

          if (idHermano) {
            query = query.eq('id_hermano', idHermano);
          }

          const { data, error } = await query;

          if (error) throw error;

          if (data) {
            await db.transaction('rw', db.pagos, async () => {
              for (const p of data) {
                const local = await db.pagos.get(p.id);
                if (!local || local._syncStatus === 'synced') {
                  await db.pagos.put({
                    ...p,
                    _syncStatus: 'synced',
                    _lastModified: Date.now()
                  });
                }
              }
            });
          }

          return data || [];
        } catch (err) {
          console.log('[usePagosQuery] Falló Supabase, usando local');
          let localData = await db.pagos.toArray();
          if (idHermano) {
            localData = localData.filter(p => p.id_hermano === idHermano);
          }
          return localData.sort((a, b) => 
            new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
          );
        }
      }
      
      let localData = await db.pagos.toArray();
      if (idHermano) {
        localData = localData.filter(p => p.id_hermano === idHermano);
      }
      return localData.sort((a, b) => 
        new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
      );
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!idHermano,
  });
}
