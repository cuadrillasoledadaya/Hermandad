'use client';

import { useEffect, useRef } from 'react';

interface AutoScrollOptions {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    delay?: number;
    offset?: number; // Offset adicional en pixeles (negativo para subir más, positivo para bajar)
}

/**
 * Hook para hacer scroll automático cuando un input recibe foco.
 * Útil para móviles donde el teclado tapa el campo.
 */
export function useAutoScroll<T extends HTMLElement = HTMLFormElement>(options: AutoScrollOptions = {}) {
    const {
        behavior = 'smooth',
        block = 'center',
        inline = 'nearest',
        delay = 300, // Retardo para dar tiempo a que se abra el teclado móvil
        offset = 0
    } = options;

    // Ref opcional si queremos limitar el efecto a un contenedor específico
    const containerRef = useRef<T>(null);

    useEffect(() => {
        const handleFocus = (event: FocusEvent) => {
            const target = event.target as HTMLElement;

            // Verificar si el elemento es un input interactivo
            const isInput =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT';

            if (!isInput) return;

            // Si usamos un ref de contenedor, verificar que el target esté dentro
            if (containerRef.current && !containerRef.current.contains(target)) {
                return;
            }

            // Pequeño timeout para esperar a que el teclado virtual desplace el viewport
            setTimeout(() => {
                // Si hay offset personalizado, usamos window.scrollTo
                if (offset !== 0) {
                    const rect = target.getBoundingClientRect();
                    const scrollTop = window.scrollY || document.documentElement.scrollTop;
                    const targetPosition = rect.top + scrollTop + offset;

                    window.scrollTo({
                        top: targetPosition - (window.innerHeight / 2) + (rect.height / 2), // Intentar centrar
                        behavior
                    });
                } else {
                    // Comportamiento estándar nativo
                    target.scrollIntoView({
                        behavior,
                        block,
                        inline
                    });
                }
            }, delay);
        };

        // Usamos capture=true para detectar el evento focus que no burbujea igual que otros
        // O usamos 'focusin' que sí burbujea. 'focusin' es lo estándar para delegación.
        const root = containerRef.current || document;
        root.addEventListener('focusin', handleFocus as EventListener);

        return () => {
            root.removeEventListener('focusin', handleFocus as EventListener);
        };
    }, [behavior, block, inline, delay, offset]);

    return containerRef;
}
