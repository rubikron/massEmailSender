import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// We need to get the form options. Let's try to fetch the form API directly.
// The form ID is 382317ba-0311-4f9f-bec8-37e208c4f214
// Let's try the form-fields API

console.log('Fetching form...');
const formResp = await fetch('https://api.fourwaves.com/api/forms/382317ba-0311-4f9f-bec8-37e208c4f214', {
  headers: { 'Accept': 'application/json' }
});
console.log('Status:', formResp.status);

if (formResp.ok) {
  const form = await formResp.json();
  console.log(JSON.stringify(form, null, 2).substring(0, 5000));
} else {
  // Try to navigate to the site and capture the form API call
  console.log('Direct fetch failed. Trying browser approach...');
  const formCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('forms') || url.includes('fields')) {
      formCalls.push(url);
    }
  });
  await page.goto('https://event.fourwaves.com/uw-2026urs/abstracts', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('Form API calls:');
  for (const call of formCalls) console.log('  ' + call);
}

await browser.close();
