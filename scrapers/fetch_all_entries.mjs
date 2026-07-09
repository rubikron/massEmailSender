import { writeFileSync } from 'fs';

const FORM_ID = "382317ba-0311-4f9f-bec8-37e208c4f214";
const BASE_URL = "https://api.fourwaves.com/api/form-entries/";
const PARAMS = new URLSearchParams({
  sortField: "number",
  sortDirection: "ascending",
  searchTerm: "",
  isPresentingNow: "false",
  isBookmarked: "false",
  formId: FORM_ID,
  pageSize: "18",
  isPublishedFilter: "true",
  filterCurrentUserReviews: "true",
  filteringType: "ContainsAll",
  submissionScope: "accepted",
  submissionDecisionsFilteringType: "ContainsAny",
  statusFilters: "Submitted",
  statusFilters: "Scheduled"
}).toString();

const allEntries = [];

// Fetch first page to understand the structure
console.log('Fetching page 1...');
const response1 = await fetch(`${BASE_URL}?${PARAMS.replace('page=', '&page=1')}`);
const data1 = await response1.json();
console.log('Total pages:', data1.totalPages, 'Total count:', data1.totalCount);

// Look at first entry to understand field mapping
const first = data1.items[0];
console.log('\nFirst entry values:');
for (const v of first.formEntryValues) {
  console.log(`  fieldId=${v.formFieldId.substring(0, 8)}... fieldType=${v.fieldType} value=${(v.value || '').substring(0, 100)}`);
}

// Fetch all pages
console.log(`\nFetching all ${data1.totalPages} pages...`);
for (let page = 1; page <= data1.totalPages; page++) {
  const url = `${BASE_URL}?${BASE_URL.includes('?') ? PARAMS.split('&').slice(1).join('&') : ''}&page=${page}`;
  // Build URL properly
  const params = new URLSearchParams();
  params.set('sortField', 'number');
  params.set('sortDirection', 'ascending');
  params.set('page', String(page));
  params.set('searchTerm', '');
  params.set('isPresentingNow', 'false');
  params.set('isBookmarked', 'false');
  params.set('formId', FORM_ID);
  params.set('pageSize', '18');
  params.set('isPublishedFilter', 'true');
  params.set('filterCurrentUserReviews', 'true');
  params.set('filteringType', 'ContainsAll');
  params.set('submissionScope', 'accepted');
  params.set('submissionDecisionsFilteringType', 'ContainsAny');
  params.set('statusFilters', 'Submitted');
  params.set('statusFilters', 'Scheduled');

  const resp = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!resp.ok) {
    console.error(`Page ${page} failed: ${resp.status}`);
    continue;
  }
  const data = await resp.json();
  allEntries.push(...data.items);
  if (page % 10 === 0) {
    console.log(`  Fetched page ${page}/${data1.totalPages} (${allEntries.length} entries)`);
  }
  // Be polite
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\nTotal entries fetched: ${allEntries.length}`);

// Parse each entry
function getField(entries, fieldId) {
  const found = entries.find(e => e.formFieldId === fieldId);
  return found ? found.value : null;
}

const fieldMap = {
  firstName: "65b4d9ee-5657-47f3-a4fe-94ebce900816",
  lastName: "48d29b3d-ca03-4c97-b584-e8049950bc1e",
  department: "c2ebc514-289f-4c86-9176-0394a278380c",    // UUID
  advisorEmail: "6bd09ea3-dab0-4a55-aacc-c6f79b7e747e",
  sessionType: "888df14b-72e5-4832-b325-271286162513",  // UUID
  tags: "db0d86ff-ec68-4ad2-a143-c36cf0f7bec9",         // UUIDs
  title: "fce60f4a-c9df-4032-b4d0-d645d92191af",
  abstract: "bda1d6bc-45d9-4db4-8cfe-31cc29c19646",
  advisorName: "83f8f93b-53fd-45da-b7c0-7d26efa273c5",
  presentationType: "2e8626cf-8f8b-4947-b488-5c4f53e59a4c", // UUID
  session: "6daecba7-9f17-4852-95f6-e839fec03977",      // UUID
};

// Parse entries
const parsed = allEntries.map(entry => {
  const values = entry.formEntryValues;
  const cleanHtml = html => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/</g, '<').replace(/>/g, '>').replace(/<\/[^>]*>/g, '').trim();
  };

  return {
    id: entry.id,
    number: entry.number,
    affiliation: entry.affiliation,
    firstName: getField(values, fieldMap.firstName),
    lastName: getField(values, fieldMap.lastName),
    department: getField(values, fieldMap.department),  // UUID
    advisorEmail: getField(values, fieldMap.advisorEmail),
    sessionType: getField(values, fieldMap.sessionType),  // UUID
    tags: getField(values, fieldMap.tags),  // UUIDs
    title: getField(values, fieldMap.title),
    abstract: cleanHtml(getField(values, fieldMap.abstract)),
    advisorName: getField(values, fieldMap.advisorName),
    presentationType: getField(values, fieldMap.presentationType), // UUID
    session: getField(values, fieldMap.session),  // UUID
  };
});

// Show a sample
console.log('\n=== SAMPLE ENTRIES (first 5) ===');
for (const e of parsed.slice(0, 5)) {
  console.log(`${e.firstName} ${e.lastName} | ${e.affiliation} | advisor: ${e.advisorName} (${e.advisorEmail})`);
  console.log(`  Title: ${e.title}`);
  console.log(`  Dept UUID: ${e.department}`);
  console.log(`  SessionType UUID: ${e.sessionType}`);
  console.log(`  Tags UUID: ${e.tags}`);
  console.log(`  PresentationType UUID: ${e.presentationType}`);
  console.log(`  Session UUID: ${e.session}`);
  console.log();
}

// Count unique affiliations
const affiliations = [...new Set(parsed.map(e => e.affiliation))];
console.log('\n=== UNIQUE AFFILIATIONS ===');
for (const aff of affiliations) {
  const count = parsed.filter(e => e.affiliation === aff).length;
  console.log(`${count}: ${aff}`);
}

// Save to JSON for further processing
writeFileSync('scrapers/raw_entries.json', JSON.stringify(parsed, null, 2));
console.log(`\nSaved all ${parsed.length} entries to raw_entries.json`);
