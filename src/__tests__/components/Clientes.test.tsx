import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Clientes } from '../../components/Clientes';
import { useStore } from '../../store/useStore';

describe('Clientes Component', () => {
  beforeEach(() => {
    useStore.setState({
      businesses: [{ id: 'b1', nombre: 'Test', descripcion: '', telefono: '', correo: '' }],
      activeBusinessId: 'b1',
      clients: [
        { id: 'c1', nombre: 'Cliente 1', telefono: '111', tipoFrecuente: 'Salón' as const, totalCitas: 0, totalGastado: 0, businessId: 'b1' },
        { id: 'c2', nombre: 'Ana Gomez', telefono: '222', tipoFrecuente: 'Domicilio' as const, totalCitas: 0, totalGastado: 0, businessId: 'b1' }
      ],
      appointments: [],
      services: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the clients list', () => {
    render(<Clientes />);
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
  });

  it('should filter clients using the search bar', async () => {
    render(<Clientes />);
    
    const searchInput = screen.getByPlaceholderText('Buscar cliente...');
    fireEvent.change(searchInput, { target: { value: 'ana' } });

    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument();
    });
  });

  it('should open modal and show duplicate warning when adding an existing client', async () => {
    render(<Clientes />);
    
    // Open modal (first button is the Plus icon in header)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    // Fill form with duplicate name
    const nameInput = screen.getByPlaceholderText('Nombre completo');
    fireEvent.change(nameInput, { target: { value: 'Ana Gomez' } });

    // Save
    fireEvent.click(screen.getByText('Registrar Clienta'));

    // Assert warning
    expect(await screen.findByText(/Ya existe un cliente con el nombre/i)).toBeInTheDocument();
  });

  it('should add a new client when data is valid', async () => {
    const addClientSpy = vi.spyOn(useStore.getState(), 'addClient');
    
    render(<Clientes />);
    
    // Open modal
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    // Fill form
    const nameInput = screen.getByPlaceholderText('Nombre completo');
    fireEvent.change(nameInput, { target: { value: 'Nuevo Cliente' } });

    const phoneInput = screen.getByPlaceholderText('Ej: 3001234567');
    fireEvent.change(phoneInput, { target: { value: '3009998888' } });

    // Save
    fireEvent.click(screen.getByText('Registrar Clienta'));

    // Assert
    expect(addClientSpy).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Nuevo Cliente',
      telefono: '3009998888'
    }));
  });

  it('should show client history when a client card is clicked', () => {
    render(<Clientes />);
    
    // Click on client card
    fireEvent.click(screen.getByText('Cliente 1'));

    // Assert view changed to History
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.getByText('No hay citas registradas')).toBeInTheDocument();
  });
});
