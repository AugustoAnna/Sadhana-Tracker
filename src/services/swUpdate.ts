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
 *
 * While the reload is held, this tab keeps running the old JS bundle even
 * though the new worker is now the one serving it. That's fine only because
 * the build is a single chunk (see vite.config.ts) — the old bundle has
 * nothing to lazy-load, so there's no lazy route chunk it could ask the new
 * precache for and get a 404. If the build is ever split into multiple
 * chunks, an old tab held open across a deploy could fail exactly that way,
 * and this deferred-reload approach would need a different fallback (e.g.
 * detecting the failed chunk load and forcing a reload then).
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
