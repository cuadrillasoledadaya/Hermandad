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
    if (typeof window !== 'undefined') {
      this.setupListeners();
      this.startMonitoring();
    }
  }

  private setupListeners() {
    window.addEventListener('online', () => this.checkConnection());
    window.addEventListener('offline', () => this.updateState({ isOnline: false }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav.connection) {
      nav.connection.addEventListener('change', () => this.checkConnection());
    }
  }

  private async checkConnection(): Promise<void> {
    if (typeof window === 'undefined') return;

    const startTime = performance.now();

    try {
      if (!navigator.onLine) {
        this.updateState({ isOnline: false, lastChecked: Date.now() });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const supabaseUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : null;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'apikey': (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : null) || ''
        }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection;

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
      console.log(`[Network] State changed:`, this.state);
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

  // Determinar si debemos intentar operación online
  shouldTryOnline(): boolean {
    return this.state.isOnline && this.state.rtt < 5000;
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Singleton
export const networkMonitor = new NetworkMonitor();

// Hook para React (se creará después)
export function getNetworkStatus(): NetworkState {
  return networkMonitor.getState();
}
