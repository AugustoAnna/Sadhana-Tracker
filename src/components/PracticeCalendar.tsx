import { useMemo } from 'react';
import type { PracticeLog } from '@/types';
import { COPY } from '@/copy/strings';
import { HEATMAP_SHADES } from '@/data/heatmap';
import { getTotalDaysPracticed, getTotalMinutes, getCurrentStreak } from '@/utils/dates';
import {
  buildMonthCalendars,
  CALENDAR_CELL_PX,
  CALENDAR_GAP_PX,
  CALENDAR_GUTTER_PX,
  CALENDAR_MONTH_GAP_PX,
  COLOR_TODAY_RING,
  cellAccessibleName,
  type MonthCalendarData,
} from '@/utils/monthCalendar';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LABEL_ROW_HEIGHT = 20;
const GRID_HEIGHT = CALENDAR_CELL_PX * 7 + CALENDAR_GAP_PX * 6;
const TOTAL_HEIGHT = LABEL_ROW_HEIGHT + CALENDAR_GAP_PX + GRID_HEIGHT;

interface PracticeCalendarProps {
  logs: PracticeLog[];
}

function MonthBlock({ data }: { data: MonthCalendarData }) {
  const gridCols = data.columns;
  const gridWidth = gridCols * CALENDAR_CELL_PX + (gridCols - 1) * CALENDAR_GAP_PX;

  return (
    <div style={{ width: CALENDAR_GUTTER_PX + CALENDAR_GAP_PX + gridWidth, minHeight: TOTAL_HEIGHT, flexShrink: 0 }}>
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
            key={`label-${data.monthKey}-${row}`}
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
  );
}

export function PracticeCalendar({ logs }: PracticeCalendarProps) {
  const months = useMemo(() => buildMonthCalendars(logs), [logs]);

  return (
    <div className="mt-2 pb-1">
      <div
        className="overflow-x-auto overflow-y-visible no-scrollbar"
        role="grid"
        tabIndex={0}
        aria-label="Practice calendar"
      >
        <div className="flex" style={{ gap: CALENDAR_MONTH_GAP_PX }}>
          {months.map((month) => (
            <MonthBlock key={month.monthKey} data={month} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-meta text-secondary">{COPY.progress.legend.less}</span>
        <div className="flex flex-1 gap-[2px]" style={{ height: 12 }}>
          {HEATMAP_SHADES.map((color, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: color, borderRadius: 2, height: 12 }}
            />
          ))}
        </div>
        <span className="text-meta text-secondary">{COPY.progress.legend.more}</span>
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
