import Dexie, { Table } from 'dexie';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

// ============================================
// INTERFACES
// ============================================

export interface Hermano {
  id: string;
  numero_hermano: number;
  nombre: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_alta: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  // Campos de sincronización
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
  _version: number;
}

export interface Pago {
  id: string;
  id_hermano: string;
  cantidad: number;
  fecha_pago: string;
  anio: number;
  tipo_pago: string;
  concepto: string;
  id_papeleta?: string;
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
}

export interface Papeleta {
  id: string;
  id_hermano: string;
  numero: number;
  anio: number;
  tipo: string;
  tramo: number | null;
  estado: 'pagada' | 'asignada' | 'cancelada';
  importe: number;
  fecha_pago: string;
  id_ingreso: string | null;
  id_posicion_asignada: string | null;
  fecha_asignacion: string | null;
  created_at: string;
  updated_at: string;
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
}

export interface Configuracion {
  id: string;
  papeleta_nazareno: number;
  papeleta_costalero: number;
  papeleta_insignia: number;
  papeleta_vara: number;
  papeleta_bocina: number;
  papeleta_cruz_guia: number;
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
}

export interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  cantidad: number;
  categoria: string;
  id_hermano?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
}

export interface MutationQueueItem {
  id?: number;
  type: 'insert' | 'update' | 'delete';
  table: 'hermanos' | 'pagos' | 'papeletas_cortejo' | 'configuracion' | 'cortejo_asignaciones';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'dead';
  error?: string;
  priority: number; // 1 = alta, 10 = baja
}

export interface SyncLog {
  id?: number;
  timestamp: number;
  operation: string;
  table: string;
  recordId: string;
  status: 'success' | 'error' | 'conflict';
  details?: string;
}

// ============================================
// DATABASE CLASS
// ============================================

export class HermandadDatabase extends Dexie {
  hermanos!: Table<Hermano>;
  pagos!: Table<Pago>;
  papeletas!: Table<Papeleta>;
  configuracion!: Table<Configuracion>;
  gastos!: Table<Gasto>;
  mutations!: Table<MutationQueueItem>;
  syncLog!: Table<SyncLog>;

  constructor() {
    super('HermandadOfflineDB-v3');

    this.version(1).stores({
      hermanos: 'id, numero_hermano, email, activo, _syncStatus, _lastModified',
      pagos: 'id, id_hermano, fecha_pago, anio, _syncStatus, _lastModified',
      papeletas: 'id, id_hermano, anio, numero, tipo, _syncStatus, _lastModified',
      configuracion: 'id, _syncStatus',
      gastos: 'id, fecha, categoria, _syncStatus, _lastModified',
      mutations: '++id, timestamp, status, priority, table',
      syncLog: '++id, timestamp, operation, status'
    });

    // Hooks para auto-actualizar timestamps y status
    this.setupHooks();
  }

