import { toast } from 'sonner';

/**
 * Traduce mensajes de error técnicos comunes al español para los usuarios
 */
function translateErrorMessage(message: string): string {
    const msg = message.toLowerCase();

    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
        return 'Error de conexión: Verifica tu internet o si el servidor está caído';
    }

    if (msg.includes('jwt expired') || msg.includes('token expired') || msg.includes('session expired')) {
        return 'Tu sesión ha caducado: Por favor, vuelve a iniciar sesión';
    }

    if (msg.includes('invalid credentials') || msg.includes('invalid login')) {
        return 'Credenciales inválidas: El correo o la contraseña son incorrectos';
    }

    if (msg.includes('user already exists') || msg.includes('already registered')) {
        return 'El usuario ya existe con ese correo electrónico';
    }

    if (msg.includes('permission denied') || msg.includes('does not have permission')) {
        return 'Acceso denegado: No tienes los permisos necesarios para esta acción';
    }

    if (msg.includes('ya tiene la papeleta')) {
        return 'Este hermano ya tiene una papeleta registrada para este año';
    }

    return message;
}

/**
 * Muestra un error altamente visible al usuario
 */
export function showError(title: string, error?: unknown) {
    console.error(title, error);

    // Guardar en log interno
    import('./logger').then(({ logSystem }) => {
        logSystem('error', title, error);
    });

    let message = 'Algo salió mal';

    if (typeof error === 'string') {
        message = error;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
        message = String(error.message);
    }

    const translatedMessage = translateErrorMessage(message);

    console.error(`[ERROR] ${title}:`, error);

    toast.error(title, {
        description: translatedMessage,
        duration: 8000, // Reducido de 20s a 8s
        style: {
            background: '#fee2e2',
            color: '#991b1b',
            border: '2px solid #ef4444',
            fontSize: '16px',
        },
    });
}

/**
 * Muestra un aviso de éxito visible
 */
export function showSuccess(title: string, description?: string) {
    toast.success(title, {
        description,
        duration: 5000,
        style: {
            background: '#15803d', // Verde intenso
            color: '#ffffff',
            border: '2px solid #14532d',
            fontSize: '16px',
        }
    });
}
