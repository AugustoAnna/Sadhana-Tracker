import {
  startOfMonth, getDaysInMonth, format, isAfter, isBefore, parseISO,
} from 'date-fns';
import type { PracticeLog } from '@/types';
import { getHeatMapColor } from '@/data/constants';
import { formatDateKey, todayKey } from './dates';

export const CALENDAR_CELL_PX = 40;
export const CALENDAR_GAP_PX = 8;
export const CALENDAR_GUTTER_PX = 26;
export const CALENDAR_MONTH_GAP_PX = 40;

export const COLOR_NOT_YET = '#EEE9DE';
export const COLOR_BEFORE_TRACKING = '#E4DDD0';
export const COLOR_NO_PRACTICE = '#D5CCBA';
export const COLOR_TODAY_RING = 'var(--color-primary)';

export type CellState = 'future' | 'before-tracking' | 'no-practice' | 'practiced';

export interface CalendarCell {
  date: string;
  dayOfMonth: number;
  row: number;
  column: number;
  state: CellState;
  minutes: number;
  fill: string;
  isToday: boolean;
}

export interface MonthCalendarData {
  monthLabel: string;
  columns: number;
  cells: CalendarCell[];
  firstTrackingDate: string | null;
}

function mondayZeroWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

function minutesForDate(logs: PracticeLog[], dateKey: string): number {
  return logs
    .filter((l) => l.localDate === dateKey)
    .reduce((s, l) => s + l.minutes, 0);
}

function getFirstTrackingDate(logs: PracticeLog[]): string | null {
  if (logs.length === 0) return null;
  const dates = logs.map((l) => l.localDate).sort();
  return dates[0] ?? null;
}

/** E1 — month grid with column = calendar week within month. */
export function buildMonthCalendar(logs: PracticeLog[], now = new Date()): MonthCalendarData {
  const monthStart = startOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const firstWeekday = mondayZeroWeekday(monthStart);
  const today = todayKey();
  const firstTracking = getFirstTrackingDate(logs);

  const cells: CalendarCell[] = [];
  let maxColumn = 0;

  for (let date = 1; date <= daysInMonth; date++) {
    const column = Math.floor((date - 1 + firstWeekday) / 7);
    const row = (date - 1 + firstWeekday) % 7;
    maxColumn = Math.max(maxColumn, column);

    const dateObj = new Date(now.getFullYear(), now.getMonth(), date);
    const dateKey = formatDateKey(dateObj);

    const isToday = dateKey === today;
    const isFuture = isAfter(dateObj, now);

    let state: CellState;
    let fill: string;

    if (isFuture) {
      state = 'future';
      fill = COLOR_NOT_YET;
    } else if (firstTracking && isBefore(dateObj, parseISO(firstTracking))) {
      state = 'before-tracking';
      fill = COLOR_BEFORE_TRACKING;
    } else {
      const minutes = minutesForDate(logs, dateKey);
      if (minutes > 0) {
        state = 'practiced';
        fill = getHeatMapColor(minutes).color;
      } else {
        state = 'no-practice';
        fill = COLOR_NO_PRACTICE;
      }
    }

    cells.push({
      date: dateKey,
      dayOfMonth: date,
      row,
      column,
      state,
      minutes: minutesForDate(logs, dateKey),
      fill,
      isToday,
    });
  }

  return {
    monthLabel: format(now, 'MMMM'),
    columns: maxColumn + 1,
    cells,
    firstTrackingDate: firstTracking,
  };
}

export const HEAT_BAND_COLORS = [
  '#FBDFB2', '#F9D08F', '#F7BF6E', '#F4AD4E', '#F09A32', '#E8871F',
  '#DC7317', '#CC5F12', '#B94D0F', '#A33C0D', '#8A2C0B', '#6E1D08',
];

export function cellAccessibleName(cell: CalendarCell): string {
  if (cell.state === 'future') return `${cell.date}: not yet arrived`;
  if (cell.state === 'before-tracking') return `${cell.date}: before tracking began`;
  if (cell.minutes > 0) return `${cell.date}: ${cell.minutes} minutes practiced`;
  return `${cell.date}: no practice`;
}
