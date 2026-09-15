/**
 * Twelve heat bands running green → teal → blue, from #80C2A7 to #2D47A6.
 *
 * The scale carries no orange and no near-black: it stops well short of the
 * app's #172935, so the calendar stays a cool field rather than ending in a
 * flare. Hue does most of the ordering work — across this narrower span the
 * lightness steps are only ~0.03 apart, so green-vs-blue is what separates a
 * long practice from a short one.
 *
 * Every band is darker than COLOR_NO_PRACTICE: a practised day must never read
 * lighter than an empty one.
 */
export const HEAT_MAP_COLORS = [
  { min: 0, max: 0, color: '#FFFFFF', empty: true },
  { min: 1, max: 10, color: '#80C2A7' },
  { min: 11, max: 20, color: '#6BBAA6' },
  { min: 21, max: 30, color: '#54B2A6' },
  { min: 31, max: 45, color: '#3BA9A7' },
  { min: 46, max: 60, color: '#1D9FA8' },
  { min: 61, max: 80, color: '#0094B4' },
  { min: 81, max: 100, color: '#0086BF' },
  { min: 101, max: 125, color: '#1D75C6' },
  { min: 126, max: 150, color: '#4260C8' },
  { min: 151, max: 180, color: '#3B58BD' },
  { min: 181, max: 239, color: '#334FB3' },
  { min: 240, max: Infinity, color: '#2D47A6' },
];

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const band = HEAT_MAP_COLORS.find(
    (b) => minutes >= b.min && minutes <= b.max,
  )!;
  return { color: band.color, empty: !!band.empty };
}

export const POST_PRACTICE_MIN_DURATION_MS = 5000;
