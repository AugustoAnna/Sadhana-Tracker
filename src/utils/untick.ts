import type { PracticeLog } from '@/types';

/** How long a tick can be taken back before it locks. */
export const UNTICK_WINDOW_MS = 10_000;

/**
 * How long a fresh tick stays untappable. The second tap of a double tap on
 * the checkbox lands in this time and must not take the tick straight back.
 */
export const UNTICK_DELAY_MS = 500;

/**
 * Only a checkbox tick, from its first half second to the end of its first
 * minute: it is there to undo a mistaken tap. Practices finished in the
 * player, and minutes added to timed practices, never unlock.
 */
export function isUntickable(log: PracticeLog, now: number): boolean {
  const age = now - log.timestamp;
  return log.source === 'checkbox' && age >= UNTICK_DELAY_MS && age < UNTICK_WINDOW_MS;
}

/**
 * When a checkbox tick next changes: it unlocks after its first half second
 * and locks at the end of its minute. Null once locked, and for other logs.
 */
export function nextUntickChange(log: PracticeLog, now: number): number | null {
  if (log.source !== 'checkbox') return null;
  const age = now - log.timestamp;
  if (age < UNTICK_DELAY_MS) return log.timestamp + UNTICK_DELAY_MS;
  if (age < UNTICK_WINDOW_MS) return log.timestamp + UNTICK_WINDOW_MS;
  return null;
}
