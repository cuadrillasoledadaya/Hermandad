import { db, Hermano } from '../database';
import { MutationQueueItem } from '../database';

export const hermanosRepo = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async create(data: Omit<Hermano, 'id' | '_syncStatus' | '_lastModified' | '_version'>): Promise<Hermano> {
    const id = crypto.randomUUID();
    const record: Hermano = {
      ...data,
      id,
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _version: 1
    };

    await db.transaction('rw', [db.hermanos, db.mutations], async () => {
      // Guardar en tabla local
      await db.hermanos.add(record);

      // Añadir a cola de sincronización
      await db.mutations.add({
        type: 'insert',
        table: 'hermanos',
        data: record,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });
    });

    // Notificar cambio
    this.notifyMutationChange();

    return record;
  },

  async update(id: string, changes: Partial<Hermano>): Promise<void> {
    const existing = await db.hermanos.get(id);
    if (!existing) throw new Error('Hermano no encontrado');

    const updated = { 
      ...existing, 
      ...changes, 
      _syncStatus: 'pending' as const,
      _lastModified: Date.now(),
      _version: (existing._version || 0) + 1
    };

    await db.transaction('rw', [db.hermanos, db.mutations], async () => {
      await db.hermanos.update(id, updated);

      await db.mutations.add({
        type: 'update',
        table: 'hermanos',
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
    await db.transaction('rw', [db.hermanos, db.mutations], async () => {
      // Soft delete: marcar como inactivo
      await db.hermanos.update(id, { 
        activo: false, 
        _syncStatus: 'pending',
        _lastModified: Date.now()
      });

      await db.mutations.add({
        type: 'update',
        table: 'hermanos',
        data: { id, activo: false },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });
    });

    this.notifyMutationChange();
  },

  // ============================================
  // QUERIES
  // ============================================

  async getById(id: string): Promise<Hermano | undefined> {
    return db.hermanos.get(id);
  },

  async getAll(options?: {
    syncStatus?: Hermano['_syncStatus'];
    activo?: boolean;
    orderBy?: 'numero_hermano' | 'nombre' | 'apellidos' | '_lastModified';
    ascending?: boolean;
  }): Promise<Hermano[]> {
    let collection = db.hermanos.toCollection();

    // Filtros
    if (options?.syncStatus) {
      collection = collection.filter(h => h._syncStatus === options.syncStatus);
    }

    if (options?.activo !== undefined) {
      collection = collection.filter(h => h.activo === options.activo);
    }

    // Ordenamiento
    if (options?.orderBy) {
      const sorted = await collection.sortBy(options.orderBy);
      if (options.ascending === false) {
        return sorted.reverse();
      }
      return sorted;
    }

    return collection.toArray();
  },

  async search(term: string, options?: { limit?: number }): Promise<Hermano[]> {
    const normalized = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const limit = options?.limit || 20;

    const results = await db.hermanos
      .filter(h => {
        const fullName = `${h.nombre} ${h.apellidos}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        
        const email = (h.email || '').toLowerCase();
        const telefono = (h.telefono || '').toLowerCase();
        const numero = String(h.numero_hermano || '');

        return fullName.includes(normalized) || 
               email.includes(normalized) || 
               telefono.includes(normalized) ||
               numero.includes(normalized);
      })
      .limit(limit)
      .toArray();

    // Ordenar por relevancia
    return results.sort((a, b) => {
      const nameA = `${a.nombre} ${a.apellidos}`.toLowerCase();
      const nameB = `${b.nombre} ${b.apellidos}`.toLowerCase();
      
      const startsWithA = nameA.startsWith(normalized);
      const startsWithB = nameB.startsWith(normalized);
      
      if (startsWithA && !startsWithB) return -1;
      if (!startsWithA && startsWithB) return 1;
      
      return nameA.localeCompare(nameB);
    });
  },

  async getByNumero(numero: number): Promise<Hermano | undefined> {
    return db.hermanos
      .where('numero_hermano')
      .equals(numero)
      .first();
  },

  async getByEmail(email: string): Promise<Hermano | undefined> {
    return db.hermanos
      .where('email')
      .equals(email)
      .first();
  },

  // ============================================
  // SINCRONIZACIÓN
  // ============================================

  async markAsSynced(id: string): Promise<void> {
    await db.hermanos.update(id, { 
      _syncStatus: 'synced',
      _lastModified: Date.now()
    });
  },

  async markAsConflict(id: string): Promise<void> {
    await db.hermanos.update(id, { 
      _syncStatus: 'conflict',
      _lastModified: Date.now()
    });
  },

  async bulkSync(hermanos: Hermano[]): Promise<void> {
    await db.transaction('rw', db.hermanos, async () => {
      for (const hermano of hermanos) {
        const existing = await db.hermanos.get(hermano.id);
        
        // Solo actualizar si no hay cambios locales pendientes
        if (!existing || existing._syncStatus === 'synced') {
          await db.hermanos.put({
            ...hermano,
            _syncStatus: 'synced',
            _lastModified: Date.now(),
            _version: (hermano._version || 0) + 1
          });
        }
      }
    });
  },

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  async getStats() {
    const total = await db.hermanos.count();
    const activos = await db.hermanos.where('activo').equals(1).count();
    const pendientes = await db.hermanos.where('_syncStatus').equals('pending').count();
    const conflictos = await db.hermanos.where('_syncStatus').equals('conflict').count();

    return { total, activos, pendientes, conflictos };
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
