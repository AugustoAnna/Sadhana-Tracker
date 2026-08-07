import type { LevelInfo } from '@/types';

const LEVEL_LABELS: Record<number, string> = {
  0: 'Seed',
  1: 'Dormant Seed',
  2: 'Swelling',
  3: 'First Crack',
  4: 'Reaching Down',
  5: 'Two Roots',
  6: 'Many Roots',
  7: 'Root Hairs',
};

const PHASES = [
  { phase: 1, name: 'Roots', startLevel: 1, endLevel: 16 },
  { phase: 2, name: 'TBD-PM', startLevel: 17, endLevel: 32 },
  { phase: 3, name: 'TBD-PM', startLevel: 33, endLevel: 48 },
  { phase: 4, name: 'TBD-PM', startLevel: 49, endLevel: 64 },
];

const PHASE_THRESHOLDS: Record<number, number> = {
  2: 172036,
  3: 493687,
  4: 1043018,
};

export function journeyThreshold(level: number): number {
  if (level <= 0) return 0;
  return Math.round(21 * Math.pow(level, 2.6));
}

export function getLevelLabel(level: number): string {
  if (level === 0) return LEVEL_LABELS[0];
  return LEVEL_LABELS[level] ?? `TBD-PM`;
}

export function getPhaseForLevel(level: number) {
  return PHASES.find((p) => level >= p.startLevel && level <= p.endLevel) ?? PHASES[0];
}

export function getLevelInfo(level: number): LevelInfo {
  const phase = getPhaseForLevel(level);
  return {
    level,
    label: getLevelLabel(level),
    threshold: journeyThreshold(level),
    phase: phase.phase,
    phaseName: phase.name,
  };
}

export function computeCurrentLevel(totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  for (let level = 16; level >= 1; level--) {
    if (totalMinutes >= journeyThreshold(level)) return level;
  }
  return 0;
}

export function computeJourneyProgress(totalMinutes: number) {
  const currentLevel = computeCurrentLevel(totalMinutes);
  const nextLevel = Math.min(currentLevel + 1, 16);
  const currentThreshold = journeyThreshold(currentLevel);
  const nextThreshold = journeyThreshold(nextLevel);
  const range = nextThreshold - currentThreshold;
  const progressInLevel = range > 0
    ? Math.min(1, (totalMinutes - currentThreshold) / range)
    : 1;
  const minutesToNext = Math.max(0, nextThreshold - totalMinutes);

  return {
    currentLevel,
    nextLevel,
    currentThreshold,
    nextThreshold,
    progressInLevel,
    minutesToNext,
    totalMinutes,
  };
}

export function getPhaseThreshold(phase: number): number {
  return PHASE_THRESHOLDS[phase] ?? journeyThreshold(16);
}

export { PHASES };
