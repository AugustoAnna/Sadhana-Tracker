import { create } from 'zustand';
import { isFeatureEnabled } from '@/features';
import { getDb } from '@/db';
import type { PracticeInstance, PracticeLog, Profile, Reminder, ReminderKey, SavedSession, SessionDraft, DrawnToType, DurationPreference } from '@/types';
import { getPractice } from '@/data/catalogue';
import { computeCurrentLevel } from '@/data/journey';
import { generateId, todayKey, formatDateKey } from '@/utils/dates';
import { queueSync, getParticipantName, fetchBannerTargets } from '@/services/sync';
import { enterDemoMode as enterDemoModeService, exitDemoMode as exitDemoModeService, type DemoStateId } from '@/services/demoMode';
import { syncPracticeReminders } from '@/utils/practiceReminders';
import { precachePracticeAudio } from '@/services/audio';
import { scheduleReminders } from '@/services/notifications';
import { getResolvedKind } from '@/data/practiceAssets';

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
  serverName: string | null;
  bannerTargets: Set<string> | null;
  /** Local calendar day the UI is currently rendering. See refreshDay. */
  currentDay: string;

  hydrate: () => Promise<void>;
  refreshDay: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  setMeditatorStatus: (isMeditator: boolean) => Promise<void>;
  setDrawnToType: (type: DrawnToType) => Promise<void>;
  setDurationPreference: (duration: DurationPreference) => Promise<void>;
  markTrackerIntroSeen: () => Promise<void>;
  markNotificationPermissionAsked: () => Promise<void>;
  completeOnboarding: (reminderEnabled?: boolean) => Promise<void>;
  completePotentialOnboarding: () => Promise<void>;
  addPracticeInstance: (practiceId: string) => Promise<PracticeInstance | null>;
  removePracticeInstance: (instanceId: string) => Promise<void>;
  confirmPracticeInstances: (fromFirstSetup: boolean) => Promise<void>;
  logPractice: (instanceId: string, minutes: number, source: 'checkbox' | 'minutes' | 'player') => Promise<void>;
  setReminder: (id: ReminderKey, time: string, enabled: boolean) => Promise<void>;
  ensureSadhguruPresenceReminder: () => Promise<void>;
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
  markFirstRecordReassuranceShown: () => Promise<void>;
  setFeatureDiscoveryStep: (step: number) => Promise<void>;
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
  serverName: null,
  bannerTargets: null,
  currentDay: todayKey(),

  hydrate: async () => {
    const db = getDb();
    const [profile, instances, logs, , savedSessions, meta] = await Promise.all([
      db.profile.get('profile'),
      db.practiceInstances.orderBy('order').toArray(),
      db.practiceLogs.toArray(),
      db.reminders.toArray(),
      db.savedSessions.orderBy('lastUsedAt').reverse().toArray(),
      db.appMeta.get('meta'),
    ]);
    const reminders = await syncPracticeReminders(db);
    let serverName: string | null = null;
    let bannerTargets: Set<string> | null = null;
    try {
      [serverName, bannerTargets] = await Promise.all([
        getParticipantName(),
        fetchBannerTargets(),
      ]);
    } catch {
      // offline or Supabase unreachable — banner simply stays hidden
    }
    set({
      profile: profile ?? null,
      instances,
      logs: logs.map((l) => ({
        ...l,
        localDate: l.localDate ?? formatDateKey(new Date(l.timestamp)),
      })),
      reminders,
      savedSessions,
      pendingJourneyMinutes: meta?.pendingJourneyMinutes ?? 0,
      serverName,
      bannerTargets,
      currentDay: todayKey(),
    });
  },

  refreshDay: async () => {
    const day = todayKey();
    if (day === get().currentDay) return;
    // Midnight passed while the app sat in the background. Nothing else in the
    // tree changes at a day boundary, so without this the screens keep showing
    // yesterday's completed ticks and minutes until some other state moves.
    set({ currentDay: day });
    try {
      // Another context (a browser tab open alongside the installed PWA) may
      // have written logs this copy never saw — the rollover is a cheap place
      // to catch up from IndexedDB.
      const logs = await getDb().practiceLogs.toArray();
      set({
        logs: logs.map((l) => ({
          ...l,
          localDate: l.localDate ?? formatDateKey(new Date(l.timestamp)),
        })),
      });
    } catch (err) {
      console.error('Failed to re-read logs on day change:', err);
    }
  },

  setName: async (name) => {
    const db = getDb();
    await db.profile.update('profile', { name });
    const profile = { ...get().profile!, name };
    set({ profile, serverName: name || null });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  setMeditatorStatus: async (isMeditator) => {
    const db = getDb();
    await db.profile.update('profile', { isMeditator });
    const profile = { ...get().profile!, isMeditator };
    set({ profile });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  setDrawnToType: async (drawnToType) => {
    const db = getDb();
    await db.profile.update('profile', { drawnToType });
    const profile = { ...get().profile!, drawnToType };
    set({ profile });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  setDurationPreference: async (durationPreference) => {
    const db = getDb();
    await db.profile.update('profile', { durationPreference });
    const profile = { ...get().profile!, durationPreference };
    set({ profile });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  markTrackerIntroSeen: async () => {
    const db = getDb();
    await db.profile.update('profile', { trackerIntroSeen: true });
    set({ profile: { ...get().profile!, trackerIntroSeen: true } });
  },

  markNotificationPermissionAsked: async () => {
    const db = getDb();
    await db.profile.update('profile', { notificationPermissionAsked: true });
    set({ profile: { ...get().profile!, notificationPermissionAsked: true } });
  },

  completeOnboarding: async (reminderEnabled = false) => {
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

  completePotentialOnboarding: async () => {
    const db = getDb();
    await db.profile.update('profile', { onboardingComplete: true });
    const profile = await db.profile.get('profile');
    set({ profile: profile! });
    await queueSync({ table: 'participants', operation: 'update', payload: profile });
  },

  addPracticeInstance: async (practiceId) => {
    const db = getDb();
    const kind = getResolvedKind(practiceId);

    // Decide the instance number from the database inside a transaction rather
    // than from the store snapshot. Two taps in quick succession both read the
    // same snapshot, both see no existing instance and both claim number 1;
    // Dexie accepts the duplicate but Postgres has
    // unique(participant_id, practice_id, instance), so the second row is
    // rejected on every sync drain from then on and never reaches the server.
    const instance = await db.transaction('rw', db.practiceInstances, async () => {
      const all = await db.practiceInstances.toArray();
      if (all.length >= 21) return null;

      const existing = all.filter((i) => i.practiceId === practiceId);
      if (kind === 'timed' && existing.length >= 1) return null;
      if (existing.length >= 2) return null;

      const taken = new Set(existing.map((i) => i.instanceNumber));
      const instanceNumber: 1 | 2 = taken.has(1) ? 2 : 1;
      if (taken.has(instanceNumber)) return null;

      const created: PracticeInstance = {
        id: generateId(),
        practiceId,
        instanceNumber,
        order: all.length,
        addedAt: Date.now(),
      };
      await db.practiceInstances.add(created);
      return created;
    });
    if (!instance) return null;

    const updatedInstances = await db.practiceInstances.orderBy('order').toArray();
    const reminders = await syncPracticeReminders(db);
    set({ instances: updatedInstances, reminders });
    await queueSync({ table: 'participant_practices', operation: 'insert', payload: instance });
    if (kind === 'guided') {
      void precachePracticeAudio(practiceId);
    }
    const presenceReminder = reminders.find((r) => r.id === 'sadhguru-presence');
    if (presenceReminder?.enabled) {
      void scheduleReminders();
    }
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
    const reminders = await syncPracticeReminders(db);
    set({ instances: reordered, reminders });
    await queueSync({
      table: 'participant_practices',
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
      localDate: todayKey(),
      source,
      wasOffline: !navigator.onLine,
    };

    await db.practiceLogs.add(log);
    await queueSync({ table: 'practice_completed', operation: 'insert', payload: log });

    const prevTotal = get().logs.reduce((s, l) => s + l.minutes, 0);
    const newTotal = prevTotal + minutes;

    if (isFeatureEnabled('journey')) {
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
    } else {
      set({ logs: [...get().logs, log] });
    }
  },

  setReminder: async (id, time, enabled) => {
    const db = getDb();
    const existing = (await db.reminders.get(id)) ?? {
      id,
      kind: id === 'sadhguru-presence' ? 'practice' as const : 'generic' as const,
      slot: typeof id === 'number' ? id : undefined,
      practiceId: id === 'sadhguru-presence' ? 'sadhguru-presence' : undefined,
      time,
      enabled: false,
    };
    const reminder: Reminder = {
      ...existing,
      time,
      enabled,
      remoteId: existing.remoteId ?? crypto.randomUUID(),
    };
    await db.reminders.put(reminder);
    const reminders = await db.reminders.toArray();
    set({ reminders });
    await queueSync({ table: 'reminders', operation: 'insert', payload: reminder });
  },

  ensureSadhguruPresenceReminder: async () => {
    const db = getDb();
    const existing = await db.reminders.get('sadhguru-presence');
    if (existing) return;
    const reminder: Reminder = {
      id: 'sadhguru-presence',
      kind: 'practice',
      practiceId: 'sadhguru-presence',
      time: '18:15',
      enabled: true,
      remoteId: crypto.randomUUID(),
    };
    await db.reminders.put(reminder);
    const reminders = await db.reminders.toArray();
    set({ reminders });
    await queueSync({ table: 'reminders', operation: 'insert', payload: reminder });
  },

  setSessionDraft: (draft) => set({ sessionDraft: draft }),
  setPlayerSession: (draft) => set({ playerSession: draft }),

  saveSession: async (name, instanceIds) => {
    if (!isFeatureEnabled('sessions')) return;
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
    if (!isFeatureEnabled('sessions')) return;
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

  markFirstRecordReassuranceShown: async () => {
    const db = getDb();
    await db.profile.update('profile', { firstRecordReassuranceShown: true });
    set({ profile: { ...get().profile!, firstRecordReassuranceShown: true } });
  },

  setFeatureDiscoveryStep: async (step) => {
    const db = getDb();
    await db.profile.update('profile', { featureDiscoveryStep: step });
    set({ profile: { ...get().profile!, featureDiscoveryStep: step } });
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
