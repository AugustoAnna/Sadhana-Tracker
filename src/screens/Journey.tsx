import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlantVisual, ProgressBar } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { computeJourneyProgress, getLevelLabel, journeyThreshold, PHASES } from '@/data/journey';
import { getTotalMinutes, formatMinutes } from '@/utils/dates';
import { format } from 'date-fns';

export function Journey() {
  const navigate = useNavigate();
  const logs = useAppStore((s) => s.logs);
  const currentRef = useRef<HTMLDivElement>(null);

  const totalMinutes = getTotalMinutes(logs);
  const journey = computeJourneyProgress(totalMinutes);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const levelReachedDates = new Map<number, { date: string; minutes: number }>();
  let cumulative = 0;
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  for (const log of sortedLogs) {
    const prevLevel = computeJourneyProgress(cumulative).currentLevel;
    cumulative += log.minutes;
    const newLevel = computeJourneyProgress(cumulative).currentLevel;
    if (newLevel > prevLevel) {
      for (let l = prevLevel + 1; l <= newLevel; l++) {
        if (!levelReachedDates.has(l)) {
          levelReachedDates.set(l, {
            date: format(new Date(log.timestamp), 'd MMM yyyy'),
            minutes: cumulative,
          });
        }
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed current level */}
      <div className="bg-card border-b border-hairline px-4 pt-12 pb-4 z-10">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate('/practice-home')} aria-label="Go back" className="w-11 h-11 flex items-center justify-center -ml-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="font-serif text-display">Your journey</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-page flex items-center justify-center">
            <PlantVisual level={journey.currentLevel} size="md" />
          </div>
          <div className="flex-1">
            <p className="eyebrow text-journey">
              Phase 1 · Roots
            </p>
            <p className="font-serif text-title">
              Level {journey.currentLevel} · {getLevelLabel(journey.currentLevel)}
            </p>
            <ProgressBar progress={journey.progressInLevel} className="mt-2" />
            <div className="flex justify-between text-meta text-secondary mt-1">
              <span>{formatMinutes(journey.totalMinutes)} mins</span>
              <span>{formatMinutes(journey.minutesToNext)} mins to next</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable level list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="eyebrow text-journey mb-4">
          Phase 1 · Roots
        </p>

        {Array.from({ length: 16 }, (_, i) => i + 1).map((level) => {
          const reached = journey.currentLevel >= level;
          const isCurrent = journey.currentLevel === level;
          const info = levelReachedDates.get(level);
          const threshold = journeyThreshold(level);

          return (
            <div
              key={level}
              ref={isCurrent ? currentRef : undefined}
              className="flex gap-4 mb-4"
            >
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isCurrent ? 'border-2 border-journey' : 'bg-gray-100'
                }`}>
                  {reached ? (
                    <PlantVisual level={level} size="sm" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#9B9B9B">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 018 0v4" />
                    </svg>
                  )}
                </div>
                {level < 16 && <div className="w-0.5 flex-1 bg-border min-h-4" />}
              </div>
              <div className={`pb-4 ${isCurrent ? 'text-journey' : reached ? 'text-muted' : ''}`}>
                <p className="text-xs text-muted">Level {level}</p>
                <p className={`font-semibold ${isCurrent ? 'text-journey' : ''}`}>
                  {getLevelLabel(level)}
                </p>
                {reached && info ? (
                  <p className="text-xs text-muted">
                    Reached {info.date} · {formatMinutes(info.minutes)} mins
                  </p>
                ) : !reached && (
                  <p className="text-xs text-muted">{formatMinutes(threshold)} mins required</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Later phases */}
        {PHASES.slice(1).map((phase) => (
          <div key={phase.phase} className="flex items-center gap-3 py-4 border-t border-border opacity-50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#9B9B9B">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            <div>
              <p className="font-semibold">Phase {phase.phase} · {phase.name}</p>
              <p className="text-xs text-muted">Unlocks later</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
