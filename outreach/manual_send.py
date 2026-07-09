#!/usr/bin/env python3
"""
Manual email sender — displays one contact at a time for copy-pasting into Outlook.
Controls:
  any key  → mark done, show next
  q        → quit and save progress
"""
import csv
import sys
import tty
import termios
import os
import subprocess

CSV_PATH = 'outreach/symposiumContacts_filtered.csv'
LOG_PATH = 'outreach/manual_sent_log.txt'


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


def load_done() -> set[str]:
    if not os.path.exists(LOG_PATH):
        return set()
    with open(LOG_PATH) as f:
        return {line.strip() for line in f if line.strip()}


def parse_draft(draft: str) -> tuple[str, str]:
    if draft.startswith("Subject:"):
        subject_line, _, body = draft.partition('\n')
        return subject_line.removeprefix("Subject:").strip(), body.strip()
    return "", draft.strip()


def main() -> None:
    with open(CSV_PATH) as f:
        rows = list(csv.reader(f))[1:]  # skip header

    done = load_done()
    remaining = [r for r in rows if r[2] not in done]
    total = len(rows)

    print(f"\n{len(done)}/{total} done. {len(remaining)} remaining.")
    if not remaining:
        print("All done!")
        return
    print("Press any key to mark done + next, or 'q' to quit.\n")
    input("Hit Enter to start...")

    with open(LOG_PATH, 'a') as log:
        for i, row in enumerate(remaining):
            name, email, draft = row[0], row[2], row[9]
            subject, body = parse_draft(draft)

            copy(email)  # auto-copy email address to clipboard

            os.system('clear')
            width = 64
            print("=" * width)
            print(f"  {len(done) + i + 1}/{total}  —  {len(remaining) - i} left")
            print("=" * width)
            print(f"\n  TO:      {email}  ← (copied to clipboard)")
            print(f"\n  SUBJECT: {subject}")
            print(f"\n  BODY:\n")
            print(body)
            print(f"\n{'=' * width}")
            print("  any key → done + next    q → quit")
            print("=" * width + "\n")

            key = getch()
            if key.lower() == 'q':
                print("\nQuitting — progress saved.")
                break

            log.write(email + '\n')
            log.flush()

    done_now = load_done()
    print(f"\nDone for now. {len(done_now)}/{total} total sent.")


if __name__ == '__main__':
    main()
