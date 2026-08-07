import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '@/app/router';
import { initDB } from '@/db';
import { useAppStore } from '@/stores/appStore';
import { initSyncListener, syncFullState } from '@/services/sync';
import './index.css';

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    async function init() {
      await initDB();
      await hydrate();
      initSyncListener();
      await syncFullState();
      setReady(true);
    }
    init();
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-cream">
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
