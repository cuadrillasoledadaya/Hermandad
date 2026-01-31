'use client';

import { useAppStore } from '@/store/use-app-store';
import { X, Home, Users, Wallet, Share2, Settings, Calendar, Receipt, Church, LogOut, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';

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

    const adminItems = [
        { name: 'Temporadas', icon: Calendar, href: '/configuracion/temporadas' },
        { name: 'Gastos', icon: Receipt, href: '/tesoreria/gastos' },
        { name: 'Papeletas', icon: Receipt, href: '/tesoreria/papeletas-cortejo' },
        { name: 'Cortejo', icon: Church, href: '/cortejo' },
        { name: 'Config. Cortejo', icon: Shield, href: '/cortejo/admin' },
    ];

    const canSeeAdmin = role === 'SUPERADMIN' || role === 'JUNTA';

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
                    <nav className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
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

                        {canSeeAdmin && (
                            <>
                                <div className="pt-4 pb-2 px-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administración</p>
                                </div>
                                {adminItems.map((item) => {
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
                            </>
                        )}
                    </nav>

                    <div className="mt-auto p-4 border-t bg-slate-50/50">
                        <div className="px-3 py-3 bg-white border border-slate-200 rounded-xl shadow-sm mb-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sesión Activa</p>
                            <p className="text-sm font-bold text-slate-900 truncate">{user?.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                                    {role}
                                </span>
                                <p className="text-xs text-slate-400">v1.1.07</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                toggleSidebar();
                                signOut();
                            }}
                            className="w-full flex items-center justify-center space-x-3 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all font-bold group"
                        >
                            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>Finalizar Sesión</span>
                        </button>
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
