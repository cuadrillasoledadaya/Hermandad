'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { useAuth } from '@/components/providers/auth-provider';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { loading } = useAuth();

    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted/10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground animate-pulse">Sincronizando acceso...</p>
            </div>
        );
    }

    const getHeaderData = (path: string) => {
        if (path === '/hermanos/nuevo') return { title: 'NUEVO HERMANO', back: '/hermanos' };
        if (path.startsWith('/hermanos/')) return { title: 'PERFIL DEL HERMANO', back: '/hermanos' };
        if (path === '/hermanos') return { title: 'CENSO DE HERMANOS' };
        if (path.startsWith('/tesoreria/pago')) return { title: 'REGISTRAR PAGO', back: '/tesoreria' };
        if (path === '/tesoreria') return { title: 'TESORERÍA' };
        if (path === '/avisos') return { title: 'AVISOS' };
        if (path === '/config') return { title: 'CONFIGURACIÓN' };
        return { title: 'HERMANDAD DE LA SOLEDAD' };
    };

    const headerData = getHeaderData(pathname);

    return (
        <>
            <Sidebar />
            <Header title={headerData.title} backHref={headerData.back} />
            {children}
            <BottomNav />
        </>
    );
}
