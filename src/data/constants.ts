/**
 * Twelve heat bands (§8.5), stepped from the official Sadhguru app palette:
 * col_orange_2 #FF7236, col_orange #CE6113, ishaOrange #CE4520 sit in the ramp
 * verbatim, and the darker steps hold their hue while lightness and chroma fall.
 *
 * Every band is darker than COLOR_NO_PRACTICE on purpose — a practised day must
 * never read lighter than an empty one.
 */
export const HEAT_MAP_COLORS = [
  { min: 0, max: 0, color: '#FFFFFF', empty: true },
  { min: 1, max: 10, color: '#FD8B49' },
  { min: 11, max: 20, color: '#FF7236' },
  { min: 21, max: 30, color: '#E0712B' },
  { min: 31, max: 45, color: '#CE6113' },
  { min: 46, max: 60, color: '#CE4520' },
  { min: 61, max: 80, color: '#C33717' },
  { min: 81, max: 100, color: '#B6230C' },
  { min: 101, max: 125, color: '#A21F15' },
  { min: 126, max: 150, color: '#8D1F16' },
  { min: 151, max: 180, color: '#781E16' },
  { min: 181, max: 239, color: '#641B14' },
  { min: 240, max: Infinity, color: '#511811' },
];

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const band = HEAT_MAP_COLORS.find(
    (b) => minutes >= b.min && minutes <= b.max,
  )!;
  return { color: band.color, empty: !!band.empty };
}

export const POST_PRACTICE_MIN_DURATION_MS = 5000;
