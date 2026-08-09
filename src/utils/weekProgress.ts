import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isBefore, subWeeks } from 'date-fns';
import type { PracticeLog } from '@/types';
import { getHeatMapColor } from '@/data/constants';
import { formatDateKey } from './dates';

export interface WeekProgressDay {
  date: string;
  minutes: number;
  state: 'before-tracking' | 'no-practice' | 'practiced';
}

export interface WeekProgressRow {
  weekStart: string;
  label: string;
  days: WeekProgressDay[];
  weekMinutes: number;
  isCurrentWeek: boolean;
  isComplete: boolean;
}

function getFirstTrackingDate(logs: PracticeLog[]): string | null {
  if (logs.length === 0) return null;
  const dates = logs.map((l) => l.localDate ?? formatDateKey(new Date(l.timestamp)));
  return dates.sort()[0];
}

export function buildWeekProgressRows(logs: PracticeLog[], maxRows?: number): WeekProgressRow[] {
  const firstDate = getFirstTrackingDate(logs);
  if (!firstDate) return [];

  const minutesByDate = new Map<string, number>();
  for (const log of logs) {
    const d = log.localDate ?? formatDateKey(new Date(log.timestamp));
    minutesByDate.set(d, (minutesByDate.get(d) ?? 0) + log.minutes);
  }

  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const firstWeekStart = startOfWeek(parseISO(firstDate), { weekStartsOn: 1 });

  const rows: WeekProgressRow[] = [];
  let weekStart = currentWeekStart;
  const seenMonths = new Set<string>();

  while (!isBefore(weekStart, firstWeekStart)) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((d) => {
      const key = formatDateKey(d);
      const minutes = minutesByDate.get(key) ?? 0;
      let state: WeekProgressDay['state'];
      if (isBefore(d, parseISO(firstDate))) {
        state = 'before-tracking';
      } else if (minutes > 0) {
        state = 'practiced';
      } else {
        state = 'no-practice';
      }
      return { date: key, minutes, state };
    });

    const weekMinutes = days.reduce((s, d) => s + d.minutes, 0);
    const isCurrentWeek = formatDateKey(weekStart) === formatDateKey(currentWeekStart);
    const isComplete = isBefore(weekEnd, now) && !isCurrentWeek;

    let label = '';
    if (isCurrentWeek) {
      label = 'This week';
    } else if (formatDateKey(weekStart) === formatDateKey(subWeeks(currentWeekStart, 1))) {
      label = 'Last week';
    } else {
      const monthKey = format(weekStart, 'yyyy-MM');
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        label = format(weekStart, 'MMMM');
      }
    }

    rows.push({
      weekStart: formatDateKey(weekStart),
      label,
      days,
      weekMinutes,
      isCurrentWeek,
      isComplete,
    });

    weekStart = subWeeks(weekStart, 1);
  }

  const filtered = rows.filter((r) => r.weekMinutes > 0 || r.isCurrentWeek || r.days.some((d) => d.state !== 'before-tracking'));
  return maxRows ? filtered.slice(0, maxRows) : filtered;
}

export function getTotalDays(logs: PracticeLog[]): number {
  const dates = new Set(logs.map((l) => l.localDate ?? formatDateKey(new Date(l.timestamp))));
  return dates.size;
}

export function getTotalMinutes(logs: PracticeLog[]): number {
  return logs.reduce((s, l) => s + l.minutes, 0);
}

export function getHeatColor(minutes: number): string {
  return getHeatMapColor(minutes).color;
}
