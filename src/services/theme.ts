import { create } from 'zustand';

export type Theme = 'light' | 'dark';
/** What the person picked in Settings. Auto follows the dark window and the device. */
export type ThemeMode = Theme | 'auto';

/** Local times, `HH:mm`, when Auto turns dark and back to light. */
export interface DarkWindow {
  start: string;
  end: string;
}

export const DEFAULT_DARK_WINDOW: DarkWindow = { start: '18:00', end: '06:00' };

// Per-device, like the device's own appearance setting. index.html reads the
// same keys before first paint, so keep the two in step.
const MODE_KEY = 'theme-override';
const WINDOW_KEY = 'theme-window';
const WINDOW_PATTERN = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

/** Status-bar colour per theme; dark matches `--color-page` in dark mode. */
const THEME_COLOR: Record<Theme, string> = {
  light: '#0D8A7A',
  dark: '#141311',
};

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Whether `now` falls in the dark window. A window whose start is after its
 * end runs across midnight; one that starts and ends at the same time is empty.
 */
export function isDarkTime(now: Date, darkWindow: DarkWindow = DEFAULT_DARK_WINDOW): boolean {
  const t = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(darkWindow.start);
  const end = toMinutes(darkWindow.end);
  if (start === end) return false;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

/** Auto: dark inside the window, and whenever the device itself asks for dark. */
export function resolveTheme(
  now: Date,
  systemPrefersDark: boolean,
  darkWindow: DarkWindow = DEFAULT_DARK_WINDOW,
): Theme {
  return systemPrefersDark || isDarkTime(now, darkWindow) ? 'dark' : 'light';
}

/** Milliseconds until the clock next crosses the window's start or end. */
export function msUntilNextBoundary(now: Date, darkWindow: DarkWindow = DEFAULT_DARK_WINDOW): number {
  const at = (dayOffset: number, time: string) => {
    const minutes = toMinutes(time);
    return new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + dayOffset,
      Math.floor(minutes / 60), minutes % 60, 1, 0,
    ).getTime();
  };
  const upcoming = [0, 1]
    .flatMap((day) => [at(day, darkWindow.start), at(day, darkWindow.end)])
    .filter((t) => t > now.getTime());
  return Math.min(...upcoming) - now.getTime();
}

function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function readWindow(): DarkWindow {
  try {
    const stored = localStorage.getItem(WINDOW_KEY);
    if (stored && WINDOW_PATTERN.test(stored)) {
      const [start, end] = stored.split('-');
      return { start, end };
    }
  } catch {
    // Storage blocked: fall through to the default window.
  }
  return { ...DEFAULT_DARK_WINDOW };
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice still applies until the app is closed.
  }
}

/**
 * Testing switch: `?theme=dark`, `?theme=light` or `?theme=auto` sets the same
 * mode as Settings. Read once at startup so a URL that keeps the query string
 * doesn't override a later choice in Settings.
 */
export function applyUrlSwitch(): void {
  const param = new URLSearchParams(window.location.search).get('theme');
  if (param === 'dark' || param === 'light') writeStorage(MODE_KEY, param);
  else if (param === 'auto') writeStorage(MODE_KEY, null);
}

interface ThemeState {
  theme: Theme;
  mode: ThemeMode;
  darkWindow: DarkWindow;
}

export const useThemeStore = create<ThemeState>(() => ({
  theme: (document.documentElement.dataset.theme as Theme) === 'dark' ? 'dark' : 'light',
  mode: readMode(),
  darkWindow: readWindow(),
}));

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

function refresh(): void {
  const mode = readMode();
  const darkWindow = readWindow();
  const theme = mode === 'auto'
    ? resolveTheme(new Date(), darkQuery()?.matches ?? false, darkWindow)
    : mode;

  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  useThemeStore.setState({ theme, mode, darkWindow });
}

let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function scheduleBoundary(): void {
  if (boundaryTimer) clearTimeout(boundaryTimer);
  boundaryTimer = setTimeout(() => {
    refresh();
    scheduleBoundary();
  }, msUntilNextBoundary(new Date(), readWindow()));
}

export function setThemeMode(mode: ThemeMode): void {
  writeStorage(MODE_KEY, mode === 'auto' ? null : mode);
  refresh();
}

export function setDarkWindow(darkWindow: DarkWindow): void {
  writeStorage(WINDOW_KEY, `${darkWindow.start}-${darkWindow.end}`);
  refresh();
  scheduleBoundary();
}

/**
 * Keeps the theme in step with the clock and the device setting.
 *
 * index.html sets the first theme before paint so there is no light flash at
 * night; this takes over from there. Like the day rollover, a timer covers the
 * app being left open across a window boundary, and the foreground signals
 * cover an installed PWA resumed from the background, where timers were
 * suspended.
 */
export function initTheme(): void {
  if (initialized) return;
  initialized = true;
  applyUrlSwitch();
  refresh();
  darkQuery()?.addEventListener?.('change', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refresh();
      scheduleBoundary();
    }
  });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  scheduleBoundary();
}
