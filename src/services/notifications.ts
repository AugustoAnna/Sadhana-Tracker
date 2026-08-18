import { getDb } from '@/db';
import type { Reminder } from '@/types';
import { subscribeToPush, syncPushSubscription, syncTimezone } from './push';

export async function scheduleReminders(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const reminders = await getDb().reminders.filter((r) => r.enabled).toArray();

  registration.active?.postMessage({
    type: 'SCHEDULE_REMINDERS',
    reminders: reminders.map(serializeReminder),
  });
}

function serializeReminder(r: Reminder) {
  return {
    id: r.id,
    kind: r.kind,
    slot: r.slot ?? null,
    practiceId: r.practiceId ?? null,
    time: r.time,
    enabled: r.enabled,
  };
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

export async function enablePushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;

  const subscription = await subscribeToPush(registration);
  if (subscription) {
    await syncPushSubscription(subscription);
  }

  await syncTimezone();
}
