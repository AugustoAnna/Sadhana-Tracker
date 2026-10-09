import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PracticeCard, BottomSheet, MinutePicker, Button,
  PracticeCalendar, ProgressStatBoxes, DayStatCards,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import {
  getLogsForDay, getPracticesCompletedOn, getMinutesForDay,
  isInstanceCompletedOn, getTimedMinutesOn, yesterdayOf,
} from '@/utils/dates';
import { sortTrackingInstances } from '@/utils/sortInstances';
import { isUntickable, nextUntickChange } from '@/utils/untick';
import { useHaptic } from '@/hooks';
import { track } from '@/services/instrumentation';
import { COPY } from '@/copy/strings';
import type { BacktrackRoute, DayKey, LocalDate } from '@/types';
import { EVENTS } from '@/features/backtracking/analyticsNames';
import { DaySwitcher } from '@/features/backtracking/DaySwitcher';
import { removedPracticesOn } from '@/features/backtracking/removedPractices';
import { BacktrackPrompts, type YesterdayPick } from '@/features/backtracking/BacktrackPrompts';

export function PracticeHome() {
  const navigate = useNavigate();
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const logPractice = useAppStore((s) => s.logPractice);
  const unlogPractice = useAppStore((s) => s.unlogPractice);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
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
  const [yesterdayPick, setYesterdayPick] = useState<YesterdayPick | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
  // Fresh ticks that can be taken back, by instance, and when that next
  // changes (a tick unlocking after its first half second, or locking after
  // its minute). Read again whenever the logs change and at that moment.
  const [untickRefresh, setUntickRefresh] = useState(0);

  const { untickable, nextUntickAt } = useMemo(() => {
    const now = Date.now();
    const changes = dayLogs
      .map((l) => nextUntickChange(l, now))
      .filter((at): at is number => at !== null);
    return {
      untickable: new Map(dayLogs.filter((l) => isUntickable(l, now)).map((l) => [l.instanceId, l])),
      nextUntickAt: changes.length ? Math.min(...changes) : null,
    };
  }, [dayLogs, untickRefresh]);

  useEffect(() => {
    if (nextUntickAt === null) return;
    const timer = setTimeout(() => setUntickRefresh((n) => n + 1), Math.max(0, nextUntickAt - Date.now()));
    return () => clearTimeout(timer);
  }, [nextUntickAt, untickRefresh]);
  const removedPractices = useMemo(
    () => (onYesterday ? removedPracticesOn(dayLogs, instances, selectedDate) : []),
    [onYesterday, dayLogs, instances, selectedDate],
  );

  // From the missed-day sheet or the push: Yesterday (or back to Today), from the top.
  const pickYesterday = (pick: YesterdayPick | null) => {
    setYesterdayPick(pick);
    if (pick && scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const switchDay = (to: DayKey) => {
    setYesterdayPick(to === 'yesterday' ? { madeOn: today, route: 'switcher' } : null);
    track(EVENTS.daySwitched, to === 'yesterday' ? { to, route: 'switcher' } : { to });
  };

  const settingsAction = (
    <button onClick={() => navigate('/reminders')} aria-label="Settings" className="w-11 h-11 flex items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
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

  const handleUntick = async (instanceId: string) => {
    const log = untickable.get(instanceId);
    if (!log) return;
    haptic();
    await unlogPractice(log.id);
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
        {settingsAction}
      </header>

      <div className="px-4">
        <section className={canSwitchDay ? 'mt-3' : 'mt-5'}>
          {/* The switcher is the heading for the day: it governs the stat cards
              and the ticks below, never the cumulative progress further down. */}
          {canSwitchDay ? (
            <div className="mb-3">
              <DaySwitcher day={day} onChange={switchDay} />
            </div>
          ) : (
            <p className="section-header mb-2">{COPY.tracker.day.today}</p>
          )}
          <DayStatCards completed={dayCompleted} minutes={dayMinutes} />
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="section-header">My practices</p>
            <button
              // Edit Practices opens with its list where this one is on screen.
              onClick={() => navigate('/practices/edit', {
                state: { listTop: listRef.current?.getBoundingClientRect().top },
              })}
              className="w-11 h-11 flex items-center justify-center text-primary-text"
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
            <div ref={listRef} className="bg-card rounded-[14px] divide-y divide-hairline">
              {sortedInstances.map((inst) => (
                <PracticeCard
                  key={inst.id}
                  instance={inst}
                  allInstances={instances}
                  day={day}
                  completed={isInstanceCompletedOn(dayLogs, inst.id, selectedDate)}
                  timedMinutesToday={getTimedMinutesOn(dayLogs, inst.id, selectedDate)}
                  onCheckbox={() => handleCheckbox(inst.id)}
                  onUntick={untickable.has(inst.id) ? () => handleUntick(inst.id) : undefined}
                  onPlus={() => openMinuteSheet(inst.id, 'log')}
                  // Nothing is played "for yesterday": logging only.
                  onPlay={onYesterday ? undefined : () => handlePlay(inst.id)}
                  playSessionActive={playerSession?.practiceInstanceIds[0] === inst.id}
                />
              ))}
              {removedPractices.map((r) => (
                <PracticeCard
                  key={r.id}
                  instance={r}
                  allInstances={removedPractices}
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

      <BacktrackPrompts sheetOpen={!!minuteSheet} onPick={pickYesterday} />
    </div>
  );
}
