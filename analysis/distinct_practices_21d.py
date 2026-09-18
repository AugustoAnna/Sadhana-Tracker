#!/usr/bin/env python3
"""
Median number of DISTINCT practices logged per participant, within each
participant's first 21 days of logging (day 0 = their first practice_completed
row, across any of their device-rows; window = day 0 through day 20 inclusive).

Why a per-person rolling window instead of a fixed calendar range: study
participants joined on different days (Aug 13 - Sep 15), so a fixed calendar
window would give early joiners more days of data than late joiners. A
per-person "first 21 days since they started" window compares everyone on the
same footing.

People are collapsed by NAME (not participant_id) since a reinstall mints a
new anon auth user - the same rules as analysis/funnel.py and
analysis/active_participants.py: only real, non-test named participants
count, and multi-device activity for one person is merged.

Usage: analysis/.venv/bin/python analysis/distinct_practices_21d.py
"""
import csv
import re
import statistics
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

DATA = Path(__file__).parent / "data"
WINDOW_DAYS = 21

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


def main():
    participants = load_csv("participants")
    completed = load_csv("practice_completed")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    # name -> list of (local_date, practice_id), across all their device-rows
    logs_by_name = defaultdict(list)
    for r in completed:
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            continue
        logs_by_name[name].append((parse_date(r["local_date"]), r["practice_id"]))

    per_person = {}
    for name, rows in logs_by_name.items():
        first_date = min(d for d, _ in rows)
        window_end = first_date + timedelta(days=WINDOW_DAYS - 1)
        distinct = {pid for d, pid in rows if first_date <= d <= window_end}
        per_person[name] = {
            "distinct_count": len(distinct),
            "first_date": first_date,
            "practices": sorted(distinct),
        }

    counts_loggers_only = sorted(v["distinct_count"] for v in per_person.values())
    n_loggers = len(counts_loggers_only)
    median_loggers = statistics.median(counts_loggers_only)

    # distribution (for a histogram)
    dist = defaultdict(int)
    for c in counts_loggers_only:
        dist[c] += 1

    print(f"People who logged at least once: {n_loggers}")
    print(f"Median distinct practices logged in first {WINDOW_DAYS} days: {median_loggers}")
    print(f"Mean: {statistics.mean(counts_loggers_only):.2f}")
    print(f"Min / Max: {min(counts_loggers_only)} / {max(counts_loggers_only)}")
    print()
    print("Distribution (distinct practices -> # of people):")
    for k in sorted(dist):
        bar = "#" * dist[k]
        print(f"  {k:>2}  {dist[k]:>2}  {bar}")

    print()
    print("Per-person detail:")
    for name, v in sorted(per_person.items(), key=lambda kv: -kv[1]["distinct_count"]):
        print(f"  {name:<28} {v['distinct_count']:>2}  first={v['first_date']}  {','.join(v['practices'])}")


if __name__ == "__main__":
    main()
