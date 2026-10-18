import { APP_ENV } from '@/config/environment';
import { getDb, isDemoDatabaseActive } from '@/db';
import type { PracticeInstance, PracticeLog, Profile, Reminder } from '@/types';
import type { Database } from '@/types/database';
import { getAuthUser, getAuthUserId } from './auth';
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
let drainRequestedAgain = false;
let participantId: string | null = null;

/**
 * Forget the cached participant row. Must run whenever the signed-in account
 * changes, otherwise the next account's rows are written under the previous
 * participant_id and RLS rejects every one of them.
 */
export function resetParticipantCache() {
  participantId = null;
}

function logModeFromSource(source: PracticeLog['source']): 'logged' | 'minutes_added' | 'guided' {
  if (source === 'checkbox') return 'logged';
  if (source === 'minutes') return 'minutes_added';
  return 'guided';
}

// Profiles that finished setup before the timestamp existed have the flag but
// no time; "now" is the best this device can offer, and the set-if-null write
// means the migration backfill wins where it has a better answer.
function onboardingCompletedAt(profile: Profile): string {
  return profile.onboardingCompletedAt ?? new Date().toISOString();
}

export type EnsureParticipantResult = {
  id: string | null;
  /** True only when this call inserted a brand-new participants row. */
  created: boolean;
};

export async function ensureParticipant(profile: Profile): Promise<string | null> {
  return (await ensureParticipantDetailed(profile)).id;
}

/**
 * Find or create the participants row for the current Auth user.
 * Known-account detection is email-first: if a row with this email already
 * exists, this is a returning user (skip Add Practices). Otherwise create.
 */
