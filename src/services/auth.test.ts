import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthRetryableFetchError, AuthApiError } from '@supabase/supabase-js';

// Node ships its own (unconfigured) `localStorage` global that shadows jsdom's.
const memory = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v); },
  removeItem: (k: string) => { memory.delete(k); },
  clear: () => { memory.clear(); },
});

type SessionShape = { user: { id: string; email?: string; is_anonymous?: boolean } } | null;

let sessionResult: { data: { session: SessionShape }; error: unknown } = {
  data: { session: null },
  error: null,
};
const signInWithOtp = vi.fn(async () => ({ data: {}, error: null }));
const updateUser = vi.fn(async () => ({ data: {}, error: null }));
const verifyOtp = vi.fn(async () => ({
  data: { session: { user: { id: 'user-new', email: 'a@b.co' } } },
  error: null as { message: string } | null,
}));
const registerPasskey = vi.fn(async () => ({ data: { id: 'pk-9', created_at: '' }, error: null as unknown }));
const signInWithPasskey = vi.fn(async () => ({
  data: { session: { user: { id: 'user-pk', email: 'a@b.co' } }, user: null },
  error: null as unknown,
}));
const passkeyUpdate = vi.fn(async () => ({ data: null, error: null }));
const passkeyDelete = vi.fn(async () => ({ data: null, error: null as { message: string } | null }));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => sessionResult,
      signInWithOtp,
      updateUser,
      verifyOtp,
      registerPasskey,
      signInWithPasskey,
      passkey: { update: passkeyUpdate, delete: passkeyDelete },
    },
  }),
}));

import {
  resolveAuthState,
  requestEmailCode,
  verifyEmailCode,
  getOwnerUserId,
  setOwnerUserId,
  friendlyAuthError,
  isValidEmail,
  registerDevicePasskey,
  signInWithDevicePasskey,
  removeDevicePasskey,
  getDevicePasskey,
  setDevicePasskey,
  isPasskeyCancelled,
} from './auth';

beforeEach(() => {
  localStorage.clear();
  sessionResult = { data: { session: null }, error: null };
  signInWithOtp.mockClear();
  updateUser.mockClear();
  verifyOtp.mockClear();
  registerPasskey.mockClear();
  signInWithPasskey.mockClear();
  passkeyUpdate.mockClear();
  passkeyDelete.mockClear();
});

describe('resolveAuthState', () => {
  it('is signed out with no session and no recorded owner', async () => {
    expect(await resolveAuthState()).toEqual({ state: 'signed-out', userId: null, email: null });
  });

  it('flags a pre-email anonymous session so it can be linked instead of replaced', async () => {
    sessionResult = { data: { session: { user: { id: 'anon-1', is_anonymous: true } } }, error: null };
    expect((await resolveAuthState()).state).toBe('anonymous');
    expect(getOwnerUserId()).toBeNull();
  });

  it('records the owner from a permanent session', async () => {
    sessionResult = { data: { session: { user: { id: 'u1', email: 'a@b.co' } } }, error: null };
    expect(await resolveAuthState()).toEqual({ state: 'signed-in', userId: 'u1', email: 'a@b.co' });
    expect(getOwnerUserId()).toBe('u1');
  });

  it('stays signed in when the refresh is merely unreachable (offline)', async () => {
    setOwnerUserId('u1');
    sessionResult = { data: { session: null }, error: new AuthRetryableFetchError('fetch failed', 0) };
    expect((await resolveAuthState()).state).toBe('signed-in');
    expect(getOwnerUserId()).toBe('u1');
  });

  it('signs out when the server actually rejected the session', async () => {
    setOwnerUserId('u1');
    sessionResult = { data: { session: null }, error: new AuthApiError('revoked', 400, 'refresh_token_not_found') };
    expect((await resolveAuthState()).state).toBe('signed-out');
    expect(getOwnerUserId()).toBeNull();
  });
});

