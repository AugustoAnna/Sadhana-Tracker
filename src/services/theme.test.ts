import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  applyUrlSwitch,
  isDarkTime,
  msUntilNextBoundary,
  resolveTheme,
  setDarkWindow,
  setThemeMode,
  useThemeStore,
} from './theme';

const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m, 0, 0);
const minutes = (ms: number) => Math.round(ms / 60_000);

describe('isDarkTime', () => {
  it('defaults to dark from 6pm until 6am', () => {
    expect(isDarkTime(at(17, 59))).toBe(false);
    expect(isDarkTime(at(18, 0))).toBe(true);
    expect(isDarkTime(at(23, 30))).toBe(true);
    expect(isDarkTime(at(0, 0))).toBe(true);
    expect(isDarkTime(at(5, 59))).toBe(true);
    expect(isDarkTime(at(6, 0))).toBe(false);
    expect(isDarkTime(at(12, 0))).toBe(false);
  });

  it('runs a window that starts after it ends across midnight', () => {
    const late = { start: '21:30', end: '07:15' };
    expect(isDarkTime(at(21, 29), late)).toBe(false);
    expect(isDarkTime(at(21, 30), late)).toBe(true);
    expect(isDarkTime(at(7, 14), late)).toBe(true);
    expect(isDarkTime(at(7, 15), late)).toBe(false);
  });

  it('keeps a same-day window inside the day', () => {
    const afternoon = { start: '13:00', end: '15:00' };
    expect(isDarkTime(at(12, 59), afternoon)).toBe(false);
    expect(isDarkTime(at(13, 0), afternoon)).toBe(true);
    expect(isDarkTime(at(15, 0), afternoon)).toBe(false);
    expect(isDarkTime(at(23, 0), afternoon)).toBe(false);
  });

  it('treats a window that starts and ends at the same time as empty', () => {
    const empty = { start: '20:00', end: '20:00' };
    expect(isDarkTime(at(20, 0), empty)).toBe(false);
    expect(isDarkTime(at(3, 0), empty)).toBe(false);
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

  it('uses a custom window', () => {
    expect(resolveTheme(at(19), false, { start: '21:00', end: '05:00' })).toBe('light');
    expect(resolveTheme(at(22), false, { start: '21:00', end: '05:00' })).toBe('dark');
  });
});

describe('msUntilNextBoundary', () => {
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

  it('uses the minutes of a custom window', () => {
    const late = { start: '21:30', end: '07:15' };
    expect(minutes(msUntilNextBoundary(at(21, 0), late))).toBe(30);
    expect(minutes(msUntilNextBoundary(at(22, 0), late))).toBe(9 * 60 + 15);
  });
});

describe('settings', () => {
  const visit = (search: string) => window.history.replaceState(null, '', `/${search}`);
  let store: Map<string, string>;

  beforeEach(() => {
    // Node ships its own (unconfigured) `localStorage` global that shadows jsdom's.
    store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    vi.useFakeTimers();
    vi.setSystemTime(at(12));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    visit('');
  });

  it('pins light or dark regardless of the clock, and Auto goes back to it', () => {
    setThemeMode('dark');
    expect(useThemeStore.getState()).toMatchObject({ mode: 'dark', theme: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');

    vi.setSystemTime(at(20));
    setThemeMode('light');
    expect(useThemeStore.getState()).toMatchObject({ mode: 'light', theme: 'light' });

    setThemeMode('auto');
    expect(useThemeStore.getState()).toMatchObject({ mode: 'auto', theme: 'dark' });
    expect(store.has('theme-override')).toBe(false);
  });

  it('saves a new dark window and applies it straight away', () => {
    setThemeMode('auto');
    expect(useThemeStore.getState().theme).toBe('light');

    setDarkWindow({ start: '11:00', end: '14:00' });
    expect(useThemeStore.getState()).toMatchObject({
      theme: 'dark',
      darkWindow: { start: '11:00', end: '14:00' },
    });
    expect(store.get('theme-window')).toBe('11:00-14:00');
  });

  it('ignores a saved window it cannot read', () => {
    store.set('theme-window', 'garbage');
    setThemeMode('auto');
    expect(useThemeStore.getState().darkWindow).toEqual({ start: '18:00', end: '06:00' });
  });

  it('sets the same mode from ?theme=, and ignores values it does not know', () => {
    visit('?theme=dark');
    applyUrlSwitch();
    expect(store.get('theme-override')).toBe('dark');

    visit('?theme=purple');
    applyUrlSwitch();
    expect(store.get('theme-override')).toBe('dark');

    visit('?theme=auto');
    applyUrlSwitch();
    expect(store.has('theme-override')).toBe(false);
  });
});

describe('theme-color tag', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    document.head.innerHTML = '<meta name="theme-color" content="#0D8A7A">';
  });

  afterEach(() => vi.unstubAllGlobals());

  it('replaces the tag when the theme changes, so Android repaints its status bar', () => {
    const before = document.querySelector('meta[name="theme-color"]');
    setThemeMode('dark');
    const after = document.querySelectorAll('meta[name="theme-color"]');
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before);
    expect(after[0].getAttribute('content')).toBe('#141311');
  });
});
