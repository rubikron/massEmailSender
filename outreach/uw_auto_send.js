#!/usr/bin/env node
/**
 * Research Mentor Outreach — Auto Sender
 *
 * Reads uw_contacts_outreach.csv, sends emails via Outlook Web for all
 * contacts with draft_status=approved and send_status=pending,
 * then updates the CSV with send_status=sent and sent_at timestamp.
 *
 * Usage (from project root):
 *   node outreach/uw_auto_send.js
 *
 * Note: The "uw_" prefix in filenames is a dataset label — this script
 * has no institution-specific logic and works with any CSV that follows
 * the same column schema.
 */

const { chromium } = require('../scrapers/node_modules/playwright');
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const CSV_PATH  = path.join(__dirname, 'uw_contacts_outreach.csv');
const DELAY_MS  = 4000;
const BATCH_CAP = 50;  // warn above this — M365 rate limits kick in around 300/day

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

function loadContacts() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const [headerRow, ...dataRows] = parseCSV(text);
  const headers = headerRow;
  const contacts = dataRows.map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, contacts };
}

function saveContacts(headers, contacts) {
  fs.writeFileSync(CSV_PATH, serializeCSV(headers, contacts), 'utf8');
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

// ── Outlook selectors (covers both compose UIs) ───────────────────────────────

const SEL = {
  newMail: ['[aria-label="New mail"]', '[aria-label="New message"]', 'button[title="New mail"]'],
  to:      ['[aria-label="To"]', 'input[aria-label*="To" i]', '[placeholder*="To" i]'],
  subject: ['[aria-label="Add a subject"]', '[aria-label="Subject"]', 'input[placeholder*="ubject" i]'],
  body:    [
    '[aria-label="Message body, press Alt+F10 to exit"]',
    '[aria-label*="Message body" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
  ],
  send:    ['[aria-label="Send"]', 'button[title="Send"]'],
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
  console.log('\nWaiting for Outlook login (up to 2 min)...');
  await firstVisible(page, SEL.newMail, 120_000);
  console.log('Logged in.\n');
}

async function sendOneEmail(page, { email, subject, body }) {
  // Open compose
  const newMailSel = await firstVisible(page, SEL.newMail);
  await page.click(newMailSel);

  // Fill To
  const toSel = await firstVisible(page, SEL.to, 15_000);
  await page.fill(toSel, email);
  await page.keyboard.press('Tab');

  // Fill Subject
  const subjectSel = await firstVisible(page, SEL.subject, 10_000);
  await page.fill(subjectSel, subject);

  // Fill Body — focus, select all, then inject via execCommand (instant, no per-keystroke delay)
  const bodySel = await firstVisible(page, SEL.body, 10_000);
  await page.click(bodySel);
  await page.keyboard.press('Meta+A');
  await page.evaluate((text) => {
    document.execCommand('selectAll');
    document.execCommand('insertText', false, text);
  }, body);
  await sleep(200);

  // Send
  const sendSel = await firstVisible(page, SEL.send, 10_000);
  await page.click(sendSel);

  // Wait for compose to close (compose disappears, inbox reappears)
  await firstVisible(page, SEL.newMail, 15_000);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const { headers, contacts } = loadContacts();

  const pending = contacts.filter(
    c => c.draft_status === 'approved' && c.send_status === 'pending'
  );

  console.log('\n' + '='.repeat(56));
  console.log(' AIC Research Mentor Outreach — Auto Sender');
  console.log('='.repeat(56));
  console.log(` CSV            : ${CSV_PATH}`);
  console.log(` Approved+ready : ${pending.length}`);
  console.log('='.repeat(56) + '\n');

  if (pending.length === 0) {
    console.log('No approved emails pending. Set draft_status=approved in the CSV first.');
    return;
  }

  if (pending.length > BATCH_CAP) {
    console.log(`⚠  ${pending.length} emails queued. M365 limits ~300/day.`);
    console.log(`   Consider capping this run at ${BATCH_CAP}.\n`);
  }

  const ans = await prompt(`Send to ${pending.length} contacts? (yes / number to limit / Ctrl+C): `);
  const limit = ans.trim().toLowerCase() === 'yes' ? pending.length : parseInt(ans, 10);
  if (!limit || isNaN(limit)) { console.log('Aborted.'); return; }
  const batch = pending.slice(0, limit);

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://outlook.cloud.microsoft/mail/inbox/id/AAQkADA3MTE4N2RhLThhMGMtNGI0Zi04ODJiLTAwN2U0YzNjNGY5ZAAQACrExlMmHAhFgbJFmSrrpOg%3D?deeplink=mail%2F');
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
      const idx = contacts.findIndex(c => c.contact_id === contact.contact_id);
      contacts[idx].send_status = 'sent';
      contacts[idx].sent_at     = new Date().toISOString();
      saveContacts(headers, contacts);

      sent++;
      console.log('sent ✓');
    } catch (err) {
      failed++;
      console.log(`FAILED — ${err.message}`);
      // Try to recover: escape any open compose window
      try {
        await page.keyboard.press('Escape');
        await firstVisible(page, SEL.newMail, 5_000);
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
})();
