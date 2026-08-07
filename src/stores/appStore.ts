import { create } from 'zustand';
import { getDb } from '@/db';
import type { PracticeInstance, PracticeLog, Profile, Reminder, SavedSession, SessionDraft } from '@/types';
import { getPractice } from '@/data/catalogue';
import { computeCurrentLevel } from '@/data/journey';
import { generateId, todayKey } from '@/utils/dates';
import { queueSync } from '@/services/sync';
import { enterDemoMode as enterDemoModeService, exitDemoMode as exitDemoModeService, type DemoStateId } from '@/services/demoMode';

interface AppStore {
  profile: Profile | null;
  instances: PracticeInstance[];
  logs: PracticeLog[];
  reminders: Reminder[];
  savedSessions: SavedSession[];
  pendingJourneyMinutes: number;
  sessionDraft: SessionDraft | null;
  playerSession: SessionDraft | null;
  levelCrossed: number | null;
  toast: string | null;
  isDemoMode: boolean;

  hydrate: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  setMeditatorStatus: (isMeditator: boolean) => Promise<void>;
  completeOnboarding: (reminderEnabled: boolean) => Promise<void>;
  addPracticeInstance: (practiceId: string) => Promise<PracticeInstance | null>;
  removePracticeInstance: (instanceId: string) => Promise<void>;
  confirmPracticeInstances: (fromFirstSetup: boolean) => Promise<void>;
  logPractice: (instanceId: string, minutes: number, source: 'manual' | 'player') => Promise<void>;
  setReminder: (id: 1 | 2 | 3, time: string, enabled: boolean) => Promise<void>;
  setSessionDraft: (draft: SessionDraft | null) => void;
  setPlayerSession: (draft: SessionDraft | null) => void;
  saveSession: (name: string, instanceIds: string[]) => Promise<void>;
  addRecentSession: (instanceIds: string[]) => Promise<void>;
  clearPendingJourney: () => Promise<void>;
  setLevelCrossed: (level: number | null) => void;
  markLevelUpShown: () => Promise<void>;
  showToast: (msg: string) => void;
  clearToast: () => void;
  markInstanceEducationShown: () => Promise<void>;
  enterDemoMode: (stateId: DemoStateId) => Promise<void>;
  exitDemoMode: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  profile: null,
  instances: [],
  logs: [],
  reminders: [],
  savedSessions: [],
  pendingJourneyMinutes: 0,
  sessionDraft: null,
  playerSession: null,
  levelCrossed: null,
  toast: null,
  isDemoMode: false,

  hydrate: async () => {
    const db = getDb();
    const [profile, instances, logs, reminders, savedSessions, meta] = await Promise.all([
      db.profile.get('profile'),
      db.practiceInstances.orderBy('order').toArray(),
      db.practiceLogs.toArray(),
      db.reminders.toArray(),
      db.savedSessions.orderBy('lastUsedAt').reverse().toArray(),
      db.appMeta.get('meta'),
    ]);
    set({
      profile: profile ?? null,
      instances,
      logs,
      reminders,
      savedSessions,
      pendingJourneyMinutes: meta?.pendingJourneyMinutes ?? 0,
    });
  },

