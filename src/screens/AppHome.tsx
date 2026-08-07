import { useNavigate } from 'react-router-dom';
import { ProgressRing, WeekStrip } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { computeJourneyProgress } from '@/data/journey';
import { getTotalMinutes, getTotalDaysPracticed, getPracticesCompletedToday, getWeekDays, getMinutesForDay } from '@/utils/dates';

export function AppHome() {
  const navigate = useNavigate();
  const logs = useAppStore((s) => s.logs);
  const instances = useAppStore((s) => s.instances);

  if (instances.length === 0) return null;

  const totalMinutes = getTotalMinutes(logs);
  const journey = computeJourneyProgress(totalMinutes);
  const daysPracticed = getTotalDaysPracticed(logs);
  const completedToday = getPracticesCompletedToday(logs);
  const weekDays = getWeekDays().map((date) => ({
    date,
    minutes: getMinutesForDay(logs, date),
  }));
  const weekMinutes = weekDays.reduce((s, d) => s + d.minutes, 0);

  return (
    <div className="h-full overflow-y-auto bg-cream">
      {/* Static Sadhguru App home placeholder */}
      <div className="bg-header text-white px-4 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm opacity-70">Namaskaram</p>
            <p className="font-serif text-xl">{useAppStore.getState().profile?.name ?? ''}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20" />
        </div>
        <div className="w-full h-40 rounded-2xl bg-white/10 flex items-center justify-center">
          <p className="text-white/40 text-sm">Sadhguru App Home (placeholder)</p>
        </div>
      </div>

      {/* Practices card */}
      <div className="px-4 -mt-4">
        <button
          onClick={() => navigate('/practice-home')}
          className="w-full bg-white rounded-2xl p-5 shadow-sm text-left active:bg-gray-50"
        >
          <p className="text-xs font-semibold tracking-widest text-journey uppercase mb-4">Practices</p>
          <div className="flex items-center gap-4 mb-4">
            <ProgressRing progress={journey.progressInLevel} level={journey.currentLevel} />
            <div className="flex-1">
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold">{daysPracticed}</p>
                  <p className="text-xs text-secondary">days practiced</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedToday}</p>
                  <p className="text-xs text-secondary">completed today</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <WeekStrip days={weekDays} />
            <p className="text-sm font-semibold text-secondary">{weekMinutes} min</p>
          </div>
        </button>
      </div>
    </div>
  );
}
