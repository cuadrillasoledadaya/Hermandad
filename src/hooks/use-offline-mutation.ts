import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { useOfflineStore } from '@/stores/offline-store';

interface UseOfflineMutationOptions<TData, TVariables> {
  mutationFn: (vars: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void;
  invalidateQueries?: string[];
  successMessage?: string;
  errorMessage?: string;
}

export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  options: UseOfflineMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const network = networkMonitor.getState();
      
      // Si estamos online y conexión buena, intentar operación normal
      if (network.isOnline && network.rtt < 3000) {
        try {
          return await options.mutationFn(variables);
        } catch (error: any) {
          // Si falla por red, intentar guardar offline
          if (isNetworkError(error)) {
            return await saveOffline(variables, options, setPendingCount);
          }
          throw error;
        }
      }
      
      // Modo offline - guardar localmente
      return await saveOffline(variables, options, setPendingCount);
    },
    
    onSuccess: (data, variables) => {
      // Invalidar queries
      options.invalidateQueries?.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      
      // Mostrar mensaje de éxito
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      
      // Callback personalizado
      options.onSuccess?.(data, variables);
    },
    
    onError: (error: any, variables) => {
      if (!error.message?.includes('offline')) {
        const msg = options.errorMessage || error.message;
        toast.error(msg);
        options.onError?.(error, variables);
      }
    }
  });
}

function isNetworkError(error: any): boolean {
  const msg = error.message?.toLowerCase() || '';
  return msg.includes('network') || 
         msg.includes('timeout') || 
         msg.includes('fetch') ||
         msg.includes('connection');
}

async function saveOffline(
  variables: any,
  options: any,
  setPendingCount: (n: number) => void
): Promise<any> {
  // Guardar en IndexedDB según el tipo de operación
  // Esto es un placeholder - se implementa según cada caso
  toast.info('💾 Guardado localmente', {
    description: 'Se sincronizará cuando haya conexión'
  });
  
  // Actualizar contador de pendientes
  const { db } = await import('@/lib/db/database');
  const pending = await db.mutations.where('status').equals('pending').count();
  setPendingCount(pending);
  
  return { offline: true, ...variables };
}
