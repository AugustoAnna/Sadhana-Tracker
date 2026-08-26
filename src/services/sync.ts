import { APP_ENV } from '@/config/environment';
import { getDb, isDemoDatabaseActive } from '@/db';
import type { PracticeInstance, PracticeLog, Profile, Reminder } from '@/types';
import { ensureAnonymousAuth } from './auth';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { isFeatureEnabled } from '@/features';

export type SyncTable =
  | 'participants'
  | 'participant_practices'
  | 'practice_completed'
  | 'reminders'
  | 'events'
  | 'saved_sessions'
  | 'push_subscriptions';

export interface SyncQueueItem {
  id: string;
  table: SyncTable;
  operation: 'insert' | 'update' | 'delete';
  payload: unknown;
  createdAt: number;
}

let syncInProgress = false;
let participantId: string | null = null;

function logModeFromSource(source: PracticeLog['source']): 'logged' | 'minutes_added' | 'guided' {
  if (source === 'checkbox') return 'logged';
  if (source === 'minutes') return 'minutes_added';
  return 'guided';
}

export async function ensureParticipant(profile: Profile): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const authUserId = await ensureAnonymousAuth();
  if (!authUserId) return null;

  const { data: existing } = await supabase
    .from('participants')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existing) {
    participantId = existing.id;
    // A device whose local database was evicted comes back with a blank profile
    // name. Writing that over the stored copy erases the only human-readable
    // record of whose row this is, so leave it alone until there is a real name.
    if (profile.name) {
      await supabase
        .from('participants')
        .update({ name: profile.name })
        .eq('auth_user_id', authUserId);
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from('participants')
    .insert({
      auth_user_id: authUserId,
      name: profile.name || 'Anonymous',
      environment: APP_ENV,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create participant:', error.message);
    return null;
  }

  participantId = data.id;
  return data.id;
}

function sourceFromLogMode(mode: 'logged' | 'minutes_added' | 'guided'): PracticeLog['source'] {
  if (mode === 'logged') return 'checkbox';
  if (mode === 'minutes_added') return 'minutes';
  return 'player';
}

/**
 * Pull this participant's server-side practice history back into IndexedDB.
 *
 * Storage eviction wipes the local database while the practice history survives
 * in Supabase, and nothing else in the app reads it back — hydrate() is local
 * only and syncFullState() is upload only, so an evicted participant sees an
 * empty app forever.
 *
 * Merges rather than replaces: the server stores the client-generated ids
 * (participant_practices.id IS the local instance id, practice_completed.id IS
 * the local log id), so bulkPut is idempotent and leaves local-only rows alone.
 * Deletions are safe too — removePracticeInstance deletes server-side, so a
 * synced removal cannot come back.
 *
 * Returns the number of rows written, 0 when there was nothing to restore.
 */
export async function restoreFromServer(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase || isDemoDatabaseActive()) return 0;

  const authUserId = await ensureAnonymousAuth();
  if (!authUserId) return 0;

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!participant) return 0;

  const [remoteInstances, remoteLogs] = await Promise.all([
    supabase
      .from('participant_practices')
      .select('id, practice_id, instance, created_at')
      .eq('participant_id', participant.id)
      .order('created_at'),
    supabase
      .from('practice_completed')
      .select('id, practice_id, instance, minutes, mode, was_offline, local_date, occurred_at')
      .eq('participant_id', participant.id),
  ]);
  if (remoteInstances.error || remoteLogs.error) return 0;

  const db = getDb();
  const localInstances = await db.practiceInstances.toArray();
  const known = new Map(localInstances.map((i) => [i.id, i]));
  // Server has no column for display order; keep whatever the device already
  // shows and append anything it has never seen, oldest first.
  let nextOrder = localInstances.reduce((max, i) => Math.max(max, i.order + 1), 0);

  const instances: PracticeInstance[] = (remoteInstances.data ?? []).map((row) => {
    const local = known.get(row.id);
    return {
      id: row.id,
      practiceId: row.practice_id,
      instanceNumber: row.instance as 1 | 2,
      order: local ? local.order : nextOrder++,
      addedAt: local ? local.addedAt : new Date(row.created_at).getTime(),
    };
  });

  const byPractice = new Map<string, string>();
  for (const inst of [...instances, ...localInstances]) {
    const key = `${inst.practiceId}:${inst.instanceNumber}`;
    if (!byPractice.has(key)) byPractice.set(key, inst.id);
  }

  let unattached = 0;
  const logs: PracticeLog[] = [];
  for (const row of remoteLogs.data ?? []) {
    // practice_completed records practice_id + instance, never the instance row
    // id, so the link has to be rebuilt. A practice removed since it was logged
    // has nothing to hang off.
    const instanceId = byPractice.get(`${row.practice_id}:${row.instance}`);
    if (!instanceId) {
      unattached += 1;
      continue;
    }
    logs.push({
      id: row.id,
      practiceId: row.practice_id,
      instanceId,
      minutes: row.minutes,
      timestamp: new Date(row.occurred_at).getTime(),
      localDate: row.local_date,
      source: sourceFromLogMode(row.mode as 'logged' | 'minutes_added' | 'guided'),
      wasOffline: row.was_offline ?? false,
    });
  }

  if (!instances.length && !logs.length) return 0;

  await db.transaction('rw', db.practiceInstances, db.practiceLogs, db.profile, async () => {
    if (instances.length) await db.practiceInstances.bulkPut(instances);
    if (logs.length) await db.practiceLogs.bulkPut(logs);
    const profile = await db.profile.get('profile');
    // A restored participant is past onboarding by definition; without this the
    // landing guard keeps routing them to /welcome on top of their own history.
    if (profile && !profile.name && participant.name) {
      await db.profile.update('profile', { name: participant.name, onboardingComplete: true });
    } else if (profile && logs.length && !profile.onboardingComplete) {
      await db.profile.update('profile', { onboardingComplete: true });
    }
  });

  if (unattached) {
    console.warn(`restoreFromServer: ${unattached} record(s) had no matching practice`);
  }
  return instances.length + logs.length;
}

