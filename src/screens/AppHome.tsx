import { useNavigate } from 'react-router-dom';
import { ProgressRing, WeekStrip } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { computeJourneyProgress } from '@/data/journey';
import { getTotalMinutes, getTotalDaysPracticed, getPracticesCompletedToday, getWeekDays, getMinutesForDay } from '@/utils/dates';

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
  const weekDays = getWeekDays().map((date) => ({
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
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-meta font-semibold">
            {name.slice(0, 1).toUpperCase() || '·'}
          </div>
        </div>
        <div className="w-full h-36 rounded-[14px] bg-gradient-to-br from-ground/40 to-white/5 flex items-end p-4">
          <div>
            <p className="eyebrow text-white/70">Sadhguru App</p>
            <p className="font-serif text-title text-white/90 mt-1">Home</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5 pb-8">
        <button
          onClick={() => navigate('/practice-home')}
          className="w-full bg-card rounded-[14px] p-5 text-left active:opacity-95 shadow-sm"
        >
          <p className="eyebrow mb-4">Practices</p>
          <div className="flex items-center gap-4 mb-5">
            <ProgressRing progress={journey.progressInLevel} level={journey.currentLevel} />
            <div className="flex-1 flex gap-6">
              <div>
                <p className="text-stat">{daysPracticed}</p>
                <p className="text-label text-secondary">days practiced</p>
              </div>
              <div>
                <p className="text-stat">{completedToday}</p>
                <p className="text-label text-secondary">completed today</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-hairline">
            <WeekStrip days={weekDays} />
            <p className="text-meta text-secondary">{weekMinutes} min</p>
          </div>
        </button>
      </div>
    </div>
  );
}
