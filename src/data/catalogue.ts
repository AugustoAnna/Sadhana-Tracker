import type { Practice } from '@/types';

export const PRACTICES: Practice[] = [
  { id: 'achala-arpanam', name: 'Achala Arpanam', minutes: 12, type: 'guided' },
  { id: 'angamardana', name: 'Angamardana', minutes: 40, type: 'unguided' },
  { id: 'ardhasiddhasana', name: 'Ardhasiddhasana', minutes: 20, type: 'timed' },
  { id: 'aum-chanting', name: 'AUM Chanting', minutes: 20, type: 'timed' },
  { id: 'bhakti-sadhana', name: 'Bhakti Sadhana', minutes: 13, type: 'unguided' },
  { id: 'bhastrika-kriya', name: 'Bhastrika Kriya', minutes: 12, type: 'unguided' },
  { id: 'bhuta-shuddhi', name: 'Bhuta Shuddhi', minutes: 10, type: 'unguided' },
  { id: 'breath-watching', name: 'Breath Watching', minutes: 40, type: 'timed' },
  { id: 'chit-shakti-health', name: 'Chit Shakti for Health', minutes: 19, type: 'guided' },
  { id: 'chit-shakti-love', name: 'Chit Shakti for Love', minutes: 17, type: 'guided' },
  { id: 'chit-shakti-peace', name: 'Chit Shakti for Peace', minutes: 19, type: 'guided' },
  { id: 'chit-shakti-success', name: 'Chit Shakti for Success', minutes: 19, type: 'guided' },
  { id: 'devi-sadhana', name: 'Devi Sadhana', minutes: 8, type: 'guided' },
  { id: 'directional-movements', name: 'Directional Movements of the Arms', minutes: 6, type: 'guided' },
  { id: 'eye-care', name: 'Eye Care Practices', minutes: 10, type: 'unguided' },
  { id: 'guru-mahima', name: 'Guru Mahima', minutes: 6, type: 'unguided' },
  { id: 'guru-pooja', name: 'Guru Pooja', minutes: 6, type: 'guided' },
  { id: 'infinity-meditation', name: 'Infinity Meditation', minutes: 15, type: 'guided' },
  { id: 'ie-crash-course', name: 'Inner Engineering Crash Course', minutes: 2, type: 'guided' },
  { id: 'isha-kriya', name: 'Isha Kriya', minutes: 14, type: 'guided' },
  { id: 'jala-neti', name: 'Jala Neti', minutes: 10, type: 'unguided' },
  { id: 'knee-rotations', name: 'Knee Rotations', minutes: 2, type: 'unguided' },
  { id: 'linga-bhairavi-arati', name: 'Linga Bhairavi Arati', minutes: 2, type: 'guided' },
  { id: 'living-soil', name: 'Living Soil Meditation', minutes: 12, type: 'guided' },
  { id: 'mahamantra', name: 'Mahamantra', minutes: 21, type: 'guided' },
  { id: 'margazhi-mantra', name: 'Margazhi Mantra', minutes: 15, type: 'guided' },
  { id: 'nada-yoga', name: 'Nada Yoga', minutes: 6, type: 'guided' },
  { id: 'nadi-shuddhi', name: 'Nadi Shuddhi', minutes: 4, type: 'guided' },
  { id: 'namaskar-process', name: 'Namaskar Process', minutes: 4, type: 'guided' },
  { id: 'neck-practices', name: 'Neck Practices', minutes: 7, type: 'guided' },
  { id: 'rudraksha-diksha', name: 'Rudraksha Diksha', minutes: 4, type: 'guided' },
  { id: 'sadhguru-presence', name: "Sadhguru's Presence", minutes: 10, type: 'guided' },
  { id: 'samyama', name: 'Samyama', minutes: 30, type: 'timed' },
  { id: 'shakti-chalana', name: 'Shakti Chalana Kriya', minutes: 45, type: 'unguided' },
  { id: 'shambhavi', name: 'Shambhavi Mahamudra Kriya', minutes: 21, type: 'unguided' },
  { id: 'shambhavi-mudra', name: 'Shambhavi Mudra', minutes: 4, type: 'guided' },
  { id: 'shanmuki-mudra', name: 'Shanmuki Mudra', minutes: 16, type: 'unguided' },
  { id: 'shiva-namaskar', name: 'Shiva Namaskar', minutes: 10, type: 'unguided' },
  { id: 'shoonya', name: 'Shoonya', minutes: 15, type: 'unguided' },
  { id: 'simha-kriya', name: 'Simha Kriya', minutes: 3, type: 'unguided' },
  { id: 'squatting', name: 'Squatting', minutes: 1, type: 'unguided' },
  { id: 'sukha-kriya', name: 'Sukha Kriya', minutes: 20, type: 'timed' },
  { id: 'surya-kriya', name: 'Surya Kriya', minutes: 15, type: 'unguided' },
  { id: 'surya-shakti', name: 'Surya Shakti', minutes: 12, type: 'unguided' },
  { id: 'thoppukarnam', name: 'Thoppukarnam', minutes: 2, type: 'unguided' },
  { id: 'yoga-namaskar', name: 'Yoga Namaskar', minutes: 4, type: 'guided' },
  { id: 'yogasanas', name: 'Yogasanas', minutes: 50, type: 'unguided' },
];

