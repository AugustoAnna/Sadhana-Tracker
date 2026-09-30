import { getPractice } from '@/data/catalogue';
import type { PracticeInstance, PracticeLog } from '@/types';
import { getLogsForDay } from '@/utils/dates';
import type { LocalDate } from './types';

export interface RemovedPractice {
  instanceId: string;
  practiceId: string;
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
  const byInstance = new Map<string, RemovedPractice & { firstAt: number }>();
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
  return [...byInstance.values()]
    .sort((a, b) => a.firstAt - b.firstAt)
    .map(({ firstAt: _firstAt, ...rest }) => rest);
}
