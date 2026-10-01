import { addDays, differenceInCalendarDays, format, startOfDay, subDays, isSameDay, parseISO } from 'date-fns';
import type { PracticeLog } from '@/types';

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

// parseISO reads a bare 'yyyy-MM-dd' as local midnight, so these stay on
// local calendar days across clock changes.

/** The local calendar day before `day`. */
export function yesterdayOf(day: string): string {
  return formatDateKey(addDays(parseDateKey(day), -1));
}

export function dayAfter(day: string): string {
  return formatDateKey(addDays(parseDateKey(day), 1));
}

/** Whole calendar days from `from` to `to` (0 when equal). */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseDateKey(to), parseDateKey(from));
}

export function getLogsForDay(logs: PracticeLog[], dateKey: string): PracticeLog[] {
  return logs.filter((log) => (log.localDate ?? formatDateKey(new Date(log.timestamp))) === dateKey);
}

export function getMinutesForDay(logs: PracticeLog[], dateKey: string): number {
  return getLogsForDay(logs, dateKey).reduce((sum, l) => sum + l.minutes, 0);
}

export function getTotalMinutes(logs: PracticeLog[]): number {
  return logs.reduce((sum, l) => sum + l.minutes, 0);
}

export function getDaysWithPractice(logs: PracticeLog[]): Set<string> {
  const days = new Set<string>();
  for (const log of logs) {
    days.add(log.localDate ?? formatDateKey(new Date(log.timestamp)));
  }
  return days;
}

export function getTotalDaysPracticed(logs: PracticeLog[]): number {
  return getDaysWithPractice(logs).size;
}

export function getCurrentStreak(logs: PracticeLog[]): number {
  const days = getDaysWithPractice(logs);
  if (days.size === 0) return 0;

  let streak = 0;
  let date = startOfDay(new Date());

  if (!days.has(formatDateKey(date))) {
    date = subDays(date, 1);
  }

  while (days.has(formatDateKey(date))) {
    streak++;
    date = subDays(date, 1);
  }
  return streak;
}

// The per-day helpers take the day explicitly rather than reading the clock:
// callers pass the store's currentDay (or the day the switcher shows), so a
// screen never mixes two notions of "today" around midnight.

export function getCompletionCountOn(
  logs: PracticeLog[],
  instanceId: string,
  dateKey: string,
): number {
  return getLogsForDay(logs, dateKey).filter((l) => l.instanceId === instanceId).length;
}

export function isInstanceCompletedOn(
  logs: PracticeLog[],
  instanceId: string,
  dateKey: string,
): boolean {
  return getCompletionCountOn(logs, instanceId, dateKey) > 0;
}

export function isInstanceCompletedTwiceOn(
  logs: PracticeLog[],
  instanceId: string,
  dateKey: string,
): boolean {
  return getCompletionCountOn(logs, instanceId, dateKey) >= 2;
}

export function getTimedMinutesOn(
  logs: PracticeLog[],
  instanceId: string,
  dateKey: string,
): number {
  return getLogsForDay(logs, dateKey)
    .filter((l) => l.instanceId === instanceId)
    .reduce((sum, l) => sum + l.minutes, 0);
}

export function getCurrentWeekDays(): string[] {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(formatDateKey(d));
  }
  return days;
}

export function getPracticesCompletedOn(logs: PracticeLog[], dateKey: string): number {
  const instanceIds = new Set(
    getLogsForDay(logs, dateKey).map((l) => l.instanceId),
  );
  return instanceIds.size;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatMinutes(n: number): string {
  return n.toLocaleString();
}

export function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function isSameCalendarDay(ts1: number, ts2: number): boolean {
  return isSameDay(new Date(ts1), new Date(ts2));
}
