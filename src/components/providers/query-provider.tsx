'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { ReactNode, useEffect } from 'react';

// Crear el QueryClient fuera del componente para que se reutilice
const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5, // 5 minutos - datos se consideran frescos
                gcTime: 1000 * 60 * 60 * 24, // 24 horas - datos persisten en memoria
                refetchOnWindowFocus: false, // No recargar al volver a la pestaña
                refetchOnReconnect: true, // Sí recargar al recuperar conexión
                retry: (failureCount, error: unknown) => {
                    const status = (error as { status?: number })?.status;
                    // No reintentar errores 4xx (cliente), solo 5xx o errores de red
                    if (status && status >= 400 && status < 500) return false;
                    // Reintentar hasta 3 veces con backoff exponencial
                    if (failureCount < 3) return true;
                    return false;
                },
                retryDelay: (retryCount) => {
                    // Backoff exponencial: 1s, 2s, 4s
                    return Math.min(1000 * Math.pow(2, retryCount), 10000);
                },
            },
        },
    });

// Variable global para mantener el QueryClient entre hot reloads
let clientQueryClient: QueryClient | undefined = undefined;

const getQueryClient = () => {
    if (typeof window === 'undefined') {
        // Server: siempre crear nuevo
        return createQueryClient();
    }
    // Client: reutilizar si existe
    if (!clientQueryClient) {
        clientQueryClient = createQueryClient();
    }
    return clientQueryClient;
};

// Persister usando IndexedDB (idb-keyval)
const idbPersister = createAsyncStoragePersister({
    storage: {
        getItem: async (key) => {
            const value = await get(key);
            return value || null;
        },
        setItem: async (key, value) => {
            await set(key, value);
        },
        removeItem: async (key) => {
            await del(key);
        },
    },
    key: 'hermandad-react-query-cache',
    throttleTime: 1000, // Guardar máximo cada 1 segundo
});

export function QueryProvider({ children }: { children: ReactNode }) {
    const queryClient = getQueryClient();

    useEffect(() => {
        // Persistir el caché de React Query en IndexedDB
        persistQueryClient({
            queryClient,
            persister: idbPersister,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días de persistencia
            buster: 'v2', // Cambiar esto cuando quieras invalidar todo el caché
            dehydrateOptions: {
                shouldDehydrateQuery: (query) => {
                    // Solo persistir queries que no sean de autenticación o sensibles
                    const queryKey = query.queryKey;
                    if (queryKey[0] === 'auth' || queryKey[0] === 'session') {
                        return false;
                    }
                    // Solo persistir queries exitosas
                    return query.state.status === 'success';
                },
            },
        });
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
