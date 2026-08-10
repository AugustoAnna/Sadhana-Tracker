import { useMemo } from 'react';
import type { PracticeLog } from '@/types';
import { getTotalDaysPracticed, getTotalMinutes, getCurrentStreak } from '@/utils/dates';

import {
  buildMonthCalendar,
  CALENDAR_CELL_PX,
  CALENDAR_GAP_PX,
  CALENDAR_BASE_COLOR,
  HEAT_BAND_COLORS,
} from '@/utils/monthCalendar';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROW_HEIGHT = CALENDAR_CELL_PX + CALENDAR_GAP_PX;
const GRID_HEIGHT = CALENDAR_CELL_PX * 7 + CALENDAR_GAP_PX * 6;

interface PracticeCalendarProps {
  logs: PracticeLog[];
}

export function PracticeCalendar({ logs }: PracticeCalendarProps) {
  const data = useMemo(() => buildMonthCalendar(logs), [logs]);

  return (
    <div className="mt-4">
      <div className="flex" style={{ height: 24 + GRID_HEIGHT }}>
        <div
          className="flex flex-col justify-around shrink-0 pr-2"
          style={{ width: 24, height: GRID_HEIGHT, marginTop: 24 }}
        >
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className="text-[14px] font-medium text-[#1C1C1C] leading-none text-center"
              style={{ height: CALENDAR_CELL_PX }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div className="inline-flex flex-col" style={{ minWidth: '100%' }}>
            <div className="flex mb-1" style={{ gap: CALENDAR_GAP_PX * 4 }}>
              {data.columns.map((_col, ci) => (
                <div key={ci} style={{ width: CALENDAR_CELL_PX }}>
                  {ci === 0 && (
                    <p className="text-[15px] font-semibold text-[#1C1C1C] whitespace-nowrap">
                      {data.monthLabel}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex" style={{ gap: CALENDAR_GAP_PX * 4 }}>
              {data.columns.map((col, ci) => (
                <div
                  key={ci}
                  className="relative shrink-0"
                  style={{ width: CALENDAR_CELL_PX, height: GRID_HEIGHT }}
                >
                  {col.cells.map((cell) => (
                    <div
                      key={cell.date}
                      role="gridcell"
                      aria-label={
                        cell.minutes > 0
                          ? `${cell.date}: ${cell.minutes} minutes practiced`
                          : `${cell.date}: no practice`
                      }
                      className="absolute rounded-[6px]"
                      style={{
                        width: CALENDAR_CELL_PX,
                        height: CALENDAR_CELL_PX,
                        top: cell.row * ROW_HEIGHT,
                        backgroundColor: cell.color,
                        border: cell.minutes === 0 ? `1px solid ${CALENDAR_BASE_COLOR}` : undefined,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
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
    <div className="grid grid-cols-3 gap-2 mb-4">
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
