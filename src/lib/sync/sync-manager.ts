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
    let cleanData = this.sanitizeData(data);

    // PRE-SYNC: Lógica específica para papeletas vendidas offline
    if (mutation.table === 'papeletas_cortejo' && mutation.type === 'insert') {
      cleanData = await this.preProcessPapeletaInsert(cleanData, data);
    }

    // Timeout para la operación específica
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 10000);
    });

    const operation = (async () => {
      switch (mutation.type) {
        case 'insert': {
          try {
            const { error } = await supabase.from(mutation.table).upsert(cleanData, {
              onConflict: 'id',
              ignoreDuplicates: false
            });
            if (error) throw error;
          } catch (error: any) {
            console.log(`🔍 [SYNC] Insert failed for ${mutation.table}. Code: ${error?.code}, Message: ${error?.message}`);

            // Manejo especial de error 23505 (unique_violation) para HERMANOS
            if (error.code === '23505' && mutation.table === 'hermanos' && cleanData.email) {
              console.log(`⚠️ [SYNC] Conflicto de email detectado para ${cleanData.email}. Intentando recuperación forzosa...`);

              const { data: existing, error: searchError } = await supabase
                .from('hermanos')
                .select('id, numero_hermano')
                .eq('email', cleanData.email)
                .maybeSingle();

              if (searchError) {
                console.error('❌ [SYNC] Error buscando hermano existente:', searchError);
                throw error;
              }

              if (existing) {
                console.log(`✅ [SYNC] Registro encontrado en servidor. ID Real: ${existing.id}, Actual: ${data.id}`);

                // 1. Vincular localmente
                const { db } = await import('../db/database');

                try {
                  const localRecord = data.id ? await db.hermanos.get(data.id as string) : null;

                  if (localRecord && localRecord.id !== existing.id) {
                    console.log('🔄 [SYNC] Re-mapeando ID local al ID del servidor...');
                    await db.transaction('rw', [db.hermanos, db.mutations], async () => {
                      // Eliminar registro con ID temporal
                      await db.hermanos.delete(data.id as string);

                      // Guardar registro con ID real
                      const updatedRecord: any = {
                        ...localRecord,
                        id: existing.id,
                        numero_hermano: existing.numero_hermano || localRecord.numero_hermano,
                        _syncStatus: 'synced' as const
                      };
                      await db.hermanos.put(updatedRecord);

                      // Corregir mutaciones dependientes
                      const pendingCount = await db.mutations.where('data').notEqual(null).modify(m => {
                        let changed = false;
                        if (m.data && m.data.id === data.id) { m.data.id = existing.id; changed = true; }
                        if (m.data && m.data.id_hermano === data.id) { m.data.id_hermano = existing.id; changed = true; }
                        return changed;
                      });
                      console.log(`📦 [SYNC] Actualizadas ${pendingCount} mutaciones dependientes`);
                    });
                  } else if (localRecord) {
                    // Ya está vinculado, simplemente marcar como sincronizado
                    await db.hermanos.update(localRecord.id, { _syncStatus: 'synced' });
                  }

                  console.log('✨ [SYNC] Recuperación completada con éxito. Desbloqueando cola.');
                  return; // Éxito preventivo (el dato ya está fuera)
                } catch (dexieError) {
                  console.error('❌ [SYNC] Error en recuperación Dexie:', dexieError);
                  throw error;
                }
              } else {
                console.log('❓ [SYNC] Error 23505 pero no se encuentra el registro por email. Posible RLS o cambio de email.');
              }
            }
            throw error;
          }
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

    // POST-SYNC: Actualizar IndexedDB con los cambios finales
    if (mutation.table === 'papeletas_cortejo' && mutation.type === 'insert') {
      await this.postProcessPapeletaSync(cleanData, data);
    } else if (mutation.table === 'pagos' && mutation.type === 'insert') {
      const { pagosRepo } = await import('../db/tables/pagos.table');
      await pagosRepo.markAsSynced(cleanData.id);
    }
  }

  /**
   * Antes del insert, si la papeleta tiene número provisional (< 0),
   * buscamos el número real en Supabase para evitar colisiones y placeholders.
   */
  private async preProcessPapeletaInsert(cleanData: any, originalData: any) {
    try {
      const currentNumero = cleanData.numero || originalData.numero;
      if (currentNumero >= 0) return cleanData;

      console.log(`🔍 [SYNC] Re-asignando número real ANTES del insert para papeleta ${currentNumero}`);

      // 1. Obtener el último número en Supabase para ese año
      const { data: ultima } = await supabase
        .from('papeletas_cortejo')
        .select('numero')
        .eq('anio', cleanData.anio)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nuevoNumero = ultima ? (ultima as any).numero + 1 : 1;

      console.log(`✅ [SYNC] Nuevo número calculado: #${nuevoNumero}`);

      // 2. Actualizar el objeto que se enviará a Supabase
      return {
        ...cleanData,
        numero: nuevoNumero
      };
    } catch (err) {
      console.error('❌ [SYNC] Error en preProcessPapeletaInsert:', err);
      return cleanData;
    }
  }

  /**
   * Después del éxito en el servidor, actualizamos IndexedDB con el número real.
   */
  private async postProcessPapeletaSync(finalCleanData: any, originalData: any) {
    try {
      const realNumero = finalCleanData.numero;
      const papeletaId = finalCleanData.id;

      if (!realNumero || realNumero <= 0) return;

      console.log(`💾 [SYNC] Consolidando datos locales para papeleta #${realNumero}`);

      // 1. Marcar papeleta como sincronizada con su número real
      const { papeletasRepo } = await import('../db/tables/papeletas.table');
      await papeletasRepo.markAsSynced(papeletaId, realNumero);

      // 2. Si hay un pago vinculado (id_ingreso), actualizar su concepto también
      const pagoId = finalCleanData.id_ingreso || originalData.id_ingreso;
      if (pagoId) {
        const { TIPOS_PAPELETA } = await import('../papeletas-cortejo');
        const tipo = finalCleanData.tipo || originalData.tipo;
        const labelTipo = TIPOS_PAPELETA[tipo as keyof typeof TIPOS_PAPELETA] || 'Papeleta';
        const nuevoConcepto = `Papeleta #${realNumero} - ${labelTipo}`;

        const { pagosRepo } = await import('../db/tables/pagos.table');
        await pagosRepo.markAsSynced(pagoId, { concepto: nuevoConcepto });
        console.log(`✅ [SYNC] Pago #${pagoId} actualizado con concepto: ${nuevoConcepto}`);
      }
    } catch (err) {
      console.error('❌ [SYNC] Error en postProcessPapeletaSync:', err);
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

    // Relaciones expandidas y limpieza de strings vacíos
    Object.keys(copy).forEach(key => {
      // Convertir "" a null para evitar violaciones de UNIQUE
      if (copy[key] === '') {
        copy[key] = null;
      }

      if (typeof copy[key] === 'object' && copy[key] !== null && !Array.isArray(copy[key])) {
        // Excepción: Solo si es Date o similar (no aplica aquí)
        // Eliminamos "hermano", "posicion", etc.
        delete copy[key];
      }
    });

    return copy;
  }
}

export const syncManager = new SyncManager();
