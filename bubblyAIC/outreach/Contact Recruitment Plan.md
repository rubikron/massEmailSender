# Contact Recruitment Plan

> **⚠️ Adaptation note:** This document provides a general recruitment plan template. To adapt for your institution:
> - Replace institution name placeholders with your organization's details
> - Populate the Source Map with your institution's departments and lab URLs
> - Update department patterns and filtering criteria accordingly
> - The pipeline structure (scrape → enrich → filter → CSV) is institution-agnostic

**Goal:** Build a list of 200+ active researchers (Masters, early PhD, research undergrads) across 3 tracks.
**Target conversion:** 10 confirmed within 3 weeks.
**Filter criteria:** Currently at target institution, has done research in a lab, uses or could use ML techniques.

---

## Source Map

### Track 1: Tech (CS / Engineering)

#### Lab Websites (grad student directories)
Identify research labs in your institution's CS and engineering departments. Common sources:
- Faculty lab pages with "People" or "Team" sections listing grad students
- Department graduate student directories
- Research group websites with member listings

**Typical yield:** 100-160 contacts from CS/engineering labs

#### Department Directories
- CS/Engineering graduate student directory
- Information school / informatics graduate students

### Track 2: Health

#### Sources
Identify health-related research groups and departments:
- Medical school research labs and institutes
- Genomics / bioinformatics departments
- Health informatics programs
- Nursing / public health research centers
- Cross-listed CS + health/medicine labs

**Typical yield:** ~100-130 contacts

### Track 3: Economics/Business

#### Sources
Identify business and economics research groups:
- Business school research programs and centers
- Economics PhD program pages
- Information systems / business analytics departments
- Statistics and data science programs
- Cross-listed CS + business/econ labs

**Typical yield:** ~80-120 contacts

### Cross-Track Sources
| Source | What |
|--------|------|
| LinkedIn search | Institution name + "research" + "machine learning" + Masters/PhD |
| Graduate research directory | Central graduate school directory |
| Research computing users | High-performance computing user lists |
| Event/symposium registries | API or scraped participant lists from research events |

**Cross-track bonus estimate: ~50-80 unique new contacts**

---

## Execution Plan

### Phase 1: Lab Scraping (Days 1-3)
**Parallel waves of WebFetch on lab directories**

Each wave: Fetch lab page → extract names, emails, research areas, personal site links → save to CSV.

**Wave 1: CS/Engineering Labs** (highest yield, known structure)
- Launch 5-6 parallel WebFetch calls per wave
- Each wave extracts: name, email, research area, personal site URL
- Cross-reference with existing `contacts_raw.csv` to avoid duplicates

**Wave 2: Health Labs**
- eHealth, Genome Sciences, Nursing, Public Health
- Same extraction pipeline

**Wave 3: Business/Econ**
- Business school programs, Economics, Information school
- Same extraction pipeline

### Phase 2: Deep Profile (Days 2-5)
For each contact found in Phase 1:
- Fetch personal website/portfolio if available
- Extract: publications, current research focus, lab affiliation
- Generate brief personalized description (1-2 sentences)
- Filter: Currently active at target institution? Has ML research experience or relevant domain knowledge?

### Phase 3: LinkedIn Supplement (Days 3-7)
- Search LinkedIn for: institution name + "machine learning" + "Masters"/"PhD"/"research"
- Filter for: Current institution status, lab experience, Python/ML skills
- Capture: Name, LinkedIn URL, department, research background
- Cross-reference to avoid duplicates

### Phase 4: Consolidation (Day 7)
- Merge all sources into single spreadsheet
- Deduplicate by name + email
- Filter: Remove inactive, faculty-only, non-research
- Final columns: name, linkedin, email, department, research_experience, track, personalized_description
- Sort by: Track → department → research_depth

### Phase 5: Quality Gate
- Verify all contacts are active at target institution
- Ensure personalized descriptions reference recent work
- Confirm 200+ unique contacts
- Spot-check 10% for accuracy

---

## Output Format
```csv
name,linkedin,email,department,research_experience,track,personalized_description
```

Same schema as existing `contacts_raw.csv` for seamless merge.

---

## Filtering Criteria

**Include if:**
- Current Masters/PhD/early-stage PhD student at target institution
- Research undergrad with publications or lab experience
- Has used ML techniques in their work OR has domain expertise where AI application is obvious
- Currently at target institution (not graduated, not transferred)

**Exclude if:**
- Faculty (unless also a student)
- Postdocs (too senior)
- Alumni/graduated
- Purely administrative roles
- No research involvement

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Web tools broken | Can't scrape | Manual URL list; user runs fetches |
| Lab pages restructured | Empty results | Fallback: WebSearch + LinkedIn |
| Duplicate contacts | Bloat | Dedup by name+email hash |
| Inactive contacts | Wasted outreach | Cross-ref with current enrollment |
| Missing emails | Gaps | Infer from institutional email convention or search directories |

---

## Success Criteria
- [ ] 200+ verified contacts
- [ ] ~70 from Tech track
- [ ] ~60 from Health track
- [ ] ~60 from Econ/Business track
- [ ] All have personalized descriptions
- [ ] All currently active at target institution
- [ ] CSV ready for email drafting agent

---
Created: 2026-05-19
