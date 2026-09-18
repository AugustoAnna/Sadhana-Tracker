#!/usr/bin/env python3
"""
Reminder usage: how many participants enabled reminders, how many each, and
at what times of day.

Source: analysis/data/reminders.csv (columns: participant_id, kind, slot,
practice_id, time_local, enabled). Each row is one reminder slot as currently
synced from one device; the same logical reminder can appear once per device
a person has used.

Identity: people are collapsed by NAME (not participant_id), same rule as
the rest of this analysis. A person's reminder rows are unioned across all
of their device-rows, then deduped by (kind, slot, practice_id, time_local)
-- the natural key of "one reminder" -- since the same reminder can sync down
to multiple devices and would otherwise be double-counted.

"Enabled" means enabled=true in the row -- i.e. the toggle is actually on,
not merely that a reminders row exists (visiting the reminders screen alone
can create a disabled row).

Practices allow up to 3 reminders in the product UI: generic slots 1-3 plus
per-practice reminders (kind='practice', keyed by practice_id) with no
numbered slot.

Time-of-day buckets (exact boundaries on time_local, local 24h clock):
  early morning : 04:00:00 <= t < 07:00:00
  morning       : 07:00:00 <= t < 10:00:00
  midday        : 10:00:00 <= t < 14:00:00
  afternoon     : 14:00:00 <= t < 18:00:00
  evening       : 18:00:00 <= t < 21:00:00
  night         : 21:00:00 <= t < 24:00:00  OR  00:00:00 <= t < 04:00:00

Usage: analysis/.venv/bin/python analysis/reminder_usage.py
"""
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

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


def parse_time_to_minutes(s):
    h, m, sec = s.split(":")
    return int(h) * 60 + int(m)


def bucket_for(time_local):
    mins = parse_time_to_minutes(time_local)
    h = mins / 60.0
    if 4 <= h < 7:
        return "early morning (4-7am)"
    if 7 <= h < 10:
        return "morning (7-10am)"
    if 10 <= h < 14:
        return "midday (10am-2pm)"
    if 14 <= h < 18:
        return "afternoon (2-6pm)"
    if 18 <= h < 21:
        return "evening (6-9pm)"
    return "night (9pm-4am)"


BUCKET_ORDER = [
    "early morning (4-7am)",
    "morning (7-10am)",
    "midday (10am-2pm)",
    "afternoon (2-6pm)",
    "evening (6-9pm)",
    "night (9pm-4am)",
]


def truthy(s):
    return str(s).strip().lower() in ("true", "t", "1", "yes")


def main():
    participants = load_csv("participants")
    reminders = load_csv("reminders")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    # name -> set of (kind, slot, practice_id, time_local) for ENABLED reminders only
    enabled_keys_by_name = defaultdict(set)
    # also track disabled-only visits for context (rows that exist but enabled=false)
    any_row_names = set()
    total_rows_seen = 0
    total_rows_excluded_test = 0
    total_enabled_rows = 0

    for r in reminders:
        total_rows_seen += 1
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            total_rows_excluded_test += 1
            continue
        any_row_names.add(name)
        if truthy(r["enabled"]):
            total_enabled_rows += 1
            key = (r["kind"], r["slot"], r["practice_id"], r["time_local"])
            enabled_keys_by_name[name].add(key)

    n_people_any_row = len(any_row_names)
    n_people_enabled = len(enabled_keys_by_name)
    total_enabled_deduped = sum(len(v) for v in enabled_keys_by_name.values())

    print(f"Total reminders rows in export: {total_rows_seen}")
    print(f"  excluded (test/anonymous participant): {total_rows_excluded_test}")
    print(f"  included, named non-test participants: {total_rows_seen - total_rows_excluded_test}")
    print(f"  of which enabled=true: {total_enabled_rows}")
    print()
    print(f"Named non-test participants with >=1 reminders row (any state): {n_people_any_row}")
    print(f"Named non-test participants with >=1 ENABLED reminder "
          f"(deduped by kind/slot/practice_id/time_local): {n_people_enabled}")
    print(f"Total distinct enabled reminders across those people (post-dedup): {total_enabled_deduped}")
    print()

    # (b) distribution of enabled-reminder count per person
    counts = [len(v) for v in enabled_keys_by_name.values()]
    dist = Counter(counts)
    print("(b) Distribution of ENABLED reminder count per person "
          "(only people with >=1 enabled reminder):")
    for k in sorted(dist):
        label = f"{k}" if k < 9 else f"{k}+"
        print(f"  {k:>2} reminders -> {dist[k]:>2} people")
    if counts:
        import statistics
        print(f"  median {statistics.median(counts)}, mean {statistics.mean(counts):.2f}, "
              f"max {max(counts)}")
    print()

    # (c) time-of-day buckets across all deduped enabled reminders
    bucket_counts = Counter()
    for keys in enabled_keys_by_name.values():
        for kind, slot, practice_id, time_local in keys:
            bucket_counts[bucket_for(time_local)] += 1

    print("(c) Enabled reminders by time-of-day bucket "
          "(deduped, all named non-test participants):")
    for b in BUCKET_ORDER:
        c = bucket_counts[b]
        pct = 100 * c / total_enabled_deduped if total_enabled_deduped else 0
        print(f"  {b:<22} {c:>3}  ({pct:5.1f}%)")
    print()

    # kind breakdown for extra context (generic vs per-practice)
    kind_counts = Counter()
    for keys in enabled_keys_by_name.values():
        for kind, slot, practice_id, time_local in keys:
            kind_counts[kind] += 1
    print("Enabled reminders by kind (context):")
    for k, c in kind_counts.most_common():
        print(f"  {k:<10} {c:>3}")
    print()

    print("Per-person detail (name, enabled reminder count, times):")
    for name, keys in sorted(enabled_keys_by_name.items(), key=lambda kv: -len(kv[1])):
        times = sorted(t for _, _, _, t in keys)
        print(f"  {name:<28} {len(keys):>2}  {', '.join(times)}")


if __name__ == "__main__":
    main()
