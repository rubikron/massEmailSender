# massEmailSender

A general-purpose email outreach framework. CSV state machine for contact tracking, Playwright auto-senders for Gmail and Outlook, SMTP fallback, and automated follow-ups.

## Quick Start

```bash
git clone https://github.com/rubikron/massEmailSender.git
cd massEmailSender
cd scrapers && npm install && cd ..
npx playwright install chromium
```

### Configuration

**1. Set your identity** — search the project for these placeholders and replace:

| Placeholder | Example |
|---|---|
| `[YOUR_NAME]` | `Jane Smith` |
| `[YOUR_EMAIL]` | `jane@gmail.com` |
| `[YOUR_EMAIL_DOMAIN]` | `gmail.com` |

**2. Configure email sending** — pick your method:

| Provider | Script | Auth |
|----------|--------|------|
| **Gmail** | `outreach/gmail_auto_send.js` | Opens Chrome, you log in manually (MFA supported) |
| **Outlook** | `outreach/uw_auto_send.js` | Opens Chrome, you log in manually (MFA supported) |
| **SMTP** | `outreach/send_emails.py` | Set `OUTLOOK_EMAIL` + `OUTLOOK_PASS` env vars |
| **Manual** | `outreach/send.py` | Copies to clipboard, you paste and send |

**3. Prepare contacts:**

```bash
cp outreach/templates/uw_contacts_raw.csv.example outreach/uw_contacts_raw.csv
# Populate with: name, linkedin, email, department, research_experience, track, personalized_description
python3 outreach/prep_outreach_csv.py
```

**4. Send:**

```bash
node outreach/gmail_auto_send.js   # Gmail
node outreach/uw_auto_send.js      # Outlook
```

## How It Works

### Contact State Machine

Contacts flow through a deterministic state machine in `uw_contacts_outreach.csv`:

```
DRAFT:  pending → drafted → approved → skipped
SEND:   pending → sent → failed → bounced
REPLY:  none → replied | opted_out
F/UP 1: pending → sent | skipped          (day 6)
F/UP 2: pending → sent | skipped          (day 14)
FINAL:  active → finished_replied | finished_no_reply | bounced | opted_out | skipped
```

Once `reply_status = replied`, no further automated touches.

### Multi-Agent Drafting

1. **Orchestrator** — partitions contacts, spawns 3 parallel drafter agents
2. **Drafter Agents** — each generates `subject_line` + `email_draft` for their batch
3. **Merge** — `merge_drafts.py` writes drafts back to the CSV
4. **Review** — manually set `draft_status = approved` for contacts you've cleared
5. **Send** — auto-senders pick up all approved + pending contacts

### Follow-ups

Run `outreach/followup.py` starting ~1 week after sends:

- **Day 6** — Brief re-statement of the opportunity
- **Day 14** — Graceful exit

Skips contacts that replied or opted out.

## File Structure

```
├── outreach/
│   ├── gmail_auto_send.js       # Playwright auto-sender (Gmail)
│   ├── uw_auto_send.js          # Playwright auto-sender (Outlook)
│   ├── auto_send.js             # Playwright auto-sender (event contacts)
│   ├── send_emails.py           # SMTP sender
│   ├── send.py                  # Manual clipboard sender (fallback)
│   ├── manual_send.py           # Alternative manual sender
│   ├── followup.py              # Automated follow-up queue
│   ├── merge_drafts.py          # Merge drafter agent output into CSV
│   ├── prep_outreach_csv.py     # Bootstrap state-tracking CSV
│   ├── __tests__/               # Test suite
│   └── templates/               # CSV header templates
├── scrapers/
│   ├── config.mjs               # Domain filter & source config
│   ├── package.json             # Playwright dependency
│   └── package-lock.json
└── .gitignore
```

## CSV Schema

### Input: `uw_contacts_raw.csv`

```
name,linkedin,email,department,research_experience,track,personalized_description
```

### Working: `uw_contacts_outreach.csv`

Adds state-tracking columns: `contact_id`, `draft_status`, `subject_line`, `email_draft`, `send_status`, `sent_at`, `reply_status`, `replied_at`, `followup_1_status`, `followup_1_sent_at`, `followup_2_status`, `followup_2_sent_at`, `final_status`, `notes`

## Prerequisites

- Node.js 18+
- Python 3.9+
- A Gmail or Outlook account

## License

MIT
