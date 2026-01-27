'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type UserRole = 'SUPERADMIN' | 'JUNTA' | 'HERMANO';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    role: UserRole | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('Initial session:', session?.user?.email);
            setSession(session);
            if (session) fetchRole(session.user.id);
            else setLoading(false);
        }).catch(err => {
            console.error('Session error:', err);
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state change:', event, session?.user?.email);
            setSession(session);
            if (session) fetchRole(session.user.id);
            else {
                setRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchRole(userId: string) {
        console.log('Fetching role for:', userId);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .maybeSingle(); // Changed from single() to maybeSingle() to avoid 406/404 errors hanging

            if (error) {
                console.warn('Profile fetch error (defaulting to HERMANO):', error.message);
                setRole('HERMANO');
            } else if (data) {
                console.log('Role found:', data.role);
                setRole(data.role as UserRole);
            } else {
                console.log('No profile found, defaulting to HERMANO');
                setRole('HERMANO');
            }
        } catch (error) {
            console.error('Unexpected error fetching user role:', error);
            setRole('HERMANO');
        } finally {
            setLoading(false);
        }
    }

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            setSession(null);
            setRole(null);
            toast.success('Sesión cerrada correctamente');
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
            toast.error('Error al cerrar sesión');
        }
    };

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
