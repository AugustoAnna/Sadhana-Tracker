import type { LocalDate, PracticeInstance, PracticeLog, Profile } from '@/types';
import { shouldShowDiscovery } from './discoveryRule';
import { missedDayDecision, type MissedVariant } from './missedDayRule';

export type Prompt =
  | { kind: 'discovery' }
  | { kind: 'missed'; variant: MissedVariant; gapDays: number; runKey: LocalDate };

/**
 * The prompt practice home opens with, if any. The one-time tip comes first
 * and the missed-day question waits a day behind it; a day the app was opened
 * from the backtracking push gets neither, since the push already asked.
 * `discoveryShownOn` and `pushEntryOn` are this app load's markers.
 */
export function nextPrompt(
  s: {
    profile: Profile | null;
    instances: PracticeInstance[];
    logs: PracticeLog[];
    discoveryShownOn: LocalDate | null;
    pushEntryOn: LocalDate | null;
  },
  today: LocalDate,
): Prompt | null {
  if (s.pushEntryOn === today) return null;
  if (!s.discoveryShownOn && shouldShowDiscovery(s.profile, s.instances)) return { kind: 'discovery' };
  if (s.discoveryShownOn === today) return null;
  const decision = missedDayDecision(s.logs, s.instances, s.profile?.missedSheetRunKey, today);
  if (!decision.show) return null;
  return { kind: 'missed', variant: decision.variant, gapDays: decision.gapDays, runKey: decision.runKey };
}
