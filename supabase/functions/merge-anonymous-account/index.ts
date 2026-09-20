// Merge an anonymous participant into the permanent account the caller just
// signed into.
//
// The app calls this right after `verifyOtp` succeeded for the email account,
// while it still holds the anonymous session's access token. Both JWTs are
// verified against Auth; only when the caller provably controls both accounts
// does the service role move the rows (see 007_merge_participants.sql).
//
// Request:  POST, Authorization: Bearer <permanent session access token>
//           { "anonymous_access_token": "<anonymous session access token>" }
// Response: { ok: true, moved: { moved_practices, moved_logs, ... } }
//           or { error: "<reason>" } with a 4xx/5xx status.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const targetJwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!targetJwt) return json({ error: "missing authorization" }, 401);

  let body: { anonymous_access_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  const anonJwt = body.anonymous_access_token;
  if (typeof anonJwt !== "string" || !anonJwt) {
    return json({ error: "anonymous_access_token required" }, 400);
  }

  const [target, source] = await Promise.all([
    admin.auth.getUser(targetJwt),
    admin.auth.getUser(anonJwt),
  ]);
  if (target.error || !target.data.user) return json({ error: "target session invalid" }, 401);
  if (source.error || !source.data.user) return json({ error: "anonymous session invalid" }, 401);

  const to = target.data.user;
  const from = source.data.user;
  if (!from.is_anonymous) return json({ error: "source account is not anonymous" }, 400);
  if (to.is_anonymous || !to.email) return json({ error: "target is not a permanent account" }, 400);
  if (from.id === to.id) {
    return json({ ok: true, moved: { moved_practices: 0, moved_logs: 0, moved_reminders: 0, moved_events: 0 } });
  }

  const { data, error } = await admin.rpc("merge_participants", {
    p_from_auth_user: from.id,
    p_to_auth_user: to.id,
  });
  if (error) {
    console.error("merge_participants failed", { from: from.id, to: to.id, error: error.message });
    return json({ error: "merge failed" }, 500);
  }

  const moved = Array.isArray(data) ? data[0] : data;
  console.log("merged anonymous account", { from: from.id, to: to.id, moved });
  return json({ ok: true, moved });
});
