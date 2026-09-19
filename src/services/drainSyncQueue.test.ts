import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncQueueItem } from './sync';

let queue: SyncQueueItem[] = [];
const deleted: string[] = [];
const upserted: Array<{ table: string; id: unknown }> = [];
let onUpsert: (() => void) | null = null;

vi.mock('@/db', () => ({
  getDb: () => ({
    profile: { get: async () => ({ id: 'profile', name: 'Someone' }) },
    syncQueue: {
      orderBy: () => ({ toArray: async () => [...queue] }),
      delete: async (id: string) => {
        deleted.push(id);
        queue = queue.filter((i) => i.id !== id);
      },
    },
    practiceInstances: { get: async () => undefined },
  }),
  isDemoDatabaseActive: () => false,
}));

vi.mock('./auth', () => ({ getAuthUserId: async () => 'auth-user-1' }));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: { id: 'p1' }, error: null });
      b.update = () => b;
      b.upsert = (values: { id?: unknown }) => {
        upserted.push({ table, id: values.id });
        onUpsert?.();
        return Promise.resolve({ error: null });
      };
      b.then = (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r);
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { drainSyncQueue } from './sync';

function event(id: string): SyncQueueItem {
  return {
    id,
    table: 'events',
    operation: 'insert',
    createdAt: Number(id.replace(/\D/g, '')) || 0,
    payload: { id, name: 'app_open', properties: {}, occurred_at: '', local_date: '2026-08-26' },
  };
}

beforeEach(() => {
  queue = [];
  deleted.length = 0;
  upserted.length = 0;
  onUpsert = null;
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('drainSyncQueue', () => {
  it('drains everything already queued', async () => {
    queue = [event('1'), event('2')];
    await drainSyncQueue();
    expect(upserted.map((u) => u.id)).toEqual(['1', '2']);
    expect(queue).toEqual([]);
  });

  it('picks up an item queued while a drain is already running', async () => {
    queue = [event('1')];
    // Mimics queueSync firing mid-drain: the running pass has already taken its
    // snapshot, so without a re-run this item waits until the next launch.
    onUpsert = () => {
      onUpsert = null;
      queue.push(event('2'));
      void drainSyncQueue();
    };

    await drainSyncQueue();

    expect(upserted.map((u) => u.id)).toEqual(['1', '2']);
    expect(queue).toEqual([]);
  });
});
