import { create } from 'zustand';
import { importDatabase, initDB, realDb } from '@/db';
import {
  captureSession,
  getDevicePasskey,
  getOwnerUserId,
  mergeAnonymousAccount,
  restoreSession,
  isPasskeySupported,
  onSignedOut,
  registerDevicePasskey,
  removeDevicePasskey,
  resolveAuthState,
  requestEmailCode,
  setDevicePasskey,
  setOwnerUserId,
  signInWithDevicePasskey,
  signOutSupabase,
  verifyEmailCode,
  type AuthState,
  type ResolvedAuth,
  type SignInMode,
} from '@/services/auth';
import type { Session } from '@supabase/supabase-js';
import {
  drainSyncQueue,
  ensureParticipantDetailed,
  resetParticipantCache,
  restoreFromServer,
  syncFullState,
} from '@/services/sync';
import { useAppStore } from './appStore';

interface AuthStore {
  state: AuthState;
  userId: string | null;
  email: string | null;
  /** This browser can do a built-in biometric passkey (resolved at boot). */
  passkeySupported: boolean;
  /** This device has a passkey registered for the signed-in account. */
  passkeyOnDevice: boolean;

  /**
   * Resolve the stored session once at boot and subscribe to server-side
   * sign-outs. Returns as soon as the app can render; `whenSettled()` resolves
   * once the network has actually answered.
   */
  init: () => Promise<void>;
  whenSettled: () => Promise<void>;
  /**
   * Email a code. The mode follows the session (anonymous → link the email to
   * it, otherwise a plain sign-in) unless overridden — the merge path sends a
   * sign-in code while still holding an anonymous session.
   */
  requestCode: (
    email: string,
    opts?: { mode?: SignInMode },
  ) => Promise<{ error: string | null; retryAfter: number | null }>;
  /**
   * Verify the code, then make the local database match the account: a
   * different owner's data is wiped, the account's history is pulled down,
   * the name the participant just typed is applied, and the app store
   * re-reads. Resolves once the app can route on real data.
   */
  verifyCode: (email: string, code: string, name: string) => Promise<string | null>;
  /**
   * The anonymous device's email already belongs to a permanent account
   * (signed in elsewhere first). Sign into that account with the code and have
   * the server move this device's anonymous history onto it, so nothing is
   * lost and there is one participant. If the merge fails the anonymous
   * session is put back untouched.
   */
  verifyCodeAndMerge: (email: string, code: string, name: string) => Promise<string | null>;
  /**
   * Sign in with a passkey on (or synced to) this device. Same completion as a
   * code, minus the typed name — a returning account already has one on the
   * server; if not, the landing route sends them to the name-only step.
   * Returns null on success, a message on failure, or 'cancelled'.
   */
  signInWithPasskey: () => Promise<string | null | 'cancelled'>;
  /** Register a passkey for the signed-in account on this device. */
  enablePasskey: () => Promise<string | null | 'cancelled'>;
  disablePasskey: () => Promise<string | null>;
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

function passkeyOnDeviceFor(userId: string | null): boolean {
  const device = getDevicePasskey();
  return !!device && !!userId && device.userId === userId;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  state: 'unknown',
  userId: null,
  email: null,
  passkeySupported: false,
  passkeyOnDevice: false,

  init: async () => {
    const startEpoch = epoch;
    void isPasskeySupported().then((passkeySupported) => set({ passkeySupported }));
    // A thrown error must not leave the app stuck on 'unknown' (every guard
    // renders nothing in that state) — degrade to the local guess instead.
    const resolving = resolveAuthState().catch((err): ResolvedAuth => {
      console.error('Auth resolution failed:', err);
      return localGuess();
    });

    settled = resolving.then((resolved) => {
      if (epoch === startEpoch) set({ ...resolved, passkeyOnDevice: passkeyOnDeviceFor(resolved.userId) });
    });

    // A token refresh over a poor connection can hang; render with the best
    // local guess and let the real answer replace it.
    const fallback = new Promise<ResolvedAuth>((resolve) =>
      setTimeout(() => resolve(localGuess()), SESSION_WAIT_MS),
    );
    const first = await Promise.race([resolving, fallback]);
    if (epoch === startEpoch) set({ ...first, passkeyOnDevice: passkeyOnDeviceFor(first.userId) });

    onSignedOut(() => {
      // Our own signOut() already moved state; this catches revocations.
      if (get().state === 'signed-out') return;
      epoch += 1;
      setOwnerUserId(null);
      set({ state: 'signed-out', userId: null, email: null, passkeyOnDevice: false });
    });
  },

  whenSettled: () => settled,

  requestCode: async (email, opts) => {
    const mode: SignInMode = opts?.mode ?? (get().state === 'anonymous' ? 'link' : 'sign-in');
    return requestEmailCode(email, mode);
  },

  verifyCodeAndMerge: async (email, code, name) => {
    const anonymous = await captureSession();
    if (!anonymous) return 'Your previous session is gone — sign in with your email instead.';
    const previousOwner = getOwnerUserId();

    const { session, error } = await verifyEmailCode(email, code, 'sign-in');
    if (error || !session) return error ?? 'Something went wrong. Please try again.';

    const merge = await mergeAnonymousAccount(anonymous.access_token);
    if (merge.error) {
      // Back to exactly where they were: anonymous session, local history intact.
      await restoreSession(anonymous);
      setOwnerUserId(previousOwner);
      return merge.error;
    }

    // Rows now live under the permanent participant with the same ids, so the
    // usual restore simply reconciles; a wipe (different previous owner) is
    // harmless because everything is on the server.
    await completeSignIn(session, { mode: 'sign-in', previousOwner, name, fallbackEmail: email });
    return null;
  },

  verifyCode: async (email, code, name) => {
    const mode: SignInMode = get().state === 'anonymous' ? 'link' : 'sign-in';
    const previousOwner = getOwnerUserId();
    const { session, error } = await verifyEmailCode(email, code, mode);
    if (error || !session) return error ?? 'Something went wrong. Please try again.';
    await completeSignIn(session, { mode, previousOwner, name, fallbackEmail: email });
    return null;
  },

  signInWithPasskey: async () => {
    const previousOwner = getOwnerUserId();
    const { session, error, cancelled } = await signInWithDevicePasskey();
    if (cancelled) return 'cancelled';
    if (error || !session) return error ?? 'Something went wrong. Please try again.';
    await completeSignIn(session, { mode: 'sign-in', previousOwner, name: '', fallbackEmail: null });
    return null;
  },

  enablePasskey: async () => {
    const { userId } = get();
    if (!userId) return 'Please sign in first.';
    const { error, cancelled } = await registerDevicePasskey(userId);
    if (cancelled) return 'cancelled';
    if (error) return error;
    set({ passkeyOnDevice: true });
    return null;
  },

  disablePasskey: async () => {
    const { error } = await removeDevicePasskey();
    set({ passkeyOnDevice: false });
    return error;
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
    // The passkey stays in the account (and in iCloud/Google sync) — that is
    // the point; only the "already set up here" note is per sign-in.
    set({ state: 'signed-out', userId: null, email: null, passkeyOnDevice: false });
    await useAppStore.getState().hydrate();
  },
}));

