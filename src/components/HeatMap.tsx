import { getHeatMapColor } from '@/data/constants';
import { format, parseISO } from 'date-fns';

interface HeatMapProps {
  weeks: {
    weekStart: string;
    monthLabel?: string;
    days: { date: string; dayOfWeek: number; minutes: number }[];
  }[];
  compact?: boolean;
}

export function HeatMap({ weeks, compact = false }: HeatMapProps) {
  const cellSize = compact ? 10 : 14;
  const gap = 2;

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="inline-flex flex-col gap-1">
        {/* Month labels */}
        <div className="flex gap-[2px] ml-0" style={{ height: 16 }}>
          {weeks.map((week) => (
            <div
              key={week.weekStart}
              style={{ width: cellSize }}
              className="text-[9px] text-muted"
            >
              {week.monthLabel}
            </div>
          ))}
        </div>
        {/* 7 rows for days of week */}
        {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
          <div key={dow} className="flex" style={{ gap }}>
            {weeks.map((week) => {
              const day = week.days.find((d) => d.dayOfWeek === dow);
              if (!day) return <div key={week.weekStart} style={{ width: cellSize, height: cellSize }} />;
              const { color, empty } = getHeatMapColor(day.minutes);
              const dateLabel = format(parseISO(day.date), 'd MMM yyyy');
              return (
                <div
                  key={day.date}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: color,
                    borderRadius: 2,
                    border: empty ? '1px solid #E5E0D5' : 'none',
                    position: 'relative',
                  }}
                  aria-label={`${dateLabel}: ${day.minutes} minutes practiced`}
                  title={`${dateLabel}: ${day.minutes} min`}
                >
                  {empty && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