describe('requestEmailCode', () => {
  it('sends an OTP and creates the user for a fresh sign-in', async () => {
    await requestEmailCode('a@b.co', 'sign-in');
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: true } });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('attaches the email to the current user when linking an anonymous account', async () => {
    await requestEmailCode('a@b.co', 'link');
    expect(updateUser).toHaveBeenCalledWith({ email: 'a@b.co' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});

describe('verifyEmailCode', () => {
  it('uses the email otp type for sign-in and records the owner', async () => {
    const { session, error } = await verifyEmailCode('a@b.co', '123456', 'sign-in');
    expect(error).toBeNull();
    expect(session?.user.id).toBe('user-new');
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' });
    expect(getOwnerUserId()).toBe('user-new');
  });

  it('uses the email_change otp type when linking', async () => {
    await verifyEmailCode('a@b.co', '123456', 'link');
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email_change' });
  });

  it('surfaces a friendly error and leaves no owner behind on a bad code', async () => {
    verifyOtp.mockResolvedValueOnce({ data: { session: null as never }, error: { message: 'Token has expired or is invalid' } });
    const { session, error } = await verifyEmailCode('a@b.co', '000000', 'sign-in');
    expect(session).toBeNull();
    expect(error).toMatch(/didn’t work/);
    expect(getOwnerUserId()).toBeNull();
  });
});

describe('helpers', () => {
  it('validates emails loosely', () => {
    expect(isValidEmail('someone@example.org')).toBe(true);
    expect(isValidEmail('  someone@example.org ')).toBe(true);
    expect(isValidEmail('someone@')).toBe(false);
    expect(isValidEmail('no-at-sign')).toBe(false);
  });

  it('maps common Supabase messages', () => {
    expect(friendlyAuthError('For security purposes, you can only request this after 42 seconds.')).toMatch(/wait a minute/);
    expect(friendlyAuthError('Failed to fetch')).toMatch(/offline/);
    expect(friendlyAuthError('Something unexpected')).toBe('Something unexpected');
  });
});

describe('passkeys', () => {
  it('registers, remembers the passkey for this device and account, and labels it', async () => {
    const result = await registerDevicePasskey('user-1');
    expect(result).toEqual({ error: null, cancelled: false });
    expect(getDevicePasskey()).toEqual({ userId: 'user-1', passkeyId: 'pk-9' });
    expect(passkeyUpdate).toHaveBeenCalledWith(expect.objectContaining({ passkeyId: 'pk-9' }));
  });

  it('treats a dismissed prompt as cancelled and leaves no device record', async () => {
    registerPasskey.mockResolvedValueOnce({ data: null as never, error: { code: 'ERROR_CEREMONY_ABORTED', message: 'aborted' } });
    const result = await registerDevicePasskey('user-1');
    expect(result).toEqual({ error: null, cancelled: true });
    expect(getDevicePasskey()).toBeNull();
  });

  it('explains a relying-party mismatch instead of leaking the raw error', async () => {
    registerPasskey.mockResolvedValueOnce({ data: null as never, error: { code: 'ERROR_INVALID_RP_ID', message: 'rp' } });
    const { error } = await registerDevicePasskey('user-1');
    expect(error).toMatch(/aren’t set up for this address/);
  });

  it('signs in with a passkey and records the owner', async () => {
    const { session, error, cancelled } = await signInWithDevicePasskey();
    expect(error).toBeNull();
    expect(cancelled).toBe(false);
    expect(session?.user.id).toBe('user-pk');
    expect(getOwnerUserId()).toBe('user-pk');
  });

  it('removes this device\'s passkey from the account and forgets it locally', async () => {
    setDevicePasskey({ userId: 'user-1', passkeyId: 'pk-9' });
    expect(await removeDevicePasskey()).toEqual({ error: null });
    expect(passkeyDelete).toHaveBeenCalledWith({ passkeyId: 'pk-9' });
    expect(getDevicePasskey()).toBeNull();
  });

  it('recognises the browser\'s own cancel errors too', () => {
    expect(isPasskeyCancelled({ name: 'NotAllowedError' })).toBe(true);
    expect(isPasskeyCancelled({ code: 'ERROR_INVALID_RP_ID' })).toBe(false);
  });
});
