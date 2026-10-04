import type { PracticeLog } from '@/types';

/** How long a tick can be taken back before it locks. */
export const UNTICK_WINDOW_MS = 60_000;

/**
 * Only a checkbox tick, and only for its first minute: it is there to undo a
 * mistaken tap. Practices finished in the player, and minutes added to timed
 * practices, never unlock.
 */
export function isUntickable(log: PracticeLog, now: number): boolean {
  return log.source === 'checkbox' && now - log.timestamp < UNTICK_WINDOW_MS;
}
