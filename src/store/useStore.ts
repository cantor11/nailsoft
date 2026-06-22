import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Appointment, Client, Service, Material,
  Reminder, FinanceRecord, PaymentMethod, Worker, BusinessInfo, Category, ExtraRecord
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../services/notificationService';
import {
  syncAppointment,
  syncClient,
  syncService,
  syncWorker,
  syncMaterial,
  syncCategory,
  syncFinance,
  syncExtraRecord,
  syncBusiness,
  loadUserData,
  saveInitialData
} from '../services/syncService';

interface AppState {
  // — Estado de autenticación —
  userId: string | null;

  businesses: BusinessInfo[];
  activeBusinessId: string;
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  materials: Material[];
  categories: Category[];
  reminders: Reminder[];
  finances: FinanceRecord[];
  extraRecords: ExtraRecord[];
  workers: Worker[];

  lastDeleted: { type: string; data: any; index: number } | null;

  // — Acción de autenticación —
  setUserId: (userId: string | null) => void;
  initializeUserData: (userId: string) => Promise<void>;
  clearUserData: () => void;

  // — Acciones existentes —
  addAppointment: (appointment: Omit<Appointment, 'id' | 'completada' | 'businessId'>) => void;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  toggleAppointmentStatus: (id: string, paymentData?: {
    abonoEfectivo: number;
    abonoTransferencia: number;
    devuelta: number;
    metodoPago: PaymentMethod | 'Mixto';
    propina?: number
  }) => void;
  completeAppointment: (id: string, paymentData: {
    abonoEfectivo: number;
    abonoTransferencia: number;
    devuelta: number;
    metodoPago: PaymentMethod | 'Mixto';
    propina?: number
  }) => void;

  addClient: (client: Omit<Client, 'id' | 'totalCitas' | 'totalGastado' | 'businessId'>) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addService: (service: Omit<Service, 'id' | 'businessId'>) => void;
  updateService: (id: string, service: Partial<Service>) => void;
  deleteService: (id: string) => void;

