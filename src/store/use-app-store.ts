import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    // More state will be added here (e.g., pending payments)
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
        }),
        {
            name: 'hermandad-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
