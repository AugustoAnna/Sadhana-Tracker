import { describe, it, expect, vi } from 'vitest';
import type { SyncQueueItem } from '@/services/sync';
import type { PracticeLog } from '@/types';

let queue: SyncQueueItem[] = [];
const upserts: Array<Record<string, unknown>> = [];

vi.mock('@/db', () => ({
  getDb: () => ({
    profile: { get: async () => ({ id: 'profile', name: 'Someone' }) },
    syncQueue: {
      orderBy: () => ({ toArray: async () => [...queue] }),
      delete: async (id: string) => { queue = queue.filter((i) => i.id !== id); },
    },
    practiceInstances: { get: async () => ({ instanceNumber: 1 }) },
  }),
  isDemoDatabaseActive: () => false,
}));
vi.mock('@/services/auth', () => ({
  getAuthUserId: async () => 'auth-user-1',
  getAuthUser: async () => ({ id: 'auth-user-1', email: null }),
}));
vi.mock('@/services/supabase', () => ({
  getSupabase: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: { id: 'p1' }, error: null });
      b.update = () => b;
      b.upsert = (values: Record<string, unknown>) => {
        upserts.push(values);
        return Promise.resolve({ error: null });
      };
      b.then = (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r);
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { drainSyncQueue } from '@/services/sync';

function practiceLog(overrides: Partial<PracticeLog>): PracticeLog {
  return {
    id: 'log-1',
    practiceId: 'isha-kriya',
    instanceId: 'inst-1',
    minutes: 12,
    timestamp: Date.parse('2026-09-30T08:00:00'),
    localDate: '2026-09-30',
    source: 'checkbox',
    wasOffline: false,
    ...overrides,
  };
}

async function sync(log: PracticeLog) {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  upserts.length = 0;
  queue = [{ id: 'q1', table: 'practice_completed', operation: 'insert', createdAt: 1, payload: log }];
  await drainSyncQueue();
  expect(queue).toEqual([]);
  return upserts.find((u) => u.id === log.id);
}

describe('practice_completed backtrack columns', () => {
  it('marks a yesterday log with its route', async () => {
    const row = await sync(practiceLog({ localDate: '2026-09-29', backtrack: true, route: 'sheet' }));

    expect(row).toMatchObject({ local_date: '2026-09-29', backtrack: true, route: 'sheet' });
  });

  it('defaults a yesterday log without a route to the switcher', async () => {
    const row = await sync(practiceLog({ localDate: '2026-09-29', backtrack: true }));

    expect(row).toMatchObject({ backtrack: true, route: 'switcher' });
  });

  it('sends a same-day log, or one queued before backtracking existed, as not backtracked', async () => {
    const row = await sync(practiceLog({}));

    expect(row).toMatchObject({ backtrack: false, route: null });
  });
});
