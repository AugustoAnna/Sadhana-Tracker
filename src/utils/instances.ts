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

/** Returns 1 | 2 only when two instances exist; otherwise null. */
export function getInstanceSuffix(
  instance: PracticeInstance,
  instances: PracticeInstance[],
): 1 | 2 | null {
  const same = instancesForPractice(instance.practiceId, instances);
  if (same.length < 2) return null;
  const index = same.findIndex((i) => i.id === instance.id);
  if (index === 0) return 1;
  if (index === 1) return 2;
  return null;
}

export function formatInstanceName(
  practiceName: string,
  instance: PracticeInstance,
  instances: PracticeInstance[],
): string {
  const suffix = getInstanceSuffix(instance, instances);
  if (!suffix) return practiceName;
  const label = suffix === 1 ? '1st' : '2nd';
  return `${practiceName} ${label}`;
}

export function formatPracticeNameWithSuffix(
  practiceName: string,
  instanceNumber: 1 | 2,
  totalForPractice: number,
): string {
  if (totalForPractice < 2) return practiceName;
  return `${practiceName} ${instanceNumber}`;
}
