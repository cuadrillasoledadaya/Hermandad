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
            // 1. INTENTO LOCAL INMEDIATO
            const { metadataRepo } = await import('@/lib/db/tables/metadata.table');
            const cachedRole = await metadataRepo.get('user_role') as UserRole;

            if (cachedRole) {
                console.log('>>> [AUTH] ✅ Cached role found, setting IMMEDIATELY:', cachedRole);
                setRole(cachedRole);
                setLoading(false); // ✅ Liberar INMEDIATAMENTE si hay caché
            }

            // 2. INTENTO ONLINE EN PARALELO (no bloquea si hay caché)
            if (isOnline) {
                // Timeout reducido de 5s a 2s
                const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
                const onlinePromise = supabase
                    .from('profiles')
                    .select('role, nombre, apellidos')
                    .eq('id', userId)
                    .maybeSingle();

                const response = await Promise.race([onlinePromise, timeoutPromise]);

                if (response && !response.error && response.data) {
                    const data = response.data;
                    console.log('>>> [AUTH] ✅ Role updated from online:', data.role);
                    const userRole = data.role as UserRole;

                    // Solo actualizar si cambió
                    if (userRole !== cachedRole) {
                        console.log('>>> [AUTH] Role changed online, updating...');
                        setRole(userRole);
                    }

                    // Guardar para la próxima vez
                    await metadataRepo.set('user_role', userRole);
                    await metadataRepo.set('user_profile', data);
                } else if (!cachedRole) {
                    // Si no había cache y falló online, default a HERMANO INMEDIATAMENTE
                    console.warn('>>> [AUTH] No online role and no cache, defaulting to HERMANO');
                    setRole('HERMANO');
                    setLoading(false);
                }
            } else if (!cachedRole) {
                // Offline y sin cache: establecer HERMANO INMEDIATAMENTE (sin esperar 15s)
                console.warn('>>> [AUTH] Offline and no cache, defaulting to HERMANO IMMEDIATELY');
                setRole('HERMANO');
                setLoading(false);
            }

        } catch (err: any) {
            console.error('>>> [AUTH] Role fetch exception:', err?.message || err);
            // Si hubo error y no tenemos rol aún, establecer default INMEDIATAMENTE
            if (!role) {
                console.warn('>>> [AUTH] Exception occurred, setting HERMANO immediately');
                setRole('HERMANO');
            }
        } finally {
            // Asegurar que siempre terminamos de cargar
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
