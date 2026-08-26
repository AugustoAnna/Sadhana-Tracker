import type { PracticeInstance, Reminder, ReminderKey } from '@/types';
import type { SadhanaDB } from '@/db';
import { queueSync } from '@/services/sync';

export interface PracticeReminderConfig {
  time: string;
  lockedTime: boolean;
  defaultEnabled: boolean;
}

/** Practice-specific reminders — only Sadhguru's Presence. */
export const PRACTICE_REMINDER_CONFIG: Record<string, PracticeReminderConfig> = {
  'sadhguru-presence': { time: '18:15', lockedTime: true, defaultEnabled: true },
};

export function getPracticeReminderIds(instances: PracticeInstance[]): string[] {
  const ids = new Set(instances.map((i) => i.practiceId));
  return Object.keys(PRACTICE_REMINDER_CONFIG).filter((id) => ids.has(id));
}

/** Ensure practice-specific reminders exist when practice is added; remove when practice removed. */
export async function syncPracticeReminders(database: SadhanaDB): Promise<Reminder[]> {
  const instances = await database.practiceInstances.toArray();
  const activeIds = new Set(getPracticeReminderIds(instances));

  for (const practiceId of Object.keys(PRACTICE_REMINDER_CONFIG)) {
    if (!activeIds.has(practiceId)) {
      await database.reminders.delete(practiceId);
    }
  }

  for (const practiceId of activeIds) {
    const config = PRACTICE_REMINDER_CONFIG[practiceId]!;
    const existing = await database.reminders.get(practiceId);
    if (!existing) {
      const reminder: Reminder = {
        id: practiceId as ReminderKey,
        kind: 'practice',
        practiceId,
        time: config.time,
        enabled: config.defaultEnabled,
        remoteId: crypto.randomUUID(),
      };
      await database.reminders.put(reminder);
      // Dexie alone is not enough: send-reminders reads the `reminders` table,
      // so a reminder that is never queued here simply does not exist for the
      // server and no push is ever sent for it.
      await queueSync({ table: 'reminders', operation: 'insert', payload: reminder });
    } else if (config.lockedTime && existing.time !== config.time) {
      const updated = { ...existing, time: config.time };
      await database.reminders.update(practiceId, { time: config.time });
      await queueSync({ table: 'reminders', operation: 'insert', payload: updated });
    }
  }

  return database.reminders.toArray();
}