  setName: async (name) => {
    const db = getDb();
    await db.profile.update('profile', { name });
    const profile = { ...get().profile!, name };
    set({ profile });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  setMeditatorStatus: async (isMeditator) => {
    const db = getDb();
    await db.profile.update('profile', { isMeditator });
    const profile = { ...get().profile!, isMeditator };
    set({ profile });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  completeOnboarding: async (reminderEnabled) => {
    const db = getDb();
    await db.profile.update('profile', {
      onboardingComplete: true,
      notificationPermissionAsked: true,
    });
    if (reminderEnabled) {
      await db.reminders.update(1, { enabled: true, time: '06:00' });
    }
    const profile = await db.profile.get('profile');
    const reminders = await db.reminders.toArray();
    set({ profile: profile!, reminders });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
    if (reminderEnabled) {
      const r = reminders.find((x) => x.id === 1);
      if (r) await queueSync({ table: 'reminders', operation: 'insert', payload: r });
    }
  },

  addPracticeInstance: async (practiceId) => {
    const db = getDb();
    const { instances } = get();
    if (instances.length >= 21) return null;

    const existing = instances.filter((i) => i.practiceId === practiceId);
    const instanceNumber = (existing.length >= 1 ? 2 : 1) as 1 | 2;
    if (existing.length >= 2) return null;

    const instance: PracticeInstance = {
      id: generateId(),
      practiceId,
      instanceNumber,
      order: instances.length,
      addedAt: Date.now(),
    };
    await db.practiceInstances.add(instance);
    set({ instances: [...instances, instance] });
    await queueSync({ table: 'practice_instances', operation: 'insert', payload: instance });
    return instance;
  },

  removePracticeInstance: async (instanceId) => {
    const db = getDb();
    const { instances } = get();
    const filtered = instances.filter((i) => i.id !== instanceId);
    const reordered = filtered.map((inst, idx) => ({ ...inst, order: idx }));
    await db.practiceInstances.delete(instanceId);
    for (const inst of reordered) {
      await db.practiceInstances.update(inst.id, { order: inst.order });
    }
    set({ instances: reordered });
    await queueSync({
      table: 'practice_instances',
      operation: 'delete',
      payload: { id: instanceId } as PracticeInstance,
    });
  },

  confirmPracticeInstances: async (_fromFirstSetup) => {
    // instances already persisted on add
  },

  logPractice: async (instanceId, minutes, source) => {
    const db = getDb();
    const instance = get().instances.find((i) => i.id === instanceId);
    if (!instance) return;

    const log: PracticeLog = {
      id: generateId(),
      practiceId: instance.practiceId,
      instanceId,
      minutes,
      timestamp: Date.now(),
      source,
    };

    await db.practiceLogs.add(log);
    await queueSync({ table: 'practice_logs', operation: 'insert', payload: log });

    const prevTotal = get().logs.reduce((s, l) => s + l.minutes, 0);
    const newTotal = prevTotal + minutes;
    const prevLevel = computeCurrentLevel(prevTotal);
    const newLevel = computeCurrentLevel(newTotal);

    const meta = await db.appMeta.get('meta');
    const pending = (meta?.pendingJourneyMinutes ?? 0) + minutes;
    await db.appMeta.update('meta', { pendingJourneyMinutes: pending });

    let levelCrossed = get().levelCrossed;
    if (newLevel > prevLevel) {
      const today = todayKey();
      if (meta?.lastLevelUpDate !== today) {
        levelCrossed = newLevel;
      }
    }

    set({
      logs: [...get().logs, log],
      pendingJourneyMinutes: pending,
      levelCrossed,
    });
  },

  setReminder: async (id, time, enabled) => {
    const db = getDb();
    await db.reminders.update(id, { time, enabled });
    const reminders = await db.reminders.toArray();
    set({ reminders });
    const reminder = reminders.find((r) => r.id === id);
    if (reminder) {
      await queueSync({ table: 'reminders', operation: 'insert', payload: reminder });
    }
  },

  setSessionDraft: (draft) => set({ sessionDraft: draft }),
  setPlayerSession: (draft) => set({ playerSession: draft }),

  saveSession: async (name, instanceIds) => {
    const db = getDb();
    const session: SavedSession = {
      id: generateId(),
      name,
      practiceInstanceIds: instanceIds,
      lastUsedAt: Date.now(),
    };
    await db.savedSessions.add(session);
    const savedSessions = await db.savedSessions.orderBy('lastUsedAt').reverse().toArray();
    set({ savedSessions });
    await queueSync({ table: 'saved_sessions', operation: 'insert', payload: session });
  },

  addRecentSession: async (instanceIds) => {
    const db = getDb();
    const key = instanceIds.join(',');
    const meta = await db.appMeta.get('meta');
    const recent = meta?.recentSessionKeys ?? [];
    const filtered = recent.filter((k) => k !== key);
    const updated = [key, ...filtered].slice(0, 3);
    await db.appMeta.update('meta', { recentSessionKeys: updated });
  },

  clearPendingJourney: async () => {
    const db = getDb();
    await db.appMeta.update('meta', { pendingJourneyMinutes: 0 });
    set({ pendingJourneyMinutes: 0 });
  },

  setLevelCrossed: (level) => set({ levelCrossed: level }),

  markLevelUpShown: async () => {
    const db = getDb();
    await db.appMeta.update('meta', { lastLevelUpDate: todayKey() });
    set({ levelCrossed: null });
  },

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 3000);
  },

  clearToast: () => set({ toast: null }),

  markInstanceEducationShown: async () => {
    const db = getDb();
    await db.profile.update('profile', { instanceEducationShown: true });
    set({ profile: { ...get().profile!, instanceEducationShown: true } });
  },

  enterDemoMode: async (stateId) => {
    await enterDemoModeService(stateId);
    set({
      isDemoMode: true,
      sessionDraft: null,
      playerSession: null,
      levelCrossed: null,
      toast: null,
    });
    await get().hydrate();
  },

  exitDemoMode: async () => {
    await exitDemoModeService();
    set({
      isDemoMode: false,
      sessionDraft: null,
      playerSession: null,
      levelCrossed: null,
      toast: null,
    });
    await get().hydrate();
  },
}));

export function getDefaultLogMinutes(practiceId: string): number {
  const practice = getPractice(practiceId);
  return practice?.minutes ?? 10;
}