  addMaterial: (material: Omit<Material, 'id' | 'businessId' | 'serviciosConsumidosAcumulados'>) => void;
  updateMaterial: (id: string, material: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  updateMaterialStock: (id: string, delta: number) => void;

  addExtraRecord: (record: Omit<ExtraRecord, 'id' | 'businessId'>) => void;
  updateExtraRecord: (id: string, record: Partial<ExtraRecord>) => void;
  deleteExtraRecord: (id: string) => void;

  addCategory: (nombre: string) => boolean;
  deleteCategory: (id: string) => void;

  addWorker: (worker: Omit<Worker, 'id' | 'businessId'>) => void;
  updateWorker: (id: string, worker: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;

  addBusiness: (info: Omit<BusinessInfo, 'id'>) => void;
  updateBusiness: (id: string, info: Partial<BusinessInfo>) => void;
  deleteBusiness: (id: string) => void;
  setActiveBusiness: (id: string) => void;

  undoDelete: () => void;
  clearLastDeleted: () => void;

  addReminder: (reminder: Omit<Reminder, 'id' | 'completado' | 'businessId'>) => void;
  checkStock: () => void;

  exportData: () => string;
  importData: (jsonData: string) => boolean;
}

const defaultBusinessId = 'b1';

const defaultState = {
  userId: null,
  businesses: [
    {
      id: defaultBusinessId,
      nombre: 'Nail Studio',
      descripcion: 'Cuidado de uñas',
      telefono: '',
      correo: ''
    }
  ],
  activeBusinessId: defaultBusinessId,
  appointments: [],
  clients: [],
  services: [],
  materials: [],
  categories: [
    { id: 'cat1', nombre: 'Esmaltes', businessId: defaultBusinessId },
    { id: 'cat2', nombre: 'Herramientas', businessId: defaultBusinessId },
    { id: 'cat3', nombre: 'Limpieza', businessId: defaultBusinessId }
  ],
  reminders: [],
  finances: [],
  extraRecords: [],
  workers: [],
  lastDeleted: null
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // ─────────────────────────────────────────────
      // AUTENTICACIÓN
      // ─────────────────────────────────────────────

      setUserId: (userId) => set({ userId }),

      // Se llama cuando el usuario hace login
      // Carga sus datos desde Firestore o inicializa los defaults
      initializeUserData: async (userId: string) => {
        try {
          const data = await loadUserData(userId);

          if (data) {
            // Usuario existente — cargamos sus datos al store
            set({
              userId,
              businesses: data.businesses,
              activeBusinessId: data.activeBusinessId,
              appointments: data.appointments,
              clients: data.clients,
              services: data.services,
              workers: data.workers,
              materials: data.materials,
              categories: data.categories,
              finances: data.finances,
              extraRecords: data.extraRecords
            });
          } else {
            // Usuario nuevo — guardamos los datos por defecto en Firestore
            const state = get();
            set({ userId });
            await saveInitialData(userId, {
              businesses: state.businesses,
              activeBusinessId: state.activeBusinessId,
              appointments: [],
              clients: [],
              services: [],
              workers: [],
              materials: [],
              categories: state.categories,
              finances: [],
              extraRecords: []
            });
          }
        } catch (error) {
          console.error('Error inicializando datos del usuario:', error);
          // Si falla Firestore, la app sigue funcionando con localStorage
          set({ userId });
        }
      },

      // Se llama cuando el usuario cierra sesión
      clearUserData: () => set({ ...defaultState }),

      // ─────────────────────────────────────────────
      // CITAS
      // ─────────────────────────────────────────────

      addAppointment: (appData) => {
        const state = get();
        const serviciosNombres: Record<string, string> = {};
        appData.serviciosIds.forEach(id => {
          const s = state.services.find(srv => srv.id === id);
          if (s) serviciosNombres[id] = s.nombre;
        });

        const worker = state.workers.find(w => w.id === appData.workerId);
        const client = state.clients.find(c => c.id === appData.clientId);

        const newApp: Appointment = {
          ...appData,
          id: uuidv4(),
          completada: false,
          serviciosNombres,
          workerNombre: worker?.nombre,
          clientNombre: client?.nombre,
          serviciosMultiplicadores: appData.serviciosMultiplicadores || {},
          businessId: state.activeBusinessId
        };

        set((state) => ({ appointments: [...state.appointments, newApp] }));

        // Sincronizar con Firestore
        if (state.userId) {
          syncAppointment.save(state.userId, newApp).catch(console.error);
        }
      },

      updateAppointment: (id, appData) => {
        const state = get();
        const appointment = state.appointments.find(a => a.id === id);
        if (!appointment) return;

        const updatedApp = { ...appointment, ...appData };

        if (appData.workerId) {
          const worker = state.workers.find(w => w.id === appData.workerId);
          updatedApp.workerNombre = worker?.nombre;
        }
        if (appData.clientId) {
          const client = state.clients.find(c => c.id === appData.clientId);
          updatedApp.clientNombre = client?.nombre;
        }

        let updatedClients = state.clients;
        let updatedFinances = state.finances;

        if (appointment.completada) {
          updatedClients = state.clients.map(client => {
            if (client.id === appointment.clientId) {
              return {
                ...client,
                totalGastado: client.totalGastado - appointment.precioFinal + (updatedApp.precioFinal ?? appointment.precioFinal)
              };
            }
            return client;
          });

          updatedFinances = state.finances.map(f => {
            if (f.appointmentId === id) {
              return {
                ...f,
                fecha: updatedApp.fecha,
                ingreso: updatedApp.precioFinal,
                workerId: updatedApp.workerId,
                serviciosIds: updatedApp.serviciosIds
              };
            }
            return f;
          });
        }

        set(() => ({
          appointments: state.appointments.map(a => a.id === id ? updatedApp : a),
          clients: updatedClients,
          finances: updatedFinances
        }));

        // Sincronizar con Firestore
        if (state.userId) {
          syncAppointment.save(state.userId, updatedApp).catch(console.error);

          // Si había un registro financiero asociado, actualizarlo también
          if (appointment.completada) {
            const financeRecord = updatedFinances.find(f => f.appointmentId === id);
            if (financeRecord) {
              syncFinance.save(state.userId, financeRecord).catch(console.error);
            }
            const updatedClient = updatedClients.find(c => c.id === appointment.clientId);
            if (updatedClient) {
              syncClient.save(state.userId, updatedClient).catch(console.error);
            }
          }
        }
      },

      deleteAppointment: (id) => {
        const state = get();
        const index = state.appointments.findIndex(a => a.id === id);
        if (index === -1) return;
        const appointment = state.appointments[index];

        const updatedClients = appointment.completada
          ? state.clients.map(client => {
              if (client.id === appointment.clientId) {
                return {
                  ...client,
                  totalCitas: Math.max(0, client.totalCitas - 1),
                  totalGastado: Math.max(0, client.totalGastado - appointment.precioFinal)
                };
              }
              return client;
            })
          : state.clients;

        set(() => ({
          appointments: state.appointments.filter(a => a.id !== id),
          clients: updatedClients,
          finances: state.finances.filter(f => f.appointmentId !== id),
          lastDeleted: { type: 'appointment', data: appointment, index }
        }));

        // Sincronizar con Firestore
        if (state.userId) {
          syncAppointment.delete(state.userId, id).catch(console.error);

          // Eliminar también el registro financiero asociado
          const financeRecord = state.finances.find(f => f.appointmentId === id);
          if (financeRecord) {
            syncFinance.delete(state.userId, financeRecord.id).catch(console.error);
          }

          // Actualizar cliente si tenía stats
          if (appointment.completada) {
            const updatedClient = updatedClients.find(c => c.id === appointment.clientId);
            if (updatedClient) {
              syncClient.save(state.userId, updatedClient).catch(console.error);
            }
          }
        }
      },

      toggleAppointmentStatus: (id, paymentData) => {
        const state = get();
        const appointment = state.appointments.find(a => a.id === id);
        if (!appointment) return;

        if (appointment.completada) {
          // Revertir pago
          const updatedClients = state.clients.map(client => {
            if (client.id === appointment.clientId) {
              return {
                ...client,
                totalCitas: Math.max(0, client.totalCitas - 1),
                totalGastado: Math.max(0, client.totalGastado - appointment.precioFinal)
              };
            }
            return client;
          });

          const updatedAppointment = {
            ...appointment,
            completada: false,
            metodoPago: undefined,
            abonoEfectivo: undefined,
            abonoTransferencia: undefined,
            devuelta: undefined
          };

          set(() => ({
            appointments: state.appointments.map(a =>
              a.id === id ? updatedAppointment : a
            ),
            clients: updatedClients,
            finances: state.finances.filter(f => f.appointmentId !== id)
          }));

          // Sincronizar con Firestore
          if (state.userId) {
            syncAppointment.save(state.userId, updatedAppointment).catch(console.error);

            const financeRecord = state.finances.find(f => f.appointmentId === id);
            if (financeRecord) {
              syncFinance.delete(state.userId, financeRecord.id).catch(console.error);
            }

            const updatedClient = updatedClients.find(c => c.id === appointment.clientId);
            if (updatedClient) {
              syncClient.save(state.userId, updatedClient).catch(console.error);
            }
          }
        } else if (paymentData) {
          state.completeAppointment(id, paymentData);
        }
      },

      completeAppointment: (id, paymentData) => {
        const state = get();
        const appointment = state.appointments.find((a) => a.id === id);
        if (!appointment || appointment.completada) return;

        let costoMaterialesTotal = 0;
        const updatedMaterials = [...state.materials];

        appointment.serviciosIds.forEach(serviceId => {
          const service = state.services.find(s => s.id === serviceId);
          if (service) {
            service.materiales.forEach(sm => {
              const materialIndex = updatedMaterials.findIndex(m => m.id === sm.materialId);
              if (materialIndex !== -1) {
                const material = updatedMaterials[materialIndex];
                if (material.cantidadServicios > 0) {
                  costoMaterialesTotal += (material.precio / material.cantidadServicios) * sm.consumo;

                  let newServiciosConsumidos = (material.serviciosConsumidosAcumulados || 0) + sm.consumo;
                  let newUnidades = material.unidades;

                  while (newServiciosConsumidos >= material.cantidadServicios && newUnidades > 0) {
                    newUnidades -= 1;
                    newServiciosConsumidos -= material.cantidadServicios;
                  }

                  if (newUnidades === 0 && newServiciosConsumidos > 0) {
                    newServiciosConsumidos = 0;
                  }

                  updatedMaterials[materialIndex] = {
                    ...material,
                    unidades: newUnidades,
                    serviciosConsumidosAcumulados: newServiciosConsumidos
                  };
                }
              }
            });
          }
        });

        const updatedClients = state.clients.map(client => {
          if (client.id === appointment.clientId) {
            return {
              ...client,
              totalCitas: client.totalCitas + 1,
              totalGastado: client.totalGastado + appointment.precioFinal
            };
          }
          return client;
        });

        const completedAppointment = {
          ...appointment,
          completada: true,
          metodoPago: paymentData.metodoPago,
          abonoEfectivo: paymentData.abonoEfectivo,
          abonoTransferencia: paymentData.abonoTransferencia,
          devuelta: paymentData.devuelta,
          propina: paymentData.propina
        };

        const newFinanceRecord: FinanceRecord = {
          id: uuidv4(),
          appointmentId: appointment.id,
          fecha: appointment.fecha,
          ingreso: appointment.precioFinal,
          propina: paymentData.propina,
          costoMateriales: costoMaterialesTotal,
          metodoPago: paymentData.metodoPago,
          abonoEfectivo: paymentData.abonoEfectivo,
          abonoTransferencia: paymentData.abonoTransferencia,
          workerId: appointment.workerId,
          serviciosIds: appointment.serviciosIds,
          businessId: state.activeBusinessId
        };

        set(() => ({
          appointments: state.appointments.map(a =>
            a.id === id ? completedAppointment : a
          ),
          clients: updatedClients,
          materials: updatedMaterials,
          finances: [...state.finances, newFinanceRecord]
        }));

        // Sincronizar con Firestore
        if (state.userId) {
          syncAppointment.save(state.userId, completedAppointment).catch(console.error);
          syncFinance.save(state.userId, newFinanceRecord).catch(console.error);

          const updatedClient = updatedClients.find(c => c.id === appointment.clientId);
          if (updatedClient) {
            syncClient.save(state.userId, updatedClient).catch(console.error);
          }

          // Sincronizar materiales que cambiaron
          updatedMaterials.forEach((mat, index) => {
            if (mat.unidades !== state.materials[index]?.unidades ||
                mat.serviciosConsumidosAcumulados !== state.materials[index]?.serviciosConsumidosAcumulados) {
              syncMaterial.save(state.userId!, mat).catch(console.error);
            }
          });
        }
      },

      // ─────────────────────────────────────────────
      // CLIENTES
      // ─────────────────────────────────────────────

      addClient: (clientData) => {
        const state = get();
        const newClient: Client = {
          ...clientData,
          id: uuidv4(),
          totalCitas: 0,
          totalGastado: 0,
          color: clientData.color || '#FBCFE8',
          businessId: state.activeBusinessId
        };

        set((s) => ({ clients: [...s.clients, newClient] }));

        if (state.userId) {
          syncClient.save(state.userId, newClient).catch(console.error);
        }
      },

      updateClient: (id, clientData) => {
        const state = get();
        const updatedClients = state.clients.map(c =>
          c.id === id ? { ...c, ...clientData } : c
        );
        const updatedClient = updatedClients.find(c => c.id === id);

        set(() => ({ clients: updatedClients }));

        if (state.userId && updatedClient) {
          syncClient.save(state.userId, updatedClient).catch(console.error);
        }
      },

      deleteClient: (id) => {
        const state = get();
        const index = state.clients.findIndex(c => c.id === id);
        if (index === -1) return;
        const client = state.clients[index];

        set((s) => ({
          clients: s.clients.filter(c => c.id !== id),
          lastDeleted: { type: 'client', data: client, index }
        }));

        if (state.userId) {
          syncClient.delete(state.userId, id).catch(console.error);
        }
      },

      // ─────────────────────────────────────────────
      // SERVICIOS
      // ─────────────────────────────────────────────

      addService: (serviceData) => {
        const state = get();
        const newService: Service = {
          ...serviceData,
          id: uuidv4(),
          businessId: state.activeBusinessId
        };

        set((s) => ({ services: [...s.services, newService] }));

        if (state.userId) {
          syncService.save(state.userId, newService).catch(console.error);
        }
      },

      updateService: (id, serviceData) => {
        const state = get();
        const updatedServices = state.services.map(s =>
          s.id === id ? { ...s, ...serviceData } : s
        );
        const updatedService = updatedServices.find(s => s.id === id);

        set(() => ({ services: updatedServices }));

        if (state.userId && updatedService) {
          syncService.save(state.userId, updatedService).catch(console.error);
        }
      },

      deleteService: (id) => {
        const state = get();
        const index = state.services.findIndex(s => s.id === id);
        if (index === -1) return;
        const service = state.services[index];

        set((s) => ({
          services: s.services.filter(s => s.id !== id),
          lastDeleted: { type: 'service', data: service, index }
        }));

        if (state.userId) {
          syncService.delete(state.userId, id).catch(console.error);
        }
      },

      // ─────────────────────────────────────────────
      // MATERIALES
      // ─────────────────────────────────────────────

      addMaterial: (matData) => {
        const state = get();
        const newMat: Material = {
          ...matData,
          id: uuidv4(),
          serviciosConsumidosAcumulados: 0,
          businessId: state.activeBusinessId
        };

        set((s) => ({ materials: [...s.materials, newMat] }));

        if (state.userId) {
          syncMaterial.save(state.userId, newMat).catch(console.error);
        }
      },

      updateMaterial: (id, matData) => {
        const state = get();
        const updatedMaterials = state.materials.map(m =>
          m.id === id ? { ...m, ...matData } : m
        );
        const updatedMaterial = updatedMaterials.find(m => m.id === id);

        set(() => ({ materials: updatedMaterials }));

        if (state.userId && updatedMaterial) {
          syncMaterial.save(state.userId, updatedMaterial).catch(console.error);
        }
      },

      deleteMaterial: (id) => {
        const state = get();
        const index = state.materials.findIndex(m => m.id === id);
        if (index === -1) return;
        const material = state.materials[index];

        set((s) => ({
          materials: s.materials.map(m => m.id === id ? { ...m, deleted: true } : m),
          lastDeleted: { type: 'material', data: material, index }
        }));

        if (state.userId) {
          // Soft delete — actualizamos el flag en Firestore
          syncMaterial.update(state.userId, id, { deleted: true }).catch(console.error);
        }
      },

      updateMaterialStock: (id, delta) => {
        const state = get();
        const updatedMaterials = state.materials.map(m => {
          if (m.id !== id) return m;
          const newUnidades = Math.max(0, m.unidades + delta);
          const newServiciosConsumidos = newUnidades === 0 ? 0 : m.serviciosConsumidosAcumulados;
          return { ...m, unidades: newUnidades, serviciosConsumidosAcumulados: newServiciosConsumidos };
        });
        const updatedMaterial = updatedMaterials.find(m => m.id === id);

        set(() => ({ materials: updatedMaterials }));

        if (state.userId && updatedMaterial) {
          syncMaterial.save(state.userId, updatedMaterial).catch(console.error);
        }
      },

      // ─────────────────────────────────────────────
      // REGISTROS EXTRA
      // ─────────────────────────────────────────────

      addExtraRecord: (recordData) => {
        const state = get();
        const newRecord: ExtraRecord = {
          ...recordData,
          id: uuidv4(),
          businessId: state.activeBusinessId
        };

        set((s) => ({ extraRecords: [...s.extraRecords, newRecord] }));

        if (state.userId) {
          syncExtraRecord.save(state.userId, newRecord).catch(console.error);
        }
      },

      updateExtraRecord: (id, recordData) => {
        const state = get();
        const updatedRecords = state.extraRecords.map(r =>
          r.id === id ? { ...r, ...recordData } : r
        );
        const updatedRecord = updatedRecords.find(r => r.id === id);

        set(() => ({ extraRecords: updatedRecords }));

        if (state.userId && updatedRecord) {
          syncExtraRecord.save(state.userId, updatedRecord).catch(console.error);
        }
      },

      deleteExtraRecord: (id) => {
        const state = get();
        const index = state.extraRecords.findIndex(r => r.id === id);
        if (index === -1) return;
        const record = state.extraRecords[index];

        set((s) => ({
          extraRecords: s.extraRecords.filter(r => r.id !== id),
          lastDeleted: { type: 'extraRecord', data: record, index }
        }));

        if (state.userId) {
          syncExtraRecord.delete(state.userId, id).catch(console.error);
        }
      },

      // ─────────────────────────────────────────────
      // CATEGORÍAS
      // ─────────────────────────────────────────────

      addCategory: (nombre) => {
        const state = get();
        const isDuplicate = state.categories.some(c =>
          c.businessId === state.activeBusinessId &&
          c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()
        );
        if (isDuplicate) return false;

        const newCat: Category = {
          id: uuidv4(),
          nombre,
          businessId: state.activeBusinessId
        };

        set((s) => ({ categories: [...s.categories, newCat] }));

        if (state.userId) {
          syncCategory.save(state.userId, newCat).catch(console.error);
        }

        return true;
      },

      deleteCategory: (id) => {
        const state = get();
        const categoryIndex = state.categories.findIndex(c => c.id === id);
        if (categoryIndex === -1) return;

        const categoryToDelete = state.categories[categoryIndex];
        const affectedMaterialIds = state.materials
          .filter(m => m.categoriaId === id)
          .map(m => m.id);

        set((s) => ({
          categories: s.categories.filter(c => c.id !== id),
          materials: s.materials.map(m =>
            m.categoriaId === id ? { ...m, categoriaId: '' } : m
          ),
          lastDeleted: {
            type: 'category',
            data: { category: categoryToDelete, affectedMaterialIds },
            index: categoryIndex
          }
        }));

        if (state.userId) {
          syncCategory.delete(state.userId, id).catch(console.error);

          // Actualizar los materiales afectados en Firestore
          affectedMaterialIds.forEach(matId => {
            syncMaterial.update(state.userId!, matId, { categoriaId: '' }).catch(console.error);
          });
        }
      },

      // ─────────────────────────────────────────────
      // TRABAJADORES
      // ─────────────────────────────────────────────

      addWorker: (workerData) => {
        const state = get();
        const newWorker: Worker = {
          ...workerData,
          id: uuidv4(),
          businessId: state.activeBusinessId
        };

        set((s) => ({ workers: [...s.workers, newWorker] }));

        if (state.userId) {
          syncWorker.save(state.userId, newWorker).catch(console.error);
        }
      },

      updateWorker: (id, workerData) => {
        const state = get();
        const updatedWorkers = state.workers.map(w =>
          w.id === id ? { ...w, ...workerData } : w
        );
        const updatedWorker = updatedWorkers.find(w => w.id === id);

        set(() => ({ workers: updatedWorkers }));

        if (state.userId && updatedWorker) {
          syncWorker.save(state.userId, updatedWorker).catch(console.error);
        }
      },

      deleteWorker: (id) => {
        const state = get();
        const index = state.workers.findIndex(w => w.id === id);
        if (index === -1) return;
        const worker = state.workers[index];

        set((s) => ({
          workers: s.workers.filter(w => w.id !== id),
          lastDeleted: { type: 'worker', data: worker, index }
        }));

        if (state.userId) {
          syncWorker.delete(state.userId, id).catch(console.error);
        }
      },

      // ─────────────────────────────────────────────
      // NEGOCIOS
      // ─────────────────────────────────────────────

      addBusiness: (info) => {
        const state = get();
        const newBusiness: BusinessInfo = { ...info, id: uuidv4() };

        set((s) => ({
          businesses: [...s.businesses, newBusiness],
          activeBusinessId: newBusiness.id
        }));

        if (state.userId) {
          syncBusiness.save(state.userId, newBusiness).catch(console.error);
          syncBusiness.updateActive(state.userId, newBusiness.id).catch(console.error);
        }
      },

      updateBusiness: (id, info) => {
        const state = get();
        const updatedBusinesses = state.businesses.map(b =>
          b.id === id ? { ...b, ...info } : b
        );
        const updatedBusiness = updatedBusinesses.find(b => b.id === id);

        set(() => ({ businesses: updatedBusinesses }));

        if (state.userId && updatedBusiness) {
          syncBusiness.save(state.userId, updatedBusiness).catch(console.error);
        }
      },

      deleteBusiness: (id) => {
        const state = get();
        if (state.businesses.length <= 1) return;

        const filtered = state.businesses.filter(b => b.id !== id);
        const newActiveId = state.activeBusinessId === id
          ? filtered[0].id
          : state.activeBusinessId;

        set(() => ({
          businesses: filtered,
          activeBusinessId: newActiveId
        }));

        if (state.userId) {
          syncBusiness.delete(state.userId, id).catch(console.error);
          if (state.activeBusinessId === id) {
            syncBusiness.updateActive(state.userId, newActiveId).catch(console.error);
          }
        }
      },

      setActiveBusiness: (id) => {
        const state = get();
        set({ activeBusinessId: id });

        if (state.userId) {
          syncBusiness.updateActive(state.userId, id).catch(console.error);
        }
      },

      // ─────────────────────────────────────────────
      // UNDO
      // ─────────────────────────────────────────────

      undoDelete: () => {
        const { lastDeleted, userId } = get();
        if (!lastDeleted) return;

        set((state) => {
          const { type, data, index } = lastDeleted;

          const reinsert = (arr: any[]) => {
            const newArr = [...arr];
            newArr.splice(index, 0, data);
            return newArr;
          };

          switch (type) {
            case 'client': {
              if (userId) syncClient.save(userId, data).catch(console.error);
              return { clients: reinsert(state.clients), lastDeleted: null };
            }
            case 'service': {
              if (userId) syncService.save(userId, data).catch(console.error);
              return { services: reinsert(state.services), lastDeleted: null };
            }
            case 'material': {
              if (userId) syncMaterial.update(userId, data.id, { deleted: false }).catch(console.error);
              return {
                materials: state.materials.map(m =>
                  m.id === data.id ? { ...m, deleted: false } : m
                ),
                lastDeleted: null
              };
            }
            case 'worker': {
              if (userId) syncWorker.save(userId, data).catch(console.error);
              return { workers: reinsert(state.workers), lastDeleted: null };
            }
            case 'appointment': {
              const appointment = data as Appointment;
              let updatedClients = state.clients;
              let updatedFinances = state.finances;

              if (appointment.completada) {
                updatedClients = state.clients.map(client => {
                  if (client.id === appointment.clientId) {
                    return {
                      ...client,
                      totalCitas: client.totalCitas + 1,
                      totalGastado: client.totalGastado + appointment.precioFinal
                    };
                  }
                  return client;
                });

                let costoMaterialesTotal = 0;
                appointment.serviciosIds.forEach(serviceId => {
                  const service = state.services.find(s => s.id === serviceId);
                  if (service) {
                    service.materiales.forEach(sm => {
                      const material = state.materials.find(m => m.id === sm.materialId);
                      if (material && material.cantidadServicios > 0) {
                        costoMaterialesTotal += (material.precio / material.cantidadServicios) * sm.consumo;
                      }
                    });
                  }
                });

                const newFinanceRecord: FinanceRecord = {
                  id: uuidv4(),
                  appointmentId: appointment.id,
                  fecha: appointment.fecha,
                  ingreso: appointment.precioFinal,
                  propina: appointment.propina,
                  costoMateriales: costoMaterialesTotal,
                  metodoPago: appointment.metodoPago!,
                  abonoEfectivo: appointment.abonoEfectivo!,
                  abonoTransferencia: appointment.abonoTransferencia!,
                  workerId: appointment.workerId,
                  serviciosIds: appointment.serviciosIds,
                  businessId: state.activeBusinessId
                };

                updatedFinances = [...state.finances, newFinanceRecord];

                if (userId) {
                  syncAppointment.save(userId, appointment).catch(console.error);
                  syncFinance.save(userId, newFinanceRecord).catch(console.error);
                  const updatedClient = updatedClients.find(c => c.id === appointment.clientId);
                  if (updatedClient) syncClient.save(userId, updatedClient).catch(console.error);
                }
              } else {
                if (userId) syncAppointment.save(userId, appointment).catch(console.error);
              }

              return {
                appointments: reinsert(state.appointments),
                clients: updatedClients,
                finances: updatedFinances,
                lastDeleted: null
              };
            }
            case 'extraRecord': {
              if (userId) syncExtraRecord.save(userId, data).catch(console.error);
              return { extraRecords: reinsert(state.extraRecords), lastDeleted: null };
            }
            case 'category': {
              const { category, affectedMaterialIds } = data;
              const newCategories = [...state.categories];
              newCategories.splice(index, 0, category);

              const newMaterials = state.materials.map((m: Material) =>
                affectedMaterialIds.includes(m.id) ? { ...m, categoriaId: category.id } : m
              );

              if (userId) {
                syncCategory.save(userId, category).catch(console.error);
                affectedMaterialIds.forEach((matId: string) => {
                  syncMaterial.update(userId, matId, { categoriaId: category.id }).catch(console.error);
                });
              }

              return {
                categories: newCategories,
                materials: newMaterials,
                lastDeleted: null
              };
            }
            default:
              return { lastDeleted: null };
          }
        });
      },

      clearLastDeleted: () => set({ lastDeleted: null }),

      // ─────────────────────────────────────────────
      // RECORDATORIOS Y STOCK (sin cambios)
      // ─────────────────────────────────────────────

      checkStock: () => {},

      addReminder: (reminderData) => {
        const newReminder: Reminder = {
          ...reminderData,
          id: uuidv4(),
          completado: false,
          businessId: get().activeBusinessId
        };
        set((state) => ({ reminders: [...state.reminders, newReminder] }));
      },

      // ─────────────────────────────────────────────
      // EXPORT / IMPORT (sin cambios)
      // ─────────────────────────────────────────────

      exportData: () => {
        const state = get();
        const dataToExport = {
          businesses: state.businesses,
          activeBusinessId: state.activeBusinessId,
          appointments: state.appointments,
          clients: state.clients,
          services: state.services,
          materials: state.materials.map(({ imagen, ...rest }: any) => rest),
          categories: state.categories,
          reminders: state.reminders,
          finances: state.finances,
          extraRecords: state.extraRecords,
          workers: state.workers.map(({ foto, ...rest }: any) => rest),
        };
        return JSON.stringify(dataToExport, null, 2);
      },

      importData: (jsonData) => {
        try {
          const importedData = JSON.parse(jsonData);
          if (!importedData.businesses || !importedData.activeBusinessId) return false;

          set({
            businesses: importedData.businesses,
            activeBusinessId: importedData.activeBusinessId,
            appointments: importedData.appointments || [],
            clients: importedData.clients || [],
            services: importedData.services || [],
            materials: importedData.materials || [],
            categories: importedData.categories || [],
            reminders: importedData.reminders || [],
            finances: importedData.finances || [],
            extraRecords: importedData.extraRecords || [],
            workers: importedData.workers || [],
            lastDeleted: null
          });
          return true;
        } catch (e) {
          console.error('Error importing data:', e);
          return false;
        }
      },
    }),
    // Al final de useStore.ts reemplaza el bloque persist por este:
    {
      name: 'nail-studio-storage',
      partialize: (state) => ({
        userId: state.userId,
        businesses: state.businesses,
        activeBusinessId: state.activeBusinessId,
        appointments: state.appointments,
        clients: state.clients,
        services: state.services,
        materials: state.materials,
        categories: state.categories,
        reminders: state.reminders,
        finances: state.finances,
        extraRecords: state.extraRecords,
        workers: state.workers,
      })
    }
  )
);