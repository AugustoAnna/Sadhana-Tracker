import {
  startOfMonth, getDaysInMonth, format, isAfter, parseISO, addMonths,
} from 'date-fns';
import type { PracticeLog } from '@/types';
import { heatmapColor } from '@/data/heatmap';
import { formatDateKey, todayKey } from './dates';

export const CALENDAR_CELL_PX = 26;
export const CALENDAR_GAP_PX = 5;
export const CALENDAR_GUTTER_PX = 18;
export const CALENDAR_MONTH_GAP_PX = 6;

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
  monthKey: string;
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

export function buildMonthCalendar(
  logs: PracticeLog[],
  monthDate = new Date(),
  firstTracking: string | null = getFirstTrackingDate(logs),
): MonthCalendarData {
  const monthStart = startOfMonth(monthDate);
  const daysInMonth = getDaysInMonth(monthDate);
  const firstWeekday = mondayZeroWeekday(monthStart);
  const today = todayKey();

  const cells: CalendarCell[] = [];
  let maxColumn = 0;

  for (let date = 1; date <= daysInMonth; date++) {
    const column = Math.floor((date - 1 + firstWeekday) / 7);
    const row = (date - 1 + firstWeekday) % 7;
    maxColumn = Math.max(maxColumn, column);

    const dateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), date);
    const dateKey = formatDateKey(dateObj);

    const isToday = dateKey === today;
    const isFuture = isAfter(dateObj, new Date());
    const minutes = minutesForDate(logs, dateKey);

    let state: CellState;
    if (isFuture) {
      state = 'future';
    } else if (firstTracking && dateKey < firstTracking) {
      state = 'before-tracking';
    } else if (minutes > 0) {
      state = 'practiced';
    } else {
      state = 'no-practice';
    }

    const fill = heatmapColor(minutes);

    cells.push({
      date: dateKey,
      dayOfMonth: date,
      row,
      column,
      state,
      minutes,
      fill,
      isToday,
    });
  }

  return {
    monthKey: format(monthStart, 'yyyy-MM'),
    monthLabel: format(monthDate, 'MMMM'),
    columns: maxColumn + 1,
    cells,
    firstTrackingDate: firstTracking,
  };
}

export function buildMonthCalendars(logs: PracticeLog[], now = new Date()): MonthCalendarData[] {
  const firstTracking = getFirstTrackingDate(logs);
  if (!firstTracking) {
    return [buildMonthCalendar(logs, now, null)];
  }

  const start = startOfMonth(parseISO(firstTracking));
  const end = startOfMonth(now);
  const months: MonthCalendarData[] = [];
  let cursor = start;

  while (!isAfter(cursor, end)) {
    months.push(buildMonthCalendar(logs, cursor, firstTracking));
    cursor = addMonths(cursor, 1);
  }

  return months;
}

export function cellAccessibleName(cell: CalendarCell): string {
  if (cell.state === 'future') return `${cell.date}: not yet arrived`;
  if (cell.state === 'before-tracking') return `${cell.date}: before tracking began`;
  if (cell.minutes > 0) return `${cell.date}: ${cell.minutes} minutes practiced`;
  return `${cell.date}: no practice`;
}
