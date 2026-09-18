#!/usr/bin/env python3
"""
Gap trend: per participant, are successive gaps between logging days getting
longer or shorter over the course of the study window?

Definitions (same "gap" convention as analysis/recovery_rate.py):
  - A participant's "logging days" = distinct local_date values on which they
    logged >=1 practice, across their entire lifetime (all device-rows,
    collapsed by name -- same identity rule as the rest of this analysis).
  - A "gap" = day-distance between two of a participant's CONSECUTIVE logging
    days: gap = next_logging_date - prev_logging_date (in days). gap == 1
    means back-to-back days. Unlike recovery_rate.py, here we use EVERY gap
    (including 1s), because we're asking about the trend across a person's
    whole gap sequence, not isolating "did they skip a day".

Eligibility: only participants with >=3 gaps (i.e. >=4 distinct logging days)
are included. "Successive gaps got longer or shorter" is only a meaningful
question if there's enough of a sequence to split into an early half and a
late half and compare -- with 1 or 2 gaps total there's nothing to compare
against.

Methodology: for each eligible participant, take their gap sequence in
chronological order (gap 1, gap 2, ..., gap N, where N = distinct logging
days - 1). Split it into an EARLY half (first floor(N/2) gaps) and a LATE
half (last floor(N/2) gaps); for odd N, the single middle gap is dropped
from both halves so neither side is contaminated by it. Compare
mean(late half) to mean(early half):
  - "shortening": late-half mean gap is 20% or more BELOW the early-half
    mean, inclusive (late <= early * 0.8)
  - "lengthening": late-half mean gap is 20% or more ABOVE the early-half
    mean, inclusive (late >= early * 1.2)
  - "steady": neither of the above (strictly within +/-20% of early mean)
This 20% relative threshold, and its inclusive boundary (exactly -20% or
+20% counts as shortening/lengthening, not steady), is a judgment call --
same spirit as the 1-day absolute HOLD_THRESHOLD in weekly_frequency.py,
just expressed relatively here since gap lengths vary widely in scale from
person to person.

People are collapsed by NAME (not participant_id), same rule as the rest of
this analysis (reinstall = new anon auth user). KNOWN_TEST_NAMES is matched
by exact, normalized name -- no prefix/substring matching.

Usage: analysis/.venv/bin/python analysis/gap_trend.py
"""
import csv
import re
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path

DATA = Path(__file__).parent / "data"

MIN_GAPS_FOR_ELIGIBILITY = 3  # need >=3 gaps (>=4 logging days) to split early/late
TREND_THRESHOLD = 0.20  # relative change threshold: >20% = shortening/lengthening

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


def classify(early_mean, late_mean):
    if late_mean <= early_mean * (1 - TREND_THRESHOLD):
        return "shortening"
    if late_mean >= early_mean * (1 + TREND_THRESHOLD):
        return "lengthening"
    return "steady"


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
        sd = sorted(days)
        gaps = [(nxt - prev).days for prev, nxt in zip(sd, sd[1:])]
        if len(gaps) < MIN_GAPS_FOR_ELIGIBILITY:
            continue
        half = len(gaps) // 2
        early = gaps[:half]
        late = gaps[-half:]
        early_mean = statistics.mean(early)
        late_mean = statistics.mean(late)
        per_person[name] = {
            "n_gaps": len(gaps),
            "gaps": gaps,
            "early_mean": early_mean,
            "late_mean": late_mean,
            "trend": classify(early_mean, late_mean),
        }

    n_total_loggers = len(days_by_name)
    n_eligible = len(per_person)

    print(f"Total named, non-test loggers: {n_total_loggers}")
    print(f"Eligible (>= {MIN_GAPS_FOR_ELIGIBILITY} gaps, i.e. >= {MIN_GAPS_FOR_ELIGIBILITY + 1} distinct logging days): {n_eligible}")
    print(f"Threshold: shortening/lengthening = late-half mean gap differs from early-half mean gap by {int(TREND_THRESHOLD*100)}% or more, relative (inclusive); otherwise steady.")
    print()

    buckets = defaultdict(list)
    for name, v in per_person.items():
        buckets[v["trend"]].append(name)

    for trend in ("shortening", "steady", "lengthening"):
        names = buckets[trend]
        print(f"  {trend:<12} {len(names):>2} of {n_eligible}  ({100*len(names)/n_eligible:.0f}%)")
    print()

    all_early_means = [v["early_mean"] for v in per_person.values()]
    all_late_means = [v["late_mean"] for v in per_person.values()]
    print(f"Aggregate across {n_eligible} eligible participants:")
    print(f"  median early-half mean gap: {statistics.median(all_early_means):.2f} days")
    print(f"  median late-half mean gap:  {statistics.median(all_late_means):.2f} days")
    print(f"  mean early-half mean gap:   {statistics.mean(all_early_means):.2f} days")
    print(f"  mean late-half mean gap:    {statistics.mean(all_late_means):.2f} days")
    print()

    print("Per-person detail (sorted by trend, then by |relative change| desc):")
    def rel_change(v):
        if v["early_mean"] == 0:
            return 0
        return (v["late_mean"] - v["early_mean"]) / v["early_mean"]

    for trend in ("shortening", "lengthening", "steady"):
        names = buckets[trend]
        print(f"\n  -- {trend} ({len(names)}) --")
        for name in sorted(names, key=lambda n: -abs(rel_change(per_person[n]))):
            v = per_person[name]
            print(f"  {name:<28} gaps={v['n_gaps']:>2}  early={v['early_mean']:.2f}  late={v['late_mean']:.2f}  "
                  f"change={100*rel_change(v):+.0f}%  seq={v['gaps']}")


if __name__ == "__main__":
    main()
