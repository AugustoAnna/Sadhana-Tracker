import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SadhanaDB } from '@/db';

const db = new SadhanaDB('AddInstanceTest');

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => db, isDemoDatabaseActive: () => false };
});
vi.mock('@/services/sync', () => ({
  queueSync: async () => {},
  getParticipantName: async () => null,
  fetchBannerTargets: async () => new Set<string>(),
}));
vi.mock('@/services/audio', () => ({ precachePracticeAudio: () => {} }));
vi.mock('@/services/notifications', () => ({ scheduleReminders: async () => {} }));
vi.mock('@/utils/practiceReminders', () => ({ syncPracticeReminders: async () => [] }));

import { useAppStore } from '@/stores/appStore';

beforeEach(async () => {
  await db.practiceInstances.clear();
  useAppStore.setState({ instances: [], reminders: [] });
});

describe('addPracticeInstance', () => {
  it('assigns 1 then 2 for the same practice', async () => {
    const add = useAppStore.getState().addPracticeInstance;
    await add('angamardana');
    await add('angamardana');

    const rows = await db.practiceInstances.toArray();
    expect(rows.map((r) => r.instanceNumber).sort()).toEqual([1, 2]);
  });

  it('never lets concurrent adds claim the same instance number', async () => {
    // Both calls used to read the same store snapshot before either had
    // written, so both claimed number 1. Dexie allows that; Postgres has
    // unique(participant_id, practice_id, instance) and rejects the second row
    // on every sync drain from then on.
    const add = useAppStore.getState().addPracticeInstance;
    await Promise.all([add('angamardana'), add('angamardana')]);

    const rows = await db.practiceInstances.toArray();
    const numbers = rows.map((r) => r.instanceNumber).sort();
    expect(new Set(numbers).size).toBe(rows.length);
    expect(numbers).toEqual([1, 2]);
  });

  it('caps a practice at two instances', async () => {
    const add = useAppStore.getState().addPracticeInstance;
    await Promise.all([add('angamardana'), add('angamardana'), add('angamardana')]);

    expect(await db.practiceInstances.count()).toBe(2);
  });
});
