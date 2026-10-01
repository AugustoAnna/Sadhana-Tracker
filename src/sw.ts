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

// Reminders are delivered by the send-reminders edge function over Web Push.
// There is deliberately no local setTimeout fallback here: the browser stops
// an idle worker within seconds, so a timer set for hours ahead silently
// never fires, and when both paths were active they double-notified.

// --- Delivery receipts --------------------------------------------------------
//
// Each push carries the id of its reminder_sends row. The worker reports back
// when the notification was shown and when it was tapped, so the server sees
// the full sent → delivered → tapped funnel even when the app is closed. The
// worker has no Supabase session (that lives in window localStorage), so it
// calls two security-definer RPCs with the public anon key; the random send
// id in the payload is what authorises the update.
//
// A receipt that cannot be sent right now (network dropped between the push
// arriving and our fetch) is queued in IndexedDB and retried on the next push
// or the next time the app opens.

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

type Receipt = { rpc: 'mark_reminder_delivered' | 'mark_reminder_tapped'; sendId: string };

const RECEIPT_DB = 'sadhana-sw';
const RECEIPT_STORE = 'pending_receipts';

function openReceiptDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RECEIPT_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(RECEIPT_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueReceipt(receipt: Receipt): Promise<void> {
  try {
    const db = await openReceiptDb();
    const tx = db.transaction(RECEIPT_STORE, 'readwrite');
    await idbRequest(tx.objectStore(RECEIPT_STORE).add(receipt));
    db.close();
  } catch {
    // IndexedDB unavailable — the receipt is lost, the notification still shows.
  }
}

async function postReceipt(receipt: Receipt): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${receipt.rpc}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_send_id: receipt.sendId }),
    });
    // 4xx means the row is gone or the id is malformed; retrying won't help.
    return res.ok || (res.status >= 400 && res.status < 500);
  } catch {
    return false;
  }
}

async function sendReceipt(receipt: Receipt): Promise<void> {
  if (!(await postReceipt(receipt))) await queueReceipt(receipt);
}

async function flushReceipts(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openReceiptDb();
  } catch {
    return;
  }
  try {
    const store = db.transaction(RECEIPT_STORE, 'readonly').objectStore(RECEIPT_STORE);
    const keys = await idbRequest(store.getAllKeys());
    const values = (await idbRequest(store.getAll())) as Receipt[];
    for (let i = 0; i < keys.length; i++) {
      if (!(await postReceipt(values[i]))) break;
      const tx = db.transaction(RECEIPT_STORE, 'readwrite');
      await idbRequest(tx.objectStore(RECEIPT_STORE).delete(keys[i]));
    }
  } finally {
    db.close();
  }
}

// --- Push -----------------------------------------------------------------------

type PushPayload = {
  title?: string;
  body?: string;
  tag?: string;
  slot?: number | null;
  kind?: string;
  practice_id?: string | null;
  send_id?: string;
  url?: string;
};

self.addEventListener('push', (event) => {
  const data: PushPayload = event.data?.json() ?? {};
  event.waitUntil((async () => {
    await self.registration.showNotification(data.title ?? 'Time to practice', {
      body: data.body ?? 'Your practice reminder is here.',
      icon: '/icons/icon-192.png',
      tag: data.tag ?? 'reminder-push',
      data: {
        slot: data.slot ?? null,
        kind: data.kind ?? 'generic',
        sendId: data.send_id ?? null,
        deliveredAt: Date.now(),
        url: typeof data.url === 'string' ? data.url : '/',
      },
    });

    if (data.send_id) {
      await sendReceipt({ rpc: 'mark_reminder_delivered', sendId: data.send_id });
    }
    await flushReceipts();

    // Keep the in-app `reminder_delivered` event for open windows — the
    // analysis scripts read it — but the receipt above is the source of truth.
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: 'REMINDER_DELIVERED',
        slot: data.slot ?? null,
        kind: data.kind ?? 'generic',
      });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as {
    deliveredAt?: number;
    slot?: number;
    kind?: string;
    sendId?: string | null;
    url?: string;
  };

  // The receipt must not delay opening the app, so it runs alongside it.
  const receipt = data?.sendId
    ? sendReceipt({ rpc: 'mark_reminder_tapped', sendId: data.sendId })
    : Promise.resolve();

  event.waitUntil(Promise.all([receipt, (async () => {
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
        // A window that was already open only gets focused, so the app has to
        // navigate there itself (a cold open already starts at this url).
        url: data?.url ?? null,
        minutes_since_delivered: data?.deliveredAt
          ? Math.round((Date.now() - data.deliveredAt) / 60000)
          : 0,
      });
    }
  })()]));
});

self.addEventListener('message', (event) => {
  // The app posts this on open so receipts stranded offline get another go.
  if (event.data?.type === 'FLUSH_RECEIPTS') {
    void flushReceipts();
  }
});
