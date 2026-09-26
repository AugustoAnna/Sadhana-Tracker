#!/usr/bin/env bash
# Pulls the study-environment rows we need for funnel analysis into
# analysis/data/*.csv (gitignored — contains participant names).
#
# Uses the already-linked Supabase CLI (read-only `supabase db query`), so no
# DB password or service-role key is ever handled here.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=analysis/data
mkdir -p "$OUT"

run() {
  local name="$1" sql="$2"
  echo "pulling $name..."
  supabase db query --linked --output json "$sql" 2>/dev/null \
    | python3 -c "
import json, sys, csv
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except ValueError:
    # The CLI prints errors to stderr (hidden); fail this run() cleanly.
    print('  -> query failed')
    sys.exit(1)
rows = data['rows']
path = 'analysis/data/${name}.csv'
if not rows:
    open(path, 'w').close()
else:
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
print(f'  -> {len(rows)} rows')
"
}

run participants "select id, name, platform, installed_standalone, notification_permission, segment, timezone, merged_into, created_at from participants where environment = 'study'"

run practices "select id, name, kind, sort_order from practices"

run participant_practices "select participant_id, practice_id, instance, created_at from participant_practices where environment = 'study'"

run reminders "select participant_id, kind, slot, practice_id, time_local, enabled from reminders where environment = 'study'"

run practice_completed "select participant_id, practice_id, instance, minutes, mode, was_offline, local_date, occurred_at from practice_completed where environment = 'study'"

run events "select participant_id, name, properties, occurred_at, local_date from events where environment = 'study'"

# Device rows only — never the endpoint or keys, which are all a sender needs.
run push_subscriptions "select id, participant_id, created_at from push_subscriptions where environment = 'study'"

# Written by the send-reminders function once migration 005 is applied.
run reminder_sends "select id, participant_id, reminder_id, subscription_id, kind, slot, practice_id, time_local, local_date, status, status_code, sent_at, delivered_at, tapped_at from reminder_sends where environment = 'study'" \
  || echo "  (reminder_sends not migrated yet - skipped)"

echo "done -> $OUT"
