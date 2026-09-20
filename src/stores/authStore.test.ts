import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];
let verifyResult: { session: { user: { id: string; email?: string } } | null; error: string | null } = {
  session: { user: { id: 'user-b', email: 'b@x.co' } },
  error: null,
};
let ownerId: string | null = null;
let resolveImpl: () => Promise<{ state: string; userId: string | null; email: string | null }> =
  async () => ({ state: 'signed-out', userId: null, email: null });
let profileName = '';

vi.mock('@/services/auth', () => ({
  getOwnerUserId: () => ownerId,
  setOwnerUserId: (id: string | null) => { ownerId = id; },
  resolveAuthState: () => resolveImpl(),
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
  useAppStore: {
    getState: () => ({
      profile: { name: profileName },
      hydrate: async () => { calls.push('hydrate'); },
      setName: async (name: string) => { calls.push(`setName:${name}`); profileName = name; },
    }),
  },
}));

import { useAuthStore } from './authStore';

beforeEach(() => {
  calls.length = 0;
  ownerId = null;
  profileName = '';
  resolveImpl = async () => ({ state: 'signed-out', userId: null, email: null });
  verifyResult = { session: { user: { id: 'user-b', email: 'b@x.co' } }, error: null };
  useAuthStore.setState({ state: 'signed-out', userId: null, email: null });
});

describe('init', () => {
  it('applies the resolved session', async () => {
    resolveImpl = async () => ({ state: 'anonymous', userId: 'anon-old', email: null });
    await useAuthStore.getState().init();
    await useAuthStore.getState().whenSettled();
    expect(useAuthStore.getState()).toMatchObject({ state: 'anonymous', userId: 'anon-old' });
  });

  it('never leaves the app on "unknown" when resolution throws (no owner → signed out)', async () => {
    resolveImpl = async () => { throw new Error('storage unavailable'); };
    await useAuthStore.getState().init();
    await useAuthStore.getState().whenSettled();
    expect(useAuthStore.getState().state).toBe('signed-out');
  });

  it('falls back to the recorded owner when resolution throws', async () => {
    ownerId = 'user-a';
    resolveImpl = async () => { throw new Error('storage unavailable'); };
    await useAuthStore.getState().init();
    await useAuthStore.getState().whenSettled();
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-in', userId: 'user-a' });
  });
});

describe('verifyCode', () => {
  it('restores from the server, then applies the typed name, without wiping on a fresh device', async () => {
    const err = await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(err).toBeNull();
    expect(calls).not.toContain('wipe');
    expect(calls.indexOf('restoreFromServer')).toBeLessThan(calls.indexOf('hydrate'));
    expect(calls.indexOf('hydrate')).toBeLessThan(calls.indexOf('setName:Priya'));
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
  });

  it('lets the typed name win over a restored placeholder', async () => {
    profileName = 'Anonymous';
    await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(calls).toContain('setName:Priya');
  });

  it('does not rewrite an identical name', async () => {
    profileName = 'Priya';
    await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(calls.some((c) => c.startsWith('setName:'))).toBe(false);
  });

  it('wipes local data when a different account signs in on the same device', async () => {
    ownerId = 'user-a';
    await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(calls.indexOf('wipe')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('wipe')).toBeLessThan(calls.indexOf('restoreFromServer'));
  });

  it('keeps local data when the same account signs back in', async () => {
    ownerId = 'user-b';
    await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(calls).not.toContain('wipe');
  });

  it('keeps local data and skips restore when linking an anonymous session', async () => {
    useAuthStore.setState({ state: 'anonymous', userId: 'anon-1' });
    profileName = 'Priya';
    verifyResult = { session: { user: { id: 'anon-1', email: 'b@x.co' } }, error: null };
    await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(calls).not.toContain('wipe');
    expect(calls).not.toContain('restoreFromServer');
    expect(useAuthStore.getState().state).toBe('signed-in');
  });

  it('returns the error and stays signed out on a bad code', async () => {
    verifyResult = { session: null, error: 'bad code' };
    const err = await useAuthStore.getState().verifyCode('b@x.co', '000000', 'Priya');
    expect(err).toBe('bad code');
    expect(useAuthStore.getState().state).toBe('signed-out');
    expect(calls).toEqual([]);
  });
});

describe('signOut', () => {
  it('flushes the queue, drops the session, wipes local data and re-hydrates', async () => {
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
    await useAuthStore.getState().signOut();
    expect(calls).toEqual(['drainSyncQueue', 'signOutSupabase', 'resetParticipantCache', 'wipe', 'reseed', 'hydrate']);
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-out', userId: null, email: null });
  });
});
