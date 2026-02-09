'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
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

    useEffect(() => {
        console.log('>>> [AUTH] AuthProvider Mounted');

        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('>>> [AUTH] Initial session check:', session?.user?.email || 'No session');
            setSession(session);
            if (session) {
                fetchRole(session.user.id);
            } else {
                console.log('>>> [AUTH] No session found, setting loading to false');
                setLoading(false);
            }
        }).catch(err => {
            console.error('>>> [AUTH] Session error:', err);
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('>>> [AUTH] Auth state change event:', event, 'User:', session?.user?.email || 'None');
            setSession(session);
            if (session) {
                fetchRole(session.user.id);
            } else {
                setRole(null);
                setLoading(false);
            }
        });

        // Fail-safe: si después de 15 segundos sigue cargando, liberar
        const timer = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn('>>> [AUTH] Auth loading timeout reached (15s), forcing loading = false');
                    return false;
                }
                return prev;
            });
        }, 15000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    async function fetchRole(userId: string) {
        console.log('>>> [AUTH] Fetching role for:', userId);

        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

        try {
            // 1. INTENTO LOCAL INMEDIATO (Para rapidez y offline)
            const { getSyncMetadata, setSyncMetadata } = await import('@/lib/db');
            const cachedRole = await getSyncMetadata('user_role') as UserRole;

            if (cachedRole) {
                console.log('>>> [AUTH] Cached role found:', cachedRole);
                setRole(cachedRole);
                // Si estamos offline, ya podemos dejar de cargar
                if (!isOnline) {
                    setLoading(false);
                }
            }

            // 2. INTENTO ONLINE (Para actualizar o si no hay cache)
            if (isOnline) {
                const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
                const onlinePromise = supabase
                    .from('profiles')
                    .select('role, nombre, apellidos')
                    .eq('id', userId)
                    .maybeSingle();

                const response = await Promise.race([onlinePromise, timeoutPromise]);

                if (response && !response.error && response.data) {
                    const data = response.data;
                    console.log('>>> [AUTH] Role found online:', data.role);
                    const userRole = data.role as UserRole;
                    setRole(userRole);

                    // Guardar para la próxima vez
                    await setSyncMetadata('user_role', userRole);
                    await setSyncMetadata('user_profile', data);
                } else if (!cachedRole) {
                    // Si no había cache y falló online, default a HERMANO
                    console.warn('>>> [AUTH] No online role and no cache, defaulting to HERMANO');
                    setRole('HERMANO');
                }
            } else if (!cachedRole) {
                // Offline y sin cache
                console.warn('>>> [AUTH] Offline and no cache, defaulting to HERMANO');
                setRole('HERMANO');
            }

        } catch (err: any) {
            console.error('>>> [AUTH] Role fetch exception:', err?.message || err);
            if (!role) setRole('HERMANO');
        } finally {
            setLoading(false);
        }
    }

    const signOut = async () => {
        try {
            console.log('>>> [AUTH] Initiating sign out...');
            await supabase.auth.signOut();
            setSession(null);
            setRole(null);
            toast.success('Sesión cerrada correctamente');
            window.location.href = '/login';
        } catch (error) {
            console.error('>>> [AUTH] Error signing out:', error);
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
