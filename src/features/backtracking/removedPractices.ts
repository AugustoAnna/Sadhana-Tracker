import { getPractice } from '@/data/catalogue';
import type { PracticeInstance, PracticeLog } from '@/types';
import { getLogsForDay } from '@/utils/dates';
import type { LocalDate } from './types';

export interface RemovedPractice {
  instanceId: string;
  practiceId: string;
  /** 1st/2nd among removed instances of the same practice, by first log. */
  instanceNumber: 1 | 2;
  minutes: number;
}

/**
 * Practices logged on `date` whose instance is no longer in the list. The
 * stat cards count them, so Yesterday shows them as read-only done rows —
 * otherwise "3 practices completed" sits over two ticks. Ordered by first log.
 */
export function removedPracticesOn(
  logs: PracticeLog[],
  instances: PracticeInstance[],
  date: LocalDate,
): RemovedPractice[] {
  const current = new Set(instances.map((i) => i.id));
  const byInstance = new Map<string, Omit<RemovedPractice, 'instanceNumber'> & { firstAt: number }>();
  for (const log of getLogsForDay(logs, date)) {
    if (current.has(log.instanceId) || !getPractice(log.practiceId)) continue;
    const seen = byInstance.get(log.instanceId);
    if (seen) {
      seen.minutes += log.minutes;
      seen.firstAt = Math.min(seen.firstAt, log.timestamp);
    } else {
      byInstance.set(log.instanceId, {
        instanceId: log.instanceId,
        practiceId: log.practiceId,
        minutes: log.minutes,
        firstAt: log.timestamp,
      });
    }
  }
  // The log doesn't record the instance number, so two removed instances of
  // one practice are told apart by which was logged first.
  const seenPerPractice = new Map<string, number>();
  return [...byInstance.values()]
    .sort((a, b) => a.firstAt - b.firstAt)
    .map(({ firstAt: _firstAt, ...rest }) => {
      const n = (seenPerPractice.get(rest.practiceId) ?? 0) + 1;
      seenPerPractice.set(rest.practiceId, n);
      return { ...rest, instanceNumber: (n >= 2 ? 2 : 1) as 1 | 2 };
    });
}
