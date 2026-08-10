import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '@/app/router';
import { useAppStore } from '@/stores/appStore';
import { initSyncListener, syncFullState } from '@/services/sync';
import { initAppLifecycle } from '@/services/appLifecycle';
import { ensureDatabasesReady, recoverFromInterruptedDemo } from '@/services/demoMode';
import { track } from '@/services/instrumentation';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

if ('serviceWorker' in navigator) {
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
      const recovered = await recoverFromInterruptedDemo();
      await hydrate();
      await initAppLifecycle();
      if (!recovered) {
        initSyncListener();
        await syncFullState();
      }
      setReady(true);
    }
    init();
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
