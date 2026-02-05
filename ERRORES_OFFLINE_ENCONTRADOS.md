# 🔴 ERRORES ENCONTRADOS EN MODO OFFLINE - ANÁLISIS COMPLETO

**Fecha**: 03 Febrero 2026  
**Versión analizada**: 1.1.61  
**Estado**: Build exitoso, pero errores funcionales detectados

---

## 🚨 ERRORES CRÍTICOS (Bloqueantes)

### ERROR #1: Service Worker no responde a mensajes de sincronización

**Archivo**: `src/sw.ts` (línea 60)

**Problema**: El hook `use-offline-sync.ts` intenta enviar mensajes al Service Worker (`PROCESS_MUTATIONS`), pero el SW no está escuchando estos mensajes.

**Código actual (que NO funciona)**:

```typescript
// src/sw.ts - SOLO esto, no escucha mensajes
serwist.addEventListeners();
```

**Lo que pasa**:

1. El usuario pierde conexión
2. Se guardan mutations en cola IndexedDB
3. Vuelve la conexión
4. `use-offline-sync` intenta enviar mensaje al SW: `navigator.serviceWorker.controller?.postMessage({type: 'PROCESS_MUTATIONS'})`
5. El SW no escucha mensajes → No responde → No se procesan mutations

**Solución** - Añadir al final de `src/sw.ts`:

