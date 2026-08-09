import { useNavigate } from 'react-router-dom';
import { ProgressRing, WeekStrip } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { computeJourneyProgress } from '@/data/journey';
import { getTotalMinutes, getTotalDaysPracticed, getPracticesCompletedToday, getCurrentWeekDays, getMinutesForDay } from '@/utils/dates';

export function AppHome() {
  const navigate = useNavigate();
  const logs = useAppStore((s) => s.logs);
  const instances = useAppStore((s) => s.instances);
  const name = useAppStore((s) => s.profile?.name ?? '');

  if (instances.length === 0) return null;

  const totalMinutes = getTotalMinutes(logs);
  const journey = computeJourneyProgress(totalMinutes);
  const daysPracticed = getTotalDaysPracticed(logs);
  const completedToday = getPracticesCompletedToday(logs);
  const weekDays = getCurrentWeekDays().map((date) => ({
    date,
    minutes: getMinutesForDay(logs, date),
  }));
  const weekMinutes = weekDays.reduce((s, d) => s + d.minutes, 0);

  return (
    <div className="h-full overflow-y-auto bg-sunken">
      <div className="bg-header text-white px-4 pt-12 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-label text-white/70">Namaskaram</p>
            <p className="font-serif text-headline mt-0.5">{name}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5 pb-8">
        <button
          onClick={() => navigate('/practice-home')}
          className="w-full bg-card rounded-[14px] p-5 text-left active:opacity-95 shadow-sm"
        >
          <p className="font-serif text-title mb-4">Practices</p>

          <p className="eyebrow mb-3">Your progress</p>
          <div className="flex gap-4 mb-5">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="border border-hairline rounded-[12px] p-3">
                <p className="text-stat leading-tight">{daysPracticed}</p>
                <p className="text-label text-secondary mt-1 leading-snug">days practiced</p>
              </div>
              <div className="border border-hairline rounded-[12px] p-3">
                <p className="text-stat leading-tight">{completedToday}</p>
                <p className="text-label text-secondary mt-1 leading-snug">completed today</p>
              </div>
            </div>
            <ProgressRing progress={journey.progressInLevel} level={journey.currentLevel} />
          </div>

          <p className="eyebrow mb-2">This week</p>
          <div className="flex items-center justify-between pt-3 border-t border-hairline">
            <WeekStrip days={weekDays} />
            <p className="text-meta text-secondary">{weekMinutes} min</p>
          </div>
        </button>
      </div>
    </div>
  );
}
