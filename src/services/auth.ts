import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

/**
 * Auth user id the local database belongs to. Set on a successful sign-in,
 * cleared on sign-out. Its presence is what "signed in" means to the UI —
 * a stored Supabase session can be unreadable while offline (expired access
 * token, refresh unreachable) and that must not bounce a participant to the
 * sign-in screen on a flight.
 */
const OWNER_KEY = 'sadhana_owner_user_id';

export type AuthState =
  /** Not resolved yet — first render must wait. */
  | 'unknown'
  /** No usable session; needs email sign-in. */
  | 'signed-out'
  /** Pre-email-login participant. Same user id, needs an email attached. */
  | 'anonymous'
  | 'signed-in';

export interface ResolvedAuth {
  state: AuthState;
  userId: string | null;
  email: string | null;
}

export function getOwnerUserId(): string | null {
  return localStorage.getItem(OWNER_KEY);
}

export function setOwnerUserId(id: string | null) {
  if (id) localStorage.setItem(OWNER_KEY, id);
  else localStorage.removeItem(OWNER_KEY);
}

/**
 * Current session's user id, or null. Never creates a session — that only
 * happens through the sign-in screen. Sync code calls this and simply waits
 * when it gets null.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Work out where the participant stands on launch. Offline with an expired
 * access token, `getSession()` returns no session and a retryable fetch error
 * while leaving the refresh token in storage — treat that as still signed in
 * so the app opens on local data; the SIGNED_OUT event handles real revocation.
 */
export async function resolveAuthState(): Promise<ResolvedAuth> {
  const supabase = getSupabase();
  if (!supabase) return { state: 'signed-out', userId: null, email: null };

  const { data, error } = await supabase.auth.getSession();
  const session = data.session;

  if (session) {
    if (session.user.is_anonymous) {
      return { state: 'anonymous', userId: session.user.id, email: null };
    }
    // Devices signed in before OWNER_KEY existed, or after a cleared localStorage
    // that somehow kept the session — record the owner so later checks agree.
    setOwnerUserId(session.user.id);
    return { state: 'signed-in', userId: session.user.id, email: session.user.email ?? null };
  }

  const owner = getOwnerUserId();
  if (owner && error && isAuthRetryableFetchError(error)) {
    return { state: 'signed-in', userId: owner, email: null };
  }

  setOwnerUserId(null);
  return { state: 'signed-out', userId: null, email: null };
}

/**
 * Create an anonymous session for a device that has none. Only the auth store
 * calls this, and only while REQUIRE_EMAIL_SIGN_IN is off.
 */
export async function startAnonymousSession(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    console.error('Anonymous auth failed:', error?.message);
    return null;
  }
  return data.user.id;
}

export type SignInMode = 'sign-in' | 'link';

/** Email a 6-digit code. In link mode the code attaches the email to the current anonymous user. */
export async function requestEmailCode(email: string, mode: SignInMode): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Sign-in is not configured.' };

  const { error } = mode === 'link'
    ? await supabase.auth.updateUser({ email })
    : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

  return { error: error ? friendlyAuthError(error.message) : null };
}

export async function verifyEmailCode(
  email: string,
  code: string,
  mode: SignInMode,
): Promise<{ session: Session | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { session: null, error: 'Sign-in is not configured.' };

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: mode === 'link' ? 'email_change' : 'email',
  });
  if (error) return { session: null, error: friendlyAuthError(error.message) };

  // Linking keeps the session object; verifyOtp may hand back null there.
  const session = data.session ?? (await supabase.auth.getSession()).data.session;
  if (!session) return { session: null, error: 'Something went wrong. Please try again.' };

  setOwnerUserId(session.user.id);
  return { session, error: null };
}

export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  setOwnerUserId(null);
  if (!supabase) return;
  // Local scope: only this device. Failing to reach the server must not keep
  // the user signed in on a device they are handing over.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

/** Fires when Supabase drops the session (sign-out, revoked or rejected refresh token). */
export function onSignedOut(handler: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') handler();
  });
  return () => data.subscription.unsubscribe();
}

/** Linking fails with this when the address already belongs to a permanent account. */
export const EMAIL_TAKEN_MESSAGE = 'That email is already in use on another account.';

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('expired') || (m.includes('invalid') && m.includes('token'))) {
    return 'That code didn’t work. Check it and try again, or request a new one.';
  }
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to')) {
    return 'You’re offline. Connect to the internet to sign in.';
  }
  if (m.includes('already') && (m.includes('registered') || m.includes('exists'))) {
    return EMAIL_TAKEN_MESSAGE;
  }
  if (m.includes('not authorized')) {
    return 'That email address isn’t allowed yet. Please contact the study team.';
  }
  return message;
}
