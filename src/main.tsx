import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '@/app/router';
import { useAppStore } from '@/stores/appStore';
import { initSyncListener, syncFullState } from '@/services/sync';
import { ensureDatabasesReady, recoverFromInterruptedDemo } from '@/services/demoMode';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    async function init() {
      await ensureDatabasesReady();
      const recovered = await recoverFromInterruptedDemo();
      await hydrate();
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
