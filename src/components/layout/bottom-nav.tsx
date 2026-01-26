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
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t h-16 flex items-center justify-around px-4">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        'flex flex-col items-center space-y-1 transition-colors',
                        pathname === item.href ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                    )}
                >
                    <item.icon className="w-6 h-6" />
                    <span className="text-xs">{item.name}</span>
                </Link>
            ))}
        </nav>
    );
}
