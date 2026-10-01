import { describe, it, expect } from 'vitest';
import type { PracticeInstance, PracticeLog, Profile } from '@/types';
import { nextPrompt } from '../promptRule';

const TODAY = '2026-09-30';

const instances: PracticeInstance[] = [
  { id: 'surya', practiceId: 'surya-kriya', instanceNumber: 1, order: 0, addedAt: Date.parse('2026-09-01T09:00:00') },
];

function logOn(localDate: string): PracticeLog {
  return {
    id: localDate,
    practiceId: 'surya-kriya',
    instanceId: 'surya',
    minutes: 15,
    timestamp: Date.parse(`${localDate}T07:00:00`),
    localDate,
    source: 'checkbox',
  };
}

// Set up before the release, tip not seen yet, last log two days ago.
const base = {
  profile: { onboardingComplete: true, featureDiscoveryStep: 0, missedSheetRunKey: null } as unknown as Profile,
  instances,
  logs: [logOn('2026-09-28')],
  discoveryShownOn: null,
  pushEntryOn: null,
};
const tipSeen = { ...base, profile: { ...base.profile, featureDiscoveryStep: 1 } };

describe('nextPrompt', () => {
  it('shows the tip first', () => {
    expect(nextPrompt(base, TODAY)).toEqual({ kind: 'discovery' });
  });

  it('holds the missed-day question on the day the tip showed', () => {
    expect(nextPrompt({ ...tipSeen, discoveryShownOn: TODAY }, TODAY)).toBeNull();
  });

  it('asks about yesterday once the tip is out of the way', () => {
    expect(nextPrompt(tipSeen, TODAY)).toMatchObject({ kind: 'missed', variant: 1, runKey: '2026-09-29' });
  });

  it('shows neither on a day the app was opened from the push', () => {
    expect(nextPrompt({ ...base, pushEntryOn: TODAY }, TODAY)).toBeNull();
  });

  it('shows nothing when yesterday is logged', () => {
    expect(nextPrompt({ ...tipSeen, logs: [logOn('2026-09-29')] }, TODAY)).toBeNull();
  });
});
