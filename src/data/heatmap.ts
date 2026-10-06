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

export function heatmapColor(minutes: number): string {
  const b = heatmapBand(minutes);
  return b < 0 ? HEATMAP_EMPTY : HEATMAP_SHADES[b];
}

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const b = heatmapBand(minutes);
  return { color: heatmapColor(minutes), empty: b < 0 };
}
