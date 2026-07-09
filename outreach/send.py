#!/usr/bin/env python3
"""
Research Mentor outreach send tool.
Shows one approved email at a time. Auto-copies email address to clipboard.
Controls: any key → mark sent + next | q → quit
"""
import csv
import sys
import tty
import termios
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

CSV_PATH = Path('outreach/uw_contacts_outreach.csv')


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


def main() -> None:
    contacts = load_contacts()

    queue = [c for c in contacts if c['draft_status'] == 'approved' and c['send_status'] == 'pending']
    drafted_not_approved = sum(1 for c in contacts if c['draft_status'] == 'drafted')
    sent = sum(1 for c in contacts if c['send_status'] == 'sent')
    total = len(contacts)

    print(f"\n{'='*64}")
    print(f"  Research Mentor Outreach — Send Queue")
    print(f"{'='*64}")
    print(f"  Sent: {sent}/{total}   |   Ready to send: {len(queue)}   |   Drafted (not approved): {drafted_not_approved}")
    print(f"{'='*64}\n")

    if not queue:
        if drafted_not_approved:
            print(f"  {drafted_not_approved} drafts need approval before sending.")
            print("  Set draft_status = 'approved' in the CSV to queue them.\n")
        else:
            print("  Nothing in the send queue. Run the draft generation agents first.\n")
        return

    print("  any key → mark sent + next    q → quit\n")
    input("  Hit Enter to start...")

    for i, contact in enumerate(queue):
        copy(contact['email'])
        os.system('clear')
        width = 70
        name = contact['name']
        email = contact['email']
        subject = contact['subject_line']
        body = contact['email_draft']
        dept = contact['department']
        track = contact['track']

        print("=" * width)
        print(f"  {sent + i + 1}/{total}  —  {len(queue) - i} left in queue")
        print("=" * width)
        print(f"\n  TO:         {email}  ← (copied to clipboard)")
        print(f"  NAME:       {name}")
        print(f"  DEPT:       {dept}  [{track}]")
        print(f"\n  SUBJECT:    {subject}")
        print(f"\n  BODY:\n")
        for line in body.split('\n'):
            print(f"  {line}")
        print(f"\n{'='*width}")
        print("  any key → sent + next    q → quit")
        print("=" * width + "\n")

        key = getch()
        if key.lower() == 'q':
            print("\n  Quitting — progress saved.")
            break

        # Update state
        idx = next(j for j, c in enumerate(contacts) if c['contact_id'] == contact['contact_id'])
        contacts[idx]['send_status'] = 'sent'
        contacts[idx]['sent_at'] = now_iso()
        contacts[idx]['final_status'] = 'active'
        save_contacts(contacts)

    sent_now = sum(1 for c in load_contacts() if c['send_status'] == 'sent')
    print(f"\n  Session complete. {sent_now}/{total} total sent.\n")


if __name__ == '__main__':
    main()
