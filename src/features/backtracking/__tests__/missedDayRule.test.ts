import { describe, it, expect } from 'vitest';
import type { PracticeInstance, PracticeLog } from '@/types';
import { missedDayDecision } from '../missedDayRule';

const TODAY = '2026-09-30';

function addedOn(day: string): PracticeInstance {
  return { id: `inst-${day}`, practiceId: 'isha-kriya', instanceNumber: 1, order: 0, addedAt: Date.parse(`${day}T09:00:00`) };
}

function loggedOn(day: string): PracticeLog {
  return {
    id: `log-${day}`,
    practiceId: 'isha-kriya',
    instanceId: 'inst',
    minutes: 14,
    timestamp: Date.parse(`${day}T07:00:00`),
    localDate: day,
    source: 'checkbox',
  };
}

const setUpLongAgo = [addedOn('2026-09-01')];

describe('missedDayDecision', () => {
  it('stays quiet with an empty list', () => {
    expect(missedDayDecision([loggedOn('2026-09-20')], [], null, TODAY)).toEqual({ show: false });
  });

  it('stays quiet when the list was set up today', () => {
    expect(missedDayDecision([], [addedOn(TODAY)], null, TODAY)).toEqual({ show: false });
  });

  it('uses the earliest practice for the setup day', () => {
    const instances = [addedOn(TODAY), addedOn('2026-09-29')];
    expect(missedDayDecision([], instances, null, TODAY)).toMatchObject({ show: true, runKey: '2026-09-29' });
  });

  it('stays quiet when yesterday has a log', () => {
    expect(missedDayDecision([loggedOn('2026-09-29')], setUpLongAgo, null, TODAY)).toEqual({ show: false });
  });

  it('asks about a single missed day (variant 1)', () => {
    expect(missedDayDecision([loggedOn('2026-09-28')], setUpLongAgo, null, TODAY))
      .toEqual({ show: true, variant: 1, gapDays: 1, runKey: '2026-09-29' });
  });

  it.each([
    [2, '2026-09-27', 2],
    [7, '2026-09-22', 2],
    [8, '2026-09-21', 3],
  ])('bands %i empty days', (gapDays, lastLog, variant) => {
    expect(missedDayDecision([loggedOn(lastLog)], setUpLongAgo, null, TODAY))
      .toMatchObject({ show: true, variant, gapDays });
  });

  it('still asks when today is already logged', () => {
    const logs = [loggedOn('2026-09-28'), loggedOn(TODAY)];
    expect(missedDayDecision(logs, setUpLongAgo, null, TODAY)).toMatchObject({ show: true, runKey: '2026-09-29' });
  });

  it('starts the run on setup day when nothing was ever logged', () => {
    expect(missedDayDecision([], [addedOn('2026-09-25')], null, TODAY))
      .toEqual({ show: true, variant: 2, gapDays: 5, runKey: '2026-09-25' });
  });

  it('starts the run on setup day when the last log predates setup', () => {
    // Logs from a previous list; the gap only counts days the list existed.
    expect(missedDayDecision([loggedOn('2026-08-01')], [addedOn('2026-09-28')], null, TODAY))
      .toMatchObject({ runKey: '2026-09-28', gapDays: 2 });
  });

  it('shows once per run', () => {
    const logs = [loggedOn('2026-09-20')];
    expect(missedDayDecision(logs, setUpLongAgo, '2026-09-21', TODAY)).toEqual({ show: false });
    // The next day the run is unchanged, so it stays quiet.
    expect(missedDayDecision(logs, setUpLongAgo, '2026-09-21', '2026-10-01')).toEqual({ show: false });
  });

  it('asks again after a new log starts a new run', () => {
    const logs = [loggedOn('2026-09-20'), loggedOn('2026-09-25')];
    expect(missedDayDecision(logs, setUpLongAgo, '2026-09-21', TODAY)).toMatchObject({ show: true, runKey: '2026-09-26' });
  });
});
