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

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      practiceInstances: 'id, practiceId, order',
      practiceLogs: 'id, practiceId, instanceId, timestamp',
      reminders: 'id',
      savedSessions: 'id, lastUsedAt',
      syncQueue: 'id, createdAt',
      appMeta: 'id',
    });
    this.version(2).stores({
      profile: 'id',
      practiceInstances: 'id, practiceId, order',
      practiceLogs: 'id, practiceId, instanceId, timestamp',
      reminders: 'id',
      savedSessions: 'id, lastUsedAt',
      syncQueue: 'id, createdAt',
      appMeta: 'id',
    }).upgrade(async (tx) => {
      const profile = await tx.table('profile').get('profile');
      if (profile) {
        await tx.table('profile').update('profile', {
          drawnToType: profile.drawnToType ?? null,
          durationPreference: profile.durationPreference ?? null,
          trackerIntroSeen: profile.trackerIntroSeen ?? false,
          featureDiscoveryStep: profile.featureDiscoveryStep ?? 0,
        });
      }
    });
    this.version(3).stores({
      profile: 'id',
      practiceInstances: 'id, practiceId, order',
      practiceLogs: 'id, practiceId, instanceId, timestamp',
      reminders: 'id',
      savedSessions: 'id, lastUsedAt',
      syncQueue: 'id, createdAt',
      appMeta: 'id',
    }).upgrade(async (tx) => {
      const profile = await tx.table('profile').get('profile');
      if (profile) {
        await tx.table('profile').update('profile', {
          firstRecordReassuranceShown: profile.firstRecordReassuranceShown ?? false,
        });
      }
    });
  }
}

export const realDb = new SadhanaDB('SadhanaTracker');
export const demoDb = new SadhanaDB('SadhanaTrackerDemo');

let activeDb: SadhanaDB = realDb;

export function getDb(): SadhanaDB {
  return activeDb;
}

/** @deprecated Use getDb() — kept for gradual migration */
export const db = realDb;

export function setActiveDatabase(demo: boolean) {
  activeDb = demo ? demoDb : realDb;
}

export function isDemoDatabaseActive() {
  return activeDb === demoDb;
}

export interface DbSnapshot {
  profile: Profile | undefined;
  practiceInstances: PracticeInstance[];
  practiceLogs: PracticeLog[];
  reminders: Reminder[];
  savedSessions: SavedSession[];
  syncQueue: SyncQueueItem[];
  appMeta: AppMeta | undefined;
}

export async function exportDatabase(database: SadhanaDB): Promise<DbSnapshot> {
  const [profile, practiceInstances, practiceLogs, reminders, savedSessions, syncQueue, appMeta] =
    await Promise.all([
      database.profile.get('profile'),
      database.practiceInstances.toArray(),
      database.practiceLogs.toArray(),
      database.reminders.toArray(),
      database.savedSessions.toArray(),
      database.syncQueue.toArray(),
      database.appMeta.get('meta'),
    ]);
  return { profile, practiceInstances, practiceLogs, reminders, savedSessions, syncQueue, appMeta };
}

export async function importDatabase(database: SadhanaDB, snapshot: DbSnapshot) {
  await Promise.all([
    database.profile.clear(),
    database.practiceInstances.clear(),
    database.practiceLogs.clear(),
    database.reminders.clear(),
    database.savedSessions.clear(),
    database.syncQueue.clear(),
    database.appMeta.clear(),
  ]);

  if (snapshot.profile) {
    await database.profile.put(snapshot.profile);
  }
  if (snapshot.appMeta) {
    await database.appMeta.put(snapshot.appMeta);
  }
  if (snapshot.practiceInstances.length) {
    await database.practiceInstances.bulkPut(snapshot.practiceInstances);
  }
  if (snapshot.practiceLogs.length) {
    await database.practiceLogs.bulkPut(snapshot.practiceLogs);
  }
  if (snapshot.reminders.length) {
    await database.reminders.bulkPut(snapshot.reminders);
  }
  if (snapshot.savedSessions.length) {
    await database.savedSessions.bulkPut(snapshot.savedSessions);
  }
  if (snapshot.syncQueue.length) {
    await database.syncQueue.bulkPut(snapshot.syncQueue);
  }
}

export async function clearDatabase(database: SadhanaDB) {
  await Promise.all([
    database.practiceInstances.clear(),
    database.practiceLogs.clear(),
    database.savedSessions.clear(),
    database.syncQueue.clear(),
  ]);
}

const seedInFlight = new WeakMap<SadhanaDB, Promise<void>>();

export function initDB(database: SadhanaDB = getDb()): Promise<void> {
  // StrictMode mounts Bootstrap's effect twice in dev, so two seeds can race a
  // freshly-wiped database: both read it as empty and both add the fixed
  // 'profile'/'meta'/reminder keys, and the loser throws ConstraintError. Users
  // whose storage is evicted land on that same empty-database path, so keep the
  // check and the write atomic rather than relying on a single caller.
  const inFlight = seedInFlight.get(database);
  if (inFlight) return inFlight;
  const run = seedDatabase(database).finally(() => seedInFlight.delete(database));
  seedInFlight.set(database, run);
  return run;
}

async function seedDatabase(database: SadhanaDB): Promise<void> {
  await database.transaction(
    'rw',
    database.profile,
    database.appMeta,
    database.reminders,
    async () => {
      if (!(await database.profile.get('profile'))) {
        await database.profile.add({
          id: 'profile',
          name: '',
          isMeditator: null,
          drawnToType: null,
          durationPreference: null,
          onboardingComplete: false,
          instanceEducationShown: false,
          notificationPermissionAsked: false,
          trackerIntroSeen: false,
          featureDiscoveryStep: 0,
        });
      }

      if (!(await database.appMeta.get('meta'))) {
        await database.appMeta.add({
          id: 'meta',
          lastLevelUpDate: null,
          pendingJourneyMinutes: 0,
          recentSessionKeys: [],
        });
      }

      if ((await database.reminders.count()) === 0) {
        await database.reminders.bulkAdd([
          { id: 1, kind: 'generic', slot: 1, time: '06:00', enabled: true },
          { id: 2, kind: 'generic', slot: 2, time: '12:00', enabled: false },
          { id: 3, kind: 'generic', slot: 3, time: '18:00', enabled: false },
        ]);
      }
    },
  );
}

const SNAPSHOT_KEY = 'sadhana_real_snapshot';
const DEMO_ACTIVE_KEY = 'sadhana_demo_active';

export function persistRealSnapshot(snapshot: DbSnapshot) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  localStorage.setItem(DEMO_ACTIVE_KEY, '1');
}

export function loadPersistedSnapshot(): DbSnapshot | null {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DbSnapshot;
  } catch {
    return null;
  }
}

export function clearPersistedSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
  localStorage.removeItem(DEMO_ACTIVE_KEY);
}

export function wasDemoActiveOnLastSession(): boolean {
  return localStorage.getItem(DEMO_ACTIVE_KEY) === '1';
}
