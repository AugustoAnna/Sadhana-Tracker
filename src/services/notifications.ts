import { subscribeToPush, syncPushSubscription, syncTimezone } from './push';

// Reminders are delivered only by the send-reminders edge function over Web
// Push. The former service-worker setTimeout fallback is gone: browsers stop
// an idle worker within seconds, so its hours-long timers never fired, and
// when they did the participant got the same reminder twice.

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
  }

  // The edge function cannot send without a timezone, so it is synced here
  // (and on every app open) rather than only alongside the subscription.
  await syncTimezone();
}
