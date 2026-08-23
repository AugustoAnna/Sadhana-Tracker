import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PracticeLog } from '@/types';

const toArray = vi.fn<() => Promise<PracticeLog[]>>();

vi.mock('@/db', () => ({
  getDb: () => ({ practiceLogs: { toArray } }),
}));

import { useAppStore } from '@/stores/appStore';

function makeLog(localDate: string): PracticeLog {
  return {
    id: `log-${localDate}`,
    practiceId: 'isha-kriya',
    instanceId: 'inst-1',
    minutes: 12,
    timestamp: Date.parse(`${localDate}T06:00:00`),
    localDate,
    source: 'checkbox',
    wasOffline: false,
  };
}

describe('refreshDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toArray.mockReset();
    useAppStore.setState({ currentDay: '2026-08-23', logs: [makeLog('2026-08-23')] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while the calendar day is unchanged', async () => {
    vi.setSystemTime(new Date(2026, 7, 23, 23, 59, 0));
    const logsBefore = useAppStore.getState().logs;

    await useAppStore.getState().refreshDay();

    expect(toArray).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentDay).toBe('2026-08-23');
    expect(useAppStore.getState().logs).toBe(logsBefore);
  });

  it('advances the day and re-reads logs once midnight has passed', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 0, 1, 0));
    toArray.mockResolvedValue([makeLog('2026-08-23'), makeLog('2026-08-24')]);

    await useAppStore.getState().refreshDay();

    expect(useAppStore.getState().currentDay).toBe('2026-08-24');
    expect(useAppStore.getState().logs).toHaveLength(2);
  });

  it('backfills localDate on logs written before that field existed', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 0, 1, 0));
    const legacy = { ...makeLog('2026-08-23'), localDate: undefined };
    toArray.mockResolvedValue([legacy as unknown as PracticeLog]);

    await useAppStore.getState().refreshDay();

    expect(useAppStore.getState().logs[0].localDate).toBe('2026-08-23');
  });

  it('still advances the day when the log re-read fails', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 0, 1, 0));
    toArray.mockRejectedValue(new Error('IndexedDB unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().refreshDay();

    expect(useAppStore.getState().currentDay).toBe('2026-08-24');
    expect(useAppStore.getState().logs).toHaveLength(1);
    consoleError.mockRestore();
  });
});
