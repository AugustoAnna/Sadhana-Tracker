import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '@/app/router';
import { useAppStore } from '@/stores/appStore';
import { initSyncListener, restoreFromServer, syncFullState } from '@/services/sync';
import { initAppLifecycle } from '@/services/appLifecycle';
import { initDayRollover } from '@/services/dayRollover';
import { ensureDatabasesReady, recoverFromInterruptedDemo } from '@/services/demoMode';
import { track } from '@/services/instrumentation';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

if ('serviceWorker' in navigator) {
  // When an updated worker takes control mid-session this page is still
  // running the previous bundle — reload once so it picks up the new one.
  // Skipped on first-ever install (no prior controller): the page already
  // came from the network.
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    window.location.reload();
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
