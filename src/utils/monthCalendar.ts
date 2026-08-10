import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isAfter, startOfWeek,
  addDays, isSameMonth,
} from 'date-fns';
import type { PracticeLog } from '@/types';
import { getHeatMapColor } from '@/data/constants';
import { formatDateKey } from './dates';

export const CALENDAR_CELL_PX = 26;
export const CALENDAR_GAP_PX = 6;
export const CALENDAR_BASE_COLOR = '#E6E4E0';

export interface CalendarCell {
  date: string;
  minutes: number;
  color: string;
  row: number; // 0=Mon .. 6=Sun
}

export interface CalendarWeekColumn {
  weekStart: Date;
  cells: CalendarCell[];
}

export interface MonthCalendarData {
  monthLabel: string;
  columns: CalendarWeekColumn[];
}

function minutesForDate(logs: PracticeLog[], dateKey: string): number {
  return logs
    .filter((l) => l.localDate === dateKey)
    .reduce((s, l) => s + l.minutes, 0);
}

/** Build current-month calendar grid per spec §8. */
export function buildMonthCalendar(logs: PracticeLog[], now = new Date()): MonthCalendarData {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter((d) => !isAfter(d, now));

  const weekStarts = new Set<number>();
  for (const day of monthDays) {
    const ws = startOfWeek(day, { weekStartsOn: 1 });
    weekStarts.add(ws.getTime());
  }

  const sortedWeekStarts = [...weekStarts].sort((a, b) => a - b).map((t) => new Date(t));

  const columns: CalendarWeekColumn[] = sortedWeekStarts.map((weekStart) => {
    const cells: CalendarCell[] = [];
    for (let row = 0; row < 7; row++) {
      const date = addDays(weekStart, row);
      if (!isSameMonth(date, monthStart)) continue;
      const dateKey = formatDateKey(date);
      if (isAfter(date, now)) continue;
      const minutes = minutesForDate(logs, dateKey);
      const { color } = minutes > 0 ? getHeatMapColor(minutes) : { color: CALENDAR_BASE_COLOR };
      cells.push({ date: dateKey, minutes, color, row });
    }
    return { weekStart, cells };
  });

  return {
    monthLabel: format(now, 'MMMM'),
    columns: columns.filter((c) => c.cells.length > 0),
  };
}

export const HEAT_BAND_COLORS = [
  '#FBDFB2', '#F9D08F', '#F7BF6E', '#F4AD4E', '#F09A32', '#E8871F',
  '#DC7317', '#CC5F12', '#B94D0F', '#A33C0D', '#8A2C0B', '#6E1D08',
];
