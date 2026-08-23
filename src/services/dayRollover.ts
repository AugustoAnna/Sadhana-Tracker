import { useAppStore } from '@/stores/appStore';

let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function refresh(): void {
  void useAppStore.getState().refreshDay();
}

function msUntilNextDay(): number {
  const now = new Date();
  // A few seconds past midnight, so the clock has definitely crossed over
  // (and to absorb small timer drift).
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0);
  return next.getTime() - now.getTime();
}

function scheduleMidnight(): void {
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    refresh();
    scheduleMidnight();
  }, msUntilNextDay());
}

/**
 * Keeps the store's notion of "today" in step with the wall clock.
 *
 * The app is normally left open in the background overnight — installed PWAs
 * are resumed rather than reloaded — so nothing re-reads the date and today's
 * practices keep rendering against yesterday's day key. Three foreground
 * signals are used because their coverage differs across browsers: iOS
 * standalone in particular resumes without a reliable visibilitychange.
 * The timer covers the app being left open across midnight.
 */
export function initDayRollover(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  scheduleMidnight();
}
