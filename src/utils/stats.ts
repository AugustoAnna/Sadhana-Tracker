import { startOfWeek, endOfWeek, eachWeekOfInterval, format, subWeeks } from 'date-fns';
import type { PracticeLog } from '@/types';
import { getMinutesForDay, formatDateKey } from './dates';

export interface WeekData {
  weekStart: string;
  weekEnd: string;
  label: string;
  totalMinutes: number;
  days: { date: string; minutes: number }[];
  isCurrentWeek: boolean;
}

export function getWeeksData(logs: PracticeLog[], numWeeks = 52): WeekData[] {
  const now = new Date();
  const start = subWeeks(now, numWeeks);
  const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });

  return weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days: { date: string; minutes: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const key = formatDateKey(date);
      days.push({ date: key, minutes: getMinutesForDay(logs, key) });
    }
    const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    return {
      weekStart: formatDateKey(weekStart),
      weekEnd: formatDateKey(weekEnd),
      label: format(weekStart, 'd MMM'),
      totalMinutes,
      days,
      isCurrentWeek: formatDateKey(weekStart) === formatDateKey(currentWeekStart),
    };
  });
}

export interface HeatMapWeek {
  weekStart: string;
  monthLabel?: string;
  days: { date: string; dayOfWeek: number; minutes: number }[];
}

export function getHeatMapWeeks(logs: PracticeLog[], numWeeks = 26): HeatMapWeek[] {
  const now = new Date();
  const start = subWeeks(now, numWeeks);
  const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
  let lastMonth = '';

  return weeks.map((weekStart) => {
    const month = format(weekStart, 'MMM');
    const showMonth = month !== lastMonth;
    lastMonth = month;

    const days: HeatMapWeek['days'] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const key = formatDateKey(date);
      days.push({
        date: key,
        dayOfWeek: d,
        minutes: getMinutesForDay(logs, key),
      });
    }

    return {
      weekStart: formatDateKey(weekStart),
      monthLabel: showMonth ? month : undefined,
      days,
    };
  });
}
