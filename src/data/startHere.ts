import type { DrawnToType, DurationPreference } from '@/types';
import { PRACTICES } from './catalogue';

/** Practices that require a program — show Learn instead of Practice. */
export const PROGRAM_PRACTICE_IDS = new Set([
  'shambhavi',
  'guru-pooja',
  'angamardana',
  'yogasanas',
  'surya-kriya',
  'surya-shakti',
  'shakti-chalana',
  'shoonya',
  'bhuta-shuddhi',
  'jala-neti',
  'guru-mahima',
  'rudraksha-diksha',
  'shiva-namaskar',
  'devi-sadhana',
  'achala-arpanam',
  'samyama',
  'breath-watching',
]);

const POTENTIAL_EXCLUDED = new Set([
  'angamardana', 'yogasanas', 'surya-kriya', 'surya-shakti', 'shakti-chalana',
  'shoonya', 'bhuta-shuddhi', 'jala-neti', 'shambhavi', 'guru-pooja',
  'guru-mahima', 'rudraksha-diksha', 'shiva-namaskar', 'devi-sadhana',
  'achala-arpanam', 'samyama', 'breath-watching',
]);

type LadderCell = { hero: string; listings: [string, string] };

const POTENTIAL_LADDER: Record<DrawnToType, Record<DurationPreference, LadderCell>> = {
  'physical-yoga': {
    'under-5': { hero: 'yoga-namaskar', listings: ['namaskar-process', 'knee-rotations'] },
    '5-10': { hero: 'isha-kriya', listings: ['neck-practices', 'directional-movements'] },
    '10-20': { hero: 'isha-kriya', listings: ['neck-practices', 'yoga-namaskar'] },
    'over-20': { hero: 'isha-kriya', listings: ['neck-practices', 'directional-movements'] },
  },
  pranayama: {
    'under-5': { hero: 'nadi-shuddhi', listings: ['shambhavi-mudra', 'yoga-namaskar'] },
    '5-10': { hero: 'isha-kriya', listings: ['nadi-shuddhi', 'nada-yoga'] },
    '10-20': { hero: 'isha-kriya', listings: ['nadi-shuddhi', 'sukha-kriya'] },
    'over-20': { hero: 'isha-kriya', listings: ['sukha-kriya', 'nadi-shuddhi'] },
  },
  meditation: {
    'under-5': { hero: 'shambhavi-mudra', listings: ['nadi-shuddhi', 'yoga-namaskar'] },
    '5-10': { hero: 'isha-kriya', listings: ['nada-yoga', 'shambhavi-mudra'] },
    '10-20': { hero: 'isha-kriya', listings: ['infinity-meditation', 'living-soil'] },
    'over-20': { hero: 'isha-kriya', listings: ['chit-shakti-peace', 'infinity-meditation'] },
  },
  chants: {
    'under-5': { hero: 'linga-bhairavi-arati', listings: ['nada-yoga', 'shambhavi-mudra'] },
    '5-10': { hero: 'isha-kriya', listings: ['nada-yoga', 'sadhguru-presence'] },
    '10-20': { hero: 'isha-kriya', listings: ['margazhi-mantra', 'nada-yoga'] },
    'over-20': { hero: 'isha-kriya', listings: ['mahamantra', 'margazhi-mantra'] },
  },
};

const MEDITATOR_LADDER = [
  'shambhavi',
  'ie-crash-course',
  'sadhguru-presence',
  'guru-pooja',
  'mahamantra',
  'isha-kriya',
];

export function getPracticeAction(practiceId: string): 'Learn' | 'Practice' {
  return PROGRAM_PRACTICE_IDS.has(practiceId) ? 'Learn' : 'Practice';
}

export function getPotentialStartHere(
  drawnTo: DrawnToType,
  duration: DurationPreference,
): { hero: string; listings: string[] } {
  const cell = POTENTIAL_LADDER[drawnTo][duration];
  return { hero: cell.hero, listings: cell.listings };
}

export function getMeditatorNextPractices(addedIds: Set<string>): string[] {
  const ladder = [
    ...MEDITATOR_LADDER,
    ...PRACTICES.map((p) => p.id).sort((a, b) => {
      const pa = PRACTICES.find((x) => x.id === a)!;
      const pb = PRACTICES.find((x) => x.id === b)!;
      return pa.name.localeCompare(pb.name);
    }),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ladder) {
    if (addedIds.has(id) || seen.has(id) || POTENTIAL_EXCLUDED.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= 3) break;
  }
  return result;
}

export const PRACTICE_CATEGORIES = [
  { key: 'physical-yoga' as const, label: 'Physical yoga' },
  { key: 'pranayama' as const, label: 'Pranayama' },
  { key: 'meditation' as const, label: 'Meditation' },
  { key: 'chants' as const, label: 'Chants and mantras' },
  { key: 'other' as const, label: 'Other practices' },
];

export function getPracticesByCategory() {
  return PRACTICE_CATEGORIES.map((cat) => ({
    ...cat,
    practices: PRACTICES.filter((p) => (p.category ?? 'other') === cat.key)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.practices.length > 0);
}
