#!/usr/bin/env python3
"""
Log-type mix: what share of all logs are minute-logs vs checkbox-only vs guided?

The practice_completed table has a `mode` column with three possible values,
verified against src/services/sync.ts `sourceFromLogMode`:
  - mode='logged'         -> plain checkbox tap, no minutes entered   (source: checkbox)
  - mode='minutes_added'  -> a specific minutes value was entered/adjusted (source: minutes)
  - mode='guided'         -> completed via the in-app guided audio/video player (source: player)

'guided' is a third, distinct category -- it is neither a minute-log nor a
checkbox-only log, so it is reported as its own slice rather than folded
into either bucket.

Unit of analysis: every row in practice_completed (NOT deduped by day) across
ALL named non-test participants, using their full lifetime history. People
are collapsed by NAME (not participant_id), same rule as the rest of this
analysis.

Usage: analysis/.venv/bin/python analysis/log_mode_mix.py
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


MODE_LABEL = {
    "logged": "checkbox (plain tap, no minutes)",
    "minutes_added": "minutes (specific value entered/adjusted)",
    "guided": "guided (in-app audio/video player)",
}


def main():
    participants = load_csv("participants")
    completed = load_csv("practice_completed")

    pid_to_name = {}
    for p in participants:
        name = p["name"].strip()
        if is_test_or_anonymous(name):
            continue
        pid_to_name[p["id"]] = name

    mode_counts = Counter()
    unknown_modes = Counter()
    per_person_modes = defaultdict(Counter)
    total_rows_seen = 0
    total_rows_excluded_test = 0

    for r in completed:
        total_rows_seen += 1
        name = pid_to_name.get(r["participant_id"])
        if name is None:
            total_rows_excluded_test += 1
            continue
        mode = r["mode"]
        if mode not in MODE_LABEL:
            unknown_modes[mode] += 1
            continue
        mode_counts[mode] += 1
        per_person_modes[name][mode] += 1

    total = sum(mode_counts.values())
    n_people = len(per_person_modes)

    print(f"Total practice_completed rows in export: {total_rows_seen}")
    print(f"  excluded (test/anonymous participant): {total_rows_excluded_test}")
    print(f"  included (named, non-test participants): {total}")
    if unknown_modes:
        print(f"  WARNING unexpected mode values: {dict(unknown_modes)}")
    print(f"People contributing >=1 log: {n_people}")
    print()

    print("LOG-TYPE MIX (share of all logs, all named non-test participants, lifetime):")
    for mode in ("logged", "minutes_added", "guided"):
        c = mode_counts[mode]
        pct = 100 * c / total if total else 0
        print(f"  {MODE_LABEL[mode]:<45} {c:>5}  ({pct:5.1f}%)")
    print()

    checkbox = mode_counts["logged"]
    minutes = mode_counts["minutes_added"]
    guided = mode_counts["guided"]
    print("Note on the user's literal two categories (minutes vs checkbox):")
    print(f"  minutes-logs:  {minutes} ({100*minutes/total:.1f}% of all logs)")
    print(f"  checkbox-only: {checkbox} ({100*checkbox/total:.1f}% of all logs)")
    print(f"  guided (third mode, excluded from both buckets above): {guided} ({100*guided/total:.1f}% of all logs)")
    print(f"  minutes + checkbox alone = {minutes+checkbox} ({100*(minutes+checkbox)/total:.1f}% of all logs, "
          f"i.e. of all logs excluding guided)")
    print()

    # per-person breakdown, sorted by total logs desc
    print("Per-person detail (name, checkbox, minutes, guided, total):")
    for name, counts in sorted(per_person_modes.items(), key=lambda kv: -sum(kv[1].values())):
        tot = sum(counts.values())
        print(f"  {name:<28} checkbox={counts['logged']:>4}  minutes={counts['minutes_added']:>4}  "
              f"guided={counts['guided']:>4}  total={tot:>4}")


if __name__ == "__main__":
    main()
