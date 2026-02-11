'use client';

import { useEffect } from 'react';
import { initGlobalErrorLogging, setLogUserId } from '@/lib/logger';
import { useAuth } from './auth-provider';

export function LoggerInitializer() {
    const { user } = useAuth();

    useEffect(() => {
        // Inicializar listeners globales (solo una vez)
        initGlobalErrorLogging();
    }, []);

    useEffect(() => {
        // Actualizar el ID de usuario cuando cambia
        if (user?.id) {
            setLogUserId(user.id);
        }
    }, [user?.id]);

    return null; // Este componente no renderiza nada
}
