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
const LABEL_ROW_HEIGHT = 20;
const GRID_HEIGHT = CALENDAR_CELL_PX * 7 + CALENDAR_GAP_PX * 6;
const TOTAL_HEIGHT = LABEL_ROW_HEIGHT + CALENDAR_GAP_PX + GRID_HEIGHT;

interface PracticeCalendarProps {
  logs: PracticeLog[];
}

export function PracticeCalendar({ logs }: PracticeCalendarProps) {
  const data = useMemo(() => buildMonthCalendar(logs), [logs]);
  const gridCols = data.columns;
  const gridWidth = gridCols * CALENDAR_CELL_PX + (gridCols - 1) * CALENDAR_GAP_PX;

  return (
    <div className="mt-2 pb-1">
      <div
        className="overflow-x-auto overflow-y-visible no-scrollbar"
        role="grid"
        tabIndex={0}
        aria-label={`${data.monthLabel} practice calendar`}
      >
        <div style={{ width: CALENDAR_GUTTER_PX + CALENDAR_GAP_PX + gridWidth, minHeight: TOTAL_HEIGHT }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${CALENDAR_GUTTER_PX}px ${gridWidth}px`,
              columnGap: CALENDAR_GAP_PX,
            }}
          >
            <div />
            <p
              className="text-[15px] font-semibold text-[#1C1C1C]"
              style={{ height: LABEL_ROW_HEIGHT, lineHeight: `${LABEL_ROW_HEIGHT}px` }}
            >
              {data.monthLabel}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${CALENDAR_GUTTER_PX}px repeat(${gridCols}, ${CALENDAR_CELL_PX}px)`,
              gridTemplateRows: `repeat(7, ${CALENDAR_CELL_PX}px)`,
              columnGap: CALENDAR_GAP_PX,
              rowGap: CALENDAR_GAP_PX,
              marginTop: CALENDAR_GAP_PX,
            }}
          >
            {DAY_LABELS.map((label, row) => (
              <span
                key={`label-${row}`}
                className="text-[13px] font-medium text-[#1C1C1C] flex items-center justify-center"
                style={{ gridColumn: 1, gridRow: row + 1 }}
              >
                {label}
              </span>
            ))}

            {data.cells.map((cell) => (
              <div
                key={cell.date}
                role="gridcell"
                aria-label={cellAccessibleName(cell)}
                className="rounded-[6px]"
                style={{
                  gridColumn: cell.column + 2,
                  gridRow: cell.row + 1,
                  backgroundColor: cell.fill,
                  boxShadow: cell.isToday ? `inset 0 0 0 2px ${COLOR_TODAY_RING}` : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-meta text-secondary">0 min</span>
        <div className="flex flex-1 h-2 rounded overflow-hidden">
          {HEAT_BAND_COLORS.map((color, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-meta text-secondary">240+ min</span>
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
        <p className="text-label text-secondary mt-1 whitespace-nowrap">total days</p>
      </div>
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{streak}</p>
        <p className="text-label text-secondary mt-1 whitespace-nowrap">day streak</p>
      </div>
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{totalMinutes}</p>
        <p className="text-label text-secondary mt-1 whitespace-nowrap">total minutes</p>
      </div>
    </div>
  );
}
