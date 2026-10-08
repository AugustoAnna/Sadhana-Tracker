import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncQueueItem } from './sync';

let queue: SyncQueueItem[] = [];
const upserts: Array<{ table: string; values: Record<string, unknown>; options: unknown }> = [];

vi.mock('@/db', () => ({
  getDb: () => ({
    profile: { get: async () => ({ id: 'profile', name: 'Someone' }) },
    syncQueue: {
      orderBy: () => ({ toArray: async () => [...queue] }),
      delete: async (id: string) => {
        queue = queue.filter((i) => i.id !== id);
      },
    },
    reminders: { get: async () => undefined },
  }),
  isDemoDatabaseActive: () => false,
}));

vi.mock('./auth', () => ({
  getAuthUserId: async () => 'auth-user-1',
  getAuthUser: async () => ({ id: 'auth-user-1', email: null }),
}));

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: { id: 'p1' }, error: null });
      b.update = () => b;
      b.upsert = (values: Record<string, unknown>, options: unknown) => {
        upserts.push({ table, values, options });
        return Promise.resolve({ error: null });
      };
      b.then = (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r);
      return b;
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { drainSyncQueue } from './sync';

function reminderItem(id: string, remoteId: string, extra: Record<string, unknown>): SyncQueueItem {
  return {
    id: `q-${id}`,
    table: 'reminders',
    operation: 'insert',
    createdAt: 1,
    payload: { id, remoteId, enabled: true, time: '06:00', ...extra },
  };
}

beforeEach(() => {
  queue = [];
  upserts.length = 0;
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('reminder sync', () => {
  // A reinstall gets fresh local reminders with new random remoteIds. The
  // server must still see the same slot, not a second reminder.
  it('upserts on the slot, not on a per-install id', async () => {
    queue = [
      reminderItem('1', 'install-a-uuid', { kind: 'generic', slot: 1 }),
      reminderItem('1', 'install-b-uuid', { kind: 'generic', slot: 1 }),
    ];

    await drainSyncQueue();

    expect(upserts).toHaveLength(2);
    for (const u of upserts) {
      expect(u.table).toBe('reminders');
      expect(u.values).not.toHaveProperty('id');
      expect(u.options).toEqual({ onConflict: 'participant_id,environment,kind,slot,practice_id' });
    }
    expect(upserts[0].values).toEqual(upserts[1].values);
  });

  it('sends practice reminders with a null slot and their practice id', async () => {
    queue = [
      reminderItem('sadhguru-presence', 'uuid', {
        kind: 'practice',
        slot: 3,
        practiceId: 'sadhguru-presence',
        time: '18:15',
      }),
    ];

    await drainSyncQueue();

    expect(upserts[0].values).toMatchObject({
      kind: 'practice',
      slot: null,
      practice_id: 'sadhguru-presence',
      time_local: '18:15',
    });
  });
});
