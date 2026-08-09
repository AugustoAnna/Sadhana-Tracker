import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackHeader, PracticeCard, BottomSheet, MinutePicker, Button,
  WeekProgressGrid, ProgressStatBoxes,
} from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import {
  getPracticesCompletedToday, getMinutesForDay, todayKey,
  isInstanceCompletedToday, isInstanceCompletedTwiceToday, getTimedMinutesToday,
} from '@/utils/dates';
import { useHaptic } from '@/hooks';

export function PracticeHome() {
  const navigate = useNavigate();
  const instances = useAppStore((s) => s.instances);
  const logs = useAppStore((s) => s.logs);
  const logPractice = useAppStore((s) => s.logPractice);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const haptic = useHaptic();

  const [minuteSheet, setMinuteSheet] = useState<string | null>(null);
  const [minuteMode, setMinuteMode] = useState<'log' | 'play'>('log');
  const [selectedMinutes, setSelectedMinutes] = useState(10);

  const today = todayKey();
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
    setSelectedMinutes(practice?.minutes ?? 10);
    setMinuteMode(mode);
    setMinuteSheet(instanceId);
  };

  const handleCheckbox = async (instanceId: string) => {
    haptic();
    await logPractice(instanceId, getDefaultLogMinutes(
      instances.find((i) => i.id === instanceId)!.practiceId,
    ), 'checkbox');
  };

  const handleConfirmMinutes = async () => {
    if (!minuteSheet) return;
    haptic();
    await logPractice(minuteSheet, selectedMinutes, 'minutes');
    if (minuteMode === 'play') {
      setPlayerSession({ practiceInstanceIds: [minuteSheet], includeInvocation: false });
      navigate('/player');
    }
    setMinuteSheet(null);
  };

  const handlePlayGuided = (instanceId: string) => {
    setPlayerSession({ practiceInstanceIds: [instanceId], includeInvocation: false });
    navigate('/player');
  };

  return (
    <div className="h-full overflow-y-auto pb-8 bg-page">
      <BackHeader dark title="Practices" rightAction={bellAction} />

      <div className="px-4">
        <section className="mt-2">
          <p className="section-header mb-3">Today</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-[14px] p-4 border border-hairline">
              <p className="text-stat text-ink">{completedToday}</p>
              <p className="text-label text-secondary mt-1">practices completed</p>
            </div>
            <div className="bg-card rounded-[14px] p-4 border border-hairline">
              <p className="text-stat text-ink">{todayMinutes}</p>
              <p className="text-label text-secondary mt-1">minutes practiced</p>
            </div>
          </div>
        </section>

        <section className="mt-[26px]">
          <div className="flex items-center justify-between mb-3">
            <p className="section-header">Practices</p>
            <button
              onClick={() => navigate('/practices/edit')}
              className="w-11 h-11 flex items-center justify-center text-ink"
              aria-label="Edit practices"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>

          {instances.length === 0 ? (
            <div className="bg-card rounded-[14px] p-6 text-center">
              <p className="text-label text-secondary mb-4">Add the practices you do to start tracking.</p>
              <Button fullWidth onClick={() => navigate('/practices/edit', { state: { firstSetup: true } })}>
                Add practices
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-[14px] divide-y divide-hairline px-1">
              {instances.map((inst) => (
                <PracticeCard
                  key={inst.id}
                  instance={inst}
                  allInstances={instances}
                  completed={isInstanceCompletedToday(logs, inst.id)}
                  completedTwice={isInstanceCompletedTwiceToday(logs, inst.id)}
                  timedMinutesToday={getTimedMinutesToday(logs, inst.id)}
                  onCheckbox={() => handleCheckbox(inst.id)}
                  onPlus={() => openMinuteSheet(inst.id, 'log')}
                  onPlay={() => {
                    const p = getPractice(inst.practiceId);
                    if (p?.type === 'timed') openMinuteSheet(inst.id, 'play');
                    else handlePlayGuided(inst.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-[26px]">
          <button
            type="button"
            onClick={() => navigate('/practice-so-far')}
            className="w-full text-left"
          >
            <p className="section-header mb-3">My Practice Progress</p>
            <div className="bg-card rounded-[14px] p-4 border border-hairline">
              <ProgressStatBoxes logs={logs} />
              <WeekProgressGrid logs={logs} maxRows={5} compact />
            </div>
          </button>
        </section>
      </div>

      <BottomSheet open={!!minuteSheet} onClose={() => setMinuteSheet(null)} title="Add minutes">
        <p className="text-label text-secondary mb-4">
          This value applies to one session of this practice.
        </p>
        <MinutePicker value={selectedMinutes} onChange={setSelectedMinutes} defaultValue={selectedMinutes} />
        <Button fullWidth className="mt-4" onClick={handleConfirmMinutes}>Confirm</Button>
      </BottomSheet>
    </div>
  );
}
