/**
 * Twelve heat bands (§8.5), reading pale green → green → teal → blue → the app's
 * dark teal navy #172935, with the top band breaking to bright orange #FF7236.
 *
 * Hue carries the order here, not lightness alone — which is what lets twelve
 * bands stay apart at all. Lightness still falls step by step through band 11 so
 * the sequence survives greyscale; band 12 deliberately jumps back up, because
 * the longest practices should read as a flare, not as more dark blue.
 *
 * Every band is darker than COLOR_NO_PRACTICE: a practised day must never read
 * lighter than an empty one.
 */
export const HEAT_MAP_COLORS = [
  { min: 0, max: 0, color: '#FFFFFF', empty: true },
  { min: 1, max: 10, color: '#B8D4C5' },
  { min: 11, max: 20, color: '#93C7B0' },
  { min: 21, max: 30, color: '#68BB9D' },
  { min: 31, max: 45, color: '#2AAE8C' },
  { min: 46, max: 60, color: '#009A90' },
  { min: 61, max: 80, color: '#00858E' },
  { min: 81, max: 100, color: '#006DA4' },
  { min: 101, max: 125, color: '#2E48AC' },
  { min: 126, max: 150, color: '#1C427C' },
  { min: 151, max: 180, color: '#1A3752' },
  { min: 181, max: 239, color: '#1D2830' },
  { min: 240, max: Infinity, color: '#FF7236' },
];

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const band = HEAT_MAP_COLORS.find(
    (b) => minutes >= b.min && minutes <= b.max,
  )!;
  return { color: band.color, empty: !!band.empty };
}

export const POST_PRACTICE_MIN_DURATION_MS = 5000;
