import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PracticeLog } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { COPY } from '@/copy/strings';
import { heatmapShades } from '@/data/heatmap';
import { useThemeStore } from '@/services/theme';
import { getTotalDaysPracticed, getTotalMinutes, getCurrentStreak } from '@/utils/dates';
import {
  buildCalendarMonths,
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

function MonthBlock({ month }: { month: MonthCalendarData }) {
  const gridCols = month.columns;
  const gridWidth = gridCols * CALENDAR_CELL_PX + (gridCols - 1) * CALENDAR_GAP_PX;

  return (
    <div style={{ width: gridWidth, flex: '0 0 auto' }}>
      <p
        className="text-[15px] font-semibold text-ink whitespace-nowrap"
        style={{ height: LABEL_ROW_HEIGHT, lineHeight: `${LABEL_ROW_HEIGHT}px` }}
      >
        {month.monthLabel}
      </p>

      <div
        role="grid"
        aria-label={`${month.monthLabel} practice calendar`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, ${CALENDAR_CELL_PX}px)`,
          gridTemplateRows: `repeat(7, ${CALENDAR_CELL_PX}px)`,
          columnGap: CALENDAR_GAP_PX,
          rowGap: CALENDAR_GAP_PX,
          marginTop: CALENDAR_GAP_PX,
        }}
      >
        {month.cells.map((cell) => (
          <div
            key={cell.date}
            role="gridcell"
            aria-label={cellAccessibleName(cell)}
            className="rounded-[6px]"
            style={{
              gridColumn: cell.column + 1,
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
  // currentDay is a dependency, not an input: the grid has to be rebuilt when
  // the calendar day rolls over so today's ring and heat move with it.
  const currentDay = useAppStore((s) => s.currentDay);
  const theme = useThemeStore((s) => s.theme);
  const months = useMemo(() => buildCalendarMonths(logs, new Date(), theme), [logs, currentDay, theme]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Past months live to the left, so the strip opens pinned to the current one.
  const pinnedToEnd = useRef(true);

  const pinToEnd = () => {
    const el = scrollRef.current;
    if (el && pinnedToEnd.current) el.scrollLeft = el.scrollWidth;
  };

  // Right away when the month count changes (logs restored from the server)…
  useLayoutEffect(pinToEnd, [months.length]);

  // …and again after the first paint and whenever the strip changes size:
  // WebKit can drop an offset set before the strip's first layout, and late
  // layout (fonts, a page drawn only once foregrounded) can widen it after.
  // Never once the user has scrolled back to an earlier month themselves.
  useEffect(() => {
    const strip = scrollRef.current?.firstElementChild;
    if (!strip) return;
    const frame = requestAnimationFrame(pinToEnd);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pinToEnd);
    observer?.observe(strip);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedToEnd.current = el.scrollWidth - el.clientWidth - el.scrollLeft < CALENDAR_CELL_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="mt-2 pb-1">
      <div className="flex" style={{ minHeight: TOTAL_HEIGHT }}>
        <div style={{ flex: '0 0 auto', width: CALENDAR_GUTTER_PX, marginRight: CALENDAR_GAP_PX }}>
          <div style={{ height: LABEL_ROW_HEIGHT }} />
          <div
            aria-hidden="true"
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(7, ${CALENDAR_CELL_PX}px)`,
              rowGap: CALENDAR_GAP_PX,
              marginTop: CALENDAR_GAP_PX,
            }}
          >
            {DAY_LABELS.map((label, row) => (
              <span
                key={`label-${row}`}
                className="text-[13px] font-medium text-ink flex items-center justify-center"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-visible no-scrollbar"
          tabIndex={0}
          role="group"
          aria-label="Practice calendar, scroll left for earlier months"
        >
          <div className="flex" style={{ gap: CALENDAR_MONTH_GAP_PX, width: 'max-content' }}>
            {months.map((month) => (
              <MonthBlock key={month.monthKey} month={month} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-meta text-secondary">{COPY.progress.legend.less}</span>
        <div className="flex flex-1 gap-[2px]" style={{ height: 12 }}>
          {heatmapShades(theme).map((color, i) => (
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
