/**
 * Nine heat bands, reading pale green → green → teal → blue → the app's dark
 * teal navy #172935, with the top band breaking to bright orange #FF7236.
 *
 * Nine, not twelve: at twelve the steps sat ~0.04 apart in lightness against a
 * 0.06 floor, because telling twelve apart needs a lightness range of 0.66 and
 * only 0.45 exists between a light end that clears the card and a dark end that
 * stays legible. Nine clears it.
 *
 * Lightness falls step by step through band 8 so the sequence survives
 * greyscale; band 9 jumps back up on purpose, so the longest practices flare
 * rather than reading as more dark blue.
 *
 * Every band is darker than COLOR_NO_PRACTICE: a practised day must never read
 * lighter than an empty one.
 */
export const HEAT_MAP_COLORS = [
  { min: 0, max: 0, color: '#FFFFFF', empty: true },
  { min: 1, max: 10, color: '#B8D4C5' },
  { min: 11, max: 20, color: '#80C2A7' },
  { min: 21, max: 30, color: '#2EB08E' },
  { min: 31, max: 45, color: '#009491' },
  { min: 46, max: 60, color: '#00759C' },
  { min: 61, max: 80, color: '#2C46A8' },
  { min: 81, max: 100, color: '#193C64' },
  { min: 101, max: 125, color: '#1D2830' },
  { min: 126, max: Infinity, color: '#FF7236' },
];

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const band = HEAT_MAP_COLORS.find(
    (b) => minutes >= b.min && minutes <= b.max,
  )!;
  return { color: band.color, empty: !!band.empty };
}

export const POST_PRACTICE_MIN_DURATION_MS = 5000;
