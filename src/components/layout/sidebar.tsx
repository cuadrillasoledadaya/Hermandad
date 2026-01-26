'use client';

import { useAppStore } from '@/store/use-app-store';
import { Menu, X, Home, Users, Wallet, Share2, Settings } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Sidebar() {
    const { isSidebarOpen, toggleSidebar } = useAppStore();

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
                    'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    <div className="p-6 flex justify-between items-center border-b">
                        <h2 className="text-xl font-bold text-primary">Hermandad</h2>
                        <button onClick={toggleSidebar} className="p-2 lg:hidden">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <nav className="flex-1 p-4 space-y-2">
                        {menuItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors"
                                onClick={() => toggleSidebar()}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </nav>
                </div>
            </aside>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}
        </>
    );
}
