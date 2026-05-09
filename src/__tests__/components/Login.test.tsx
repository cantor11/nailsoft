import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Login } from '../../components/Login';
import { useStore } from '../../store/useStore';

// Mocks para Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('capacitor-native-biometric', () => ({
  NativeBiometric: {
    isAvailable: vi.fn().mockResolvedValue({ isAvailable: false }),
    verifyIdentity: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: 'false' }),
    set: vi.fn().mockResolvedValue(null),
  },
}));

describe('Login Component', () => {
  beforeEach(() => {
    // Setup store mock state
    useStore.setState({
      businesses: [{
        id: 'b1',
        nombre: 'Nail Studio',
        descripcion: 'Cuidado de uñas',
        telefono: '',
        correo: ''
      }],
      activeBusinessId: 'b1',
    });
    vi.clearAllMocks();
  });

  it('should render the active business name and description', async () => {
    // Arrange
    const onLoginMock = vi.fn();

    // Act
    await act(async () => {
      render(<Login onLogin={onLoginMock} />);
    });

    // Assert
    expect(screen.getByText('Nail')).toBeInTheDocument();
    expect(screen.getByText('Studio')).toBeInTheDocument();
    expect(screen.getByText('Cuidado de uñas')).toBeInTheDocument();
  });

  it('should call onLogin when clicking the Ingresar button', async () => {
    // Arrange
    const onLoginMock = vi.fn();
    await act(async () => {
      render(<Login onLogin={onLoginMock} />);
    });

    // Act
    const ingresarButton = screen.getByText('Ingresar');
    fireEvent.click(ingresarButton);

    // Assert
    expect(onLoginMock).toHaveBeenCalledTimes(1);
  });

  it('should open settings modal when clicking settings icon', async () => {
    // Arrange
    const onLoginMock = vi.fn();
    await act(async () => {
      render(<Login onLogin={onLoginMock} />);
    });

    // In Login.tsx, settings button is the first button inside the main container
    const buttons = screen.getAllByRole('button');
    const settingsButton = buttons[0]; // Assuming it's the first top-right button

    // Act
    fireEvent.click(settingsButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Ajustes')).toBeInTheDocument();
      expect(screen.getByText('Acceso con Huella')).toBeInTheDocument();
    });
  });
});
