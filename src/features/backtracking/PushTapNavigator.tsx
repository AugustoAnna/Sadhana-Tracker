import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { todayKey } from '@/utils/dates';

/**
 * Tapping the backtracking push while the app is already open only focuses
 * it; the service worker passes the notification's url along, and this sends
 * the app there. A cold open already starts at that url, so nothing to do.
 */
export function PushTapNavigator() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== 'REMINDER_TAPPED' || data.kind !== 'backtrack') return;
      // In-app paths only.
      if (typeof data.url !== 'string' || !data.url.startsWith('/') || data.url.startsWith('//')) return;
      // Already handled today (the cold-open window gets the message too).
      if (useAppStore.getState().pushEntryOn === todayKey()) return;
      // Never pull someone out of a practice in progress.
      if (pathnameRef.current === '/player') return;
      navigate(data.url, { replace: true });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
  return null;
}
