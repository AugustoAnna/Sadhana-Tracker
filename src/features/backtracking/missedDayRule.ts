import type { LocalDate, PracticeInstance, PracticeLog } from '@/types';
import { dayAfter, daysBetween, formatDateKey, yesterdayOf } from '@/utils/dates';

/** 1 = yesterday was the only empty day, 2 = 2–7 empty days, 3 = 8 or more. */
export type MissedVariant = 1 | 2 | 3;

export type MissedDayDecision =
  | { show: false }
  | { show: true; variant: MissedVariant; gapDays: number; runKey: LocalDate };

/**
 * Whether practice home should ask "did you practice yesterday?".
 *
 * Yes when the list was set up before today and yesterday has no log — once
 * per run of empty days. A run starts the day after the last log before
 * today (or on setup day), and that start date is the run key: the sheet
 * records it when shown, and a new log starts a new run.
 */
export function missedDayDecision(
  logs: PracticeLog[],
  instances: PracticeInstance[],
  lastShownRunKey: LocalDate | null | undefined,
  today: LocalDate,
): MissedDayDecision {
  if (instances.length === 0) return { show: false };

  const setupDate = formatDateKey(new Date(Math.min(...instances.map((i) => i.addedAt))));
  if (setupDate >= today) return { show: false };

  const yesterday = yesterdayOf(today);
  let lastLogBeforeToday: LocalDate | null = null;
  for (const log of logs) {
    if (log.localDate === yesterday) return { show: false };
    if (log.localDate < today && (!lastLogBeforeToday || log.localDate > lastLogBeforeToday)) {
      lastLogBeforeToday = log.localDate;
    }
  }

  const afterLastLog = lastLogBeforeToday ? dayAfter(lastLogBeforeToday) : null;
  const runKey = afterLastLog && afterLastLog > setupDate ? afterLastLog : setupDate;
  if (runKey === lastShownRunKey) return { show: false };

  const gapDays = daysBetween(runKey, yesterday) + 1;
  const variant: MissedVariant = gapDays === 1 ? 1 : gapDays <= 7 ? 2 : 3;
  return { show: true, variant, gapDays, runKey };
}
