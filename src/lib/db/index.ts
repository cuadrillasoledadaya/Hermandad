// ============================================
// EXPORTACIONES PRINCIPALES DE LA BASE DE DATOS
// ============================================

export { 
  db, 
  HermandadDatabase, 
  migrateFromOldDB 
} from './database';

export type { 
  Hermano, 
  Pago, 
  Papeleta, 
  Configuracion,
  MutationQueueItem, 
  SyncLog 
} from './database';

// Repositorios (se crearán en pasos siguientes)
export { hermanosRepo } from './tables/hermanos.table';
export { pagosRepo } from './tables/pagos.table';
export { papeletasRepo } from './tables/papeletas.table';
export { mutationsRepo } from './tables/mutations.table';
