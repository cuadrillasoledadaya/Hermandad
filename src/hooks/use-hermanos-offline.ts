import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  getHermanos, 
  createHermano, 
  updateHermano, 
  deleteHermano,
  searchHermanos,
  type Hermano 
} from '@/lib/brothers';
import { hermanosRepo } from '@/lib/db/tables/hermanos.table';
import { db } from '@/lib/db/database';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { useOfflineStore } from '@/stores/offline-store';

// QUERY: Obtener todos los hermanos (con fallback offline)
export function useHermanos() {
  return useQuery({
    queryKey: ['hermanos'],
    queryFn: async () => {
      try {
        // Intentar obtener de Supabase
        const data = await getHermanos();
        
        // Guardar en IndexedDB para uso offline
        await hermanosRepo.bulkSync(data as any);
        
        return data;
      } catch (error: any) {
        // Si falla por red, usar datos locales
        if (isNetworkError(error)) {
          console.log('[useHermanos] Usando datos locales');
          const localData = await db.hermanos.toArray();
          
          if (localData.length > 0) {
            toast.info('Mostrando datos offline', {
              description: `${localData.length} hermanos cargados de caché`
            });
            return localData as Hermano[];
          }
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// QUERY: Buscar hermanos (siempre usa local para velocidad)
export function useSearchHermanos(term: string) {
  return useQuery({
    queryKey: ['hermanos-search', term],
    queryFn: async () => {
      if (term.length < 2) return [];
      
      // Siempre buscar en local primero (más rápido)
      const results = await hermanosRepo.search(term, { limit: 10 });
      
      if (results.length > 0) {
        return results;
      }
      
      // Si no hay resultados locales y estamos online, buscar en Supabase
      if (networkMonitor.getState().isOnline) {
        try {
          const { searchHermanos } = await import('@/lib/brothers');
          return await searchHermanos(term);
        } catch {
          return [];
        }
      }
      
      return [];
    },
    enabled: term.length >= 2,
  });
}

// MUTATION: Crear hermano (offline-ready)
export function useCreateHermano() {
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: createHermano,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hermanos'] });
      
      // Actualizar contador de pendientes
      db.mutations.where('status').equals('pending').count().then(count => {
        setPendingCount(count);
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('offline')) {
        toast.success('✅ Guardado localmente', {
          description: 'Se sincronizará automáticamente'
        });
      } else {
        toast.error('Error: ' + error.message);
      }
    }
  });
}

// MUTATION: Actualizar hermano (offline-ready)
export function useUpdateHermano() {
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Hermano> }) => 
      updateHermano(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hermanos'] });
      db.mutations.where('status').equals('pending').count().then(count => {
        setPendingCount(count);
      });
    },
  });
}

// MUTATION: Eliminar hermano (offline-ready)
export function useDeleteHermano() {
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: deleteHermano,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hermanos'] });
      db.mutations.where('status').equals('pending').count().then(count => {
        setPendingCount(count);
      });
    },
  });
}

function isNetworkError(error: any): boolean {
  const msg = error.message?.toLowerCase() || '';
  return msg.includes('network') || 
         msg.includes('timeout') || 
         msg.includes('fetch') ||
         msg.includes('connection');
}
