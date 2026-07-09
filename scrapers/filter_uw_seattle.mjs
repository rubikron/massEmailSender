import { readFileSync, writeFileSync } from 'fs';
import { isValidEmail } from './config.mjs';

// ⚠️ ADAPTATION REQUIRED: This is an exploration/debugging script for filtering
// entries by institution affiliation. Replace the hardcoded institution patterns
// (affiliation regexes, department names, etc.) for your school.
// See config.mjs for shared institution constants.

// Load all entries
const entries = JSON.parse(readFileSync('scrapers/raw_entries.json', 'utf8'));

// Session tag mapping (UUID → name)
const sessionTags = {
  "057cba27-06f4-436d-9802-4f913825ef66": "Anthropology",
  "3d2a4219-ae7c-4c51-9f12-400bf2db1f1e": "Architecture & Urban Planning",
  "4658e9be-003f-4c2a-b439-6d0263b1022b": "Art, Art History, & Design",
  "ba3fd42d-3a54-47f2-a77c-516cb579f026": "Biochemistry",
  "5119cae8-ad0a-4f0b-a47b-30ef03012e02": "Biology: Ecology, Evolution, and Conservation",
  "866b2302-5eb6-4ec3-b164-f71d31d3c0af": "Biology: General",
  "5e6a9110-e523-44c0-a067-fe3f54314548": "Biology: Physiology",
  "7102cef6-5c6d-4e45-ac0d-4203e77bca76": "Biology: Plant",
  "cf951d8a-dc4c-45a9-91f7-400e0bae2b63": "Chemistry",
  "9e76ed82-9536-4b3d-9da5-347f133a0959": "Computer Science & Informatics",
  "2d608020-3010-425c-bd42-4a4b340b0b18": "Dance",
  "04b3e29b-a862-472f-aa85-8d733a0a767c": "Digital Media & Moving Images",
  "41ac5954-c0b7-437e-8315-f1c467a2338e": "Drama/Theatre",
  "5151e473-b376-449c-8112-295af9a45da8": "Education",
  "0df1d901-bc73-4006-bdad-e742f79fe802": "Engineering: Air & Space",
  "05656e98-9069-4008-b65d-4ae1135d600a": "Engineering: Computing, Data, & Technologies",
  "65d78bd5-ba8a-4080-a847-5fda1b77cd07": "Engineering: Environment, Sustainability, & Energy",
  "bd2cbfc7-a2e3-4026-b2ac-85109c7dd136": "Engineering: Health & Medicine",
  "a4c35a76-1f7c-4544-b8af-b87dd8d5cde2": "Engineering: Infrastructure, Transportation, & Society",
  "290299ba-63b3-4586-baa1-dff2901e2402": "Engineering: Robotics & Manufacturing",
  "fa740b5f-259f-432d-98b6-4c30adc5ebe6": "Environmental Sciences",
  "c0327f60-bfba-4092-a593-cb11897b2673": "Global & Public Health",
  "8d2c8ad3-d8c4-4f30-9c4f-b706ae36d757": "Humanities",
  "2c91e601-d0c5-4a9a-8365-803421f4c9fe": "Mathematics",
  "9b3f7c77-3c22-4e7a-ae10-b52c59bde6e5": "Music",
  "b4ed8edb-4650-467b-a17a-82d09e8da12d": "Neuroscience",
  "a0cde5b3-b94a-4a06-b250-458a3b1c73d5": "Physical Sciences",
  "2e20aaa2-a314-4599-a761-57784a0283a9": "Psychology",
  "ad533a95-63f5-4e13-9759-4e9c6b358a53": "Sculpture",
  "ecab8b07-fc5b-4d98-90fc-ed1792945574": "Social Sciences",
  "fcf39aa3-0e72-4f93-84a6-da807de1d06f": "Biology: Molecular, Cellular, and Developmental"
};

// Affiliations that are clearly UW Seattle
const uwSeattlePatterns = [
  /^university of washington$/i,
  /^university of washington seattle$/i,
  /^uw seattle$/i,
  /^university of washington - seattle$/i,
  /^university of washington, seattle$/i,
  /^university of washington \(seattle\)$/i,
  /^university of washington- seattle$/i,
  /^university of washington, seattle$/i,
  /^university of washington-Seattle$/i,
  /^university of washington seattle campus$/i,
  /^uw - seattle$/i,
  /^university of washington, seattle\./i,
  /^university of washington at seattle$/i,
  /^university of washington, seattle$/i,
  // Specific labs/departments that are UW Seattle
  /^university of washington neuroscience$/i,
  /^university of washington, fred hutch$/i,
  /^university of washington, school of social work$/i,
  /^university of washington, department of orthopedics$/i,
  /^university of washington department of chemistry$/i,
  /^university of washington, diabetes institute$/i,
  /^university of washington, evans school$/i,
  /^university of washington, seattle children/i,
  /^university of washington, u?w medicine$/i,
  /^university of washington, n?emhauser lab$/i,
  /^biology$/i,
  /^university of washington, washington$/i,
  // Typos that clearly mean UW Seattle
  /^university of washington$/i,
  /^university of washington student$/i,
  /^university of washington, seattle$/i,
  /^university of washington - seattle$/i,
  /^university of washingotn$/i,
  /^university of washing, seattle$/i,
  /^university of washingto$/i,
];

