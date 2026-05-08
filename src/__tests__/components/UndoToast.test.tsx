import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UndoToast } from '../../components/UndoToast';
import { useStore } from '../../store/useStore';

describe('UndoToast', () => {
  beforeEach(() => {
    // Reset the store before each test
    useStore.setState({ lastDeleted: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render anything if lastDeleted is null', () => {
    // Arrange (store is already reset with lastDeleted: null)
    
    // Act
    const { container } = render(<UndoToast />);

    // Assert
    expect(screen.queryByText('Elemento eliminado')).not.toBeInTheDocument();
  });

  it('should render toast if lastDeleted has data', () => {
    // Arrange
    useStore.setState({
      lastDeleted: { type: 'client', data: { id: '1', nombre: 'Test' }, index: 0 }
    });

    // Act
    render(<UndoToast />);

    // Assert
    expect(screen.getByText('Elemento eliminado')).toBeInTheDocument();
    expect(screen.getByText('DESHACER')).toBeInTheDocument();
  });

  it('should call undoDelete when clicking the DESHACER button', () => {
    // Arrange
    const undoDeleteMock = vi.fn();
    useStore.setState({
      lastDeleted: { type: 'client', data: { id: '1', nombre: 'Test' }, index: 0 },
      undoDelete: undoDeleteMock
    });

    // Act
    render(<UndoToast />);
    fireEvent.click(screen.getByText('DESHACER'));

    // Assert
    expect(undoDeleteMock).toHaveBeenCalledTimes(1);
  });

  it('should call clearLastDeleted when clicking the close (X) button', () => {
    // Arrange
    const clearLastDeletedMock = vi.fn();
    useStore.setState({
      lastDeleted: { type: 'client', data: { id: '1', nombre: 'Test' }, index: 0 },
      clearLastDeleted: clearLastDeletedMock
    });

    // Act
    render(<UndoToast />);
    // The X icon doesn't have text, but it's the second button inside the toast
    // The first button is "DESHACER", so we find the button containing the X icon
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    // Assert
    expect(clearLastDeletedMock).toHaveBeenCalledTimes(1);
  });

  it('should auto dismiss after 3 seconds', () => {
    // Arrange
    const clearLastDeletedMock = vi.fn();
    useStore.setState({
      lastDeleted: { type: 'client', data: { id: '1', nombre: 'Test' }, index: 0 },
      clearLastDeleted: clearLastDeletedMock
    });
    
    // Act
    render(<UndoToast />);
    
    // Fast-forward time by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Assert
    expect(clearLastDeletedMock).toHaveBeenCalledTimes(1);
  });
});
