import type { DbSnapshot } from '@/db';
import {
  clearDatabase,
  demoDb,
  exportDatabase,
  importDatabase,
  initDB,
  realDb,
  setActiveDatabase,
  persistRealSnapshot,
  clearPersistedSnapshot,
  loadPersistedSnapshot,
  wasDemoActiveOnLastSession,
} from '@/db';
import type { PracticeInstance, PracticeLog, Profile } from '@/types';
import { generateId, formatDateKey } from '@/utils/dates';

export type DemoStateId =
  | 'empty-meditator'
  | 'empty-potential'
  | 'practiced-not-added'
  | 'practices-started'
  | 'setup-from-start';

export const DEMO_STATES: { id: DemoStateId; label: string; description: string }[] = [
  {
    id: 'empty-meditator',
    label: 'No practices · meditator',
    description: 'Onboarding complete, no practices added',
  },
  {
    id: 'empty-potential',
    label: 'No practices · potential meditator',
    description: 'Seed shown, Start here leads with Isha Kriya',
  },
  {
    id: 'practiced-not-added',
    label: 'Practiced but nothing added',
    description: 'Recent logs, empty practice list',
  },
  {
    id: 'practices-started',
    label: 'Practices started',
    description: 'Main practice home with sample practices',
  },
  {
    id: 'setup-from-start',
    label: 'Setup from the beginning',
    description: 'Full onboarding flow',
  },
];

async function seedDemoState(stateId: DemoStateId) {
  await clearDatabase(demoDb);

  const baseProfile: Profile = {
    id: 'profile',
    name: 'Demo User',
    isMeditator: true,
    drawnToType: null,
    durationPreference: null,
    onboardingComplete: true,
    instanceEducationShown: true,
    notificationPermissionAsked: true,
    trackerIntroSeen: true,
    featureDiscoveryStep: 3,
  };

  await demoDb.profile.put(baseProfile);
  await demoDb.appMeta.put({
    id: 'meta',
    lastLevelUpDate: null,
    pendingJourneyMinutes: 0,
    recentSessionKeys: [],
  });
  await demoDb.reminders.bulkPut([
    { id: 1, kind: 'generic', slot: 1, time: '06:00', enabled: false },
    { id: 2, kind: 'generic', slot: 2, time: '12:00', enabled: false },
    { id: 3, kind: 'generic', slot: 3, time: '18:00', enabled: false },
  ]);

  switch (stateId) {
    case 'empty-meditator':
      await demoDb.profile.update('profile', { isMeditator: true, onboardingComplete: true });
      break;

    case 'empty-potential':
      await demoDb.profile.update('profile', {
        isMeditator: false,
        drawnToType: 'meditation',
        durationPreference: '5-10',
        onboardingComplete: true,
      });
      break;

    case 'practiced-not-added': {
      const log: PracticeLog = {
        id: generateId(),
        practiceId: 'shambhavi',
        instanceId: generateId(),
        minutes: 21,
        timestamp: Date.now(),
        localDate: formatDateKey(new Date()),
        source: 'checkbox',
      };
      await demoDb.practiceLogs.add(log);
      break;
    }

    case 'practices-started': {
      const instances: PracticeInstance[] = [
        {
          id: generateId(),
          practiceId: 'mahamantra',
          instanceNumber: 1,
          order: 0,
          addedAt: Date.now(),
        },
        {
          id: generateId(),
          practiceId: 'shoonya',
          instanceNumber: 1,
          order: 1,
          addedAt: Date.now(),
        },
      ];
      await demoDb.practiceInstances.bulkAdd(instances);
      break;
    }

    case 'setup-from-start':
      await demoDb.profile.put({
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
      break;
  }
}

export async function recoverFromInterruptedDemo() {
  if (!wasDemoActiveOnLastSession()) return false;
  const snapshot = loadPersistedSnapshot();
  if (snapshot) {
    await importDatabase(realDb, snapshot);
  }
  await clearDatabase(demoDb);
  setActiveDatabase(false);
  clearPersistedSnapshot();
  return true;
}

export async function enterDemoMode(stateId: DemoStateId): Promise<DbSnapshot> {
  const snapshot = await exportDatabase(realDb);
  persistRealSnapshot(snapshot);
  await seedDemoState(stateId);
  setActiveDatabase(true);
  return snapshot;
}

export async function exitDemoMode() {
  const snapshot = loadPersistedSnapshot();
  if (snapshot) {
    await importDatabase(realDb, snapshot);
  }
  await clearDatabase(demoDb);
  setActiveDatabase(false);
  clearPersistedSnapshot();
}

export async function ensureDatabasesReady() {
  await initDB(realDb);
  await initDB(demoDb);
}
