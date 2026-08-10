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
  | 'saved_sessions';

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
    await supabase
      .from('participants')
      .update({ name: profile.name })
      .eq('auth_user_id', authUserId);
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

export async function updateParticipantFields(
  fields: {
    platform?: string;
    installed_standalone?: boolean;
    notification_permission?: string;
    segment?: string;
    name?: string;
  },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const authUserId = await ensureAnonymousAuth();
  if (!authUserId) return;

  await supabase.from('participants').update({
    platform: fields.platform,
    notification_permission: fields.notification_permission,
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
      await ensureParticipant(profile);
      return true;
    }
    case 'reminders': {
      const reminder = item.payload as Reminder;
      const slot = reminder.kind === 'generic' ? reminder.slot : null;
      const { error } = await supabase.from('reminders').upsert({
        id: String(reminder.remoteId ?? reminder.id),
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

  const [instances, logs, reminders] = await Promise.all([
    db.practiceInstances.toArray(),
    db.practiceLogs.toArray(),
    db.reminders.toArray(),
  ]);

  for (const inst of instances) {
    await queueSync({ table: 'participant_practices', operation: 'insert', payload: inst });
  }
  for (const log of logs) {
    await queueSync({ table: 'practice_completed', operation: 'insert', payload: log });
  }
  for (const r of reminders) {
    await queueSync({ table: 'reminders', operation: 'insert', payload: r });
  }

  await drainSyncQueue();
}

export function initSyncListener() {
  window.addEventListener('online', () => drainSyncQueue());
}

export { isSupabaseConfigured };
