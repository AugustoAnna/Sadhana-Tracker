import { ensureAnonymousAuth } from './auth';
import { updateParticipantFields } from './sync';
import { track } from './instrumentation';
import { getNotificationPermission } from './notifications';

let lastHiddenAt: number | null = null;
let appOpenTracked = false;

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
}

// The edge function skips any reminder whose participant has no timezone, so
// it is refreshed on every open rather than only when a device subscribes.
function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export async function initAppLifecycle(): Promise<void> {
  await ensureAnonymousAuth();

  const reportOpen = async () => {
    const standalone = isStandalone();
    const permission = getNotificationPermission();
    await updateParticipantFields({
      platform: detectPlatform(),
      timezone: detectTimezone(),
      ...(standalone ? { installed_standalone: true } : {}),
      notification_permission: permission === 'unsupported' ? 'default' : permission,
    });
    await track('app_open', { standalone, platform: detectPlatform() });
  };

  if (!appOpenTracked) {
    appOpenTracked = true;
    await reportOpen();
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      lastHiddenAt = Date.now();
      return;
    }
    if (lastHiddenAt && Date.now() - lastHiddenAt > 30 * 60 * 1000) {
      await reportOpen();
    }
  });
}
