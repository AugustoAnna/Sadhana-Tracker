#!/usr/bin/env python3
"""
Terminal lapse: how many named, non-test loggers stopped logging and are
unlikely to ever come back, and on which day of their own usage lifecycle
did they stop?

Definitions:
  - A participant's "logging days" = distinct local_date values on which they
    logged >=1 practice, across their entire lifetime (all device-rows,
    collapsed by name -- same identity rule as the rest of this analysis).
  - "Terminal lapse" = a participant whose LAST logged day is >= TERMINAL_
    LAPSE_DAYS (14) days before today (2026-09-15). 14 days is a judgment
    call, not derived from the data: it's long enough that a person who
    simply took a break (matching the longest *recovered* gap seen elsewhere
    in this analysis -- see analysis/recovery_rate.py, longest recovered gap
    was 23 days, but the bulk of recoveries happen well under two weeks) is
    unlikely to still be "mid-gap" rather than genuinely gone. Participants
    who logged within the last 14 days are treated as "still plausibly
    active" even if their day-to-day cadence has slowed, since we can't yet
    rule out a return.
  - "Day of use they stopped on" = (last_log_date - first_log_date) + 1.
    This is which day of their own usage lifecycle (day 1 = first possible
    day) their last log fell on -- day 10 means their last log was 10 days
    after they started, REGARDLESS of how many of the days in between were
    actually active. A person who logged only once (first log == last log)
    stopped on day 1.

People are collapsed by NAME (not participant_id), same rule as the rest of
this analysis (reinstall = new anon auth user). KNOWN_TEST_NAMES is matched
by exact, normalized name -- no prefix/substring matching.

Usage: analysis/.venv/bin/python analysis/terminal_lapse.py
"""
import csv
import re
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path

DATA = Path(__file__).parent / "data"
TODAY = date(2026, 9, 15)
TERMINAL_LAPSE_DAYS = 14  # >= this many days since last log = terminal lapse

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


def parse_date(s):
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


def bucket_day_of_use(day):
    """Bucket 'day of use they stopped on' into ranges with a tail bucket,
    same style as the 9+ / N+ tail buckets in distinct_practices_21d.py and
    added_never_logged.py."""
    if day <= 1:
        return "1"
    if day <= 3:
        return "2-3"
    if day <= 7:
        return "4-7"
    if day <= 14:
        return "8-14"
    if day <= 21:
        return "15-21"
    return "22+"


BUCKET_ORDER = ["1", "2-3", "4-7", "8-14", "15-21", "22+"]


def main():
    participants = load_csv("participants")
    completed = load_csv("practice_completed")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    days_by_name = defaultdict(set)
    for r in completed:
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            continue
        days_by_name[name].add(parse_date(r["local_date"]))

    per_person = {}
    for name, days in days_by_name.items():
        first_date = min(days)
        last_date = max(days)
        days_since_last = (TODAY - last_date).days
        day_of_use_stopped = (last_date - first_date).days + 1
        terminal = days_since_last >= TERMINAL_LAPSE_DAYS
        per_person[name] = {
            "first_date": first_date,
            "last_date": last_date,
            "days_since_last": days_since_last,
            "day_of_use_stopped": day_of_use_stopped,
            "terminal": terminal,
        }

    n_total_loggers = len(per_person)
    lapsed = {n: v for n, v in per_person.items() if v["terminal"]}
    active = {n: v for n, v in per_person.items() if not v["terminal"]}
    n_lapsed = len(lapsed)
    n_active = len(active)

    print(f"Total named, non-test loggers: {n_total_loggers}")
    print(f"Terminal lapse threshold: >= {TERMINAL_LAPSE_DAYS} days since last log (as of {TODAY})")
    print()
    print(f"TERMINAL LAPSE: {n_lapsed} of {n_total_loggers} ({100*n_lapsed/n_total_loggers:.0f}%)")
    print(f"STILL PLAUSIBLY ACTIVE (logged within last {TERMINAL_LAPSE_DAYS} days): {n_active} of {n_total_loggers} ({100*n_active/n_total_loggers:.0f}%)")
    print()

    stop_days = [v["day_of_use_stopped"] for v in lapsed.values()]
    print(f"Among the {n_lapsed} in terminal lapse -- 'day of use' they stopped on "
          f"((last_log - first_log) + 1):")
    print(f"  median {statistics.median(stop_days)}   mean {statistics.mean(stop_days):.2f}   "
          f"range {min(stop_days)}-{max(stop_days)}")
    print()

    dist = defaultdict(int)
    for d in stop_days:
        dist[bucket_day_of_use(d)] += 1
    print("Distribution of day-of-use stopped on, among terminal-lapse participants:")
    for b in BUCKET_ORDER:
        c = dist.get(b, 0)
        print(f"  {b:<6} {c:>2} people  {'#' * c}")
    print()

    print(f"Per-person detail -- TERMINAL LAPSE ({n_lapsed}), sorted by days since last log desc:")
    for name, v in sorted(lapsed.items(), key=lambda kv: -kv[1]["days_since_last"]):
        print(f"  {name:<28} first={v['first_date']}  last={v['last_date']}  "
              f"days_since_last={v['days_since_last']:>3}  day_of_use_stopped={v['day_of_use_stopped']:>3}  "
              f"bucket={bucket_day_of_use(v['day_of_use_stopped'])}")

    print(f"\nPer-person detail -- STILL PLAUSIBLY ACTIVE ({n_active}), sorted by days since last log desc:")
    for name, v in sorted(active.items(), key=lambda kv: -kv[1]["days_since_last"]):
        print(f"  {name:<28} first={v['first_date']}  last={v['last_date']}  "
              f"days_since_last={v['days_since_last']:>3}  day_of_use_stopped={v['day_of_use_stopped']:>3}")


if __name__ == "__main__":
    main()
