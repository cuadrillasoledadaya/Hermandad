import { db, MutationQueueItem } from '../database';

export const mutationsRepo = {
  // ============================================
  // OPERACIONES BÁSICAS
  // ============================================

  async add(mutation: Omit<MutationQueueItem, 'id'>): Promise<number> {
    const id = await db.mutations.add(mutation as MutationQueueItem);
    this.notifyChange();
    return id;
  },

  async remove(id: number): Promise<void> {
    await db.mutations.delete(id);
    this.notifyChange();
  },

  async update(id: number, changes: Partial<MutationQueueItem>): Promise<void> {
    await db.mutations.update(id, changes);
    this.notifyChange();
  },

  // ============================================
  // QUERIES
  // ============================================

  async getAll(): Promise<MutationQueueItem[]> {
    return db.mutations.toArray();
  },

  async getPending(): Promise<MutationQueueItem[]> {
    return db.mutations
      .where('status')
      .equals('pending')
      .sortBy('priority');
  },

  async getPendingCount(): Promise<number> {
    return db.mutations.where('status').equals('pending').count();
  },

  async getByStatus(status: MutationQueueItem['status']): Promise<MutationQueueItem[]> {
    return db.mutations
      .where('status')
      .equals(status)
      .toArray();
  },

  async getByTable(table: string): Promise<MutationQueueItem[]> {
    return db.mutations
      .where('table')
      .equals(table)
      .toArray();
  },

  async getNextPending(): Promise<MutationQueueItem | undefined> {
    const pending = await this.getPending();
    return pending[0]; // Ya están ordenados por prioridad
  },

  // ============================================
  // PROCESAMIENTO
  // ============================================

  async markAsProcessing(id: number): Promise<void> {
    await db.mutations.update(id, {
      status: 'processing',
      retryCount: (await db.mutations.get(id))?.retryCount || 0
    });
  },

  async markAsFailed(id: number, error: string): Promise<void> {
    const mutation = await db.mutations.get(id);
    if (!mutation) return;

    const newRetryCount = mutation.retryCount + 1;
    const shouldDead = newRetryCount >= mutation.maxRetries;

    await db.mutations.update(id, {
      status: shouldDead ? 'dead' : 'failed',
      retryCount: newRetryCount,
      error
    });

    this.notifyChange();
  },

  async markAsDead(id: number, error: string): Promise<void> {
    await db.mutations.update(id, {
      status: 'dead',
      error
    });
    this.notifyChange();
  },

  async retryFailed(): Promise<number> {
    const failed = await this.getByStatus('failed');

    for (const mutation of failed) {
      if (mutation.id) {
        await db.mutations.update(mutation.id, {
          status: 'pending',
          retryCount: 0,
          error: undefined
        });
      }
    }

    this.notifyChange();
    return failed.length;
  },

  // ============================================
  // LIMPIEZA
  // ============================================

  async clearCompleted(): Promise<number> {
    // Eliminar mutations completadas o muy antiguas
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const oldMutations = await db.mutations
      .where('timestamp')
      .below(thirtyDaysAgo)
      .toArray();

    const idsToDelete = oldMutations
      .filter(m => m.status === 'dead')
      .map(m => m.id)
      .filter(Boolean) as number[];

    if (idsToDelete.length > 0) {
      await db.mutations.bulkDelete(idsToDelete);
    }

    return idsToDelete.length;
  },

  async clearAll(): Promise<void> {
    await db.mutations.clear();
    this.notifyChange();
  },

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  async getStats() {
    const total = await db.mutations.count();
    const pending = await db.mutations.where('status').equals('pending').count();
    const processing = await db.mutations.where('status').equals('processing').count();
    const failed = await db.mutations.where('status').equals('failed').count();
    const dead = await db.mutations.where('status').equals('dead').count();

    return {
      total,
      pending,
      processing,
      failed,
      dead,
      successRate: total > 0 ? ((total - failed - dead) / total) * 100 : 100
    };
  },

  async getPendingByTable(): Promise<Record<string, number>> {
    const pending = await this.getPending();
    const byTable: Record<string, number> = {};

    for (const mutation of pending) {
      byTable[mutation.table] = (byTable[mutation.table] || 0) + 1;
    }

    return byTable;
  },

  // ============================================
  // UTILIDADES
  // ============================================

  notifyChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dexie-mutation-changed'));
    }
  }
};
