import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture ALL API calls
const allApiCalls = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('api.fourwaves.com')) {
    allApiCalls.push({ method: req.method(), url: url });
  }
});

console.log('Navigating to abstracts page...');
await page.goto('https://event.fourwaves.com/uw-2026urs/abstracts', {
  waitUntil: 'networkidle',
  timeout: 30000
});

console.log('Page title:', await page.title());
await page.waitForTimeout(3000);

// Get visible text
const bodyText = await page.textContent('body');
console.log('\n=== ABSTRACTS PAGE TEXT (first 3000 chars) ===');
console.log(bodyText.substring(0, 3000));

// Look for individual abstract links
const links = await page.$$eval('a', els => els.map(el => ({ href: el.href, text: el.textContent.trim().substring(0, 200) })).filter(el => el.text && el.text !== el.text.toUpperCase()));
console.log('\n=== LINKS WITH TEXT ===');
for (const link of links.slice(0, 80)) {
  console.log(link.href, '|', link.text);
}

// Check for presentation cards or items
const items = await page.$$eval('[class*="present"]', els => els.map(el => el.textContent.trim().substring(0, 100)).filter(t => t.length > 10));
console.log('\n=== PRESENT ITEMS ===');
for (const item of items.slice(0, 30)) {
  console.log(item);
}

console.log('\n=== API CALLS FROM ABSTRACTS PAGE ===');
for (const call of allApiCalls) {
  console.log(`${call.method} ${call.url}`);
}

await browser.close();
