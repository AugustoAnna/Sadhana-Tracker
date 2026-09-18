#!/usr/bin/env python3
"""
Recovery rate: of all gaps of 2+ days between a participant's consecutive
logging days, what share resumed within two days (i.e. the gap was exactly
2 days -- one full day skipped -- rather than longer)?

Definitions:
  - A participant's "logging days" = distinct local_date values on which they
    logged >=1 practice, across their entire lifetime (all device-rows,
    collapsed by name -- same identity rule as the rest of this analysis).
  - A "gap" is the day-distance between two of a participant's CONSECUTIVE
    logging days: gap = next_logging_date - prev_logging_date (in days).
    gap == 1 means they logged on back-to-back calendar days (no days
    skipped) -- not a gap.
  - "2+ day gap" = gap >= 2, i.e. they skipped at least one full calendar day
    before logging again. This is the population the recovery rate is
    computed over.
  - "Resumed within two days" = gap == 2 exactly (they came back on the very
    next possible day after skipping just one day). Since the population is
    already gap >= 2, this splits it into gap == 2 (recovered quickly) vs.
    gap > 2 (a longer drought before returning).
  - Gaps only exist BETWEEN two actual logged days for a person -- a trailing
    silence with no subsequent log (someone who simply stopped) is not a
    "gap" by this definition, since we can't know if/when they'd have
    resumed. This undercounts nothing that matters for "recovery rate" --
    it specifically measures lapses that we know were eventually followed by
    a return.

Usage: analysis/.venv/bin/python analysis/recovery_rate.py
"""
import csv
import re
from collections import defaultdict
from datetime import date
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

    days_by_name = defaultdict(set)
    for r in completed:
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            continue
        days_by_name[name].add(parse_date(r["local_date"]))

    all_gaps = []          # every gap length (including 1s), for context
    gap_records = []       # (name, prev_date, next_date, gap_len) for gap>=2
    for name, days in days_by_name.items():
        sd = sorted(days)
        for prev, nxt in zip(sd, sd[1:]):
            gap = (nxt - prev).days
            all_gaps.append(gap)
            if gap >= 2:
                gap_records.append((name, prev, nxt, gap))

    n_total_transitions = len(all_gaps)
    n_back_to_back = sum(1 for g in all_gaps if g == 1)
    n_gaps_2plus = len(gap_records)
    n_recovered_in_2 = sum(1 for _, _, _, g in gap_records if g == 2)

    print(f"People with >=2 distinct logging days (eligible for a gap): "
          f"{sum(1 for d in days_by_name.values() if len(d) >= 2)} of {len(days_by_name)}")
    print(f"Total day-to-day transitions across all participants: {n_total_transitions}")
    print(f"  back-to-back (gap == 1, no day skipped): {n_back_to_back}")
    print(f"  2+ day gaps (>=1 day skipped): {n_gaps_2plus}")
    print()
    print(f"RECOVERY RATE (gap == 2, resumed within two days, among gap>=2): "
          f"{n_recovered_in_2}/{n_gaps_2plus} = {100*n_recovered_in_2/n_gaps_2plus:.1f}%")
    print()

    dist = defaultdict(int)
    for _, _, _, g in gap_records:
        dist[g] += 1
    print("Distribution of gap lengths (days skipped+1) among 2+ day gaps:")
    for k in sorted(dist):
        print(f"  gap={k:>2}  {dist[k]:>3} occurrences  {'#' * dist[k]}")

    # per-person: how many 2+ gaps each person had, and their own recovery rate
    by_person = defaultdict(lambda: {"gaps2plus": 0, "recovered": 0})
    for name, _, _, g in gap_records:
        by_person[name]["gaps2plus"] += 1
        if g == 2:
            by_person[name]["recovered"] += 1

    print(f"\nPeople with >=1 gap of 2+ days: {len(by_person)}")
    print("\nPer-person detail (name, 2+ gaps, recovered-in-2, their rate):")
    for name, v in sorted(by_person.items(), key=lambda kv: -kv[1]["gaps2plus"]):
        rate = 100 * v["recovered"] / v["gaps2plus"]
        print(f"  {name:<28} gaps={v['gaps2plus']:>2}  recovered={v['recovered']:>2}  rate={rate:5.1f}%")


if __name__ == "__main__":
    main()
