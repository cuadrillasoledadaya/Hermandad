'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { useAuth } from '@/components/providers/auth-provider';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { session, loading } = useAuth();

    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    // Optionally hide navigation while loading session to avoid flicker
    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
    }

    return (
        <>
            <Sidebar />
            <Header title="HERMANDAD SAN BENITO" />
            {children}
            <BottomNav />
        </>
    );
}
