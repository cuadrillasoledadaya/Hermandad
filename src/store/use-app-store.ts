import { create } from 'zustand';

interface AppState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    // Más estado UI global aquí
}

export const useAppStore = create<AppState>()(
    (set) => ({
        isSidebarOpen: false,
        toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    })
);

// Nota: Eliminamos persist porque solo guardamos UI state (posición sidebar, tema)
// Los datos importantes van a React Query + IndexedDB
