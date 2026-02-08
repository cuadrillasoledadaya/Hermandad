// Funciones con soporte offline - wrappers de las originales
import { getHermanos as getHermanosOriginal, getPagosByHermano as getPagosByHermanoOriginal, getPagosDelAnio as getPagosDelAnioOriginal } from '@/lib/brothers';
import { db } from '@/lib/db/database';
import { networkMonitor } from '@/lib/sync/network-monitor';

// Helper para timeout en promesas
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]).catch(() => fallback);
}

export async function getHermanosOffline() {
  // Siempre intentar leer de local PRIMERO (rápido)
  const localData = await db.hermanos.toArray();
  console.log('[getHermanosOffline] Datos locales:', localData.length);
  
  if (localData.length > 0) {
    // Retornar datos locales inmediatamente
    const cleaned = localData.map(h => {
      const { _syncStatus, _lastModified, _version, ...clean } = h as any;
      return clean;
    });
    
    // Intentar actualizar desde servidor en background (silencioso)
    const network = networkMonitor.getState();
    if (network.isOnline) {
      getHermanosOriginal().catch(() => {});
    }
    
    return cleaned;
  }
  
  // Sin datos locales, intentar servidor
  const network = networkMonitor.getState();
  if (network.isOnline) {
    try {
      const data = await withTimeout(getHermanosOriginal(), 5000, []);
      return data;
    } catch (err) {
      console.log('[getHermanosOffline] Error servidor, sin datos locales');
      return [];
    }
  }
  
  return [];
}

export async function getHermanoByIdOffline(id: string) {
  // SIEMPRE leer de local primero
  console.log('[getHermanoByIdOffline] Buscando hermano:', id);
  
  const localData = await db.hermanos.get(id);
  if (localData) {
    console.log('[getHermanoByIdOffline] Encontrado en IndexedDB');
    const { _syncStatus, _lastModified, _version, ...clean } = localData as any;
    return clean;
  }
  
  // No está en local, intentar servidor si hay conexión
  const network = networkMonitor.getState();
  if (network.isOnline) {
    try {
      const { getHermanoById } = await import('@/lib/brothers');
      const data = await withTimeout(getHermanoById(id), 3000, null);
      return data;
    } catch (err) {
      console.log('[getHermanoByIdOffline] No encontrado');
      return null;
    }
  }
  
  console.log('[getHermanoByIdOffline] No encontrado y sin conexión');
  return null;
}

export async function getPagosOffline(idHermano?: string, anio?: number) {
  // Leer de local primero
  let query = db.pagos.toCollection();
  
  if (idHermano) {
    query = db.pagos.where('id_hermano').equals(idHermano);
  }
  
  let results = await query.toArray();
  
  if (anio) {
    results = results.filter(p => p.anio === anio);
  }
  
  console.log('[getPagosOffline] Pagos locales:', results.length);
  
  // Intentar actualizar desde servidor en background
  const network = networkMonitor.getState();
  if (network.isOnline && idHermano) {
    getPagosByHermanoOriginal(idHermano, anio).catch(() => {});
  }
  
  return results.map(p => {
    const { _syncStatus, _lastModified, ...clean } = p as any;
    return clean;
  }).sort((a, b) => 
    new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
  );
}

// Hook para precargar datos al iniciar
export async function preloadOfflineData() {
  console.log('[preloadOfflineData] Iniciando...');
  
  const network = networkMonitor.getState();
  
  if (!network.isOnline) {
    console.log('[preloadOfflineData] Sin conexión - usando datos existentes');
    return;
  }
  
  // Precargar todo en paralelo
  await Promise.allSettled([
    // Hermanos
    getHermanosOriginal().then(data => {
      console.log('[preloadOfflineData] Hermanos cargados:', data?.length || 0);
    }).catch(err => console.log('[preloadOfflineData] Error hermanos:', err)),
    
    // Pagos del año
    getPagosDelAnioOriginal(new Date().getFullYear()).then(data => {
      console.log('[preloadOfflineData] Pagos cargados:', data?.length || 0);
    }).catch(err => console.log('[preloadOfflineData] Error pagos:', err)),
    
    // Papeletas
    import('@/lib/papeletas-cortejo').then(({ getPapeletasDelAnio }) => 
      getPapeletasDelAnio(new Date().getFullYear())
    ).then(data => {
      console.log('[preloadOfflineData] Papeletas cargadas:', data?.length || 0);
    }).catch(err => console.log('[preloadOfflineData] Error papeletas:', err)),
    
    // Configuración
    import('@/lib/configuracion').then(({ getPreciosConfig }) => 
      getPreciosConfig()
    ).then(() => {
      console.log('[preloadOfflineData] Configuración cargada');
    }).catch(err => console.log('[preloadOfflineData] Error config:', err))
  ]);
  
  console.log('[preloadOfflineData] ✅ Completado');
}
