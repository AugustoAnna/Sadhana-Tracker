import { describe, it, expect } from 'vitest';
import { backtrackPayload, backtrackWindow, isFirstMorningGeneric, pushEnvironments, type MorningReminder } from './backtrack';

function reminder(id: string, time_local: string, overrides: Partial<MorningReminder> = {}): MorningReminder {
  return { id, kind: 'generic', time_local, environment: 'study', ...overrides };
}

describe('isFirstMorningGeneric', () => {
  const six = reminder('a', '06:00:00');
  const nine = reminder('b', '09:30:00');
  const evening = reminder('c', '19:00:00');

  it('picks the earliest generic reminder before noon', () => {
    const all = [nine, six, evening];
    expect(isFirstMorningGeneric(six, all)).toBe(true);
    expect(isFirstMorningGeneric(nine, all)).toBe(false);
  });

  it('never picks one at or after noon', () => {
    expect(isFirstMorningGeneric(evening, [evening])).toBe(false);
    expect(isFirstMorningGeneric(reminder('n', '12:00:00'), [reminder('n', '12:00:00')])).toBe(false);
  });

  it('never replaces a practice reminder, and skips them when finding the first', () => {
    const presence = reminder('p', '05:00:00', { kind: 'practice' });
    expect(isFirstMorningGeneric(presence, [presence, six])).toBe(false);
    expect(isFirstMorningGeneric(six, [presence, six])).toBe(true);
  });

  it('only compares reminders in the same environment', () => {
    const labEarlier = reminder('l', '05:00:00', { environment: 'lab' });
    expect(isFirstMorningGeneric(six, [labEarlier, six])).toBe(true);
  });

  it('breaks a tie on time by id, so exactly one qualifies', () => {
    const x = reminder('x', '07:00:00');
    const y = reminder('y', '07:00:00');
    expect([isFirstMorningGeneric(x, [x, y]), isFirstMorningGeneric(y, [x, y])]).toEqual([true, false]);
  });
});

describe('pushEnvironments', () => {
  it('reads one environment or a list', () => {
    expect([...pushEnvironments('lab')]).toEqual(['lab']);
    expect([...pushEnvironments(' lab , study ')]).toEqual(['lab', 'study']);
  });

  it('is off when unset or empty', () => {
    expect(pushEnvironments(undefined).size).toBe(0);
    expect(pushEnvironments('').size).toBe(0);
  });

  it('never turns on the study by accident', () => {
    expect(pushEnvironments('true').has('study')).toBe(false);
    expect(pushEnvironments('lab').has('study')).toBe(false);
  });
});

describe('backtrackWindow', () => {
  it('looks at yesterday and the six days before it', () => {
    expect(backtrackWindow('2026-10-01')).toEqual({ yesterday: '2026-09-30', from: '2026-09-24', to: '2026-09-29' });
  });

  it('crosses year boundaries', () => {
    expect(backtrackWindow('2027-01-02')).toEqual({ yesterday: '2027-01-01', from: '2026-12-26', to: '2026-12-31' });
  });
});

describe('backtrackPayload', () => {
  it('carries the spec message and opens yesterday', () => {
    expect(JSON.parse(backtrackPayload(1, 'send-1', '2026-09-30'))).toEqual({
      title: 'Yesterday can still count',
      body: 'Practiced yesterday? Add it to your record.',
      kind: 'backtrack',
      tag: 'backtrack',
      slot: 1,
      send_id: 'send-1',
      url: '/practice-home?day=yesterday&via=push&for=2026-09-30',
    });
  });
});
