import { addDays, differenceInCalendarDays } from 'date-fns';
import { formatDateKey, parseDateKey } from '@/utils/dates';
import type { LocalDate } from './types';

// parseISO reads a bare 'yyyy-MM-dd' as local midnight, so these stay on
// local calendar days across clock changes.

/** The local calendar day before `day`. */
export function yesterdayOf(day: LocalDate): LocalDate {
  return formatDateKey(addDays(parseDateKey(day), -1));
}

export function dayAfter(day: LocalDate): LocalDate {
  return formatDateKey(addDays(parseDateKey(day), 1));
}

/** Whole calendar days from `from` to `to` (0 when equal). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return differenceInCalendarDays(parseDateKey(to), parseDateKey(from));
}
