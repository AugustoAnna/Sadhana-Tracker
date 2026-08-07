export const HEAT_MAP_COLORS = [
  { min: 0, max: 0, color: '#FFFFFF', empty: true },
  { min: 1, max: 10, color: '#FBDFB2' },
  { min: 11, max: 20, color: '#F9D08F' },
  { min: 21, max: 30, color: '#F7BF6E' },
  { min: 31, max: 45, color: '#F4AD4E' },
  { min: 46, max: 60, color: '#F09A32' },
  { min: 61, max: 80, color: '#E8871F' },
  { min: 81, max: 100, color: '#DC7317' },
  { min: 101, max: 125, color: '#CC5F12' },
  { min: 126, max: 150, color: '#B94D0F' },
  { min: 151, max: 180, color: '#A33C0D' },
  { min: 181, max: 239, color: '#8A2C0B' },
  { min: 240, max: Infinity, color: '#6E1D08' },
];

export function getHeatMapColor(minutes: number): { color: string; empty: boolean } {
  const band = HEAT_MAP_COLORS.find(
    (b) => minutes >= b.min && minutes <= b.max,
  )!;
  return { color: band.color, empty: !!band.empty };
}

export const POST_PRACTICE_MIN_DURATION_MS = 5000;

export const START_HERE_MEDITATOR = ['shambhavi', 'mahamantra', 'shoonya'];
export const START_HERE_POTENTIAL = ['isha-kriya', 'ie-crash-course', 'mahamantra'];
