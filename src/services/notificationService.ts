/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class NotificationService {
  static async requestPermission() {
    if (!('Notification' in window)) {
      console.log('Este navegador no soporta notificaciones de escritorio');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  static async sendNotification(title: string, body: string, icon = '/favicon.ico') {
    const hasPermission = await this.requestPermission();
    if (hasPermission) {
      new Notification(title, {
        body,
        icon,
      });
    }
  }

  static checkLowStock(_materials: any[]) {
    // Stock tracking removed as per user request
  }
}
