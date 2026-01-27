'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 1000 * 60 * 5, // 5 minutes
                        gcTime: 1000 * 60 * 60 * 24, // 24 hours
                        refetchOnWindowFocus: false,
                        retry: (failureCount, error: unknown) => {
                            const status = (error as { status?: number })?.status;
                            if (status === 404) return false;
                            if (failureCount < 3) return true;
                            return false;
                        },
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
