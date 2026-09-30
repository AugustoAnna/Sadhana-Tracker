#!/usr/bin/env python3
"""
Reminder-to-log conversion: what share of logs fall within three hours after
a set reminder time, versus baseline log timing for participants without
reminders?

DATA LIMITATION (read before trusting this number): the `timezone` column on
`participants` was added late (migration 004) and is populated for only 36 of
223 participants (16%) overall. Without it, a UTC `occurred_at` timestamp
can't be converted to the participant's local wall-clock time, so this
analysis is restricted to the subset who DO have a timezone recorded. That
subset is not a random sample -- it likely skews toward people who updated
the app more recently or granted more permissions (timezone is set by the
push-notification service, see src/services/push.ts). Treat this section as
a small, directional read, not a study-wide number.

Method:
  - Restrict to named, non-test participants (collapsed by name) who have a
    timezone recorded on at least one of their device-rows.
  - For each such person, convert every practice_completed.occurred_at (UTC)
    to their local wall-clock time using their timezone (zoneinfo). Logs
    made for yesterday (backtrack = true) are left out: their occurred_at is
    when they were entered, not when the practice happened.
  - Reminder group: people with >=1 enabled reminder (reminders.enabled =
    true). A log "converts" if its local time-of-day falls within
    [reminder_time_local, reminder_time_local + 3h) for ANY of that person's
    enabled reminders (wrapping past midnight where relevant).
  - PRIMARY COMPARISON (coverage-adjusted lift): a person with k reminders
    has up to k x 3h of the day "in window" (union of windows, ~27% of the
    day on average for this group). So the fair question is not "what share
    of logs fall in-window" on its own, but how that share compares with the
    share you'd expect if logs were spread evenly through the day, i.e.
    lift = (in-window share) / (window coverage of the day). A lift of 1.0
    means reminder windows are no busier than any other time.
  - Baseline group (reported for completeness only): people with a timezone
    but ZERO enabled reminders. Their "busiest single 3h window" share is
    post-hoc optimised and covers only 12.5% of the day, so it is NOT
    comparable to a fixed multi-window reminder set -- and at n=4 people it
    can't support a conclusion either way. Earlier versions of the report
    headlined "63% vs 35%" on this basis; that comparison was withdrawn.

Two further caveats that bias the lift UPWARD:
  - reminders rows hold CURRENT state only (no timestamp), so a reminder set
    in week 3 is applied to week-1 logs as if it had always existed.
  - people plausibly set reminders at the times they already practise, so a
    lift shows logs cluster around reminder times, not that reminders cause
    the logging.

Usage: analysis/.venv/bin/python analysis/reminder_conversion.py
"""
import csv
import statistics
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path
from zoneinfo import ZoneInfo

DATA = Path(__file__).parent / "data"

KNOWN_TEST_NAMES = {
    "test", "anonymous",
    "augusto", "augustoo", "augusto-test", "augusto-test3",
    "augusto presence test",
    "testforrecover", "testing sync",
    "ash", "fd", "js",
}


def norm_name(name):
    return re.sub(r"\s+", " ", (name or "").strip()).lower()


def is_test_or_anonymous(name):
    n = norm_name(name)
    return (not n) or (n in KNOWN_TEST_NAMES)


def load_csv(name):
    with open(DATA / f"{name}.csv", newline="") as f:
        return list(csv.DictReader(f))


def parse_utc(s):
    # e.g. "2026-08-15 13:56:16.13+00" or with timezone offset
    s = s.strip()
    # normalize "+00" -> "+00:00" for fromisoformat
    if re.search(r"[+-]\d{2}$", s):
        s = s + ":00"
    s = s.replace(" ", "T", 1)
    return datetime.fromisoformat(s)


def parse_hms(s):
    parts = s.strip().split(":")
    h, m = int(parts[0]), int(parts[1])
    return h * 60 + m  # minutes since midnight


