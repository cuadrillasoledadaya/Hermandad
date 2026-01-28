'use client';

import Link from 'next/link';
import { Home, Users, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { name: 'Inicio', icon: Home, href: '/' },
        { name: 'Registro', icon: Users, href: '/hermanos' },
        { name: 'Tesorería', icon: Wallet, href: '/tesoreria' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-200 h-16 flex items-center justify-around px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            'flex flex-col items-center justify-center space-y-1 transition-all w-20 h-12 rounded-xl',
                            isActive
                                ? 'text-primary bg-primary/5 font-bold border-b-2 border-primary'
                                : 'text-slate-500 hover:text-primary hover:bg-slate-50'
                        )}
                    >
                        <item.icon className={cn('w-6 h-6', isActive && 'scale-110')} />
                        <span className="text-[10px] uppercase tracking-wider font-semibold">{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
