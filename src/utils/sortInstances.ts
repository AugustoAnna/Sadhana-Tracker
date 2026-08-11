import type { PracticeInstance } from '@/types';
import { getSortOrder } from '@/data/idealSequence';

/** Tracking screen order — ideal sequence, adjacent instances. */
export function sortTrackingInstances(instances: PracticeInstance[]): PracticeInstance[] {
  return [...instances].sort((a, b) => {
    const orderDiff = getSortOrder(a.practiceId) - getSortOrder(b.practiceId);
    if (orderDiff !== 0) return orderDiff;
    return a.instanceNumber - b.instanceNumber;
  });
}

/** My practices screen — alphabetical by practice name. */
export function sortAlphabetically(instances: PracticeInstance[], getName: (id: string) => string): PracticeInstance[] {
  return [...instances].sort((a, b) => getName(a.practiceId).localeCompare(getName(b.practiceId)));
}
