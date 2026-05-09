import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../store/useStore';

describe('useStore', () => {
  const initialState = useStore.getState();

  beforeEach(() => {
    // Arrange: Reset store to initial state before each test
    useStore.setState(initialState, true);
  });

  it('should have initial default values', () => {
    // Act
    const state = useStore.getState();

    // Assert
    expect(state.businesses.length).toBe(1);
    expect(state.activeBusinessId).toBe('b1');
    expect(state.clients).toEqual([]);
    expect(state.lastDeleted).toBeNull();
  });

  it('should add a new client', () => {
    // Arrange
    const clientData = {
      nombre: 'Jane Doe',
      telefono: '1234567890',
      notas: 'VIP client',
      tipoFrecuente: 'Domicilio' as const
    };

    // Act
    useStore.getState().addClient(clientData);

    // Assert
    const state = useStore.getState();
    expect(state.clients.length).toBe(1);
    expect(state.clients[0].nombre).toBe('Jane Doe');
    expect(state.clients[0].id).toBeDefined();
    expect(state.clients[0].totalCitas).toBe(0);
  });

  it('should clear last deleted item', () => {
    // Arrange
    useStore.setState({
      lastDeleted: { type: 'client', data: {}, index: 0 }
    });

    // Act
    useStore.getState().clearLastDeleted();

    // Assert
    const state = useStore.getState();
    expect(state.lastDeleted).toBeNull();
  });

  it('should delete a client and save it in lastDeleted for undo', () => {
    // Arrange
    useStore.getState().addClient({
      nombre: 'Jane Doe', telefono: '123',
      tipoFrecuente: 'Domicilio' as const
    });
    const client = useStore.getState().clients[0];

    // Act
    useStore.getState().deleteClient(client.id);

    // Assert
    const state = useStore.getState();
    expect(state.clients.length).toBe(0);
    expect(state.lastDeleted).toEqual({
      type: 'client',
      data: client,
      index: 0
    });
  });

  it('should undo deleting a client', () => {
    // Arrange
    useStore.getState().addClient({
      nombre: 'Jane Doe', telefono: '123',
      tipoFrecuente: 'Domicilio' as const
    });
    const client = useStore.getState().clients[0];
    useStore.getState().deleteClient(client.id);

    // Act
    useStore.getState().undoDelete();

    // Assert
    const state = useStore.getState();
    expect(state.lastDeleted).toBeNull();
    expect(state.clients.length).toBe(1);
    expect(state.clients[0].id).toBe(client.id);
  });

  describe('Material and Inventory Management', () => {
    it('should add a material and update stock', () => {
      useStore.getState().addMaterial({
        nombre: 'Esmalte Rojo',
        descripcion: 'Rojo pasion',
        precio: 100,
        cantidadServicios: 10,
        unidades: 2,
        alertaStock: 1,
        tipoAlerta: 'unidades'
      });
      const matId = useStore.getState().materials[0].id;
      
      useStore.getState().updateMaterialStock(matId, -1);
      
      expect(useStore.getState().materials[0].unidades).toBe(1);
    });

    it('should soft delete a material', () => {
      useStore.getState().addMaterial({
        nombre: 'Esmalte Azul',
        descripcion: '',
        precio: 50,
        cantidadServicios: 5,
        unidades: 1,
        alertaStock: 1,
        tipoAlerta: 'unidades'
      });
      const matId = useStore.getState().materials[0].id;
      
      useStore.getState().deleteMaterial(matId);
      
      const mat = useStore.getState().materials[0];
      expect(mat.deleted).toBe(true);
      expect(useStore.getState().lastDeleted?.type).toBe('material');
    });
  });

  describe('Appointments and Finances', () => {
    it('should complete an appointment and update client stats, finances, and material stock', () => {
      const store = useStore.getState();
      
      // Arrange
      store.addClient({ nombre: 'Ana', tipoFrecuente: 'Salón' as const, telefono: '1' });
      const clientId = useStore.getState().clients[0].id;

      store.addMaterial({
        nombre: 'Esmalte', descripcion: '', precio: 100, cantidadServicios: 10, unidades: 1, alertaStock: 1, tipoAlerta: 'unidades'
      });
      const materialId = useStore.getState().materials[0].id;

      store.addService({
        nombre: 'Manicura',
        precio: 50,
        duracion: 30,
        materiales: [{ materialId, consumo: 2 }]
      });
      const serviceId = useStore.getState().services[0].id;

      store.addAppointment({
        clientId,
        fecha: '2026-05-08',
        hora: '10:00',
        serviciosIds: [serviceId],
        tipo: 'Salón' as const,
        precioOriginal: 50,
        precioFinal: 50
      });
      const appId = useStore.getState().appointments[0].id;

      // Act
      useStore.getState().completeAppointment(appId, {
        abonoEfectivo: 50,
        abonoTransferencia: 0,
        devuelta: 0,
        metodoPago: 'Efectivo',
        propina: 10
      });

      // Assert
      const updatedStore = useStore.getState();
      
      expect(updatedStore.appointments[0].completada).toBe(true);
      
      expect(updatedStore.clients[0].totalCitas).toBe(1);
      expect(updatedStore.clients[0].totalGastado).toBe(50);
      
      expect(updatedStore.finances.length).toBe(1);
      expect(updatedStore.finances[0].ingreso).toBe(50);
      expect(updatedStore.finances[0].costoMateriales).toBe(20); // (100/10) * 2
      expect(updatedStore.finances[0].propina).toBe(10);
      
      expect(updatedStore.materials[0].serviciosConsumidosAcumulados).toBe(2);
      expect(updatedStore.materials[0].unidades).toBe(1);
    });
  });
});
