import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Profile } from '@/types';

const updates: Array<Record<string, unknown>> = [];
const inserts: Array<Record<string, unknown>> = [];
const isFilters: Array<[string, unknown]> = [];
const eqFilters: Array<[string, unknown]> = [];
const ilikeFilters: Array<[string, unknown]> = [];

let existingByEmail: { id: string; auth_user_id?: string | null; email?: string | null } | null = null;
let existingByAuth: { id: string; auth_user_id?: string | null; email?: string | null } | null = null;
let authEmail: string | null = null;

vi.mock('@/db', () => ({
  getDb: () => ({ profile: { get: async () => ({ id: 'profile', name: '' }) } }),
  isDemoDatabaseActive: () => false,
}));

vi.mock('./auth', () => ({
  getAuthUserId: async () => 'auth-user-1',
  getAuthUser: async () => ({ id: 'auth-user-1', email: authEmail }),
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      let mode: 'email' | 'auth' | 'id' | null = null;
      b.select = () => b;
      b.eq = (column: string, value: unknown) => {
        eqFilters.push([column, value]);
        if (column === 'auth_user_id') mode = 'auth';
        if (column === 'id') mode = 'id';
        return b;
      };
      b.ilike = (column: string, value: unknown) => {
        ilikeFilters.push([column, value]);
        if (column === 'email') mode = 'email';
        return b;
      };
      b.is = (column: string, value: unknown) => { isFilters.push([column, value]); return b; };
      b.maybeSingle = () => {
        if (mode === 'email') return Promise.resolve({ data: existingByEmail, error: null });
        if (mode === 'auth') return Promise.resolve({ data: existingByAuth, error: null });
        return Promise.resolve({ data: null, error: null });
      };
      b.single = () => Promise.resolve({ data: { id: 'new-participant' }, error: null });
      b.update = (values: Record<string, unknown>) => {
        updates.push(values);
        return {
          eq: (column: string, value: unknown) => {
            eqFilters.push([column, value]);
            return {
              is: (column2: string, value2: unknown) => {
                isFilters.push([column2, value2]);
                return Promise.resolve({ data: null, error: null });
              },
              then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r),
            };
          },
        };
      };
      b.insert = (values: Record<string, unknown>) => {
        inserts.push(values);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'new-participant' }, error: null }),
          }),
        };
      };
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { ensureParticipant, ensureParticipantDetailed } from './sync';

const profile = (name: string) => ({ id: 'profile', name }) as Profile;

beforeEach(() => {
  updates.length = 0;
  inserts.length = 0;
  isFilters.length = 0;
  eqFilters.length = 0;
  ilikeFilters.length = 0;
  existingByEmail = null;
  existingByAuth = { id: 'p1', auth_user_id: 'auth-user-1', email: null };
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

  it('treats an existing email row as known and does not create', async () => {
    authEmail = 'priya@example.org';
    existingByEmail = { id: 'p-email', auth_user_id: 'other-auth', email: 'priya@example.org' };
    existingByAuth = null;
    const result = await ensureParticipantDetailed(profile('Priya'));
    expect(result).toEqual({ id: 'p-email', created: false });
    expect(inserts).toEqual([]);
    expect(updates[0]).toMatchObject({
      name: 'Priya',
      auth_user_id: 'auth-user-1',
    });
  });

  it('falls back to Anonymous only when creating a brand new row', async () => {
    existingByAuth = null;
    existingByEmail = null;
    await ensureParticipant(profile(''));
    expect(inserts[0]).toMatchObject({ name: 'Anonymous' });
  });

  it('creates a row even when the local profile has no name yet', async () => {
    existingByAuth = null;
    existingByEmail = null;
    authEmail = 'new@example.org';
    const result = await ensureParticipantDetailed(profile(''));
    expect(result).toEqual({ id: 'new-participant', created: true });
    expect(inserts[0]).toMatchObject({ email: 'new@example.org', name: 'Anonymous' });
  });

  it('mirrors the account email onto the row once the session has one', async () => {
    authEmail = 'priya@example.org';
    existingByEmail = null;
    existingByAuth = { id: 'p1', auth_user_id: 'auth-user-1', email: null };
    await ensureParticipant(profile(''));
    expect(updates).toEqual([{ email: 'priya@example.org' }]);
  });

  it('stores the email on a brand new row', async () => {
    existingByAuth = null;
    existingByEmail = null;
    authEmail = 'priya@example.org';
    await ensureParticipant(profile('Priya'));
    expect(inserts[0]).toMatchObject({ name: 'Priya', email: 'priya@example.org' });
  });

  it('writes onboarding_completed_at only where the row still has none', async () => {
    await ensureParticipant({
      ...profile('Neha Sharma'),
      onboardingComplete: true,
      onboardingCompletedAt: '2026-09-01T06:00:00.000Z',
    });
    expect(updates).toEqual([
      { name: 'Neha Sharma' },
      { onboarding_completed_at: '2026-09-01T06:00:00.000Z' },
    ]);
    expect(isFilters).toEqual([['onboarding_completed_at', null]]);
  });

  it('stamps now for a profile that finished setup before the timestamp existed', async () => {
    await ensureParticipant({ ...profile('Neha Sharma'), onboardingComplete: true });
    const stamped = updates[1]?.onboarding_completed_at as string;
    expect(Date.now() - new Date(stamped).getTime()).toBeLessThan(5_000);
  });

  it('leaves onboarding_completed_at alone while setup is unfinished', async () => {
    await ensureParticipant({ ...profile('Neha Sharma'), onboardingComplete: false });
    expect(updates).toEqual([{ name: 'Neha Sharma' }]);
    expect(isFilters).toEqual([]);
  });

  it('carries onboarding_completed_at onto a brand new row', async () => {
    existingByAuth = null;
    existingByEmail = null;
    await ensureParticipant({
      ...profile('Priya'),
      onboardingComplete: true,
      onboardingCompletedAt: '2026-09-01T06:00:00.000Z',
    });
    expect(inserts[0]).toMatchObject({ onboarding_completed_at: '2026-09-01T06:00:00.000Z' });
  });
});
