import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";
import { sendDueReminders, type ReminderRow } from "./send.ts";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

// The one-time "Yesterday can still count" push. Off unless set to "true";
// needs migration 010 (participants.backtrack_push_sent_at) first.
const BACKTRACK_PUSH_ENABLED = Deno.env.get("BACKTRACK_PUSH_ENABLED") === "true";

// Configure web-push with VAPID keys
webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

    const counts = await sendDueReminders(supabase, (dueReminders ?? []) as unknown as ReminderRow[], {
      now: new Date(),
      backtrackEnabled: BACKTRACK_PUSH_ENABLED,
      push: (subscription, payload, options) => webPush.sendNotification(subscription, payload, options),
    });

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
