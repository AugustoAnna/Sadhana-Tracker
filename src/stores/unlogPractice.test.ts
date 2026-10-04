import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SadhanaDB } from '@/db';
import type { PracticeInstance } from '@/types';

const db = new SadhanaDB('UnlogPracticeTest');
const queued: Array<{ table: string; operation: string; payload: unknown }> = [];
const deletesQueued: Array<{ table: string; id: string }> = [];
const tracked: Array<{ name: string; properties: Record<string, unknown> }> = [];

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => db, isDemoDatabaseActive: () => false };
});
vi.mock('@/services/sync', () => ({
  queueSync: async (item: { table: string; operation: string; payload: unknown }) => { queued.push(item); },
  queueSyncDelete: async (table: string, id: string) => { deletesQueued.push({ table, id }); },
  getParticipantName: async () => null,
  fetchBannerTargets: async () => new Set<string>(),
}));
vi.mock('@/services/instrumentation', () => ({
  track: async (name: string, properties: Record<string, unknown>) => { tracked.push({ name, properties }); },
}));
// Journey on, so the pending journey minutes are exercised.
vi.mock('@/features', () => ({ isFeatureEnabled: () => true }));
vi.mock('@/services/audio', () => ({ precachePracticeAudio: () => {} }));
vi.mock('@/utils/practiceReminders', () => ({ syncPracticeReminders: async () => [] }));

import { useAppStore } from '@/stores/appStore';

const TODAY = '2026-09-30';
const NOW = Date.parse(`${TODAY}T08:00:00`);

const instance: PracticeInstance = {
  id: 'inst-1',
  practiceId: 'isha-kriya',
  instanceNumber: 1,
  order: 0,
  addedAt: 0,
};

async function tick() {
  await useAppStore.getState().logPractice('inst-1', 12, 'checkbox');
  return useAppStore.getState().logs[0];
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.practiceLogs.clear();
  await db.appMeta.put({ id: 'meta', lastLevelUpDate: null, pendingJourneyMinutes: 0, recentSessionKeys: [] });
  queued.length = 0;
  deletesQueued.length = 0;
  tracked.length = 0;
  useAppStore.setState({
    instances: [instance],
    logs: [],
    currentDay: TODAY,
    levelCrossed: null,
    pendingJourneyMinutes: 0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('unlogPractice', () => {
  it('takes back a tick within its first minute, here and on the server', async () => {
    const log = await tick();
    vi.setSystemTime(NOW + 59_000);

    await useAppStore.getState().unlogPractice(log.id);

    expect(await db.practiceLogs.count()).toBe(0);
    expect(useAppStore.getState().logs).toEqual([]);
    expect(deletesQueued).toEqual([{ table: 'practice_completed', id: log.id }]);
    expect(tracked).toEqual([{
      name: 'practice_unticked',
      properties: {
        log_id: log.id,
        practice_id: 'isha-kriya',
        instance: 1,
        minutes: 12,
        local_date: TODAY,
        backtrack: false,
      },
    }]);
  });

  it('takes a tick back only once when tapped twice quickly', async () => {
    const log = await tick();

    await Promise.all([
      useAppStore.getState().unlogPractice(log.id),
      useAppStore.getState().unlogPractice(log.id),
    ]);

    expect(deletesQueued).toHaveLength(1);
    expect(tracked).toHaveLength(1);
  });

  it('gives the minutes back to the journey', async () => {
    const log = await tick();
    expect(useAppStore.getState().pendingJourneyMinutes).toBe(12);

    await useAppStore.getState().unlogPractice(log.id);

    expect(useAppStore.getState().pendingJourneyMinutes).toBe(0);
    expect((await db.appMeta.get('meta'))?.pendingJourneyMinutes).toBe(0);
  });

  it('locks the tick once the minute is up', async () => {
    const log = await tick();
    vi.setSystemTime(NOW + 60_000);

    await useAppStore.getState().unlogPractice(log.id);

    expect(await db.practiceLogs.count()).toBe(1);
    expect(useAppStore.getState().logs).toEqual([log]);
    expect(deletesQueued).toEqual([]);
    expect(tracked).toEqual([]);
  });

  it('never takes back a practice finished in the player', async () => {
    await useAppStore.getState().logPractice('inst-1', 21, 'player');
    const [log] = useAppStore.getState().logs;

    await useAppStore.getState().unlogPractice(log.id);

    expect(await db.practiceLogs.count()).toBe(1);
    expect(deletesQueued).toEqual([]);
  });
});
