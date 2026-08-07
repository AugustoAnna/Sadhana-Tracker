import { useNavigate } from 'react-router-dom';
import { Button, PlantVisual, ProgressBar } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { computeJourneyProgress, getLevelLabel } from '@/data/journey';
import { getTotalMinutes, formatMinutes } from '@/utils/dates';

export function LevelUp() {
  const navigate = useNavigate();
  const levelCrossed = useAppStore((s) => s.levelCrossed);
  const logs = useAppStore((s) => s.logs);
  const markLevelUpShown = useAppStore((s) => s.markLevelUpShown);

  const totalMinutes = getTotalMinutes(logs);
  const journey = computeJourneyProgress(totalMinutes);
  const level = levelCrossed ?? journey.currentLevel;
  const prevLevel = Math.max(0, level - 1);

  const handleContinue = async () => {
    await markLevelUpShown();
    navigate('/practice-home', { replace: true });
  };

  return (
    <div className="h-full bg-card flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow text-journey mb-2">Level unlocked</p>
      <h1 className="font-serif text-display mb-8">
        Level {level}
      </h1>

      <div className="flex items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-page flex items-center justify-center">
          <PlantVisual level={prevLevel} size="lg" />
        </div>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-journey)" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <div className="w-24 h-24 rounded-full bg-page flex items-center justify-center">
          <PlantVisual level={level} size="lg" animating />
        </div>
      </div>

      <p className="font-serif text-headline mb-2">{getLevelLabel(level)}</p>
      <p className="text-label text-secondary mb-6">{formatMinutes(totalMinutes)} minutes tracked</p>

      <ProgressBar progress={journey.progressInLevel} className="w-full max-w-xs mb-10" />

      <Button fullWidth onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}