export async function ensureParticipantDetailed(profile: Profile): Promise<EnsureParticipantResult> {
  const supabase = getSupabase();
  if (!supabase) return { id: null, created: false };

  const authUser = await getAuthUser();
  if (!authUser) return { id: null, created: false };
  const authUserId = authUser.id;
  const email = authUser.email?.trim().toLowerCase() || null;

  // 1) Email match is the product rule for "already registered".
  let existing: { id: string; auth_user_id?: string | null; email?: string | null } | null = null;
  if (email) {
    const byEmail = await supabase
      .from('participants')
      .select('id, auth_user_id, email')
      .ilike('email', email)
      .maybeSingle();
    if (byEmail.error) {
      console.error('Failed to look up participant by email:', byEmail.error.message);
    } else {
      existing = byEmail.data;
    }
  }

  // 2) Fall back to auth_user_id for older rows that never got email filled in.
  if (!existing) {
    const byAuth = await supabase
      .from('participants')
      .select('id, auth_user_id, email')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (byAuth.error) {
      console.error('Failed to look up participant by auth user:', byAuth.error.message);
    } else {
      existing = byAuth.data;
    }
  }

  if (existing) {
    participantId = existing.id;
    const patch: { name?: string; email?: string; auth_user_id?: string } = {};
    if (profile.name) patch.name = profile.name;
    if (email && existing.email?.toLowerCase() !== email) patch.email = email;
    // Re-bind the row to this Auth user when email matched an older row.
    if (existing.auth_user_id !== authUserId) patch.auth_user_id = authUserId;
    if (Object.keys(patch).length) {
      const { error: patchError } = await supabase
        .from('participants')
        .update(patch)
        .eq('id', existing.id);
      if (patchError) console.error('Failed to update participant:', patchError.message);
    }
    // Best-effort: production may not have onboarding_completed_at yet.
    if (profile.onboardingComplete) {
      const { error: onboardError } = await supabase
        .from('participants')
        .update({ onboarding_completed_at: onboardingCompletedAt(profile) })
        .eq('id', existing.id)
        .is('onboarding_completed_at', null);
      if (onboardError && !/onboarding_completed_at/i.test(onboardError.message)) {
        console.error('Failed to stamp onboarding_completed_at:', onboardError.message);
      }
    }
    return { id: existing.id, created: false };
  }

  const baseRow = {
    auth_user_id: authUserId,
    email,
    name: profile.name || 'Anonymous',
    environment: APP_ENV,
  };

  // Try with onboarding timestamp first; fall back if the column is absent.
  let insert = await supabase
    .from('participants')
    .insert({
      ...baseRow,
      onboarding_completed_at: profile.onboardingComplete ? onboardingCompletedAt(profile) : null,
    })
    .select('id')
    .single();

  if (insert.error && /onboarding_completed_at/i.test(insert.error.message)) {
    insert = await supabase
      .from('participants')
      .insert(baseRow)
      .select('id')
      .single();
  }

  if (insert.error) {
    // Unique race on email or auth_user_id: treat as known existing row.
    if (email) {
      const { data: racedEmail } = await supabase
        .from('participants')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      if (racedEmail) {
        participantId = racedEmail.id;
        return { id: racedEmail.id, created: false };
      }
    }
    const { data: racedAuth } = await supabase
      .from('participants')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (racedAuth) {
      participantId = racedAuth.id;
      return { id: racedAuth.id, created: false };
    }
    console.error('Failed to create participant:', insert.error.message);
    return { id: null, created: false };
  }

  participantId = insert.data.id;
  return { id: insert.data.id, created: true };
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
 * Also restores the onboarding flag from the participant row, which counts as
 * a written row so callers re-hydrate the store.
 *
 * Returns the number of rows written, 0 when there was nothing to restore, and
 * the ids the server already holds so syncFullState can skip them.
 */
export type RestoreFromServerResult = {
  /** Rows written into local storage (practices/logs/profile fields). */
  rowsWritten: number;
  /** True when a participants row already existed for this Auth user. */
  participantFound: boolean;
  /** Ids already on the server (empty for an account with no row yet); absent when they could not be read. */
  onServer?: OnServerIds;
};

const NOTHING_ON_SERVER = (): OnServerIds => ({ instanceIds: new Set(), logIds: new Set() });

export type OnServerIds = {
  instanceIds: Set<string>;
  logIds: Set<string>;
};

// PostgREST returns at most max_rows (1000) per request, so a long history has
// to be read a page at a time or the oldest logs silently go missing.
const SERVER_PAGE_ROWS = 1000;

type RemoteLogRow = Pick<
  Database['public']['Tables']['practice_completed']['Row'],
  'id' | 'practice_id' | 'instance' | 'minutes' | 'mode' | 'was_offline' | 'local_date' | 'occurred_at' | 'backtrack' | 'route'
>;

async function fetchRemoteLogs(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  participantId: string,
): Promise<{ data: RemoteLogRow[]; error: null } | { data: null; error: unknown }> {
  const rows: RemoteLogRow[] = [];
  for (let from = 0; ; from += SERVER_PAGE_ROWS) {
    const page = await supabase
      .from('practice_completed')
      .select('id, practice_id, instance, minutes, mode, was_offline, local_date, occurred_at, backtrack, route')
      .eq('participant_id', participantId)
      .order('id')
      .range(from, from + SERVER_PAGE_ROWS - 1);
    if (page.error) return { data: null, error: page.error };
    rows.push(...(page.data ?? []));
    if ((page.data ?? []).length < SERVER_PAGE_ROWS) return { data: rows, error: null };
  }
}

export async function restoreFromServer(
  authUserIdOverride?: string | null,
): Promise<RestoreFromServerResult> {
  const supabase = getSupabase();
  if (!supabase || isDemoDatabaseActive()) {
    return { rowsWritten: 0, participantFound: false };
  }

  // Prefer the just-verified session id. getAuthUserId() can briefly lag right
  // after OTP/passkey verification and would make a returning user look brand new.
  const authUserId = authUserIdOverride || await getAuthUserId();
  if (!authUserId) return { rowsWritten: 0, participantFound: false };

  // Do not select onboarding_completed_at: some environments never got that
  // migration, and a missing column makes every returning user look brand new.
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (participantError) {
    console.error('Failed to look up participant:', participantError.message);
    return { rowsWritten: 0, participantFound: false };
  }
  // No row for this user: the server definitely holds none of this device's rows.
  if (!participant) return { rowsWritten: 0, participantFound: false, onServer: NOTHING_ON_SERVER() };

  const db = getDb();

  // A participants row means this Auth user is known. Mark setup complete so
  // landing does not reopen Add Practices on every sign-in.
  let profileRestored = 0;
  const profile = await db.profile.get('profile');
  if (profile) {
    const profileUpdate = {
      ...(!profile.name && participant.name ? { name: participant.name } : {}),
      ...(!profile.onboardingComplete
        ? { onboardingComplete: true }
        : {}),
    };
    if (Object.keys(profileUpdate).length) {
      await db.profile.update('profile', profileUpdate);
      profileRestored = 1;
    }
  }

  const [remoteInstances, remoteLogs] = await Promise.all([
    supabase
      .from('participant_practices')
      .select('id, practice_id, instance, created_at')
      .eq('participant_id', participant.id)
      .order('created_at'),
    fetchRemoteLogs(supabase, participant.id),
  ]);
  if (remoteInstances.error || remoteLogs.error) {
    return { rowsWritten: profileRestored, participantFound: true };
  }

  const localInstances = [...await db.practiceInstances.toArray()].sort((a, b) => a.order - b.order);
  const remoteRows = remoteInstances.data ?? [];
  const remoteIds = new Set(remoteRows.map((row) => row.id));
  const slotOf = (practiceId: string, instanceNumber: number) => `${practiceId}:${instanceNumber}`;

  // A device can hold a practice slot (practice + 1st/2nd) under a different id
  // than the server: an account merge keeps the other account's rows, and a
  // reinstall can set practices up again before this restore runs. Matching by
  // id alone kept both copies, so the tracker listed the practice four times
  // and the local copy never synced (unique(participant, practice, instance)).
  // One row per slot: the server's, else the device's first.
  const localBySlot = new Map<string, PracticeInstance>();
  for (const inst of localInstances) {
    const slot = slotOf(inst.practiceId, inst.instanceNumber);
    const held = localBySlot.get(slot);
    if (!held || (!remoteIds.has(held.id) && remoteIds.has(inst.id))) localBySlot.set(slot, inst);
  }

  // Server has no column for display order; keep whatever the device already
  // shows and append anything it has never seen, oldest first.
  let nextOrder = localInstances.reduce((max, i) => Math.max(max, i.order + 1), 0);

  const instances: PracticeInstance[] = remoteRows.map((row) => {
    const local = localBySlot.get(slotOf(row.practice_id, row.instance));
    return {
      id: row.id,
      practiceId: row.practice_id,
      instanceNumber: row.instance as 1 | 2,
      order: local ? local.order : nextOrder++,
      addedAt: local ? local.addedAt : new Date(row.created_at).getTime(),
    };
  });

  const byPractice = new Map<string, string>();
  for (const inst of [...instances, ...localBySlot.values()]) {
    const key = slotOf(inst.practiceId, inst.instanceNumber);
    if (!byPractice.has(key)) byPractice.set(key, inst.id);
  }

  // Local duplicates, each mapped to the row that now stands for its slot.
  const replacedBy = new Map<string, string>();
  for (const inst of localInstances) {
    const kept = byPractice.get(slotOf(inst.practiceId, inst.instanceNumber))!;
    if (kept !== inst.id) replacedBy.set(inst.id, kept);
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
      // Carried back so a re-upload from this device keeps the marker.
      ...(row.backtrack && { backtrack: true, route: row.route ?? 'switcher' }),
    });
  }

  // A participants row means this is a known account. Skip first-time setup
  // even when they currently have zero practices on the server.
  const tables = [db.practiceInstances, db.practiceLogs, db.profile, db.savedSessions, db.syncQueue];
  await db.transaction('rw', tables, async () => {
    if (instances.length) await db.practiceInstances.bulkPut(instances);
    if (logs.length) await db.practiceLogs.bulkPut(logs);
    if (replacedBy.size) await mergeDuplicateInstances(replacedBy);
    const profile = await db.profile.get('profile');
    if (profile && !profile.onboardingComplete) {
      await db.profile.update('profile', {
        onboardingComplete: true,
        ...(!profile.name && participant.name ? { name: participant.name } : {}),
      });
      profileRestored = 1;
    } else if (profile && !profile.name && participant.name) {
      await db.profile.update('profile', { name: participant.name });
      profileRestored = 1;
    }
  });

  if (unattached) {
    console.warn(`restoreFromServer: ${unattached} record(s) had no matching practice`);
  }
  return {
    rowsWritten: instances.length + logs.length + replacedBy.size + profileRestored,
    participantFound: true,
    onServer: {
      instanceIds: remoteIds,
      logIds: new Set((remoteLogs.data ?? []).map((row) => row.id)),
    },
  };
}

