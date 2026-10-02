import type { PracticeInstance, Profile } from '@/types';

/**
 * Whether practice home should show the one-time "Log yesterday" tip.
 *
 * It is for people who set up before backtracking shipped. Finishing setup
 * since then sets featureDiscoveryStep to 1 (completeOnboarding), so step 0
 * with setup complete means an existing user who hasn't seen it.
 */
export function shouldShowDiscovery(profile: Profile | null, instances: PracticeInstance[]): boolean {
  if (!profile?.onboardingComplete) return false;
  if ((profile.featureDiscoveryStep ?? 0) >= 1) return false;
  return instances.length > 0;
}
