import type { PracticeInstance } from '@/types';

/** Instances for the same practice, in add order. */
export function instancesForPractice(
  practiceId: string,
  instances: PracticeInstance[],
): PracticeInstance[] {
  return instances
    .filter((i) => i.practiceId === practiceId)
    .sort((a, b) => a.order - b.order);
}

export function countForPractice(
  practiceId: string,
  instances: PracticeInstance[],
): number {
  return instancesForPractice(practiceId, instances).length;
}

/** Returns 'first' | 'second' only when two instances exist; otherwise null. */
export function getInstanceOrdinalLabel(
  instance: PracticeInstance,
  instances: PracticeInstance[],
): 'first' | 'second' | null {
  const same = instancesForPractice(instance.practiceId, instances);
  if (same.length < 2) return null;
  const index = same.findIndex((i) => i.id === instance.id);
  if (index === 0) return 'first';
  if (index === 1) return 'second';
  return null;
}

export function formatInstanceName(
  practiceName: string,
  instance: PracticeInstance,
  instances: PracticeInstance[],
): string {
  const label = getInstanceOrdinalLabel(instance, instances);
  if (!label) return practiceName;
  return `${practiceName} · ${label}`;
}
