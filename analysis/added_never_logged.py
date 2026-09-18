#!/usr/bin/env python3
"""
Practices that were ADDED to a participant's list but never logged once.

Identity: (practice_id, instance) is the unit a person "adds" — practices with
allows_second_instance can be added twice (instance 1 and 2), and each slot is
independently loggable. A slot counts as "added, never logged" if that
(practice_id, instance) pair never appears in practice_completed for that
person.

People are collapsed by NAME (not participant_id), same rule as the rest of
this analysis (reinstalls mint a new anon auth user). Both the added-set and
the logged-set are unioned across all of a person's device-rows before
diffing, so a practice added on one device and logged on another correctly
counts as logged.

Usage: analysis/.venv/bin/python analysis/added_never_logged.py
"""
import csv
import re
import statistics
from collections import defaultdict
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


def main():
    participants = load_csv("participants")
    pp = load_csv("participant_practices")
    completed = load_csv("practice_completed")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    added_by_name = defaultdict(set)      # name -> {(practice_id, instance)}
    logged_by_name = defaultdict(set)     # name -> {(practice_id, instance)}

    for r in pp:
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            continue
        added_by_name[name].add((r["practice_id"], r["instance"]))

    for r in completed:
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            continue
        logged_by_name[name].add((r["practice_id"], r["instance"]))

    never_logged_by_name = {}
    for name, added in added_by_name.items():
        logged = logged_by_name.get(name, set())
        stale = added - logged
        if stale:
            never_logged_by_name[name] = sorted(stale)

    total_added_slots = sum(len(s) for s in added_by_name.values())
    total_stale = sum(len(v) for v in never_logged_by_name.values())
    n_people_with_added = len(added_by_name)
    n_people_with_stale = len(never_logged_by_name)

    print(f"People who added >=1 practice: {n_people_with_added}")
    print(f"Total (practice, instance) slots added across the study: {total_added_slots}")
    print(f"Total added-but-never-logged slots: {total_stale}  "
          f"({100*total_stale/total_added_slots:.1f}% of all added slots)")
    print(f"People with >=1 added-but-never-logged slot: {n_people_with_stale} of {n_people_with_added}")

    counts = [len(v) for v in never_logged_by_name.values()]
    if counts:
        print(f"Per-person (among those with >=1 stale add): "
              f"median {statistics.median(counts)}, mean {statistics.mean(counts):.2f}, "
              f"max {max(counts)}")

    # distribution of stale-count among people who added >=1 practice at all
    # (0 included, so the full population is represented)
    dist = defaultdict(int)
    for name in added_by_name:
        dist[len(never_logged_by_name.get(name, []))] += 1
    print("\nDistribution across ALL people who added >=1 practice (0 = fully cleared their list):")
    for k in sorted(dist):
        print(f"  {k:>2} stale adds -> {dist[k]:>2} people")

    # which practices get added-and-abandoned most often
    by_practice = defaultdict(int)
    for stale in never_logged_by_name.values():
        for practice_id, _instance in stale:
            by_practice[practice_id] += 1
    print("\nMost commonly added-but-never-logged practices:")
    for practice_id, c in sorted(by_practice.items(), key=lambda kv: -kv[1])[:12]:
        print(f"  {c:>2}  {practice_id}")

    print("\nPer-person detail:")
    for name, stale in sorted(never_logged_by_name.items(), key=lambda kv: -len(kv[1])):
        practice_ids = [pid for pid, _inst in stale]
        print(f"  {name:<28} {len(stale):>2}  {', '.join(practice_ids)}")


if __name__ == "__main__":
    main()
