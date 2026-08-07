import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackHeader, StickyAction, PracticeCard, PlantVisual, ProgressBar,
  BottomSheet, MinutePicker, Button, Toast,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { computeJourneyProgress, getLevelLabel } from '@/data/journey';
import { START_HERE_MEDITATOR, START_HERE_POTENTIAL } from '@/data/constants';
import { YOUR_NEXT_PRACTICE_IDS, getPractice } from '@/data/catalogue';
import {
  getTotalMinutes, getTotalDaysPracticed, getCurrentStreak,
  getPracticesCompletedToday, getMinutesForDay, todayKey,
  isInstanceCompletedToday, isInstanceCompletedTwiceToday, getTimedMinutesToday,
} from '@/utils/dates';
import { getHeatMapWeeks } from '@/utils/stats';
import { HeatMap } from '@/components';
import { useInViewport, useJourneyAnimation, useHaptic } from '@/hooks';
import { formatMinutes } from '@/utils/dates';

export function PracticeHome() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const logPractice = useAppStore((s) => s.logPractice);
  const addPracticeInstance = useAppStore((s) => s.addPracticeInstance);
  const toast = useAppStore((s) => s.toast);
  const haptic = useHaptic();

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

  // Empty state
  if (!hasPractices && !hasLogs) {
    const startHere = isMeditator ? START_HERE_MEDITATOR : START_HERE_POTENTIAL;
    return (
      <div className="h-full overflow-y-auto pb-8">
        <BackHeader
          dark
          title="My practices"
          onBack={handleBack}
          rightAction={
            <button onClick={() => navigate('/settings')} aria-label="Settings">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
          }
        />
        <div className="px-6 pt-4">
          {!isMeditator && (
            <div className="flex justify-center mb-6">
              <PlantVisual level={0} size="lg" />
            </div>
          )}
          <h2 className="font-serif text-2xl font-semibold text-center mb-8">
            Your journey of transformation awaits
          </h2>
          <button
            onClick={() => navigate('/practices/edit', { state: { firstSetup: true } })}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold mb-8"
          >
            Add practices
          </button>
          <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-3">Start here</p>
          {startHere.map((id) => {
            const p = getPractice(id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-3 py-3 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-amber-100" />
                <span className="font-medium">{p.name}</span>
              </div>
            );
          })}
          <button
            onClick={() => navigate('/practices/edit', { state: { firstSetup: true } })}
            className="w-full mt-6 p-4 rounded-xl border border-border text-left"
          >
            <p className="font-semibold">Explore all practices</p>
            <p className="text-sm text-secondary">Browse the full catalogue</p>
          </button>
        </div>
      </div>
    );
  }

  // Practiced but nothing added
  if (!hasPractices && hasLogs) {
    const recentPracticeIds = [...new Set(logs.map((l) => l.practiceId))].slice(0, 3);
    return (
      <div className="h-full overflow-y-auto pb-8">
        <BackHeader dark title="My practices" onBack={handleBack} />
        <div className="px-6 pt-4">
          <JourneyRow
            ref={journeyRef}
            journey={journey}
            animating={animating}
          />
          <h2 className="font-serif text-2xl font-semibold mb-6">TBD-Copy</h2>
          <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-3">Recently practiced</p>
          {recentPracticeIds.map((id) => {
            const p = getPractice(id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-3 py-3 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-amber-100" />
                <span className="flex-1 font-medium">{p.name}</span>
                <button
                  onClick={() => handleAddFromRecent(id)}
                  className="text-primary font-semibold text-sm"
                >
                  Add
                </button>
              </div>
            );
          })}
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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        <BackHeader
          dark
          title="My practices"
          onBack={handleBack}
          rightAction={
            <button onClick={() => navigate('/settings')} aria-label="Settings">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
          }
        />

        <div className="px-4">
          <button onClick={() => navigate('/journey')} className="w-full">
            <JourneyRow ref={journeyRef} journey={journey} animating={animating} />
          </button>

          {/* Today */}
          <div className="mt-6 mb-2">
            <h3 className="font-bold text-lg mb-2">Today</h3>
            <div className="flex gap-6 text-sm">
              <span><strong>{completedToday}</strong> practices completed</span>
              <span><strong>{todayMinutes}</strong> minutes practiced</span>
            </div>
          </div>

          {/* Practices */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <h3 className="font-bold text-lg">Practices</h3>
            <button
              onClick={() => navigate('/practices/edit')}
              className="flex items-center gap-1 text-primary text-sm font-semibold"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>
          <div className="bg-white rounded-xl divide-y divide-border">
            {instances.map((inst) => (
              <PracticeCard
                key={inst.id}
                instance={inst}
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
            className="w-full mt-6 p-4 bg-white rounded-xl text-left"
          >
            <h3 className="font-bold text-lg mb-3">Your practice so far</h3>
            <div className="flex gap-6 mb-4 text-sm">
              <span><strong>{daysPracticed}</strong> days practiced</span>
              <span><strong>{streak}</strong> day streak</span>
            </div>
            <HeatMap weeks={heatMapWeeks} compact />
          </button>

          {/* Recently practiced */}
          {recentNotAdded.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-2">Recently practiced</h3>
              {recentNotAdded.map((id) => {
                const p = getPractice(id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-3 py-3 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-amber-100" />
                    <span className="flex-1 font-medium">{p.name}</span>
                    <button onClick={() => handleAddFromRecent(id)} className="text-primary font-semibold text-sm">Add</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Your next practices */}
          {nextPractices.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-2">Your next practices</h3>
              {nextPractices.map((id) => {
                const p = getPractice(id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-3 py-3 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-amber-100" />
                    <span className="flex-1 font-medium">{p.name}</span>
                    <button onClick={() => handleAddFromRecent(id)} className="text-primary font-semibold text-sm">Add</button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => navigate('/practices/edit')}
            className="w-full mt-6 mb-4 p-4 rounded-xl border border-border text-left"
          >
            <p className="font-semibold">Explore all practices</p>
            <p className="text-sm text-secondary">Browse the full catalogue</p>
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
    </div>
  );
}

const JourneyRow = forwardRef<HTMLDivElement, {
  journey: ReturnType<typeof computeJourneyProgress>;
  animating: boolean;
}>(({ journey, animating }, ref) => (
  <div ref={ref} className="bg-white rounded-xl p-4 mt-2">
    <div className="flex items-center gap-3 mb-3">
      <PlantVisual level={journey.currentLevel} animating={animating} />
      <div className="flex-1">
        <p className="text-xs text-journey font-semibold uppercase tracking-wider">
          Level {journey.currentLevel}
        </p>
        <p className="font-semibold">{getLevelLabel(journey.currentLevel)}</p>
      </div>
    </div>
    <ProgressBar progress={journey.progressInLevel} className="mb-2" />
    <div className="flex justify-between text-xs text-secondary">
      <span>{formatMinutes(journey.totalMinutes)} min tracked</span>
      <span>{formatMinutes(journey.minutesToNext)} min to next level</span>
    </div>
  </div>
));

JourneyRow.displayName = 'JourneyRow';
