import csv
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import time
import sys

# Read credentials from environment variables (NOT hardcoded)
SMTP_USER = os.environ.get('OUTLOOK_EMAIL')
SMTP_PASS = os.environ.get('OUTLOOK_PASS')

if not SMTP_USER or not SMTP_PASS:
    print("ERROR: Set environment variables first:")
    print("  export OUTLOOK_EMAIL='your_email@outlook.com'")
    print("  export OUTLOOK_PASS='your_password_or_app_password'")
    print()
    print("If Outlook blocks login, you may need an App Password:")
    print("  1. Go to https://account.live.com/advancedprotection")
    print("  2. Enable Advanced Security, then generate an App Password")
    print("  3. Use that password here")
    sys.exit(1)

# Config
FROM = SMTP_USER
INPUT_CSV = 'outreach/symposiumContacts_filtered.csv'
SENT_LOG = 'outreach/sent_emails.csv'
MAX_PER_MINUTE = 10  # Rate limit to avoid triggering spam filters

# Connect to Outlook SMTP
print("Connecting to Outlook SMTP...")
smtp_server = smtplib.SMTP('smtp-mail.outlook.com', 587)
smtp_server.ehlo()
smtp_server.starttls()
smtp_server.ehlo()
smtp_server.login(SMTP_USER, SMTP_PASS)
print("Connected. Ready to send.")

# Read filtered CSV
with open(INPUT_CSV, 'r') as f:
    reader = csv.reader(f)
    header = next(reader)
    rows = list(reader)

print(f"Loading {len(rows)} emails to send...")
print(f"From: {FROM}")
print()

# Send emails
sent = 0
failed = 0

with open(SENT_LOG, 'w', newline='') as logf:
    logwriter = csv.writer(logf)
    logwriter.writerow(['email', 'name', 'status'])

    for i, row in enumerate(rows):
        name = row[0]
        to_email = row[2]  # email column
        email_draft = row[9]  # email_draft column

        # Parse subject from email_draft
        subject = ""
        body = ""
        if email_draft.startswith("Subject:"):
            lines = email_draft.split('\n', 1)
            subject = lines[0].replace("Subject: ", "")
            body = lines[1]

        # Build email
        msg = MIMEMultipart()
        msg['From'] = FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        try:
            smtp_server.sendmail(FROM, to_email, msg.as_string())
            logwriter.writerow([to_email, name, 'sent'])
            sent += 1
            print(f"[{sent}/{len(rows)}] Sent to {name} ({to_email})")
        except Exception as e:
            logwriter.writerow([to_email, name, f'failed: {e}'])
            failed += 1
            print(f"  FAILED: {name} ({to_email}) - {e}")

        # Rate limit: pause between sends
        logf.flush()
        if sent % MAX_PER_MINUTE == 0:
            print(f"\n  Pausing for 65s (rate limit)...")
            time.sleep(65)

    print(f"\n{'='*50}")
    print(f"SENT: {sent}")
    print(f"FAILED: {failed}")
    print(f"SENT LOG: {SENT_LOG}")
    print(f"{'='*50}")

smtp_server.quit()
