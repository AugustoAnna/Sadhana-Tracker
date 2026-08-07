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
      className={`flex items-center gap-3 py-3 px-3 ${
        completed && practice.type !== 'timed' ? 'opacity-55' : ''
      }`}
    >
      {showAdd ? (
        <button
          onClick={onAdd}
          className="w-11 h-11 rounded-[7px] border-2 border-primary text-primary font-bold text-lg flex items-center justify-center flex-shrink-0"
        >
          +
        </button>
      ) : practice.type === 'timed' ? (
        <PlusButton onClick={onPlus!} totalMinutes={timedMinutesToday || undefined} />
      ) : (
        <Checkbox checked={completed} disabled={completed} onChange={onCheckbox!} />
      )}

      <PracticeIllustration practiceId={practice.id} size={44} />

      <div className="flex-1 min-w-0">
        <p className="text-body truncate">{displayName}</p>
        <p className="text-label text-secondary mt-0.5">
          {practice.type === 'timed' ? 'Timed' : practice.type === 'guided' ? 'Guided' : `${practice.minutes} min`}
        </p>
      </div>

      {practice.type === 'guided' && onPlay && (
        <PlayButton onClick={onPlay} disabled={completedTwice} />
      )}
    </div>
  );
}
