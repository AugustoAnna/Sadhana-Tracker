import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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
  remoteRestoreSettled: true,
  discoveryShownOn: null as string | null,
  pushEntryOn: null as string | null,
  profile: {
    name: 'Asha',
    onboardingComplete: true,
    featureDiscoveryStep: 0,
    missedSheetRunKey: null as string | null,
  },
  playerSession: null,
  logPractice: vi.fn(),
  setPlayerSession: vi.fn(),
  markMissedSheetShown: vi.fn().mockResolvedValue(undefined),
  setFeatureDiscoveryStep: vi.fn().mockResolvedValue(undefined),
  markDiscoveryShownOn: vi.fn(),
  markPushEntryOn: vi.fn((day: string) => { state.pushEntryOn = day; }),
  refreshDay: vi.fn(),
};

vi.mock('@/stores/appStore', () => ({
  useAppStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state }),
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

function Location() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PracticeHome />
      <Location />
    </MemoryRouter>,
  );
}

const pushUrl = (forDay: string) => `/practice-home?day=yesterday&via=push&for=${forDay}`;

beforeEach(() => {
  vi.clearAllMocks();
  // The clock agrees with the store unless a test says otherwise.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 30, 6, 5));
  state.currentDay = TODAY;
  state.pushEntryOn = null;
  state.instances = [{ id: 'surya', practiceId: 'surya-kriya', instanceNumber: 1, order: 0, addedAt: Date.parse('2026-09-01T09:00:00') }];
  // Pre-release user, yesterday empty: both the tip and the missed-day sheet would qualify.
  state.logs = [log('2026-09-27')];
  state.profile = { name: 'Asha', onboardingComplete: true, featureDiscoveryStep: 0, missedSheetRunKey: null };
  state.markMissedSheetShown.mockResolvedValue(undefined);
  state.setFeatureDiscoveryStep.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe('Opening practice home from the backtracking push', () => {
  it('lands on Yesterday when it is still yesterday and still empty', () => {
    renderAt(pushUrl(YESTERDAY));

    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('backtrack_push_opened', { landed: 'yesterday' });
  });

  it('marks logs made from there as coming from the push', () => {
    renderAt(pushUrl(YESTERDAY));

    const row = screen.getByText('Surya Kriya').closest('div.flex.items-center') as HTMLElement;
    fireEvent.click(within(row).getByLabelText('Mark complete'));

    expect(state.logPractice).toHaveBeenCalledWith('surya', 15, 'checkbox', { date: YESTERDAY, route: 'push' });
  });

  it('lands on Today when yesterday was logged after all', () => {
    state.logs = [log(YESTERDAY)];
    renderAt(pushUrl(YESTERDAY));

    expect(screen.getByText('Today')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('backtrack_push_opened', { landed: 'today' });
  });

  it('lands on Today when the push is tapped a day late', () => {
    renderAt(pushUrl('2026-09-28'));

    expect(screen.getByText('Today')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('backtrack_push_opened', { landed: 'today' });
  });

  it('drops the query so a refresh or back does not replay it', () => {
    renderAt(pushUrl(YESTERDAY));

    expect(screen.getByTestId('location').textContent).toBe('/practice-home');
  });

  it('shows neither the tip nor the missed-day sheet, and marks the step for neither', () => {
    renderAt(pushUrl(YESTERDAY));

    expect(screen.queryByText('Log yesterday')).toBeNull();
    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
    expect(state.setFeatureDiscoveryStep).not.toHaveBeenCalled();
    expect(state.markMissedSheetShown).not.toHaveBeenCalled();
    expect(state.markPushEntryOn).toHaveBeenCalledWith(TODAY);
  });

  it('keeps the sheets away for the rest of that day', () => {
    state.pushEntryOn = TODAY;
    renderAt('/practice-home');

    expect(screen.queryByText('Log yesterday')).toBeNull();
    expect(screen.queryByText('Did you practice yesterday?')).toBeNull();
  });

  it('lets the sheets back on a later day, without a restart', () => {
    state.pushEntryOn = '2026-09-28';
    renderAt('/practice-home');

    expect(screen.getByText('Log yesterday')).toBeTruthy();
  });

  it('decides against the clock when the app was resumed before its date caught up', () => {
    // Backgrounded overnight: the store still says 29 Sep; it is 30 Sep 06:05.
    state.currentDay = YESTERDAY;
    state.refreshDay.mockImplementation(() => { state.currentDay = TODAY; });
    const { rerender } = renderAt(pushUrl(YESTERDAY));

    expect(state.refreshDay).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('backtrack_push_opened', { landed: 'yesterday' });
    rerender(
      <MemoryRouter initialEntries={['/practice-home']}>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(screen.getByText('Yesterday')).toBeTruthy();
  });

  it('handles a tap while practice home is already on screen', () => {
    let goTo: (to: string) => void = () => {};
    function Navigator() {
      const navigate = useNavigate();
      goTo = (to) => navigate(to, { replace: true });
      return null;
    }
    state.profile.featureDiscoveryStep = 1;
    state.profile.missedSheetRunKey = '2026-09-28';
    render(
      <MemoryRouter initialEntries={['/practice-home']}>
        <PracticeHome />
        <Navigator />
        <Location />
      </MemoryRouter>,
    );
    expect(screen.getByText('Today')).toBeTruthy();

    act(() => goTo(pushUrl(YESTERDAY)));

    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/practice-home');
  });

  it('ignores an ordinary visit', () => {
    renderAt('/practice-home');

    expect(track).not.toHaveBeenCalledWith('backtrack_push_opened', expect.anything());
    expect(state.markPushEntryOn).not.toHaveBeenCalled();
  });
});
