import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '@/app/router';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { initSyncListener, restoreFromServer, syncFullState } from '@/services/sync';
import { initAppLifecycle } from '@/services/appLifecycle';
import { initDayRollover } from '@/services/dayRollover';
import { initServiceWorkerUpdates } from '@/services/swUpdate';
import { ensureDatabasesReady, recoverFromInterruptedDemo } from '@/services/demoMode';
import { track } from '@/services/instrumentation';
import { APP_ENV } from '@/config/environment';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

initServiceWorkerUpdates();

if ('serviceWorker' in navigator) {
  // Delivery receipts the worker could not post (offline when the push
  // arrived) wait in its IndexedDB queue; ask it to retry now that we're up.
  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ type: 'FLUSH_RECEIPTS' });
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'REMINDER_DELIVERED') {
      track('reminder_delivered', {
        slot: event.data.slot,
        kind: event.data.kind,
      });
    }
    if (event.data?.type === 'REMINDER_TAPPED') {
      track('reminder_tapped', {
        slot: event.data.slot,
        kind: event.data.kind,
        minutes_since_delivered: event.data.minutes_since_delivered,
      });
    }
  });
}

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);
  const initAuth = useAuthStore((s) => s.init);

  useEffect(() => {
    async function init() {
      await ensureDatabasesReady();
      await recoverFromInterruptedDemo();
      // Reads the stored session; offline it falls back to the recorded owner
      // rather than the network, so this does not hold up first render.
      await Promise.all([hydrate(), initAuth()]);
      initDayRollover();
      initSyncListener();
      // Sync is network-bound and must never block first render — the app
      // works from local data and syncs in the background. Wait for the
      // session question to be fully answered so the first sync runs under
      // the right user.
      useAuthStore.getState().whenSettled()
        .then(() => initAppLifecycle())
        .then(async () => {
          // Before pushing local state up, pull down anything this device lost
          // to storage eviction — otherwise an evicted participant uploads an
          // empty database over a history that is still sitting in Supabase.
          const restored = await restoreFromServer();
          if (restored) await hydrate();
          await syncFullState();
        })
        .catch((err) => console.error('Background sync failed:', err));
    }
    init()
      .catch((err) => console.error('Bootstrap failed:', err))
      .finally(() => setReady(true));
  }, [hydrate, initAuth]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-page">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {APP_ENV === 'lab' && (
        <div className="fixed top-2 right-2 z-50 px-2 py-1 rounded bg-journey text-white text-meta tracking-wide pointer-events-none">
          LAB
        </div>
      )}
      <AppRouter />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
