import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  remoteRestoreSettled: true,
  discoveryShownOn: null as string | null,
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
  markDiscoveryShownOn: vi.fn((day: string) => { state.discoveryShownOn = day; }),
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

const home = () => (
  <MemoryRouter>
    <PracticeHome />
  </MemoryRouter>
);

const TIP = 'Log yesterday';
const MISSED = 'Did you practice yesterday?';

beforeEach(() => {
  vi.clearAllMocks();
  state.currentDay = TODAY;
  state.remoteRestoreSettled = true;
  state.discoveryShownOn = null;
  state.instances = [{ id: 'surya', practiceId: 'surya-kriya', instanceNumber: 1, order: 0, addedAt: Date.parse('2026-09-01T09:00:00') }];
  state.logs = [log(YESTERDAY)];
  state.profile = { name: 'Asha', onboardingComplete: true, featureDiscoveryStep: 0, missedSheetRunKey: null };
  state.markMissedSheetShown.mockResolvedValue(undefined);
  state.setFeatureDiscoveryStep.mockResolvedValue(undefined);
});

describe('Backtracking tip on practice home', () => {
  it('shows once to someone who set up before the release, and records it at once', () => {
    render(home());

    expect(screen.getByText(TIP)).toBeTruthy();
    expect(screen.getByText("Log yesterday's practice, so nothing you did is lost from the record.")).toBeTruthy();
    expect(state.setFeatureDiscoveryStep).toHaveBeenCalledWith(1);
    expect(track).toHaveBeenCalledWith('feature_discovery_shown', { feature: 'backtracking' });
  });

  it('stays on Today after Got it', () => {
    render(home());

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.queryByText(TIP)).toBeNull();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('feature_discovery_dismissed', { feature: 'backtracking', via: 'button' });
  });

  it('records closing with ✕', () => {
    render(home());

    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByText(TIP)).toBeNull();
    expect(track).toHaveBeenCalledWith('feature_discovery_dismissed', { feature: 'backtracking', via: 'close' });
  });

  it('stays hidden once handled, or for someone who set up after the release', () => {
    state.profile.featureDiscoveryStep = 1;
    render(home());

    expect(screen.queryByText(TIP)).toBeNull();
    expect(state.setFeatureDiscoveryStep).not.toHaveBeenCalled();
  });

  it('waits for the launch-time server pull', () => {
    state.remoteRestoreSettled = false;
    const { rerender } = render(home());
    expect(screen.queryByText(TIP)).toBeNull();

    state.remoteRestoreSettled = true;
    rerender(home());

    expect(screen.getByText(TIP)).toBeTruthy();
  });

  it('goes before the missed-day question, which then waits for another day', () => {
    state.logs = [log('2026-09-28')]; // yesterday empty: the missed-day sheet would also qualify
    const { rerender } = render(home());

    expect(screen.getByText(TIP)).toBeTruthy();
    expect(screen.queryByText(MISSED)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    rerender(home());

    expect(screen.queryByText(MISSED)).toBeNull();
    expect(state.markMissedSheetShown).not.toHaveBeenCalled();
  });

  it('never opens both sheets, even when the check runs twice in a row', () => {
    // StrictMode runs effects twice before the store's "shown today" is
    // re-read; the second run must not fall through to the missed-day sheet.
    state.logs = [log('2026-09-28')];
    render(<StrictMode>{home()}</StrictMode>);

    expect(screen.getByText(TIP)).toBeTruthy();
    expect(screen.queryByText(MISSED)).toBeNull();
    expect(state.markMissedSheetShown).not.toHaveBeenCalled();
  });

  it('lets the missed-day question through on a later day', () => {
    state.profile.featureDiscoveryStep = 1;
    state.discoveryShownOn = '2026-09-29';
    state.logs = [log('2026-09-28')];
    render(home());

    expect(screen.getByText(MISSED)).toBeTruthy();
  });
});
