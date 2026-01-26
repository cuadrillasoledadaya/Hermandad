'use client';

import { Menu } from 'lucide-react';
import { useAppStore } from '@/store/use-app-store';

interface HeaderProps {
    title: string;
}

export function Header({ title }: HeaderProps) {
    const { toggleSidebar } = useAppStore();

    return (
        <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur border-b">
            <div className="flex h-16 items-center px-4 relative">
                <button
                    onClick={toggleSidebar}
                    className="p-2 hover:bg-muted rounded-lg absolute left-4"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-lg font-semibold tracking-tight">
                    {title}
                </h1>
            </div>
        </header>
    );
}
