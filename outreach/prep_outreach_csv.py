#!/usr/bin/env python3
"""
Upgrades uw_contacts_raw.csv → uw_contacts_outreach.csv
Adds state-tracking columns for the multi-agent outreach system.
Handles the unquoted research_experience field by parsing from both ends.
"""
import csv
import uuid
from pathlib import Path

INPUT = Path('outreach/uw_contacts_raw.csv')
OUTPUT = Path('outreach/uw_contacts_outreach.csv')

STATE_FIELDS = [
    'contact_id',
    'draft_status',       # pending | drafted | approved | skipped
    'subject_line',
    'email_draft',
    'send_status',        # pending | sent | failed | bounced
    'sent_at',
    'reply_status',       # none | replied | opted_out
    'replied_at',
    'followup_1_status',  # pending | sent | skipped
    'followup_1_sent_at',
    'followup_2_status',  # pending | sent | skipped
    'followup_2_sent_at',
    'final_status',       # active | finished_replied | finished_no_reply | bounced | opted_out | skipped
    'notes',
]

CORE_FIELDS = ['name', 'linkedin', 'email', 'department', 'research_experience', 'track', 'personalized_description']


def parse_raw_line(line: str) -> dict:
    """
    Parses a raw CSV line where research_experience is unquoted and may contain commas.
    Strategy: parse all columns, then reconstruct research_experience as everything
    between the first 4 fields and the last 2 fields.
    """
    reader = csv.reader([line])
    cols = next(reader)

    if len(cols) < 7:
        raise ValueError(f"Too few columns ({len(cols)}): {line[:80]}")

    name = cols[0]
    linkedin = cols[1]
    email = cols[2]
    department = cols[3]
    # Everything between col[4] and the last 2 cols is research_experience
    track = cols[-2]
    personalized_description = cols[-1]
    research_experience = ', '.join(cols[4:-2])

    return {
        'name': name.strip(),
        'linkedin': linkedin.strip(),
        'email': email.strip(),
        'department': department.strip(),
        'research_experience': research_experience.strip(),
        'track': track.strip(),
        'personalized_description': personalized_description.strip(),
    }


def main():
    contacts = []
    with open(INPUT) as f:
        lines = f.read().splitlines()

    # Skip header
    for line in lines[1:]:
        if not line.strip():
            continue
        row = parse_raw_line(line)
        contacts.append(row)

    print(f"Parsed {len(contacts)} contacts")

    # Add state fields with defaults
    for i, c in enumerate(contacts):
        c['contact_id'] = str(i + 1).zfill(3)
        c['draft_status'] = 'pending'
        c['subject_line'] = ''
        c['email_draft'] = ''
        c['send_status'] = 'pending'
        c['sent_at'] = ''
        c['reply_status'] = 'none'
        c['replied_at'] = ''
        c['followup_1_status'] = 'pending'
        c['followup_1_sent_at'] = ''
        c['followup_2_status'] = 'pending'
        c['followup_2_sent_at'] = ''
        c['final_status'] = 'active'
        c['notes'] = ''

    fieldnames = CORE_FIELDS + STATE_FIELDS
    with open(OUTPUT, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(contacts)

    print(f"Written to {OUTPUT}")
    # Verify
    with open(OUTPUT) as f:
        check = list(csv.DictReader(f))
    print(f"Verified: {len(check)} rows, {len(check[0])} fields")
    print(f"Sample research_experience: {check[0]['research_experience'][:80]}")
    print(f"Sample track: {check[0]['track']}")


if __name__ == '__main__':
    main()
