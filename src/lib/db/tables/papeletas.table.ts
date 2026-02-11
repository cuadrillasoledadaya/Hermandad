import { db, Papeleta } from '../database';

export const papeletasRepo = {
  // ============================================
  // CRUD BÁSICO
  // ============================================

  async create(data: Omit<Papeleta, 'id' | '_syncStatus' | '_lastModified'>): Promise<Papeleta> {
    const id = crypto.randomUUID();
    const record: Papeleta = {
      ...data,
      id,
      _syncStatus: 'pending',
      _lastModified: Date.now()
    };

    await db.transaction('rw', [db.papeletas, db.mutations], async () => {
      await db.papeletas.add(record);

      await db.mutations.add({
        type: 'insert',
        table: 'papeletas_cortejo',
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

  async update(id: string, changes: Partial<Papeleta>): Promise<void> {
    const existing = await db.papeletas.get(id);
    if (!existing) throw new Error('Papeleta no encontrada');

    const updated = {
      ...existing,
      ...changes,
      _syncStatus: 'pending' as const,
      _lastModified: Date.now()
    };

    await db.transaction('rw', [db.papeletas, db.mutations], async () => {
      await db.papeletas.update(id, updated);

      await db.mutations.add({
        type: 'update',
        table: 'papeletas_cortejo',
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
    await db.transaction('rw', [db.papeletas, db.mutations], async () => {
      await db.mutations.add({
        type: 'delete',
        table: 'papeletas_cortejo',
        data: { id },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });

      // Cambiar estado a cancelada (soft delete)
      await db.papeletas.update(id, {
        estado: 'cancelada',
        _syncStatus: 'pending',
        _lastModified: Date.now()
      });
    });

    this.notifyMutationChange();
  },

  // ============================================
  // QUERIES ESPECÍFICAS
  // ============================================

  async getById(id: string): Promise<Papeleta | undefined> {
    return db.papeletas.get(id);
  },

  async getAll(): Promise<Papeleta[]> {
    return db.papeletas.toArray();
  },

  async saveAll(papeletas: Papeleta[]): Promise<void> {
    await this.bulkSync(papeletas);
  },

  async getByHermano(idHermano: string, options?: { anio?: number }): Promise<Papeleta[]> {
    let query = db.papeletas.where('id_hermano').equals(idHermano);

    if (options?.anio) {
      query = query.filter(p => p.anio === options.anio);
    }

    return query.toArray();
  },

  async getByAnio(anio: number, options?: {
    estado?: Papeleta['estado'];
    tipo?: Papeleta['tipo'];
    tramo?: number;
  }): Promise<Papeleta[]> {
    const query = db.papeletas.where('anio').equals(anio);

    let results = await query.toArray();

    if (options?.estado) {
      results = results.filter(p => p.estado === options.estado);
    }

    if (options?.tipo) {
      results = results.filter(p => p.tipo === options.tipo);
    }

    if (options?.tramo !== undefined) {
      results = results.filter(p => p.tramo === options.tramo);
    }

    return results.sort((a, b) => a.numero - b.numero);
  },

  async getPendientes(anio: number, tipo?: string): Promise<Papeleta[]> {
    let query = db.papeletas
      .where('anio')
      .equals(anio)
      .filter(p => p.estado === 'pagada');

    if (tipo) {
      query = query.filter(p => p.tipo === tipo);
    }

    return query.toArray();
  },

  async getByNumero(numero: number, anio: number): Promise<Papeleta | undefined> {
    return db.papeletas
      .where({ anio, numero })
      .first();
  },

  // Verificar si hermano ya tiene papeleta
  async hermanoTienePapeleta(idHermano: string, anio: number): Promise<boolean> {
    const papeleta = await db.papeletas
      .where('id_hermano')
      .equals(idHermano)
      .filter(p => p.anio === anio && p.estado !== 'cancelada')
      .first();

    return !!papeleta;
  },

  // Obtener siguiente número disponible
  async getSiguienteNumero(anio: number): Promise<number> {
    const ultima = await db.papeletas
      .where('anio')
      .equals(anio)
      .filter(p => p.numero > 0) // Ignorar provisionales
      .reverse()
      .sortBy('numero');

    if (ultima.length === 0) return 1;
    return ultima[0].numero + 1;
  },

  // ============================================
  // SINCRONIZACIÓN ESPECÍFICA
  // ============================================

  async markAsSynced(id: string, numeroReal?: number): Promise<void> {
    const updates: Partial<Papeleta> = {
      _syncStatus: 'synced',
      _lastModified: Date.now()
    };

    if (numeroReal !== undefined) {
      updates.numero = numeroReal;
    }

    await db.papeletas.update(id, updates);
  },

  async markAsConflict(id: string): Promise<void> {
    await db.papeletas.update(id, {
      _syncStatus: 'conflict',
      _lastModified: Date.now()
    });
  },

  async actualizarNumeroProvisional(id: string, nuevoNumero: number): Promise<void> {
    await db.papeletas.update(id, {
      numero: nuevoNumero,
      _syncStatus: 'pending'
    });
  },

  async bulkSync(papeletas: Papeleta[]): Promise<void> {
    await db.transaction('rw', db.papeletas, async () => {
      for (const papeleta of papeletas) {
        const existing = await db.papeletas.get(papeleta.id);

        if (!existing || existing._syncStatus === 'synced') {
          await db.papeletas.put({
            ...papeleta,
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

  async getStats(anio: number) {
    const papeletas = await this.getByAnio(anio);

    const vendidas = papeletas.filter(p => p.estado !== 'cancelada');
    const asignadas = papeletas.filter(p => p.estado === 'asignada');
    const pendientes = papeletas.filter(p => p.estado === 'pagada');
    const canceladas = papeletas.filter(p => p.estado === 'cancelada');

    return {
      total: papeletas.length,
      vendidas: vendidas.length,
      asignadas: asignadas.length,
      pendientes: pendientes.length,
      canceladas: canceladas.length,
      ingresosTotales: vendidas.reduce((sum, p) => sum + (p.importe || 0), 0),
      porTipo: {
        nazareno: vendidas.filter(p => p.tipo === 'nazareno').length,
        costalero: vendidas.filter(p => p.tipo === 'costalero').length,
        insignia: vendidas.filter(p => p.tipo === 'insignia').length,
        vara: vendidas.filter(p => p.tipo === 'vara').length,
        bocina: vendidas.filter(p => p.tipo === 'bocina').length,
        cruz_guia: vendidas.filter(p => p.tipo === 'cruz_guia').length,
      },
      porTramo: {
        0: vendidas.filter(p => p.tramo === 0).length,
        1: vendidas.filter(p => p.tramo === 1).length,
        2: vendidas.filter(p => p.tramo === 2).length,
        3: vendidas.filter(p => p.tramo === 3).length,
      },
      pendientesSync: papeletas.filter(p => p._syncStatus === 'pending').length,
      conflictos: papeletas.filter(p => p._syncStatus === 'conflict').length
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
