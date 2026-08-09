import { useRef } from 'react';
import { BackHeader, HeatMap } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { getTotalMinutes, getTotalDaysPracticed, getCurrentStreak, formatMinutes } from '@/utils/dates';
import { getWeeksWithData } from '@/utils/heatmap';
import { HEAT_MAP_COLORS } from '@/data/constants';

export function PracticeSoFar() {
  const logs = useAppStore((s) => s.logs);
  const weekListRef = useRef<HTMLDivElement>(null);

  const totalMinutes = getTotalMinutes(logs);
  const daysPracticed = getTotalDaysPracticed(logs);
  const streak = getCurrentStreak(logs);
  const weeks = getWeeksWithData(logs);
  const heatMapWeeks = weeks.map((w) => ({
    weekStart: w.weekStart,
    monthLabel: w.label,
    days: w.days.map((d, i) => ({ ...d, dayOfWeek: i })),
  }));

  const maxMinutes = Math.max(...weeks.map((w) => w.totalMinutes), 1);

  const handleDotTap = (weekStart: string) => {
    const el = document.getElementById(`week-${weekStart}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('bg-amber-50');
    setTimeout(() => el?.classList.remove('bg-amber-50'), 1500);
  };

  return (
    <div className="h-full overflow-y-auto pb-8">
      <BackHeader title="Your practice so far" />

      <div className="px-4">
        {/* Stats */}
        <div className="flex gap-6 mb-6">
          <div>
            <p className="text-2xl font-bold">{daysPracticed}</p>
            <p className="text-xs text-secondary">days practiced</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-secondary">day streak</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatMinutes(totalMinutes)}</p>
            <p className="text-xs text-secondary">total minutes</p>
          </div>
        </div>

        {/* Line chart */}
        <div className="mb-6">
          <p className="text-xs text-secondary mb-2">Minutes per week</p>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex items-end gap-1 min-w-max h-32 px-2">
              {weeks.map((week, i) => {
                const height = (week.totalMinutes / maxMinutes) * 100;
                const isLast = i === weeks.length - 1;
                return (
                  <button
                    key={week.weekStart}
                    onClick={() => handleDotTap(week.weekStart)}
                    className="flex flex-col items-center"
                    style={{ width: 32 }}
                  >
                    <div className="flex-1 flex items-end w-full">
                      {i > 0 && (
                        <div
                          className="absolute"
                          style={{
                            borderTop: isLast ? '2px dashed #C4783A' : '2px solid #C4783A',
                            width: 32,
                          }}
                        />
                      )}
                      <div
                        className="w-2 h-2 rounded-full bg-journey mx-auto"
                        style={{ marginBottom: height }}
                      />
                    </div>
                    <p className="text-[9px] text-muted mt-1">{week.label}</p>
                    <p className="text-[9px] font-medium">{week.totalMinutes}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Week by week list */}
        <div ref={weekListRef}>
          {[...weeks].reverse().map((week) => (
            <div key={week.weekStart} id={`week-${week.weekStart}`} className="mb-4 rounded-xl transition-colors">
              <p className="text-xs text-muted mb-1">{week.label}</p>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {week.days.map((day) => {
                    const band = HEAT_MAP_COLORS.find(
                      (b) => day.minutes >= b.min && day.minutes <= b.max,
                    );
                    return (
                      <div
                        key={day.date}
                        className="w-6 h-6 rounded"
                        style={{
                          backgroundColor: band?.color ?? '#fff',
                          border: band?.empty ? '1px solid #E5E0D5' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-sm font-medium ml-auto">{week.totalMinutes} min</span>
              </div>
            </div>
          ))}
        </div>

        {/* Heat map */}
        <div className="mt-6 mb-4">
          <HeatMap weeks={heatMapWeeks} />
        </div>

        {/* Legend */}
        <div className="mt-4 mb-8">
          <p className="text-xs text-secondary mb-2">Minutes practiced</p>
          <div className="flex gap-0.5">
            {HEAT_MAP_COLORS.filter((b) => !b.empty).map((band) => (
              <div
                key={band.min}
                className="flex-1 h-4 first:rounded-l last:rounded-r"
                style={{ backgroundColor: band.color }}
                title={`${band.min}${band.max === Infinity ? '+' : `–${band.max}`} min`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted mt-1">
            <span>1</span>
            <span>240+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
