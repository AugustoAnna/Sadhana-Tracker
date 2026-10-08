import { APP_ENV } from '@/config/environment';
import { getDb, isDemoDatabaseActive } from '@/db';
import { formatDateKey } from '@/utils/dates';
import type { BacktrackEvent } from '@/features/backtracking/analyticsNames';
import { queueSync } from './sync';

export type InstrumentEvent =
  | 'app_open'
  | 'setup_completed'
  | 'onboarding_completed'
  | 'practices_changed'
  | 'practice_started'
  | 'practice_quit'
  | 'reminder_set'
  | 'reminder_disabled'
  | 'reminder_delivered'
  | 'reminder_tapped'
  | 'sync_failed'
  | 'name_changed'
  | 'sign_in_code_sent'
  | 'sign_in_completed'
  | 'sign_out'
  | 'passkey_registered'
  | 'passkey_removed'
  | 'theme_changed'
  | BacktrackEvent;

interface TrackPayload {
  [key: string]: unknown;
}

export async function track(name: InstrumentEvent, properties: TrackPayload = {}): Promise<void> {
  if (APP_ENV !== 'study' || isDemoDatabaseActive()) return;

  const event = {
    id: crypto.randomUUID(),
    name,
    properties,
    occurred_at: new Date().toISOString(),
    local_date: formatDateKey(new Date()),
  };

  await queueSync({ table: 'events', operation: 'insert', payload: event });
}

export async function trackFromServiceWorker(
  name: 'reminder_delivered' | 'reminder_tapped',
  properties: TrackPayload,
): Promise<void> {
  if (APP_ENV !== 'study') return;

  const event = {
    id: crypto.randomUUID(),
    name,
    properties,
    occurred_at: new Date().toISOString(),
    local_date: formatDateKey(new Date()),
  };

  const db = getDb();
  await db.syncQueue.add({
    id: event.id,
    table: 'events',
    operation: 'insert',
    payload: event,
    createdAt: Date.now(),
  });
}
