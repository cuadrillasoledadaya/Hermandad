'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Monitor de versión que detecta actualizaciones del Service Worker
 * y fuerza la recarga de la página para asegurar que el usuario ve lo último.
 */
export function VersionMonitor() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        // Registrar el handler para actualizaciones
        const handleUpdate = (registration: ServiceWorkerRegistration) => {
            if (registration.waiting) {
                console.log('🔄 Nueva versión detectada (SW waiting). Forzando actualización...');

                toast.info('Actualizando a la última versión...', {
                    description: 'Se ha detectado una mejora en la aplicación.',
                    duration: 5000,
                });

                // Enviar mensaje al SW para que tome el control inmediatamente
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // Recargar la ventana una vez que el nuevo SW esté activo
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        };

        // Revisar el registro actual
        navigator.serviceWorker.ready.then((registration) => {
            // Escuchar por nuevos SW que lleguen
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            handleUpdate(registration);
                        }
                    });
                }
            });

            // Revisar si ya hay uno esperando
            handleUpdate(registration);
        });

        // Evento 'controllerchange' se dispara cuando un nuevo SW toma el mando
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

    }, []);

    return null; // Componente invisible
}
