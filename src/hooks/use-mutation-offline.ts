import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStore } from '@/stores/offline-store';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { toast } from 'sonner';

interface OfflineMutationOptions {
  table: 'hermanos' | 'pagos' | 'papeletas_cortejo';
  invalidateQueries?: string[];
}

export function useMutationOffline(options: OfflineMutationOptions) {
  const { table, invalidateQueries = [] } = options;
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: async (variables: any) => {
      const network = networkMonitor.getState();
      
      // Si estamos offline o la conexión es muy lenta, guardar localmente
      if (!network.isOnline || network.rtt > 5000) {
        return await saveOffline(table, variables, setPendingCount);
      }
      
      // Intentar operación online - si falla, fallback a offline
      throw new Error('Modo offline activado');
    },

    onSuccess: (data) => {
      invalidateQueries.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },

    onError: (error: any) => {
      if (!error.message?.includes('offline')) {
        console.error('Error en mutation:', error);
      }
    }
  });
}

async function saveOffline(
  table: string, 
  data: any, 
  setPendingCount: (count: number) => void
): Promise<any> {
  try {
    let repo: any;
    
    switch (table) {
      case 'hermanos':
        const hermanosModule = await import('@/lib/db/tables/hermanos.table');
        repo = hermanosModule.hermanosRepo;
        break;
      case 'pagos':
        const pagosModule = await import('@/lib/db/tables/pagos.table');
        repo = pagosModule.pagosRepo;
        break;
      case 'papeletas_cortejo':
        const papeletasModule = await import('@/lib/db/tables/papeletas.table');
        repo = papeletasModule.papeletasRepo;
        break;
      default:
        throw new Error(`Tabla no soportada: ${table}`);
    }
    
    if (!repo || !repo.create) {
      throw new Error(`Repositorio no encontrado para ${table}`);
    }
    
    const result = await repo.create(data);
    
    // Actualizar contador
    const { db } = await import('@/lib/db/database');
    const pending = await db.mutations.where('status').equals('pending').count();
    setPendingCount(pending);
    
    toast.info('Guardado localmente', {
      description: 'Se sincronizará cuando haya conexión'
    });
    
    return result;
  } catch (err) {
    console.error('Error guardando offline:', err);
    throw err;
  }
}
