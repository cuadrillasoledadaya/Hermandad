import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface OfflineState {
  // Estado de sincronización
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
  syncError: string | null;
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
    recordId: string;
    message: string;
  }>;
  
  // Acciones
  setSyncing: (syncing: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSync: (date: Date) => void;
  setSyncError: (error: string | null) => void;
  setSyncProgress: (progress: { total: number; processed: number } | null) => void;
  setNetworkStatus: (status: { isOnline: boolean; connectionType: string }) => void;
  addConflict: (conflict: { id: string; table: string; recordId: string; message: string }) => void;
  removeConflict: (id: string) => void;
  clearConflicts: () => void;
}

export const useOfflineStore = create<OfflineState>()(
  subscribeWithSelector((set) => ({
    isSyncing: false,
    pendingCount: 0,
    lastSync: null,
    syncError: null,
    syncProgress: null,
    isOnline: true,
    connectionType: 'unknown',
    conflicts: [],

    setSyncing: (syncing) => set({ isSyncing: syncing }),
    setPendingCount: (count) => set({ pendingCount: count }),
    setLastSync: (date) => set({ lastSync: date }),
    setSyncError: (error) => set({ syncError: error }),
    setSyncProgress: (progress) => set({ syncProgress: progress }),
    setNetworkStatus: (status) => set({ 
      isOnline: status.isOnline, 
      connectionType: status.connectionType 
    }),
    addConflict: (conflict) => set((state) => ({
      conflicts: [...state.conflicts, conflict]
    })),
    removeConflict: (id) => set((state) => ({
      conflicts: state.conflicts.filter(c => c.id !== id)
    })),
    clearConflicts: () => set({ conflicts: [] })
  }))
);
