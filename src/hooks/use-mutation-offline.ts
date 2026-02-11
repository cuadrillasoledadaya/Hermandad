import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStore } from '@/stores/offline-store';
import { networkMonitor } from '@/lib/sync/network-monitor';
import { toast } from 'sonner';
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offline-mutation';
import { supabase } from '@/lib/supabase';

interface OfflineMutationOptions {
  table: 'hermanos' | 'pagos' | 'papeletas_cortejo';
  invalidateQueries?: string[];
  /**
   * Tipo de operación. Si no se especifica, se detecta automáticamente:
   * - Si data tiene 'id' y un campo '_delete', se asume DELETE
   * - Si data tiene 'id', se asume UPDATE
   * - Si data no tiene 'id', se asume INSERT
   */
  operationType?: 'insert' | 'update' | 'delete';
}

type MutationVariables = Record<string, unknown> & {
  id?: string;
  _delete?: boolean;
};

export function useMutationOffline(options: OfflineMutationOptions) {
  const { table, invalidateQueries = [], operationType } = options;
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: async (variables: MutationVariables) => {
      const network = networkMonitor.getState();

      // Detectar tipo de operación si no está especificado
      let operation = operationType;
      if (!operation) {
        if (variables._delete) {
          operation = 'delete';
        } else if (variables.id) {
          operation = 'update';
        } else {
          operation = 'insert';
        }
      }

      // Si estamos offline o la conexión es muy lenta, ir directo a offline
      if (!network.isOnline || network.rtt > 5000) {
        return await performOfflineOperation(operation, table, variables, setPendingCount);
      }

      // CORRECCIÓN CRÍTICA: Intentar operación online primero
      try {
        const result = await performOnlineOperation(operation, table, variables);

        // Éxito online: invalidar queries
        invalidateQueries.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });

        return result;
      } catch (error) {
        // Fallback a offline si falla la operación online
        console.warn('⚠️ Online operation failed, falling back to offline:', error);
        return await performOfflineOperation(operation, table, variables, setPendingCount);
      }
    },

    onSuccess: () => {
      // Ya invalidamos en mutationFn para operaciones online
      // Para offline, se invalidará cuando sincronice
    },

    onError: (error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('offline')) {
        console.error('❌ Error en mutation:', error);
        toast.error('Error en operación', {
          description: errorMsg
        });
      }
    }
  });
}

/**
 * Ejecuta operación directamente en Supabase (online)
 */
async function performOnlineOperation(
  operation: 'insert' | 'update' | 'delete',
  table: string,
  data: MutationVariables
) {
  // Limpiar campos especiales de control
  const { _delete, _offline, _syncStatus, _lastModified, _version, ...cleanData } = data;

  switch (operation) {
    case 'insert': {
      const { data: result, error } = await supabase
        .from(table)
        .insert(cleanData)
        .select()
        .single();

      if (error) throw error;
      return result;
    }

    case 'update': {
      if (!cleanData.id) throw new Error('Update requires id');

      const { data: result, error } = await supabase
        .from(table)
        .update(cleanData)
        .eq('id', cleanData.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    }

    case 'delete': {
      const id = data.id;
      if (!id) throw new Error('Delete requires id');

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Ejecuta operación offline usando el sistema de mutations
 */
async function performOfflineOperation(
  operation: 'insert' | 'update' | 'delete',
  table: string,
  data: MutationVariables,
  setPendingCount: (count: number) => void
) {
  let result;

  switch (operation) {
    case 'insert':
      result = await offlineInsert(table, data);
      break;
    case 'update':
      result = await offlineUpdate(table, data);
      break;
    case 'delete':
      if (!data.id) throw new Error('Delete requires id');
      result = await offlineDelete(table, data.id);
      break;
  }

  if (!result.success) {
    throw new Error(result.error || 'Error en operación offline');
  }

  // Actualizar contador de pendientes
  const { db } = await import('@/lib/db/database');
  const pending = await db.mutations.where('status').equals('pending').count();
  setPendingCount(pending);

  // Notificar usuario solo si fue offline
  if (result.offline) {
    toast.info('Guardado localmente', {
      description: 'Se sincronizará cuando haya conexión'
    });
  }

  return result.data;
}
