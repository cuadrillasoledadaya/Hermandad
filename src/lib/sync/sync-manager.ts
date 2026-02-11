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
            // Manejo especial de error 23505 (unique_violation) para HERMANOS
            // Esto ocurre si el email ya existe y estamos intentando insertar un registro
            // que quizás sea un "éxito fantasma" previo o un duplicado real.
            if (error.code === '23505' && mutation.table === 'hermanos' && cleanData.email) {
              console.log(`⚠️ [SYNC] Conflicto de email detectado para ${cleanData.email}. Intentando recuperar ID...`);

              const { data: existing } = await supabase
                .from('hermanos')
                .select('id')
                .eq('email', cleanData.email)
                .maybeSingle();

              if (existing) {
                console.log(`✅ [SYNC] Registro encontrado con ID ${existing.id}. Vinculando localmente...`);
                // 1. Actualizar el ID en la mutación actual para que las siguientes no fallen
                // (Aunque esta mutación se eliminará, sirve para la coherencia del proceso)
                cleanData.id = existing.id;

                // 2. Actualizar el ID en el repositorio local (Dexie)
                const { hermanosRepo } = await import('../db/tables/hermanos.table');
                // IMPORTANTE: hermanosRepo.update asume que el objeto existe con el ID antiguo.
                // Pero si el ID cambió, tenemos que hacer un put o similar.
                // Como SyncManager es genérico, usaremos la DB directa si es necesario.
                const { db } = await import('../db/database');

                const localRecord = data.id ? await db.hermanos.get(data.id) : null;
                if (localRecord && localRecord.id !== existing.id) {
                  await db.transaction('rw', [db.hermanos, db.mutations], async () => {
                    // Eliminar el registro antiguo con ID temporal
                    await db.hermanos.delete(data.id);
                    // Crear el nuevo con el ID real
                    await db.hermanos.put({ ...localRecord, id: existing.id, _syncStatus: 'synced' });
                    // Actualizar cualquier otra mutación pendiente que use el ID viejo
                    await db.mutations.where('data').notEqual(null).modify(m => {
                      if (m.data.id === data.id) m.data.id = existing.id;
                      if (m.data.id_hermano === data.id) m.data.id_hermano = existing.id;
                    });
                  });
                }

                // Consideramos la mutación como exitosa ya que el dato ya está en el servidor
                return;
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

    // Relaciones expandidas (objetos anidados) que Supabase no acepta en insert/update directo
    Object.keys(copy).forEach(key => {
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
