# 📋 PLAN ARQUITECTÓNICO: SISTEMA OFFLINE ROBUSTO CON DEXIE.JS

## 📊 ANÁLISIS DEL SISTEMA ACTUAL

### Problemas Críticos Identificados

#### 1. ARQUITECTURA FRAGMENTADA
**Problema**: El sistema offline está disperso en múltiples archivos sin una capa de abstracción clara.

**Distribución actual**:
- `src/lib/db.ts` - 246 líneas: IndexedDB con idb-keyval (bajo nivel)
- `src/lib/offline-mutation.ts` - 106 líneas: Lógica de mutations
- `src/hooks/use-offline-sync.ts` - 314 líneas: Sincronización compleja
- `src/hooks/use-network-status.ts` - Detección de red
- Lógica duplicada en `papeletas-cortejo.ts` y `brothers.ts`

**Impacto**: Difícil de mantener, testing complejo, comportamientos inconsistentes.

#### 2. MANEJO DE ESTADOS INCONSISTENTE
**Problema**: No hay una única fuente de verdad para el estado offline.

**Flujo actual problemático**:
```
1. Usuario crea papeleta
2. offlineMutation() detecta offline
3. Guarda en mutation_queue (cola)
4. Guarda en papeletas_cortejo (optimistic)
5. Marca con _offline: true
6. UI lee de React Query (caché)
7. UI también lee de IndexedDB
8. UI también lee de Supabase (si online)
9. Tres fuentes de datos diferentes = inconsistencias
```

**Casos de fallo**:
- Datos sincronizados mantienen flag `_offline: true`
- React Query no invalida correctamente tras sync
- IDs provisionales vs reales generan duplicados
- Race conditions entre syncMasterData y processMutations

#### 3. GESTIÓN DE TIMEOUTS INADECUADA
**Problema**: Timeouts arbitrarios de 15 segundos no distinguen entre:
- Red lenta pero funcional (móvil 3G)
- Red caída completamente
- Supabase sobrecargado

**Código problemático**:
```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Network timeout')), 15000);
});
```

**Impacto**: En móvil con 3G real, 15 segundos puede ser insuficiente para operaciones complejas (ej: vender papeleta que requiere validación + insert + recalibración de números).

#### 4. SINCRONIZACIÓN SIN ESTRATEGIA DE CONFLICTOS
**Problema**: No hay sistema de resolución de conflictos cuando:
- Usuario A edita hermano offline
- Usuario B edita el mismo hermano online
- Ambos sincronizan

**Actual**: "Last write wins" implícito → puede perder datos importantes.

#### 5. AUSENCIA DE RECUPERACIÓN DE ERRORES
**Problema**: Si una mutation falla permanentemente (ej: constraint violation):
- Se queda en cola para siempre
- Se reintenta infinitamente
- Bloquea otras mutations posteriores
- No hay mecanismo de "dead letter queue"

#### 6. FALTA DE OBSERVABILIDAD
**Problema**: No hay sistema de logging/tracing del flujo offline.

**Dificulta debuggear**:
- ¿Por qué falló esta mutation?
- ¿En qué paso del proceso se quedó?
- ¿Cuántas veces se reintentó?

---

## 🎯 ARQUITECTURA PROPUESTA CON DEXIE.JS

### ¿Por qué Dexie.js en lugar de idb-keyval?

| Característica | idb-keyval | Dexie.js |
|----------------|------------|----------|
| **Tipo** | Wrapper simple | ORM completo |
| **Transacciones** | Básicas | Avanzadas (multi-store) |
| **Consultas** | Key-value solo | Queries complejas, filtros, ordenamiento |
| **Relaciones** | Manual | Soporte nativo (foreign keys) |
| **Hooks** | No | Pre/post CRUD hooks |
| **Observable** | No | Live queries (reactividad) |
| **Tamaño** | 1KB | 15KB (gzip) |
| **Migrations** | Manual | Sistema robusto de versiones |

