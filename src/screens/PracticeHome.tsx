import { useState, useEffect, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackHeader, PracticeCard, PlantVisual, ProgressBar,
  BottomSheet, MinutePicker, Button, Toast, DemoModePicker, useDemoModeEntry,
  PracticeIllustration, MonthHeatMap,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { computeJourneyProgress, getLevelLabel } from '@/data/journey';
import { getPractice } from '@/data/catalogue';
import {
  getPotentialStartHere, getMeditatorNextPractices, getPracticeAction, getPracticesByCategory,
} from '@/data/startHere';
import {
  getTotalMinutes, getTotalDaysPracticed, getCurrentStreak,
  getPracticesCompletedToday, getMinutesForDay, todayKey,
  isInstanceCompletedToday, isInstanceCompletedTwiceToday, getTimedMinutesToday,
  formatMinutes,
} from '@/utils/dates';
import { getCurrentMonthHeatMap } from '@/utils/heatmap';
import { useInViewport, useJourneyAnimation, useHaptic } from '@/hooks';
import { LevelUp } from '@/screens/LevelUp';

export function PracticeHome() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const savedSessions = useAppStore((s) => s.savedSessions);
  const logPractice = useAppStore((s) => s.logPractice);
  const levelCrossed = useAppStore((s) => s.levelCrossed);
  const markLevelUpShown = useAppStore((s) => s.markLevelUpShown);
  const setSessionDraft = useAppStore((s) => s.setSessionDraft);
  const setFeatureDiscoveryStep = useAppStore((s) => s.setFeatureDiscoveryStep);
  const toast = useAppStore((s) => s.toast);
  const haptic = useHaptic();

  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const demoEntryHandlers = useDemoModeEntry(() => setDemoPickerOpen(true));
  const [minuteSheet, setMinuteSheet] = useState<string | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [discoveryStep, setDiscoveryStep] = useState(0);
  const { animating, triggerAnimation } = useJourneyAnimation();

  const totalMinutes = getTotalMinutes(logs);
  const journey = computeJourneyProgress(totalMinutes);
  const hasPractices = instances.length > 0;
  const isMeditator = profile?.isMeditator ?? false;
  const monthDays = getCurrentMonthHeatMap(logs);

  const { ref: journeyRef } = useInViewport<HTMLDivElement>(() => triggerAnimation());

  useEffect(() => {
    if (levelCrossed) setLevelUpOpen(true);
  }, [levelCrossed]);

  useEffect(() => {
    if (hasPractices && (profile?.featureDiscoveryStep ?? 0) < 3) {
      setDiscoveryStep(profile?.featureDiscoveryStep ?? 0);
    }
  }, [hasPractices, profile?.featureDiscoveryStep]);

  const bellAction = (
    <button onClick={() => navigate('/reminders')} aria-label="Reminders" className="w-11 h-11 flex items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    </button>
  );

  const handleBack = () => {
    if (hasPractices) navigate('/app-home');
  };

  const handleLog = async (instanceId: string) => {
    haptic();
    await logPractice(instanceId, getDefaultLogMinutes(
      instances.find((i) => i.id === instanceId)!.practiceId,
    ), 'manual');
  };

  const openMinuteSheet = (instanceId: string) => {
    const inst = instances.find((i) => i.id === instanceId);
    const practice = inst ? getPractice(inst.practiceId) : null;
    setSelectedMinutes(practice?.minutes ?? 10);
    setMinuteSheet(instanceId);
  };

  const advanceDiscovery = async () => {
    const next = discoveryStep + 1;
    setDiscoveryStep(next);
    await setFeatureDiscoveryStep(next);
  };

  // Empty states
  if (!hasPractices) {
    return (
      <div className="h-full overflow-y-auto pb-8 bg-page">
        <BackHeader dark title="My practices" onBack={handleBack} rightAction={bellAction} />
        <div className="px-4">
          <JourneyRow ref={journeyRef} journey={journey} animating={animating} level={0} />
          <LevelZeroArt />
          <h2 className="font-serif text-headline text-center mb-3 px-2 mt-4">
            Your journey of transformation awaits
          </h2>

          {isMeditator ? (
            <>
              <p className="text-label text-secondary text-center mb-8 px-4">
                Add the practices you already do to start tracking them.
              </p>
              <button
                onClick={() => navigate('/practices/edit')}
                className="w-full py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold"
              >
                Add practices
              </button>
            </>
          ) : (
            <>
              <StartHereSection profile={profile} addedIds={new Set()} />
              <CatalogueInline />
            </>
          )}
        </div>
        {toast && <Toast message={toast} />}
        <DemoModePicker open={demoPickerOpen} onClose={() => setDemoPickerOpen(false)} />
      </div>
    );
  }

  // Main state with practices
  const today = todayKey();
  const todayMinutes = getMinutesForDay(logs, today);
  const completedToday = getPracticesCompletedToday(logs);
  const daysPracticed = getTotalDaysPracticed(logs);
  const streak = getCurrentStreak(logs);
  const addedPracticeIds = new Set(instances.map((i) => i.practiceId));
  const recentNotAdded = [...new Set(logs.map((l) => l.practiceId))]
    .filter((id) => !addedPracticeIds.has(id))
    .slice(0, 3);
  const hasTimed = instances.some((i) => getPractice(i.practiceId)?.type === 'timed');

  return (
    <div className="h-full overflow-y-auto pb-8 bg-page">
      <BackHeader dark title="My practices" onBack={handleBack} rightAction={bellAction} />

      <div className="px-4">
        <button onClick={() => navigate('/journey')} className="w-full">
          <JourneyRow ref={journeyRef} journey={journey} animating={animating} />
        </button>

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

        <button
          onClick={() => navigate('/session/select')}
          className="w-full mt-[26px] py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold"
        >
          Start session
        </button>

        {savedSessions.length > 0 && (
          <div className="mt-[26px]">
            <p className="eyebrow mb-3">Saved sessions</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {savedSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setSessionDraft({
                      practiceInstanceIds: session.practiceInstanceIds,
                      includeInvocation: true,
                    });
                    navigate('/session/review');
                  }}
                  className="flex-shrink-0 w-24 relative"
                >
                  <SessionThumb instanceIds={session.practiceInstanceIds} instances={instances} />
                  <p className="text-label text-center mt-1.5 truncate">{session.name}</p>
                  <span className="absolute bottom-8 right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-[26px] mb-3">
          <h3 className="text-title" {...demoEntryHandlers}>Practices</h3>
          <button onClick={() => navigate('/practices/edit')} className="text-primary text-meta min-h-11 px-2">Edit</button>
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
              onPlus={() => openMinuteSheet(inst.id)}
              onPlay={() => {
                openMinuteSheet(inst.id);
              }}
            />
          ))}
        </div>

        <button onClick={() => navigate('/practice-so-far')} className="w-full mt-[26px] p-4 bg-card rounded-[14px] text-left">
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
          <MonthHeatMap days={monthDays} />
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
                </div>
              );
            })}
          </div>
        )}

        {!isMeditator ? (
          <StartHereSection profile={profile} addedIds={addedPracticeIds} />
        ) : (
          <NextPracticesSection addedIds={addedPracticeIds} />
        )}

        <button onClick={() => navigate('/practices/edit')} className="w-full mt-[26px] mb-4 p-4 rounded-[14px] bg-card text-left">
          <p className="text-title">Explore all practices</p>
          <p className="text-label text-secondary mt-1">Browse the full catalogue</p>
        </button>
      </div>

      <BottomSheet open={!!minuteSheet} onClose={() => setMinuteSheet(null)} title="Add minutes">
        <MinutePicker value={selectedMinutes} onChange={setSelectedMinutes} defaultValue={selectedMinutes} />
        <Button fullWidth className="mt-4" onClick={async () => {
          if (minuteSheet) {
            haptic();
            await logPractice(minuteSheet, selectedMinutes, 'manual');
            setMinuteSheet(null);
          }
        }}>Confirm</Button>
      </BottomSheet>

      <BottomSheet open={levelUpOpen} onClose={async () => { setLevelUpOpen(false); await markLevelUpShown(); }} title="">
        <div className="min-h-[70vh]">
          <LevelUp embedded />
        </div>
      </BottomSheet>

      <FeatureDiscoverySheet step={discoveryStep} hasTimed={hasTimed} onAdvance={advanceDiscovery} />

      {toast && <Toast message={toast} />}
      <DemoModePicker open={demoPickerOpen} onClose={() => setDemoPickerOpen(false)} />
    </div>
  );
}

