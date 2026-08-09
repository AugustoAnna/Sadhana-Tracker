import { format, startOfDay, subDays, isSameDay, parseISO } from 'date-fns';
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

export function getCompletionCountToday(
  logs: PracticeLog[],
  instanceId: string,
): number {
  const today = todayKey();
  return getLogsForDay(logs, today).filter((l) => l.instanceId === instanceId).length;
}

export function isInstanceCompletedToday(
  logs: PracticeLog[],
  instanceId: string,
): boolean {
  return getCompletionCountToday(logs, instanceId) > 0;
}

export function isInstanceCompletedTwiceToday(
  logs: PracticeLog[],
  instanceId: string,
): boolean {
  return getCompletionCountToday(logs, instanceId) >= 2;
}

export function getTimedMinutesToday(
  logs: PracticeLog[],
  instanceId: string,
): number {
  const today = todayKey();
  return getLogsForDay(logs, today)
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

/** @deprecated Use getCurrentWeekDays for Mon–Sun week */
export function getWeekDays(): string[] {
  const days: string[] = [];
  const today = startOfDay(new Date());
  for (let i = 6; i >= 0; i--) {
    days.push(formatDateKey(subDays(today, i)));
  }
  return days;
}

export function getWeekMinutes(logs: PracticeLog[]): number {
  const weekDays = new Set(getWeekDays());
  return logs
    .filter((l) => weekDays.has(formatDateKey(new Date(l.timestamp))))
    .reduce((sum, l) => sum + l.minutes, 0);
}

export function getPracticesCompletedToday(logs: PracticeLog[]): number {
  const today = todayKey();
  const instanceIds = new Set(
    getLogsForDay(logs, today).map((l) => l.instanceId),
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
