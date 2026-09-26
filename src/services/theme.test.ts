import { describe, it, expect } from 'vitest';
import { isNight, msUntilNextBoundary, resolveTheme } from './theme';

const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m, 0, 0);

describe('isNight', () => {
  it('turns dark at 6pm and back to light at 6am', () => {
    expect(isNight(at(17, 59))).toBe(false);
    expect(isNight(at(18, 0))).toBe(true);
    expect(isNight(at(23, 30))).toBe(true);
    expect(isNight(at(0, 0))).toBe(true);
    expect(isNight(at(5, 59))).toBe(true);
    expect(isNight(at(6, 0))).toBe(false);
    expect(isNight(at(12, 0))).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('follows the clock when the device is in light mode', () => {
    expect(resolveTheme(at(10), false)).toBe('light');
    expect(resolveTheme(at(19), false)).toBe('dark');
  });

  it('is always dark when the device asks for dark', () => {
    expect(resolveTheme(at(10), true)).toBe('dark');
  });
});

describe('msUntilNextBoundary', () => {
  const minutes = (ms: number) => Math.round(ms / 60_000);

  it('points at 6pm during the day', () => {
    expect(minutes(msUntilNextBoundary(at(17, 0)))).toBe(60);
  });

  it('points at 6am before dawn', () => {
    expect(minutes(msUntilNextBoundary(at(5, 0)))).toBe(60);
  });

  it('points at tomorrow 6am in the evening', () => {
    expect(minutes(msUntilNextBoundary(at(22, 0)))).toBe(8 * 60);
  });

  it('moves past a boundary it is sitting on', () => {
    expect(msUntilNextBoundary(at(18, 0))).toBeGreaterThan(0);
    expect(minutes(msUntilNextBoundary(new Date(2026, 8, 26, 18, 0, 1, 0)))).toBe(12 * 60);
  });
});