function LevelZeroArt() {
  return (
    <div className="relative h-32 -mx-4 mt-2 mb-2 flex items-end justify-center overflow-hidden pointer-events-none">
      <PlantVisual level={0} size="lg" className="scale-[2.5] opacity-80" />
    </div>
  );
}

function StartHereSection({ profile, addedIds }: { profile: ReturnType<typeof useAppStore.getState>['profile']; addedIds: Set<string> }) {
  if (!profile?.drawnToType || !profile.durationPreference) return null;
  const { hero, listings } = getPotentialStartHere(profile.drawnToType, profile.durationPreference);
  const heroPractice = getPractice(hero);
  if (!heroPractice || addedIds.has(hero)) return null;

  return (
    <div className="mt-[26px]">
      <p className="eyebrow mb-3">Start here</p>
      <div className="bg-card rounded-[14px] overflow-hidden mb-3">
        <div className="flex">
          <PracticeIllustration practiceId={hero} size={120} />
          <div className="flex-1 p-4 flex flex-col justify-center">
            <p className="text-title mb-2">{heroPractice.name}</p>
            <span className="text-meta text-primary font-semibold">{getPracticeAction(hero)}</span>
          </div>
        </div>
      </div>
      {listings.filter((id) => !addedIds.has(id)).map((id) => {
        const p = getPractice(id);
        if (!p) return null;
        return (
          <div key={id} className="bg-card rounded-[14px] flex items-center gap-3 p-3 mb-2">
            <PracticeIllustration practiceId={id} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-body truncate">{p.name}</p>
            </div>
            <span className="text-meta text-primary font-semibold px-2">{getPracticeAction(id)}</span>
          </div>
        );
      })}
    </div>
  );
}