export async function updateParticipantFields(
  fields: {
    platform?: string;
    installed_standalone?: boolean;
    notification_permission?: string;
    timezone?: string;
    segment?: string;
    name?: string;
  },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const authUserId = await ensureAnonymousAuth();
  if (!authUserId) return;

  // initAppLifecycle calls this before anything has queued a sync, so on a first
  // launch the row does not exist yet and the UPDATE matches zero rows and is
  // silently discarded — losing platform/standalone/permission for everyone who
  // opens the app only once. Make sure the row is there first.
  const profile = await getDb().profile.get('profile');
  if (profile) await ensureParticipant(profile);

  await supabase.from('participants').update({
    platform: fields.platform,
    notification_permission: fields.notification_permission,
    timezone: fields.timezone,
    segment: fields.segment,
    name: fields.name,
    ...(fields.installed_standalone ? { installed_standalone: true } : {}),
  }).eq('auth_user_id', authUserId);
}

export async function queueSync(item: Omit<SyncQueueItem, 'id' | 'createdAt'>) {
  if (isDemoDatabaseActive()) return;

  const db = getDb();
  await db.syncQueue.add({
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  if (navigator.onLine) {
    drainSyncQueue();
  }
}

async function syncItem(item: SyncQueueItem): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const db = getDb();
  const profile = await db.profile.get('profile');
  if (!profile) return false;

  const pid = participantId ?? await ensureParticipant(profile);
  if (!pid) return false;

  switch (item.table) {
    case 'practice_completed': {
      const log = item.payload as PracticeLog & { wasOffline?: boolean };
      const inst = await db.practiceInstances.get(log.instanceId);
      const { error } = await supabase.from('practice_completed').upsert({
        id: log.id,
        participant_id: pid,
        practice_id: log.practiceId,
        instance: inst?.instanceNumber ?? 1,
        minutes: log.minutes,
        mode: logModeFromSource(log.source),
        was_offline: log.wasOffline ?? false,
        local_date: log.localDate,
        occurred_at: new Date(log.timestamp).toISOString(),
        environment: APP_ENV,
      });
      return !error;
    }
    case 'participant_practices': {
      const inst = item.payload as PracticeInstance;
      if (item.operation === 'delete') {
        const { error } = await supabase
          .from('participant_practices')
          .delete()
          .eq('id', inst.id);
        return !error;
      }
      const { error } = await supabase.from('participant_practices').upsert({
        id: inst.id,
        participant_id: pid,
        practice_id: inst.practiceId,
        instance: inst.instanceNumber,
        environment: APP_ENV,
      });
      return !error;
    }
    case 'participants': {
      return (await ensureParticipant(profile)) !== null;
    }
    case 'reminders': {
      const queued = item.payload as Reminder;
      // Reminders created before remoteId existed have local ids ("1",
      // "sadhguru-presence") that the uuid id column rejects — backfill a
      // remoteId so these queue items can ever succeed.
      const reminder = (await db.reminders.get(queued.id)) ?? queued;
      let remoteId = reminder.remoteId;
      if (!remoteId) {
        remoteId = crypto.randomUUID();
        await db.reminders.update(reminder.id, { remoteId });
      }
      const slot = reminder.kind === 'generic' ? reminder.slot : null;
      const { error } = await supabase.from('reminders').upsert({
        id: remoteId,
        participant_id: pid,
        kind: reminder.kind,
        slot,
        practice_id: reminder.practiceId ?? null,
        time_local: reminder.time,
        enabled: reminder.enabled,
        environment: APP_ENV,
      });
      return !error;
    }
    case 'events': {
      const event = item.payload as {
        id: string;
        name: string;
        properties: Record<string, unknown>;
        occurred_at: string;
        local_date: string;
      };
      const { error } = await supabase.from('events').upsert({
        id: event.id,
        participant_id: pid,
        name: event.name,
        properties: event.properties as Record<string, string | number | boolean | null>,
        occurred_at: event.occurred_at,
        local_date: event.local_date,
        environment: APP_ENV,
      });
      return !error;
    }
    case 'saved_sessions': {
      if (!isFeatureEnabled('sessions')) return true;
      return true;
    }
    case 'push_subscriptions': {
      const sub = item.payload as {
        endpoint: string;
        p256dh: string;
        auth: string;
      };
      const { error } = await supabase.from('push_subscriptions').upsert({
        participant_id: pid,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        environment: APP_ENV,
      }, { onConflict: 'participant_id,endpoint' });
      return !error;
    }
    default:
      return true;
  }
}

export async function drainSyncQueue() {
  if (syncInProgress || !navigator.onLine || !isSupabaseConfigured() || isDemoDatabaseActive()) return;

  syncInProgress = true;
  try {
    const db = getDb();
    const profile = await db.profile.get('profile');
    if (profile?.name) {
      await ensureParticipant(profile);
    }

    const items = (await db.syncQueue.orderBy('createdAt').toArray()) as SyncQueueItem[];
    for (const item of items) {
      const ok = await syncItem(item);
      if (ok) {
        await db.syncQueue.delete(item.id);
      }
    }
  } finally {
    syncInProgress = false;
  }
}

export async function syncFullState(): Promise<void> {
  if (!isSupabaseConfigured() || isDemoDatabaseActive()) return;

  const db = getDb();
  const profile = await db.profile.get('profile');
  if (!profile?.name) return;

  await ensureParticipant(profile);

  const [instances, logs, reminders, existingQueue] = await Promise.all([
    db.practiceInstances.toArray(),
    db.practiceLogs.toArray(),
    db.reminders.toArray(),
    db.syncQueue.toArray(),
  ]);

  const queued = new Set(
    existingQueue.map((i) => `${i.table}:${(i.payload as { id?: string }).id}`),
  );

  for (const inst of instances) {
    const key = `participant_practices:${inst.id}`;
    if (!queued.has(key)) {
      await queueSync({ table: 'participant_practices', operation: 'insert', payload: inst });
    }
  }
  for (const log of logs) {
    const key = `practice_completed:${log.id}`;
    if (!queued.has(key)) {
      await queueSync({ table: 'practice_completed', operation: 'insert', payload: log });
    }
  }
  for (const r of reminders) {
    const key = `reminders:${r.id}`;
    if (!queued.has(key)) {
      await queueSync({ table: 'reminders', operation: 'insert', payload: r });
    }
  }

  void drainSyncQueue();

  // Ensure push subscription is synced if permission already granted.
  // iOS WebKit only defines the Notification global for installed
  // (standalone) apps — a bare read throws in the regular browser.
  if ('Notification' in window && Notification.permission === 'granted') {
    const { enablePushNotifications } = await import('./notifications');
    void enablePushNotifications();
  }
}

export function initSyncListener() {
  window.addEventListener('online', () => drainSyncQueue());
}

export async function getParticipantName(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const authUserId = await ensureAnonymousAuth();
  if (!authUserId) return null;
  const { data } = await supabase
    .from('participants')
    .select('name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return data?.name ?? null;
}

export async function fetchBannerTargets(): Promise<Set<string>> {
  const supabase = getSupabase();
  if (!supabase) return new Set();
  const { data } = await supabase
    .from('banner_targets')
    .select('name');
  if (!data) return new Set();
  return new Set(data.map((r) => r.name));
}

export { isSupabaseConfigured };
