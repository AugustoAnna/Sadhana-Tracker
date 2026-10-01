import { describe, it, expect } from 'vitest';
import type { PracticeInstance, Profile } from '@/types';
import { shouldShowDiscovery } from '../discoveryRule';

const practice: PracticeInstance = { id: 'i1', practiceId: 'isha-kriya', instanceNumber: 1, order: 0, addedAt: 0 };

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'profile',
    name: 'Asha',
    isMeditator: null,
    drawnToType: null,
    durationPreference: null,
    onboardingComplete: true,
    instanceEducationShown: true,
    notificationPermissionAsked: true,
    trackerIntroSeen: true,
    featureDiscoveryStep: 0,
    ...overrides,
  };
}

describe('shouldShowDiscovery', () => {
  it('shows for someone who set up before the release', () => {
    expect(shouldShowDiscovery(profile({}), [practice])).toBe(true);
  });

  it('shows even when the phone never recorded when setup finished', () => {
    // Set up before migration 008: onboardingCompletedAt is empty locally.
    expect(shouldShowDiscovery(profile({ onboardingCompletedAt: undefined }), [practice])).toBe(true);
  });

  it('skips once handled, or for someone who set up after the release', () => {
    expect(shouldShowDiscovery(profile({ featureDiscoveryStep: 1 }), [practice])).toBe(false);
    expect(shouldShowDiscovery(profile({ featureDiscoveryStep: 3 }), [practice])).toBe(false);
  });

  it('skips before setup is finished', () => {
    expect(shouldShowDiscovery(profile({ onboardingComplete: false }), [practice])).toBe(false);
  });

  it('skips with an empty list', () => {
    expect(shouldShowDiscovery(profile({}), [])).toBe(false);
  });

  it('skips without a profile', () => {
    expect(shouldShowDiscovery(null, [practice])).toBe(false);
  });
});
