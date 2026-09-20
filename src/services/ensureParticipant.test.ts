import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Profile } from '@/types';

const updates: Array<Record<string, unknown>> = [];
const inserts: Array<Record<string, unknown>> = [];
let existingRow: { id: string } | null = null;

vi.mock('@/db', () => ({
  getDb: () => ({ profile: { get: async () => ({ id: 'profile', name: '' }) } }),
  isDemoDatabaseActive: () => false,
}));

let authEmail: string | null = null;
vi.mock('./auth', () => ({
  getAuthUserId: async () => 'auth-user-1',
  getAuthUser: async () => ({ id: 'auth-user-1', email: authEmail }),
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: existingRow, error: null });
      b.single = () => Promise.resolve({ data: { id: 'new-participant' }, error: null });
      b.update = (values: Record<string, unknown>) => { updates.push(values); return b; };
      b.insert = (values: Record<string, unknown>) => { inserts.push(values); return b; };
      b.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r);
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { ensureParticipant } from './sync';

const profile = (name: string) => ({ id: 'profile', name }) as Profile;

beforeEach(() => {
  updates.length = 0;
  inserts.length = 0;
  existingRow = { id: 'p1' };
  authEmail = null;
});

describe('ensureParticipant', () => {
  it('does not overwrite a stored name when the local profile was wiped', async () => {
    await ensureParticipant(profile(''));
    expect(updates).toEqual([]);
  });

  it('still writes a real name through', async () => {
    await ensureParticipant(profile('Neha Sharma'));
    expect(updates).toEqual([{ name: 'Neha Sharma' }]);
  });

  it('falls back to Anonymous only when creating a brand new row', async () => {
    existingRow = null;
    await ensureParticipant(profile(''));
    expect(inserts[0]).toMatchObject({ name: 'Anonymous' });
  });

  it('mirrors the account email onto the row once the session has one', async () => {
    authEmail = 'priya@example.org';
    await ensureParticipant(profile(''));
    expect(updates).toEqual([{ email: 'priya@example.org' }]);
  });

  it('stores the email on a brand new row', async () => {
    existingRow = null;
    authEmail = 'priya@example.org';
    await ensureParticipant(profile('Priya'));
    expect(inserts[0]).toMatchObject({ name: 'Priya', email: 'priya@example.org' });
  });
});
