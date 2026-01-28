'use client';

import { useAppStore } from '@/store/use-app-store';
import { X, Home, Users, Wallet, Share2, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { LogOut } from 'lucide-react';

export function Sidebar() {
    const { isSidebarOpen, toggleSidebar } = useAppStore();
    const { role, signOut, user } = useAuth();
    const pathname = usePathname();

    const menuItems = [
        { name: 'Inicio', icon: Home, href: '/' },
        { name: 'Hermanos', icon: Users, href: '/hermanos' },
        { name: 'Tesorería', icon: Wallet, href: '/tesoreria' },
        { name: 'Avisos', icon: Share2, href: '/avisos' },
        { name: 'Configuración', icon: Settings, href: '/config' },
    ];

    return (
        <>
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-[60] w-64 bg-white border-r-2 border-slate-200 transform transition-transform duration-300 ease-in-out shadow-2xl',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    <div className="p-6 flex justify-between items-center border-b">
                        <h2 className="text-xl font-bold text-primary">Hermandad</h2>
                        <button onClick={toggleSidebar} className="p-2">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <nav className="flex-1 p-4 space-y-3">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center space-x-3 p-3 rounded-xl transition-all border-2",
                                        isActive
                                            ? "bg-primary text-primary-foreground border-primary shadow-md font-bold scale-[1.02]"
                                            : "bg-white border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50"
                                    )}
                                    onClick={() => toggleSidebar()}
                                >
                                    <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-slate-500")} />
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t space-y-2">
                        <div className="px-3 py-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Usuario</p>
                            <p className="text-sm font-medium truncate">{user?.email}</p>
                            <p className="text-[10px] text-primary bg-[hsl(var(--accent-pastel))] px-2 py-0.5 rounded-full inline-block mt-1 font-bold">
                                {role}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                toggleSidebar();
                                signOut();
                            }}
                            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Cerrar Sesión</span>
                        </button>
                        <div className="px-3 py-1 text-center">
                            <span className="text-[10px] text-muted-foreground font-medium opacity-50">v1.0.49</span>
                        </div>
                    </div>
                </div>
            </aside>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}
        </>
    );
}
