import { create } from 'zustand';

export type Theme = 'light' | 'dark';

// Per-device, like the device's own appearance setting. index.html reads the
// same key before first paint, so keep the two in step.
const THEME_KEY = 'theme-override';

/** Status-bar colour per theme; dark matches `--color-page` in dark mode. */
const THEME_COLOR: Record<Theme, string> = {
  light: '#0D8A7A',
  dark: '#141311',
};

/** The theme picked in Settings on this device; dark until someone picks light. */
export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the choice still applies until the app is closed.
  }
}

/**
 * Testing switch: `?theme=dark` or `?theme=light` sets the same choice as
 * Settings. Read once at startup so a URL that keeps the query string doesn't
 * override a later choice in Settings.
 */
export function applyUrlSwitch(): void {
  const param = new URLSearchParams(window.location.search).get('theme');
  if (param === 'dark' || param === 'light') writeTheme(param);
}

export const useThemeStore = create<{ theme: Theme }>(() => ({
  theme: (document.documentElement.dataset.theme as Theme) === 'dark' ? 'dark' : 'light',
}));

/**
 * Swaps in a fresh theme-color tag rather than editing the existing one:
 * Android Chrome keeps painting the status bar from the tag it first saw and
 * doesn't repaint when only its content changes.
 */
function setThemeColor(color: string): void {
  const current = document.querySelector('meta[name="theme-color"]');
  if (current?.getAttribute('content') === color) return;
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = color;
  if (current) current.replaceWith(meta);
  else document.head.appendChild(meta);
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  setThemeColor(THEME_COLOR[theme]);
  useThemeStore.setState({ theme });
}

export function setTheme(theme: Theme): void {
  writeTheme(theme);
  applyTheme(theme);
}

let initialized = false;

/** index.html sets the first theme before paint; this takes over from there. */
export function initTheme(): void {
  if (initialized) return;
  initialized = true;
  applyUrlSwitch();
  applyTheme(readTheme());
}
