import {
  startOfMonth, getDaysInMonth, format, isAfter, isBefore, parseISO,
  addMonths, differenceInCalendarMonths, isSameYear,
} from 'date-fns';
import type { PracticeLog } from '@/types';
import { heatmapColor } from '@/data/heatmap';
import { formatDateKey, todayKey } from './dates';

export const CALENDAR_CELL_PX = 26;
export const CALENDAR_GAP_PX = 5;
export const CALENDAR_GUTTER_PX = 18;
export const CALENDAR_MONTH_GAP_PX = 6;

// Neutral states, from the official Sadhguru app palette: beige, travertine and
// col_bone. They step down in lightness the way the states step toward "counted",
// and all three stay lighter than the lightest heat band.
export const COLOR_NOT_YET = '#EDE5D6';         // beige
export const COLOR_BEFORE_TRACKING = '#E4DBCA'; // travertine
export const COLOR_NO_PRACTICE = '#DCD3C0';     // col_bone
// Hardcoded rather than var(--color-primary): that token is teal, which sits
// inside the green heatmap ramp and would make the today-ring hard to spot.
export const COLOR_TODAY_RING = '#FFBD31';

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
  /** `yyyy-MM` — stable key for the month block. */
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

/**
 * E1 — month grid with column = calendar week within month.
 *
 * `monthDate` picks which month to lay out; `now` stays the reference point for
 * "today" and "not yet arrived", so past months render fully elapsed.
 */
export function buildMonthCalendar(
  logs: PracticeLog[],
  monthDate: Date = new Date(),
  now: Date = new Date(),
): MonthCalendarData {
  const monthStart = startOfMonth(monthDate);
  const daysInMonth = getDaysInMonth(monthStart);
  const firstWeekday = mondayZeroWeekday(monthStart);
  const today = todayKey();
  const firstTracking = getFirstTrackingDate(logs);

  const cells: CalendarCell[] = [];
  let maxColumn = 0;

  for (let date = 1; date <= daysInMonth; date++) {
    const column = Math.floor((date - 1 + firstWeekday) / 7);
    const row = (date - 1 + firstWeekday) % 7;
    maxColumn = Math.max(maxColumn, column);

    const dateObj = new Date(monthStart.getFullYear(), monthStart.getMonth(), date);
    const dateKey = formatDateKey(dateObj);

    const isToday = dateKey === today;
    const isFuture = isAfter(dateObj, now);
    const minutes = minutesForDate(logs, dateKey);

    let state: CellState;
    let fill: string;
    if (isFuture) {
      state = 'future';
      fill = COLOR_NOT_YET;
    } else if (firstTracking && dateKey < firstTracking) {
      state = 'before-tracking';
      fill = COLOR_BEFORE_TRACKING;
    } else if (minutes > 0) {
      state = 'practiced';
      fill = heatmapColor(minutes);
    } else {
      state = 'no-practice';
      fill = COLOR_NO_PRACTICE;
    }

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
    // Years only earn a label once the strip reaches back past January.
    monthLabel: format(monthStart, isSameYear(monthStart, now) ? 'MMMM' : 'MMMM yyyy'),
    columns: maxColumn + 1,
    cells,
    firstTrackingDate: firstTracking,
  };
}

/**
 * Every month from the first tracked day through the current one, oldest first.
 * With no logs yet this is just the current month.
 */
export function buildCalendarMonths(logs: PracticeLog[], now = new Date()): MonthCalendarData[] {
  const currentMonth = startOfMonth(now);
  const firstTracking = getFirstTrackingDate(logs);
  const firstMonth = firstTracking ? startOfMonth(parseISO(firstTracking)) : currentMonth;
  const startMonth = isBefore(firstMonth, currentMonth) ? firstMonth : currentMonth;
  const count = differenceInCalendarMonths(currentMonth, startMonth) + 1;

  return Array.from({ length: count }, (_, i) => buildMonthCalendar(logs, addMonths(startMonth, i), now));
}

export function cellAccessibleName(cell: CalendarCell): string {
  if (cell.state === 'future') return `${cell.date}: not yet arrived`;
  if (cell.state === 'before-tracking') return `${cell.date}: before tracking began`;
  if (cell.minutes > 0) return `${cell.date}: ${cell.minutes} minutes practiced`;
  return `${cell.date}: no practice`;
}
