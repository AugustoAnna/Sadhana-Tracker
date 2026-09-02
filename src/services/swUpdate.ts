import { useAppStore } from '@/stores/appStore';

/** Let the finish flow settle before the page goes away under the user. */
const RELOAD_DELAY_MS = 1000;

function isPracticing(): boolean {
  return useAppStore.getState().playerSession !== null;
}

/**
 * Reload so this page picks up a worker that has just taken control — but never
 * out from under a running practice. The worker activates the moment it finishes
 * precaching, which routinely lands seconds into a session the user has only
 * just started, and a reload there loses the practice entirely.
 */
export function reloadWhenPracticeEnds(): void {
  if (!isPracticing()) {
    window.location.reload();
    return;
  }

  const unsubscribe = useAppStore.subscribe((state) => {
    if (state.playerSession !== null) return;
    unsubscribe();
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
  });
}

/**
 * An updated worker leaves this page running the previous bundle, so reload once
 * it takes over. Skipped on first-ever install (no prior controller): the page
 * already came from the network.
 */
export function initServiceWorkerUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    reloadWhenPracticeEnds();
  });
}
