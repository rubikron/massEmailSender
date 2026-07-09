import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture API requests
const apiCalls = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('api.fourwaves.com') || url.includes('schedule') || url.includes('abstract')) {
    apiCalls.push(url);
  }
});

console.log('Navigating to schedule page...');
await page.goto('https://event.fourwaves.com/uw-2026urs/schedule', {
  waitUntil: 'networkidle',
  timeout: 30000
});

console.log('Page title:', await page.title());

// Wait for content
await page.waitForTimeout(3000);

// Get the visible text content
const bodyText = await page.textContent('body');
console.log('\n=== BODY TEXT (first 4000 chars) ===');
console.log(bodyText.substring(0, 4000));

console.log('\n=== API CALLS ===');
for (const call of apiCalls) {
  console.log(call);
}

await browser.close();
