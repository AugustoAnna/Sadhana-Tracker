import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SadhanaDB } from '@/db';
import type { PracticeInstance } from '@/types';

const db = new SadhanaDB('LogPracticeWindowTest');
const queued: Array<{ table: string; payload: unknown }> = [];
const tracked: Array<{ name: string; properties: Record<string, unknown> }> = [];

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => db, isDemoDatabaseActive: () => false };
});
vi.mock('@/services/sync', () => ({
  queueSync: async (item: { table: string; payload: unknown }) => { queued.push(item); },
  getParticipantName: async () => null,
  fetchBannerTargets: async () => new Set<string>(),
}));
vi.mock('@/services/instrumentation', () => ({
  track: async (name: string, properties: Record<string, unknown>) => { tracked.push({ name, properties }); },
}));
// Journey on, so the level-up guard is exercised.
vi.mock('@/features', () => ({ isFeatureEnabled: () => true }));
vi.mock('@/services/audio', () => ({ precachePracticeAudio: () => {} }));
vi.mock('@/utils/practiceReminders', () => ({ syncPracticeReminders: async () => [] }));

import { useAppStore } from '@/stores/appStore';

const TODAY = '2026-09-30';
const YESTERDAY = '2026-09-29';

const instance: PracticeInstance = {
  id: 'inst-1',
  practiceId: 'isha-kriya',
  instanceNumber: 1,
  order: 0,
  addedAt: 0,
};

async function onlyRow() {
  const rows = await db.practiceLogs.toArray();
  expect(rows).toHaveLength(1);
  return rows[0];
}

beforeEach(async () => {
  await db.practiceLogs.clear();
  queued.length = 0;
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
  vi.restoreAllMocks();
});

describe('logPractice date window', () => {
  it('logs to currentDay by default, with no backtrack marker', async () => {
    await useAppStore.getState().logPractice('inst-1', 12, 'checkbox');

    const row = await onlyRow();
    expect(row.localDate).toBe(TODAY);
    expect(row).not.toHaveProperty('backtrack');
    expect(row).not.toHaveProperty('route');
    expect(tracked).toEqual([]);
  });

  it('logs to yesterday as a backtrack, defaulting the route to switcher', async () => {
    await useAppStore.getState().logPractice('inst-1', 12, 'checkbox', { date: YESTERDAY });

    const row = await onlyRow();
    expect(row.localDate).toBe(YESTERDAY);
    expect(row.backtrack).toBe(true);
    expect(row.route).toBe('switcher');
    expect(useAppStore.getState().logs).toContainEqual(row);
    expect(queued).toEqual([{ table: 'practice_completed', operation: 'insert', payload: row }]);
  });

  it('keeps the route it is given', async () => {
    await useAppStore.getState().logPractice('inst-1', 12, 'checkbox', { date: YESTERDAY, route: 'sheet' });

    expect((await onlyRow()).route).toBe('sheet');
  });

  it('fires practice_backtracked for a yesterday write', async () => {
    await useAppStore.getState().logPractice('inst-1', 20, 'minutes', { date: YESTERDAY, route: 'push' });

    const row = await onlyRow();
    expect(tracked).toEqual([{
      name: 'practice_backtracked',
      properties: {
        log_id: row.id,
        practice_id: 'isha-kriya',
        instance: 1,
        minutes: 20,
        local_date: YESTERDAY,
        route: 'push',
      },
    }]);
  });

  it.each([
    ['two days ago', '2026-09-28'],
    ['tomorrow', '2026-10-01'],
  ])('rejects %s without writing', async (_label, date) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await useAppStore.getState().logPractice('inst-1', 12, 'checkbox', { date });

    expect(await db.practiceLogs.count()).toBe(0);
    expect(queued).toEqual([]);
    expect(useAppStore.getState().logs).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('reads the day from currentDay, not the wall clock', async () => {
    // Just past midnight, before refreshDay has moved currentDay on: the write
    // follows the day the screen is showing.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 0, 0, 2));

    await useAppStore.getState().logPractice('inst-1', 12, 'checkbox');

    expect((await onlyRow()).localDate).toBe(TODAY);
  });

  it('logs a picker opened at 23:59 on Yesterday to that day when Add lands after midnight', async () => {
    // Opened on 30 Sep showing Yesterday (29 Sep); by Add, refreshDay has moved
    // currentDay to 1 Oct. The picker passes the day it was opened on.
    useAppStore.setState({ currentDay: '2026-10-01' });

    await useAppStore.getState().logPractice('inst-1', 20, 'minutes', {
      date: YESTERDAY,
      referenceDay: TODAY,
    });

    const row = await onlyRow();
    expect(row.localDate).toBe(YESTERDAY);
    expect(row.backtrack).toBe(true);
  });

  it('never sets levelCrossed from a yesterday write, but still counts its minutes', async () => {
    await useAppStore.getState().logPractice('inst-1', 100_000, 'minutes', { date: YESTERDAY });

    expect(useAppStore.getState().levelCrossed).toBeNull();
    expect(useAppStore.getState().pendingJourneyMinutes).toBe(100_000);
  });

  it('still sets levelCrossed from a today write', async () => {
    await useAppStore.getState().logPractice('inst-1', 100_000, 'minutes');

    expect(useAppStore.getState().levelCrossed).not.toBeNull();
  });
});