```typescript
// Escuchar mensajes desde la aplicación
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PROCESS_MUTATIONS') {
    // Notificar a todas las pestañas/ventanas que deben procesar mutations
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'PROCESS_MUTATIONS' });
      });
    });
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

**Prioridad**: 🔴 CRÍTICA - Sin esto, la sincronización offline NO FUNCIONA

---

### ERROR #2: Network detection no es confiable

**Archivo**: `src/hooks/use-network-status.ts` y `src/lib/offline-mutation.ts`

**Problema**: `navigator.onLine` solo verifica si hay conexión de red (WiFi/Ethernet), NO si hay acceso a Internet real.

**Escenario que falla**:

1. Usuario conectado a WiFi sin internet (router caído)
2. `navigator.onLine` devuelve `true`
3. El sistema intenta operación online
4. Timeout de 2 segundos (línea 24 de offline-mutation.ts)
5. Si la operación tarda más de 2 segundos (ej: recalibración de números), se cancela y se guarda en cola local
6. PERO si el timeout es muy corto, algunas operaciones pueden cancelarse prematuramente

**Solución** - Modificar `src/lib/offline-mutation.ts`:

```typescript
// Línea 22-25: Aumentar timeout o hacerlo configurable
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Network timeout')), 10000); // 10 segundos en lugar de 2
});
```

**Mejor solución** - Añadir "ping" real para verificar conectividad:

```typescript
// Añadir función al principio de offline-mutation.ts
async function isReallyOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  
  try {
    // Intentar fetch a Supabase health endpoint o similar
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/health`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
    });
    return true;
  } catch {
    return false;
  }
}

// Usar en lugar de navigator.onLine:
const online = await isReallyOnline();
if (!online) {
  await queueMutation(options);
  return { success: true, offline: true };
}
```

**Prioridad**: 🟡 MEDIA - Funciona en la mayoría de casos, pero falla con WiFi sin internet

---

### ERROR #3: React Query no se invalida tras sincronización

**Archivo**: `src/hooks/use-offline-sync.ts`

**Problema**: Cuando se sincronizan datos, el caché de React Query no se invalida automáticamente.

**Escenario**:

1. Usuario crea hermano offline
2. Se guarda en cola local + optimistic update en UI
3. Vuelve conexión, se sincroniza
4. React Query sigue mostrando datos viejos (con flag `_offline: true`)
5. El usuario ve datos inconsistentes hasta que hace refresh manual

**Solución** - Añadir en `use-offline-sync.ts` después de sincronizar:

```typescript
import { useQueryClient } from '@tanstack/react-query';

export function useOfflineSync() {
  const queryClient = useQueryClient(); // AÑADIR ESTO
  
  // En processMutations, después de éxito:
  if (successCount > 0) {
    // Invalidar queries para forzar refetch
    queryClient.invalidateQueries({ queryKey: ['hermanos'] });
    queryClient.invalidateQueries({ queryKey: ['pagos'] });
    queryClient.invalidateQueries({ queryKey: ['configuracion'] });
    
    showSuccess(`¡Sincronizado!`, `${successCount} cambios enviados`);
  }
}
```

**Prioridad**: 🟡 MEDIA - UX mejorable

---

## ⚠️ ERRORES MENORES (No bloqueantes pero problemáticos)

### ERROR #4: Datos sincronizados mantienen flag `_offline`

**Archivo**: `src/lib/db.ts` (líneas 148-175)

**Problema**: Cuando se hace optimistic update, se marca el dato con `_offline: true`, pero cuando se sincroniza exitosamente, no se quita ese flag.

**Solución** - Añadir función en `db.ts`:

```typescript
// Llamar después de sincronizar exitosamente
export async function markAsSynced(table: string, id: string) {
  const db = await initDB();
  const record = await db.get(table, id);
  if (record && record._offline) {
    delete record._offline;
    await db.put(table, record);
  }
}
```

Y usar en `use-offline-sync.ts`:

```typescript
// Después de éxito en mutation:
if (mutation.data?.id) {
  await markAsSynced(mutation.table, mutation.data.id);
}
```

**Prioridad**: 🔵 BAJA - Cosmetic issue

---

### ERROR #5: IndexedDB puede fallar en modo privado/incógnito

**Problema**: Algunos navegadores (Safari especialmente) tienen IndexedDB limitado o deshabilitado en modo privado.

**Solución** - Añadir try-catch y fallback:

```typescript
// En db.ts, envolver initDB
export async function initDB(): Promise<IDBPDatabase | null> {
  try {
    return await openDB(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db, oldVersion) {
        // ... código actual
      },
    });
  } catch (error) {
    console.warn('IndexedDB no disponible, usando modo degradado:', error);
    return null; // Modo degradado: solo online
  }
}

// En todas las funciones que usan initDB:
export async function queueMutation(mutation) {
  const db = await initDB();
  if (!db) {
    console.warn('No se puede guardar offline - IndexedDB no disponible');
    return;
  }
  // ... resto del código
}
```

**Prioridad**: 🔵 BAJA - Caso edge (modo privado)

---

### ERROR #6: Mutation queue puede crecer indefinidamente

**Archivo**: `src/lib/db.ts`

**Problema**: Si hay mutations que fallan repetidamente (más de 10 intentos), nunca se eliminan y ocupan espacio.

**Solución** - Añadir limpieza automática:

```typescript
// En queueMutation, antes de añadir:
export async function queueMutation(mutation) {
  const db = await initDB();
  
  // Limpiar mutations muy viejas (más de 30 días) o con muchos reintentos
  const allMutations = await db.getAll('mutation_queue');
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  for (const item of allMutations) {
    if (item.retryCount > 10 || (now - item.timestamp) > thirtyDays) {
      await db.delete('mutation_queue', item.id!);
    }
  }
  
  // ... resto del código
}
```

**Prioridad**: 🟡 MEDIA - Limpieza preventiva

---

### ERROR #7: Optimistic updates no manejan errores de validación

**Archivo**: `src/lib/db.ts` (líneas 148-175)

**Problema**: Cuando se hace optimistic insert, se genera un ID con `crypto.randomUUID()`, pero si el servidor genera un ID diferente al sincronizar, hay duplicados.

**Solución** - Marcar como provisional:

```typescript
// En optimistic insert:
const withId = {
  ...mutation.data,
  id: mutation.data.id || `local_${crypto.randomUUID()}`, // Prefijo local_
  _offline: true,
  _pending: true // Nuevo flag
};

// Al sincronizar, reemplazar el ID local por el del servidor:
// En use-offline-sync.ts:
if (result.data?.id && result.data.id !== mutation.data.id) {
  // Actualizar referencias en IndexedDB
  await updateIdInLocal(mutation.table, mutation.data.id, result.data.id);
}
```

**Prioridad**: 🟡 MEDIA - Puede causar duplicados

---

## 🛠️ SOLUCIONES INMEDIATAS (Copiar y pegar)

### Fix #1: Service Worker escucha mensajes

**Archivo**: `src/sw.ts` - REEMPLAZAR TODO:

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ url }) => url.pathname.includes('/rest/v1/'),
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        plugins: [
          {
            cachedResponseWillBeUsed: async ({ cachedResponse }) => {
              if (!navigator.onLine && cachedResponse) {
                return cachedResponse;
              }
              return cachedResponse;
            }
          }
        ]
      })
    },
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images-cache',
      })
    },
    {
      matcher: ({ url }) => url.origin === 'https://fonts.googleapis.com' ||
        url.origin === 'https://fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'fonts-cache',
      })
    }
  ],
});

serwist.addEventListeners();

// 🆕 ESCUCHAR MENSAJES DESDE LA APP
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PROCESS_MUTATIONS') {
    // Notificar a todas las pestañas que deben procesar mutations
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'PROCESS_MUTATIONS' });
      });
    });
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

---

### Fix #2: Aumentar timeout y mejorar detección

**Archivo**: `src/lib/offline-mutation.ts` - Líneas 22-25:

```typescript
// CAMBIAR DE 2000 (2 segundos) A 8000 (8 segundos)
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Network timeout')), 8000);
});
```

