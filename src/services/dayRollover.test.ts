import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

const refreshDay = vi.fn();

vi.mock('@/stores/appStore', () => ({
  useAppStore: { getState: () => ({ refreshDay }) },
}));

import { initDayRollover } from '@/services/dayRollover';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('initDayRollover', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 23, 23, 30, 0));
    initDayRollover();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    refreshDay.mockClear();
  });

  it('refreshes the day when the app returns to the foreground', () => {
    setVisibility('visible');
    expect(refreshDay).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the app is backgrounded', () => {
    setVisibility('hidden');
    expect(refreshDay).not.toHaveBeenCalled();
  });

  it('refreshes on pageshow (bfcache / iOS standalone resume)', () => {
    window.dispatchEvent(new Event('pageshow'));
    expect(refreshDay).toHaveBeenCalledTimes(1);
  });

  it('refreshes on window focus', () => {
    window.dispatchEvent(new Event('focus'));
    expect(refreshDay).toHaveBeenCalledTimes(1);
  });

  it('refreshes when midnight passes with the app open', () => {
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(refreshDay).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(refreshDay).toHaveBeenCalledTimes(1);
  });

  it('keeps watching after a rollover', () => {
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(refreshDay).toHaveBeenCalledTimes(1);
  });
});
