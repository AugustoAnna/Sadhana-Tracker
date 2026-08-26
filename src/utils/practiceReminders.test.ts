import { describe, it, expect, vi, beforeEach } from 'vitest';

const queueSync = vi.fn();

vi.mock('@/services/sync', () => ({
  queueSync: (...args: unknown[]) => queueSync(...args),
}));

import {
  PRACTICE_REMINDER_CONFIG,
  getPracticeReminderIds,
  syncPracticeReminders,
} from './practiceReminders';
import type { PracticeInstance, Reminder } from '@/types';
import type { SadhanaDB } from '@/db';

const presenceInstance: PracticeInstance = {
  id: 'inst-1',
  practiceId: 'sadhguru-presence',
  instanceNumber: 1,
  order: 0,
  addedAt: 0,
};

function createFakeDb(instances: PracticeInstance[], seeded: Reminder[] = []) {
  const store = new Map<Reminder['id'], Reminder>(seeded.map((r) => [r.id, r]));
  return {
    practiceInstances: { toArray: async () => instances },
    reminders: {
      get: async (id: Reminder['id']) => store.get(id),
      put: async (r: Reminder) => { store.set(r.id, r); },
      update: async (id: Reminder['id'], changes: Partial<Reminder>) => {
        const existing = store.get(id);
        if (existing) store.set(id, { ...existing, ...changes });
      },
      delete: async (id: Reminder['id']) => { store.delete(id); },
      toArray: async () => [...store.values()],
    },
  } as unknown as SadhanaDB;
}

describe('practiceReminders', () => {
  it('only defines Sadhguru\'s Presence as a practice reminder', () => {
    expect(Object.keys(PRACTICE_REMINDER_CONFIG)).toEqual(['sadhguru-presence']);
    expect(PRACTICE_REMINDER_CONFIG['guru-pooja']).toBeUndefined();
  });

  it('includes sadhguru-presence when that practice is in the list', () => {
    const instances: PracticeInstance[] = [{
      id: 'inst-1',
      practiceId: 'sadhguru-presence',
      instanceNumber: 1,
      order: 0,
      addedAt: 0,
    }];
    expect(getPracticeReminderIds(instances)).toEqual(['sadhguru-presence']);
  });

  it('does not include guru-pooja even when that practice is in the list', () => {
    const instances: PracticeInstance[] = [{
      id: 'inst-1',
      practiceId: 'guru-pooja',
      instanceNumber: 1,
      order: 0,
      addedAt: 0,
    }];
    expect(getPracticeReminderIds(instances)).toEqual([]);
  });

  describe('syncPracticeReminders', () => {
    beforeEach(() => {
      queueSync.mockClear();
    });

    it('queues a sync when it creates the presence reminder', async () => {
      const db = createFakeDb([presenceInstance]);

      await syncPracticeReminders(db);

      expect(queueSync).toHaveBeenCalledTimes(1);
      expect(queueSync).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'reminders',
          payload: expect.objectContaining({
            id: 'sadhguru-presence',
            kind: 'practice',
            practiceId: 'sadhguru-presence',
          }),
        }),
      );
    });

    it('does not re-queue a reminder that already matches the locked time', async () => {
      const existing: Reminder = {
        id: 'sadhguru-presence',
        kind: 'practice',
        practiceId: 'sadhguru-presence',
        time: PRACTICE_REMINDER_CONFIG['sadhguru-presence']!.time,
        enabled: true,
        remoteId: 'remote-1',
      };
      const db = createFakeDb([presenceInstance], [existing]);

      await syncPracticeReminders(db);

      expect(queueSync).not.toHaveBeenCalled();
    });
  });
});
