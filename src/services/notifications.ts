import { db } from '@/db';

export async function scheduleReminders(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const reminders = await db.reminders.filter((r) => r.enabled).toArray();

  // Clear existing scheduled notifications
  const existing = await registration.getNotifications();
  existing.forEach((n) => n.close());

  for (const reminder of reminders) {
    const [hours, minutes] = reminder.time.split(':').map(Number);
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hours, minutes, 0, 0);
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    const delay = scheduled.getTime() - now.getTime();

    // Use setTimeout in SW context via message, or Notification API directly
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Time to practice', {
          body: 'Your practice reminder is here.',
          icon: '/favicon.svg',
          tag: `reminder-${reminder.id}`,
        });
      }
    }, delay);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}
