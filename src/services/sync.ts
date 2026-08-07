import { getDb, isDemoDatabaseActive } from '@/db';
import type { PracticeInstance, PracticeLog, Profile, Reminder, SavedSession, SyncQueueItem } from '@/types';
import { getDeviceId } from './deviceId';
import { getSupabase, isSupabaseConfigured } from './supabase';

let syncInProgress = false;
let participantId: string | null = null;

export async function ensureParticipant(profile: Profile): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const deviceId = getDeviceId();

  const { data: existing } = await supabase
    .from('participants')
    .select('id')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (existing) {
    participantId = existing.id;
    await supabase
      .from('participants')
      .update({
        name: profile.name,
        is_meditator: profile.isMeditator,
        onboarding_complete: profile.onboardingComplete,
        instance_education_shown: profile.instanceEducationShown,
      })
      .eq('device_id', deviceId);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('participants')
    .insert({
      device_id: deviceId,
      name: profile.name,
      is_meditator: profile.isMeditator,
      onboarding_complete: profile.onboardingComplete,
      instance_education_shown: profile.instanceEducationShown,
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
  const deviceId = getDeviceId();
  const profile = await db.profile.get('profile');
  if (!profile) return false;

  const pid = participantId ?? await ensureParticipant(profile);
  if (!pid) return false;

  switch (item.table) {
    case 'practice_logs': {
      const log = item.payload as PracticeLog;
      const { error } = await supabase.from('practice_logs').upsert({
        id: log.id,
        participant_id: pid,
        device_id: deviceId,
        practice_id: log.practiceId,
        instance_id: log.instanceId,
        minutes: log.minutes,
        logged_at: new Date(log.timestamp).toISOString(),
        source: log.source,
      });
      return !error;
    }
    case 'practice_instances': {
      const inst = item.payload as PracticeInstance;
      if (item.operation === 'delete') {
        const { error } = await supabase.from('practice_instances').delete().eq('id', inst.id);
        return !error;
      }
      const { error } = await supabase.from('practice_instances').upsert({
        id: inst.id,
        participant_id: pid,
        device_id: deviceId,
        practice_id: inst.practiceId,
        instance_number: inst.instanceNumber,
        order_index: inst.order,
        added_at: new Date(inst.addedAt).toISOString(),
      });
      return !error;
    }
    case 'participants': {
      await ensureParticipant(profile);
      return true;
    }
    case 'reminders': {
      const reminder = item.payload as Reminder;
      const { error } = await supabase.from('reminders').upsert({
        id: reminder.id,
        participant_id: pid,
        device_id: deviceId,
        time: reminder.time,
        enabled: reminder.enabled,
      });
      return !error;
    }
    case 'saved_sessions': {
      const session = item.payload as SavedSession;
      const { error } = await supabase.from('saved_sessions').upsert({
        id: session.id,
        participant_id: pid,
        device_id: deviceId,
        name: session.name,
        practice_instance_ids: session.practiceInstanceIds,
        last_used_at: new Date(session.lastUsedAt).toISOString(),
      });
      return !error;
    }
    default:
      return true;
  }
}

export async function drainSyncQueue() {
  if (syncInProgress || !navigator.onLine || !isSupabaseConfigured() || isDemoDatabaseActive()) return;

  const db = getDb();
  syncInProgress = true;
  try {
    const profile = await db.profile.get('profile');
    if (profile?.name) {
      await ensureParticipant(profile);
    }

    const items = await db.syncQueue.orderBy('createdAt').toArray();
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

  const [instances, logs, reminders, sessions] = await Promise.all([
    db.practiceInstances.toArray(),
    db.practiceLogs.toArray(),
    db.reminders.toArray(),
    db.savedSessions.toArray(),
  ]);

  for (const inst of instances) {
    await queueSync({ table: 'practice_instances', operation: 'insert', payload: inst });
  }
  for (const log of logs) {
    await queueSync({ table: 'practice_logs', operation: 'insert', payload: log });
  }
  for (const r of reminders) {
    await queueSync({ table: 'reminders', operation: 'insert', payload: r });
  }
  for (const s of sessions) {
    await queueSync({ table: 'saved_sessions', operation: 'insert', payload: s });
  }

  await drainSyncQueue();
}

export function initSyncListener() {
  window.addEventListener('online', () => drainSyncQueue());
}

export { isSupabaseConfigured };
