import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SadhanaDB } from '@/db';

const db = new SadhanaDB('RemoveAllInstancesTest');
const queueSync = vi.fn(async () => {});

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => db, isDemoDatabaseActive: () => false };
});
vi.mock('@/services/sync', () => ({
  queueSync: (...args: unknown[]) => queueSync(...(args as [])),
  getParticipantName: async () => null,
  fetchBannerTargets: async () => new Set<string>(),
}));
vi.mock('@/services/audio', () => ({ precachePracticeAudio: () => {} }));
vi.mock('@/utils/practiceReminders', () => ({ syncPracticeReminders: async () => [] }));

import { useAppStore } from '@/stores/appStore';

beforeEach(async () => {
  await db.practiceInstances.clear();
  useAppStore.setState({ instances: [], reminders: [] });
  queueSync.mockClear();
});

describe('removeAllInstancesForPractice', () => {
  it('removes a 2X practice in one step, never showing it as 1X', async () => {
    const { addPracticeInstance } = useAppStore.getState();
    await addPracticeInstance('angamardana');
    await addPracticeInstance('angamardana');
    await addPracticeInstance('shoonya');
    queueSync.mockClear();

    const seen: number[] = [];
    const unsubscribe = useAppStore.subscribe((s) => {
      seen.push(s.instances.filter((i) => i.practiceId === 'angamardana').length);
    });
    await useAppStore.getState().removeAllInstancesForPractice('angamardana');
    unsubscribe();

    expect(seen).not.toContain(1);
    expect(useAppStore.getState().instances.map((i) => i.practiceId)).toEqual(['shoonya']);
    const rows = await db.practiceInstances.toArray();
    expect(rows.map((r) => [r.practiceId, r.order])).toEqual([['shoonya', 0]]);
    // Both copies are still deleted on the server.
    expect(queueSync).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a practice that is not added', async () => {
    await useAppStore.getState().addPracticeInstance('shoonya');
    queueSync.mockClear();

    await useAppStore.getState().removeAllInstancesForPractice('angamardana');

    expect(useAppStore.getState().instances).toHaveLength(1);
    expect(queueSync).not.toHaveBeenCalled();
  });
});