/**
 * Folds duplicate practice instances into the row kept for their slot: logs,
 * saved sessions and queued log uploads move over, the duplicate goes, and its
 * queued insert is dropped (the server would reject it on every drain).
 */
async function mergeDuplicateInstances(replacedBy: Map<string, string>): Promise<void> {
  const db = getDb();
  const replaced = [...replacedBy.keys()];

  await db.practiceLogs.where('instanceId').anyOf(replaced).modify((log) => {
    log.instanceId = replacedBy.get(log.instanceId)!;
  });
  await db.savedSessions.toCollection().modify((session) => {
    if (!session.practiceInstanceIds.some((id) => replacedBy.has(id))) return;
    session.practiceInstanceIds = [...new Set(
      session.practiceInstanceIds.map((id) => replacedBy.get(id) ?? id),
    )];
  });
  for (const item of await db.syncQueue.toArray()) {
    const payload = item.payload as { id?: string; instanceId?: string };
    if (item.table === 'participant_practices' && payload.id && replacedBy.has(payload.id)) {
      await db.syncQueue.delete(item.id);
    } else if (item.table === 'practice_completed' && payload.instanceId && replacedBy.has(payload.instanceId)) {
      await db.syncQueue.update(item.id, {
        payload: { ...payload, instanceId: replacedBy.get(payload.instanceId) },
      });
    }
  }
  await db.practiceInstances.bulkDelete(replaced);
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
  const authUserId = await getAuthUserId();
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
      // Logs are never edited, only added or removed: a row already there
      // (sent before, or by the other app on this account) is left as it is,
      // so a re-send can't relabel its environment.
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
        // Needs migration 009; rows logged before it have no backtrack field.
        backtrack: log.backtrack ?? false,
        route: log.backtrack ? (log.route ?? 'switcher') : null,
      }, { ignoreDuplicates: true });
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
      }, { ignoreDuplicates: true });
      return !error;
    }
    case 'participants': {
      return (await ensureParticipant(profile)) !== null;
    }
    case 'reminders': {
      const queued = item.payload as Reminder;
      const reminder = (await db.reminders.get(queued.id)) ?? queued;
      const slot = reminder.kind === 'generic' ? reminder.slot : null;
      // Keyed on the slot, not a per-install id: a reinstall starts with an
      // empty local database, and an id-keyed upsert added a second copy of
      // every reminder that send-reminders then pushed as well. The row id is
      // left to the column default and kept on conflict.
      const { error } = await supabase.from('reminders').upsert({
        participant_id: pid,
        kind: reminder.kind,
        slot,
        practice_id: reminder.practiceId ?? null,
        time_local: reminder.time,
        enabled: reminder.enabled,
        environment: APP_ENV,
      }, { onConflict: 'participant_id,environment,kind,slot,practice_id' });
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
  if (!navigator.onLine || !isSupabaseConfigured() || isDemoDatabaseActive()) return;

  if (syncInProgress) {
    // The running pass already took its snapshot of the queue, so whatever was
    // just added would sit there until something else happened to trigger a
    // drain — in practice the next launch. Ask it to go round again instead of
    // dropping the request on the floor.
    drainRequestedAgain = true;
    return;
  }

  syncInProgress = true;
  try {
    const db = getDb();
    do {
      drainRequestedAgain = false;

      const profile = await db.profile.get('profile');
      if (profile) {
        await ensureParticipant(profile);
      }

      const items = (await db.syncQueue.orderBy('createdAt').toArray()) as SyncQueueItem[];
      for (const item of items) {
        const ok = await syncItem(item);
        if (ok) {
          await db.syncQueue.delete(item.id);
        }
      }
    } while (drainRequestedAgain);
  } finally {
    syncInProgress = false;
    drainRequestedAgain = false;
  }
}

