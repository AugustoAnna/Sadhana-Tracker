import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { applyUrlSwitch, readTheme, setTheme, useThemeStore } from './theme';

describe('theme', () => {
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
    document.head.innerHTML = '<meta name="theme-color" content="#0D8A7A">';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    visit('');
  });

  it('is dark until someone picks light', () => {
    expect(readTheme()).toBe('dark');
    setTheme('light');
    expect(readTheme()).toBe('light');
    setTheme('dark');
    expect(readTheme()).toBe('dark');
  });

  it('applies and saves the theme picked in Settings', () => {
    setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(store.get('theme-override')).toBe('dark');

    setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(store.get('theme-override')).toBe('light');
  });

  it('replaces the theme-color tag when the theme changes, so Android repaints its status bar', () => {
    setTheme('light');
    const before = document.querySelector('meta[name="theme-color"]');
    setTheme('dark');
    const after = document.querySelectorAll('meta[name="theme-color"]');
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before);
    expect(after[0].getAttribute('content')).toBe('#141311');
  });

  it('sets the same choice from ?theme=, and ignores values it does not know', () => {
    visit('?theme=dark');
    applyUrlSwitch();
    expect(store.get('theme-override')).toBe('dark');

    visit('?theme=purple');
    applyUrlSwitch();
    expect(store.get('theme-override')).toBe('dark');

    visit('?theme=light');
    applyUrlSwitch();
    expect(store.get('theme-override')).toBe('light');
  });
});