function NextPracticesSection({ addedIds }: { addedIds: Set<string> }) {
  const ids = getMeditatorNextPractices(addedIds);
  if (ids.length === 0) return null;
  return (
    <div className="mt-[26px]">
      <p className="eyebrow mb-3">Your next practices</p>
      {ids.map((id) => {
        const p = getPractice(id);
        if (!p) return null;
        return (
          <div key={id} className="bg-card rounded-[14px] flex items-center gap-3 p-3 mb-2">
            <PracticeIllustration practiceId={id} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-body truncate">{p.name}</p>
            </div>
            <span className="text-meta text-primary font-semibold px-2">{getPracticeAction(id)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CatalogueInline() {
  const groups = getPracticesByCategory();
  return (
    <div className="mt-[26px] space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="eyebrow mb-2">{g.label}</p>
          <div className="bg-card rounded-[14px] px-3">
            {g.practices.map((p) => (
              <div key={p.id} className="py-3 border-b border-hairline last:border-0 text-body">{p.name}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionThumb({ instanceIds, instances }: { instanceIds: string[]; instances: { id: string; practiceId: string }[] }) {
  const ids = instanceIds.slice(0, 9);
  return (
    <div className="w-20 h-20 bg-card rounded-[12px] border border-border p-1 grid grid-cols-3 gap-0.5">
      {ids.map((id) => {
        const inst = instances.find((i) => i.id === id);
        return (
          <div key={id} className="rounded-[4px] overflow-hidden flex items-center justify-center">
            <PracticeIllustration practiceId={inst?.practiceId ?? id} size={22} />
          </div>
        );
      })}
    </div>
  );
}

function FeatureDiscoverySheet({ step, hasTimed, onAdvance }: { step: number; hasTimed: boolean; onAdvance: () => void }) {
  if (step >= 3) return null;
  const sheets = [
    { title: 'Mark complete', body: 'Tap the circle to mark a practice done for today.', icon: '○' },
    ...(hasTimed ? [{ title: 'Log minutes', body: 'Tap + to log minutes for practices done across the day.', icon: '+' }] : []),
    { title: 'Start a session', body: 'Use Start session to do several practices one after another.', icon: '▶' },
  ];
  const current = sheets[step];
  if (!current) return null;

  return (
    <BottomSheet open onClose={onAdvance} title={current.title}>
      <p className="text-label text-secondary mb-4">{current.body}</p>
      <div className="h-16 bg-card rounded-[14px] flex items-center justify-center text-2xl mb-6">{current.icon}</div>
      <Button fullWidth onClick={onAdvance}>{step === sheets.length - 1 ? 'Got it' : 'Next'}</Button>
    </BottomSheet>
  );
}

const JourneyRow = forwardRef<HTMLDivElement, {
  journey: ReturnType<typeof computeJourneyProgress>;
  animating: boolean;
  level?: number;
}>(({ journey, animating, level }, ref) => (
  <div ref={ref} className="bg-card rounded-[14px] p-4 mt-2">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-14 h-14 rounded-full bg-page flex items-center justify-center">
        <PlantVisual level={level ?? journey.currentLevel} animating={animating} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="eyebrow text-journey">Level {level ?? journey.currentLevel}</p>
        <p className="font-serif text-title truncate">{getLevelLabel(level ?? journey.currentLevel)}</p>
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
