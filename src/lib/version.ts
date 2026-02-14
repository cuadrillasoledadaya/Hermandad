/**
 * Versión de la aplicación, inyectada automáticamente desde next.config.ts (sacada de package.json).
 * Esto asegura que siempre coincida con la versión real del proyecto.
 */
export const APP_VERSION = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_APP_VERSION || "1.2.25") : "1.2.25";


