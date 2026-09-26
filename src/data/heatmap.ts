import type { Theme } from '@/services/theme';

export const HEATMAP_SHADES = [
  '#C2EBDC',
  '#9EE0C9',
  '#7CD5B6',
  '#5DCAA5',
  '#45BE96',
  '#31B188',
  '#22A47B',
  '#17966F',
  '#0F8764',
  '#0A7659',
  '#07634D',
  '#044034',
] as const;

/**
 * Dark theme: the same greens reversed, so more practice reads brighter
 * against a dark card (the light ramp would sink the heaviest days into the
 * background). The deepest light shade is lifted so band 0 stays visible.
 */
export const HEATMAP_SHADES_DARK = [
  '#0A4F41',
  '#07634D',
  '#0A7659',
  '#0F8764',
  '#17966F',
  '#22A47B',
  '#31B188',
  '#45BE96',
  '#5DCAA5',
  '#7CD5B6',
  '#9EE0C9',
  '#C2EBDC',
] as const;

export function heatmapShades(theme: Theme = 'light'): readonly string[] {
  return theme === 'dark' ? HEATMAP_SHADES_DARK : HEATMAP_SHADES;
}

export const HEATMAP_EMPTY_DARK = 'rgba(255,255,255,0.07)';
export const HEATMAP_EMPTY_LIGHT = 'rgba(0,0,0,0.06)';

/** Light theme is the app default; use light empty-cell colour. */
export const HEATMAP_EMPTY = HEATMAP_EMPTY_LIGHT;

const BAND_TOP = [5, 10, 15, 20, 30, 45, 60, 95, 135, 180, 239, Infinity];

/** Returns 0-11 for a banded day, or -1 for an empty day. */
export function heatmapBand(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return -1;
  const m = Math.max(1, Math.round(minutes));
  for (let i = 0; i < BAND_TOP.length; i++) {
    if (m <= BAND_TOP[i]) return i;
  }
  return 11;
}

export function heatmapColor(minutes: number, theme: Theme = 'light'): string {
  const b = heatmapBand(minutes);
  if (b < 0) return theme === 'dark' ? HEATMAP_EMPTY_DARK : HEATMAP_EMPTY;
  return heatmapShades(theme)[b];
}

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const b = heatmapBand(minutes);
  return { color: heatmapColor(minutes), empty: b < 0 };
}
