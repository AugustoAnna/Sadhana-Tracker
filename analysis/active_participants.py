#!/usr/bin/env python3
"""
Clean list of engaged participants: drops "Anonymous"/test rows and anyone
who never logged a practice, then collapses multiple device-rows per person
(same name -> same human, e.g. reinstalls) by summing their stats.

Usage: analysis/.venv/bin/python analysis/active_participants.py
"""
import csv
import re
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).parent / "data"
# Exact-match only (case-insensitive) — a prefix/substring filter here risks
# silently dropping real participants who happen to share a prefix with a
# test account (e.g. "Augusto M" is a real, active participant; "Augusto",
# "Augusto-test", "Augusto presence test" are not).
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
    if not n:
        return True
    return n in KNOWN_TEST_NAMES


def main():
    with open(DATA / "participant_profile.csv", newline="") as f:
        rows = list(csv.DictReader(f))

    people = defaultdict(
        lambda: {
            "total_minutes": 0,
            "days_practiced": 0,
            "total_records": 0,
            "distinct_practices": set(),
            "first_record_date": None,
            "last_record_date": None,
            "installed": False,
            "platforms": set(),
        }
    )

    for r in rows:
        name = r["name"].strip()
        if is_test_or_anonymous(name):
            continue
        if int(r["total_records"] or 0) == 0:
            continue  # never logged

        rec = people[name]
        rec["total_minutes"] += int(r["total_minutes"] or 0)
        rec["days_practiced"] += int(r["days_practiced"] or 0)  # approx; see note below
        rec["total_records"] += int(r["total_records"] or 0)
        if r["installed_standalone"] in ("True", "true", "t", "1"):
            rec["installed"] = True
        if r["platform"]:
            rec["platforms"].add(r["platform"])
        for d, field in (("first", "first_record_date"), ("last", "last_record_date")):
            v = r[field]
            if not v:
                continue
            cur = rec[f"{d}_record_date"]
            if cur is None or (d == "first" and v < cur) or (d == "last" and v > cur):
                rec[f"{d}_record_date"] = v

    print(f"{len(people)} engaged participants (real name, logged >=1 practice)\n")
    print(
        f"{'name':<28} {'records':>7} {'days*':>6} {'minutes':>7} "
        f"{'first':<11} {'last':<11} platforms"
    )
    for name, v in sorted(people.items(), key=lambda kv: -kv[1]["total_minutes"]):
        print(
            f"{name:<28} {v['total_records']:>7} {v['days_practiced']:>6} "
            f"{v['total_minutes']:>7} {v['first_record_date'] or '-':<11} "
            f"{v['last_record_date'] or '-':<11} {','.join(sorted(v['platforms'])) or '-'}"
        )
    print(
        "\n* 'days' sums days_practiced across each person's device-rows — if the "
        "same person logged from two devices on the same calendar day, that day "
        "gets counted twice. Fine as a rough activity signal; don't treat it as "
        "an exact distinct-day count."
    )


if __name__ == "__main__":
    main()
