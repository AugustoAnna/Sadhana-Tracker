import { describe, it, expect } from 'vitest';
import { GATED_ROUTES, isGatedRouteEnabled } from './routeFlags';
import { STUDY_FEATURES, type FeatureKey } from '@/features';

const studyEnabled = (key: FeatureKey) => STUDY_FEATURES[key];

describe('gated routes (study build)', () => {
  for (const [path, flag] of Object.entries(GATED_ROUTES)) {
    it(`${path} returns 404 when ${flag} is off`, () => {
      expect(STUDY_FEATURES[flag]).toBe(false);
      expect(isGatedRouteEnabled(path, studyEnabled)).toBe(false);
    });
  }

  it('allows core study routes', () => {
    expect(isGatedRouteEnabled('/practice-home', studyEnabled)).toBe(true);
    expect(isGatedRouteEnabled('/player', studyEnabled)).toBe(true);
  });
});

describe('study feature flags', () => {
  const FLAGS: FeatureKey[] = [
    'sessions',
    'invocation',
    'journey',
    'postPracticeContent',
    'potentialMeditatorPath',
    'denominator',
    'mandala',
    'detailLogging',
  ];

  for (const flag of FLAGS) {
    it(`${flag} is disabled in study`, () => {
      expect(STUDY_FEATURES[flag]).toBe(false);
    });
  }
});
