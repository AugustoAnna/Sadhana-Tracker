import Dexie, { type Table } from 'dexie';
import type {
  AppMeta,
  PracticeInstance,
  PracticeLog,
  Profile,
  Reminder,
  SavedSession,
  SyncQueueItem,
} from '@/types';

export class SadhanaDB extends Dexie {
  profile!: Table<Profile>;
  practiceInstances!: Table<PracticeInstance>;
  practiceLogs!: Table<PracticeLog>;
  reminders!: Table<Reminder>;
  savedSessions!: Table<SavedSession>;
  syncQueue!: Table<SyncQueueItem>;
  appMeta!: Table<AppMeta>;

  constructor() {
    super('SadhanaTracker');
    this.version(1).stores({
      profile: 'id',
      practiceInstances: 'id, practiceId, order',
      practiceLogs: 'id, practiceId, instanceId, timestamp',
      reminders: 'id',
      savedSessions: 'id, lastUsedAt',
      syncQueue: 'id, createdAt',
      appMeta: 'id',
    });
  }
}

export const db = new SadhanaDB();

export async function initDB() {
  const profile = await db.profile.get('profile');
  if (!profile) {
    await db.profile.add({
      id: 'profile',
      name: '',
      isMeditator: null,
      onboardingComplete: false,
      instanceEducationShown: false,
      notificationPermissionAsked: false,
    });
  }

  const meta = await db.appMeta.get('meta');
  if (!meta) {
    await db.appMeta.add({
      id: 'meta',
      lastLevelUpDate: null,
      pendingJourneyMinutes: 0,
      recentSessionKeys: [],
    });
  }

  const reminders = await db.reminders.count();
  if (reminders === 0) {
    await db.reminders.bulkAdd([
      { id: 1, time: '06:00', enabled: false },
      { id: 2, time: '12:00', enabled: false },
      { id: 3, time: '18:00', enabled: false },
    ]);
  }
}
