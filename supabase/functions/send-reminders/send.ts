// The send loop of send-reminders, kept apart from the HTTP handler and the
// web-push setup in index.ts so it can be tested outside Deno.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { backtrackPayload, backtrackWindow, isFirstMorningGeneric } from "./backtrack.ts";

/** webPush.sendNotification, passed in so tests can stand in for it. */
export type PushFn = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { TTL: number },
) => Promise<{ statusCode: number }>;

// A reminder is due from its time_local until this many minutes after it. The
// cron fires every minute, so normally the first run inside the window sends;
// if a run is late or the function errors, the following runs still catch it
// instead of the occurrence being lost for the day. reminder_sends'
// once-per-occurrence index is what stops the later runs from sending twice.
const CATCH_UP_WINDOW_MINUTES = 10;

// Web push discards the message if the device doesn't come online within TTL.
// Match the catch-up window: a reminder delivered much later than that is
// worse than none.
const PUSH_TTL_SECONDS = CATCH_UP_WINDOW_MINUTES * 60;

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  environment: string;
};

type ParticipantRow = {
  id: string;
  timezone: string | null;
  push_subscriptions: PushSubscriptionRow[];
};

export type ReminderRow = {
  id: string;
  kind: string;
  slot: number | null;
  practice_id: string | null;
  time_local: string;
  environment: string;
  participants: ParticipantRow;
};

type LocalClock = { minuteOfDay: number; date: string };

// The participant's wall-clock minute and calendar date, e.g. { 405, "2026-09-19" }.
function getLocalClock(timezone: string, now: Date): LocalClock | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    // Some engines still print midnight as "24" despite h23.
    const hour = parseInt(get("hour")) % 24;
    const minute = parseInt(get("minute"));
    return {
      minuteOfDay: hour * 60 + minute,
      date: `${get("year")}-${get("month")}-${get("day")}`,
    };
  } catch {
    // Unknown IANA zone stored on the participant.
    return null;
  }
}

function parseTimeLocal(timeLocal: string): number {
  // "HH:MM:SS" or "HH:MM"
  const [h, m] = timeLocal.split(":").map(Number);
  return h * 60 + m;
}

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Which occurrence of the reminder, if any, is currently inside the catch-up
// window. Handles the window crossing midnight (reminder 23:55, now 00:03):
// the occurrence then belongs to yesterday's local date.
function dueOccurrence(reminderMinute: number, clock: LocalClock): string | null {
  const sinceToday = clock.minuteOfDay - reminderMinute;
  if (sinceToday >= 0 && sinceToday < CATCH_UP_WINDOW_MINUTES) return clock.date;
  const sinceYesterday = sinceToday + 24 * 60;
  if (sinceYesterday >= 0 && sinceYesterday < CATCH_UP_WINDOW_MINUTES) {
    return shiftDate(clock.date, -1);
  }
  return null;
}

type SendOutcome = "sent" | "failed" | "expired" | "duplicate";

async function sendOne(
  supabase: SupabaseClient,
  push: PushFn,
  reminder: ReminderRow,
  participant: ParticipantRow,
  subscription: PushSubscriptionRow,
  localDate: string,
  // Asked only after the claim succeeds (later runs inside the catch-up
  // window hit the duplicate and never pay for it): whether this occurrence
  // carries the backtracking push instead.
  decideBacktrack: () => Promise<{ yesterday: string } | null>,
): Promise<{ outcome: SendOutcome; backtrack: boolean }> {
  // Claim the occurrence first. If another run already holds a pending/sent
  // row for this (reminder, device, day) the unique index rejects the insert
  // and we skip — that is the idempotency guarantee, not the time check.
  const { data: claimed, error: claimError } = await supabase
    .from("reminder_sends")
    .insert({
      participant_id: participant.id,
      reminder_id: reminder.id,
      subscription_id: subscription.id,
      environment: reminder.environment,
      kind: reminder.kind,
      slot: reminder.slot,
      practice_id: reminder.practice_id,
      time_local: reminder.time_local,
      local_date: localDate,
      status: "pending",
    })
    .select("id")
    .single();

  if (claimError || !claimed) {
    // 23505 = unique_violation: already sent (or in flight) for this occurrence.
    if (claimError?.code === "23505") return { outcome: "duplicate", backtrack: false };
    console.error("reminder_sends insert error:", claimError);
    // Without a row we have no idempotency guard, so do not push.
    return { outcome: "failed", backtrack: false };
  }

  const backtrackFor = await decideBacktrack();
  // Recorded with the result, so the claim needs no extra round trip.
  const sendKind = backtrackFor ? { kind: "backtrack" } : {};

  const isPresence = reminder.practice_id === "sadhguru-presence";
  // Flat payload — the service worker push handler reads slot/kind/send_id
  // from the top level of the payload JSON. send_id is what the worker echoes
  // back through mark_reminder_delivered / mark_reminder_tapped.
  const payload = backtrackFor
    ? backtrackPayload(reminder.slot, claimed.id, backtrackFor.yesterday)
    : JSON.stringify({
      title: isPresence ? "Presence time" : "Time to practice",
      body: isPresence
        ? "Presence time is starting soon."
        : "Your practice reminder is here.",
      tag: `reminder-${reminder.id}`,
      slot: reminder.slot,
      kind: reminder.kind,
      practice_id: reminder.practice_id,
      send_id: claimed.id,
    });

  try {
    const result = await push(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      { TTL: PUSH_TTL_SECONDS },
    );
    await supabase
      .from("reminder_sends")
      .update({ status: "sent", status_code: result.statusCode, ...sendKind })
      .eq("id", claimed.id);
    return { outcome: "sent", backtrack: !!backtrackFor };
  } catch (pushError: any) {
    const statusCode: number | null = pushError?.statusCode ?? null;
    // 410 Gone / 404 Not Registered: the device unsubscribed or the browser
    // rotated the subscription. Drop it so we stop pushing to a dead endpoint
    // (reminder_sends.subscription_id becomes null via on delete set null).
    const expired = statusCode === 410 || statusCode === 404;
    await supabase
      .from("reminder_sends")
      .update({
        status: expired ? "expired" : "failed",
        status_code: statusCode,
        ...sendKind,
        error: String(pushError?.body ?? pushError?.message ?? pushError).slice(0, 500),
      })
      .eq("id", claimed.id);
    if (expired) {
      await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      return { outcome: "expired", backtrack: false };
    }
    console.error("Push error:", statusCode, pushError?.message);
    return { outcome: "failed", backtrack: false };
  }
}

