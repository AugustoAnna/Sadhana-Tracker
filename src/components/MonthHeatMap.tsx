import { getHeatMapColor } from '@/data/constants';
import type { MonthHeatMapDay } from '@/utils/heatmap';

interface MonthHeatMapProps {
  days: MonthHeatMapDay[];
}

export function MonthHeatMap({ days }: MonthHeatMapProps) {
  const cellSize = 28;
  const gap = 4;
  const needsScroll = days.length * (cellSize + gap) > 320;

  return (
    <div className={`${needsScroll ? 'overflow-x-auto no-scrollbar' : ''}`}>
      <div
        className="flex"
        style={{ gap, minWidth: needsScroll ? days.length * (cellSize + gap) : undefined }}
      >
        {days.map((day) => {
          const { color, empty } = getHeatMapColor(day.minutes);
          return (
            <div
              key={day.date}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: color,
                borderRadius: 4,
                border: empty && day.minutes === 0 ? '1px solid var(--color-border)' : 'none',
              }}
              aria-label={`${day.dayOfMonth}: ${day.minutes} minutes`}
              title={`${day.dayOfMonth}: ${day.minutes} min`}
            />
          );
        })}
      </div>
    </div>
  );
}
