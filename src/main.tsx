import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '@/app/router';
import { useAppStore } from '@/stores/appStore';
import { initSyncListener, restoreFromServer, syncFullState } from '@/services/sync';
import { initAppLifecycle } from '@/services/appLifecycle';
import { initDayRollover } from '@/services/dayRollover';
import { initServiceWorkerUpdates } from '@/services/swUpdate';
import { ensureDatabasesReady, recoverFromInterruptedDemo } from '@/services/demoMode';
import { track } from '@/services/instrumentation';
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

  useEffect(() => {
    async function init() {
      await ensureDatabasesReady();
      await recoverFromInterruptedDemo();
      await hydrate();
      initDayRollover();
      initSyncListener();
      // Auth and sync are network-bound and must never block first render —
      // the app works from local data and syncs in the background.
      initAppLifecycle()
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
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-page">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AppRouter />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