**Decisión**: Para tu caso (relaciones complejas hermanos-pagos-papeletas, necesidad de queries avanzadas, sincronización bidireccional), Dexie.js es la elección profesional correcta.

### Diagrama de Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Components  │  │    Hooks     │  │     UI       │      │
│  │  (Dialogs)   │  │ (useMutation)│  │   (Toasts)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
└─────────┼─────────────────┼────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 CAPA DE ESTADO (Zustand)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  offlineStore: Estado global de sincronización       │  │
│  │  - pendingCount                                      │  │
│  │  - isSyncing                                         │  │
│  │  - lastSync                                          │  │
│  │  - conflicts[]                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE SINCRONIZACIÓN (Dexie)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SyncManager (Singleton)                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │   Queue      │  │  Conflict    │  │  Network   │ │  │
│  │  │  Processor   │  │  Resolver    │  │   Monitor  │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE DATOS LOCAL (Dexie DB)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ hermanos │ │  pagos   │ │ papeletas│ │ mutation_queue │ │
│  │  (sync)  │ │  (sync)  │ │  (sync)  │ │   (control)    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘ │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ sync_log │ │ versions │ │metadata  │ │ conflict_queue │ │
│  │ (audit)  │ │ (schema) │ │  (app)   │ │  (fallback)    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────────┐ ┌──────────┐ ┌──────────────────┐
│   Supabase      │ │  Local   │ │  Service Worker  │
│   (Postgres)    │ │  Cache   │ │  (Background)    │
│                 │ │  (API)   │ │                  │
└─────────────────┘ └──────────┘ └──────────────────┘
```

---

## 📦 ESTRUCTURA DE ARCHIVOS PROPUESTA

```
src/
├── lib/
│   ├── db/
│   │   ├── index.ts                    # Exportación pública
│   │   ├── database.ts                 # Instancia Dexie + schema
│   │   ├── tables/
│   │   │   ├── hermanos.table.ts       # Operaciones CRUD + queries
│   │   │   ├── pagos.table.ts
│   │   │   ├── papeletas.table.ts
│   │   │   └── mutations.table.ts      # Cola de operaciones
│   │   └── migrations/
│   │       └── v1-to-v2.ts             # Migraciones de schema
│   ├── sync/
│   │   ├── index.ts
│   │   ├── sync-manager.ts             # Orquestador principal
│   │   ├── conflict-resolver.ts        # Estrategias de resolución
│   │   ├── network-monitor.ts          # Detección robusta de red
│   │   └── strategies/
│   │       ├── local-wins.ts
│   │       ├── server-wins.ts
│   │       └── manual-merge.ts
│   └── offline/
│       ├── offline-manager.ts          # API pública (insert/update/delete)
│       └── optimistic-update.ts        # Lógica de UI inmediata
├── hooks/
│   ├── use-offline-data.ts             # Lee datos locales + online
│   ├── use-sync-status.ts              # Estado de sincronización
│   └── use-mutation-offline.ts         # Wrapper de mutations
└── stores/
    └── offline-store.ts                # Zustand para UI state
```

---

## 🔧 IMPLEMENTACIÓN DETALLADA (Fases)

### FASE 1: Fundación Dexie (Semana 1)

#### 1.1 Instalación y Setup
```bash
npm install dexie
npm install -D @types/dexie
```

#### 1.2 Definición del Schema

**Archivo**: `src/lib/db/database.ts`

```typescript
import Dexie, { Table } from 'dexie';

export interface Hermano {
  id: string;
  numero_hermano: number;
  nombre: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_alta: Date;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
  // Campos de sincronización
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
  _version: number;
}

export interface Pago {
  id: string;
  id_hermano: string;
  cantidad: number;
  fecha_pago: Date;
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
  id_ingreso: string | null;
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _lastModified: number;
}

export interface MutationQueueItem {
  id?: number;
  type: 'insert' | 'update' | 'delete';
  table: 'hermanos' | 'pagos' | 'papeletas_cortejo';
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

export class HermandadDatabase extends Dexie {
  hermanos!: Table<Hermano>;
  pagos!: Table<Pago>;
  papeletas!: Table<Papeleta>;
  mutations!: Table<MutationQueueItem>;
  syncLog!: Table<SyncLog>;

