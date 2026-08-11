import type { PracticeInstance, Reminder, ReminderKey } from '@/types';
import type { SadhanaDB } from '@/db';

export interface PracticeReminderConfig {
  time: string;
  lockedTime: boolean;
  defaultEnabled: boolean;
}

/** Only Sadhguru's Presence — Guru Pooja pending PM confirmation. */
export const PRACTICE_REMINDER_CONFIG: Record<string, PracticeReminderConfig> = {
  'sadhguru-presence': { time: '18:20', lockedTime: true, defaultEnabled: true },
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
    } else if (config.lockedTime && existing.time !== config.time) {
      await database.reminders.update(practiceId, { time: config.time });
    }
  }

  return database.reminders.toArray();
}
