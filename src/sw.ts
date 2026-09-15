/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
// injectManifest mode does not add skipWaiting for us. Without it an
// updated worker stays waiting until every tab closes, so open clients
// keep being served the previous precached bundle indefinitely.
self.skipWaiting();
clientsClaim();

type ScheduledReminder = {
  id: number | string;
  kind: string;
  slot: number | null;
  practiceId: string | null;
  time: string;
  enabled?: boolean;
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearAllTimers() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

function scheduleOne(reminder: ScheduledReminder) {
  const [hours, minutes] = reminder.time.split(':').map(Number);
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);
  const delay = scheduled.getTime() - now.getTime();
  const key = String(reminder.id);

  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  const isPresence = reminder.practiceId === 'sadhguru-presence';
  const title = isPresence ? 'Presence time' : 'Time to practice';
  const body = isPresence
    ? 'Presence time is starting soon.'
    : 'Your practice reminder is here.';

  const timer = setTimeout(async () => {
    if (Notification.permission !== 'granted') return;
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: `reminder-${key}`,
      data: { slot: reminder.slot, kind: reminder.kind, deliveredAt: Date.now(), url: '/' },
    });
    scheduleOne(reminder);
  }, delay);

  timers.set(key, timer);
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_REMINDERS') {
    clearAllTimers();
    const reminders = (event.data.reminders ?? []) as ScheduledReminder[];
    for (const r of reminders) {
      if (r.enabled !== false) scheduleOne(r);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as {
    deliveredAt?: number;
    slot?: number;
    kind?: string;
    url?: string;
  };

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appClient = allClients.find((client) => client.url.startsWith(self.location.origin));
    const targetClient = appClient
      ? await appClient.focus()
      : await self.clients.openWindow(data?.url ?? '/');

    if (targetClient) {
      targetClient.postMessage({
        type: 'REMINDER_TAPPED',
        slot: data?.slot ?? null,
        kind: data?.kind ?? 'generic',
        minutes_since_delivered: data?.deliveredAt
          ? Math.round((Date.now() - data.deliveredAt) / 60000)
          : 0,
      });
    }
  })());
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Time to practice', {
      body: data.body ?? 'Your practice reminder is here.',
      icon: '/icons/icon-192.png',
      tag: data.tag ?? 'reminder-push',
      data: {
        slot: data.slot ?? null,
        kind: data.kind ?? 'generic',
        deliveredAt: Date.now(),
        url: typeof data.url === 'string' ? data.url : '/',
      },
    }).then(() => {
      self.clients.matchAll().then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'REMINDER_DELIVERED',
            slot: data.slot ?? null,
            kind: data.kind ?? 'generic',
          });
        }
      });
    }),
  );
});
