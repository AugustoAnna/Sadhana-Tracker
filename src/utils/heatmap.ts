import type { PracticeLog } from '@/types';
import { startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { getMinutesForDay, formatDateKey } from './dates';
import { getWeeksData } from './stats';

export interface MonthHeatMapDay {
  date: string;
  dayOfMonth: number;
  minutes: number;
  empty: boolean;
}

export function getCurrentMonthHeatMap(logs: PracticeLog[]): MonthHeatMapDay[] {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const days = eachDayOfInterval({ start, end });

  return days.map((d) => {
    const key = formatDateKey(d);
    const minutes = getMinutesForDay(logs, key);
    return {
      date: key,
      dayOfMonth: d.getDate(),
      minutes,
      empty: d > now && minutes === 0,
    };
  }).filter((d) => !d.empty || d.minutes > 0);
}

export function getWeeksWithData(logs: PracticeLog[]) {
  return getWeeksData(logs, 52).filter((w) => w.totalMinutes > 0);
}
