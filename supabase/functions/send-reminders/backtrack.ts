// The one-time backtracking push: which reminder it replaces, and what it
// says. Pure and import-free so it can be unit-tested outside Deno.

export type MorningReminder = {
  id: string;
  kind: string;
  time_local: string;
  environment: string;
};

// The push only replaces a reminder before noon.
const MORNING_CUTOFF_MINUTE = 12 * 60;

function minuteOf(timeLocal: string): number {
  const [h, m] = timeLocal.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Whether `reminder` is the participant's first enabled generic reminder
 * before noon — the one the backtracking push stands in for. `enabled` is
 * every enabled reminder of that participant. Ties on time go to the lower
 * id, so exactly one reminder qualifies.
 */
export function isFirstMorningGeneric(reminder: MorningReminder, enabled: MorningReminder[]): boolean {
  const morning = (r: MorningReminder) =>
    r.kind === "generic"
    && r.environment === reminder.environment
    && minuteOf(r.time_local) < MORNING_CUTOFF_MINUTE;
  if (!morning(reminder)) return false;
  const first = enabled
    .filter(morning)
    .sort((a, b) => minuteOf(a.time_local) - minuteOf(b.time_local) || a.id.localeCompare(b.id))[0];
  return first?.id === reminder.id;
}

/**
 * Which environments get the push, from the BACKTRACK_PUSH_ENABLED secret:
 * a comma-separated list such as "lab" or "lab,study". Unset or empty means
 * none. Anything else (e.g. "true") matches no environment, so the study is
 * only ever included by naming it.
 */
export function pushEnvironments(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

/** The days the eligibility check looks at, around local day `today`. */
export function backtrackWindow(today: string): { yesterday: string; from: string; to: string } {
  return {
    yesterday: shiftDay(today, -1),
    from: shiftDay(today, -7),
    to: shiftDay(today, -2),
  };
}

export function backtrackPayload(slot: number | null, sendId: string, yesterday: string): string {
  return JSON.stringify({
    title: "Yesterday can still count",
    body: "Practiced yesterday? Add it to your record.",
    kind: "backtrack",
    tag: "backtrack",
    slot,
    send_id: sendId,
    url: `/practice-home?day=yesterday&via=push&for=${yesterday}`,
  });
}

function shiftDay(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
