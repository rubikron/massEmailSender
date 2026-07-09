#!/usr/bin/env python3
"""
Merge draft JSON files from /tmp/drafts_A/B/C.json into uw_contacts_outreach.csv.
Run after all 3 Drafter agents have completed.

Usage: python3 outreach/merge_drafts.py
"""

import csv
import json
import sys
from pathlib import Path

CSV_PATH   = Path("outreach/uw_contacts_outreach.csv")
DRAFT_FILES = [Path("/tmp/drafts_A.json"), Path("/tmp/drafts_B.json"), Path("/tmp/drafts_C.json")]

def load_drafts():
    all_drafts = {}
    for f in DRAFT_FILES:
        if not f.exists():
            print(f"ERROR: {f} not found — has that agent finished?")
            sys.exit(1)
        with open(f) as fh:
            batch = json.load(fh)
        for d in batch:
            all_drafts[d["contact_id"]] = d
        print(f"  {f.name}: {len(batch)} drafts loaded")
    return all_drafts

def merge():
    print("Loading draft files...")
    drafts = load_drafts()
    print(f"  Total drafts: {len(drafts)}\n")

    if len(drafts) < 1:
        print(f"WARNING: no drafts found — did the Drafter agents run?")

    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    updated = 0
    skipped = 0
    for row in rows:
        cid = row["contact_id"]
        if cid not in drafts:
            print(f"  WARN: no draft for contact_id {cid}")
            skipped += 1
            continue
        d = drafts[cid]
        row["subject_line"] = d["subject_line"]
        row["email_draft"]  = d["email_draft"]
        row["draft_status"] = d["draft_status"]
        updated += 1

    with open(CSV_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Merged {updated} drafts into {CSV_PATH}")
    if skipped:
        print(f"Skipped {skipped} contacts (no draft found)")
    print("\nNext step: review drafts, set draft_status=approved, then run:")
    print("  node outreach/auto_send.js")

if __name__ == "__main__":
    merge()
