import { APP_ENV } from '@/config/environment';

const LAB_FEATURES = {
  sessions: true,
  invocation: true,
  journey: true,
  postPracticeContent: true,
  potentialMeditatorPath: true,
  denominator: true,
  mandala: true,
  detailLogging: true,
} as const;

const STUDY_FEATURES = {
  sessions: false,
  invocation: false,
  journey: false,
  postPracticeContent: false,
  potentialMeditatorPath: false,
  denominator: false,
  mandala: false,
  detailLogging: false,
} as const;

export const FEATURES = APP_ENV === 'lab' ? LAB_FEATURES : STUDY_FEATURES;

export type FeatureKey = keyof typeof STUDY_FEATURES;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