  private setupHooks() {
    // Hook para hermanos
    this.hermanos.hook('creating', (_primKey, obj) => {
      obj._lastModified = Date.now();
      obj._syncStatus = obj._syncStatus || 'pending';
      obj._version = 1;
    });

    this.hermanos.hook('updating', (modifications, _primKey, obj) => {
      return {
        ...modifications,
        _lastModified: Date.now(),
        _version: (obj._version || 0) + 1
      };
    });

    this.pagos.hook('updating', (modifications, _primKey, _obj) => {
      return {
        ...modifications,
        _lastModified: Date.now()
      };
    });

    // Hook para papeletas
    this.papeletas.hook('creating', (_primKey, obj) => {
      obj._lastModified = Date.now();
      obj._syncStatus = obj._syncStatus || 'pending';
    });

    this.papeletas.hook('updating', (modifications, _primKey, _obj) => {
      return {
        ...modifications,
        _lastModified: Date.now()
      };
    });

    // Hook para configuracion
    this.configuracion.hook('creating', (_primKey, obj) => {
      obj._lastModified = Date.now();
      obj._syncStatus = obj._syncStatus || 'pending';
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.configuracion.hook('updating', (modifications, _primKey, _obj) => {
      return {
        ...modifications,
        _lastModified: Date.now()
      };
    });

    // Hook para gastos
    this.gastos.hook('creating', (_primKey, obj) => {
      obj._lastModified = Date.now();
      obj._syncStatus = obj._syncStatus || 'pending';
    });

    this.gastos.hook('updating', (modifications, _primKey, _obj) => {
      return {
        ...modifications,
        _lastModified: Date.now()
      };
    });
  }

  // ============================================
  // MÉTODOS UTILITARIOS
  // ============================================

  async getPendingCount(): Promise<number> {
    return this.mutations
      .where('status')
      .equals('pending')
      .count();
  }

  async getSyncStats() {
    const total = await this.mutations.count();
    const pending = await this.mutations.where('status').equals('pending').count();
    const failed = await this.mutations.where('status').equals('failed').count();
    const dead = await this.mutations.where('status').equals('dead').count();

    return { total, pending, failed, dead };
  }

  async clearCompletedMutations(): Promise<number> {
    // Eliminar mutations con status 'dead' o muy antiguos (30 días)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const oldMutations = await this.mutations
      .where('timestamp')
      .below(thirtyDaysAgo)
      .toArray();

    const idsToDelete = oldMutations.map(m => m.id).filter(Boolean) as number[];

    if (idsToDelete.length > 0) {
      await this.mutations.bulkDelete(idsToDelete);
    }

    return idsToDelete.length;
  }
}

// ============================================
// INSTANCIA GLOBAL
// ============================================

export const db = new HermandadDatabase();

// ============================================
// FUNCIONES DE MIGRACIÓN DESDE DB ANTIGUA
// ============================================

export async function migrateFromOldDB(): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar si hay datos en la base antigua
    const oldDBExists = await checkOldDatabaseExists();

    if (!oldDBExists) {
      return { success: true, message: 'No hay datos antiguos para migrar' };
    }

    // Importar datos antiguos
    const { initDB: initOldDB } = await import('../db');
    const oldDB = await initOldDB();

    // Migrar hermanos
    const oldHermanos = await oldDB.getAll('hermanos');
    if (oldHermanos.length > 0) {
      const hermanosWithSync = oldHermanos.map((h: AnyData) => ({
        ...h,
        _syncStatus: 'synced',
        _lastModified: Date.now(),
        _version: 1
      }));
      await db.hermanos.bulkAdd(hermanosWithSync);
    }

    // Migrar pagos
    const oldPagos = await oldDB.getAll('pagos');
    if (oldPagos.length > 0) {
      const pagosWithSync = oldPagos.map((p: AnyData) => ({
        ...p,
        _syncStatus: 'synced',
        _lastModified: Date.now()
      }));
      await db.pagos.bulkAdd(pagosWithSync);
    }

    // Migrar papeletas
    const oldPapeletas = await oldDB.getAll('papeletas_cortejo');
    if (oldPapeletas.length > 0) {
      const papeletasWithSync = oldPapeletas.map((p: AnyData) => ({
        ...p,
        _syncStatus: 'synced',
        _lastModified: Date.now()
      }));
      await db.papeletas.bulkAdd(papeletasWithSync);
    }

    // Migrar mutations pendientes
    const oldMutations = await oldDB.getAll('mutation_queue');
    if (oldMutations.length > 0) {
      const mutationsWithStatus = oldMutations.map((m: AnyData) => ({
        ...m,
        status: 'pending',
        maxRetries: 3,
        priority: 1
      }));
      await db.mutations.bulkAdd(mutationsWithStatus);
    }

    return {
      success: true,
      message: `Migrados: ${oldHermanos.length} hermanos, ${oldPagos.length} pagos, ${oldPapeletas.length} papeletas, ${oldMutations.length} mutations`
    };

  } catch (error) {
    console.error('Error migrando datos:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function checkOldDatabaseExists(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open('hermandad_offline_db');

    request.onsuccess = () => {
      request.result.close();
      resolve(true);
    };

    request.onerror = () => {
      resolve(false);
    };

    request.onupgradeneeded = () => {
      request.transaction?.abort();
      resolve(false);
    };
  });
}
