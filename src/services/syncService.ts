import { User } from 'firebase/auth';
import {
  getCollection,
  setDocument,
  updateDocument,
  deleteDocument,
  batchSet
} from '../firebase/firestore';
import {
  Appointment,
  Client,
  Service,
  Material,
  Worker,
  BusinessInfo,
  Category,
  FinanceRecord,
  ExtraRecord
} from '../types';

// Nombres de todas las colecciones que vamos a sincronizar
const COLLECTIONS = {
  BUSINESSES: 'businesses',
  APPOINTMENTS: 'appointments',
  CLIENTS: 'clients',
  SERVICES: 'services',
  WORKERS: 'workers',
  MATERIALS: 'materials',
  CATEGORIES: 'categories',
  FINANCES: 'finances',
  EXTRA_RECORDS: 'extraRecords',
  PROFILE: 'profile'
} as const;

// ─────────────────────────────────────────────
// CARGA INICIAL — se llama una vez al hacer login
// ─────────────────────────────────────────────

export interface UserData {
  businesses: BusinessInfo[];
  activeBusinessId: string;
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  workers: Worker[];
  materials: Material[];
  categories: Category[];
  finances: FinanceRecord[];
  extraRecords: ExtraRecord[];
}

export const loadUserData = async (userId: string): Promise<UserData | null> => {
  try {
    // Cargamos todas las colecciones en paralelo para que sea más rápido
    const [
      businesses,
      appointments,
      clients,
      services,
      workers,
      materials,
      categories,
      finances,
      extraRecords,
      profileDocs
    ] = await Promise.all([
      getCollection<BusinessInfo>(userId, COLLECTIONS.BUSINESSES),
      getCollection<Appointment>(userId, COLLECTIONS.APPOINTMENTS),
      getCollection<Client>(userId, COLLECTIONS.CLIENTS),
      getCollection<Service>(userId, COLLECTIONS.SERVICES),
      getCollection<Worker>(userId, COLLECTIONS.WORKERS),
      getCollection<Material>(userId, COLLECTIONS.MATERIALS),
      getCollection<Category>(userId, COLLECTIONS.CATEGORIES),
      getCollection<FinanceRecord>(userId, COLLECTIONS.FINANCES),
      getCollection<ExtraRecord>(userId, COLLECTIONS.EXTRA_RECORDS),
      getCollection<{ activeBusinessId: string }>(userId, COLLECTIONS.PROFILE)
    ]);

    // Si no hay negocios, es un usuario nuevo — retornamos null
    // para que el store inicialice con los datos por defecto
    if (businesses.length === 0) {
      return null;
    }

    const activeBusinessId = profileDocs[0]?.activeBusinessId || businesses[0].id;

    return {
      businesses,
      activeBusinessId,
      appointments,
      clients,
      services,
      workers,
      materials,
      categories,
      finances,
      extraRecords
    };
  } catch (error) {
    console.error('Error cargando datos del usuario:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────
// GUARDADO INICIAL — para usuarios nuevos
// Toma los datos por defecto del store y los sube a Firestore
// ─────────────────────────────────────────────

export const saveInitialData = async (userId: string, data: UserData): Promise<void> => {
  try {
    // Usamos batchSet para subir todo de una sola vez
    await Promise.all([
      batchSet(userId, COLLECTIONS.BUSINESSES, data.businesses),
      batchSet(userId, COLLECTIONS.CATEGORIES, data.categories),
      // Guardamos el perfil con el activeBusinessId
      setDocument(userId, COLLECTIONS.PROFILE, 'main', {
        activeBusinessId: data.activeBusinessId
      })
    ]);
  } catch (error) {
    console.error('Error guardando datos iniciales:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────
// OPERACIONES INDIVIDUALES
// Estas funciones se llaman desde useStore.ts
// cada vez que el usuario hace una acción
// ─────────────────────────────────────────────

// — Negocios —
export const syncBusiness = {
  save: (userId: string, business: BusinessInfo) =>
    setDocument(userId, COLLECTIONS.BUSINESSES, business.id, business),

  delete: (userId: string, businessId: string) =>
    deleteDocument(userId, COLLECTIONS.BUSINESSES, businessId),

  updateActive: (userId: string, activeBusinessId: string) =>
    setDocument(userId, COLLECTIONS.PROFILE, 'main', { activeBusinessId })
};

// — Citas —
export const syncAppointment = {
  save: (userId: string, appointment: Appointment) =>
    setDocument(userId, COLLECTIONS.APPOINTMENTS, appointment.id, appointment),

  update: (userId: string, id: string, data: Partial<Appointment>) =>
    setDocument(userId, COLLECTIONS.APPOINTMENTS, id, data),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.APPOINTMENTS, id)
};

// — Clientes —
export const syncClient = {
  save: (userId: string, client: Client) =>
    setDocument(userId, COLLECTIONS.CLIENTS, client.id, client),

  update: (userId: string, id: string, data: Partial<Client>) =>
    setDocument(userId, COLLECTIONS.CLIENTS, id, data),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.CLIENTS, id)
};

// — Servicios —
export const syncService = {
  save: (userId: string, service: Service) =>
    setDocument(userId, COLLECTIONS.SERVICES, service.id, service),

  update: (userId: string, id: string, data: Partial<Service>) =>
    setDocument(userId, COLLECTIONS.SERVICES, id, data),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.SERVICES, id)
};

// — Trabajadores —
export const syncWorker = {
  save: (userId: string, worker: Worker) =>
    setDocument(userId, COLLECTIONS.WORKERS, worker.id, worker),

  update: (userId: string, id: string, data: Partial<Worker>) =>
    setDocument(userId, COLLECTIONS.WORKERS, id, data),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.WORKERS, id)
};

// — Materiales —
export const syncMaterial = {
  save: (userId: string, material: Material) =>
    setDocument(userId, COLLECTIONS.MATERIALS, material.id, material),

  update: (userId: string, id: string, data: Partial<Material>) =>
    setDocument(userId, COLLECTIONS.MATERIALS, id, data),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.MATERIALS, id)
};

// — Categorías —
export const syncCategory = {
  save: (userId: string, category: Category) =>
    setDocument(userId, COLLECTIONS.CATEGORIES, category.id, category),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.CATEGORIES, id)
};

// — Finanzas —
export const syncFinance = {
  save: (userId: string, record: FinanceRecord) =>
    setDocument(userId, COLLECTIONS.FINANCES, record.id, record),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.FINANCES, id)
};

// — Registros extra —
export const syncExtraRecord = {
  save: (userId: string, record: ExtraRecord) =>
    setDocument(userId, COLLECTIONS.EXTRA_RECORDS, record.id, record),

  update: (userId: string, id: string, data: Partial<ExtraRecord>) =>
    setDocument(userId, COLLECTIONS.EXTRA_RECORDS, id, data),

  delete: (userId: string, id: string) =>
    deleteDocument(userId, COLLECTIONS.EXTRA_RECORDS, id)
};