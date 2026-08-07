import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackHeader, StickyAction, PracticeCard, PlantVisual, ProgressBar,
  BottomSheet, MinutePicker, Button, Toast, DemoModePicker, useDemoModeEntry,
  PracticeIllustration, HeatMap,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { computeJourneyProgress, getLevelLabel } from '@/data/journey';
import { START_HERE_MEDITATOR, START_HERE_POTENTIAL } from '@/data/constants';
import { YOUR_NEXT_PRACTICE_IDS, getPractice } from '@/data/catalogue';
import {
  getTotalMinutes, getTotalDaysPracticed, getCurrentStreak,
  getPracticesCompletedToday, getMinutesForDay, todayKey,
  isInstanceCompletedToday, isInstanceCompletedTwiceToday, getTimedMinutesToday,
  formatMinutes,
} from '@/utils/dates';
import { getHeatMapWeeks } from '@/utils/stats';
import { useInViewport, useJourneyAnimation, useHaptic } from '@/hooks';

export function PracticeHome() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const logPractice = useAppStore((s) => s.logPractice);
  const addPracticeInstance = useAppStore((s) => s.addPracticeInstance);
  const toast = useAppStore((s) => s.toast);
  const haptic = useHaptic();

  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const demoEntryHandlers = useDemoModeEntry(() => setDemoPickerOpen(true));

  const [minuteSheet, setMinuteSheet] = useState<string | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(5);
  const { animating, triggerAnimation } = useJourneyAnimation();

  const totalMinutes = getTotalMinutes(logs);
  const journey = computeJourneyProgress(totalMinutes);
  const hasPractices = instances.length > 0;
  const hasLogs = logs.length > 0;
  const isMeditator = profile?.isMeditator ?? false;

  const { ref: journeyRef } = useInViewport<HTMLDivElement>(() => triggerAnimation());

  const handleBack = () => {
    if (hasPractices) navigate('/app-home');
  };

  const handleLog = async (instanceId: string) => {
    const instance = instances.find((i) => i.id === instanceId);
    if (!instance) return;
    haptic();
    await logPractice(instanceId, getDefaultLogMinutes(instance.practiceId), 'manual');
  };

  const handleAddFromRecent = async (practiceId: string) => {
    await addPracticeInstance(practiceId);
  };

  const settingsAction = (
    <button onClick={() => navigate('/settings')} aria-label="Settings" className="w-11 h-11 flex items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    </button>
  );

  // Empty state
  if (!hasPractices && !hasLogs) {
    const startHere = isMeditator ? START_HERE_MEDITATOR : START_HERE_POTENTIAL;
    return (
      <div className="h-full overflow-y-auto pb-8 bg-page">
        <BackHeader dark title="My practices" onBack={handleBack} rightAction={settingsAction} />
        <div className="px-4 pt-6">
          {!isMeditator && (
            <div className="flex justify-center mb-6">
              <div className="w-28 h-28 rounded-full bg-card flex items-center justify-center">
                <PlantVisual level={0} size="lg" />
              </div>
            </div>
          )}
          <h2 className="font-serif text-headline text-center mb-3 px-2">
            Your journey of transformation awaits
          </h2>
          <p className="text-label text-secondary text-center mb-8 px-4">
            Add the practices you are currently doing to begin tracking.
          </p>
          <button
            onClick={() => navigate('/practices/edit', { state: { firstSetup: true } })}
            className="w-full py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold mb-[26px]"
          >
            Add practices
          </button>

          <div className="bg-card rounded-[14px] p-4 mb-4">
            <p className="eyebrow mb-3">Start here</p>
            <div className="divide-y divide-hairline">
              {startHere.map((id) => {
                const p = getPractice(id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-3 py-3">
                    <PracticeIllustration practiceId={id} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body truncate">{p.name}</p>
                      <p className="text-label text-secondary">{p.minutes} min</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => navigate('/practices/edit', { state: { firstSetup: true } })}
            className="w-full p-4 rounded-[14px] bg-card text-left"
          >
            <p className="eyebrow mb-1">Every Sunday</p>
            <p className="text-title">Explore all practices</p>
            <p className="text-label text-secondary mt-1">Browse the full catalogue</p>
          </button>
        </div>
      </div>
    );
  }

  // Practiced but nothing added
  if (!hasPractices && hasLogs) {
    const recentPracticeIds = [...new Set(logs.map((l) => l.practiceId))].slice(0, 3);
    return (
      <div className="h-full overflow-y-auto pb-8 bg-page">
        <BackHeader dark title="My practices" onBack={handleBack} rightAction={settingsAction} />
        <div className="px-4 pt-4">
          <JourneyRow ref={journeyRef} journey={journey} animating={animating} />
          <h2 className="font-serif text-headline mt-[26px] mb-2">Keep going</h2>
          <p className="text-label text-secondary mb-6">
            Add practices you have already done so they appear on your tracker.
          </p>
          <div className="bg-card rounded-[14px] px-3">
            <p className="eyebrow px-1 pt-4 mb-1">Recently practiced</p>
            {recentPracticeIds.map((id) => {
              const p = getPractice(id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-3 py-3 border-b border-hairline last:border-0">
                  <PracticeIllustration practiceId={id} size={44} />
                  <span className="flex-1 text-body">{p.name}</span>
                  <button
                    onClick={() => handleAddFromRecent(id)}
                    className="text-primary text-meta min-h-11 px-3"
                  >
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Main state
  const today = todayKey();
  const todayMinutes = getMinutesForDay(logs, today);
  const completedToday = getPracticesCompletedToday(logs);
  const daysPracticed = getTotalDaysPracticed(logs);
  const streak = getCurrentStreak(logs);
  const heatMapWeeks = getHeatMapWeeks(logs);

  const addedPracticeIds = new Set(instances.map((i) => i.practiceId));
  const recentNotAdded = [...new Set(logs.map((l) => l.practiceId))]
    .filter((id) => !addedPracticeIds.has(id))
    .slice(0, 3);
  const nextPractices = YOUR_NEXT_PRACTICE_IDS
    .filter((id) => !addedPracticeIds.has(id))
    .slice(0, 3);

  return (
    <div className="h-full flex flex-col bg-page">
      <div className="flex-1 overflow-y-auto pb-24">
        <BackHeader
          dark
          title="My practices"
          onBack={handleBack}
          rightAction={settingsAction}
        />

        <div className="px-4">
          <button onClick={() => navigate('/journey')} className="w-full">
            <JourneyRow ref={journeyRef} journey={journey} animating={animating} />
          </button>

          {/* Today — cream stat pair */}
          <div className="mt-[26px]">
            <p className="eyebrow mb-3">Today</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-[14px] p-4">
                <p className="text-stat text-ink">{completedToday}</p>
                <p className="text-label text-secondary mt-1">practices completed</p>
              </div>
              <div className="bg-card rounded-[14px] p-4">
                <p className="text-stat text-ink">{todayMinutes}</p>
                <p className="text-label text-secondary mt-1">minutes practiced</p>
              </div>
            </div>
          </div>

          {/* Practices */}
          <div className="flex items-center justify-between mt-[26px] mb-3">
            <h3 className="text-title" {...demoEntryHandlers}>Practices</h3>
            <button
              onClick={() => navigate('/practices/edit')}
              className="flex items-center gap-1.5 text-primary text-meta min-h-11"
              aria-label="Edit practices"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>
          <div className="bg-card rounded-[14px] divide-y divide-hairline px-1">
            {instances.map((inst) => (
              <PracticeCard
                key={inst.id}
                instance={inst}
                allInstances={instances}
                completed={isInstanceCompletedToday(logs, inst.id)}
                completedTwice={isInstanceCompletedTwiceToday(logs, inst.id)}
                timedMinutesToday={getTimedMinutesToday(logs, inst.id)}
                onCheckbox={() => handleLog(inst.id)}
                onPlus={() => { setMinuteSheet(inst.id); setSelectedMinutes(5); }}
                onPlay={() => {
                  useAppStore.getState().setPlayerSession({
                    practiceInstanceIds: [inst.id],
                    includeInvocation: false,
                  });
                  navigate('/player');
                }}
              />
            ))}
          </div>

          {/* Your practice so far */}
          <button
            onClick={() => navigate('/practice-so-far')}
            className="w-full mt-[26px] p-4 bg-card rounded-[14px] text-left"
          >
            <p className="eyebrow mb-2">Your practice so far</p>
            <div className="flex gap-8 mb-4">
              <div>
                <p className="text-stat">{daysPracticed}</p>
                <p className="text-label text-secondary">days practiced</p>
              </div>
              <div>
                <p className="text-stat">{streak}</p>
                <p className="text-label text-secondary">day streak</p>
              </div>
            </div>
            <HeatMap weeks={heatMapWeeks} compact />
          </button>

          {recentNotAdded.length > 0 && (
            <div className="mt-[26px] bg-card rounded-[14px] px-3 pb-1">
              <p className="eyebrow px-1 pt-4 mb-1">Recently practiced</p>
              {recentNotAdded.map((id) => {
                const p = getPractice(id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-3 py-3 border-b border-hairline last:border-0">
                    <PracticeIllustration practiceId={id} size={40} />
                    <span className="flex-1 text-body truncate">{p.name}</span>
                    <button onClick={() => handleAddFromRecent(id)} className="text-primary text-meta min-h-11 px-2">Add</button>
                  </div>
                );
              })}
            </div>
          )}

          {nextPractices.length > 0 && (
            <div className="mt-[26px] bg-card rounded-[14px] px-3 pb-1">
              <p className="eyebrow px-1 pt-4 mb-1">Your next practices</p>
              {nextPractices.map((id) => {
                const p = getPractice(id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-3 py-3 border-b border-hairline last:border-0">
                    <PracticeIllustration practiceId={id} size={40} />
                    <span className="flex-1 text-body truncate">{p.name}</span>
                    <button onClick={() => handleAddFromRecent(id)} className="text-primary text-meta min-h-11 px-2">Add</button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => navigate('/practices/edit')}
            className="w-full mt-[26px] mb-4 p-4 rounded-[14px] bg-card text-left"
          >
            <p className="eyebrow mb-1">Every Sunday</p>
            <p className="text-title">Explore all practices</p>
            <p className="text-label text-secondary mt-1">Browse the full catalogue</p>
          </button>
        </div>
      </div>

      <StickyAction
        label="Start Session"
        onClick={() => navigate('/session/select')}
      />

      <BottomSheet
        open={!!minuteSheet}
        onClose={() => setMinuteSheet(null)}
        title="Add minutes"
      >
        <MinutePicker value={selectedMinutes} onChange={setSelectedMinutes} />
        <Button
          fullWidth
          className="mt-4"
          onClick={async () => {
            if (minuteSheet) {
              haptic();
              await logPractice(minuteSheet, selectedMinutes, 'manual');
              setMinuteSheet(null);
            }
          }}
        >
          Confirm
        </Button>
      </BottomSheet>

      {toast && <Toast message={toast} />}

      <DemoModePicker open={demoPickerOpen} onClose={() => setDemoPickerOpen(false)} />
    </div>
  );
}

const JourneyRow = forwardRef<HTMLDivElement, {
  journey: ReturnType<typeof computeJourneyProgress>;
  animating: boolean;
}>(({ journey, animating }, ref) => (
  <div ref={ref} className="bg-card rounded-[14px] p-4 mt-2">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-14 h-14 rounded-full bg-page flex items-center justify-center">
        <PlantVisual level={journey.currentLevel} animating={animating} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="eyebrow text-journey">Level {journey.currentLevel}</p>
        <p className="font-serif text-title truncate">{getLevelLabel(journey.currentLevel)}</p>
      </div>
    </div>
    <ProgressBar progress={journey.progressInLevel} className="mb-2" />
    <div className="flex justify-between text-meta text-secondary">
      <span>{formatMinutes(journey.totalMinutes)} min tracked</span>
      <span>{formatMinutes(journey.minutesToNext)} min to next level</span>
    </div>
  </div>
));

JourneyRow.displayName = 'JourneyRow';