  constructor() {
    super('HermandadOfflineDB');
    
    this.version(1).stores({
      hermanos: 'id, numero_hermano, email, activo, _syncStatus, _lastModified',
      pagos: 'id, id_hermano, fecha_pago, anio, _syncStatus, _lastModified',
      papeletas: 'id, id_hermano, anio, numero, tipo, _syncStatus, _lastModified',
      mutations: '++id, timestamp, status, priority, table',
      syncLog: '++id, timestamp, operation, status'
    });

    // Hooks para auto-actualizar timestamps
    this.hermanos.hook('creating', (primKey, obj) => {
      obj._lastModified = Date.now();
      obj._syncStatus = obj._syncStatus || 'pending';
      obj._version = 1;
    });

    this.hermanos.hook('updating', (modifications, primKey, obj) => {
      return { ...modifications, _lastModified: Date.now(), _version: (obj._version || 0) + 1 };
    });
  }
}

export const db = new HermandadDatabase();
```

#### 1.3 Capa de Repositorio (Patrón Repository)

**Archivo**: `src/lib/db/tables/hermanos.table.ts`

```typescript
import { db } from '../database';

export const hermanosRepo = {
  // CRUD Básico
  async create(data: Omit<Hermano, 'id'>): Promise<Hermano> {
    const id = crypto.randomUUID();
    const record = { ...data, id, _syncStatus: 'pending' as const };
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
    
    return record;
  },

  async update(id: string, changes: Partial<Hermano>): Promise<void> {
    const existing = await db.hermanos.get(id);
    if (!existing) throw new Error('Record not found');
    
    const updated = { ...existing, ...changes, _syncStatus: 'pending' as const };
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
  },

  async delete(id: string): Promise<void> {
    await db.hermanos.update(id, { _syncStatus: 'pending' });
    
    await db.mutations.add({
      type: 'delete',
      table: 'hermanos',
      data: { id },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      priority: 1
    });
    
    // Soft delete local (no borramos físicamente hasta confirmar sync)
    await db.hermanos.update(id, { activo: false });
  },

  // Queries Avanzadas
  async getById(id: string): Promise<Hermano | undefined> {
    return db.hermanos.get(id);
  },

  async getAll(options?: { 
    syncStatus?: Hermano['_syncStatus'];
    activo?: boolean;
    orderBy?: keyof Hermano;
  }): Promise<Hermano[]> {
    let query = db.hermanos.toCollection();
    
    if (options?.syncStatus) {
      query = query.filter(h => h._syncStatus === options.syncStatus);
    }
    
    if (options?.activo !== undefined) {
      query = query.filter(h => h.activo === options.activo);
    }
    
    if (options?.orderBy) {
      query = query.sortBy(options.orderBy);
    }
    
    return query.toArray();
  },

  async search(term: string): Promise<Hermano[]> {
    const normalized = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return db.hermanos
      .filter(h => {
        const fullName = `${h.nombre} ${h.apellidos}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return fullName.includes(normalized) || h.email?.toLowerCase().includes(normalized);
      })
      .toArray();
  },

  // Sincronización
  async markAsSynced(id: string): Promise<void> {
    await db.hermanos.update(id, { _syncStatus: 'synced' });
  },

  async markAsConflict(id: string): Promise<void> {
    await db.hermanos.update(id, { _syncStatus: 'conflict' });
  }
};
```

### FASE 2: Sistema de Sincronización Robusto (Semana 2)

#### 2.1 Network Monitor Mejorado

**Problema actual**: `navigator.onLine` es poco fiable.

**Solución**: Ping real + estado de conexión + tipo de red.

**Archivo**: `src/lib/sync/network-monitor.ts`

```typescript
export interface NetworkState {
  isOnline: boolean;
  isWifi: boolean;
  connectionType: 'wifi' | '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  rtt: number; // Round-trip time en ms
  downlink: number; // Mbps estimados
  lastChecked: number;
}

class NetworkMonitor {
  private state: NetworkState = {
    isOnline: true,
    isWifi: true,
    connectionType: 'unknown',
    rtt: 0,
    downlink: 0,
    lastChecked: 0
  };
  
  private listeners: Set<(state: NetworkState) => void> = new Set();
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.setupListeners();
    this.startMonitoring();
  }

  private setupListeners() {
    window.addEventListener('online', () => this.checkConnection());
    window.addEventListener('offline', () => this.updateState({ isOnline: false }));
    
    // @ts-ignore
    if (navigator.connection) {
      // @ts-ignore
      navigator.connection.addEventListener('change', () => this.checkConnection());
    }
  }

  private async checkConnection(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Ping a Supabase (HEAD request ligero)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeout);
      
      const rtt = Math.round(performance.now() - startTime);
      const connectionInfo = this.getConnectionInfo();
      
      this.updateState({
        isOnline: true,
        rtt,
        ...connectionInfo,
        lastChecked: Date.now()
      });
    } catch {
      this.updateState({
        isOnline: false,
        lastChecked: Date.now()
      });
    }
  }

  private getConnectionInfo() {
    // @ts-ignore
    const conn = navigator.connection;
    
    return {
      isWifi: conn?.type === 'wifi',
      connectionType: conn?.effectiveType || 'unknown',
      downlink: conn?.downlink || 0
    };
  }

  private updateState(newState: Partial<NetworkState>) {
    const previous = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // Notificar solo si hubo cambio significativo
    if (previous.isOnline !== this.state.isOnline || 
        previous.connectionType !== this.state.connectionType) {
      this.listeners.forEach(listener => listener(this.state));
    }
  }

  private startMonitoring() {
    // Verificar cada 30 segundos
    this.checkInterval = setInterval(() => this.checkConnection(), 30000);
    // Verificación inicial
    this.checkConnection();
  }

  subscribe(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    // Enviar estado inicial
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): NetworkState {
    return { ...this.state };
  }

  // Estrategia de timeout adaptativo
  getRecommendedTimeout(): number {
    if (!this.state.isOnline) return 0; // No intentar
    
    switch (this.state.connectionType) {
      case 'wifi': return 10000;
      case '4g': return 15000;
      case '3g': return 25000;
      case '2g':
      case 'slow-2g': return 45000;
      default: return 20000;
    }
  }
}

export const networkMonitor = new NetworkMonitor();
```

#### 2.2 Sync Manager (Orquestador)

**Archivo**: `src/lib/sync/sync-manager.ts`

```typescript
import { db, MutationQueueItem } from '@/lib/db/database';
import { networkMonitor } from './network-monitor';
import { createClient } from '@/lib/supabase';
import { conflictResolver } from './conflict-resolver';

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

export class SyncManager {
  private isProcessing = false;
  private abortController?: AbortController;
  private syncLog: string[] = [];

  async sync(options: SyncOptions = { strategy: 'server-wins', batchSize: 10 }): Promise<SyncResult> {
    if (this.isProcessing) {
      throw new Error('Sync already in progress');
    }

    const networkState = networkMonitor.getState();
    if (!networkState.isOnline) {
      return { success: false, processed: 0, failed: 0, conflicts: 0, errors: ['No connection'] };
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

      for (const mutation of pending) {
        if (this.abortController.signal.aborted) break;

        try {
          await this.processMutation(mutation, options.strategy);
          progress.success++;
          
          // Marcar como synced en tabla local
          await this.markAsSynced(mutation);
          
          // Eliminar de cola
          if (mutation.id) {
            await db.mutations.update(mutation.id, { status: 'processing' });
            await db.mutations.delete(mutation.id);
          }
        } catch (error) {
          progress.errors++;
          result.failed++;
          
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`${mutation.table} ${mutation.type}: ${errorMsg}`);
          
          // Manejar error según tipo
          await this.handleMutationError(mutation, error);
        }

        progress.processed++;
        options.onProgress?.(progress);
      }

      result.processed = progress.processed;
      result.conflicts = progress.conflicts;

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
    
    // Limpiar datos de relaciones antes de enviar
    const cleanData = this.sanitizeData(mutation.data);

    switch (mutation.type) {
      case 'insert':
        // Para papeletas, manejar números provisionales
        if (mutation.table === 'papeletas_cortejo' && cleanData.numero <= 0) {
          cleanData.numero = await this.assignRealNumber(cleanData.anio);
        }
        
        const { error: insertError } = await supabase
          .from(mutation.table)
          .insert(cleanData);
        
        if (insertError) throw insertError;
        break;

      case 'update':
        // Verificar conflictos antes de update
        const hasConflict = await this.checkConflict(mutation);
        
        if (hasConflict) {
          const resolution = await conflictResolver.resolve(
            mutation, 
            strategy
          );
          
          if (resolution === 'manual') {
            await this.queueForManualResolution(mutation);
            throw new Error('Conflict requires manual resolution');
          }
          
          if (resolution === 'use-server') {
            // No hacemos update, nos quedamos con servidor
            return;
          }
          // Si 'use-local', continuamos con el update
        }

        const { error: updateError } = await supabase
          .from(mutation.table)
          .update(cleanData)
          .eq('id', cleanData.id);
        
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from(mutation.table)
          .delete()
          .eq('id', cleanData.id);
        
        if (deleteError) throw deleteError;
        break;
    }
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
        recordId: mutation.data.id,
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

  private async syncMasterData(): Promise<void> {
    const supabase = createClient();
    const lastSync = await db.syncLog
      .where('operation')
      .equals('master_sync')
      .last();
    
    const lastSyncTime = lastSync?.timestamp || 0;

    // Sincronizar solo registros modificados desde último sync
    const { data: hermanos } = await supabase
      .from('hermanos')
      .select('*')
      .gt('updated_at', new Date(lastSyncTime).toISOString());

    if (hermanos) {
      await db.transaction('rw', db.hermanos, async () => {
        for (const h of hermanos) {
          const local = await db.hermanos.get(h.id);
          
          // Solo actualizar si local no tiene cambios pendientes
          if (!local || local._syncStatus === 'synced') {
            await db.hermanos.put({
              ...h,
              _syncStatus: 'synced',
              _lastModified: Date.now()
            });
          }
        }
      });
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }

  getStatus(): { isProcessing: boolean; queueSize: number } {
    return {
      isProcessing: this.isProcessing,
      queueSize: 0 // Se actualizaría con query real
    };
  }

  // ... métodos auxiliares
}

export const syncManager = new SyncManager();
```

### FASE 3: Integración con React Query (Semana 3)

#### 3.1 Hook de Mutations Offline

**Archivo**: `src/hooks/use-mutation-offline.ts`

```typescript
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { db } from '@/lib/db/database';
import { syncManager } from '@/lib/sync/sync-manager';
import { networkMonitor } from '@/lib/sync/network-monitor';

interface OfflineMutationOptions<TData, TError, TVariables> extends 
  UseMutationOptions<TData, TError, TVariables> {
  table: 'hermanos' | 'pagos' | 'papeletas_cortejo';
  invalidateQueries?: string[];
}

export function useOfflineMutation<TData = unknown, TError = unknown, TVariables = unknown>(
  options: OfflineMutationOptions<TData, TError, TVariables>
) {
  const { table, invalidateQueries = [], ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    
    mutationFn: async (variables: TVariables) => {
      const network = networkMonitor.getState();
      
      // Estrategia adaptativa según conexión
      if (network.isOnline && network.rtt < 2000) {
        // Online rápido: intentar operación real
        try {
          return await mutationOptions.mutationFn!(variables);
        } catch (error) {
          // Si falla por red, caer a modo offline
          if (isNetworkError(error)) {
            return await saveOffline(table, variables);
          }
          throw error;
        }
      } else {
        // Offline o lento: guardar localmente
        return await saveOffline(table, variables);
      }
    },

    onSuccess: (data, variables, context) => {
      // Invalidar queries afectadas
      invalidateQueries.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      
      mutationOptions.onSuccess?.(data, variables, context);
    },

    onError: (error, variables, context) => {
      // Si es error offline, no mostrar error al usuario
      if (isOfflineError(error)) {
        showToast('Guardado localmente. Se sincronizará cuando haya conexión.');
        return;
      }
      
      mutationOptions.onError?.(error, variables, context);
    }
  });
}

async function saveOffline(table: string, data: unknown) {
  const id = crypto.randomUUID();
  
  await db.transaction('rw', 
    [db[table], db.mutations], 
    async () => {
      // Guardar en tabla local
      await db[table].add({
        ...data,
        id,
        _syncStatus: 'pending',
        _lastModified: Date.now()
      });
      
      // Añadir a cola
      await db.mutations.add({
        type: 'insert',
        table,
        data: { ...data, id },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });
    }
  );
  
  return { id, offline: true };
}
```

### FASE 4: UI y Estado Global (Semana 4)

#### 4.1 Store Zustand para Offline

**Archivo**: `src/stores/offline-store.ts`

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '@/lib/db/database';

interface OfflineState {
  // Estado de sincronización
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
  syncProgress: {
    total: number;
    processed: number;
  } | null;
  
  // Estado de red
  isOnline: boolean;
  connectionType: string;
  
  // Conflictos
  conflicts: Array<{
    id: string;
    table: string;
    localData: unknown;
    serverData: unknown;
  }>;
  
  // Acciones
  setSyncing: (syncing: boolean) => void;
  updatePendingCount: () => Promise<void>;
  resolveConflict: (id: string, useLocal: boolean) => Promise<void>;
}

export const useOfflineStore = create<OfflineState>()(
  subscribeWithSelector((set, get) => ({
    isSyncing: false,
    pendingCount: 0,
    lastSync: null,
    syncProgress: null,
    isOnline: true,
    connectionType: 'unknown',
    conflicts: [],

    setSyncing: (syncing) => set({ isSyncing: syncing }),
    
    updatePendingCount: async () => {
      const count = await db.mutations
        .where('status')
        .equals('pending')
        .count();
      set({ pendingCount: count });
    },
    
    resolveConflict: async (id, useLocal) => {
      // Lógica de resolución manual
    }
  }))
);

// Suscribirse a cambios en IndexedDB para mantener UI actualizada
db.mutations.hook('creating', () => {
  useOfflineStore.getState().updatePendingCount();
});

db.mutations.hook('deleting', () => {
  useOfflineStore.getState().updatePendingCount();
});
```

---

## 🎨 FLUJO DE DATOS COMPLETO

### Escenario: Vender Papeleta en Móvil con 3G

```
1. USUARIO: Clic en "Vender Papeleta"
   ↓
2. COMPONENTE: VenderPapeletaDialog
   ↓
3. HOOK: useOfflineMutation
   - Detecta conexión: 3G lento (rtt > 2000ms)
   - Decide: MODO OFFLINE
   ↓
4. REPOSITORIO: papeletasRepo.create()
   - Genera UUID local
   - Guarda en db.papeletas (Dexie)
   - Marca _syncStatus: 'pending'
   - Añade a db.mutations
   ↓
5. OPTIMISTIC UPDATE
   - UI muestra papeleta inmediatamente
   - Banner amarillo: "1 cambio pendiente"
   - Toast: "Guardado localmente"
   ↓
6. EN SEGUNDO PLANO
   NetworkMonitor detecta mejora de conexión
   ↓
7. SYNC MANAGER
   - Inicia sincronización automática
   - Procesa cola de mutations
   - Para papeleta con número provisional:
     a. Asigna número real desde servidor
     b. Inserta en Supabase
     c. Actualiza concepto del pago vinculado
   ↓
8. POST-SYNC
   - Invalida queries de React Query
   - UI actualiza automáticamente
   - Marca _syncStatus: 'synced'
   - Banner verde: "Sincronizado"
   ↓
9. USUARIO VE
   - Misma papeleta, ahora con número real
   - Sin duplicados
   - Sin necesidad de refresh manual
```

---

## ⚠️ CONSIDERACIONES CRÍTICAS

### 1. Manejo de Relaciones Complejas
**Problema**: Una papeleta requiere:
- Pago en tesorería
- Hermano existente
- Posible recalibración de números

**Solución**: Transacciones atómicas en Dexie
```typescript
await db.transaction('rw', 
  [db.papeletas, db.pagos, db.mutations], 
  async () => {
    // Todas las operaciones o ninguna
  }
);
```

### 2. Rendimiento en Móviles
**Límite**: IndexedDB es lento en Safari iOS (< 50MB, operaciones secuenciales)

**Optimizaciones**:
- Batching: Procesar máximo 10 mutations por ciclo
- Indexación estratégica: Solo índices necesarios
- Lazy loading: No cargar toda la base al inicio
- Compresión: Guardar datos comprimidos si > 1000 registros

### 3. Conflict Resolution Estrategias

**Casos complejos**:
- Usuario A: Cambia nombre de hermano offline
- Usuario B: Cambia email del mismo hermano online
- ¿Cuál gana?

**Estrategias disponibles**:
1. **Last Write Wins**: Más simple, puede perder datos
2. **Field-level Merge**: Detecta campos cambiados y fusiona
3. **Manual Resolution**: UI para que usuario decida
4. **Server Authority**: Siempre gana servidor (menos conflictos)

### 4. Testing de Escenarios Edge

Casos que DEBEN funcionar:
- [ ] App cerrada y reabierta en offline
- [ ] Móvil en modo avión por 1 hora, luego sincronizar
- [ ] Múltiples usuarios editando mismo registro
- [ ] Sync interrumpido (batería, cierre forzado)
- [ ] Base de datos > 50MB (límite Safari)
- [ ] Migración de schema (v1 → v2)

---

## 📊 MÉTRICAS DE ÉXITO

Después de implementar, deberías ver:

| Métrica | Objetivo | Cómo medir |
|---------|----------|------------|
| **Sync Success Rate** | > 95% | `success / total attempts` |
| **Avg Sync Time** | < 5s en WiFi | Performance API |
| **Conflict Rate** | < 2% | `conflicts / total syncs` |
| **App Load Time (offline)** | < 3s | Lighthouse |
| **Storage Usage** | < 30MB | `navigator.storage.estimate()` |
| **User Actions Offline** | 100% disponibles | Testing manual |

---

## 🚀 PLAN DE ROLLOUT

### Fase 1 (Beta cerrada - 1 semana)
- Deploy a rama staging
- Probar con 3-5 usuarios clave
- Recolectar logs de errores

### Fase 2 (Feature flags - 2 semanas)
- Habilitar solo para 20% de usuarios
- Monitorear métricas
- Rollback inmediato si errores > 5%

### Fase 3 (Full release)
- Habilitar para todos
- Documentación de usuario
- Soporte para resolución de conflictos

---

## ❓ DECISIONES PENDIENTES

Antes de empezar, necesito que decidas:

1. **Estrategia de conflictos por defecto**: ¿`server-wins` o `manual`?

2. **Auto-sync**: ¿Sincronizar automáticamente al volver online, o requerir clic del usuario?

3. **Límite de retries**: ¿Cuántas veces reintentar una mutation fallida antes de enviar a "dead letter queue"? (sugiero: 3)

4. **Offline para datos maestros**: ¿Permitir editar hermanos offline, o solo crear nuevos registros?

5. **Tamaño máximo de storage**: ¿Alertar al usuario cuando IndexedDB > 25MB?

---

**¿Procedemos con esta arquitectura?** El plan es completo pero profesional. Implementado correctamente, tendrás un sistema offline robusto comparable a apps nativas como Notion o Figma.
