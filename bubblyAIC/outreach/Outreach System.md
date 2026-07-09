# Outreach System — Agent Protocol

> This document defines the full multi-agent outreach system for Research Mentor recruitment.
> Read this before touching any outreach CSV or running any outreach task.
> See: [[outreach/AIC AI+X Research Program]] for program context.
> See: [[outreach/Research Mentor Outreach]] for the email template.

---

## Data File

**`outreach/contacts_outreach.csv`** — single source of truth for all Research Mentor contacts.

### State Machine

```
DRAFT:  pending → drafted → approved → skipped
SEND:   pending → sent → failed → bounced
REPLY:  none → replied | opted_out
F/UP 1: pending → sent | skipped
F/UP 2: pending → sent | skipped
FINAL:  active → finished_replied | finished_no_reply | bounced | opted_out | skipped
```

### Key Fields

| Field | Values | Meaning |
|-------|--------|---------|
| `draft_status` | `pending` / `drafted` / `approved` / `skipped` | Whether the email has been written and cleared |
| `send_status` | `pending` / `sent` / `failed` / `bounced` | Whether the email has been sent |
| `reply_status` | `none` / `replied` / `opted_out` | Whether they responded |
| `followup_1_status` | `pending` / `sent` / `skipped` | Day 6 follow-up |
| `followup_2_status` | `pending` / `sent` / `skipped` | Day 14 follow-up (graceful exit) |
| `final_status` | `active` / `finished_replied` / `finished_no_reply` / `bounced` / `opted_out` / `skipped` | Terminal state |

**Critical invariant:** Once `reply_status = replied`, no further automated touches. Set `final_status = finished_replied`.

---

## Agent Roles

### Orchestrator (you — the main Claude session)
- Reads the CSV, partitions contacts into 3 batches by index
- Spawns 3 Drafter agents in parallel via Agent tool
- Validates and merges their JSON output back into the CSV
- Runs `send.py` and `followup.py` tools manually

### Drafter Agents (3 parallel sub-agents)
- Each receives a self-contained batch of contacts
- Generates `subject_line` + `email_draft` for each contact
- Returns a JSON array — does NOT write to CSV directly
- Orchestrator merges after validating all 3 outputs

### QA Agent (optional, single agent)
- Reviews drafted emails before approval
- Sets `draft_status = approved` on emails that pass quality gate
- Flags emails that need revision with a note in the `notes` field

---

## Drafter Agent Protocol

Each Drafter agent receives this prompt structure:

```
You are an email drafting agent for the AIC AI+X Research Program.

PROGRAM CONTEXT:
- Two-quarter undergrad research incubator, Fall 2026 → Winter 2027
- You are recruiting Research Mentors: PhD and Masters students who advise one team
- Commitment: ~1 hour/week, Fall Week 4 → Winter Week 8
- Mentors choose their own team from vetted applicants
- Co-authorship discussed for substantial intellectual contributions
- AIC website: aisc.framer.website
- Program lead: [YOUR_NAME] ([YOUR_EMAIL]), IEEE-published

EMAIL TEMPLATE:
[paste full template from Research Mentor Outreach.md]

PERSONALIZATION LOGIC:
[HOOK] — generated from research_experience + personalized_description:
  - If a named publication + venue exists → lead with that specific paper
  - If notable advisor pairing → reference research environment + their focus
  - Otherwise → reference specific research area + lab, make it specific enough that it couldn't apply to anyone else
  - Never: "your research is fascinating", "I came across your work", generic praise

[RESEARCH CONNECTION] — generated from research_experience + track:
  - 1 sentence connecting their specific sub-area to what teams in their track will work on
  - Be concrete: name the type of problem, not just the track name

QUALITY RULES:
  - 150–200 words total
  - Never open with "I hope this email finds you well"
  - Never use "Quick question" or "Research Opportunity" as subject line
  - Subject line: 6–8 words, topical and specific
  - Every email must name something specific about their work
  - Tone: professional and direct — they are senior researchers

YOUR BATCH:
[paste CSV rows as structured data]

OUTPUT FORMAT (strict JSON array):
[
  {
    "contact_id": "001",
    "subject_line": "...",
    "email_draft": "...",
    "draft_status": "drafted"
  },
  ...
]

Rules:
- Return exactly one object per contact in your batch
- If a contact is missing research_experience AND personalized_description, set draft_status to "pending" and email_draft to "" and note what is missing
- Do not skip any contacts
```

---

