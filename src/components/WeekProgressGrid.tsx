import { buildWeekProgressRows, getHeatColor, getTotalDays, getTotalMinutes, type WeekProgressRow } from '@/utils/weekProgress';

interface WeekProgressGridProps {
  logs: Parameters<typeof buildWeekProgressRows>[0];
  maxRows?: number;
  showLegend?: boolean;
  compact?: boolean;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekProgressGrid({ logs, maxRows, showLegend = false, compact = false }: WeekProgressGridProps) {
  const rows = buildWeekProgressRows(logs, maxRows);
  const showMinWeek = rows.some((r) => r.isComplete);
  const cellSize = compact ? 28 : 32;

  if (rows.length === 0) {
    return (
      <p className="text-label text-secondary">Your progress will appear here once you log a practice.</p>
    );
  }

  return (
    <div>
      <div
        className="grid gap-1 items-center mb-2"
        style={{ gridTemplateColumns: `4.5rem repeat(7, ${cellSize}px)${showMinWeek ? ' 3.5rem' : ''}` }}
      >
        <div />
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-meta text-secondary">{d}</div>
        ))}
        {showMinWeek && <div className="text-right text-meta text-secondary">min/week</div>}
      </div>

      {rows.map((row) => (
        <WeekRow key={row.weekStart} row={row} cellSize={cellSize} showMinWeek={showMinWeek} />
      ))}

      {showLegend && <HeatLegend />}
    </div>
  );
}

function WeekRow({ row, cellSize, showMinWeek }: { row: WeekProgressRow; cellSize: number; showMinWeek: boolean }) {
  return (
    <div
      className="grid gap-1 items-center py-1.5"
      style={{ gridTemplateColumns: `4.5rem repeat(7, ${cellSize}px)${showMinWeek ? ' 3.5rem' : ''}` }}
    >
      <div className="text-meta text-secondary pr-2 leading-tight">{row.label}</div>
      {row.days.map((day) => (
        <DayCell key={day.date} day={day} size={cellSize} />
      ))}
      {showMinWeek && (
        <div className="text-right text-meta">
          <div className="font-semibold text-ink">{row.weekMinutes}</div>
          {row.isCurrentWeek && <div className="text-secondary text-[10px]">so far</div>}
        </div>
      )}
    </div>
  );
}

function DayCell({ day, size }: { day: WeekProgressRow['days'][0]; size: number }) {
  const label = `${day.date}: ${day.minutes > 0 ? `${day.minutes} minutes practiced` : 'no practice'}`;

  if (day.state === 'before-tracking') {
    return (
      <div
        className="rounded-full bg-[#D1D5DB]"
        style={{ width: size, height: size }}
        aria-label={`${day.date}: before tracking began`}
        title={label}
      />
    );
  }

  if (day.state === 'no-practice') {
    return (
      <div
        className="rounded-full border border-[#E8E4DC] bg-[#FAF8F4] flex items-center justify-center text-[#C4BDB0]"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        aria-label={label}
        title={label}
      >
        ×
      </div>
    );
  }

  const color = getHeatColor(day.minutes);
  return (
    <div
      className="rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-label={label}
      title={label}
    />
  );
}

function HeatLegend() {
  const bands = [
    { label: '1–10', min: 5 },
    { label: '11–20', min: 15 },
    { label: '21–30', min: 25 },
    { label: '31–45', min: 38 },
    { label: '46–60', min: 53 },
    { label: '61–80', min: 70 },
    { label: '81–100', min: 90 },
    { label: '101–125', min: 113 },
    { label: '126–150', min: 138 },
    { label: '151–180', min: 165 },
    { label: '181–239', min: 210 },
    { label: '240+', min: 250 },
  ];
  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-hairline">
      {bands.map((b) => (
        <div key={b.label} className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getHeatColor(b.min) }} />
          <span className="text-[10px] text-secondary">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressStatBoxes({ logs }: { logs: Parameters<typeof buildWeekProgressRows>[0] }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="bg-card rounded-[14px] p-4 border border-hairline">
        <p className="text-stat text-ink">{getTotalDays(logs)}</p>
        <p className="text-label text-secondary mt-1">Total days</p>
      </div>
      <div className="bg-card rounded-[14px] p-4 border border-hairline">
        <p className="text-stat text-ink">{getTotalMinutes(logs)}</p>
        <p className="text-label text-secondary mt-1">Total minutes</p>
      </div>
    </div>
  );
}
