import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];
let verifyResult: { session: { user: { id: string; email?: string } } | null; error: string | null } = {
  session: { user: { id: 'user-b', email: 'b@x.co' } },
  error: null,
};
let ownerId: string | null = null;

let requireEmail = false;
vi.mock('@/config/environment', () => ({
  APP_ENV: 'study',
  get REQUIRE_EMAIL_SIGN_IN() { return requireEmail; },
}));

let resolved: { state: string; userId: string | null; email: string | null } =
  { state: 'signed-out', userId: null, email: null };

vi.mock('@/services/auth', () => ({
  getOwnerUserId: () => ownerId,
  setOwnerUserId: (id: string | null) => { ownerId = id; },
  resolveAuthState: async () => resolved,
  startAnonymousSession: async () => { calls.push('startAnonymousSession'); return 'anon-new'; },
  onSignedOut: () => () => undefined,
  requestEmailCode: async () => ({ error: null }),
  verifyEmailCode: async () => {
    if (verifyResult.session) ownerId = verifyResult.session.user.id;
    return verifyResult;
  },
  signOutSupabase: async () => { calls.push('signOutSupabase'); ownerId = null; },
}));

vi.mock('@/services/sync', () => ({
  drainSyncQueue: async () => { calls.push('drainSyncQueue'); },
  resetParticipantCache: () => { calls.push('resetParticipantCache'); },
  restoreFromServer: async () => { calls.push('restoreFromServer'); return 0; },
  syncFullState: async () => { calls.push('syncFullState'); },
}));

vi.mock('@/db', () => ({
  realDb: {},
  importDatabase: async () => { calls.push('wipe'); },
  initDB: async () => { calls.push('reseed'); },
}));

vi.mock('./appStore', () => ({
  useAppStore: { getState: () => ({ hydrate: async () => { calls.push('hydrate'); } }) },
}));

import { useAuthStore } from './authStore';

beforeEach(() => {
  calls.length = 0;
  ownerId = null;
  requireEmail = false;
  resolved = { state: 'signed-out', userId: null, email: null };
  verifyResult = { session: { user: { id: 'user-b', email: 'b@x.co' } }, error: null };
  useAuthStore.setState({ state: 'signed-out', userId: null, email: null });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('init', () => {
  it('creates an anonymous session for a fresh device while email is optional', async () => {
    await useAuthStore.getState().init();
    await useAuthStore.getState().whenSettled();
    expect(calls).toContain('startAnonymousSession');
    expect(useAuthStore.getState()).toMatchObject({ state: 'anonymous', userId: 'anon-new' });
  });

  it('leaves a fresh device signed out when email sign-in is required', async () => {
    requireEmail = true;
    await useAuthStore.getState().init();
    await useAuthStore.getState().whenSettled();
    expect(calls).not.toContain('startAnonymousSession');
    expect(useAuthStore.getState().state).toBe('signed-out');
  });

  it('keeps an existing anonymous session in both modes', async () => {
    resolved = { state: 'anonymous', userId: 'anon-old', email: null };
    await useAuthStore.getState().init();
    await useAuthStore.getState().whenSettled();
    expect(calls).not.toContain('startAnonymousSession');
    expect(useAuthStore.getState().userId).toBe('anon-old');
  });
});

describe('verifyCode', () => {
  it('restores from the server without wiping when the device has no previous owner', async () => {
    const err = await useAuthStore.getState().verifyCode('b@x.co', '123456');
    expect(err).toBeNull();
    expect(calls).not.toContain('wipe');
    expect(calls).toEqual(expect.arrayContaining(['resetParticipantCache', 'restoreFromServer', 'hydrate']));
    expect(calls.indexOf('restoreFromServer')).toBeLessThan(calls.indexOf('hydrate'));
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
  });

  it('wipes local data when a different account signs in on the same device', async () => {
    ownerId = 'user-a';
    await useAuthStore.getState().verifyCode('b@x.co', '123456');
    expect(calls.indexOf('wipe')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('wipe')).toBeLessThan(calls.indexOf('restoreFromServer'));
  });

  it('keeps local data when the same account signs back in', async () => {
    ownerId = 'user-b';
    await useAuthStore.getState().verifyCode('b@x.co', '123456');
    expect(calls).not.toContain('wipe');
  });

  it('keeps local data and skips restore when linking an anonymous session', async () => {
    useAuthStore.setState({ state: 'anonymous', userId: 'anon-1' });
    ownerId = null;
    verifyResult = { session: { user: { id: 'anon-1', email: 'b@x.co' } }, error: null };
    await useAuthStore.getState().verifyCode('b@x.co', '123456');
    expect(calls).not.toContain('wipe');
    expect(calls).not.toContain('restoreFromServer');
    expect(useAuthStore.getState().state).toBe('signed-in');
  });

  it('returns the error and stays signed out on a bad code', async () => {
    verifyResult = { session: null, error: 'bad code' };
    const err = await useAuthStore.getState().verifyCode('b@x.co', '000000');
    expect(err).toBe('bad code');
    expect(useAuthStore.getState().state).toBe('signed-out');
    expect(calls).toEqual([]);
  });
});

describe('signOut', () => {
  it('flushes the queue, drops the session, wipes local data and re-hydrates (required mode)', async () => {
    requireEmail = true;
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
    await useAuthStore.getState().signOut();
    expect(calls).toEqual(['drainSyncQueue', 'signOutSupabase', 'resetParticipantCache', 'wipe', 'reseed', 'hydrate']);
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-out', userId: null, email: null });
  });

  it('follows up with a fresh anonymous session while email is optional', async () => {
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
    await useAuthStore.getState().signOut();
    expect(calls[calls.length - 1]).toBe('drainSyncQueue');
    expect(calls).toContain('startAnonymousSession');
    expect(useAuthStore.getState()).toMatchObject({ state: 'anonymous', userId: 'anon-new' });
  });

  it('stays signed out when a real sign-in is about to follow', async () => {
    useAuthStore.setState({ state: 'anonymous', userId: 'anon-old', email: null });
    await useAuthStore.getState().signOut({ thenAnonymous: false });
    expect(calls).not.toContain('startAnonymousSession');
    expect(useAuthStore.getState().state).toBe('signed-out');
  });
});
