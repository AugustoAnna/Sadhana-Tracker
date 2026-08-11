import { useMemo } from 'react';
import type { PracticeLog } from '@/types';
import { getTotalDaysPracticed, getTotalMinutes, getCurrentStreak } from '@/utils/dates';
import {
  buildMonthCalendar,
  CALENDAR_CELL_PX,
  CALENDAR_GAP_PX,
  CALENDAR_GUTTER_PX,
  COLOR_TODAY_RING,
  HEAT_BAND_COLORS,
  cellAccessibleName,
} from '@/utils/monthCalendar';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROW_HEIGHT = CALENDAR_CELL_PX + CALENDAR_GAP_PX;
const GRID_HEIGHT = CALENDAR_CELL_PX * 7 + CALENDAR_GAP_PX * 6;

interface PracticeCalendarProps {
  logs: PracticeLog[];
}

export function PracticeCalendar({ logs }: PracticeCalendarProps) {
  const data = useMemo(() => buildMonthCalendar(logs), [logs]);
  const gridWidth = data.columns * CALENDAR_CELL_PX + (data.columns - 1) * CALENDAR_GAP_PX;

  return (
    <div className="mt-2">
      <div
        className="flex overflow-x-auto overflow-y-hidden no-scrollbar"
        style={{ height: 24 + GRID_HEIGHT }}
        role="grid"
        tabIndex={0}
        aria-label={`${data.monthLabel} practice calendar`}
      >
        <div
          className="flex flex-col justify-between shrink-0 pr-1"
          style={{ width: CALENDAR_GUTTER_PX, height: GRID_HEIGHT, marginTop: 24 }}
        >
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className="text-[13px] font-medium text-[#1C1C1C] leading-none text-center"
              style={{ height: CALENDAR_CELL_PX }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="shrink-0" style={{ width: gridWidth }}>
          <p className="text-[15px] font-semibold text-[#1C1C1C] mb-1 h-6">{data.monthLabel}</p>
          <div
            className="relative"
            style={{ width: gridWidth, height: GRID_HEIGHT }}
          >
            {data.cells.map((cell) => (
              <div
                key={cell.date}
                role="gridcell"
                aria-label={cellAccessibleName(cell)}
                className="absolute rounded-[9px]"
                style={{
                  width: CALENDAR_CELL_PX,
                  height: CALENDAR_CELL_PX,
                  left: cell.column * ROW_HEIGHT,
                  top: cell.row * ROW_HEIGHT,
                  backgroundColor: cell.fill,
                  boxShadow: cell.isToday ? `inset 0 0 0 2px ${COLOR_TODAY_RING}` : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-meta text-secondary">0</span>
        <div className="flex flex-1 h-2 rounded overflow-hidden">
          {HEAT_BAND_COLORS.map((color, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-meta text-secondary">240+</span>
      </div>
    </div>
  );
}

export function ProgressStatBoxes({ logs }: { logs: PracticeLog[] }) {
  const totalDays = getTotalDaysPracticed(logs);
  const totalMinutes = getTotalMinutes(logs);
  const streak = getCurrentStreak(logs);

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{totalDays}</p>
        <p className="text-label text-secondary mt-1 whitespace-nowrap">Total days</p>
      </div>
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{streak}</p>
        <p className="text-label text-secondary mt-1 whitespace-nowrap">Streak</p>
      </div>
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{totalMinutes}</p>
        <p className="text-label text-secondary mt-1 whitespace-nowrap">Total minutes</p>
      </div>
    </div>
  );
}