## Merge Protocol

After all 3 Drafter agents return:

1. **Validate counts** — each agent's output must have exactly as many items as its input batch
2. **Validate contact_ids** — every `contact_id` in the batch must appear in the output
3. **No duplicates** — no `contact_id` should appear more than once across all 3 outputs
4. **Merge** — write subject_line, email_draft, draft_status back to CSV by contact_id
5. **Report** — print count of `drafted`, `pending` (needs data), and any failures

If an agent returns fewer rows than expected, rerun it with just the missing `contact_id`s.

---

## Send Protocol

Two options — use whichever Outlook is available:

### Option A: Playwright Auto-Send (preferred)

Run: `node outreach/contacts_auto_send.js`

- Reads `contacts_outreach.csv`, filters `draft_status = approved` AND `send_status = pending`
- Opens Chrome (non-headless) and navigates to `outlook.office.com/mail/`
- Waits up to 2 minutes for you to log in and complete MFA — do not touch the browser during this window
- Once the inbox loads, sends each email automatically: opens compose → fills To / Subject / Body → clicks Send
- Body is injected via `document.execCommand('insertText')` — instant regardless of email length
- Strips `**markdown bold**` from email body before sending
- After each successful send: writes `send_status = sent` and `sent_at` timestamp directly to the CSV (safe to interrupt mid-run)
- Inter-send delay: 4 seconds. Warn threshold: 50 emails per run (M365 daily limit ~300)
- When prompted `Send to N contacts? (yes / number / Ctrl+C)`, enter a number to cap the batch

**Before running:**
1. Set `draft_status = approved` for contacts you've cleared
2. Verify all email addresses contain `@` (contacts from some sources may need real addresses — see lookup flow below)
3. Run with a small batch (e.g. 5) first to confirm the compose flow is working

**Known issue:** Outlook Web can be slow to load on the first run after a fresh browser launch — this is Outlook being a heavy SPA, not a script issue. Wait it out; the 2-minute login window is intentional.

**If Outlook is down or the auto-send fails mid-run:** switch to Option B. The CSV tracks exactly which contacts were sent, so there is no double-send risk.

### Option B: Manual Clipboard Send (fallback)

Run: `python3 outreach/send.py`

- Only sends contacts with `draft_status = approved` and `send_status = pending`
- Auto-copies email to clipboard, displays subject + body
- Any key → marks `send_status = sent`, `sent_at = timestamp`
- `q` → quit and save

**Before running:** Change `draft_status` from `drafted` to `approved` for contacts you've reviewed and cleared.

---

## Follow-up Protocol

Run: `python3 outreach/followup.py`

- Follow-up 1 triggers at day 6 after send (new angle, brief, re-states the light commitment)
- Follow-up 2 triggers at day 14 (graceful exit — "I'll assume timing isn't right")
- Skipping a follow-up with `s` marks it `skipped` but does not block the next follow-up
- After Follow-up 2, `final_status` → `finished_no_reply`

**Run this daily or every few days** starting a week after the first sends.

---

## Reply Handling (manual)

When someone replies:
1. Open `contacts_outreach.csv`
2. Find their row by email
3. Set `reply_status = replied`, `replied_at = YYYY-MM-DDTHH:MM:SSZ`
4. Set `final_status = finished_replied`
5. Add a note in `notes` (e.g., "Interested, wants program brief")
6. Update `Research Mentor Outreach.md` — move them to the appropriate pipeline tier

---

## Missing Email Lookup Flow

Some contacts may have name slugs instead of real email addresses in scraped data. Before approving these contacts:

1. Check `outreach/contacts_outreach.csv` — any row where `email` contains no `@` is broken
2. Spawn 2 sub-agents to look up real addresses in parallel — each takes 8 contacts and searches directories plus personal profile pages
3. Update the CSV with confirmed addresses before approving those rows

Email patterns vary by institution — always verify from the actual profile page rather than guessing.

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `outreach/prep_outreach_csv.py` | One-time: upgrades raw CSV to full state-tracking schema |
| `outreach/contacts_auto_send.js` | **Playwright auto-sender** — sends approved drafts via Outlook Web (preferred) |
| `outreach/send.py` | Manual clipboard sender — fallback if Outlook Web is unavailable |
| `outreach/merge_drafts.py` | Merges Drafter agent JSON output (`/tmp/drafts_A/B/C.json`) back into the CSV |
| `outreach/followup.py` | Send follow-ups for eligible contacts based on days elapsed |
