import { supabase } from '../supabase';
import { mutationsRepo } from '../db/tables/mutations.table';
import { MutationQueueItem } from '../db/database';
import { toast } from 'sonner';
import { networkMonitor } from './network-monitor';

export class SyncManager {
  private isProcessing = false;
  private listeners: ((isSyncing: boolean) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Escuchar cambios en la tabla de mutations para disparar sync
      window.addEventListener('dexie-mutation-changed', () => {
        this.processQueue();
      });

      // Escuchar evento online del NetworkMonitor
      networkMonitor.subscribe((state) => {
        if (state.isOnline) {
          console.log('🌐 [SYNC] Online (NetworkMonitor) - starting sync');
          this.processQueue();
        }
      });
    }
  }

  public subscribe(listener: (isSyncing: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.isProcessing));
  }

  public async processQueue() {
    if (this.isProcessing) return;

    // Verificar conexión usando nuestro monitor robusto
    if (!networkMonitor.getState().isOnline) {
      console.log('📴 [SYNC] Offline - skipping sync');
      return;
    }

    try {
      this.isProcessing = true;
      this.notifyListeners();

      // 1. Obtener pendientes
      const pending = await mutationsRepo.getPending();
      if (pending.length === 0) {
        // console.log('✅ [SYNC] Queue empty');
        return;
      }

      console.log(`🔄 [SYNC] Processing ${pending.length} mutations...`);

      // Variable para agrupar notificaciones
      let syncedCount = 0;
      const totalMutations = pending.length;

      // 2. Procesar uno a uno (secuencial para respetar orden)
      for (const mutation of pending) {
        if (!mutation.id) continue;

        await mutationsRepo.markAsProcessing(mutation.id);

        try {
          await this.executeMutation(mutation);

          // Éxito: Eliminar de la cola
          await mutationsRepo.remove(mutation.id);
          console.log(`✅ [SYNC] Mutation ${mutation.id} synced`);

          syncedCount++;

          // Feedback visual discreto: solo cada 5 mutaciones o al final
          if (syncedCount % 5 === 0 || syncedCount === totalMutations) {
            toast.success(`Sincronizadas ${syncedCount}/${totalMutations} operaciones`);
          }

        } catch (error) {
          console.error(`❌ [SYNC] Mutation ${mutation.id} failed:`, error);

          const errorMsg = error instanceof Error ? error.message : String(error);

          // Determinar si es error recuperable (red) o fatal (lógica)
          const isNetworkError = errorMsg.includes('fetch') ||
            errorMsg.includes('network') ||
            errorMsg.includes('timeout') ||
            errorMsg.includes('Failed to fetch');

          if (isNetworkError) {
            // Soft fail: Dejar en la cola, aumentar retryCount (manejado por markAsFailed)
            // Pero IMPORTANTE: Si fallamos por red, probablemente no podamos seguir con los siguientes
            await mutationsRepo.markAsFailed(mutation.id, errorMsg);
            console.log('Stopping sync due to network error');
            break;
          } else {
            // Error fatal (ej: validación de base de datos, 409 conflict no resuelto)
            await mutationsRepo.markAsDead(mutation.id, errorMsg);
            toast.error(`Error sincronizando: ${errorMsg}`);
          }
        }
      }

    } catch (globalError) {
      console.error('🔥 [SYNC] Critical sync error:', globalError);
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  private async executeMutation(mutation: MutationQueueItem) {
    const data = mutation.data as any;

    // Limpiar campos internos antes de enviar a Supabase
    const cleanData = this.sanitizeData(data);

    // Timeout para la operación específica
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 10000);
    });

    const operation = (async () => {
      switch (mutation.type) {
        case 'insert': {
          const { error } = await supabase.from(mutation.table).insert(cleanData);
          if (error) throw error;
          break;
        }
        case 'update': {
          if (!cleanData.id) throw new Error('Update mutation missing ID');
          const { error } = await supabase
            .from(mutation.table)
            .update(cleanData)
            .eq('id', cleanData.id);
          if (error) throw error;
          break;
        }
        case 'delete': {
          // Para delete, a veces guardamos { id: ... } en data
          const id = cleanData.id || data.id;
          if (!id) throw new Error('Delete mutation missing ID');

          const { error } = await supabase
            .from(mutation.table)
            .delete()
            .eq('id', id);
          if (error) throw error;
          break;
        }
        default:
          throw new Error(`Unknown mutation type: ${mutation.type}`);
      }
    })();

    await Promise.race([operation, timeoutPromise]);

    // POST-SYNC: Si es una papeleta con número negativo (offline), obtener el número real
    if (mutation.table === 'papeletas_cortejo' && mutation.type === 'insert') {
      await this.handleOfflinePapeletaSync(cleanData, data);
    }
  }

  /**
   * Maneja la sincronización de papeletas offline:
   * 1. Detecta si tiene número negativo (provisorio)
   * 2. Obtiene el número real desde Supabase
   * 3. Actualiza la papeleta en IndexedDB
   * 4. Actualiza el concepto del pago relacionado
   */
  private async handleOfflinePapeletaSync(cleanData: any, originalData: any) {
    try {
      const papeletaNumero = cleanData.numero || originalData.numero;

      // Solo procesar si es un número provisional (negativo)
      if (papeletaNumero >= 0) return;

      console.log(`🔄 [SYNC] Papeleta offline detectada (${papeletaNumero}), obteniendo número real...`);

      // Obtener la papeleta desde Supabase para ver el número real asignado
      const { data: papeletaSynced, error: fetchError } = await supabase
        .from('papeletas_cortejo')
        .select('numero, tipo')
        .eq('id', cleanData.id)
        .single();

      if (fetchError) {
        console.error('❌ [SYNC] Error fetching synced papeleta:', fetchError);
        return;
      }

      if (!papeletaSynced || papeletaSynced.numero <= 0) {
        console.warn('⚠️ [SYNC] Papeleta synced but still has invalid number');
        return;
      }

      // Actualizar la papeleta en IndexedDB con el número real
      const { papeletasRepo } = await import('../db/tables/papeletas.table');
      await papeletasRepo.markAsSynced(cleanData.id, papeletaSynced.numero);

      console.log(`✅ [SYNC] Papeleta actualizada: ${papeletaNumero} -> #${papeletaSynced.numero}`);

      // Actualizar el concepto del pago relacionado si existe
      if (cleanData.id_ingreso || originalData.id_ingreso) {
        const pagoId = cleanData.id_ingreso || originalData.id_ingreso;
        const { TIPOS_PAPELETA } = await import('../papeletas-cortejo');
        const nuevoConcepto = `Papeleta #${papeletaSynced.numero} - ${TIPOS_PAPELETA[papeletaSynced.tipo as keyof typeof TIPOS_PAPELETA]}`;

        const { pagosRepo } = await import('../db/tables/pagos.table');
        await pagosRepo.markAsSynced(pagoId, { concepto: nuevoConcepto });

        console.log(`✅ [SYNC] Pago actualizado: "${nuevoConcepto}"`);
      }

    } catch (error) {
      console.error('❌ [SYNC] Error in handleOfflinePapeletaSync:', error);
      // No lanzar el error para no bloquear la sincronización general
    }
  }

  private sanitizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    // Copia superficial
    const copy = { ...data };

    // Campos de control offline que NO deben ir a Supabase
    delete copy._offline;
    delete copy._syncStatus;
    delete copy._lastModified;
    delete copy._version;

    // Campos de estado de UI que a veces se cuelan
    delete copy.selected;

    // Relaciones expandidas (objetos anidados) que Supabase no acepta en insert/update directo
    Object.keys(copy).forEach(key => {
      if (typeof copy[key] === 'object' && copy[key] !== null && !Array.isArray(copy[key])) {
        // Si es un objeto (relación), lo quitamos. 
        // Excepción: jsonb columns. Pero en esta app no parece haber jsonb complejos en mutations.
        // Asumimos que las relaciones (ej: 'hermano: { ... }') no se deben enviar.
        delete copy[key];
      }
    });

    return copy;
  }
}

export const syncManager = new SyncManager();
