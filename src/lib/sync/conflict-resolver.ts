import { db } from '@/lib/db/database';

export type ConflictStrategy = 'local-wins' | 'server-wins' | 'manual';

export interface Conflict {
  id: string;
  table: string;
  recordId: string;
  localData: any;
  serverData: any;
  localTimestamp: number;
  serverTimestamp: number;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merged';
}

class ConflictResolver {
  async detectConflict(
    table: string,
    recordId: string,
    localData: any
  ): Promise<boolean> {
    const { createClient } = await import('@/lib/supabase');
    const supabase = createClient();

    try {
      const { data: serverRecord, error } = await supabase
        .from(table)
        .select('updated_at, _lastModified')
        .eq('id', recordId)
        .single();

      if (error || !serverRecord) return false;

      const serverTime = new Date(serverRecord.updated_at).getTime();
      const localTime = localData._lastModified || localData.updated_at;

      // Hay conflicto si el servidor tiene una versión más nueva
      return serverTime > localTime;
    } catch {
      return false;
    }
  }

  async resolve(
    conflict: Conflict,
    strategy: ConflictStrategy,
    manualResolution?: 'local' | 'server'
  ): Promise<'local' | 'server' | 'merged'> {
    switch (strategy) {
      case 'server-wins':
        await this.applyServerVersion(conflict);
        return 'server';

      case 'local-wins':
        await this.applyLocalVersion(conflict);
        return 'local';

      case 'manual':
        if (!manualResolution) {
          await this.queueForManualResolution(conflict);
          throw new Error('Conflicto requiere resolución manual');
        }
        if (manualResolution === 'local') {
          await this.applyLocalVersion(conflict);
        } else {
          await this.applyServerVersion(conflict);
        }
        return manualResolution;

      default:
        // Por defecto, servidor gana
        await this.applyServerVersion(conflict);
        return 'server';
    }
  }

  private async applyServerVersion(conflict: Conflict): Promise<void> {
    // Actualizar registro local con datos del servidor
    const table = conflict.table as 'hermanos' | 'pagos' | 'papeletas';
    await db[table].update(conflict.recordId, {
      ...conflict.serverData,
      _syncStatus: 'synced'
    });
  }

  private async applyLocalVersion(conflict: Conflict): Promise<void> {
    // Forzar update en servidor con datos locales
    const { createClient } = await import('@/lib/supabase');
    const supabase = createClient();

    const { error } = await supabase
      .from(conflict.table)
      .update(conflict.localData)
      .eq('id', conflict.recordId);

    if (error) throw error;

    // Marcar como sincronizado
    const table = conflict.table as any;
    // Typescript issue: conflict.table is string but db needs specific table name
    if (db[table as 'hermanos' | 'pagos' | 'papeletas']) {
      await db[table as 'hermanos' | 'pagos' | 'papeletas'].update(conflict.recordId, {
        _syncStatus: 'synced'
      });
    }
  }

  private async queueForManualResolution(conflict: Conflict): Promise<void> {
    // Guardar en tabla de conflictos para resolución manual
    await (db as any).conflicts?.add({ // assuming conflicts table might exist or using any to bypass
      ...conflict,
      created_at: Date.now(),
      resolved: false
    })
      // fallback if conflicts table doesn't exist in type definition
      .catch(() => console.warn('Conflicts table not found'));
  }

  async getPendingConflicts(): Promise<Conflict[]> {
    try {
      // Buscar en syncLog los registros con status 'conflict'
      const conflicts = await db.syncLog
        .where('status')
        .equals('conflict')
        .toArray();

      // Obtener datos reales para cada conflicto
      return await Promise.all(conflicts.map(async (log) => {
        const table = log.table as 'hermanos' | 'pagos' | 'papeletas';

        // Obtener datos locales de IndexedDB
        let localRecord: any = null;
        try {
          localRecord = await db[table].get(log.recordId);
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener registro local de ${table}:`, err);
        }

        // Obtener datos del servidor
        let serverRecord: any = null;
        try {
          const { createClient } = await import('@/lib/supabase');
          const supabase = createClient();

          const { data, error } = await supabase
            .from(log.table)
            .select('*')
            .eq('id', log.recordId)
            .single();

          if (!error && data) {
            serverRecord = data;
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener registro del servidor de ${log.table}:`, err);
        }

        return {
          id: log.id?.toString() || '',
          table: log.table,
          recordId: log.recordId,
          localData: localRecord || {},
          serverData: serverRecord || {},
          localTimestamp: log.timestamp,
          serverTimestamp: serverRecord?.updated_at
            ? new Date(serverRecord.updated_at).getTime()
            : Date.now(),
          resolved: false
        };
      }));
    } catch {
      return [];
    }
  }

  async resolveManually(
    conflictId: string,
    useLocal: boolean
  ): Promise<void> {
    try {
      // Buscar en syncLog los conflictos pendientes
      const conflicts = await db.syncLog
        .where('status')
        .equals('conflict')
        .toArray();

      const conflictLog = conflicts.find(c => c.recordId === conflictId);
      if (!conflictLog) {
        console.warn(`⚠️ Conflicto ${conflictId} no encontrado`);
        return;
      }

      const table = conflictLog.table as 'hermanos' | 'pagos' | 'papeletas';

      // Obtener datos reales del conflicto
      const localRecord = await db[table].get(conflictId);

      if (!localRecord) {
        console.warn(`⚠️ No hay datos locales para ${conflictId}`);
        return;
      }

      // Crear objeto de conflicto con datos reales
      const conflict: Conflict = {
        id: conflictLog.id?.toString() || '',
        table: conflictLog.table,
        recordId: conflictId,
        localData: localRecord,
        serverData: {}, // Se obtendrá en applyLocalVersion si es necesario
        localTimestamp: conflictLog.timestamp,
        serverTimestamp: Date.now(),
        resolved: false
      };

      // Resolver según elección
      if (useLocal) {
        // Forzar datos locales al servidor
        await this.applyLocalVersion(conflict);
      } else {
        // Aplicar datos del servidor (obtener primero)
        const { createClient } = await import('@/lib/supabase');
        const supabase = createClient();

        const { data: serverRecord } = await supabase
          .from(conflictLog.table)
          .select('*')
          .eq('id', conflictId)
          .single();

        if (serverRecord) {
          conflict.serverData = serverRecord;
          await this.applyServerVersion(conflict);
        }
      }

      // Marcar como resuelto en el log
      if (conflictLog.id) {
        await db.syncLog.update(conflictLog.id, {
          status: 'success',
          details: `Resuelto manualmente: ${useLocal ? 'local' : 'server'}`
        });
      }
    } catch (err) {
      console.error('❌ Error resolviendo conflicto:', err);
      throw err;
    }
  }
}

export const conflictResolver = new ConflictResolver();
