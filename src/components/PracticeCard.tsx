import { getPractice } from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import type { PracticeInstance } from '@/types';
import { PracticeIllustration } from './PracticeIllustration';
import { PracticeName } from './PracticeName';

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
  playSessionActive?: boolean;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  return `${minutes} mins`;
}

export function PracticeCard({
  instance,
  allInstances,
  completed,
  completedTwice: _completedTwice,
  timedMinutesToday = 0,
  onCheckbox,
  onPlus,
  onPlay,
  onAdd,
  showAdd,
  playSessionActive = false,
}: PracticeCardProps) {
  const practice = getPractice(instance.practiceId);
  if (!practice) return null;

  const kind = getResolvedKind(practice.id);

  const metadataLine = (() => {
    if (kind === 'timed') {
      if (timedMinutesToday > 0) return `${timedMinutesToday} mins practiced so far`;
      return null;
    }
    return formatDuration(practice.minutes);
  })();

  return (
    <div className="flex items-center gap-3 py-3 px-3">
      {showAdd ? (
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-[7px] bg-primary text-white text-meta font-semibold flex-shrink-0 min-h-11"
        >
          Add
        </button>
      ) : kind === 'timed' ? (
        <button
          onClick={onPlus}
          className="w-11 h-11 flex items-center justify-center flex-shrink-0"
          aria-label="Log minutes"
        >
          <span className="w-[26px] h-[26px] rounded-[7px] border-2 border-primary flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </button>
      ) : completed ? (
        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0" aria-label="Completed">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <button
          onClick={onCheckbox}
          className="w-11 h-11 flex items-center justify-center flex-shrink-0"
          aria-label="Mark complete"
        >
          <span className="w-[26px] h-[26px] rounded-[7px] border-2 border-primary" />
        </button>
      )}

      <PracticeIllustration practiceId={practice.id} size={44} />

      <div className="flex-1 min-w-0">
        <p className="text-body truncate">
          <PracticeName name={practice.name} instance={instance} instances={allInstances} />
        </p>
        {metadataLine && (
          <p className="text-label text-secondary mt-0.5">{metadataLine}</p>
        )}
      </div>

      {(kind === 'guided' || kind === 'timed') && onPlay && (
        <button
          onClick={onPlay}
          disabled={playSessionActive}
          className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 disabled:opacity-30"
          aria-label="Play"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-primary)">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </div>
  );
}
