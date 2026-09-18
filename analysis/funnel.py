#!/usr/bin/env python3
"""
Onboarding funnel for the sadhana-tracker study, collapsed to one row per
real person (participants can have multiple `participants` rows if they
reinstalled / used a new device — each reinstall mints a fresh anon auth user).

IMPORTANT — what's a real gate vs. just a signal (verified against the app's
own routing/onboarding code, not assumed):

  * added_practice (participant_practices row exists) is a HARD GATE. The
    "Continue" button on the practices screen is disabled until >=1 practice
    is added (src/screens/EditPractices.tsx), and you cannot reach the
    reminders screen without it. So its absence reliably means "never
    finished step 1 of setup."

  * installed_standalone is NOT a gate. Installing to the home screen is
    optional — people can use the web app in a browser tab and still
    complete setup and log practices. Shown as an informational signal only.

  * a `reminders` row is NOT a reliable "finished setup" signal. Looking at
    src/screens/Reminders.tsx + appStore.completeOnboarding: a reminders row
    is only synced to the server if the user actually TOGGLES a reminder.
    Someone who reaches the last screen and taps "Finish" without touching
    any toggle completes onboarding with ZERO reminders rows. So this signal
    under-counts completions — it can confirm someone got there, but its
    absence does not prove they didn't.

  * logged_once (practice_completed row exists) is a HARD, reliable signal.

Given that, the primary funnel uses only the two hard gates:
  named -> added_practice -> logged_once
with installed_standalone and reminders-row shown as supplementary context,
not as funnel stages.

Usage:
  analysis/.venv/bin/python analysis/funnel.py --roster analysis/roster.txt
  analysis/.venv/bin/python analysis/funnel.py            # no roster: every
                                                            # named (non-test,
                                                            # non-Anonymous)
                                                            # participant
"""
import argparse
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


def load_csv(name):
    with open(DATA / f"{name}.csv", newline="") as f:
        return list(csv.DictReader(f))


def norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip()).lower()


def is_test_or_anonymous(name: str) -> bool:
    n = norm_name(name)
    if not n:
        return True
    return n in KNOWN_TEST_NAMES


def load_roster(path: str):
    names = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            names.append(line)
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roster", help="text file, one participant name per line")
    ap.add_argument(
        "--include-unmatched",
        action="store_true",
        help="with --roster, also list DB names that didn't match anyone on the roster",
    )
    args = ap.parse_args()

    participants = load_csv("participants")
    pp = load_csv("participant_practices")
    reminders = load_csv("reminders")
    completed = load_csv("practice_completed")

    added_ids = {r["participant_id"] for r in pp}
    reminder_ids = {r["participant_id"] for r in reminders}
    logged_ids = {r["participant_id"] for r in completed}

    roster = load_roster(args.roster) if args.roster else None
    roster_by_norm = {norm_name(n): n for n in roster} if roster else None

    people = defaultdict(
        lambda: {
            "rows": 0,
            "installed": False,
            "added_practice": False,
            "has_reminder_row": False,
            "logged_once": False,
        }
    )
    unmatched_db_names = defaultdict(int)

    for p in participants:
        raw_name = p["name"]
        if roster:
            key = roster_by_norm.get(norm_name(raw_name))
            if key is None:
                unmatched_db_names[raw_name] += 1
                continue
        else:
            if is_test_or_anonymous(raw_name):
                continue
            key = raw_name.strip()

        rec = people[key]
        rec["rows"] += 1
        if p["installed_standalone"] in ("True", "true", "t", "1"):
            rec["installed"] = True
        pid = p["id"]
        if pid in added_ids:
            rec["added_practice"] = True
        if pid in reminder_ids:
            rec["has_reminder_row"] = True
        if pid in logged_ids:
            rec["logged_once"] = True

    total = len(people)

    if roster:
        missing = [n for n in roster if n not in people]
        print(f"Roster: {len(roster)} people")
        print(f"Matched to at least one DB row: {total}")
        if missing:
            print(f"On roster but NO matching DB row at all ({len(missing)}):")
            for n in missing:
                print(f"  - {n}")
        print()

    n_installed = sum(1 for v in people.values() if v["installed"])
    n_added = sum(1 for v in people.values() if v["added_practice"])
    n_added_and_reminder = sum(
        1 for v in people.values() if v["added_practice"] and v["has_reminder_row"]
    )
    n_logged = sum(1 for v in people.values() if v["logged_once"])

    print("=== FUNNEL (hard, DB-verified gates only) ===")
    print(f"{'named / on roster':<28} {total:>4}")
    print(
        f"{'added_practice (hard gate)':<28} {n_added:>4}  "
        f"({100*n_added/total:5.1f}% of total, -{total-n_added} vs previous)"
    )
    print(
        f"{'logged_once (hard signal)':<28} {n_logged:>4}  "
        f"({100*n_logged/total:5.1f}% of total, -{n_added-n_logged} vs previous)"
    )
    print()
    print("--- supplementary signals (not gates, don't read as funnel steps) ---")
    print(f"installed_standalone (optional, informational): {n_installed}/{total}")
    print(
        f"has a reminders row (only proves they toggled one — "
        f"absence does NOT prove they didn't finish setup): "
        f"{n_added_and_reminder}/{n_added} of those who added a practice"
    )
    print()

    print("=== WHERE THE FUNNEL BROKE (people who never logged) ===")
    broke = defaultdict(list)
    for name, v in people.items():
        if v["logged_once"]:
            continue
        if not v["added_practice"]:
            stage = "never added a practice (stalled at setup step 1)"
        else:
            reminder_note = (
                " [has a reminders row -> definitely reached the last setup screen]"
                if v["has_reminder_row"]
                else " [no reminders row -> may have finished setup w/o touching a toggle, or dropped off before finishing]"
            )
            stage = "added practice(s), never logged a session" + reminder_note
        broke[stage].append(name)

    for stage, names in sorted(broke.items(), key=lambda kv: kv[0]):
        names = sorted(names)
        print(f"\n{stage} ({len(names)}):")
        for n in names:
            print(f"  - {n}")

    if roster and args.include_unmatched and unmatched_db_names:
        print(f"\n=== DB names NOT on roster ({len(unmatched_db_names)} distinct) ===")
        for n, c in sorted(unmatched_db_names.items(), key=lambda kv: -kv[1]):
            print(f"  - {n}  ({c} row{'s' if c != 1 else ''})")


if __name__ == "__main__":
    main()
