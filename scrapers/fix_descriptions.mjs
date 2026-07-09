import { readFileSync, writeFileSync } from 'fs';
import { SOURCE_LABEL, SOURCE_DESCRIPTION } from './config.mjs';

const richData = JSON.parse(readFileSync('scrapers/symposiumContacts_rich.json', 'utf8'));

function cleanHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').
    replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').
    replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function generateDescription(entry) {
  const title = entry.title || '';
  const abstract = cleanHtml(entry.abstract || '');

  // Extract first sentence of abstract
  const firstSentence = abstract.split('.').filter(s => s.trim().length > 10)[0]?.trim() || '';

  if (firstSentence && title) {
    return `Undergrad researcher presenting "${title}" via ${SOURCE_LABEL}. ${firstSentence}.`;
  } else if (title) {
    return `Undergrad researcher presenting "${title}" via ${SOURCE_LABEL}.`;
  }
  return `Undergrad researcher via ${SOURCE_LABEL}.`;
}

// Add descriptions
for (const e of richData) {
  e.personalized_description = generateDescription(e);
}

// Regenerate CSV
const header = 'name,linkedin,email,department,research_experience,track,role,personalized_description';
const lines = [header];
for (const e of richData) {
  const escape = (s) => {
    s = String(s || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  lines.push([
    escape(e.name), escape(e.linkedin || ''), escape(e.email),
    escape(e.department), escape(SOURCE_DESCRIPTION),
    escape(e.track), escape(e.role), escape(e.personalized_description)
  ].join(','));
}

writeFileSync('outreach/symposiumContacts.csv', lines.join('\n') + '\n');
console.log(`✅ Final CSV with ${richData.length} contacts written`);

// Show sample
console.log('\nSample entries:');
for (const e of richData.slice(0, 5)) {
  console.log(`${e.name} | ${e.department} | ${e.track} | ${e.role} | ${e.email}`);
  console.log(`  "${e.personalized_description.substring(0, 120)}..."`);
  console.log();
}
