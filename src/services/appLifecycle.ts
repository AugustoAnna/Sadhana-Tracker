import { updateParticipantFields } from './sync';
import { track } from './instrumentation';
import { getNotificationPermission } from './notifications';
import { useAuthStore } from '@/stores/authStore';

let lastHiddenAt: number | null = null;
let appOpenTracked = false;

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

/**
 * Record how this open happened (platform, installed, notification permission)
 * on the participant row and as an `app_open` event. Needs a session (anonymous
 * or email): without one there is no row to update and the event would just
 * describe someone looking at the sign-in screen.
 */
export async function reportAppOpen(): Promise<void> {
  const { state } = useAuthStore.getState();
  if (state === 'signed-out' || state === 'unknown') return;
  const standalone = isStandalone();
  const permission = getNotificationPermission();
  await updateParticipantFields({
    platform: detectPlatform(),
    ...(standalone ? { installed_standalone: true } : {}),
    notification_permission: permission === 'unsupported' ? 'default' : permission,
  });
  await track('app_open', { standalone, platform: detectPlatform() });
}

export async function initAppLifecycle(): Promise<void> {
  const { state } = useAuthStore.getState();
  if (!appOpenTracked && state !== 'signed-out' && state !== 'unknown') {
    appOpenTracked = true;
    await reportAppOpen();
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      lastHiddenAt = Date.now();
      return;
    }
    if (lastHiddenAt && Date.now() - lastHiddenAt > 30 * 60 * 1000) {
      await reportAppOpen();
    }
  });
}
