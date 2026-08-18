import { getDb, isDemoDatabaseActive } from '@/db';
import { queueSync } from './sync';
import { isSupabaseConfigured } from './supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getVapidPublicKey(): string | null {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY || null;
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  const vapidKey = getVapidPublicKey();
  if (!vapidKey) {
    console.warn('VITE_VAPID_PUBLIC_KEY not set — skipping push subscription');
    return null;
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  return subscription.unsubscribe();
}

export async function syncPushSubscription(
  subscription: PushSubscription,
): Promise<void> {
  if (isDemoDatabaseActive() || !isSupabaseConfigured()) return;

  const db = getDb();
  const profile = await db.profile.get('profile');
  if (!profile) return;

  const subJson = subscription.toJSON();
  const p256dh = subJson.keys?.p256dh;
  const auth = subJson.keys?.auth;
  if (!subJson.endpoint || !p256dh || !auth) return;

  await queueSync({
    table: 'push_subscriptions',
    operation: 'insert',
    payload: {
      endpoint: subJson.endpoint,
      p256dh,
      auth,
    },
  });
}

export async function syncTimezone(): Promise<void> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      await import('./sync').then((m) =>
        m.updateParticipantFields({ timezone: tz }),
      );
    }
  } catch {
    // Intl not available — ignore
  }
}

export async function isPushSubscribed(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}
