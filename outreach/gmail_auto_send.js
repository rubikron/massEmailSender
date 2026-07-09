#!/usr/bin/env node
/**
 * Research Mentor Outreach — Gmail Auto Sender
 *
 * Reads uw_contacts_outreach.csv, sends emails via Gmail web interface
 * (mail.google.com) for all contacts with draft_status=approved and
 * send_status=pending, then updates the CSV with send_status=sent and
 * sent_at timestamp.
 *
 * Usage (from project root):
 *   node outreach/gmail_auto_send.js
 *
 * Key differences from the Outlook sender (uw_auto_send.js):
 *   - Gmail uses different selectors for compose, To, Subject, Body, Send
 *   - Gmail loads as a SPA — wait for elements to be ready after each action
 *   - Gmail's compose window opens as a popup/overlay
 *   - Gmail body field uses contenteditable div (not execCommand-reliant)
 *   - Gmail daily limits: ~500 regular, ~2000 Workspace
 */

const { chromium } = require('../scrapers/node_modules/playwright');
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const CSV_PATH  = path.join(__dirname, 'uw_contacts_outreach.csv');
const GMAIL_URL = 'https://mail.google.com/mail/u/0/#inbox';
const DELAY_MS  = 4000;
const BATCH_CAP = 50;  // warn above this — Gmail limits ~500/day regular, ~2000 Workspace

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let field = '', inQuotes = false, row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')            { inQuotes = false; }
      else                            { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else                  { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function serializeCSV(headers, rows) {
  const quoteField = (val) => '"' + String(val).replace(/"/g, '""') + '"';
  const lines = [headers.map(quoteField).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => quoteField(row[h] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

function loadContactsFromText(text) {
  const [headerRow, ...dataRows] = parseCSV(text);
  const headers = headerRow;
  const contacts = dataRows.map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, contacts };
}

function loadContacts() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  return loadContactsFromText(text);
}

function saveContacts(headers, contacts) {
  fs.writeFileSync(CSV_PATH, serializeCSV(headers, contacts), 'utf8');
}

/**
 * Filter contacts to only those with draft_status=approved AND send_status=pending.
 * Uses exact matching (no trimming) — whitespace in CSV fields is treated as data.
 */
function filterPendingContacts(contacts) {
  return contacts.filter(c =>
    c.draft_status === 'approved' && c.send_status === 'pending'
  );
}

/**
 * Update a contact's send_status to 'sent' with an ISO timestamp.
 * Throws if contact_id is not found.
 */
function updateContactSent(contacts, contactId) {
  const idx = contacts.findIndex(c => c.contact_id === contactId);
  if (idx === -1) {
    throw new Error(`contact_id "${contactId}" not found`);
  }
  contacts[idx].send_status = 'sent';
  contacts[idx].sent_at     = new Date().toISOString();
  return contacts[idx];
}

/**
 * Returns true if the given count exceeds BATCH_CAP and a warning should be shown.
 */
function shouldWarnBatchCap(count) {
  return count > BATCH_CAP;
}

// Strip **markdown** bold from email body before sending
function stripMarkdown(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

// ── Prompt helper ─────────────────────────────────────────────────────────────

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans); }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Gmail selectors (covers new Gmail UI; falls back across variants) ─────────

const SEL = {
  compose: [
    'div[role="button"][gh="cm"]',
    '[aria-label*="Compose" i]',
    'div.T-I.J-J5-Ji.T-I-KE.L3',
  ],
  to: [
    '[aria-label*="To recipients" i]',
    '[aria-label*="To" i]',
    'input[peoplekit-id]',
    'textarea[name="to"]',
  ],
  subject: [
    'input[name="subjectbox"]',
    '[aria-label*="Subject" i]',
  ],
  body: [
    'div[aria-label*="Message Body" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div.Am.Al.editable[contenteditable="true"]',
  ],
  send: [
    'div[aria-label*="Send" i][role="button"]:not([aria-disabled="true"])',
    'div[role="button"][aria-label*="Send" i]',
    'div.T-I.J-J5-Ji.aoO.T-I-atl.L3',
  ],
};

async function firstVisible(page, selectors, timeout = 12_000) {
  const result = await Promise.race(
    selectors.map(sel =>
      page.waitForSelector(sel, { state: 'visible', timeout })
        .then(() => sel)
        .catch(() => null)
    )
  );
  if (!result) throw new Error(`Selectors not found: ${selectors.join(', ')}`);
  return result;
}

async function waitForInbox(page) {
  console.log('\nWaiting for Gmail login (up to 2 min)...');
  console.log('Please log in manually in the opened Chrome window.\n');
  await firstVisible(page, SEL.compose, 120_000);
  console.log('Gmail inbox loaded.\n');
}

async function sendOneEmail(page, { email, subject, body }) {
  // Click Compose
  const composeSel = await firstVisible(page, SEL.compose);
  await page.click(composeSel);

  // Wait for compose popup to appear, then fill To
  const toSel = await firstVisible(page, SEL.to, 15_000);
  await page.fill(toSel, email);
  // Pause briefly for Gmail's contact auto-resolve (if any)
  await sleep(800);

  // Fill Subject
  const subjectSel = await firstVisible(page, SEL.subject, 10_000);
  await page.fill(subjectSel, subject);

  // Fill Body — Gmail uses a contenteditable div, not a textarea.
  // Strategy: click to focus, then use keyboard.insertText for instant input.
  const bodySel = await firstVisible(page, SEL.body, 10_000);
  await page.click(bodySel);

  // Select any existing content and replace with our body text
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(body);
  await sleep(300);

  // Send
  const sendSel = await firstVisible(page, SEL.send, 10_000);
  await page.click(sendSel);

  // Wait for compose to close — the "Message sent" toast appears briefly,
  // then the compose window disappears. Wait until compose button is visible
  // again (same pattern as Outlook sender).
  await firstVisible(page, SEL.compose, 15_000);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { headers, contacts } = loadContacts();

  const pending = filterPendingContacts(contacts);

  console.log('\n' + '='.repeat(56));
  console.log(' AIC Research Mentor Outreach — Gmail Auto Sender');
  console.log('='.repeat(56));
  console.log(` CSV            : ${CSV_PATH}`);
  console.log(` Approved+ready : ${pending.length}`);
  console.log('='.repeat(56) + '\n');

  if (pending.length === 0) {
    console.log('No approved emails pending. Set draft_status=approved in the CSV first.');
    return;
  }

  if (shouldWarnBatchCap(pending.length)) {
    console.log(`⚠  ${pending.length} emails queued. Gmail limits ~500/day (regular) or ~2000/day (Workspace).`);
    console.log(`   Consider capping this run at ${BATCH_CAP}.\n`);
  }

  const ans = await prompt(`Send to ${pending.length} contacts? (yes / number to limit / Ctrl+C): `);
  const limit = ans.trim().toLowerCase() === 'yes' ? pending.length : parseInt(ans, 10);
  if (!limit || isNaN(limit)) { console.log('Aborted.'); return; }
  const batch = pending.slice(0, limit);

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(GMAIL_URL);
  await waitForInbox(page);

  let sent = 0, failed = 0;

  for (const contact of batch) {
    const label = `[${sent + 1}/${batch.length}] ${contact.name} (${contact.email})`;
    process.stdout.write(`${label} ... `);

    try {
      await sendOneEmail(page, {
        email:   contact.email,
        subject: contact.subject_line,
        body:    stripMarkdown(contact.email_draft),
      });

      // Update CSV immediately after each send
      updateContactSent(contacts, contact.contact_id);
      saveContacts(headers, contacts);

      sent++;
      console.log('sent ✓');
    } catch (err) {
      failed++;
      console.log(`FAILED — ${err.message}`);
      // Try to recover: escape any open compose/dialog windows
      try {
        await page.keyboard.press('Escape');
        await sleep(500);
        await firstVisible(page, SEL.compose, 5_000);
      } catch { /* ignore recovery errors */ }
    }

    if (sent + failed < batch.length) await sleep(DELAY_MS);
  }

  console.log('\n' + '='.repeat(56));
  console.log(` Sent   : ${sent}`);
  console.log(` Failed : ${failed}`);
  console.log(` CSV    : ${CSV_PATH}`);
  console.log('='.repeat(56) + '\n');

  await prompt('Done! Press Enter to close the browser...');
  await browser.close();
}

// Only run main when executed directly (not when required for tests)
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

// ── Exports for testing ──────────────────────────────────────────────────────

module.exports = {
  parseCSV,
  serializeCSV,
  loadContactsFromText,
  loadContacts,
  saveContacts,
  filterPendingContacts,
  updateContactSent,
  shouldWarnBatchCap,
  stripMarkdown,
  BATCH_CAP,
  GMAIL_URL,
  DELAY_MS,
  CSV_PATH,
};
