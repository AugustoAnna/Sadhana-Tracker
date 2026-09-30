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

describe('practice_completed sync with SYNC_BACKTRACK_COLUMNS off', () => {
  it('sends a backtracked log without the backtrack or route columns', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const log: PracticeLog = {
      id: 'log-1',
      practiceId: 'isha-kriya',
      instanceId: 'inst-1',
      minutes: 12,
      timestamp: Date.parse('2026-09-30T08:00:00'),
      localDate: '2026-09-29',
      source: 'checkbox',
      wasOffline: false,
      backtrack: true,
      route: 'switcher',
    };
    queue = [{ id: 'q1', table: 'practice_completed', operation: 'insert', createdAt: 1, payload: log }];

    await drainSyncQueue();

    const row = upserts.find((u) => u.id === 'log-1');
    expect(row).toMatchObject({ local_date: '2026-09-29' });
    expect(row).not.toHaveProperty('backtrack');
    expect(row).not.toHaveProperty('route');
    expect(queue).toEqual([]);
  });
});
