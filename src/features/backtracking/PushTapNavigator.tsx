import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

/**
 * Tapping the backtracking push while the app is already open only focuses
 * it; the service worker passes the notification's url along, and this sends
 * the app there. A cold open already starts at that url, so nothing to do.
 */
export function PushTapNavigator() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== 'REMINDER_TAPPED' || data.kind !== 'backtrack') return;
      // In-app paths only.
      if (typeof data.url !== 'string' || !data.url.startsWith('/') || data.url.startsWith('//')) return;
      // Already handled this load (the cold-open window gets the message too).
      if (useAppStore.getState().enteredViaPush) return;
      navigate(data.url, { replace: true });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
  return null;
}