/**
 * Everything that has to happen once Supabase has handed us a session,
 * whichever door it came through (code or passkey).
 */
async function completeSignIn(
  session: Session,
  opts: { mode: SignInMode; previousOwner: string | null; name: string; fallbackEmail: string | null },
) {
  epoch += 1;
  const userId = session.user.id;
  resetParticipantCache();
  if (opts.mode === 'sign-in' && opts.previousOwner && opts.previousOwner !== userId) {
    // Someone else's practice history is on this device. It belongs to their
    // account server-side, so it is safe to drop here — including any passkey
    // note they left, which never belonged to this account.
    await resetLocalDatabase();
    setDevicePasskey(null);
  }

  const app = useAppStore.getState();
  let knownParticipant = false;

  if (opts.mode === 'sign-in') {
    // Always restore under the verified user id before routing. Sign-out wipes
    // local data, so without this a returning login looks like first setup.
    // Link mode keeps the current device history, so it skips restore.
    try {
      const restored = await restoreFromServer(userId);
      knownParticipant = restored.participantFound;
      await app.hydrate();
    } catch (err) {
      // OTP/passkey verification already established the session. A failed
      // restore must not block sign-in completion.
      console.error('Post-sign-in restore failed:', err);
      await app.hydrate().catch(() => undefined);
    }
  }

  // The name they just typed wins over whatever the server or the old local
  // profile held ('Anonymous' placeholders included). setName also queues the
  // participant row update, so the first sync carries the real name.
  if (opts.name && opts.name !== useAppStore.getState().profile?.name) {
    await app.setName(opts.name);
  }

  // Always ensure a participants row exists after successful auth.
  // Known = a row with this email (or auth user) already existed.
  // New = row was just created → still show Add Practices.
  const profile = useAppStore.getState().profile;
  if (profile) {
    try {
      const ensured = await ensureParticipantDetailed(profile);
      if (ensured.id && !ensured.created) knownParticipant = true;
    } catch (err) {
      console.error('Failed to ensure participant after sign-in:', err);
    }
  }

  // Email already in participants → skip Add Practices.
  // Brand-new email/row → keep first-time setup.
  const current = useAppStore.getState();
  if (
    knownParticipant
    && current.profile
    && !current.profile.onboardingComplete
  ) {
    await app.completePotentialOnboarding();
  } else if (
    current.instances.length > 0
    && current.profile
    && !current.profile.onboardingComplete
  ) {
    await app.completePotentialOnboarding();
  }

  void syncFullState();

  useAuthStore.setState({
    state: 'signed-in',
    userId,
    email: session.user.email ?? opts.fallbackEmail,
    passkeyOnDevice: passkeyOnDeviceFor(userId),
  });
}
