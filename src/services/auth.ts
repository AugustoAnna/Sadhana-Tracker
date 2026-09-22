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
  return (await getAuthUser())?.id ?? null;
}

/** Current session's user id and email, or null. Same no-side-effects rule as getAuthUserId. */
export async function getAuthUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email ?? null } : null;
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

export type SignInMode = 'sign-in' | 'link';

/** Seconds Supabase asks us to wait, parsed from "…you can only request this after 42 seconds". */
export function retryAfterSeconds(message: string): number | null {
  const m = /after (\d+) seconds?/i.exec(message);
  return m ? Number(m[1]) : null;
}

/**
 * Email a code. In link mode the code attaches the email to the current
 * anonymous user. A new code always replaces the previous one for that
 * address; `retryAfter` is set when the server's per-address interval refused
 * the send, so the UI can count down exactly that long.
 */
export async function requestEmailCode(
  email: string,
  mode: SignInMode,
): Promise<{ error: string | null; retryAfter: number | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Sign-in is not configured.', retryAfter: null };

  const { error } = mode === 'link'
    ? await supabase.auth.updateUser({ email })
    : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

  if (!error) return { error: null, retryAfter: null };
  return { error: friendlyAuthError(error.message), retryAfter: retryAfterSeconds(error.message) };
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

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

/** The current session's tokens, so it can be put back if a later step fails. */
export async function captureSession(): Promise<SessionTokens | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  // getSession refreshes an expiring token first, so what we capture is valid
  // for the next hour — long enough for the merge call that follows.
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  return s ? { access_token: s.access_token, refresh_token: s.refresh_token } : null;
}

export async function restoreSession(tokens: SessionTokens): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.setSession(tokens).catch(() => undefined);
}

export const MERGE_FAILED_MESSAGE =
  'We couldn’t bring this phone’s history over, so nothing has changed. Please try again in a moment.';

/**
 * Ask the server to move the anonymous account's rows into the account that
 * is now signed in. Proof of ownership of both is the two tokens: the current
 * session (sent automatically) and the anonymous one passed in the body.
 */
export async function mergeAnonymousAccount(anonymousAccessToken: string): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Sign-in is not configured.' };
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'merge-anonymous-account',
    { body: { anonymous_access_token: anonymousAccessToken } },
  );
  if (error || !data?.ok) {
    console.error('merge-anonymous-account failed:', error?.message ?? data?.error);
    return { error: MERGE_FAILED_MESSAGE };
  }
  return { error: null };
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
  if (m.includes('security purposes')) {
    const wait = retryAfterSeconds(message);
    return wait
      ? `A code was sent recently — you can request another in ${wait}s.`
      : 'A code was sent recently — please wait a moment before requesting another.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  // "Failed to fetch" (Chrome), "Load failed" (Safari), "NetworkError" (Firefox).
  if (m.includes('fetch') || m.includes('network') || m.includes('load failed')) {
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

// ---------------------------------------------------------------------------
// Passkeys (WebAuthn). Face ID / Touch ID on Apple, fingerprint or screen lock
// elsewhere. Supabase runs the ceremony end to end; the browser never gives us
// biometric data, only a signature. A passkey is bound to the app's origin
// (the Relying Party configured in the Supabase dashboard), not to the email
// sending domain.
// ---------------------------------------------------------------------------

/** Which passkey this device registered, keyed so a different account signing in does not inherit it. */
const DEVICE_PASSKEY_KEY = 'sadhana_device_passkey';

export interface DevicePasskey {
  userId: string;
  email: string | null;
  passkeyId: string;
}

export function getDevicePasskey(): DevicePasskey | null {
  try {
    const raw = localStorage.getItem(DEVICE_PASSKEY_KEY);
    return raw ? (JSON.parse(raw) as DevicePasskey) : null;
  } catch {
    return null;
  }
}

export function setDevicePasskey(value: DevicePasskey | null) {
  if (value) localStorage.setItem(DEVICE_PASSKEY_KEY, JSON.stringify(value));
  else localStorage.removeItem(DEVICE_PASSKEY_KEY);
}

/** Can this browser do a platform (built-in biometric) passkey at all? */
export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false;
  if (!window.isSecureContext) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** What to call it in the UI. */
export function biometricLabel(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) return 'Face ID or Touch ID';
  if (/Android/i.test(ua)) return 'fingerprint or face unlock';
  return 'fingerprint, face unlock, or screen lock';
}

/** The person dismissed the system prompt — not an error worth showing. */
export function isPasskeyCancelled(error: unknown): boolean {
  const e = error as { code?: string; name?: string } | null;
  return e?.code === 'ERROR_CEREMONY_ABORTED' || e?.name === 'NotAllowedError' || e?.name === 'AbortError';
}

export function friendlyPasskeyError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  switch (e?.code) {
    case 'ERROR_INVALID_DOMAIN':
    case 'ERROR_INVALID_RP_ID':
      return 'Passkeys aren’t set up for this address yet. Please sign in with your email.';
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return 'This device already has a passkey for your account.';
    default:
      return friendlyAuthError(e?.message ?? 'Something went wrong. Please try again.');
  }
}

/** Register a passkey for the signed-in user and remember it for this device. */
export async function registerDevicePasskey(userId: string, email: string | null): Promise<{ error: string | null; cancelled: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Sign-in is not configured.', cancelled: false };
  const { data, error } = await supabase.auth.registerPasskey();
  if (error) {
    return { error: isPasskeyCancelled(error) ? null : friendlyPasskeyError(error), cancelled: isPasskeyCancelled(error) };
  }
  setDevicePasskey({ userId, email, passkeyId: data.id });
  // Best effort label so the account's passkey list reads sensibly.
  void supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceLabel() }).catch(() => undefined);
  return { error: null, cancelled: false };
}

/** Sign in with a passkey already on this device (or synced to it). */
export async function signInWithDevicePasskey(): Promise<{ session: Session | null; error: string | null; cancelled: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { session: null, error: 'Sign-in is not configured.', cancelled: false };
  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) {
    return { session: null, error: isPasskeyCancelled(error) ? null : friendlyPasskeyError(error), cancelled: isPasskeyCancelled(error) };
  }
  if (!data.session) return { session: null, error: 'Something went wrong. Please try again.', cancelled: false };
  setOwnerUserId(data.session.user.id);
  return { session: data.session, error: null, cancelled: false };
}

/** Remove this device's passkey from the account. */
export async function removeDevicePasskey(): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const device = getDevicePasskey();
  setDevicePasskey(null);
  if (!supabase || !device) return { error: null };
  const { error } = await supabase.auth.passkey.delete({ passkeyId: device.passkeyId });
  // A passkey already deleted elsewhere is fine — the local record is gone either way.
  return { error: error && !/not found|404/i.test(error.message) ? friendlyAuthError(error.message) : null };
}

function deviceLabel(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android phone';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'This device';
}
