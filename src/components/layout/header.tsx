import { Menu, ChevronLeft, LogOut } from 'lucide-react';
import { useAppStore } from '@/store/use-app-store';
import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';

interface HeaderProps {
    title: string;
    backHref?: string;
}

export function Header({ title, backHref }: HeaderProps) {
    const { toggleSidebar } = useAppStore();
    const { signOut } = useAuth();

    return (
        <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur border-b">
            <div className="flex h-16 items-center px-4 relative">
                {backHref ? (
                    <Link
                        href={backHref}
                        className="p-2 hover:bg-muted rounded-lg absolute left-4"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                ) : (
                    <button
                        onClick={toggleSidebar}
                        className="p-2 hover:bg-muted rounded-lg absolute left-4"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                )}
                <h1 className="flex-1 text-center text-lg font-semibold tracking-tight uppercase">
                    {title}
                </h1>
                {!backHref && (
                    <button
                        onClick={() => {
                            if (confirm('¿Cerrar sesión?')) {
                                signOut();
                            }
                        }}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg absolute right-4"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                )}
            </div>
        </header>
    );
}
