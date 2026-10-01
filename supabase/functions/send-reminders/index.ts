import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";
import { backtrackPayload, backtrackWindow, isFirstMorningGeneric, pushEnvironments } from "./backtrack.ts";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

// The one-time "Yesterday can still count" push, for the environments named
// in this secret ("lab", or "lab,study"). Unset means off. Needs migration 010
// (participants.backtrack_push_sent_at) first.
const BACKTRACK_PUSH_ENVIRONMENTS = pushEnvironments(Deno.env.get("BACKTRACK_PUSH_ENABLED"));

// Configure web-push with VAPID keys
webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

type ReminderRow = {
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
  reminder: ReminderRow,
  participant: ParticipantRow,
  subscription: PushSubscriptionRow,
  localDate: string,
  // Set when this occurrence carries the backtracking push instead.
  backtrackFor: { yesterday: string } | null,
): Promise<SendOutcome> {
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
      kind: backtrackFor ? "backtrack" : reminder.kind,
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
    if (claimError?.code === "23505") return "duplicate";
    console.error("reminder_sends insert error:", claimError);
    // Without a row we have no idempotency guard, so do not push.
    return "failed";
  }

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
    const result = await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      { TTL: PUSH_TTL_SECONDS },
    );
    await supabase
      .from("reminder_sends")
      .update({ status: "sent", status_code: result.statusCode })
      .eq("id", claimed.id);
    return "sent";
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
        error: String(pushError?.body ?? pushError?.message ?? pushError).slice(0, 500),
      })
      .eq("id", claimed.id);
    if (expired) {
      await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      return "expired";
    }
    console.error("Push error:", statusCode, pushError?.message);
    return "failed";
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

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all enabled reminders with their participants and push subscriptions.
    // push_subscriptions has no FK to reminders — it must be embedded through
    // participants (both tables reference participants.id).
    const { data: dueReminders, error: queryError } = await supabase
      .from("reminders")
      .select(`
        id,
        kind,
        slot,
        practice_id,
        time_local,
        environment,
        participants!inner (
          id,
          timezone,
          push_subscriptions!inner (
            id,
            endpoint,
            p256dh,
            auth,
            environment
          )
        )
      `)
      .eq("enabled", true);

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = new Date();
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
    for (const r of (dueReminders ?? []) as unknown as ReminderRow[]) {
      const pid = r.participants?.id;
      if (!pid) continue;
      remindersByParticipant.set(pid, [...(remindersByParticipant.get(pid) ?? []), r]);
    }
    // One eligibility answer per participant per run, so every device gets
    // the same message even after the first send marks the participant.
    const eligibility = new Map<string, Promise<boolean>>();

    for (const reminder of (dueReminders ?? []) as unknown as ReminderRow[]) {
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

      let backtrackFor: { yesterday: string } | null = null;
      if (
        BACKTRACK_PUSH_ENVIRONMENTS.has(reminder.environment)
        && subscriptions.length > 0
        && isFirstMorningGeneric(reminder, remindersByParticipant.get(participant.id) ?? [])
      ) {
        const key = `${participant.id}:${localDate}`;
        if (!eligibility.has(key)) {
          eligibility.set(key, backtrackEligible(supabase, participant.id, localDate));
        }
        if (await eligibility.get(key)) {
          backtrackFor = { yesterday: backtrackWindow(localDate).yesterday };
        }
      }

      for (const subscription of subscriptions) {
        const outcome = await sendOne(supabase, reminder, participant, subscription, localDate, backtrackFor);
        if (outcome === "expired") counts.deleted++;
        else counts[outcome]++;
        if (backtrackFor && outcome === "sent") {
          counts.backtrack++;
          // Once per person, ever. Only the first accepted send stamps it.
          await supabase
            .from("participants")
            .update({ backtrack_push_sent_at: new Date().toISOString() })
            .eq("id", participant.id)
            .is("backtrack_push_sent_at", null);
        }
      }
    }

    return new Response(JSON.stringify(counts), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
