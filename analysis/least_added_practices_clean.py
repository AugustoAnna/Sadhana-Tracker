#!/usr/bin/env python3
"""
Least-added practices, scoped to the SAME population as the funnel report
(analysis/reports/funnel-report.html): named, non-test participants,
collapsed by name across device-rows (a reinstall mints a new anon auth
user, so the same person can otherwise be double- or triple-counted).

This exists because analysis/data/least_added_practices.csv (query supplied
by the user, verified clean and correct on its own terms) counts every raw
participant_practices row -- including test/dev accounts and every device a
person has ever added a practice on. That's a legitimate question ("how many
add-events happened, period"), just a DIFFERENT one from "how many distinct
REAL STUDY PARTICIPANTS have this on their list" -- which is what the funnel
report's population answers everywhere else. This script recomputes the
same ranking under that second, person-scoped definition so the two are
comparable.

Usage: analysis/.venv/bin/python analysis/least_added_practices_clean.py
"""
import csv
import re
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
    practices = load_csv("practices")
    pp = load_csv("participant_practices")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    practice_names = {p["id"]: (p["name"], p["kind"]) for p in practices}

    # raw (unfiltered, not collapsed) -- matches least_added_practices.csv
    raw_adds = defaultdict(int)
    raw_adders = defaultdict(set)
    for r in pp:
        raw_adds[r["practice_id"]] += 1
        raw_adders[r["practice_id"]].add(r["participant_id"])

    # clean (named, non-test, collapsed by person: a practice counts once
    # per PERSON even if added on multiple devices, and instance duplicates
    # on one device collapse too -- this answers "how many real people have
    # this on their list right now", matching how the funnel report counts
    # everything else)
    clean_adders_by_practice = defaultdict(set)  # practice_id -> {name}
    for r in pp:
        name = pid_to_name.get(r["participant_id"])
        if name:
            clean_adders_by_practice[r["practice_id"]].add(name)

    named_people = set(pid_to_name.values())
    n_named = len(named_people)

    rows = []
    for pid, (name, kind) in practice_names.items():
        rows.append({
            "practice": name,
            "kind": kind,
            "raw_total_adds": raw_adds.get(pid, 0),
            "raw_unique_adders": len(raw_adders.get(pid, set())),
            "clean_unique_adders": len(clean_adders_by_practice.get(pid, set())),
        })

    rows.sort(key=lambda r: (r["clean_unique_adders"], r["practice"]))

    print(f"Named, non-test participants, current snapshot (same METHODOLOGY as the funnel "
          f"report -- name-collapsed, test-excluded -- but this is fresh data, not the "
          f"report's Sep 15 population of 58): {n_named}")
    print(f"Practices in the catalogue: {len(practice_names)}\n")

    print(f"{'practice':<32}{'kind':<10}{'raw adds':>9}{'raw adders':>11}{'clean adders':>13}{'% of pop':>9}")
    for r in rows:
        pct = 100 * r["clean_unique_adders"] / n_named if n_named else 0
        print(f"{r['practice']:<32}{r['kind']:<10}{r['raw_total_adds']:>9}"
              f"{r['raw_unique_adders']:>11}{r['clean_unique_adders']:>13}{pct:>8.1f}%")

    zero = [r["practice"] for r in rows if r["clean_unique_adders"] == 0]
    print(f"\nPractices with ZERO real study participants adding them: {len(zero)}")
    for p in zero:
        print(f"  - {p}")

    # how much does test/reinstall noise inflate the raw numbers?
    inflated = [r for r in rows if r["raw_unique_adders"] > r["clean_unique_adders"]]
    print(f"\nPractices where raw unique_adders > clean unique_adders "
          f"(test accounts / multi-device reinstalls inflating the count): {len(inflated)}")
    for r in sorted(inflated, key=lambda r: -(r["raw_unique_adders"] - r["clean_unique_adders"]))[:10]:
        diff = r["raw_unique_adders"] - r["clean_unique_adders"]
        print(f"  {r['practice']:<32} raw={r['raw_unique_adders']:>3}  clean={r['clean_unique_adders']:>3}  (+{diff})")


if __name__ == "__main__":
    main()
