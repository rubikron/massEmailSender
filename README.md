# AI+X Research Program — Outreach Automation

A multi-agent outreach system for recruiting Research Mentors and Team Leads for a research incubator program. Built around an Obsidian vault for program documentation, a CSV state machine for contact tracking, and parallel AI agent drafting for personalized email generation.

## Architecture

```
RP_outreach/
├── outreach/                  # Email pipeline & contact management
│   ├── send.py                # Manual clipboard-based sender (fallback)
│   ├── send_emails.py         # SMTP-based sender (Outlook)
│   ├── followup.py            # Automated follow-up queue (day 6 + day 14)
│   ├── merge_drafts.py        # Merges parallel agent output into tracking CSV
│   ├── prep_outreach_csv.py   # Bootstraps state-tracking CSV from raw contacts
│   ├── auto_send.js           # Playwright auto-sender (event contacts via Outlook)
│   ├── uw_auto_send.js        # Playwright auto-sender (general contacts via Outlook)
│   ├── gmail_auto_send.js     # Playwright auto-sender (general contacts via Gmail)
│   ├── __tests__/             # Test suite for Gmail auto-sender
│   └── templates/             # CSV header templates (see Setup below)
│
├── scrapers/                  # Contact discovery & enrichment pipeline
│   ├── fetch_all_entries.mjs  # Paginated API scraper (event/registry API)
│   ├── map_campus.mjs         # Affiliation → campus/location classification
│   ├── generate_csv.mjs       # Raw entries → structured CSV + category assignment
│   ├── enrich_departments.mjs # Session tags → department/field inference
│   ├── fix_descriptions.mjs   # Auto-generate personalized descriptions
│   ├── filter_uw_seattle.mjs     # Filter entries by email domain or criteria
│   ├── final_csv.mjs          # Final assembly with all enrichments
│   ├── explore_abstracts.mjs  # Research area exploration utility
│   └── get_field_options.mjs  # API schema discovery
│
├── bubblyAIC/                 # Obsidian vault — program documentation
│   ├── VAULT_GUIDE.md         # Vault navigation & update protocol
│   └── outreach/              # Program docs (linked via wikilinks)
│       ├── AIC AI+X Research Program.md   # Master reference (single source of truth)
│       ├── Phase Overview.md              # Current phase & progress tracker
│       ├── Task Log.md                    # Chronological work log
│       ├── Outreach System.md             # Multi-agent system protocol + state machine
│       ├── Research Mentor Outreach.md    # Mentor recruitment pipeline & templates
│       ├── Symposium Outreach Email.md   # Team Lead outreach template
│       ├── Team Lead Program Description.md  # Role definition
│       ├── Contact Strategy.md           # Segmentation by role/track/lab
│       └── Contact Recruitment Plan.md   # Source map & scraping strategy
│
├── introPrompt.md             # System prompt — AI advisor persona for program lead
├── CLAUDE.md                  # Agent behavioral guidelines
└── README.md                  # This file
```

## Core Concepts

### Contact State Machine

Contacts flow through a deterministic state machine tracked in `uw_contacts_outreach.csv`:

```
DRAFT:  pending → drafted → approved → skipped
SEND:   pending → sent → failed → bounced
REPLY:  none → replied | opted_out
F/UP 1: pending → sent | skipped          (day 6)
F/UP 2: pending → sent | skipped          (day 14)
FINAL:  active → finished_replied | finished_no_reply | bounced | opted_out | skipped
```

**Critical invariant:** Once `reply_status = replied`, no further automated touches. Set `final_status = finished_replied`.

### Multi-Agent Drafting

The system uses 3 parallel AI agents to generate personalized emails:

1. **Orchestrator** — partitions contacts, spawns drafters, validates output, merges results
2. **Drafter Agents** (×3) — each receives a batch, generates `subject_line` + `email_draft` personalized per contact
3. **QA Agent** (optional) — reviews drafts before approval, flags issues

Draft protocol is fully specified in `bubblyAIC/outreach/Outreach System.md`.

### Send Options

| Provider | Script | How |
|----------|--------|-----|
| **Outlook** | `outreach/uw_auto_send.js` | Playwright against Outlook Web — opens Chrome, you log in manually, then it auto-sends |
| **Gmail** | `outreach/gmail_auto_send.js` | Playwright against Gmail — identical flow, Gmail-specific selectors |
| **SMTP** | `outreach/send_emails.py` | Direct SMTP via `OUTLOOK_EMAIL`/`OUTLOOK_PASS` env vars |
| **Manual** (fallback) | `outreach/send.py` | One contact at a time, auto-copies to clipboard, any key marks sent |

**Authentication:** The Playwright senders (Outlook + Gmail) open a visible Chrome window and wait up to 2 minutes for you to log in manually — including MFA/2FA. No credentials are ever stored. The SMTP sender requires an app password set as environment variables.

