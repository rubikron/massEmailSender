#!/usr/bin/env python3
"""
Follow-up tool for Research Mentor outreach.
Shows contacts eligible for follow-up based on days since send.
Follow-up 1: day 5-7 | Follow-up 2: day 14
Controls: any key → mark sent + next | s → skip | q → quit
"""
import csv
import sys
import tty
import termios
import os
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────────────
# No domain restriction — works with any email provider
SENDER_NAME       = "[YOUR_NAME]"                                    # Your full name
SENDER_EMAIL      = "[YOUR_EMAIL]@[YOUR_EMAIL_DOMAIN]"              # e.g. "you@gmail.com"
ORG_WEBSITE       = "aisc.framer.website"                            # Your organization's website
SENDER_TITLE      = "AIC Board | AI+X Research Program"
# ────────────────────────────────────────────────────────────────────────────────

CSV_PATH = Path('outreach/uw_contacts_outreach.csv')

FOLLOWUP_1_AFTER_DAYS = 6   # send follow-up 1 on day 6
FOLLOWUP_2_AFTER_DAYS = 14  # send follow-up 2 on day 14


def getch() -> str:
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        return sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def copy(text: str) -> None:
    subprocess.run('pbcopy', input=text.encode(), check=True)


def load_contacts() -> list[dict]:
    with open(CSV_PATH) as f:
        return list(csv.DictReader(f))


def save_contacts(contacts: list[dict]) -> None:
    fieldnames = list(contacts[0].keys())
    with open(CSV_PATH, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(contacts)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def days_since(iso_ts: str) -> int:
    if not iso_ts:
        return 0
    sent = datetime.fromisoformat(iso_ts.replace('Z', '+00:00'))
    return (datetime.now(timezone.utc) - sent).days


def build_followup_1(contact: dict) -> tuple[str, str]:
    first = contact['name'].split()[0]
    subject = f"Re: Research Mentor Opportunity — AIC AI+X Research Program"
    body = f"""Hi {first},

I wanted to follow up on my previous email about the AIC AI+X Research Program.

I know your schedule is demanding — to clarify the ask: it's roughly one hour a week of technical guidance for one team, from Fall Week 4 through Winter submission. You'd choose the team yourself after reviewing their applications. For mentors who make substantial intellectual contributions, co-authorship on the submitted paper is on the table.

If the timing isn't right this cycle, I'd still love to keep you in mind for future cohorts.

Happy to send over the full program brief if useful — just reply here.

{SENDER_NAME}
{SENDER_TITLE}
{SENDER_EMAIL} | {ORG_WEBSITE}"""
    return subject, body


def build_followup_2(contact: dict) -> tuple[str, str]:
    first = contact['name'].split()[0]
    subject = f"Re: Research Mentor Opportunity — AIC AI+X Research Program"
    body = f"""Hi {first},

I'll assume the timing isn't right — no worries at all.

If circumstances change or you'd like to be involved in a future cohort, feel free to reach out at {SENDER_EMAIL}.

Best,
{SENDER_NAME}
{SENDER_TITLE}"""
    return subject, body


def get_eligible(contacts: list[dict]) -> list[tuple[dict, int]]:
    """Returns (contact, followup_number) pairs eligible to send today."""
    eligible = []
    for c in contacts:
        if c['send_status'] != 'sent':
            continue
        if c['reply_status'] in ('replied', 'opted_out'):
            continue
        if c['final_status'] not in ('active',):
            continue

        days = days_since(c['sent_at'])

        if c['followup_1_status'] == 'pending' and days >= FOLLOWUP_1_AFTER_DAYS:
            eligible.append((c, 1))
        elif c['followup_1_status'] == 'sent' and c['followup_2_status'] == 'pending' and days >= FOLLOWUP_2_AFTER_DAYS:
            eligible.append((c, 2))

    return eligible


def main() -> None:
    contacts = load_contacts()
    eligible = get_eligible(contacts)

    print(f"\n{'='*64}")
    print(f"  Research Mentor Outreach — Follow-up Queue")
    print(f"{'='*64}")
    print(f"  Eligible for follow-up today: {len(eligible)}")
    print(f"{'='*64}\n")

    if not eligible:
        print("  No follow-ups due today. Check back in a few days.\n")
        return

    print("  any key → mark sent + next    s → skip    q → quit\n")
    input("  Hit Enter to start...")

    for i, (contact, followup_num) in enumerate(eligible):
        if followup_num == 1:
            subject, body = build_followup_1(contact)
        else:
            subject, body = build_followup_2(contact)

        copy(contact['email'])
        os.system('clear')
        width = 70
        sent_days = days_since(contact['sent_at'])

        print("=" * width)
        print(f"  Follow-up {followup_num} of 2  —  {i+1}/{len(eligible)}  —  {len(eligible)-i} left")
        print("=" * width)
        print(f"\n  TO:         {contact['email']}  ← (copied to clipboard)")
        print(f"  NAME:       {contact['name']}")
        print(f"  DEPT:       {contact['department']}")
        print(f"  SENT:       {sent_days} days ago ({contact['sent_at'][:10]})")
        print(f"\n  SUBJECT:    {subject}")
        print(f"\n  BODY:\n")
        for line in body.split('\n'):
            print(f"  {line}")
        print(f"\n{'='*width}")
        print("  any key → sent    s → skip    q → quit")
        print("=" * width + "\n")

        key = getch()
        if key.lower() == 'q':
            print("\n  Quitting — progress saved.")
            break

        idx = next(j for j, c in enumerate(contacts) if c['contact_id'] == contact['contact_id'])

        if key.lower() == 's':
            if followup_num == 1:
                contacts[idx]['followup_1_status'] = 'skipped'
            else:
                contacts[idx]['followup_2_status'] = 'skipped'
                contacts[idx]['final_status'] = 'finished_no_reply'
        else:
            ts = now_iso()
            if followup_num == 1:
                contacts[idx]['followup_1_status'] = 'sent'
                contacts[idx]['followup_1_sent_at'] = ts
            else:
                contacts[idx]['followup_2_status'] = 'sent'
                contacts[idx]['followup_2_sent_at'] = ts
                contacts[idx]['final_status'] = 'finished_no_reply'

        save_contacts(contacts)

    print(f"\n  Session complete.\n")


if __name__ == '__main__':
    main()
