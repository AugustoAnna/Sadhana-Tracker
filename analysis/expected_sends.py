#!/usr/bin/env python3
"""
How many reminder pushes *should* the send-reminders function have sent?

Nothing recorded actual sends before migration 005 (reminder_sends), so this
reconstructs the expected count from what the function needs in order to send:

    an enabled reminder  x  a device with a push subscription  x  a local day

for every minute the function has been live. It is an estimate of intent, not
a measurement — read the caveats at the bottom before quoting it.

Method
  - Function live since FUNCTION_LIVE (first successful cron run; before that
    every run failed on a missing config parameter).
  - Devices: push_subscriptions rows. A device counts from its created_at.
    Subscriptions the push service reported dead (404/410) were deleted
    without a timestamp, so churned devices are invisible (undercount).
  - Reminder history: reminders rows hold current state only, so the enabled
    intervals are rebuilt per (participant, reminder key) from
    reminder_set / reminder_disabled events. Current state from the table is
    used as the final word: if the table says enabled but the last event says
    disabled (or there are no events), the reminder is treated as enabled from
    the earliest evidence we have — the participant_practices row for the
    Presence reminder, otherwise the participant's created_at.
  - One expected send per (device, reminder, local date) where the reminder was
    enabled at time_local on that date in the participant's timezone, the
    device already existed, and the moment is in the past.

Usage: analysis/.venv/bin/python analysis/expected_sends.py
"""
import csv
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone as dt_timezone
from pathlib import Path
from zoneinfo import ZoneInfo

DATA = Path(__file__).parent / "data"

# First cron run that reached the function (cron.job_run_details, status=succeeded).
FUNCTION_LIVE = datetime(2026, 8, 19, 15, 40, tzinfo=dt_timezone.utc)
NOW = datetime.now(dt_timezone.utc)

# The measured window for the cross-check: net._http_response kept exactly
# these six hours on 2026-09-19 and summed to sent=6 across five runs.
CHECK_WINDOW = (
    datetime(2026, 9, 19, 1, 15, tzinfo=dt_timezone.utc),
    datetime(2026, 9, 19, 7, 15, tzinfo=dt_timezone.utc),
)
CHECK_MEASURED = 6


def parse_ts(s: str) -> datetime:
    s = s.replace("Z", "+00:00")
    if s[-3] != ":" and (s[-5] in "+-"):  # "+00" -> "+00:00"
        s = s + ":00"
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=dt_timezone.utc)


def parse_props(s: str) -> dict:
    import ast
    try:
        return ast.literal_eval(s) if s else {}
    except (ValueError, SyntaxError):
        import json
        return json.loads(s) if s else {}


def load(name):
    with open(DATA / f"{name}.csv", newline="") as f:
        return list(csv.DictReader(f))


participants = {p["id"]: p for p in load("participants")}
reminders = load("reminders")
subs = load("push_subscriptions")
events = load("events")
practices = load("participant_practices")


def reminder_key(kind, slot, practice_id):
    return ("practice", practice_id) if kind == "practice" else ("generic", str(slot))


# --- Rebuild enabled intervals per (participant, reminder key) ----------------
# Each interval: (start, end_or_None, time_local "HH:MM")
Intervals = dict[tuple[str, tuple], list[tuple[datetime, datetime | None, str]]]


def build_intervals() -> Intervals:
    ev_by_key: dict[tuple, list] = defaultdict(list)
    for e in events:
        if e["name"] not in ("reminder_set", "reminder_disabled"):
            continue
        props = parse_props(e["properties"])
        key = reminder_key(props.get("kind", "generic"), props.get("slot"), props.get("practice_id"))
        ev_by_key[(e["participant_id"], key)].append((parse_ts(e["occurred_at"]), e["name"], props.get("time_local")))

    presence_added: dict[str, datetime] = {}
    for pp in practices:
        if pp["practice_id"] == "sadhguru-presence":
            t = parse_ts(pp["created_at"])
            presence_added[pp["participant_id"]] = min(t, presence_added.get(pp["participant_id"], t))

    intervals: Intervals = {}
    for r in reminders:
        pid = r["participant_id"]
        key = reminder_key(r["kind"], r["slot"], r["practice_id"])
        current_time = r["time_local"][:5]
        currently_enabled = r["enabled"] in ("True", "true", "t", "1")

        out: list[tuple[datetime, datetime | None, str]] = []
        open_start: datetime | None = None
        open_time = current_time
        for ts, name, tl in sorted(ev_by_key.get((pid, key), [])):
            if name == "reminder_set":
                if open_start is not None:          # time changed while enabled
                    out.append((open_start, ts, open_time))
                open_start, open_time = ts, (tl or current_time)[:5]
            else:
                if open_start is not None:
                    out.append((open_start, ts, open_time))
                    open_start = None

        if currently_enabled and open_start is None:
            # Enabled now but no event says so: take the earliest evidence.
            if key[0] == "practice":
                start = presence_added.get(pid)
            else:
                start = None
            if start is None:
                p = participants.get(pid)
                start = parse_ts(p["created_at"]) if p else FUNCTION_LIVE
            # If a disabled event exists after our start, it was re-enabled
            # somewhere we cannot see; start after the last disable.
            disables = [ts for ts, name, _ in ev_by_key.get((pid, key), []) if name == "reminder_disabled"]
            if disables and max(disables) > start:
                start = max(disables)
            open_start, open_time = start, current_time
        if not currently_enabled and open_start is not None:
            # Table says disabled but no event closed it: close it now-ish.
            out.append((open_start, NOW, open_time))
            open_start = None
        if open_start is not None:
            out.append((open_start, None, open_time))
        intervals[(pid, key)] = out
    return intervals


