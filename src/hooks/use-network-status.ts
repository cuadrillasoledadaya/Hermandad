'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
    isOnline: boolean;
    connectionType: string | null;
    effectiveType: string | null;
    downlink: number | null;
    rtt: number | null;
}

interface NetworkConnection {
    type?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    addEventListener?: (event: string, handler: () => void) => void;
    removeEventListener?: (event: string, handler: () => void) => void;
}

export function useNetworkStatus(): NetworkStatus {
    const getInitialStatus = (): NetworkStatus => {
        if (typeof navigator === 'undefined') {
            return {
                isOnline: true,
                connectionType: null,
                effectiveType: null,
                downlink: null,
                rtt: null,
            };
        }

        const connection = (navigator as unknown as { connection?: NetworkConnection }).connection;
        return {
            isOnline: navigator.onLine,
            connectionType: connection?.type || null,
            effectiveType: connection?.effectiveType || null,
            downlink: connection?.downlink || null,
            rtt: connection?.rtt || null,
        };
    };

    const [status, setStatus] = useState<NetworkStatus>(getInitialStatus);

    const updateConnectionStatus = useCallback(() => {
        if (typeof navigator === 'undefined') return;

        const connection = (navigator as unknown as { connection?: NetworkConnection }).connection;

        setStatus({
            isOnline: navigator.onLine,
            connectionType: connection?.type || null,
            effectiveType: connection?.effectiveType || null,
            downlink: connection?.downlink || null,
            rtt: connection?.rtt || null,
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Eventos de conexión
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);

        // API de conexión (para saber tipo: 4g, 3g, etc.)
        const connection = (navigator as unknown as { connection?: NetworkConnection }).connection;
        if (connection && connection.addEventListener) {
            connection.addEventListener('change', updateConnectionStatus);
        }

        return () => {
            window.removeEventListener('online', updateConnectionStatus);
            window.removeEventListener('offline', updateConnectionStatus);
            if (connection && connection.removeEventListener) {
                connection.removeEventListener('change', updateConnectionStatus);
            }
        };
    }, [updateConnectionStatus]);

    return status;
}

// Hook simple solo para saber si estamos online
export function useIsOnline(): boolean {
    const { isOnline } = useNetworkStatus();
    return isOnline;
}
