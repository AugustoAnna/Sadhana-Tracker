export type PracticeType = 'guided' | 'unguided' | 'timed';

export type LogSource = 'manual' | 'player';

export interface Practice {
  id: string;
  name: string;
  minutes: number | null;
  type: PracticeType;
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
  source: LogSource;
}

export interface Profile {
  id: 'profile';
  name: string;
  isMeditator: boolean | null;
  onboardingComplete: boolean;
  instanceEducationShown: boolean;
  notificationPermissionAsked: boolean;
}

export interface Reminder {
  id: 1 | 2 | 3;
  time: string; // HH:mm
  enabled: boolean;
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
}

export type ParticipantType = 'meditator' | 'potential';
