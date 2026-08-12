import { describe, it, expect } from 'vitest';
import { PRACTICE_REMINDER_CONFIG, getPracticeReminderIds } from './practiceReminders';
import type { PracticeInstance } from '@/types';

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
});
