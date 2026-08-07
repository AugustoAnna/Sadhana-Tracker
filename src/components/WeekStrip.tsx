import { getHeatMapColor } from '@/data/constants';
import { format, parseISO } from 'date-fns';

interface WeekStripProps {
  days: { date: string; minutes: number }[];
}

export function WeekStrip({ days }: WeekStripProps) {
  return (
    <div className="flex gap-1.5">
      {days.map((day) => {
        const { color, empty } = getHeatMapColor(day.minutes);
        const label = format(parseISO(day.date), 'EEE');
        return (
          <div key={day.date} className="flex flex-col items-center gap-1">
            <div
              className="w-7 h-7 rounded-[7px]"
              style={{
                backgroundColor: color,
                border: empty ? '1px solid var(--color-border)' : 'none',
              }}
              aria-label={`${label}: ${day.minutes} minutes`}
            />
            <span className="text-[10px] text-secondary">{label[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
