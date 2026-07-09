# Obsidian Vault Guide

This vault lives at `bubblyAIC/` and tracks the AIC AI+X Research Program — strategy, outreach, and operational docs.

---

## How to Navigate

**Start here for program context:**
→ `outreach/AIC AI+X Research Program.md` — master reference. Single source of truth for the program structure, roles, timeline, cohort details, and deliverables. Read this before making any program-related decisions or drafting outreach.

**Start here for current status:**
→ `outreach/Phase Overview.md` — what phase we're in, what's done, what's next.

**Start here for what was done today:**
→ `outreach/Task Log.md` — running log of completed work, decisions made, and next steps.

---

## File Map

| File | What it is | When to read it |
|------|-----------|-----------------|
| `outreach/AIC AI+X Research Program.md` | **Master program doc** — roles, timeline, cohort, admissions, deliverables | Any time you need program context |
| `outreach/Phase Overview.md` | Phase status tracker — what's done, what's in progress | Checking current state of outreach |
| `outreach/Task Log.md` | Chronological work log | Understanding what was done and when |
| `outreach/Research Mentor Outreach.md` | Research Mentor recruitment pipeline — tiers, email templates, confirmed mentors | Working on mentor outreach |
| `outreach/Symposium Outreach Email.md` | Email template for Team Lead outreach (symposium contacts) | Working on team lead / symposium outreach |
| `outreach/Team Lead Program Description.md` | Full description of the Team Lead role | Drafting team lead outreach or answering questions about the role |
| `outreach/Contact Strategy.md` | Contact segmentation by role, track, and lab | Planning who to reach out to and in what order |
| `outreach/Outreach System.md` | **Multi-agent outreach system protocol** — state machine, drafter agent instructions, merge protocol, send/follow-up flows | Before running any outreach generation or send task |
| `outreach/Contact Recruitment Plan.md` | How the 349-contact list was built — sources, scraping plan, output format | Understanding where contacts came from |
| `README.md` | Vault-level readme | Orientation |

---

## Key Concepts

**Roles in the program (defined in master doc):**
- **Research Mentor** — PhD/Masters student. Advises 1 team on research/paper craft. ~1 hr/week. Gets co-authorship. Chooses their team.
- **Team Lead** — Domain expert. Supervises 2 teams on logistics/accountability. ~2 hrs/week.
- **Technical ML Advisor** — Industry practitioner. Delivers bootcamp only.
- **Program Director** — [YOUR_FIRST_NAME] + [COLEAD_FIRST_NAME]. Run everything.

**Tracks:** Tech (CS / Engineering), Health (Medicine / Genomics / Public Health), Economy (Business / Economics / Policy)

**Team formation timeline:** Applications open Fall Week 1, vetted over ~4 weeks, Research Mentors choose teams at Week 4, program begins.

---

## Outreach Data (lives in `outreach/` at project root, not in vault)

| File | Contents |
|------|----------|
| `outreach/all_contacts.csv` | Lab contacts (grad students, research mentors) — research mentor / advisor targets |
| `outreach/contacts_raw.csv` | PhD/Masters students — Research Mentor outreach targets |
| `outreach/eventContacts_with_emails.csv` | Event contacts with pre-generated email drafts — Team Lead outreach targets |
| `outreach/manual_sent_log.txt` | Emails sent via manual copy-paste tool |
| `outreach/auto_sent_log.txt` | Emails sent via Playwright automation |

---

## Wikilink Convention

Notes in this vault use `[[outreach/Note Name]]` syntax to cross-reference. The master program doc is the hub — all other notes link back to it for program context.

---

## Vault Update Protocol

**Any agent that makes a program decision, completes outreach work, or changes program details must update the vault before ending the session.** The vault is the memory. If it isn't written here, it didn't happen.

### Update Order (always follow this sequence)

1. **Master doc first** — if the change affects program structure, roles, timeline, or cohort details, update `outreach/AIC AI+X Research Program.md` first
2. **Dependent notes second** — update any notes that reference the changed detail
3. **Task Log last** — always log what was done with today's date

### Trigger → Action Map

| What happened | What to update |
|---------------|---------------|
| Program structure changed (roles, timeline, cohort size, admission bar) | Master doc → any dependent notes that reference it |
| Phase status changed (e.g., Phase 1 complete, Phase 2 starting) | `Phase Overview.md` — mark phase done/in-progress, update "Current Phase" and "Last Updated" |
| Outreach emails sent (batch or manual) | `Task Log.md` — log count, target list, date. Update `Phase Overview.md` if a phase just completed |
| Research Mentor confirmed | `Research Mentor Outreach.md` — move contact to "Confirmed Advisors" table with date |
| New email template drafted or revised | The relevant template note (e.g., `Research Mentor Outreach.md`, `Symposium Outreach Email.md`) |
| New contacts added to a CSV | `Task Log.md` — log source, count, and output file |
| Any outreach copy finalized | The relevant outreach note — never leave a template as "To be drafted" if it's been drafted |
| Program decision made (e.g., co-authorship policy, mentor selection process) | Master doc under the relevant section |

### Task Log Format

Always append to `Task Log.md` using this format:

```
## YYYY-MM-DD

### [Work Category]
- [x] What was done — specific output or file affected
- [x] What was done — specific output or file affected

### Next Steps
- [ ] What still needs to happen
```

### What NOT to do

- Don't update only the Task Log and skip the master doc — the log is a record, not a reference
- Don't leave placeholder text like "_To be drafted_" in notes after the work is done
- Don't create new notes for things that belong in existing notes — check the file map first
- Don't duplicate information across notes — one place owns each fact, others link to it
