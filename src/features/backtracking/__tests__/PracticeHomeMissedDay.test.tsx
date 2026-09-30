import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PracticeInstance, PracticeLog } from '@/types';

const TODAY = '2026-09-30';
const YESTERDAY = '2026-09-29';

function log(localDate: string): PracticeLog {
  return {
    id: `log-${localDate}`,
    practiceId: 'surya-kriya',
    instanceId: 'surya',
    minutes: 15,
    timestamp: Date.parse(`${localDate}T07:00:00`),
    localDate,
    source: 'checkbox',
  };
}

const state = {
  instances: [] as PracticeInstance[],
  logs: [] as PracticeLog[],
  currentDay: TODAY,
  profile: { name: 'Asha', firstRecordReassuranceShown: true, missedSheetRunKey: null as string | null },
  playerSession: null,
  logPractice: vi.fn(),
  setPlayerSession: vi.fn(),
  markFirstRecordReassuranceShown: vi.fn(),
  markMissedSheetShown: vi.fn(),
};

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  getDefaultLogMinutes: () => 15,
}));
vi.mock('@/hooks', () => ({ useHaptic: () => () => {} }));
const track = vi.fn();
vi.mock('@/services/instrumentation', () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock('@/components/PracticeCalendar', () => ({
  PracticeCalendar: () => null,
  ProgressStatBoxes: () => null,
}));

import { PracticeHome } from '@/screens/PracticeHome';

// A fresh element each time: rerendering the same element object lets React
// skip the update entirely.
const home = () => (
  <MemoryRouter>
    <PracticeHome />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  state.currentDay = TODAY;
  state.instances = [{ id: 'surya', practiceId: 'surya-kriya', instanceNumber: 1, order: 0, addedAt: Date.parse('2026-09-01T09:00:00') }];
  state.logs = [log('2026-09-28')];
  state.profile = { name: 'Asha', firstRecordReassuranceShown: true, missedSheetRunKey: null };
});

describe('Missed-day sheet on practice home', () => {
  it('asks about yesterday after one empty day, and records the run at once', () => {
    render(home());

    expect(screen.getByText('Did you practice yesterday?')).toBeTruthy();
    expect(state.markMissedSheetShown).toHaveBeenCalledWith(YESTERDAY);
    expect(track).toHaveBeenCalledWith('missed_day_sheet_shown', { variant: 1, gap_days: 1 });
  });

  it('greets by name after a few empty days', () => {
    state.logs = [log('2026-09-25')];
    render(home());

    expect(screen.getByText('Good to see you again, Asha')).toBeTruthy();
  });

  it('greets without a name when there is none', () => {
    state.logs = [log('2026-09-25')];
    state.profile.name = '  ';
    render(home());

    expect(screen.getByText('Good to see you again')).toBeTruthy();
  });

  it('welcomes back after a long gap', () => {
    state.logs = [log('2026-09-10')];
    render(home());

    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it('stays quiet when yesterday is logged', () => {
    state.logs = [log(YESTERDAY)];
    render(home());

    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
    expect(state.markMissedSheetShown).not.toHaveBeenCalled();
  });

  it('stays quiet when it already showed for this run', () => {
    state.profile.missedSheetRunKey = YESTERDAY;
    render(home());

    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
  });

  it('lands on Yesterday from the primary button, and logs from there carry the sheet route', () => {
    render(home());

    fireEvent.click(screen.getByRole('button', { name: "Log yesterday's practices" }));

    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('missed_day_sheet_answered', { variant: 1, answer: 'log' });

    const row = screen.getByText('Surya Kriya').closest('div.flex.items-center') as HTMLElement;
    fireEvent.click(within(row).getByLabelText('Mark complete'));
    expect(state.logPractice).toHaveBeenCalledWith('surya', 15, 'checkbox', { date: YESTERDAY, route: 'sheet' });
  });

  it('stays on Today and logs nothing for "I didn\'t practice"', () => {
    render(home());

    fireEvent.click(screen.getByRole('button', { name: "I didn't practice yesterday" }));

    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(state.logPractice).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('missed_day_sheet_answered', { variant: 1, answer: 'didnt' });
  });

  it('records closing it as a dismissal', () => {
    render(home());

    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
    expect(track).toHaveBeenCalledWith('missed_day_sheet_answered', { variant: 1, answer: 'dismiss' });
  });

  it('asks once per run even before the saved run key reaches the store', () => {
    const { rerender } = render(home());
    fireEvent.click(screen.getByLabelText('Close'));

    rerender(home());

    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
    expect(state.markMissedSheetShown).toHaveBeenCalledTimes(1);
  });

  it('asks on the new day when the app is left open across midnight', () => {
    state.logs = [log('2026-09-28'), log(YESTERDAY)];
    const { rerender } = render(home());
    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();

    // 30 Sep went unlogged; the rollover makes it "yesterday".
    state.currentDay = '2026-10-01';
    rerender(home());

    expect(screen.getByText('Did you practice yesterday?')).toBeTruthy();
    expect(state.markMissedSheetShown).toHaveBeenCalledWith(TODAY);
  });
});
