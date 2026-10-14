import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PracticeInstance, PracticeLog, Profile, SavedSession, SyncQueueItem } from '@/types';

const localInstances: PracticeInstance[] = [];
const localLogs: PracticeLog[] = [];
const sessions: SavedSession[] = [];
const queue: SyncQueueItem[] = [];
const deleteInstances = vi.fn<(ids: string[]) => Promise<void>>();
let profile: Profile | undefined;
const putInstances = vi.fn<(rows: PracticeInstance[]) => Promise<void>>();
const putLogs = vi.fn<(rows: PracticeLog[]) => Promise<void>>();
const updateProfile = vi.fn();

vi.mock('@/db', () => ({
  getDb: () => ({
    practiceInstances: { toArray: async () => localInstances, bulkPut: putInstances, bulkDelete: deleteInstances },
    practiceLogs: {
      bulkPut: putLogs,
      where: () => ({
        anyOf: (ids: string[]) => ({
          modify: async (fn: (l: PracticeLog) => void) => {
            localLogs.filter((l) => ids.includes(l.instanceId)).forEach(fn);
          },
        }),
      }),
    },
    savedSessions: { toCollection: () => ({ modify: async (fn: (s: SavedSession) => void) => sessions.forEach(fn) }) },
    syncQueue: {
      toArray: async () => [...queue],
      delete: async (id: string) => { queue.splice(queue.findIndex((q) => q.id === id), 1); },
      update: async (id: string, changes: Partial<SyncQueueItem>) => {
        Object.assign(queue.find((q) => q.id === id)!, changes);
      },
    },
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
      b.order = () => b;
      // Pages through an array result the way PostgREST's range does.
      b.range = (from: number, to: number) => Promise.resolve(
        Array.isArray(result.data) ? { ...result, data: result.data.slice(from, to + 1) } : result,
      );
      b.maybeSingle = () => Promise.resolve(result);
      b.then = (r: (v: unknown) => unknown) => Promise.resolve(result).then(r);
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { restoreFromServer } from './sync';

const participant = { data: { id: 'p1', name: 'Neha Sharma' }, error: null };
const onboarded = {
  data: { id: 'p1', name: 'Neha Sharma' },
  error: null,
};

function remoteInstance(id: string, practice_id: string, created_at: string, instance = 1) {
  return { id, practice_id, instance, created_at };
}
function remoteLog(id: string, practice_id: string, local_date: string) {
  return {
    id, practice_id, instance: 1, minutes: 21, mode: 'logged', was_offline: false,
    local_date, occurred_at: `${local_date}T06:00:00.000Z`,
  };
}

beforeEach(() => {
  localInstances.length = 0;
  localLogs.length = 0;
  sessions.length = 0;
  queue.length = 0;
  deleteInstances.mockReset();
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

    const result = await restoreFromServer();

    expect(result).toMatchObject({ rowsWritten: 3, participantFound: true });
    expect(putLogs.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'l1', instanceId: 'i1', source: 'checkbox', minutes: 21 }),
    ]);
  });

  it('keeps the yesterday marker, so the next full sync does not clear it', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: {
        data: [
          { ...remoteLog('l1', 'shambhavi', '2026-08-14'), backtrack: true, route: 'sheet' },
          { ...remoteLog('l2', 'shambhavi', '2026-08-15'), backtrack: false, route: null },
        ],
        error: null,
      },
    };

    await restoreFromServer();

    const [yesterdayLog, sameDayLog] = putLogs.mock.calls[0][0];
    expect(yesterdayLog).toMatchObject({ id: 'l1', backtrack: true, route: 'sheet' });
    expect(sameDayLog).not.toHaveProperty('backtrack');
    expect(sameDayLog).not.toHaveProperty('route');
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

  it('folds a device copy of a practice slot into the server row', async () => {
    // Shoonya 1st and 2nd on the device, the same two under other ids on the
    // server: the tracker showed Shoonya four times.
    localInstances.push(
      { id: 'local-1', practiceId: 'shoonya', instanceNumber: 1, order: 2, addedAt: 111 },
      { id: 'local-2', practiceId: 'shoonya', instanceNumber: 2, order: 3, addedAt: 222 },
    );
    localLogs.push({
      id: 'l-local', practiceId: 'shoonya', instanceId: 'local-2', minutes: 15,
      timestamp: 0, localDate: '2026-10-11', source: 'checkbox',
    });
    sessions.push({ id: 's1', name: 'Morning', practiceInstanceIds: ['local-1', 'srv-1'], lastUsedAt: 0 });
    queue.push(
      { id: 'q1', table: 'participant_practices', operation: 'insert', payload: localInstances[0], createdAt: 0 },
      { id: 'q2', table: 'practice_completed', operation: 'insert', payload: { ...localLogs[0] }, createdAt: 0 },
    );
    tables = {
      participants: participant,
      participant_practices: {
        data: [
          remoteInstance('srv-1', 'shoonya', '2026-08-14T00:00:00Z', 1),
          remoteInstance('srv-2', 'shoonya', '2026-08-14T00:00:00Z', 2),
        ],
        error: null,
      },
      practice_completed: { data: [{ ...remoteLog('l-srv', 'shoonya', '2026-10-10'), instance: 2 }], error: null },
    };

    const result = await restoreFromServer();

    expect(putInstances.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'srv-1', instanceNumber: 1, order: 2, addedAt: 111 }),
      expect.objectContaining({ id: 'srv-2', instanceNumber: 2, order: 3, addedAt: 222 }),
    ]);
    expect(deleteInstances).toHaveBeenCalledWith(['local-1', 'local-2']);
    expect(putLogs.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'l-srv', instanceId: 'srv-2' })]);
    expect(localLogs[0].instanceId).toBe('srv-2');
    expect(sessions[0].practiceInstanceIds).toEqual(['srv-1']);
    expect(queue).toEqual([expect.objectContaining({ id: 'q2', payload: expect.objectContaining({ instanceId: 'srv-2' }) })]);
    expect(result.rowsWritten).toBe(2 + 1 + 2 + 1);
  });

  it('keeps one of two device rows for the same slot when the server has neither', async () => {
    localInstances.push(
      { id: 'a', practiceId: 'shoonya', instanceNumber: 1, order: 0, addedAt: 1 },
      { id: 'b', practiceId: 'shoonya', instanceNumber: 1, order: 1, addedAt: 2 },
    );
    tables = {
      participants: participant,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    await restoreFromServer();

    expect(deleteInstances).toHaveBeenCalledWith(['b']);
  });

  it('leaves a device whose ids already match the server alone', async () => {
    localInstances.push({ id: 'i1', practiceId: 'shoonya', instanceNumber: 1, order: 0, addedAt: 1 });
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shoonya', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: [], error: null },
    };

    await restoreFromServer();

    expect(deleteInstances).not.toHaveBeenCalled();
  });

  it('reports the ids the server already holds, so they are not uploaded again', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: [remoteLog('l1', 'shambhavi', '2026-08-14')], error: null },
    };

    const { onServer } = await restoreFromServer();

    expect(onServer).toEqual({ instanceIds: new Set(['i1']), logIds: new Set(['l1']) });
  });

  it('reads a history longer than one server page', async () => {
    const history = Array.from({ length: 1001 }, (_, n) => remoteLog(`l${n}`, 'shambhavi', '2026-08-14'));
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: history, error: null },
    };

    const { onServer } = await restoreFromServer();

    expect(putLogs.mock.calls[0][0]).toHaveLength(1001);
    expect(onServer?.logIds.size).toBe(1001);
  });

  it('reports no server ids when the history could not be read', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [], error: null },
      practice_completed: { data: null, error: { message: 'offline' } },
    };

    expect((await restoreFromServer()).onServer).toBeUndefined();
  });

  it('reports no server ids when the participant lookup fails', async () => {
    tables = { participants: { data: null, error: { message: 'offline' } } };

    expect((await restoreFromServer()).onServer).toBeUndefined();
  });

  it('skips completions whose practice was removed', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [remoteLog('l1', 'deleted-practice', '2026-08-14')], error: null },
    };

    // Known participant still marks setup complete even with no usable practices.
    expect(await restoreFromServer()).toMatchObject({ rowsWritten: 1, participantFound: true });
    expect(putLogs).not.toHaveBeenCalled();
  });

  it('marks setup complete and restores the name when practices come back', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: [remoteLog('l1', 'shambhavi', '2026-08-14')], error: null },
    };

    await restoreFromServer();

    expect(updateProfile).toHaveBeenCalledWith('profile', {
      onboardingComplete: true,
      name: 'Neha Sharma',
    });
  });

  it('marks onboarding complete from a known participant row even with nothing else to restore', async () => {
    profile = { id: 'profile', name: 'Neha Sharma', onboardingComplete: false } as Profile;
    tables = {
      participants: onboarded,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    expect(await restoreFromServer()).toMatchObject({ rowsWritten: 1, participantFound: true });
    expect(updateProfile).toHaveBeenCalledWith('profile', {
      onboardingComplete: true,
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
      onboardingComplete: true, name: 'Neha Sharma',
    });
  });

  it('marks known accounts complete even with no practice data', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    expect(await restoreFromServer()).toMatchObject({ rowsWritten: 1, participantFound: true });
    expect(updateProfile).toHaveBeenCalledWith('profile', {
      onboardingComplete: true,
      name: 'Neha Sharma',
    });
  });

  it('does not touch a profile that already finished setup locally', async () => {
    profile = { id: 'profile', name: 'Neha Sharma', onboardingComplete: true } as Profile;
    tables = {
      participants: onboarded,
      participant_practices: { data: [], error: null },
      practice_completed: { data: [], error: null },
    };

    expect(await restoreFromServer()).toMatchObject({ rowsWritten: 0, participantFound: true });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('reports no participant when this auth user has no row', async () => {
    tables = { participants: { data: null, error: null } };
    // Nothing is on the server for a new account, so everything local goes up.
    expect(await restoreFromServer()).toEqual({
      rowsWritten: 0,
      participantFound: false,
      onServer: { instanceIds: new Set(), logIds: new Set() },
    });
    expect(putInstances).not.toHaveBeenCalled();
  });

  it('uses an explicit auth user id when provided', async () => {
    tables = {
      participants: participant,
      participant_practices: { data: [remoteInstance('i1', 'shambhavi', '2026-08-14T00:00:00Z')], error: null },
      practice_completed: { data: [], error: null },
    };

    expect(await restoreFromServer('auth-user-1')).toMatchObject({ rowsWritten: 2, participantFound: true });
    expect(putInstances).toHaveBeenCalled();
  });
});
