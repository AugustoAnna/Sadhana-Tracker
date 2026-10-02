import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SadhanaDB } from '@/db';
import type { Profile } from '@/types';

const db = new SadhanaDB('CompleteOnboardingTest');

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => db, isDemoDatabaseActive: () => false };
});
vi.mock('@/services/sync', () => ({
  queueSync: async () => {},
  getParticipantName: async () => null,
  fetchBannerTargets: async () => new Set<string>(),
}));
vi.mock('@/services/audio', () => ({ precachePracticeAudio: () => {} }));
vi.mock('@/utils/practiceReminders', () => ({ syncPracticeReminders: async () => [] }));

import { useAppStore } from '@/stores/appStore';

const fresh: Profile = {
  id: 'profile',
  name: 'Ben',
  isMeditator: null,
  drawnToType: null,
  durationPreference: null,
  onboardingComplete: false,
  instanceEducationShown: false,
  notificationPermissionAsked: false,
  trackerIntroSeen: false,
  featureDiscoveryStep: 0,
};

beforeEach(async () => {
  await db.profile.clear();
});

describe('finishing setup and the backtracking tip', () => {
  it('marks the tip handled for someone finishing setup now', async () => {
    await db.profile.put(fresh);

    await useAppStore.getState().completeOnboarding();

    expect((await db.profile.get('profile'))?.featureDiscoveryStep).toBe(1);
    expect(useAppStore.getState().profile?.featureDiscoveryStep).toBe(1);
  });

  it('never lowers a later feature step', async () => {
    await db.profile.put({ ...fresh, featureDiscoveryStep: 3 });

    await useAppStore.getState().completeOnboarding();

    expect((await db.profile.get('profile'))?.featureDiscoveryStep).toBe(3);
  });

  it('leaves it alone for a known participant signing in on a new device', async () => {
    await db.profile.put(fresh);

    await useAppStore.getState().completePotentialOnboarding();

    expect((await db.profile.get('profile'))?.featureDiscoveryStep).toBe(0);
  });
});
