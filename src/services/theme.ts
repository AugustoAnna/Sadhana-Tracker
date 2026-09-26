import { create } from 'zustand';

export type Theme = 'light' | 'dark';

/** Evening start and morning end of the dark window, in local hours. */
export const NIGHT_START_HOUR = 18;
export const NIGHT_END_HOUR = 6;

/** Status-bar colour per theme; dark matches `--color-page` in dark mode. */
const THEME_COLOR: Record<Theme, string> = {
  light: '#0D8A7A',
  dark: '#141311',
};

export function isNight(now: Date): boolean {
  const h = now.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

/** Dark after 6pm until 6am, and whenever the device itself asks for dark. */
export function resolveTheme(now: Date, systemPrefersDark: boolean): Theme {
  return systemPrefersDark || isNight(now) ? 'dark' : 'light';
}

/** Milliseconds until the clock next crosses 6am or 6pm. */
export function msUntilNextBoundary(now: Date): number {
  const at = (dayOffset: number, hour: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 1, 0);
  const candidates = [
    at(0, NIGHT_END_HOUR),
    at(0, NIGHT_START_HOUR),
    at(1, NIGHT_END_HOUR),
  ];
  const next = candidates.find((d) => d.getTime() > now.getTime())!;
  return next.getTime() - now.getTime();
}

export const useThemeStore = create<{ theme: Theme }>(() => ({
  theme: (document.documentElement.dataset.theme as Theme) === 'dark' ? 'dark' : 'light',
}));

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  if (useThemeStore.getState().theme !== theme) useThemeStore.setState({ theme });
}

const OVERRIDE_KEY = 'theme-override';

/**
 * Testing switch: `?theme=dark` or `?theme=light` pins the theme on this
 * device regardless of the clock, `?theme=auto` goes back to it. Remembered so
 * it survives in-app navigation dropping the query string.
 */
export function readOverride(): Theme | null {
  try {
    const param = new URLSearchParams(window.location.search).get('theme');
    if (param === 'dark' || param === 'light') localStorage.setItem(OVERRIDE_KEY, param);
    else if (param === 'auto') localStorage.removeItem(OVERRIDE_KEY);
    const stored = localStorage.getItem(OVERRIDE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function refresh(): void {
  applyTheme(readOverride() ?? resolveTheme(new Date(), darkQuery()?.matches ?? false));
}

let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function scheduleBoundary(): void {
  if (boundaryTimer) clearTimeout(boundaryTimer);
  boundaryTimer = setTimeout(() => {
    refresh();
    scheduleBoundary();
  }, msUntilNextBoundary(new Date()));
}

/**
 * Keeps the theme in step with the clock and the device setting.
 *
 * index.html sets the first theme before paint so there is no light flash at
 * night; this takes over from there. Like the day rollover, a timer covers the
 * app being left open across 6am/6pm, and the foreground signals cover an
 * installed PWA resumed from the background, where timers were suspended.
 */
export function initTheme(): void {
  if (initialized) return;
  initialized = true;
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
