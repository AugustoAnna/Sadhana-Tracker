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

let devicePasskey: { userId: string; passkeyId: string } | null = null;
let passkeySignIn: { session: { user: { id: string; email?: string } } | null; error: string | null; cancelled: boolean } =
  { session: { user: { id: 'user-b', email: 'b@x.co' } }, error: null, cancelled: false };
let passkeyRegister: { error: string | null; cancelled: boolean } = { error: null, cancelled: false };
let anonTokens: { access_token: string; refresh_token: string } | null = { access_token: 'anon-at', refresh_token: 'anon-rt' };
let mergeResult: { error: string | null } = { error: null };

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
  isPasskeySupported: async () => true,
  getDevicePasskey: () => devicePasskey,
  setDevicePasskey: (v: { userId: string; passkeyId: string } | null) => { devicePasskey = v; },
  signInWithDevicePasskey: async () => {
    calls.push('signInWithDevicePasskey');
    if (passkeySignIn.session) ownerId = passkeySignIn.session.user.id;
    return passkeySignIn;
  },
  registerDevicePasskey: async (userId: string) => {
    calls.push('registerDevicePasskey');
    if (!passkeyRegister.error && !passkeyRegister.cancelled) devicePasskey = { userId, passkeyId: 'pk-1' };
    return passkeyRegister;
  },
  removeDevicePasskey: async () => { calls.push('removeDevicePasskey'); devicePasskey = null; return { error: null }; },
  captureSession: async () => { calls.push('captureSession'); return anonTokens; },
  restoreSession: async (t: { access_token: string }) => { calls.push(`restoreSession:${t.access_token}`); },
  mergeAnonymousAccount: async (token: string) => { calls.push(`merge:${token}`); return mergeResult; },
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
  devicePasskey = null;
  passkeySignIn = { session: { user: { id: 'user-b', email: 'b@x.co' } }, error: null, cancelled: false };
  passkeyRegister = { error: null, cancelled: false };
  anonTokens = { access_token: 'anon-at', refresh_token: 'anon-rt' };
  mergeResult = { error: null };
  resolveImpl = async () => ({ state: 'signed-out', userId: null, email: null });
  verifyResult = { session: { user: { id: 'user-b', email: 'b@x.co' } }, error: null };
  useAuthStore.setState({ state: 'signed-out', userId: null, email: null, passkeyOnDevice: false });
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

describe('verifyCodeAndMerge', () => {
  beforeEach(() => {
    useAuthStore.setState({ state: 'anonymous', userId: 'anon-1', email: null });
  });

  it('captures the anonymous session, signs in, merges, then restores and applies the name', async () => {
    const err = await useAuthStore.getState().verifyCodeAndMerge('b@x.co', '123456', 'Priya');
    expect(err).toBeNull();
    const i = (c: string) => calls.findIndex((x) => x.startsWith(c));
    expect(i('captureSession')).toBeLessThan(i('merge:anon-at'));
    expect(i('merge:anon-at')).toBeLessThan(i('restoreFromServer'));
    expect(i('restoreFromServer')).toBeLessThan(i('hydrate'));
    expect(calls).toContain('setName:Priya');
    expect(calls).not.toContain('wipe');
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-in', userId: 'user-b' });
  });

  it('puts the anonymous session back and stays anonymous when the merge fails', async () => {
    mergeResult = { error: 'merge down' };
    const err = await useAuthStore.getState().verifyCodeAndMerge('b@x.co', '123456', 'Priya');
    expect(err).toBe('merge down');
    expect(calls).toContain('restoreSession:anon-at');
    expect(calls).not.toContain('restoreFromServer');
    expect(calls).not.toContain('wipe');
    expect(ownerId).toBeNull();
    expect(useAuthStore.getState().state).toBe('anonymous');
  });

  it('refuses when there is no anonymous session to merge from', async () => {
    anonTokens = null;
    const err = await useAuthStore.getState().verifyCodeAndMerge('b@x.co', '123456', 'Priya');
    expect(err).toMatch(/previous session is gone/);
    expect(calls).toEqual(['captureSession']);
  });

  it('does not merge when the code itself is wrong', async () => {
    verifyResult = { session: null, error: 'bad code' };
    const err = await useAuthStore.getState().verifyCodeAndMerge('b@x.co', '000000', 'Priya');
    expect(err).toBe('bad code');
    expect(calls.some((c) => c.startsWith('merge:'))).toBe(false);
    expect(useAuthStore.getState().state).toBe('anonymous');
  });
});

describe('passkeys', () => {
  it('signs in with a passkey through the same completion as a code (restore, hydrate, sync)', async () => {
    const result = await useAuthStore.getState().signInWithPasskey();
    expect(result).toBeNull();
    expect(calls.indexOf('signInWithDevicePasskey')).toBeLessThan(calls.indexOf('restoreFromServer'));
    expect(calls.indexOf('restoreFromServer')).toBeLessThan(calls.indexOf('hydrate'));
    expect(calls).toContain('resetParticipantCache');
    expect(calls.some((c) => c.startsWith('setName:'))).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-in', userId: 'user-b' });
  });

  it('reports a dismissed system prompt as cancelled, not as an error', async () => {
    passkeySignIn = { session: null, error: null, cancelled: true };
    expect(await useAuthStore.getState().signInWithPasskey()).toBe('cancelled');
    expect(useAuthStore.getState().state).toBe('signed-out');
  });

  it('knows a passkey is on this device only for the account that registered it', async () => {
    devicePasskey = { userId: 'user-a', passkeyId: 'pk-a' };
    await useAuthStore.getState().signInWithPasskey(); // user-b
    expect(useAuthStore.getState().passkeyOnDevice).toBe(false);
  });

  it('drops the previous account\'s passkey note when a different account wipes the device', async () => {
    ownerId = 'user-a';
    devicePasskey = { userId: 'user-a', passkeyId: 'pk-a' };
    await useAuthStore.getState().verifyCode('b@x.co', '123456', 'Priya');
    expect(calls).toContain('wipe');
    expect(devicePasskey).toBeNull();
  });

  it('registers a passkey for the signed-in account and flags the device', async () => {
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
    expect(await useAuthStore.getState().enablePasskey()).toBeNull();
    expect(devicePasskey).toEqual({ userId: 'user-b', passkeyId: 'pk-1' });
    expect(useAuthStore.getState().passkeyOnDevice).toBe(true);
  });

  it('passes a registration cancel through without flagging the device', async () => {
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
    passkeyRegister = { error: null, cancelled: true };
    expect(await useAuthStore.getState().enablePasskey()).toBe('cancelled');
    expect(useAuthStore.getState().passkeyOnDevice).toBe(false);
  });

  it('turns the device passkey off', async () => {
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co', passkeyOnDevice: true });
    devicePasskey = { userId: 'user-b', passkeyId: 'pk-1' };
    expect(await useAuthStore.getState().disablePasskey()).toBeNull();
    expect(calls).toContain('removeDevicePasskey');
    expect(useAuthStore.getState().passkeyOnDevice).toBe(false);
  });
});

describe('signOut', () => {
  it('flushes the queue, drops the session, wipes local data and re-hydrates', async () => {
    useAuthStore.setState({ state: 'signed-in', userId: 'user-b', email: 'b@x.co' });
    await useAuthStore.getState().signOut();
    expect(calls).toEqual(['drainSyncQueue', 'signOutSupabase', 'resetParticipantCache', 'wipe', 'reseed', 'hydrate']);
    expect(useAuthStore.getState()).toMatchObject({ state: 'signed-out', userId: null, email: null, passkeyOnDevice: false });
  });
});
