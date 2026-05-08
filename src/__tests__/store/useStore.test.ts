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
});
