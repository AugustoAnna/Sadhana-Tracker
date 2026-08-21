import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

// Configure web-push with VAPID keys
webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

function getCurrentTimeInTimezone(timezone: string): { hour: number; minute: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
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

    let sentCount = 0;
    let deletedCount = 0;

    for (const reminder of dueReminders ?? []) {
      const participant = reminder.participants as unknown as ParticipantRow;

      // Skip if no timezone set
      if (!participant?.timezone) continue;

      // Get current time in participant's timezone
      const { hour: currentHour, minute: currentMinute } = getCurrentTimeInTimezone(
        participant.timezone,
      );

      // Parse reminder time (format: "HH:MM:SS" or "HH:MM")
      const [reminderHour, reminderMinute] = reminder.time_local.split(":").map(Number);

      // Check if current time matches reminder time (within the current minute)
      if (currentHour !== reminderHour || currentMinute !== reminderMinute) continue;

      // A participant can have several devices; only push to subscriptions
      // registered in the same environment as the reminder (lab vs study).
      const subscriptions = (participant.push_subscriptions ?? []).filter(
        (sub) => sub.environment === reminder.environment,
      );

      // Flat payload — the service worker push handler reads slot/kind from
      // the top level of the payload JSON.
      const isPresence = reminder.practice_id === 'sadhguru-presence';
      const payload = JSON.stringify({
        title: isPresence ? 'Presence time' : 'Time to practice',
        body: isPresence
          ? "Sadhguru's presence time begins in two minutes."
          : 'Your practice reminder is here.',
        tag: `reminder-${reminder.id}`,
        slot: reminder.slot,
        kind: reminder.kind,
        practice_id: reminder.practice_id,
      });

      for (const subscription of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          };

          await webPush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (pushError: any) {
          // Handle expired subscriptions (410 Gone, 404 Not Registered)
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
            deletedCount++;
          } else {
            console.error("Push error:", pushError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, deleted: deletedCount }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
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
