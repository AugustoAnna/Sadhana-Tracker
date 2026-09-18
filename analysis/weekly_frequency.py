#!/usr/bin/env python3
"""
Logging days per participant in week 1 / week 2 / week 3 - did frequency
decay, hold, or rise?

Day 0 = a participant's first practice_completed row (across any of their
device-rows), same per-person rolling-window approach as
analysis/distinct_practices_21d.py - participants joined the study on
different days (Aug 13 - Sep 15), so a fixed calendar week would give early
joiners more elapsed time than late joiners.

  week 1 = days 0-6   (first 7 calendar days since first log)
  week 2 = days 7-13
  week 3 = days 14-20

For each week we count LOGGING DAYS: the number of distinct local_date values
on which the participant logged at least one practice in that window (not
total log count - 5 logs in one day is 1 logging day).

Eligibility: a participant is only included in the week1/week2/week3
comparison if they have full tenure for all three windows, i.e. at least 21
days have elapsed between their first log and today (2026-09-15). Without
this, someone who started 10 days before the data pull would show an
artificially truncated (or entirely missing) week 3, which would bias the
"did it decay" answer toward decay just because of when they joined, not
because they actually logged less.

People are collapsed by NAME (not participant_id), same rule as the rest of
this analysis (reinstall = new anon auth user). KNOWN_TEST_NAMES is matched
by exact, normalized name - no prefix/substring matching.

Usage: analysis/.venv/bin/python analysis/weekly_frequency.py
"""
import csv
import re
import statistics
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

DATA = Path(__file__).parent / "data"
TODAY = date(2026, 9, 15)
MIN_ELAPSED_DAYS_FOR_FULL_ELIGIBILITY = 21  # need day 0..20 to have fully occurred

KNOWN_TEST_NAMES = {
    "test", "anonymous",
    "augusto", "augustoo", "augusto-test", "augusto-test3",
    "augusto presence test",
    "testforrecover", "testing sync",
    "ash", "fd", "js",
}

# held-flat threshold: |week3 - week1| <= this counts as "held"
HOLD_THRESHOLD = 1


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


def week_window(first_date, week_num):
    """week_num: 1, 2, or 3 -> (start, end) inclusive, days 0-6 / 7-13 / 14-20."""
    start_offset = (week_num - 1) * 7
    start = first_date + timedelta(days=start_offset)
    end = first_date + timedelta(days=start_offset + 6)
    return start, end


def main():
    participants = load_csv("participants")
    completed = load_csv("practice_completed")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    # name -> set of distinct local_dates logged, across all their device-rows
    dates_by_name = defaultdict(set)
    for r in completed:
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            continue
        dates_by_name[name].add(parse_date(r["local_date"]))

    per_person = {}
    for name, dates in dates_by_name.items():
        first_date = min(dates)
        elapsed = (TODAY - first_date).days
        eligible = elapsed >= MIN_ELAPSED_DAYS_FOR_FULL_ELIGIBILITY

        weeks = {}
        for wk in (1, 2, 3):
            start, end = week_window(first_date, wk)
            weeks[wk] = sum(1 for d in dates if start <= d <= end)

        per_person[name] = {
            "first_date": first_date,
            "elapsed_days": elapsed,
            "eligible": eligible,
            "week1": weeks[1],
            "week2": weeks[2],
            "week3": weeks[3],
        }

    n_loggers = len(per_person)
    eligible_people = {n: v for n, v in per_person.items() if v["eligible"]}
    n_eligible = len(eligible_people)

    w1 = [v["week1"] for v in eligible_people.values()]
    w2 = [v["week2"] for v in eligible_people.values()]
    w3 = [v["week3"] for v in eligible_people.values()]

    print(f"Total named, non-test loggers: {n_loggers}")
    print(f"Eligible for full week1+2+3 comparison (>= {MIN_ELAPSED_DAYS_FOR_FULL_ELIGIBILITY} days elapsed since first log, as of {TODAY}): {n_eligible}")
    print(f"Excluded for insufficient tenure: {n_loggers - n_eligible}")
    print()

    print("Logging days per week (n = {}):".format(n_eligible))
    print(f"  Week 1  median {statistics.median(w1):>4}   mean {statistics.mean(w1):.2f}   range {min(w1)}-{max(w1)}")
    print(f"  Week 2  median {statistics.median(w2):>4}   mean {statistics.mean(w2):.2f}   range {min(w2)}-{max(w2)}")
    print(f"  Week 3  median {statistics.median(w3):>4}   mean {statistics.mean(w3):.2f}   range {min(w3)}-{max(w3)}")
    print()

    # trend classification: diff = week3 - week1
    decayed, held, rose = [], [], []
    for name, v in eligible_people.items():
        diff = v["week3"] - v["week1"]
        if diff > HOLD_THRESHOLD:
            rose.append(name)
        elif diff < -HOLD_THRESHOLD:
            decayed.append(name)
        else:
            held.append(name)

    print(f"Trend classification (decayed: week3 < week1 by more than {HOLD_THRESHOLD}; "
          f"held: |week3 - week1| <= {HOLD_THRESHOLD}; rose: week3 > week1 by more than {HOLD_THRESHOLD}):")
    print(f"  Decayed  {len(decayed):>2} of {n_eligible}  ({100*len(decayed)/n_eligible:.0f}%)")
    print(f"  Held     {len(held):>2} of {n_eligible}  ({100*len(held)/n_eligible:.0f}%)")
    print(f"  Rose     {len(rose):>2} of {n_eligible}  ({100*len(rose)/n_eligible:.0f}%)")
    print()

    print("Per-person detail (eligible participants only, sorted by week1 desc):")
    for name, v in sorted(eligible_people.items(), key=lambda kv: -kv[1]["week1"]):
        diff = v["week3"] - v["week1"]
        tag = "held" if abs(diff) <= HOLD_THRESHOLD else ("rose" if diff > 0 else "decayed")
        print(f"  {name:<28} first={v['first_date']}  elapsed={v['elapsed_days']:>3}d  "
              f"w1={v['week1']}  w2={v['week2']}  w3={v['week3']}  ({tag})")

    print()
    print("Excluded (insufficient tenure) - name, first log date, days elapsed:")
    for name, v in sorted(per_person.items(), key=lambda kv: kv[1]["first_date"]):
        if not v["eligible"]:
            print(f"  {name:<28} first={v['first_date']}  elapsed={v['elapsed_days']:>3}d")


if __name__ == "__main__":
    main()
