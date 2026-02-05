'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function OfflineTestPanel() {
  const [isClient, setIsClient] = useState(false);
  const [status, setStatus] = useState('Inicializando...');
  const [db, setDb] = useState<any>(null);
  const [stats, setStats] = useState({ hermanos: 0, papeletas: 0, pagos: 0, pending: 0 });
  const [networkStatus, setNetworkStatus] = useState({ isOnline: true });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const updateStats = useCallback(async () => {
    if (!db) return;
    try {
      const [hermanos, papeletas, pagos, pending] = await Promise.all([
        db.hermanos.count(),
        db.papeletas.count(),
        db.pagos.count(),
        db.mutations.where('status').equals('pending').count()
      ]);
      setStats({ hermanos, papeletas, pagos, pending });
    } catch (err) {
      console.error('Error stats:', err);
    }
  }, [db]);

  useEffect(() => {
    if (!isClient) return;
    
    let mounted = true;
    
    const init = async () => {
      try {
        setStatus('Cargando DB...');
        const dbModule = await import('@/lib/db/database');
        
        if (!mounted) return;
        setDb(dbModule.db);
        setStatus('DB lista');
        
        // Cargar network monitor
        const networkModule = await import('@/lib/sync/network-monitor');
        if (mounted) {
          setNetworkStatus(networkModule.networkMonitor.getState());
        }
      } catch (err) {
        if (mounted) {
          setStatus('Error: ' + (err as Error).message);
        }
      }
    };
    
    init();
    
    return () => { mounted = false; };
  }, [isClient]);

  // Actualizar stats cuando db cambia
  useEffect(() => {
    if (!db) return;
    
    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => clearInterval(interval);
  }, [db, updateStats]);

  const createHermano = async () => {
    if (!db) return;
    
    try {
      const timestamp = Date.now();
      await db.hermanos.add({
        id: crypto.randomUUID(),
        numero_hermano: -timestamp,
        nombre: `Test${timestamp.toString().slice(-4)}`,
        apellidos: 'Offline',
        email: `test${timestamp}@offline.com`,
        telefono: '123456789',
        direccion: 'Test dirección',
        fecha_alta: new Date().toISOString(),
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _syncStatus: 'pending',
        _lastModified: Date.now(),
        _version: 1
      });
      
      // Añadir a cola de mutaciones
      await db.mutations.add({
        type: 'insert',
        table: 'hermanos',
        data: { /* datos */ },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        priority: 1
      });
      
      toast.success('✅ Hermano creado localmente');
      updateStats();
    } catch (err) {
      toast.error('Error: ' + (err as Error).message);
    }
  };

  const syncNow = async () => {
    if (!networkStatus.isOnline) {
      toast.error('Sin conexión a internet');
      return;
    }
    
    try {
      setStatus('Sincronizando...');
      const { syncManager } = await import('@/lib/sync/sync-manager');
      
      const result = await syncManager.sync({
        strategy: 'server-wins',
        batchSize: 5
      });
      
      if (result.success) {
        toast.success(`✅ Sync: ${result.processed - result.failed}/${result.processed}`);
      } else {
        toast.error(`❌ Errores: ${result.errors.length}`);
      }
      
      updateStats();
      setStatus('Listo');
    } catch (err: any) {
      toast.error('Error sync: ' + err.message);
      setStatus('Error en sync');
    }
  };

  if (!isClient) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">🧪 Test Offline (Dexie)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estado</span>
            <Badge variant={networkStatus.isOnline ? "default" : "destructive"}>
              {networkStatus.isOnline ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">{status}</p>
          <p className="text-sm text-gray-500">
            DB: {db ? '✅ Conectada' : '❌ No disponible'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📊 Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded text-center">
              <p className="text-2xl font-bold">{stats.hermanos}</p>
              <p className="text-xs">Hermanos</p>
            </div>
            <div className="bg-muted p-3 rounded text-center">
              <p className="text-2xl font-bold">{stats.papeletas}</p>
              <p className="text-xs">Papeletas</p>
            </div>
            <div className="bg-muted p-3 rounded text-center">
              <p className="text-2xl font-bold">{stats.pagos}</p>
              <p className="text-xs">Pagos</p>
            </div>
            <div className={`p-3 rounded text-center ${stats.pending > 0 ? 'bg-yellow-100' : 'bg-green-100'}`}>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs">Pendientes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🎮 Acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button 
              onClick={createHermano} 
              disabled={!db}
              className="flex-1"
            >
              ➕ Crear Hermano
            </Button>
            
            <Button 
              onClick={syncNow}
              disabled={!db || !networkStatus.isOnline}
              variant="default"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              ☁️ Sincronizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-sm">📋 Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>1. Haz clic en &quot;Crear Hermano&quot; (se guarda local)</p>
          <p>2. Observa el contador &quot;Pendientes&quot; aumentar</p>
          <p>3. Haz clic en &quot;Sincronizar&quot; para enviar a Supabase</p>
          <p>4. Verifica en Supabase que apareció el dato</p>
        </CardContent>
      </Card>
    </div>
  );
}
