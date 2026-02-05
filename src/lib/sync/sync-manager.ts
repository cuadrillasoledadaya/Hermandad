// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db, MutationQueueItem, Hermano, Pago, Papeleta } from '@/lib/db/database';
import { networkMonitor } from './network-monitor';
import { createClient } from '@/lib/supabase';

// ============================================
// TIPOS Y CONFIGURACIÓN
// ============================================

interface SyncOptions {
  strategy: 'local-wins' | 'server-wins' | 'manual';
  batchSize: number;
  onProgress?: (progress: SyncProgress) => void;
}

interface SyncProgress {
  total: number;
  processed: number;
  success: number;
  errors: number;
  conflicts: number;
}

interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

// ============================================
// SYNC MANAGER
// ============================================

class SyncManager {
  private isProcessing = false;
  private abortController?: AbortController;

  async sync(options: SyncOptions = { strategy: 'server-wins', batchSize: 10 }): Promise<SyncResult> {
    if (this.isProcessing) {
      throw new Error('Sync already in progress');
    }

    const networkState = networkMonitor.getState();
    if (!networkState.isOnline) {
      return {
        success: false,
        processed: 0,
        failed: 0,
        conflicts: 0,
        errors: ['No hay conexión']
      };
    }

    this.isProcessing = true;
    this.abortController = new AbortController();

    const result: SyncResult = {
      success: true,
      processed: 0,
      failed: 0,
      conflicts: 0,
      errors: []
    };

    try {
      // 1. Primero sincronizar datos maestros (descargar cambios del servidor)
      await this.syncMasterData();

      // 2. Procesar mutations pendientes (subir cambios locales)
      const pending = await db.mutations
        .where('status')
        .equals('pending')
        .sortBy('priority');

      const progress: SyncProgress = {
        total: pending.length,
        processed: 0,
        success: 0,
        errors: 0,
        conflicts: 0
      };

      // Procesar en batches
      for (let i = 0; i < pending.length; i += options.batchSize) {
        if (this.abortController.signal.aborted) break;

        const batch = pending.slice(i, i + options.batchSize);

        for (const mutation of batch) {
          try {
            await this.processMutation(mutation, options.strategy);
            progress.success++;

            // Marcar como synced en tabla local
            await this.markAsSynced(mutation);

            // Eliminar de cola
            if (mutation.id) {
              await db.mutations.delete(mutation.id);
            }
          } catch (error) {
            progress.errors++;
            result.failed++;

            const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
            result.errors.push(`${mutation.table} ${mutation.type}: ${errorMsg}`);

            // Manejar error según tipo
            await this.handleMutationError(mutation, error);
          }

          progress.processed++;
        }

        options.onProgress?.(progress);

        // Pequeña pausa entre batches para no saturar
        if (i + options.batchSize < pending.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      result.processed = progress.processed;
      result.conflicts = progress.conflicts;

      // Log de sync exitoso
      if (result.processed > 0) {
        await db.syncLog.add({
          timestamp: Date.now(),
          operation: 'bulk_sync',
          table: 'all',
          recordId: 'batch',
          status: result.failed > 0 ? 'error' : 'success',
          details: `Procesados: ${result.processed}, Éxitos: ${result.processed - result.failed}, Fallos: ${result.failed}`
        });
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.abortController = undefined;
    }

    return result;
  }

  private async processMutation(
    mutation: MutationQueueItem,
    strategy: SyncOptions['strategy']
  ): Promise<void> {
    const supabase = createClient();
    const timeout = networkMonitor.getRecommendedTimeout();

    // Limpiar datos de relaciones antes de enviar
    const cleanData = this.sanitizeData(mutation.data);

    // Helper para ejecutar operación de Supabase con timeout
    const executeWithTimeout = async <T>(operation: PromiseLike<T>): Promise<T> => {
      return Promise.race([
        operation,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]) as Promise<T>;
    };

    switch (mutation.type) {
      case 'insert': {
        // Para papeletas, manejar números provisionales
        if (mutation.table === 'papeletas_cortejo' && cleanData.numero <= 0) {
          cleanData.numero = await this.assignRealNumber(cleanData.anio);
        }

        const result = await executeWithTimeout(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from(mutation.table).insert(cleanData).then((res: any) => res)
        );

        if (result.error) throw result.error;
        break;
      }

      case 'update': {
        // Verificar conflictos antes de update
        const hasConflict = await this.checkConflict(mutation);

        if (hasConflict && strategy === 'manual') {
          await this.queueForManualResolution(mutation);
          throw new Error('Conflicto requiere resolución manual');
        }

        if (hasConflict && strategy === 'server-wins') {
          // No hacemos update, nos quedamos con servidor
          return;
        }

        const result = await executeWithTimeout(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from(mutation.table).update(cleanData).eq('id', cleanData.id).then((res: any) => res)
        );

        if (result.error) throw result.error;
        break;
      }

      case 'delete': {
        const result = await executeWithTimeout(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from(mutation.table).delete().eq('id', cleanData.id).then((res: any) => res)
        );

        if (result.error) throw result.error;
        break;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.cleanRecord(item));
    }
    return this.cleanRecord(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cleanRecord(record: any): any {
    // Eliminar campos internos y relaciones que NO deben ir a Supabase

    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      hermano,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      posicion,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ingreso,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _offline,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _syncStatus,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _lastModified,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _version,
      ...clean
    } = record;
    return clean;
  }

  private async handleMutationError(mutation: MutationQueueItem, error: unknown): Promise<void> {
    const isRetryable = this.isRetryableError(error);

    if (!isRetryable || mutation.retryCount >= mutation.maxRetries) {
      // Mover a dead letter queue
      if (mutation.id) {
        await db.mutations.update(mutation.id, {
          status: 'dead',
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }

      // Log para debugging
      await db.syncLog.add({
        timestamp: Date.now(),
        operation: `${mutation.type}_${mutation.table}`,
        table: mutation.table,
        recordId: mutation.data?.id || 'unknown',
        status: 'error',
        details: JSON.stringify(error)
      });
    } else {
      // Incrementar retry y reintentar más tarde
      if (mutation.id) {
        await db.mutations.update(mutation.id, {
          retryCount: mutation.retryCount + 1,
          status: 'pending'
        });
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Errores de red son reintentables
      if (error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('fetch')) {
        return true;
      }

      // Errores de constraint NO son reintentables
      if (error.message.includes('23505') || // Unique violation
        error.message.includes('23503')) {  // Foreign key
        return false;
      }
    }
    return true;
  }

  private async checkConflict(mutation: MutationQueueItem): Promise<boolean> {
    if (mutation.type !== 'update') return false;

    const supabase = createClient();

    try {
      // Obtener versión del servidor
      const { data: serverRecord } = await supabase
        .from(mutation.table)
        .select('updated_at')
        .eq('id', mutation.data.id)
        .single();

      if (!serverRecord) return false;

      // Comparar timestamps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serverTime = new Date((serverRecord as any).updated_at).getTime();
      const localTime = mutation.data._lastModified || mutation.timestamp;

      // Si el servidor tiene versión más nueva, hay conflicto
      return serverTime > localTime;
    } catch {
      return false;
    }
  }

  private async queueForManualResolution(mutation: MutationQueueItem): Promise<void> {
    // TODO: Implementar cola de conflictos manuales
    console.log('Conflicto manual:', mutation);
  }

  private async assignRealNumber(anio: number): Promise<number> {
    const supabase = createClient();

    const { data: ultima } = await supabase
      .from('papeletas_cortejo')
      .select('numero')
      .eq('anio', anio)
      .order('numero', { ascending: false })
      .limit(1)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ultima ? (ultima as any).numero + 1 : 1;
  }

  private async markAsSynced(mutation: MutationQueueItem): Promise<void> {
    const { table, data } = mutation;
    const id = data?.id;

    if (!id) return;

    switch (table) {
      case 'hermanos':
        await db.hermanos.update(id, { _syncStatus: 'synced' });
        break;
      case 'pagos':
        await db.pagos.update(id, { _syncStatus: 'synced' });
        break;
      case 'papeletas_cortejo':
        await db.papeletas.update(id, { _syncStatus: 'synced' });
        break;
      case 'configuracion':
        await db.configuracion.update(id, { _syncStatus: 'synced' });
        break;
    }
  }

  private async syncMasterData(): Promise<void> {
    const supabase = createClient();

    try {
      // Sincronizar hermanos
      const { data: hermanos, error: hError } = await supabase
        .from('hermanos')
        .select('*')
        .limit(1000);

      if (!hError && hermanos) {
        await db.transaction('rw', db.hermanos, async () => {
          for (const h of hermanos) {
            const local = await db.hermanos.get(h.id);

            // Solo actualizar si local no tiene cambios pendientes
            if (!local || local._syncStatus === 'synced') {
              await db.hermanos.put({
                ...h,
                _syncStatus: 'synced',
                _lastModified: Date.now(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                _version: (h as any)._version || 1
              });
            }
          }
        });
      }

      // Sincronizar configuración
      const { data: config, error: cError } = await supabase
        .from('configuracion_precios')
        .select('*')
        .single();

      if (!cError && config) {
        await db.configuracion.put({
          ...config,
          id: '1',
          _syncStatus: 'synced',
          _lastModified: Date.now()
        });
      }

    } catch (err) {
      console.warn('Error sincronizando datos maestros:', err);
    }
  }

  // ============================================
  // API PÚBLICA
  // ============================================

  cancel(): void {
    this.abortController?.abort();
  }

  getStatus(): { isProcessing: boolean; queueSize: number } {
    return {
      isProcessing: this.isProcessing,
      queueSize: 0 // Se actualiza con query real
    };
  }

  async autoSync(): Promise<SyncResult> {
    const networkState = networkMonitor.getState();

    // Solo sincronizar automáticamente si tenemos buena conexión
    if (!networkState.isOnline || networkState.rtt > 3000) {
      return {
        success: false,
        processed: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Conexión no óptima para auto-sync']
      };
    }

    return this.sync({ strategy: 'server-wins', batchSize: 5 });
  }
}

// Singleton
export const syncManager = new SyncManager();

// Exportar tipos
export type { SyncOptions, SyncProgress, SyncResult };
