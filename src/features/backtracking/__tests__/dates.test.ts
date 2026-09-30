import { describe, it, expect } from 'vitest';
import type { PracticeLog } from '@/types';
import {
  isInstanceCompletedOn, isInstanceCompletedTwiceOn, getTimedMinutesOn, getPracticesCompletedOn,
} from '@/utils/dates';
import { yesterdayOf } from '../dates';

describe('yesterdayOf', () => {
  it.each([
    ['2026-09-30', '2026-09-29'],
    ['2026-10-01', '2026-09-30'],
    ['2026-03-01', '2026-02-28'],
    ['2028-03-01', '2028-02-29'],
    ['2026-01-01', '2025-12-31'],
    // Clocks change in the US and the EU around these dates.
    ['2026-03-09', '2026-03-08'],
    ['2026-03-30', '2026-03-29'],
    ['2026-10-26', '2026-10-25'],
  ])('%s → %s', (day, expected) => {
    expect(yesterdayOf(day)).toBe(expected);
  });
});

function log(instanceId: string, localDate: string, minutes: number): PracticeLog {
  // A backtracked row: written today, for the day in localDate.
  return {
    id: `${instanceId}-${localDate}-${minutes}`,
    practiceId: 'isha-kriya',
    instanceId,
    minutes,
    timestamp: Date.parse('2026-09-30T08:00:00'),
    localDate,
    source: 'checkbox',
  };
}

describe('per-day helpers', () => {
  const logs = [
    log('a', '2026-09-29', 12),
    log('a', '2026-09-29', 8),
    log('b', '2026-09-29', 20),
    log('b', '2026-09-30', 5),
  ];

  it('read the day they are given, not the write time', () => {
    expect(isInstanceCompletedOn(logs, 'a', '2026-09-29')).toBe(true);
    expect(isInstanceCompletedOn(logs, 'a', '2026-09-30')).toBe(false);
  });

  it('count twice-done per day', () => {
    expect(isInstanceCompletedTwiceOn(logs, 'a', '2026-09-29')).toBe(true);
    expect(isInstanceCompletedTwiceOn(logs, 'b', '2026-09-29')).toBe(false);
  });

  it('sum timed minutes per day', () => {
    expect(getTimedMinutesOn(logs, 'a', '2026-09-29')).toBe(20);
    expect(getTimedMinutesOn(logs, 'b', '2026-09-30')).toBe(5);
  });

  it('count distinct instances per day', () => {
    expect(getPracticesCompletedOn(logs, '2026-09-29')).toBe(2);
    expect(getPracticesCompletedOn(logs, '2026-09-30')).toBe(1);
  });
});