---

### Fix #3: Invalidar React Query tras sincronización

**Archivo**: `src/hooks/use-offline-sync.ts` - Añadir al principio:

```typescript
import { useQueryClient } from '@tanstack/react-query'; // AÑADIR ESTA IMPORTACIÓN

export function useOfflineSync() {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient(); // AÑADIR ESTA LÍNEA
  
  // ... resto del código
  
  // En processMutations, reemplazar el bloque de success:
  if (successCount > 0) {
    // 🆕 INVALIDAR QUERIES PARA FORZAR REFETCH
    queryClient.invalidateQueries({ queryKey: ['hermanos'] });
    queryClient.invalidateQueries({ queryKey: ['pagos'] });
    queryClient.invalidateQueries({ queryKey: ['papeletas'] });
    
    showSuccess(`¡Sincronizado!`, `${successCount} cambios enviados a la nube`);
  }
}
```

---

## 🧪 CÓMO PROBAR EL MODO OFFLINE

### Test #1: Simular offline en DevTools

1. Abre Chrome DevTools (F12)
2. Ve a la pestaña **Network**
3. Cambia "No throttling" a **"Offline"**
4. Intenta crear un hermano nuevo
5. Debería:
   - ✅ Mostrar "Sin conexión" en el banner inferior
   - ✅ Guardar localmente (datos persisten en IndexedDB)
   - ✅ Mostrar toast de "Guardado localmente"

### Test #2: Recuperar conexión

1. Vuelve a cambiar Network a "No throttling"
2. Espera 1-2 segundos
3. Debería:
   - ✅ El banner cambiar a "Sincronizando..."
   - ✅ Toast de "X cambios sincronizados"
   - ✅ Los datos aparecen en Supabase real

### Test #3: Verificar IndexedDB

1. En DevTools, ve a **Application** > **Storage** > **IndexedDB**
2. Deberías ver:
   - ✅ `hermandad_offline_db` con stores
   - ✅ Datos en `hermanos`, `pagos`, etc.
   - ✅ Mutations en `mutation_queue` (cuando estás offline)

---

## 📊 DIAGNÓSTICO RÁPIDO

Si el modo offline no funciona, verifica estos puntos:

### 1. ¿El Service Worker está activo?

- DevTools > Application > Service Workers
- Debe mostrar "#sw.js" con Status: "activated and is running"
- Si dice "waiting", haz clic en "skipWaiting"

### 2. ¿Hay errores en consola?

- DevTools > Console
- Busca errores rojos relacionados con:
  - `IndexedDB`
  - `mutation`
  - `queue`
  - `sync`

### 3. ¿IndexedDB tiene datos?

- DevTools > Application > IndexedDB > hermandad_offline_db
- Expande `mutation_queue` - debe haber items cuando estás offline

### 4. ¿El banner se muestra?

- Cuando pierdes conexión, debe aparecer banner amarillo abajo
- Si no aparece, el problema está en `useNetworkStatus`

---

## 🎯 RESUMEN DE PRIORIDADES

| Error | Prioridad | Esfuerzo | Impacto |
| :--- | :--- | :--- | :--- |
| **#1** SW no escucha mensajes | 🔴 CRÍTICA | 5 min | SINCRONIZACIÓN NO FUNCIONA |
| **#2** Timeout muy corto | 🟡 Media | 1 min | Operaciones canceladas prematuramente |
| **#3** React Query no invalida | 🟡 Media | 5 min | Datos inconsistentes en UI |
| **#4** Flag `_offline` permanente | 🔵 Baja | 10 min | Cosmetic issue |
| **#5** IndexedDB modo privado | 🔵 Baja | 15 min | Caso edge |
| **#6** Queue crece infinito | 🟡 Media | 10 min | Limpieza preventiva |
| **#7** IDs duplicados | 🟡 Media | 20 min | Posibles duplicados |

**RECOMENDACIÓN**: Aplicar Fix #1 (SW) y Fix #3 (React Query) INMEDIATAMENTE. Son los que realmente hacen que no funcione el offline.

---

## ✨ COMANDOS ÚTILES PARA DEBUG

```bash
# Ver logs del Service Worker
# DevTools > Application > Service Workers > "Inspect"

# Forzar update del SW
# En consola: navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'})

# Limpiar IndexedDB completamente
# DevTools > Application > Storage > Clear site data

# Ver estado de sincronización en tiempo real
# En consola del navegador:
const status = JSON.parse(localStorage.getItem('hermandad-sync-status') || '{}');
console.log(status);
```

---

**¿Necesitas que te ayude a implementar alguno de estos fixes específico?** El más crítico es el #1 (Service Worker), sin él todo el sistema offline está roto.
