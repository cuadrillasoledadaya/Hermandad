import { db, Pago } from '../database';

export const pagosRepo = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async create(data: Omit<Pago, 'id' | '_syncStatus' | '_lastModified'>): Promise<Pago> {
    const id = crypto.randomUUID();
    const record: Pago = {
      ...data,
      id,
      _syncStatus: 'pending',
      _lastModified: Date.now()
    };

    await db.transaction('rw', [db.pagos, db.mutations], async () => {
      await db.pagos.add(record);

      await db.mutations.add({
        type: 'insert',
        table: 'pagos',
        data: record,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });
    });

    this.notifyMutationChange();

    return record;
  },

  async update(id: string, changes: Partial<Pago>): Promise<void> {
    const existing = await db.pagos.get(id);
    if (!existing) throw new Error('Pago no encontrado');

    const updated = {
      ...existing,
      ...changes,
      _syncStatus: 'pending' as const,
      _lastModified: Date.now()
    };

    await db.transaction('rw', [db.pagos, db.mutations], async () => {
      await db.pagos.update(id, updated);

      await db.mutations.add({
        type: 'update',
        table: 'pagos',
        data: { id, ...changes },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });
    });

    this.notifyMutationChange();
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.pagos, db.mutations], async () => {
      await db.mutations.add({
        type: 'delete',
        table: 'pagos',
        data: { id },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });

      // Soft delete local
      await db.pagos.update(id, {
        _syncStatus: 'pending',
        _lastModified: Date.now()
      });
    });

    this.notifyMutationChange();
  },

  // ============================================
  // QUERIES
  // ============================================

  async getById(id: string): Promise<Pago | undefined> {
    return db.pagos.get(id);
  },

  async getByHermano(idHermano: string, options?: { anio?: number }): Promise<Pago[]> {
    const query = db.pagos.where('id_hermano').equals(idHermano);

    const results = await query.toArray();

    if (options?.anio) {
      return results.filter(p => p.anio === options.anio);
    }

    return results.sort((a, b) =>
      new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
    );
  },

  /** Alias para compatibilidad con lógica antigua */
  async getPagosLocal(idHermano: string): Promise<Pago[]> {
    return this.getByHermano(idHermano);
  },

  async getByAnio(anio: number): Promise<Pago[]> {
    return db.pagos
      .where('anio')
      .equals(anio)
      .toArray();
  },

  async getAll(options?: {
    syncStatus?: Pago['_syncStatus'];
    orderBy?: 'fecha_pago' | 'cantidad';
  }): Promise<Pago[]> {
    let collection = db.pagos.toCollection();

    if (options?.syncStatus) {
      collection = collection.filter(p => p._syncStatus === options.syncStatus);
    }

    if (options?.orderBy) {
      const sorted = await collection.sortBy(options.orderBy);
      return sorted.reverse(); // Más recientes primero
    }

    return collection.toArray();
  },

  async getTotalByAnio(anio: number): Promise<number> {
    const pagos = await this.getByAnio(anio);
    return pagos.reduce((sum, p) => sum + (p.cantidad || 0), 0);
  },

  // ============================================
  // SINCRONIZACIÓN
  // ============================================

  async markAsSynced(id: string, additionalChanges?: Partial<Pago>): Promise<void> {
    const updates: Partial<Pago> = {
      _syncStatus: 'synced',
      _lastModified: Date.now(),
      ...additionalChanges
    };
    await db.pagos.update(id, updates);
  },

  async markAsConflict(id: string): Promise<void> {
    await db.pagos.update(id, {
      _syncStatus: 'conflict',
      _lastModified: Date.now()
    });
  },

  async bulkSync(pagos: Pago[]): Promise<void> {
    await db.transaction('rw', db.pagos, async () => {
      for (const pago of pagos) {
        const existing = await db.pagos.get(pago.id);

        if (!existing || existing._syncStatus === 'synced') {
          await db.pagos.put({
            ...pago,
            _syncStatus: 'synced',
            _lastModified: Date.now()
          });
        }
      }
    });
  },

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  async getStats(anio?: number) {
    let query = db.pagos.toCollection();

    if (anio) {
      query = query.filter(p => p.anio === anio);
    }

    const pagos = await query.toArray();

    return {
      total: pagos.length,
      montoTotal: pagos.reduce((sum, p) => sum + (p.cantidad || 0), 0),
      promedio: pagos.length > 0
        ? pagos.reduce((sum, p) => sum + (p.cantidad || 0), 0) / pagos.length
        : 0,
      pendientes: pagos.filter(p => p._syncStatus === 'pending').length
    };
  },

  // ============================================
  // UTILIDADES
  // ============================================

  notifyMutationChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dexie-mutation-changed'));
    }
  }
};