// Affiliations to EXCLUDE
const uwNonSeattlePatterns = [
  /bothell/i,
  /tacoma/i,
  /uwb/i,
  /uwt/i,
];

// Other institutions to exclude (adapt for your region)
const otherInstitutionPatterns = [
  /^\[NEARBY_INSTITUTION_1\]/i,
  /^\[NEARBY_INSTITUTION_2\]/i,
];

function isUWSeattle(affiliation) {
  if (!affiliation) return false;

  // Exclude Bothell, Tacoma
  for (const pattern of uwNonSeattlePatterns) {
    if (pattern.test(affiliation)) return false;
  }

  // Exclude other institutions
  for (const pattern of otherInstitutionPatterns) {
    if (pattern.test(affiliation)) return false;
  }

  // Match UW Seattle patterns
  for (const pattern of uwSeattlePatterns) {
    if (pattern.test(affiliation)) return true;
  }

  // Handle case-insensitive "university of washington" variations
  const lower = affiliation.toLowerCase().trim();

  // Satellite campus exclusion is handled by uwNonSeattlePatterns above

  // Handle common "University of Washington" variants that aren't caught above
  if (
    lower === 'university of washington' ||
    lower === 'university of washington.' ||
    lower === 'university of washington' ||
    lower === 'university of washington`' ||
    lower === 'university of washington,' ||
    lower === 'university of washington, nemhauser lab' ||
    lower === 'university of washington, seattle'
  ) return true;

  // Handle entries where affiliation is a single department name that's UW
  if (lower === 'biology') return true;

  // Handle lowercase typos
  if (lower === 'university of washington') return true;

  return false;
}

// Also handle entries with empty affiliation
// Check if their email/advisor suggests UW
function isInferredUWSeattle(entry) {
  if (entry.affiliation) {
    return isUWSeattle(entry.affiliation);
  }
  // No affiliation — check if email suggests UW
  const advisorEmail = entry.advisorEmail || '';
  const studentEmail = entry.studentEmail || '';
  if (isValidEmail(advisorEmail)) return true;
  if (isValidEmail(studentEmail)) return true;
  return false;
}

// Tags that map to session tags
const tags = {};
for (const [uuid, name] of Object.entries(sessionTags)) {
  tags[uuid] = name;
}

// Filter entries
const uwSeattle = entries.filter(e => isInferredUWSeattle(e));
console.log(`Found ${uwSeattle.length} UW Seattle entries out of ${entries.length} total`);

// Count affiliations for UW Seattle entries
const affCounts = {};
for (const e of uwSeattle) {
  const aff = e.affiliation || '(null)';
  affCounts[aff] = (affCounts[aff] || 0) + 1;
}
console.log('\nUW Seattle affiliation breakdown:');
for (const [aff, count] of Object.entries(affCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}: ${aff}`);
}

// Now resolve tags → departments
// The tags field has comma-separated UUIDs, some of which map to session tags
// The department field has a UUID from a different set

// Let's look at what the top entries look like
console.log('\n=== SAMPLE UW SEATTLE ENTRIES ===');
for (const e of uwSeattle.slice(0, 20)) {
  const tagsList = e.tags ? e.tags.split(',').map(u => (tags[u] || u.substring(0, 8))).join(', ') : 'none';
  console.log(`${e.firstName} ${e.lastName} | ${e.title?.substring(0, 80)}`);
  console.log(`  tags: ${tagsList}`);
  console.log(`  advisor: ${e.advisorName} (${e.advisorEmail})`);
  console.log(`  dept UUID: ${e.department?.substring(0, 8)}`);
  console.log();
}

// Department UUID distribution for UW Seattle entries
console.log('\n=== DEPARTMENT UUIDS FOR UW SEATTLE ===');
const deptUuidCounts = {};
for (const e of uwSeattle) {
  if (e.department) {
    deptUuidCounts[e.department] = (deptUuidCounts[e.department] || 0) + 1;
  }
}
for (const [uuid, count] of Object.entries(deptUuidCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}: ${uuid.substring(0, 8)}...`);
}

// Tags for UW Seattle entries
console.log('\n=== TAGS FOR UW SEATTLE ===');
const tagCounts = {};
for (const e of uwSeattle) {
  if (e.tags) {
    for (const tag of e.tags.split(',')) {
      const name = tags[tag] || tag.substring(0, 8);
      tagCounts[name] = (tagCounts[name] || 0) + 1;
    }
  }
}
for (const [name, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}: ${name}`);
}
