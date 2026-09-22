import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PracticeCard, BottomSheet, MinutePicker, Button,
  PracticeCalendar, ProgressStatBoxes,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import {
  getPracticesCompletedToday, getMinutesForDay,
  isInstanceCompletedToday, isInstanceCompletedTwiceToday, getTimedMinutesToday,
} from '@/utils/dates';
import { sortTrackingInstances } from '@/utils/sortInstances';
import { useHaptic } from '@/hooks';
import { track } from '@/services/instrumentation';

export function PracticeHome() {
  const navigate = useNavigate();
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const logPractice = useAppStore((s) => s.logPractice);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const profile = useAppStore((s) => s.profile);
  const markFirstRecordReassuranceShown = useAppStore((s) => s.markFirstRecordReassuranceShown);
  const playerSession = useAppStore((s) => s.playerSession);
  const haptic = useHaptic();

  const [minuteSheet, setMinuteSheet] = useState<string | null>(null);
  const [minuteMode, setMinuteMode] = useState<'log' | 'play'>('log');
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const [minuteDefault, setMinuteDefault] = useState(10);
  const [reassuranceOpen, setReassuranceOpen] = useState(false);
  const reassuranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedInstances = useMemo(() => sortTrackingInstances(instances), [instances]);

  // Read the day from the store rather than the clock: this is what re-renders
  // the screen when the app is resumed after midnight (see initDayRollover).
  const today = useAppStore((s) => s.currentDay);
  const todayMinutes = getMinutesForDay(logs, today);
  const completedToday = getPracticesCompletedToday(logs);

  const bellAction = (
    <button onClick={() => navigate('/reminders')} aria-label="Reminders" className="w-11 h-11 flex items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    </button>
  );

  const openMinuteSheet = (instanceId: string, mode: 'log' | 'play') => {
    const inst = instances.find((i) => i.id === instanceId);
    const practice = inst ? getPractice(inst.practiceId) : null;
    const defaultMin = practice?.minutes ?? 10;
    setMinuteDefault(defaultMin);
    setSelectedMinutes(defaultMin);
    setMinuteMode(mode);
    setMinuteSheet(instanceId);
  };

  const handleCheckbox = async (instanceId: string) => {
    haptic();
    const showReassurance = !profile?.firstRecordReassuranceShown;
    await logPractice(instanceId, getDefaultLogMinutes(
      instances.find((i) => i.id === instanceId)!.practiceId,
    ), 'checkbox');
    if (showReassurance) {
      if (reassuranceTimerRef.current) clearTimeout(reassuranceTimerRef.current);
      reassuranceTimerRef.current = setTimeout(() => {
        setReassuranceOpen(true);
        reassuranceTimerRef.current = null;
      }, 500);
    }
  };

  const handleDismissReassurance = () => {
    setReassuranceOpen(false);
    void markFirstRecordReassuranceShown();
  };

  const handleConfirmMinutes = async () => {
    if (!minuteSheet) return;
    haptic();
    if (minuteMode === 'play') {
      const inst = instances.find((i) => i.id === minuteSheet);
      const practice = inst ? getPractice(inst.practiceId) : null;
      track('practice_started', {
        practice_id: inst?.practiceId,
        instance: inst?.instanceNumber,
        kind: practice ? getResolvedKind(practice.id) : undefined,
      });
      setPlayerSession({
        practiceInstanceIds: [minuteSheet],
        includeInvocation: false,
        timedMinutes: selectedMinutes,
      });
      navigate('/player');
    } else {
      await logPractice(minuteSheet, selectedMinutes, 'minutes');
    }
    setMinuteSheet(null);
  };

  const handlePlay = (instanceId: string) => {
    const inst = instances.find((i) => i.id === instanceId);
    const practice = inst ? getPractice(inst.practiceId) : null;
    if (!practice) return;
    const kind = getResolvedKind(practice.id);
    track('practice_started', {
      practice_id: inst?.practiceId,
      instance: inst?.instanceNumber,
      kind,
    });
    if (kind === 'timed') {
      openMinuteSheet(instanceId, 'play');
      return;
    }
    setPlayerSession({ practiceInstanceIds: [instanceId], includeInvocation: false });
    navigate('/player');
  };

  return (
    <div className="h-full overflow-y-auto pb-8 bg-page">
      {/* Compact header: app name left, reminders bell right, no bar behind it. */}
      <header className="flex items-center justify-between px-4 pt-3 text-ink">
        <h1 className="font-serif text-headline flex-1 text-center pl-11">Sadhana Tracker</h1>
        {bellAction}
      </header>

      <div className="px-4">
        <section className="mt-5">
          <p className="section-header mb-2">Today</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-[14px] p-3 border border-hairline">
              <p className="text-stat text-ink">{completedToday}</p>
              <p className="text-label text-secondary mt-1">practices completed</p>
            </div>
            <div className="bg-card rounded-[14px] p-3 border border-hairline">
              <p className="text-stat text-ink">{todayMinutes}</p>
              <p className="text-label text-secondary mt-1">minutes practiced</p>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="section-header">My practices</p>
            <button
              onClick={() => navigate('/practices/edit')}
              className="w-11 h-11 flex items-center justify-center text-primary"
              aria-label="Edit practices"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>

          {instances.length === 0 ? (
            <div className="bg-card rounded-[14px] p-3 text-center">
              <p className="text-label text-secondary mb-4">Add the practices you do to start tracking.</p>
              <Button fullWidth onClick={() => navigate('/practices/edit', { state: { firstSetup: true } })}>
                Add practices
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-[14px] divide-y divide-hairline">
              {sortedInstances.map((inst) => (
                <PracticeCard
                  key={inst.id}
                  instance={inst}
                  allInstances={instances}
                  completed={isInstanceCompletedToday(logs, inst.id)}
                  completedTwice={isInstanceCompletedTwiceToday(logs, inst.id)}
                  timedMinutesToday={getTimedMinutesToday(logs, inst.id)}
                  onCheckbox={() => handleCheckbox(inst.id)}
                  onPlus={() => openMinuteSheet(inst.id, 'log')}
                  onPlay={() => handlePlay(inst.id)}
                  playSessionActive={playerSession?.practiceInstanceIds[0] === inst.id}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-5">
          <p className="section-header mb-2">My practice progress</p>
          <ProgressStatBoxes logs={logs} />
          <div className="bg-card rounded-[14px] p-3 border border-hairline mt-3">
            <PracticeCalendar logs={logs} />
          </div>
        </section>
      </div>

      <BottomSheet
        open={!!minuteSheet}
        onClose={() => setMinuteSheet(null)}
        title={minuteMode === 'play' ? 'How long will you practice?' : 'How long did you practice?'}
        key={minuteSheet ?? 'closed'}
      >
        <MinutePicker initialValue={minuteDefault} onChange={setSelectedMinutes} />
        <Button fullWidth className="mt-4" onClick={handleConfirmMinutes}>
          {minuteMode === 'play' ? 'Start practice' : 'Add'}
        </Button>
      </BottomSheet>

      <BottomSheet
        open={reassuranceOpen}
        onClose={handleDismissReassurance}
        title="That's recorded"
        hideCloseButton
        dismissOnBackdrop={false}
      >
        <p className="text-label text-secondary mb-6">
          Nothing to confirm and nothing to save. You can close the app — it is kept, even without internet.
        </p>
        <Button fullWidth onClick={handleDismissReassurance}>
          Got it
        </Button>
      </BottomSheet>
    </div>
  );
}
