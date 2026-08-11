import { getInstanceSuffix } from '@/utils/instances';
import type { PracticeInstance } from '@/types';

const ORDINAL_LABEL: Record<1 | 2, string> = { 1: '1st', 2: '2nd' };

export function PracticeName({
  name,
  instance,
  instances,
}: {
  name: string;
  instance?: PracticeInstance;
  instances?: PracticeInstance[];
}) {
  if (!instance || !instances) {
    return <span>{name}</span>;
  }
  const suffix = getInstanceSuffix(instance, instances);
  if (!suffix) return <span>{name}</span>;
  return (
    <span>
      {name}{' '}
      <span className="text-secondary font-normal">{ORDINAL_LABEL[suffix]}</span>
    </span>
  );
}