/**
 * Queues every local row the server does not have yet.
 *
 * Pass the ids restoreFromServer just read: since sign-in, a device holds the
 * account's whole history, and re-sending all of it on every launch put each
 * new tick behind hundreds of uploads (days late on short sessions).
 *
 * 'unread' means restore could not read them (offline, error): practices and
 * logs are not re-sent this launch, since every new row queues itself when it
 * is made, and the next launch that reaches the server catches anything
 * missing. Queuing everything instead left hundreds of redundant uploads in
 * front of new ticks once the connection came back.
 *
 * Omitted, everything local is sent: link-mode sign-in keeps a history the
 * server has never seen. The inserts ignore rows already there.
 */
export async function syncFullState(onServer?: OnServerIds | 'unread'): Promise<void> {
  if (!isSupabaseConfigured() || isDemoDatabaseActive()) return;

  const db = getDb();
  const profile = await db.profile.get('profile');
  if (!profile) return;

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

  const resend = onServer !== 'unread';
  const known = onServer === 'unread' ? undefined : onServer;

  for (const inst of resend ? instances : []) {
    const key = `participant_practices:${inst.id}`;
    if (!queued.has(key) && !known?.instanceIds.has(inst.id)) {
      await queueSync({ table: 'participant_practices', operation: 'insert', payload: inst });
    }
  }
  for (const log of resend ? logs : []) {
    const key = `practice_completed:${log.id}`;
    if (!queued.has(key) && !known?.logIds.has(log.id)) {
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
  const authUserId = await getAuthUserId();
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
