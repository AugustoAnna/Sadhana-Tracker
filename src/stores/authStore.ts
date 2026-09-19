import { create } from 'zustand';
import { importDatabase, initDB, realDb } from '@/db';
import { REQUIRE_EMAIL_SIGN_IN } from '@/config/environment';
import {
  getOwnerUserId,
  onSignedOut,
  resolveAuthState,
  requestEmailCode,
  setOwnerUserId,
  signOutSupabase,
  startAnonymousSession,
  verifyEmailCode,
  type AuthState,
  type ResolvedAuth,
  type SignInMode,
} from '@/services/auth';
import { drainSyncQueue, resetParticipantCache, restoreFromServer, syncFullState } from '@/services/sync';
import { useAppStore } from './appStore';

interface AuthStore {
  state: AuthState;
  userId: string | null;
  email: string | null;

  /**
   * Resolve the stored session once at boot and subscribe to server-side
   * sign-outs. Returns as soon as the app can render; `whenSettled()` is the
   * full answer (including an anonymous sign-in on a fresh device).
   */
  init: () => Promise<void>;
  whenSettled: () => Promise<void>;
  /**
   * With anonymous sessions allowed, a device that came up offline has no
   * session at all. Called when connectivity returns so sync can start.
   */
  ensureSession: () => Promise<void>;
  requestCode: (email: string) => Promise<string | null>;
  /**
   * Verify the code, then make the local database match the account: a
   * different owner's data is wiped, the account's history is pulled down,
   * and the app store re-reads. Resolves once the app can route on real data.
   */
  verifyCode: (email: string, code: string) => Promise<string | null>;
  /**
   * Drop the session on this device and wipe the local copy. With anonymous
   * sessions allowed the device then gets a fresh anonymous session, so the
   * app stays usable; pass `thenAnonymous: false` when a real sign-in follows.
   */
  signOut: (opts?: { thenAnonymous?: boolean }) => Promise<void>;
}

/** How long boot waits on the network before rendering with what it knows. */
const SESSION_WAIT_MS = 2500;

const EMPTY_SNAPSHOT = {
  profile: undefined,
  practiceInstances: [],
  practiceLogs: [],
  reminders: [],
  savedSessions: [],
  syncQueue: [],
  appMeta: undefined,
};

async function resetLocalDatabase() {
  // Clear every table (importDatabase clears before writing) and re-seed the
  // fixed profile/meta/reminder rows so the app boots exactly like a fresh install.
  await importDatabase(realDb, EMPTY_SNAPSHOT);
  await initDB(realDb);
}

// Bumped by every explicit sign-in / sign-out so a slow boot-time resolution
// that lands afterwards cannot overwrite what the user just did.
let epoch = 0;
let settled: Promise<void> = Promise.resolve();

export const useAuthStore = create<AuthStore>((set, get) => ({
  state: 'unknown',
  userId: null,
  email: null,

  init: async () => {
    const startEpoch = epoch;
    const resolving = (async (): Promise<ResolvedAuth> => {
      const resolved = await resolveAuthState();
      if (resolved.state === 'signed-out' && !REQUIRE_EMAIL_SIGN_IN) {
        const userId = await startAnonymousSession();
        if (userId) return { state: 'anonymous', userId, email: null };
      }
      return resolved;
    })();

    settled = resolving.then((resolved) => {
      if (epoch === startEpoch) set(resolved);
    });

    // A refresh or anonymous sign-in over a poor connection can hang; render
    // with the best local guess and let the real answer replace it.
    const owner = getOwnerUserId();
    const fallback = new Promise<ResolvedAuth>((resolve) =>
      setTimeout(() => resolve(
        owner
          ? { state: 'signed-in', userId: owner, email: null }
          : { state: 'signed-out', userId: null, email: null },
      ), SESSION_WAIT_MS),
    );
    const first = await Promise.race([resolving, fallback]);
    if (epoch === startEpoch) set(first);

    onSignedOut(() => {
      // Our own signOut() already moved state; this catches revocations.
      if (get().state === 'signed-out') return;
      epoch += 1;
      setOwnerUserId(null);
      set({ state: 'signed-out', userId: null, email: null });
    });
  },

  whenSettled: () => settled,

  ensureSession: async () => {
    if (REQUIRE_EMAIL_SIGN_IN || get().state !== 'signed-out' || !navigator.onLine) return;
    const startEpoch = epoch;
    const userId = await startAnonymousSession();
    if (userId && epoch === startEpoch && get().state === 'signed-out') {
      set({ state: 'anonymous', userId, email: null });
      void drainSyncQueue();
    }
  },

  requestCode: async (email) => {
    const mode: SignInMode = get().state === 'anonymous' ? 'link' : 'sign-in';
    const { error } = await requestEmailCode(email, mode);
    return error;
  },

  verifyCode: async (email, code) => {
    const mode: SignInMode = get().state === 'anonymous' ? 'link' : 'sign-in';
    const previousOwner = getOwnerUserId();
    const { session, error } = await verifyEmailCode(email, code, mode);
    if (error || !session) return error ?? 'Something went wrong. Please try again.';

    epoch += 1;
    const userId = session.user.id;
    resetParticipantCache();
    if (mode === 'sign-in' && previousOwner && previousOwner !== userId) {
      // Someone else's practice history is on this device. It belongs to their
      // account server-side, so it is safe to drop here.
      await resetLocalDatabase();
    }

    set({ state: 'signed-in', userId, email: session.user.email ?? email });

    if (mode === 'sign-in') {
      // Returning participant on a new (or wiped) device: hydrate from Supabase
      // before the landing route decides between onboarding and home.
      await restoreFromServer();
      await useAppStore.getState().hydrate();
    }
    void syncFullState();
    return null;
  },

  signOut: async ({ thenAnonymous = !REQUIRE_EMAIL_SIGN_IN } = {}) => {
    // Best effort: push anything still queued under this account before the
    // session goes. Offline, it stays in the queue and is wiped with the rest.
    try {
      await drainSyncQueue();
    } catch {
      // nothing to do — the wipe below is deliberate
    }
    epoch += 1;
    await signOutSupabase();
    resetParticipantCache();
    await resetLocalDatabase();
    set({ state: 'signed-out', userId: null, email: null });
    await useAppStore.getState().hydrate();
    if (thenAnonymous) await get().ensureSession();
  },
}));
