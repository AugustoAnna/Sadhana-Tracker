import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PracticeCard, BottomSheet, MinutePicker, Button,
  PracticeCalendar, ProgressStatBoxes,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import {
  getLogsForDay, getPracticesCompletedOn, getMinutesForDay,
  isInstanceCompletedOn, getTimedMinutesOn,
} from '@/utils/dates';
import { sortTrackingInstances } from '@/utils/sortInstances';
import { useHaptic } from '@/hooks';
import { track } from '@/services/instrumentation';
import { COPY } from '@/copy/strings';
import { EVENTS } from '@/features/backtracking/analyticsNames';
import { yesterdayOf } from '@/features/backtracking/dates';
import { DaySwitcher } from '@/features/backtracking/DaySwitcher';
import { removedPracticesOn } from '@/features/backtracking/removedPractices';
import { missedDayDecision, type MissedVariant } from '@/features/backtracking/missedDayRule';
import { MissedDaySheet, type MissedDayAnswer } from '@/features/backtracking/MissedDaySheet';
import type { BacktrackRoute, DayKey, LocalDate } from '@/features/backtracking/types';

export function PracticeHome() {
  const navigate = useNavigate();
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const logPractice = useAppStore((s) => s.logPractice);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const profile = useAppStore((s) => s.profile);
  const markMissedSheetShown = useAppStore((s) => s.markMissedSheetShown);
  const remoteRestoreSettled = useAppStore((s) => s.remoteRestoreSettled);
  const playerSession = useAppStore((s) => s.playerSession);
  const haptic = useHaptic();

  const [minuteSheet, setMinuteSheet] = useState<string | null>(null);
  const [minuteMode, setMinuteMode] = useState<'log' | 'play'>('log');
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const [minuteDefault, setMinuteDefault] = useState(10);
  // The day a log-mode picker writes to, fixed when it opens: Add after
  // midnight still lands on the day the picker was opened for.
  const [pickerDay, setPickerDay] = useState<{ date: LocalDate; referenceDay: LocalDate; route?: BacktrackRoute } | null>(null);
  // Yesterday, and the day it was chosen on. The choice only holds while that
  // day is still today, so a rollover drops back to Today in the same render.
  // Screen state, so every new visit to this screen opens on Today.
  const [yesterdayPick, setYesterdayPick] = useState<{ madeOn: LocalDate; route: BacktrackRoute } | null>(null);
  const [missedSheet, setMissedSheet] = useState<{ variant: MissedVariant } | null>(null);
  const shownRunKeyRef = useRef<LocalDate | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedInstances = useMemo(() => sortTrackingInstances(instances), [instances]);

  // Read the day from the store rather than the clock: this is what re-renders
  // the screen when the app is resumed after midnight (see initDayRollover).
  const today = useAppStore((s) => s.currentDay);
  const canSwitchDay = instances.length > 0;
  const day: DayKey = canSwitchDay && yesterdayPick?.madeOn === today ? 'yesterday' : 'today';
  const onYesterday = day === 'yesterday';
  const selectedDate = onYesterday ? yesterdayOf(today) : today;
  const route = onYesterday ? yesterdayPick?.route : undefined;
  // The day's logs once per change, not a full-history scan per row.
  const dayLogs = useMemo(() => getLogsForDay(logs, selectedDate), [logs, selectedDate]);
  const dayMinutes = getMinutesForDay(dayLogs, selectedDate);
  const dayCompleted = getPracticesCompletedOn(dayLogs, selectedDate);
  const removedPractices = useMemo(
    () => (onYesterday ? removedPracticesOn(dayLogs, instances, selectedDate) : []),
    [onYesterday, dayLogs, instances, selectedDate],
  );
  const removedInstances = useMemo(
    () => removedPractices.map((r) => ({
      id: r.instanceId, practiceId: r.practiceId, instanceNumber: r.instanceNumber, order: r.instanceNumber, addedAt: 0,
    })),
    [removedPractices],
  );

  // Ask about yesterday when the screen opens and when the day changes — not
  // on every log. It waits for the launch-time server pull (another device may
  // have logged yesterday) and for any open sheet to close, rather than
  // stacking on it. The run key is saved at once, so a reload doesn't ask
  // again; the ref covers the gap before that save lands (and StrictMode's
  // re-run).
  const otherSheetOpen = !!minuteSheet;
  useEffect(() => {
    if (!remoteRestoreSettled || otherSheetOpen) return;
    const decision = missedDayDecision(logs, instances, profile?.missedSheetRunKey, today);
    if (!decision.show || decision.runKey === shownRunKeyRef.current) return;
    shownRunKeyRef.current = decision.runKey;
    setMissedSheet({ variant: decision.variant });
    markMissedSheetShown(decision.runKey).catch((err) => {
      console.error('Failed to save the missed-day run key:', err);
    });
    track(EVENTS.missedSheetShown, { variant: decision.variant, gap_days: decision.gapDays });
  }, [today, remoteRestoreSettled, otherSheetOpen]);

  const answerMissedDay = (answer: MissedDayAnswer) => {
    if (missedSheet) track(EVENTS.missedSheetAnswered, { variant: missedSheet.variant, answer });
    setMissedSheet(null);
    if (answer === 'log') {
      setYesterdayPick({ madeOn: today, route: 'sheet' });
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  };

  const switchDay = (to: DayKey) => {
    setYesterdayPick(to === 'yesterday' ? { madeOn: today, route: 'switcher' } : null);
    track(EVENTS.daySwitched, to === 'yesterday' ? { to, route: 'switcher' } : { to });
  };

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
    setPickerDay({ date: selectedDate, referenceDay: today, route });
    setMinuteSheet(instanceId);
  };

  const handleCheckbox = async (instanceId: string) => {
    haptic();
    await logPractice(instanceId, getDefaultLogMinutes(
      instances.find((i) => i.id === instanceId)!.practiceId,
    ), 'checkbox', { date: selectedDate, route });
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
      await logPractice(minuteSheet, selectedMinutes, 'minutes', pickerDay ?? undefined);
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
    <div ref={scrollRef} className="h-full overflow-y-auto pb-8 bg-page">
      {/* Compact header: app name left, reminders bell right, no bar behind it. */}
      <header className="flex items-center justify-between px-4 pt-3 text-ink">
        <h1 className="font-serif text-headline flex-1 text-center pl-11" style={{ fontSize: '22px' }}>Sadhana Tracker</h1>
        {bellAction}
      </header>

      <div className="px-4">
        <section className={canSwitchDay ? 'mt-3' : 'mt-5'}>
          {/* The switcher is the heading for the day: it governs the stat cards
              and the ticks below, never the cumulative progress further down. */}
          {canSwitchDay ? (
            <div className="mb-1">
              <DaySwitcher day={day} onChange={switchDay} />
            </div>
          ) : (
            <p className="section-header mb-2">{COPY.tracker.day.today}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-[14px] p-3 border border-hairline">
              <p className="text-stat text-ink">{dayCompleted}</p>
              <p className="text-label text-secondary mt-1">practices completed</p>
            </div>
            <div className="bg-card rounded-[14px] p-3 border border-hairline">
              <p className="text-stat text-ink">{dayMinutes}</p>
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
                  day={day}
                  completed={isInstanceCompletedOn(dayLogs, inst.id, selectedDate)}
                  timedMinutesToday={getTimedMinutesOn(dayLogs, inst.id, selectedDate)}
                  onCheckbox={() => handleCheckbox(inst.id)}
                  onPlus={() => openMinuteSheet(inst.id, 'log')}
                  // Nothing is played "for yesterday": logging only.
                  onPlay={onYesterday ? undefined : () => handlePlay(inst.id)}
                  playSessionActive={playerSession?.practiceInstanceIds[0] === inst.id}
                />
              ))}
              {removedPractices.map((r, i) => (
                <PracticeCard
                  key={r.instanceId}
                  instance={removedInstances[i]}
                  allInstances={removedInstances}
                  day={day}
                  completed
                  timedMinutesToday={r.minutes}
                  readOnly
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
        title={
          minuteMode === 'play'
            ? 'How long will you practice?'
            : pickerDay && pickerDay.date !== pickerDay.referenceDay
              ? COPY.tracker.minutePicker.titleYesterday
              : COPY.tracker.minutePicker.titleToday
        }
        key={minuteSheet ?? 'closed'}
      >
        <MinutePicker initialValue={minuteDefault} onChange={setSelectedMinutes} />
        <Button fullWidth className="mt-4" onClick={handleConfirmMinutes}>
          {minuteMode === 'play' ? 'Start practice' : 'Add'}
        </Button>
      </BottomSheet>

      <MissedDaySheet
        open={!!missedSheet}
        variant={missedSheet?.variant ?? 1}
        name={profile?.name?.trim() ?? ''}
        practiceId={sortedInstances[0]?.practiceId ?? 'default'}
        onAnswer={answerMissedDay}
      />
    </div>
  );
}
