/** A day's two counters, as at the top of the tracker. */
export function DayStatCards({ completed, minutes }: { completed: number; minutes: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{completed}</p>
        <p className="text-label text-secondary mt-1">practices completed</p>
      </div>
      <div className="bg-card rounded-[14px] p-3 border border-hairline">
        <p className="text-stat text-ink">{minutes}</p>
        <p className="text-label text-secondary mt-1">minutes practiced</p>
      </div>
    </div>
  );
}
