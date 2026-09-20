import { create } from 'zustand';
import { importDatabase, initDB, realDb } from '@/db';
import {
  getOwnerUserId,
  onSignedOut,
  resolveAuthState,
  requestEmailCode,
  setOwnerUserId,
  signOutSupabase,
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
   * sign-outs. Returns as soon as the app can render; `whenSettled()` resolves
   * once the network has actually answered.
   */
  init: () => Promise<void>;
  whenSettled: () => Promise<void>;
  requestCode: (email: string) => Promise<string | null>;
  /**
   * Verify the code, then make the local database match the account: a
   * different owner's data is wiped, the account's history is pulled down,
   * the name the participant just typed is applied, and the app store
   * re-reads. Resolves once the app can route on real data.
   */
  verifyCode: (email: string, code: string, name: string) => Promise<string | null>;
  /** Drop the session on this device and wipe the local copy. */
  signOut: () => Promise<void>;
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

/** What boot renders while (or if) the network never answers. */
function localGuess(): ResolvedAuth {
  const owner = getOwnerUserId();
  return owner
    ? { state: 'signed-in', userId: owner, email: null }
    : { state: 'signed-out', userId: null, email: null };
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
    // A thrown error must not leave the app stuck on 'unknown' (every guard
    // renders nothing in that state) — degrade to the local guess instead.
    const resolving = resolveAuthState().catch((err): ResolvedAuth => {
      console.error('Auth resolution failed:', err);
      return localGuess();
    });

    settled = resolving.then((resolved) => {
      if (epoch === startEpoch) set(resolved);
    });

    // A token refresh over a poor connection can hang; render with the best
    // local guess and let the real answer replace it.
    const fallback = new Promise<ResolvedAuth>((resolve) =>
      setTimeout(() => resolve(localGuess()), SESSION_WAIT_MS),
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

  requestCode: async (email) => {
    const mode: SignInMode = get().state === 'anonymous' ? 'link' : 'sign-in';
    const { error } = await requestEmailCode(email, mode);
    return error;
  },

  verifyCode: async (email, code, name) => {
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

    const app = useAppStore.getState();
    if (mode === 'sign-in') {
      // Returning participant on a new (or wiped) device: hydrate from Supabase
      // before the landing route decides between onboarding and home.
      await restoreFromServer();
      await app.hydrate();
    }
    // The name they just typed wins over whatever the server or the old local
    // profile held ('Anonymous' placeholders included). setName also queues the
    // participant row update, so the first sync carries the real name.
    if (name && name !== useAppStore.getState().profile?.name) {
      await app.setName(name);
    }
    void syncFullState();
    return null;
  },

  signOut: async () => {
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
  },
}));