def main():
    participants = load_csv("participants")
    completed = load_csv("practice_completed")
    reminders = load_csv("reminders")

    # name -> timezone (first non-empty seen)
    name_tz = {}
    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name
        tz = p.get("timezone") or ""
        if tz and name not in name_tz:
            name_tz[name] = tz

    eligible_names = set(name_tz.keys())
    print(f"Named non-test participants with a timezone recorded: {len(eligible_names)}")

    # enabled reminder minutes-since-midnight, per name
    reminder_minutes = defaultdict(set)
    for r in reminders:
        name = pid_to_name.get(r["participant_id"])
        if name is None or name not in eligible_names:
            continue
        if r["enabled"] not in ("True", "true", "t", "1"):
            continue
        reminder_minutes[name].add(parse_hms(r["time_local"]))

    has_reminder = {n for n in eligible_names if reminder_minutes.get(n)}
    no_reminder = eligible_names - has_reminder
    print(f"  of those, have >=1 enabled reminder: {len(has_reminder)}")
    print(f"  of those, zero enabled reminders: {len(no_reminder)}")

    # local-time-of-day (minutes since midnight) for each log, per name
    local_minutes_by_name = defaultdict(list)
    for r in completed:
        name = pid_to_name.get(r["participant_id"])
        if name is None or name not in eligible_names:
            continue
        if r.get("backtrack", "").lower() in ("true", "t"):
            continue
        tz = ZoneInfo(name_tz[name])
        utc_dt = parse_utc(r["occurred_at"])
        if utc_dt.tzinfo is None:
            utc_dt = utc_dt.replace(tzinfo=dt_timezone.utc)
        local_dt = utc_dt.astimezone(tz)
        local_minutes_by_name[name].append(local_dt.hour * 60 + local_dt.minute)

    def within_3h_after(log_min, reminder_min):
        delta = (log_min - reminder_min) % (24 * 60)
        return 0 <= delta < 180

    # --- reminder group ---
    reminder_group_total = 0
    reminder_group_converted = 0
    reminder_people_with_logs = 0
    for name in has_reminder:
        logs = local_minutes_by_name.get(name, [])
        if not logs:
            continue
        reminder_people_with_logs += 1
        for lm in logs:
            reminder_group_total += 1
            if any(within_3h_after(lm, rm) for rm in reminder_minutes[name]):
                reminder_group_converted += 1

    # --- baseline group: best 3h window after the fact ---
    baseline_total = 0
    baseline_best_window_hits = 0
    baseline_people_with_logs = 0
    for name in no_reminder:
        logs = local_minutes_by_name.get(name, [])
        if not logs:
            continue
        baseline_people_with_logs += 1
        baseline_total += len(logs)
        best = 0
        for start in range(0, 24 * 60, 30):  # scan every 30 min for the busiest 3h window
            hits = sum(1 for lm in logs if within_3h_after(lm, start))
            best = max(best, hits)
        baseline_best_window_hits += best

    # --- coverage-adjusted lift (the primary, like-for-like comparison) ---
    def day_coverage(reminder_mins):
        covered = [False] * (24 * 60)
        for start in reminder_mins:
            for k in range(180):
                covered[(start + k) % (24 * 60)] = True
        return sum(covered) / (24 * 60)

    coverages, per_person_lift = [], []
    for name in has_reminder:
        logs = local_minutes_by_name.get(name, [])
        if not logs:
            continue
        cov = day_coverage(reminder_minutes[name])
        hits = sum(1 for lm in logs if any(within_3h_after(lm, rm) for rm in reminder_minutes[name]))
        coverages.append(cov)
        per_person_lift.append((hits / len(logs)) / cov)

    print(f"\nReminder group: {reminder_people_with_logs} people with logs, "
          f"{reminder_group_total} total logs")
    if reminder_group_total:
        share = reminder_group_converted / reminder_group_total
        mean_cov = statistics.mean(coverages)
        print(f"  logs within 3h after ANY enabled reminder: "
              f"{reminder_group_converted}/{reminder_group_total} ({100*share:.1f}%)")
        print(f"  mean share of the day covered by their reminder windows: {100*mean_cov:.1f}%")
        print(f"  LIFT vs even-spread expectation: {share/mean_cov:.2f}x "
              f"(median per-person lift {statistics.median(per_person_lift):.2f}x, "
              f"people with lift < 1: {sum(1 for l in per_person_lift if l < 1)})")

    print(f"\nBaseline (no-reminder) group: {baseline_people_with_logs} people with logs, "
          f"{baseline_total} total logs")
    if baseline_total:
        print(f"  logs within EACH person's own busiest possible 3h window: "
              f"{baseline_best_window_hits}/{baseline_total} "
              f"({100*baseline_best_window_hits/baseline_total:.1f}%)")

    print("\nPer-person (reminder group):")
    for name in sorted(has_reminder, key=lambda n: -len(local_minutes_by_name.get(n, []))):
        logs = local_minutes_by_name.get(name, [])
        if not logs:
            continue
        hits = sum(1 for lm in logs if any(within_3h_after(lm, rm) for rm in reminder_minutes[name]))
        print(f"  {name:<28} logs={len(logs):>3}  within-3h={hits:>3}  "
              f"rate={100*hits/len(logs):5.1f}%  reminders={sorted(reminder_minutes[name])}")


if __name__ == "__main__":
    main()
