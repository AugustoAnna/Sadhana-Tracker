import { getDb } from '@/db';
import type { Reminder } from '@/types';
import { subscribeToPush, syncPushSubscription, syncTimezone, isPushSubscribed } from './push';

export async function scheduleReminders(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;

  // When a push subscription is active the server delivers reminders, and
  // local SW timers would duplicate every notification. Keep timers only as
  // a fallback when push is unavailable (demo mode, missing VAPID key).
  if (await isPushSubscribed(registration)) {
    registration.active?.postMessage({ type: 'SCHEDULE_REMINDERS', reminders: [] });
    return;
  }

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
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;

  const subscription = await subscribeToPush(registration);
  if (subscription) {
    await syncPushSubscription(subscription);
    // The permission-grant flow schedules timers before the subscription
    // exists — re-run now that it does, so the fallback timers are cleared.
    await scheduleReminders();
  }

  await syncTimezone();
}
