import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { AppearanceSettings } from './AppearanceSettings';
import { setThemeMode } from '@/services/theme';
import { track } from '@/services/instrumentation';

vi.mock('@/services/instrumentation', () => ({ track: vi.fn() }));
// The real wheels scroll to pick a time, which jsdom can't do.
vi.mock('./TimePicker', () => ({
  TimePicker: ({ onChange }: { onChange: (time: string) => void }) => (
    <button type="button" onClick={() => onChange('21:30')}>Pick 9:30 PM</button>
  ),
}));

describe('AppearanceSettings', () => {
  beforeEach(() => {
    // Node ships its own (unconfigured) `localStorage` global that shadows jsdom's.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    setThemeMode('auto');
    vi.mocked(track).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens on Auto with the default dark window', () => {
    render(<AppearanceSettings />);
    expect(screen.getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Dark mode starts').nextSibling?.textContent).toBe('6:00 PM');
    expect(screen.getByText('Dark mode ends').nextSibling?.textContent).toBe('6:00 AM');
  });

  it('switches to Dark and hides the times, which only apply to Auto', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.queryByText('Dark mode starts')).toBeNull();
  });

  it('opens a time picker for the start time', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByText('Dark mode starts'));
    expect(screen.getByRole('button', { name: 'Set time' })).not.toBeNull();
  });

  it('records a switch, with the mode it came from', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(track).toHaveBeenCalledWith('theme_changed', { from: 'auto', to: 'dark' });
  });

  it('records nothing when the current mode is tapped again', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(track).not.toHaveBeenCalled();
  });

  it('records a new dark-mode window when a time is changed', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByText('Dark mode starts'));
    fireEvent.click(screen.getByRole('button', { name: 'Pick 9:30 PM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set time' }));
    expect(track).toHaveBeenCalledWith('dark_window_changed', { start: '21:30', end: '06:00' });
    expect(screen.getByText('Dark mode starts').nextSibling?.textContent).toBe('9:30 PM');
  });

  it('records nothing when a time is confirmed unchanged', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByText('Dark mode ends'));
    fireEvent.click(screen.getByRole('button', { name: 'Set time' }));
    expect(track).not.toHaveBeenCalled();
  });
});
