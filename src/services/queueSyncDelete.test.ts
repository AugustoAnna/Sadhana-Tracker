import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SadhanaDB } from '@/db';

const db = new SadhanaDB('QueueSyncDeleteTest');

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => db, isDemoDatabaseActive: () => false };
});
vi.mock('./auth', () => ({
  getAuthUserId: async () => null,
  getAuthUser: async () => null,
}));
vi.mock('./supabase', () => ({
  getSupabase: () => null,
  isSupabaseConfigured: () => false,
}));

import { queueSyncDelete } from './sync';

function waiting(id: string, table: string, rowId: string, createdAt: number) {
  return { id, table, operation: 'insert' as const, payload: { id: rowId }, createdAt };
}

beforeEach(async () => {
  await db.syncQueue.clear();
  // Offline, so nothing drains and the queue can be read back as left.
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
});

describe('queueSyncDelete', () => {
  it('drops the waiting upload for that row and queues its delete', async () => {
    await db.syncQueue.bulkAdd([
      waiting('q1', 'practice_completed', 'log-1', 1),
      waiting('q2', 'practice_completed', 'log-2', 2),
      waiting('q3', 'events', 'log-1', 3),
    ]);

    await queueSyncDelete('practice_completed', 'log-1');

    const queue = await db.syncQueue.orderBy('createdAt').toArray();
    expect(queue.map((i) => [i.table, i.operation, (i.payload as { id: string }).id])).toEqual([
      ['practice_completed', 'insert', 'log-2'],
      ['events', 'insert', 'log-1'],
      ['practice_completed', 'delete', 'log-1'],
    ]);
  });
});