### Follow-up Cadence

Run `outreach/followup.py` periodically starting ~1 week after first sends:

- **Day 6** — Brief follow-up re-stating the light commitment (~1 hr/week)
- **Day 14** — Graceful exit ("I'll assume timing isn't right")

Skips contacts that have already replied or opted out.

## Setup

### Prerequisites

- Node.js 18+ (for scraper and auto-send scripts)
- Python 3.9+ (for send/followup/merge scripts)
- An Outlook or Gmail account (for email sending)

### Installation

```bash
# Install Node dependencies (Playwright for auto-send)
cd scrapers && npm install && cd ..

# Install Python dependencies (standard library only — no pip needed)

# Install Playwright browser
npx playwright install chromium
```

### Configuration

1. **Set environment variables for email:**
   ```bash
   export OUTLOOK_EMAIL='your_email@outlook.com'
   export OUTLOOK_PASS='your_app_password'
   ```

2. **Prepare your contact CSVs** from the templates in `outreach/templates/`:
   ```bash
   # Copy template to working file
   cp outreach/templates/uw_contacts_raw.csv.example outreach/uw_contacts_raw.csv
   # Populate with your contacts (see template headers for schema)
   ```

3. **Bootstrap the state-tracking CSV:**
   ```bash
   python3 outreach/prep_outreach_csv.py
   ```
   This upgrades `uw_contacts_raw.csv` → `uw_contacts_outreach.csv` with all state-tracking columns (contact_id, draft_status, send_status, reply_status, follow-up statuses, final_status, notes).

4. **Configure your scraper** in `scrapers/config.mjs`:
   ```js
   // Optional: restrict to specific email domains (leave empty to accept any)
   export const TARGET_DOMAINS = [];               // e.g. ["example.org", "school.edu"]
   export const SOURCE_LABEL      = "web research"; // Short label for your data source
   export const SOURCE_DESCRIPTION = "Contact discovered via web scraping and research";
   export const DEFAULT_DEPARTMENT = "Unknown";     // Fallback when department can't be inferred
   ```

5. **Update placeholders** across all source files (search for `[YOUR_`, `[COLEAD_`):
   - `[YOUR_NAME]` → your full name
   - `[YOUR_EMAIL]` → your full email address
   - `[YOUR_FIRST_NAME]` → your preferred first name
   - `[COLEAD_NAME]` / `[COLEAD_EMAIL]` / `[COLEAD_FIRST_NAME]` → co-lead details

### Sending Pipeline

```
1. Raw CSV  ──►  prep_outreach_csv.py  ──►  State-tracking CSV
2. State CSV ──►  3× Drafter Agents     ──►  /tmp/drafts_{A,B,C}.json
3. Drafts    ──►  merge_drafts.py       ──►  CSV (draft_status=drafted)
4. Review    ──►  Manual approval       ──►  CSV (draft_status=approved)
5. Approved  ──►  uw_auto_send.js  ──►  CSV (send_status=sent)
6. Sent      ──►  followup.py           ──►  Follow-ups at day 6, 14
```

### Scraper Pipeline (for discovering new contacts)

The scrapers extract contacts from a research event/registry API:

```
fetch_all_entries.mjs  →  raw_entries.json
map_campus.mjs         →  Filter to main campus + classify tracks
generate_csv.mjs       →  Structured CSV with roles + descriptions
enrich_departments.mjs →  Session tag → department inference
fix_descriptions.mjs   →  Auto-generate personalized descriptions
final_csv.mjs          →  Final assembly
```

Run from project root: `node scrapers/fetch_all_entries.mjs` then follow the pipeline.

## Vault Documentation

The `bubblyAIC/` directory is an Obsidian vault. Open it with [Obsidian](https://obsidian.md) for wikilink navigation, or read the markdown files directly.

**Reading order:**
1. `bubblyAIC/VAULT_GUIDE.md` — how to navigate
2. `bubblyAIC/outreach/AIC AI+X Research Program.md` — master program reference
3. `bubblyAIC/outreach/Phase Overview.md` — current status

**Update protocol:** When making program decisions or completing outreach work, update the vault in this order: master doc first → dependent notes second → task log last. See `VAULT_GUIDE.md` for the full trigger → action map.

## Security Notes

- **Never commit CSV data files** — they contain real contacts. The `.gitignore` excludes all `outreach/*.csv`, `outreach/*.json`, and `scrapers/*.json` files.
- **Never hardcode credentials** — send scripts read from environment variables only.
- **Send logs** (`auto_sent_log.txt`, `manual_sent_log.txt`, `sent_emails.csv`) are gitignored.
- **Local config files** (`.claude/`, `opencode.json`, `.env`) are gitignored.
- Template CSV headers are provided in `outreach/templates/` as `.example` files.

## License

MIT
