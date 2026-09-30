import { subDays } from 'date-fns';
import { formatDateKey, parseDateKey } from '@/utils/dates';
import type { LocalDate } from './types';

/** The local calendar day before `day`. parseISO reads a bare date as local midnight. */
export function yesterdayOf(day: LocalDate): LocalDate {
  return formatDateKey(subDays(parseDateKey(day), 1));
}