// Whether the participant should get the backtracking push on local day
// `today`: never sent before, has a practice list, nothing logged yesterday,
// but something logged in the six days before that (D-7 to D-2). Any query error answers
// no, so the normal reminder goes out instead.
async function backtrackEligible(
  supabase: SupabaseClient,
  participantId: string,
  today: string,
): Promise<boolean> {
  const { yesterday, from, to } = backtrackWindow(today);
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("backtrack_push_sent_at")
    .eq("id", participantId)
    .single();
  if (participantError || !participant || participant.backtrack_push_sent_at) return false;

  const { count: practices, error: practicesError } = await supabase
    .from("participant_practices")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId);
  if (practicesError || !practices) return false;

  const { count: loggedYesterday, error: yesterdayError } = await supabase
    .from("practice_completed")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .eq("local_date", yesterday);
  if (yesterdayError || loggedYesterday) return false;

  const { count: loggedThatWeek, error: weekError } = await supabase
    .from("practice_completed")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .gte("local_date", from)
    .lte("local_date", to);
  return !weekError && !!loggedThatWeek;
}

/**
 * Sends every reminder occurrence due at `now`. `reminders` is every enabled
 * reminder with its participant and their devices, not only the due ones.
 */
export async function sendDueReminders(
  supabase: SupabaseClient,
  reminders: ReminderRow[],
  { now, backtrackEnabled, push }: { now: Date; backtrackEnabled: boolean; push: PushFn },
) {
  const counts = {
    sent: 0,
    failed: 0,
    // subscriptions removed after a 404/410 (kept as `deleted` for the
    // dashboard queries in setup_cron.sql)
    deleted: 0,
    // occurrences already claimed by an earlier run inside the window
    duplicate: 0,
    // enabled reminders whose participant has no usable timezone — these
    // can never be sent, so a non-zero value here is a data problem
    skipped_no_timezone: 0,
    // sends that carried the one-time backtracking push (also in `sent`)
    backtrack: 0,
  };

  // Every enabled reminder per participant, to find their first morning one.
  const remindersByParticipant = new Map<string, ReminderRow[]>();
  for (const r of reminders) {
    const pid = r.participants?.id;
    if (!pid) continue;
    remindersByParticipant.set(pid, [...(remindersByParticipant.get(pid) ?? []), r]);
  }
  // One eligibility answer per participant and day within a run: the first
  // accepted send stamps the participant, and their other devices must
  // still get the same message rather than re-check and see "already sent".
  const eligibility = new Map<string, Promise<boolean>>();

  for (const reminder of reminders) {
    const participant = reminder.participants;

    const clock = participant?.timezone ? getLocalClock(participant.timezone, now) : null;
    if (!clock) {
      counts.skipped_no_timezone++;
      continue;
    }

    const localDate = dueOccurrence(parseTimeLocal(reminder.time_local), clock);
    if (!localDate) continue;

    // A participant can have several devices; only push to subscriptions
    // registered in the same environment as the reminder (lab vs study).
    const subscriptions = (participant.push_subscriptions ?? []).filter(
      (sub) => sub.environment === reminder.environment,
    );

    const mayBacktrack = backtrackEnabled
      && isFirstMorningGeneric(reminder, remindersByParticipant.get(participant.id) ?? []);
    const decideBacktrack = async () => {
      if (!mayBacktrack) return null;
      const key = `${participant.id}:${localDate}`;
      if (!eligibility.has(key)) {
        eligibility.set(key, backtrackEligible(supabase, participant.id, localDate));
      }
      return (await eligibility.get(key)) ? { yesterday: backtrackWindow(localDate).yesterday } : null;
    };

    for (const subscription of subscriptions) {
      const { outcome, backtrack } = await sendOne(
        supabase, push, reminder, participant, subscription, localDate, decideBacktrack,
      );
      if (outcome === "expired") counts.deleted++;
      else counts[outcome]++;
      if (backtrack && outcome === "sent") {
        counts.backtrack++;
        // Once per person, ever. Only the first accepted send stamps it.
        const { error: stampError } = await supabase
          .from("participants")
          .update({ backtrack_push_sent_at: new Date().toISOString() })
          .eq("id", participant.id)
          .is("backtrack_push_sent_at", null);
        if (stampError) {
          // The push went out but isn't recorded: it could go out again on
          // a later morning that matches the same pattern.
          console.error("backtrack_push_sent_at stamp failed:", participant.id, stampError.message);
        }
      }
    }
  }

  return counts;
}
