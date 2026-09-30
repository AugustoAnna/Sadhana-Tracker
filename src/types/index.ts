import type { BacktrackRoute } from '@/features/backtracking/types';

export type PracticeType = 'guided' | 'unguided' | 'timed';

export type LogSource = 'checkbox' | 'minutes' | 'player';

export type DrawnToType = 'physical-yoga' | 'pranayama' | 'meditation' | 'chants';

export type DurationPreference = 'under-5' | '5-10' | '10-20' | 'over-20';

export interface Practice {
  id: string;
  name: string;
  minutes: number | null;
  type: PracticeType;
  category?: 'physical-yoga' | 'pranayama' | 'meditation' | 'chants' | 'other';
}

export interface PracticeInstance {
  id: string;
  practiceId: string;
  instanceNumber: 1 | 2;
  order: number;
  addedAt: number;
}

export interface PracticeLog {
  id: string;
  practiceId: string;
  instanceId: string;
  minutes: number;
  timestamp: number;
  localDate: string;
  source: LogSource;
  wasOffline?: boolean;
  /** True when localDate was the day before the write. Absent on older rows = false. */
  backtrack?: boolean;
  /** How the user reached Yesterday for this write. Present only when backtrack. */
  route?: BacktrackRoute;
}

export interface Profile {
  id: 'profile';
  name: string;
  isMeditator: boolean | null;
  drawnToType: DrawnToType | null;
  durationPreference: DurationPreference | null;
  onboardingComplete: boolean;
  /** ISO timestamp of finishing setup; mirrors participants.onboarding_completed_at. */
  onboardingCompletedAt?: string;
  instanceEducationShown: boolean;
  firstRecordReassuranceShown: boolean;
  notificationPermissionAsked: boolean;
  trackerIntroSeen: boolean;
  featureDiscoveryStep: number;
  /** Start of the empty-day run the missed-day sheet last showed for (yyyy-MM-dd). Local only. */
  missedSheetRunKey?: string | null;
}

export type ReminderSlot = 1 | 2 | 3;
export type ReminderKey = ReminderSlot | 'sadhguru-presence';

export interface Reminder {
  id: ReminderKey;
  kind: 'generic' | 'practice';
  slot?: ReminderSlot;
  practiceId?: string;
  time: string;
  enabled: boolean;
  remoteId?: string;
}

export interface SavedSession {
  id: string;
  name: string;
  practiceInstanceIds: string[];
  lastUsedAt: number;
}

export interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: unknown;
  createdAt: number;
}

export interface AppMeta {
  id: 'meta';
  lastLevelUpDate: string | null; // YYYY-MM-DD
  pendingJourneyMinutes: number;
  recentSessionKeys: string[]; // serialized practice instance id lists
}

export interface LevelInfo {
  level: number;
  label: string;
  threshold: number;
  phase: number;
  phaseName: string;
}

export interface JourneyState {
  totalMinutes: number;
  currentLevel: number;
  nextLevel: number;
  minutesToNext: number;
  progressInLevel: number; // 0-1
  levelsReached: Map<number, { date: string; minutes: number }>;
}

export interface DayStats {
  date: string;
  minutes: number;
  practicesCompleted: number;
}

export interface SessionDraft {
  practiceInstanceIds: string[];
  includeInvocation: boolean;
  /** Duration in minutes for timed player sessions. */
  timedMinutes?: number;
}

export type ParticipantType = 'meditator' | 'potential';
