import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PracticeInstance, PracticeLog } from '@/types';

const TODAY = '2026-09-30';
const NOW = Date.parse(`${TODAY}T08:00:00`);

function inst(id: string, practiceId: string, order: number): PracticeInstance {
  return { id, practiceId, instanceNumber: 1, order, addedAt: NOW };
}

function log(instanceId: string, practiceId: string, timestamp: number, source: PracticeLog['source'] = 'checkbox'): PracticeLog {
  return { id: `${instanceId}-log`, practiceId, instanceId, minutes: 15, timestamp, localDate: TODAY, source };
}

const state = {
  instances: [] as PracticeInstance[],
  logs: [] as PracticeLog[],
  currentDay: TODAY,
  remoteRestoreSettled: true,
  profile: {},
  playerSession: null,
  logPractice: vi.fn(),
  unlogPractice: vi.fn(),
  setPlayerSession: vi.fn(),
  markMissedSheetShown: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/stores/appStore', () => ({
  useAppStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state }),
  getDefaultLogMinutes: () => 15,
}));
vi.mock('@/hooks', () => ({ useHaptic: () => () => {} }));
vi.mock('@/services/instrumentation', () => ({ track: vi.fn() }));
// The calendar is cumulative and not under test here.
vi.mock('@/components/PracticeCalendar', () => ({
  PracticeCalendar: () => null,
  ProgressStatBoxes: () => null,
}));

import { PracticeHome } from '@/screens/PracticeHome';

function renderHome() {
  return render(
    <MemoryRouter>
      <PracticeHome />
    </MemoryRouter>,
  );
}

function rowFor(name: string) {
  return screen.getByText(name).closest('div.flex.items-center') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.instances = [inst('isha', 'isha-kriya', 0), inst('bhastrika', 'bhastrika-kriya', 1)];
  state.logs = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Practice home untick', () => {
  it('lets a fresh tick be taken back', () => {
    state.logs = [log('isha', 'isha-kriya', NOW - 10_000)];
    renderHome();

    fireEvent.click(within(rowFor('Isha Kriya')).getByLabelText('Undo, mark not done'));

    expect(state.unlogPractice).toHaveBeenCalledWith('isha-log');
  });

  it('keeps a brand new tick untappable for half a second, so a double tap does not undo it', () => {
    state.logs = [log('isha', 'isha-kriya', NOW)];
    renderHome();
    expect(within(rowFor('Isha Kriya')).queryByLabelText('Undo, mark not done')).toBeNull();
    expect(within(rowFor('Isha Kriya')).getByLabelText('Completed')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(500); });

    expect(within(rowFor('Isha Kriya')).queryByLabelText('Undo, mark not done')).not.toBeNull();
  });

  it('locks the tick by itself once its minute is up', () => {
    state.logs = [log('isha', 'isha-kriya', NOW - 10_000)];
    renderHome();
    expect(within(rowFor('Isha Kriya')).queryByLabelText('Undo, mark not done')).not.toBeNull();

    act(() => { vi.advanceTimersByTime(50_000); });

    expect(within(rowFor('Isha Kriya')).queryByLabelText('Undo, mark not done')).toBeNull();
    expect(within(rowFor('Isha Kriya')).getByLabelText('Completed')).toBeTruthy();
  });

  it('shows an older tick as locked', () => {
    state.logs = [log('isha', 'isha-kriya', NOW - 60_000)];
    renderHome();

    expect(within(rowFor('Isha Kriya')).queryByLabelText('Undo, mark not done')).toBeNull();
    expect(within(rowFor('Isha Kriya')).getByLabelText('Completed')).toBeTruthy();
  });

  it('never unlocks a practice finished in the player', () => {
    state.logs = [log('isha', 'isha-kriya', NOW - 10_000, 'player')];
    renderHome();

    expect(within(rowFor('Isha Kriya')).queryByLabelText('Undo, mark not done')).toBeNull();
  });

  it('leaves the other rows alone', () => {
    state.logs = [log('isha', 'isha-kriya', NOW - 10_000)];
    renderHome();

    expect(within(rowFor('Bhastrika Kriya')).getByLabelText('Mark complete')).toBeTruthy();
    expect(within(rowFor('Bhastrika Kriya')).queryByLabelText('Undo, mark not done')).toBeNull();
  });
});
