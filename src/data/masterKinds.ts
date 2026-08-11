/**
 * Master-sheet practice kinds (seed data). Shambhavi is explicitly unguided per update run 2.
 * Resolved runtime kind also considers whether audio file exists — see practiceAssets.ts.
 */
import type { PracticeType } from '@/types';
import { PRACTICES } from './catalogue';

export const MASTER_KINDS: Record<string, PracticeType> = Object.fromEntries(
  PRACTICES.map((p) => [p.id, p.id === 'shambhavi' ? 'unguided' : p.type]),
);

export function getMasterKind(practiceId: string): PracticeType {
  return MASTER_KINDS[practiceId] ?? 'unguided';
}

/** Practices expected to have guided audio when master kind is guided. */
export const GUIDED_PRACTICE_IDS = PRACTICES
  .filter((p) => getMasterKind(p.id) === 'guided')
  .map((p) => p.id);