def occurrences(pid: str, ivs, device_from: datetime, lo: datetime, hi: datetime):
    """Yield the UTC datetimes at which a push was expected for one device."""
    p = participants.get(pid)
    tzname = (p or {}).get("timezone") or ""
    if not tzname:
        return
    tz = ZoneInfo(tzname)
    for start, end, tl in ivs:
        hh, mm = map(int, tl.split(":"))
        s = max(start, device_from, lo)
        e = min(end or hi, hi)
        if s >= e:
            continue
        d = s.astimezone(tz).date()
        last = e.astimezone(tz).date()
        while d <= last:
            fire = datetime.combine(d, time(hh, mm), tzinfo=tz).astimezone(dt_timezone.utc)
            if s <= fire < e:
                yield fire
            d += timedelta(days=1)


def main():
    intervals = build_intervals()
    subs_by_pid: dict[str, list[datetime]] = defaultdict(list)
    for s in subs:
        subs_by_pid[s["participant_id"]].append(parse_ts(s["created_at"]))

    per_day = defaultdict(int)
    per_pid = defaultdict(int)
    per_kind = defaultdict(int)
    no_tz_skipped = 0
    total = 0
    check = 0

    for (pid, key), ivs in intervals.items():
        if pid not in subs_by_pid:
            continue
        if not participants.get(pid, {}).get("timezone"):
            no_tz_skipped += sum(1 for _ in ivs)
            continue
        for device_from in subs_by_pid[pid]:
            for fire in occurrences(pid, ivs, device_from, FUNCTION_LIVE, NOW):
                total += 1
                per_day[fire.date()] += 1
                per_pid[pid] += 1
                per_kind[key[0]] += 1
                if CHECK_WINDOW[0] <= fire < CHECK_WINDOW[1]:
                    check += 1

    days = sorted(per_day)
    print("Expected reminder pushes (study env)")
    print("=====================================")
    print(f"window            : {FUNCTION_LIVE:%Y-%m-%d %H:%M} UTC -> {NOW:%Y-%m-%d %H:%M} UTC")
    print(f"devices           : {len(subs)} subscriptions across {len(subs_by_pid)} participants")
    print(f"participants w/ >=1 expected send : {len(per_pid)}")
    print(f"EXPECTED SENDS    : {total}")
    print(f"  generic         : {per_kind['generic']}")
    print(f"  presence        : {per_kind['practice']}")
    if days:
        span = (days[-1] - days[0]).days + 1
        print(f"  per day (mean)  : {total / span:.1f} over {span} days")
    print(f"reminders skipped (participant has no timezone): {no_tz_skipped}")
    print()
    print(f"cross-check {CHECK_WINDOW[0]:%m-%d %H:%M}-{CHECK_WINDOW[1]:%H:%M} UTC : "
          f"expected {check}, measured {CHECK_MEASURED} (net._http_response)")
    print()
    print("Per day (last 14):")
    for d in days[-14:]:
        print(f"  {d}  {per_day[d]:4}")
    print()
    print("Top participants:")
    for pid, n in sorted(per_pid.items(), key=lambda x: -x[1])[:8]:
        p = participants[pid]
        print(f"  {n:4}  {p['name'] or '(unnamed)':20} {p['timezone']}")

    print("""
Direction of error, compared with what the function really attempted:
  estimate too LOW
  - Devices whose subscription later expired (404/410) were deleted without a
    timestamp, so every send to them before that is invisible here.
  estimate too HIGH
  - reminder_set/disabled events exist only for the study build; a reminder
    with no events is assumed enabled since the earliest evidence available.
  - The old function matched the exact minute only: any run delayed >60 s lost
    that occurrence. Only the last ~6 h can be verified (all 360 runs on time).
  - Push errors other than 404/410 were logged to console and never counted,
    so "attempted" is not "accepted by the push service".
  definitional
  - Counted per device. A participant with two subscribed devices contributes
    two sends per occurrence, which is also what the function does.
""")


if __name__ == "__main__":
    main()
