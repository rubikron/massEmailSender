#!/usr/bin/env node
/**
 * Outlook Web auto-sender
 * 1. Opens a visible Chrome browser → you log in manually (handles MFA)
 * 2. Loops through contacts and composes + sends each email automatically
 * 3. Saves progress so you can quit and resume anytime
 *
 * Run from project root:
 *   node outreach/auto_send.js
 */

const { chromium } = require('../scrapers/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CSV_PATH  = 'outreach/symposiumContacts_filtered.csv';
const LOG_PATH  = 'outreach/auto_sent_log.txt';
const DELAY_MS  = 3000;   // pause between sends (be gentle on Outlook)
const BATCH_WARN = 300;   // warn if trying to send more than this in one go

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let field = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadContacts() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const [_header, ...rows] = parseCSV(text);
  return rows.map(r => {
    const draft = r[9] || '';
    const newlineIdx = draft.indexOf('\n');
    const subject = newlineIdx !== -1
      ? draft.slice(0, newlineIdx).replace(/^Subject:\s*/, '').trim()
      : '';
    const body = newlineIdx !== -1 ? draft.slice(newlineIdx + 1).trim() : draft;
    return { name: r[0], email: r[2], subject, body };
  }).filter(c => c.email);
}

function loadDone() {
  if (!fs.existsSync(LOG_PATH)) return new Set();
  return new Set(fs.readFileSync(LOG_PATH, 'utf8').split('\n').map(l => l.trim()).filter(Boolean));
}

function markDone(email) {
  fs.appendFileSync(LOG_PATH, email + '\n');
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Outlook Web helpers ───────────────────────────────────────────────────────

// Try selectors in order, return the first one that appears within timeout.
async function firstVisible(page, selectors, timeout = 10_000) {
  const found = await Promise.race(
    selectors.map(sel =>
      page.waitForSelector(sel, { timeout }).then(() => sel).catch(() => null)
    )
  );
  if (!found) throw new Error(`None of these selectors found: ${selectors.join(', ')}`);
  return found;
}

// Outlook ships two compose UIs; cover both with fallback selectors.
const SELECTORS = {
  newMail:  ['[aria-label="New mail"]', '[aria-label="New message"]', 'button[title="New mail"]'],
  to:       ['[aria-label="To"]', 'input[aria-label*="To" i]', '[placeholder*="To" i]'],
  subject:  ['[aria-label="Add a subject"]', '[aria-label="Subject"]', 'input[placeholder*="subject" i]'],
  body:     [
    '[aria-label="Message body, press Alt+F10 to exit"]',
    '[aria-label*="Message body" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
  ],
  send:     ['[aria-label="Send"]', 'button[title="Send"]'],
};

async function waitForInbox(page) {
  console.log('\nWaiting for you to log in to Outlook...');
  await firstVisible(page, SELECTORS.newMail, 120_000);
  console.log('Logged in. Starting sends.\n');
}

async function sendEmail(page, { email, subject, body }) {
  const newMailSel = await firstVisible(page, SELECTORS.newMail);
  await page.click(newMailSel);

  // Wait for compose panel to fully animate in
  const toSel = await firstVisible(page, SELECTORS.to);
  await page.fill(toSel, email);
  await page.keyboard.press('Tab');

  const subjectSel = await firstVisible(page, SELECTORS.subject);
  await page.fill(subjectSel, subject);

  const bodySel = await firstVisible(page, SELECTORS.body);
  await page.click(bodySel);
  await page.keyboard.press('Meta+A');
  await page.evaluate((text) => {
    document.execCommand('selectAll');
    document.execCommand('insertText', false, text);
  }, body);
  await sleep(200);

  const sendSel = await firstVisible(page, SELECTORS.send);
  await page.click(sendSel);

  // Wait for compose window to close
  await firstVisible(page, SELECTORS.newMail);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const contacts = loadContacts();
  const done = loadDone();
  const remaining = contacts.filter(c => !done.has(c.email));
  const total = contacts.length;

  console.log(`\n${'='.repeat(56)}`);
  console.log(` Outlook Auto-Sender`);
  console.log(`${'='.repeat(56)}`);
  console.log(` Total contacts : ${total}`);
  console.log(` Already sent   : ${done.size}`);
  console.log(` Remaining      : ${remaining.length}`);
  console.log(`${'='.repeat(56)}\n`);

  if (remaining.length === 0) {
    console.log('Nothing left to send!');
    return;
  }

  if (remaining.length > BATCH_WARN) {
    console.log(`⚠  You're about to send ${remaining.length} emails.`);
    console.log(`   Microsoft 365 limits vary; large batches may trigger rate limits.`);
    console.log(`   Consider running in batches of ${BATCH_WARN} per day.\n`);
  }

  const ans = await prompt(`Send to first ${remaining.length} contacts? (yes / number to limit / Ctrl+C to cancel): `);
  const limit = ans.toLowerCase() === 'yes' ? remaining.length : parseInt(ans, 10);
  if (!limit || isNaN(limit)) { console.log('Aborted.'); return; }
  const batch = remaining.slice(0, limit);

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://outlook.cloud.microsoft/mail/inbox/id/AAQkADA3MTE4N2RhLThhMGMtNGI0Zi04ODJiLTAwN2U0YzNjNGY5ZAAQACrExlMmHAhFgbJFmSrrpOg%3D?deeplink=mail%2F');
  await waitForInbox(page);

  let sent = 0;
  let failed = 0;

  for (const contact of batch) {
    process.stdout.write(`[${sent + 1}/${batch.length}] ${contact.name} (${contact.email}) ... `);
    try {
      await sendEmail(page, contact);
      markDone(contact.email);
      sent++;
      console.log('sent');
    } catch (err) {
      failed++;
      console.log(`FAILED — ${err.message}`);
      // Try to recover: close any open compose windows and go back to inbox
      try {
        await page.keyboard.press('Escape');
        await page.waitForSelector('[aria-label="New mail"]', { timeout: 5_000 });
      } catch { /* ignore recovery errors */ }
    }

    if (sent + failed < batch.length) await sleep(DELAY_MS);
  }

  console.log(`\n${'='.repeat(56)}`);
  console.log(` Sent   : ${sent}`);
  console.log(` Failed : ${failed}`);
  console.log(` Log    : ${LOG_PATH}`);
  console.log(`${'='.repeat(56)}\n`);

  await prompt('Done! Press Enter to close the browser...');
  await browser.close();
})();
