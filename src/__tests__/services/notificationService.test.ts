import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '../../services/notificationService';

describe('NotificationService', () => {
  let originalNotification: any;

  beforeEach(() => {
    originalNotification = global.Notification;
  });

  afterEach(() => {
    global.Notification = originalNotification;
    vi.restoreAllMocks();
  });

  it('should return false if Notification is not supported', async () => {
    // Arrange
    delete (global as any).Notification;

    // Act
    const result = await NotificationService.requestPermission();

    // Assert
    expect(result).toBe(false);
  });

  it('should return true if permission is already granted', async () => {
    // Arrange
    global.Notification = { permission: 'granted' } as any;

    // Act
    const result = await NotificationService.requestPermission();

    // Assert
    expect(result).toBe(true);
  });

  it('should request permission and return true if granted', async () => {
    // Arrange
    global.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted')
    } as any;

    // Act
    const result = await NotificationService.requestPermission();

    // Assert
    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should not request permission if already denied', async () => {
    // Arrange
    global.Notification = {
      permission: 'denied',
      requestPermission: vi.fn()
    } as any;

    // Act
    const result = await NotificationService.requestPermission();

    // Assert
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should send notification if permission is granted', async () => {
    // Arrange
    const MockNotification = vi.fn();
    (MockNotification as any).permission = 'granted';
    global.Notification = MockNotification as any;

    // Act
    await NotificationService.sendNotification('Test Title', 'Test Body');

    // Assert
    expect(MockNotification).toHaveBeenCalledWith('Test Title', {
      body: 'Test Body',
      icon: '/favicon.ico'
    });
  });
});
