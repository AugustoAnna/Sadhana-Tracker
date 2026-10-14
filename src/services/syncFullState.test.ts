import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PracticeInstance, PracticeLog, SyncQueueItem } from '@/types';

const instances: PracticeInstance[] = [];
const logs: PracticeLog[] = [];
let queue: SyncQueueItem[] = [];

vi.mock('@/db', () => ({
  getDb: () => ({
    profile: { get: async () => ({ id: 'profile', name: 'Someone' }) },
    practiceInstances: { toArray: async () => instances },
    practiceLogs: { toArray: async () => logs },
    reminders: { toArray: async () => [] },
    syncQueue: {
      toArray: async () => [...queue],
      add: async (item: SyncQueueItem) => { queue.push(item); },
    },
  }),
  isDemoDatabaseActive: () => false,
}));

vi.mock('./auth', () => ({
  getAuthUserId: async () => null,
  getAuthUser: async () => null,
}));

vi.mock('./supabase', () => ({
  getSupabase: () => null,
  isSupabaseConfigured: () => true,
}));

import { syncFullState } from './sync';

const instance = (id: string): PracticeInstance =>
  ({ id, practiceId: 'shoonya', instanceNumber: 1, order: 0, addedAt: 0 });
const log = (id: string): PracticeLog =>
  ({ id, practiceId: 'shoonya', instanceId: 'i1', minutes: 15, timestamp: 0, localDate: '2026-10-13', source: 'checkbox' });
const queuedIds = (table: string) =>
  queue.filter((q) => q.table === table).map((q) => (q.payload as { id: string }).id);

beforeEach(() => {
  instances.length = 0;
  logs.length = 0;
  queue = [];
  // Queue only: these tests are about what gets queued, not the drain.
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
});

describe('syncFullState', () => {
  it('queues only rows the server does not have yet', async () => {
    instances.push(instance('i1'), instance('i2'));
    logs.push(log('l1'), log('l2'), log('l3'));

    await syncFullState({ instanceIds: new Set(['i1']), logIds: new Set(['l1', 'l2']) });

    expect(queuedIds('participant_practices')).toEqual(['i2']);
    expect(queuedIds('practice_completed')).toEqual(['l3']);
  });

  it('queues everything local when no server ids are given (link-mode sign-in)', async () => {
    instances.push(instance('i1'));
    logs.push(log('l1'), log('l2'));

    await syncFullState();

    expect(queuedIds('participant_practices')).toEqual(['i1']);
    expect(queuedIds('practice_completed')).toEqual(['l1', 'l2']);
  });

  it('does not re-send practices or logs when the server could not be read', async () => {
    instances.push(instance('i1'));
    logs.push(log('l1'), log('l2'));

    await syncFullState('unread');

    expect(queue).toEqual([]);
  });

  it('does not queue a row that is already waiting', async () => {
    logs.push(log('l1'));
    queue.push({ id: 'q1', table: 'practice_completed', operation: 'insert', payload: log('l1'), createdAt: 0 });

    await syncFullState();

    expect(queuedIds('practice_completed')).toEqual(['l1']);
  });
});
