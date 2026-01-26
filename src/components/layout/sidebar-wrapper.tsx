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

    // Only show central loader if we are on a protected page and still loading
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted/10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground animate-pulse">Sincronizando acceso...</p>
            </div>
        );
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
