import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  Appointment, Client, Service, Material, 
  Reminder, FinanceRecord, PaymentMethod, Worker, BusinessInfo, Category, ExtraRecord 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../services/notificationService';

interface AppState {
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
  
  // Undo logic
  lastDeleted: { type: string; data: any; index: number } | null;
  
  // Actions
  addAppointment: (appointment: Omit<Appointment, 'id' | 'completada' | 'businessId'>) => void;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  toggleAppointmentStatus: (id: string, paymentData?: { abonoEfectivo: number; abonoTransferencia: number; devuelta: number; metodoPago: PaymentMethod | 'Mixto'; propina?: number }) => void;
  completeAppointment: (id: string, paymentData: { abonoEfectivo: number; abonoTransferencia: number; devuelta: number; metodoPago: PaymentMethod | 'Mixto'; propina?: number }) => void;
  
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

  // Export/Import
  exportData: () => string;
  importData: (jsonData: string) => boolean;
}

const defaultBusinessId = 'b1';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      lastDeleted: null,

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
          businessId: state.activeBusinessId
        };
        set((state) => ({ appointments: [...state.appointments, newApp] }));
      },

      updateAppointment: (id, appData) => {
        const state = get();
        const appointment = state.appointments.find(a => a.id === id);
        if (!appointment) return;

        const updatedApp = { ...appointment, ...appData };
        
        // Update names if IDs changed
        if (appData.workerId) {
          const worker = state.workers.find(w => w.id === appData.workerId);
          updatedApp.workerNombre = worker?.nombre;
        }
        if (appData.clientId) {
          const client = state.clients.find(c => c.id === appData.clientId);
          updatedApp.clientNombre = client?.nombre;
        }
        
        // If it was completed, we might need to update client stats and finances
        let updatedClients = state.clients;
        let updatedFinances = state.finances;

        if (appointment.completada) {
          // Update client stats (diff)
          updatedClients = state.clients.map(client => {
            if (client.id === appointment.clientId) {
              return {
                ...client,
                totalGastado: client.totalGastado - appointment.precioFinal + (updatedApp.precioFinal ?? appointment.precioFinal)
              };
            }
            return client;
          });

          // Update finance record
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

        set((state) => ({
          appointments: state.appointments.map(a => a.id === id ? updatedApp : a),
          clients: updatedClients,
          finances: updatedFinances
        }));
      },

      deleteAppointment: (id) => {
        const state = get();
        const index = state.appointments.findIndex(a => a.id === id);
        if (index === -1) return;
        const appointment = state.appointments[index];

        // If completed, revert client stats
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

        set((state) => ({
          appointments: state.appointments.filter(a => a.id !== id),
          clients: updatedClients,
          finances: state.finances.filter(f => f.appointmentId !== id),
          lastDeleted: { type: 'appointment', data: appointment, index }
        }));
      },

      toggleAppointmentStatus: (id, paymentData) => {
        const state = get();
        const appointment = state.appointments.find(a => a.id === id);
        if (!appointment) return;

        if (appointment.completada) {
          // Revertir
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

          set((state) => ({
            appointments: state.appointments.map(a => 
              a.id === id ? { 
                ...a, 
                completada: false, 
                metodoPago: undefined,
                abonoEfectivo: undefined,
                abonoTransferencia: undefined,
                devuelta: undefined
              } : a
            ),
            clients: updatedClients,
            finances: state.finances.filter(f => f.appointmentId !== id)
          }));
        } else if (paymentData) {
          // Completar con datos de pago
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
                  // Costo = (Precio Material / Rendimiento Total) * Consumo del Servicio
                  costoMaterialesTotal += (material.precio / material.cantidadServicios) * sm.consumo;
                  
                  // Inventory logic
                  let newServiciosConsumidos = (material.serviciosConsumidosAcumulados || 0) + sm.consumo;
                  let newUnidades = material.unidades;
                  
                  while (newServiciosConsumidos >= material.cantidadServicios && newUnidades > 0) {
                    newUnidades -= 1;
                    newServiciosConsumidos -= material.cantidadServicios;
                  }

                  // If we are at 0 units, we can't consume more services from this material
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

        set((state) => ({
          appointments: state.appointments.map(a => 
            a.id === id ? { 
              ...a, 
              completada: true, 
              metodoPago: paymentData.metodoPago,
              abonoEfectivo: paymentData.abonoEfectivo,
              abonoTransferencia: paymentData.abonoTransferencia,
              devuelta: paymentData.devuelta,
              propina: paymentData.propina
            } : a
          ),
          clients: updatedClients,
          materials: updatedMaterials,
          finances: [...state.finances, newFinanceRecord]
        }));
      },

      checkStock: () => {
        // No longer checking stock based on usesRestantes
      },

      addClient: (clientData) => {
        const newClient: Client = {
          ...clientData,
          id: uuidv4(),
          totalCitas: 0,
          totalGastado: 0,
          color: clientData.color || '#FBCFE8',
          businessId: get().activeBusinessId
        };
        set((state) => ({ clients: [...state.clients, newClient] }));
      },

      updateClient: (id, clientData) => {
        set((state) => ({
          clients: state.clients.map(c => c.id === id ? { ...c, ...clientData } : c)
        }));
      },

      deleteClient: (id) => {
        const state = get();
        const index = state.clients.findIndex(c => c.id === id);
        if (index === -1) return;
        const client = state.clients[index];
        set((state) => ({ 
          clients: state.clients.filter(c => c.id !== id),
          lastDeleted: { type: 'client', data: client, index }
        }));
      },

      addService: (serviceData) => {
        const newService: Service = {
          ...serviceData,
          id: uuidv4(),
          businessId: get().activeBusinessId
        };
        set((state) => ({ services: [...state.services, newService] }));
      },

      updateService: (id, serviceData) => {
        set((state) => ({
          services: state.services.map(s => s.id === id ? { ...s, ...serviceData } : s)
        }));
      },

      deleteService: (id) => {
        const state = get();
        const index = state.services.findIndex(s => s.id === id);
        if (index === -1) return;
        const service = state.services[index];
        set((state) => ({ 
          services: state.services.filter(s => s.id !== id),
          lastDeleted: { type: 'service', data: service, index }
        }));
      },

      addMaterial: (matData) => {
        const newMat: Material = {
          ...matData,
          id: uuidv4(),
          serviciosConsumidosAcumulados: 0,
          businessId: get().activeBusinessId
        };
        set((state) => ({ materials: [...state.materials, newMat] }));
      },

      updateMaterial: (id, matData) => {
        set((state) => ({
          materials: state.materials.map(m => m.id === id ? { ...m, ...matData } : m)
        }));
      },

      deleteMaterial: (id) => {
        const state = get();
        const index = state.materials.findIndex(m => m.id === id);
        if (index === -1) return;
        const material = state.materials[index];
        
        // Soft delete to maintain integrity in services and history
        set((state) => ({ 
          materials: state.materials.map(m => m.id === id ? { ...m, deleted: true } : m),
          lastDeleted: { type: 'material', data: material, index }
        }));
      },

      updateMaterialStock: (id, delta) => {
        set((state) => ({
          materials: state.materials.map(m => {
            if (m.id !== id) return m;
            const newUnidades = Math.max(0, m.unidades + delta);
            // If units become 0, reset consumed services too as per user request
            const newServiciosConsumidos = newUnidades === 0 ? 0 : m.serviciosConsumidosAcumulados;
            return { ...m, unidades: newUnidades, serviciosConsumidosAcumulados: newServiciosConsumidos };
          })
        }));
      },

      addExtraRecord: (recordData) => {
        const newRecord: ExtraRecord = {
          ...recordData,
          id: uuidv4(),
          businessId: get().activeBusinessId
        };
        set((state) => ({ extraRecords: [...state.extraRecords, newRecord] }));
      },

      updateExtraRecord: (id, recordData) => {
        set((state) => ({
          extraRecords: state.extraRecords.map(r => r.id === id ? { ...r, ...recordData } : r)
        }));
      },

      deleteExtraRecord: (id) => {
        const state = get();
        const index = state.extraRecords.findIndex(r => r.id === id);
        if (index === -1) return;
        const record = state.extraRecords[index];
        set((state) => ({
          extraRecords: state.extraRecords.filter(r => r.id !== id),
          lastDeleted: { type: 'extraRecord', data: record, index }
        }));
      },

      addCategory: (nombre) => {
        const state = get();
        const isDuplicate = state.categories.some(c => 
          c.businessId === state.activeBusinessId && 
          c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()
        );
        if (isDuplicate) {
          return false;
        }
        
        const newCat: Category = { id: uuidv4(), nombre, businessId: state.activeBusinessId };
        set((state) => ({ categories: [...state.categories, newCat] }));
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

        set((state) => ({
          categories: state.categories.filter(c => c.id !== id),
          materials: state.materials.map(m => 
            m.categoriaId === id ? { ...m, categoriaId: '' } : m
          ),
          lastDeleted: { 
            type: 'category', 
            data: { category: categoryToDelete, affectedMaterialIds }, 
            index: categoryIndex 
          }
        }));
      },

      addWorker: (workerData) => {
        const newWorker: Worker = {
          ...workerData,
          id: uuidv4(),
          businessId: get().activeBusinessId
        };
        set((state) => ({ workers: [...state.workers, newWorker] }));
      },

      updateWorker: (id, workerData) => {
        set((state) => ({
          workers: state.workers.map(w => w.id === id ? { ...w, ...workerData } : w)
        }));
      },

      deleteWorker: (id) => {
        const state = get();
        const index = state.workers.findIndex(w => w.id === id);
        if (index === -1) return;
        const worker = state.workers[index];
        set((state) => ({ 
          workers: state.workers.filter(w => w.id !== id),
          lastDeleted: { type: 'worker', data: worker, index }
        }));
      },

      addBusiness: (info) => {
        const newBusiness: BusinessInfo = { ...info, id: uuidv4() };
        set((state) => ({ 
          businesses: [...state.businesses, newBusiness],
          activeBusinessId: newBusiness.id 
        }));
      },

      updateBusiness: (id, info) => {
        set((state) => ({
          businesses: state.businesses.map(b => b.id === id ? { ...b, ...info } : b)
        }));
      },

      deleteBusiness: (id) => {
        if (get().businesses.length <= 1) return;
        set((state) => {
          const filtered = state.businesses.filter(b => b.id !== id);
          return {
            businesses: filtered,
            activeBusinessId: state.activeBusinessId === id ? filtered[0].id : state.activeBusinessId
          };
        });
      },

      setActiveBusiness: (id) => set({ activeBusinessId: id }),

      undoDelete: () => {
        const { lastDeleted } = get();
        if (!lastDeleted) return;

        set((state) => {
          const { type, data, index } = lastDeleted;
          
          const reinsert = (arr: any[]) => {
            const newArr = [...arr];
            newArr.splice(index, 0, data);
            return newArr;
          };

          switch (type) {
            case 'client': return { clients: reinsert(state.clients), lastDeleted: null };
            case 'service': return { services: reinsert(state.services), lastDeleted: null };
            case 'material': 
              // If it was soft deleted, we just un-delete it
              return { 
                materials: state.materials.map(m => m.id === data.id ? { ...m, deleted: false } : m), 
                lastDeleted: null 
              };
            case 'worker': return { workers: reinsert(state.workers), lastDeleted: null };
            case 'appointment': {
              const appointment = data as Appointment;
              let updatedClients = state.clients;
              let updatedFinances = state.finances;

              if (appointment.completada) {
                // Restore client stats
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

                // Restore finance record
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
              }

              return { 
                appointments: reinsert(state.appointments), 
                clients: updatedClients,
                finances: updatedFinances,
                lastDeleted: null 
              };
            }
            case 'extraRecord': return { extraRecords: reinsert(state.extraRecords), lastDeleted: null };
            case 'category': {
              const { category, affectedMaterialIds } = state.lastDeleted.data;
              const newCategories = [...state.categories];
              newCategories.splice(state.lastDeleted.index, 0, category);
              
              const newMaterials = state.materials.map(m => 
                affectedMaterialIds.includes(m.id) ? { ...m, categoriaId: category.id } : m
              );
              
              return { 
                categories: newCategories, 
                materials: newMaterials,
                lastDeleted: null 
              };
            }
            default: return { lastDeleted: null };
          }
        });
      },

      clearLastDeleted: () => set({ lastDeleted: null }),

      addReminder: (reminderData) => {
        const newReminder: Reminder = {
          ...reminderData,
          id: uuidv4(),
          completado: false,
          businessId: get().activeBusinessId
        };
        set((state) => ({ reminders: [...state.reminders, newReminder] }));
      },

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
    {
      name: 'nail-studio-storage',
    }
  )
);
