import { getPractice } from '@/data/catalogue';
import type { PracticeInstance } from '@/types';
import { formatInstanceName } from '@/utils/instances';
import { PracticeIllustration } from './PracticeIllustration';
import { Checkbox } from './Checkbox';
import { PlusButton } from './PlusButton';
import { PlayButton } from './PlayButton';

interface PracticeCardProps {
  instance: PracticeInstance;
  allInstances: PracticeInstance[];
  completed: boolean;
  completedTwice: boolean;
  timedMinutesToday?: number;
  onCheckbox?: () => void;
  onPlus?: () => void;
  onPlay?: () => void;
  onAdd?: () => void;
  showAdd?: boolean;
}

export function PracticeCard({
  instance,
  allInstances,
  completed,
  completedTwice,
  timedMinutesToday = 0,
  onCheckbox,
  onPlus,
  onPlay,
  onAdd,
  showAdd,
}: PracticeCardProps) {
  const practice = getPractice(instance.practiceId);
  if (!practice) return null;

  const displayName = formatInstanceName(practice.name, instance, allInstances);

  return (
    <div
      className={`flex items-center gap-3 py-3 px-4 ${
        completed && practice.type !== 'timed' ? 'opacity-60' : ''
      }`}
    >
      {showAdd ? (
        <button
          onClick={onAdd}
          className="w-8 h-8 rounded-lg border-2 border-primary text-primary font-bold text-lg flex items-center justify-center flex-shrink-0"
        >
          +
        </button>
      ) : practice.type === 'timed' ? (
        <PlusButton onClick={onPlus!} totalMinutes={timedMinutesToday || undefined} />
      ) : (
        <Checkbox checked={completed} disabled={completed} onChange={onCheckbox!} />
      )}

      <PracticeIllustration />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{displayName}</p>
      </div>

      {practice.type === 'guided' && onPlay && (
        <PlayButton onClick={onPlay} disabled={completedTwice} />
      )}
    </div>
  );
}
