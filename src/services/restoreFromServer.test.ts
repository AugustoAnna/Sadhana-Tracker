import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PracticeInstance, PracticeLog, Profile } from '@/types';

const localInstances: PracticeInstance[] = [];
let profile: Profile | undefined;
const putInstances = vi.fn<(rows: PracticeInstance[]) => Promise<void>>();
const putLogs = vi.fn<(rows: PracticeLog[]) => Promise<void>>();
const updateProfile = vi.fn();

vi.mock('@/db', () => ({
  getDb: () => ({
    practiceInstances: { toArray: async () => localInstances, bulkPut: putInstances },
    practiceLogs: { bulkPut: putLogs },
    profile: { get: async () => profile, update: updateProfile },
    transaction: (_mode: string, ...rest: unknown[]) =>
      (rest[rest.length - 1] as () => Promise<void>)(),
  }),
  isDemoDatabaseActive: () => false,
}));

vi.mock('./auth', () => ({
  getAuthUserId: async () => 'auth-user-1',
  getAuthUser: async () => ({ id: 'auth-user-1', email: null }),
}));

let tables: Record<string, { data: unknown; error: unknown }> = {};
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const result = tables[table] ?? { data: null, error: null };
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.order = () => Promise.resolve(result);
      b.maybeSingle = () => Promise.resolve(result);
      b.then = (r: (v: unknown) => unknown) => Promise.resolve(result).then(r);
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { restoreFromServer } from './sync';

const participant = { data: { id: 'p1', name: 'Neha Sharma', onboarding_completed_at: null }, error: null };
const onboarded = {
  data: { id: 'p1', name: 'Neha Sharma', onboarding_completed_at: '2026-09-01T06:00:00.000Z' },
  error: null,
};

function remoteInstance(id: string, practice_id: string, created_at: string) {
  return { id, practice_id, instance: 1, created_at };
}
function remoteLog(id: string, practice_id: string, local_date: string) {
  return {
    id, practice_id, instance: 1, minutes: 21, mode: 'logged', was_offline: false,
    local_date, occurred_at: `${local_date}T06:00:00.000Z`,
  };
}

beforeEach(() => {
  localInstances.length = 0;
  profile = { id: 'profile', name: '', onboardingComplete: false } as Profile;
  putInstances.mockReset();
  putLogs.mockReset();
  updateProfile.mockReset();
  tables = {};
});

describe('restoreFromServer', () => {
  it('rebuilds logs and links each one to its practice instance', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: [remoteLog('l1', 'shambhavi', '2026-08-14')], error: null },
    };

    const n = await restoreFromServer();

    expect(n).toBe(2);
    expect(putLogs.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'l1', instanceId: 'i1', source: 'checkbox', minutes: 21 }),
    ]);
  });

  it('keeps the order a device already shows and appends unseen practices', async () => {
    localInstances.push({ id: 'i1', practiceId: 'shambhavi', instanceNumber: 1, order: 3, addedAt: 111 });
    tables = {
      participants: participant,
      participant_practices: {
        data: [
          remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z'),
          remoteInstance('i2', 'guru-pooja', '2026-08-15T00:00:00Z'),
        ],
        error: null,
      },
      practice_completed: { data: [], error: null },
    };

    await restoreFromServer();

    expect(putInstances.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'i1', order: 3, addedAt: 111 }),
      expect.objectContaining({ id: 'i2', order: 4 }),
    ]);
  });

  it('skips completions whose practice was removed', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [remoteLog('l1', 'deleted-practice', '2026-08-14')], error: null },
    };

    expect(await restoreFromServer()).toBe(0);
    expect(putLogs).not.toHaveBeenCalled();
  });

  it('restores a blanked name so the landing guard stops forcing onboarding', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: [remoteLog('l1', 'shambhavi', '2026-08-14')], error: null },
    };

    await restoreFromServer();

    expect(updateProfile).toHaveBeenCalledWith('profile', {
      name: 'Neha Sharma', onboardingComplete: true,
    });
  });

  it('marks onboarding complete from the server row even with nothing else to restore', async () => {
    profile = { id: 'profile', name: 'Neha Sharma', onboardingComplete: false } as Profile;
    tables = {
      participants: onboarded,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    expect(await restoreFromServer()).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith('profile', {
      onboardingComplete: true, onboardingCompletedAt: '2026-09-01T06:00:00.000Z',
    });
  });

  it('restores the name alongside the flag when the local profile was wiped', async () => {
    tables = {
      participants: onboarded,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    await restoreFromServer();
    expect(updateProfile).toHaveBeenCalledWith('profile', {
      onboardingComplete: true, onboardingCompletedAt: '2026-09-01T06:00:00.000Z', name: 'Neha Sharma',
    });
  });

  it('does not touch a profile that already finished setup locally', async () => {
    profile = { id: 'profile', name: 'Neha Sharma', onboardingComplete: true } as Profile;
    tables = {
      participants: onboarded,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    expect(await restoreFromServer()).toBe(0);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('does nothing when this auth user has no participant row', async () => {
    tables = { participants: { data: null, error: null } };
    expect(await restoreFromServer()).toBe(0);
    expect(putInstances).not.toHaveBeenCalled();
  });
});