export const COMMONLY_PRACTICED_IDS = [
  'guru-pooja', 'ie-crash-course', 'mahamantra', 'bhuta-shuddhi',
  'angamardana', 'surya-kriya', 'yogasanas', 'yoga-namaskar',
  'shakti-chalana', 'shambhavi', 'isha-kriya', 'breath-watching',
  'samyama', 'shoonya', 'devi-sadhana', 'sadhguru-presence',
];

export const YOUR_NEXT_PRACTICE_IDS = [
  'ie-crash-course', 'sadhguru-presence', 'guru-pooja',
  'mahamantra', 'isha-kriya', 'nadi-shuddhi',
];

export const MAX_PRACTICE_INSTANCES = 21;

export const INVOCATION_PRACTICE_ID = '__invocation__';

export function getPractice(id: string): Practice | undefined {
  const p = PRACTICES.find((x) => x.id === id);
  if (!p) return undefined;
  return { ...p, category: PRACTICE_CATEGORY_MAP[id] ?? 'other' };
}

const PRACTICE_CATEGORY_MAP: Record<string, Practice['category']> = {
  'angamardana': 'physical-yoga', 'directional-movements': 'physical-yoga', 'eye-care': 'physical-yoga',
  'knee-rotations': 'physical-yoga', 'neck-practices': 'physical-yoga', 'shiva-namaskar': 'physical-yoga',
  'squatting': 'physical-yoga', 'surya-kriya': 'physical-yoga', 'surya-shakti': 'physical-yoga',
  'yoga-namaskar': 'physical-yoga', 'yogasanas': 'physical-yoga', 'namaskar-process': 'physical-yoga',
  'bhastrika-kriya': 'pranayama', 'nadi-shuddhi': 'pranayama', 'shambhavi-mudra': 'pranayama',
  'shanmuki-mudra': 'pranayama', 'simha-kriya': 'pranayama', 'sukha-kriya': 'pranayama',
  'breath-watching': 'meditation', 'chit-shakti-health': 'meditation', 'chit-shakti-love': 'meditation',
  'chit-shakti-peace': 'meditation', 'chit-shakti-success': 'meditation', 'infinity-meditation': 'meditation',
  'isha-kriya': 'meditation', 'living-soil': 'meditation', 'samyama': 'meditation', 'shoonya': 'meditation',
  'ardhasiddhasana': 'meditation',
  'aum-chanting': 'chants', 'bhakti-sadhana': 'chants', 'devi-sadhana': 'chants', 'guru-mahima': 'chants',
  'guru-pooja': 'chants', 'linga-bhairavi-arati': 'chants', 'mahamantra': 'chants',
  'margazhi-mantra': 'chants', 'nada-yoga': 'chants', 'rudraksha-diksha': 'chants',
  'sadhguru-presence': 'chants', 'ie-crash-course': 'chants',
  'achala-arpanam': 'other', 'bhuta-shuddhi': 'other', 'jala-neti': 'other',
  'shakti-chalana': 'other', 'shambhavi': 'other', 'thoppukarnam': 'other',
};

export function getPracticeMap(): Map<string, Practice> {
  return new Map(PRACTICES.map((p) => [p.id, p]));
}
