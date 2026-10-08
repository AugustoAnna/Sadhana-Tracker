import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { AppearanceSettings } from './AppearanceSettings';
import { setTheme } from '@/services/theme';

describe('AppearanceSettings', () => {
  beforeEach(() => {
    // Node ships its own (unconfigured) `localStorage` global that shadows jsdom's.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    setTheme('light');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers only Light and Dark, with Light selected', () => {
    render(<AppearanceSettings />);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Light', 'Dark']);
    expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true');
  });

  it('switches to Dark', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
