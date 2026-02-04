/**
 * Versión de la aplicación, leída automáticamente del package.json.
 * Esto asegura que siempre coincida con la versión real del proyecto.
 */
import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
