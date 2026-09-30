import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PracticeInstance, PracticeLog } from '@/types';

const TODAY = '2026-09-30';
const YESTERDAY = '2026-09-29';

// Added today, so the missed-day sheet (tested separately) never opens here.
function inst(id: string, practiceId: string, order: number): PracticeInstance {
  return { id, practiceId, instanceNumber: 1, order, addedAt: Date.parse(`${TODAY}T06:00:00`) };
}

function log(instanceId: string, practiceId: string, localDate: string, minutes: number): PracticeLog {
  return {
    id: `${instanceId}-${localDate}-${minutes}`,
    practiceId,
    instanceId,
    minutes,
    timestamp: Date.parse(`${TODAY}T08:00:00`),
    localDate,
    source: 'checkbox',
  };
}

const state = {
  instances: [] as PracticeInstance[],
  logs: [] as PracticeLog[],
  currentDay: TODAY,
  profile: { firstRecordReassuranceShown: true },
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

function statValues() {
  return [
    screen.getByText('practices completed').previousElementSibling?.textContent,
    screen.getByText('minutes practiced').previousElementSibling?.textContent,
  ];
}

function rowFor(name: string) {
  return screen.getByText(name).closest('div.flex.items-center') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.currentDay = TODAY;
  state.instances = [inst('surya', 'surya-kriya', 0), inst('aum', 'aum-chanting', 1), inst('isha', 'isha-kriya', 2)];
  state.logs = [
    log('surya', 'surya-kriya', YESTERDAY, 15),
    log('aum', 'aum-chanting', YESTERDAY, 20),
    log('isha', 'isha-kriya', TODAY, 14),
  ];
});

describe('Practice home day switcher', () => {
  it('opens on Today, with the forward chevron inactive', () => {
    renderHome();

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByLabelText('Show today').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByLabelText('Show yesterday').getAttribute('aria-disabled')).toBe('false');
    expect(statValues()).toEqual(['1', '14']);
  });

  it('switches the stat cards and ticks to yesterday, and back', () => {
    renderHome();

    fireEvent.click(screen.getByLabelText('Show yesterday'));
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(statValues()).toEqual(['2', '35']);
    expect(within(rowFor('Surya Kriya')).queryByLabelText('Completed')).not.toBeNull();
    expect(within(rowFor('AUM Chanting')).getByText('20 mins practiced')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('day_switched', { to: 'yesterday', route: 'switcher' });

    fireEvent.click(screen.getByLabelText('Show today'));
    expect(screen.getByText('Today')).toBeTruthy();
    expect(statValues()).toEqual(['1', '14']);
    expect(within(rowFor('Surya Kriya')).queryByLabelText('Mark complete')).not.toBeNull();
  });

  it('ignores taps on the inactive chevron', () => {
    renderHome();

    fireEvent.click(screen.getByLabelText('Show today'));

    expect(screen.getByText('Today')).toBeTruthy();
    expect(track).not.toHaveBeenCalled();
  });

  it('hides play buttons on Yesterday only', () => {
    renderHome();
    expect(screen.queryAllByLabelText('Play').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Show yesterday'));

    expect(screen.queryAllByLabelText('Play')).toHaveLength(0);
  });

  it('logs a tick on Yesterday for yesterday, via the switcher', () => {
    state.logs = [];
    renderHome();
    fireEvent.click(screen.getByLabelText('Show yesterday'));

    fireEvent.click(within(rowFor('Surya Kriya')).getByLabelText('Mark complete'));

    expect(state.logPractice).toHaveBeenCalledWith('surya', 15, 'checkbox', { date: YESTERDAY, route: 'switcher' });
  });

  it('logs a tick on Today for today', () => {
    state.logs = [];
    renderHome();

    fireEvent.click(within(rowFor('Surya Kriya')).getByLabelText('Mark complete'));

    expect(state.logPractice).toHaveBeenCalledWith('surya', 15, 'checkbox', { date: TODAY, route: undefined });
  });

  it('asks about yesterday in the picker and logs to the day it opened on', async () => {
    renderHome();
    fireEvent.click(screen.getByLabelText('Show yesterday'));

    fireEvent.click(within(rowFor('AUM Chanting')).getByLabelText('Log minutes'));
    expect(screen.getByText('How long did you practice yesterday?')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });

    expect(state.logPractice).toHaveBeenCalledWith('aum', 20, 'minutes', {
      date: YESTERDAY,
      referenceDay: TODAY,
      route: 'switcher',
    });
  });

  it('shows a practice removed since yesterday as a done row on Yesterday only', () => {
    state.logs = [...state.logs, log('gone', 'angamardana', YESTERDAY, 30)];
    renderHome();
    expect(screen.queryByText('Angamardana')).toBeNull();

    fireEvent.click(screen.getByLabelText('Show yesterday'));

    const row = rowFor('Angamardana');
    expect(within(row).getByLabelText('Completed')).toBeTruthy();
    expect(within(row).queryByRole('button')).toBeNull();
    expect(statValues()).toEqual(['3', '65']);
  });

  it('returns to Today when the day rolls over', () => {
    const { rerender } = renderHome();
    fireEvent.click(screen.getByLabelText('Show yesterday'));

    state.currentDay = '2026-10-01';
    rerender(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );

    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('opens on Today again after leaving and coming back', () => {
    const { unmount } = renderHome();
    fireEvent.click(screen.getByLabelText('Show yesterday'));
    unmount();

    renderHome();

    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('has no switcher with an empty list', () => {
    state.instances = [];
    renderHome();

    expect(screen.queryByLabelText('Show yesterday')).toBeNull();
  });
});
