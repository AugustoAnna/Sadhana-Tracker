import type { FeatureKey } from '@/features';

/** Paths gated behind a feature flag. Unlisted paths are always registered. */
export const GATED_ROUTES: Record<string, FeatureKey> = {
  '/session/select': 'sessions',
  '/session/review': 'sessions',
  '/level-up': 'journey',
  '/journey': 'journey',
};

export function isGatedRouteEnabled(path: string, isEnabled: (key: FeatureKey) => boolean): boolean {
  const flag = GATED_ROUTES[path];
  if (!flag) return true;
  return isEnabled(flag);
}
