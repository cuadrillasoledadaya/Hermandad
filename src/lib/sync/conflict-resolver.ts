import { db } from '@/lib/db/database';

export type ConflictStrategy = 'local-wins' | 'server-wins' | 'manual';

export interface Conflict {
  id: string;
  table: string;
  recordId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      return conflicts.map(log => ({
        id: log.id?.toString() || '',
        table: log.table,
        recordId: log.recordId,
        localData: {},
        serverData: {},
        localTimestamp: log.timestamp,
        serverTimestamp: Date.now(),
        resolved: false
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

      const conflict = conflicts.find(c => c.recordId === conflictId);
      if (!conflict) return;

      // Resolver según elección
      if (useLocal) {
        // Reintentar enviar datos locales
        await this.applyLocalVersion({
          id: conflictId,
          table: conflict.table,
          recordId: conflictId,
          localData: {},
          serverData: {},
          localTimestamp: Date.now(),
          serverTimestamp: Date.now(),
          resolved: false
        });
      }

      // Marcar como resuelto en el log
      await db.syncLog.update(conflict.id!, {
        status: 'success',
        details: `Resuelto manualmente: ${useLocal ? 'local' : 'server'}`
      });
    } catch (err) {
      console.error('Error resolviendo conflicto:', err);
      throw err;
    }
  }
}

export const conflictResolver = new ConflictResolver();
