import { SOURCE_LABEL, SOURCE_DESCRIPTION,  readFileSync, writeFileSync } from 'fs';
import { SOURCE_LABEL, SOURCE_DESCRIPTION, 
  
  DEFAULT_DEPARTMENT
} from './config.mjs';

// Load enriched rich data and raw entries
const richData = JSON.parse(readFileSync('scrapers/symposiumContacts_rich.json', 'utf8'));
const rawEntries = JSON.parse(readFileSync('scrapers/raw_entries.json', 'utf8'));

// Session tags
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

const departmentPatterns = [
  { name: 'Computer Science', keywords: ['comput', 'algorithm', 'software', 'machine learn', 'neural network', 'ai ', 'deep learning', 'nlp', 'agent-based', 'simulation', 'reinforcement learn', 'computer vision', 'sparse autoencoder', 'multi-agent', 'llm', 'general-sum', 'conformal predict', 'cyber', 'programming', 'robotic', 'blockchain', 'quantum comput'] },
  { name: 'Mathematics', keywords: ['mathemat', 'theorem', 'algebra', 'topolog', 'number theor', 'probability', 'calculus', 'differential equation', 'tiling', 'symmetr', 'graph theory', 'persistent homology', 'homology'] },
  { name: 'Physics & Astronomy', keywords: ['physics', 'astrophysics', 'astronom', 'lensing', 'stellar', 'galactic', 'dark matter', 'exoplanet', 'technosignatur', 'cosmolog', 'gravitational', 'quantum physics', 'particle physics', 'galaxy'] },
  { name: 'Biology', keywords: ['biology', 'c. elegans', 'drosophila', 'synaptojanin', 'locomotion', 'axon', 'stem cell', 'exosome', 'mesenchymal', 'neuromuscular', 'nociception', 'cellular', 'molecular biolog', 'physiology', 'ecolog', 'conservation', 'evolution', 'plant biology'] },
  { name: 'Chemistry', keywords: ['chemical', 'chemistry', 'compound', 'molecular weight', 'reaction mechanism', 'synthesis', 'spectroscop'] },
  { name: 'Engineering', keywords: ['engineer', 'microfluid', 'nanoscale', 'sensor', 'device design', 'fabrication', 'electric vehicle', 'charging station', 'solar', 'renewable'] },
  { name: 'Psychology', keywords: ['psycholog', 'cognition', 'cognitive', 'behavior', 'mental health', 'depression', 'anxiety', 'memory', 'perception', 'attention', 'social interaction', 'wellbeing', 'belonging'] },
  { name: 'Neuroscience', keywords: ['neuroscience', 'brain', 'neural', 'synaptic', 'ssvep', 'gaze localization', 'eeg'] },
  { name: 'Environmental Science', keywords: ['environment', 'climate', 'sustainability', 'ecosystem', 'water quality', 'estuarine', 'puget sound', 'carbon'] },
  { name: 'Anthropology', keywords: ['anthropolog', 'cultural', 'ethnograph', 'archaeolog', 'primat'] },
  { name: 'Economics', keywords: ['econom', 'market', 'financial', 'incentive', 'pricing', 'demand', 'supply'] },
  { name: 'Political Science', keywords: ['political', 'government', 'policy', 'militarization', 'coup', 'democrat', 'law', 'rights', 'security'] },
  { name: 'Sociology', keywords: ['social science', 'sociolog', 'gender', 'race', 'power', 'inequal', 'social pres', 'belonging', 'community'] },
  { name: 'Education', keywords: ['educat', 'curriculum', 'exam', 'student performance', 'learning'] },
  { name: 'Art & Design', keywords: ['art', 'design', 'visual cultur', 'music', 'drama', 'theatre', 'dance', 'sculpture', 'digital media', 'film', 'moving image'] },
  { name: 'Global Health', keywords: ['health outcome', 'healthcare', 'opioi', 'public health', 'clinical', 'medical', 'disease', 'pharmacolog'] },
  { name: 'History', keywords: ['histor', 'nazi', 'antisemitism', 'curriculum', 'historiograph'] },
  { name: 'Linguistics', keywords: ['linguistic', 'language', 'syntax', 'semantics', 'phonolog'] },
  { name: 'Architecture', keywords: ['architectur', 'urban planning', 'building design'] },
];

function cleanHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').
    replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').
    replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// Map raw entries by first/last name
const rawByName = new Map();
for (const raw of rawEntries) {
  const key = `${raw.firstName.toLowerCase()}|${raw.lastName.toLowerCase()}`;
  rawByName.set(key, raw);
}

function inferDepartment(entry) {
  const nameParts = entry.name.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;

  const raw = rawByName.get(key);
  if (raw && raw.tags) {
    const tagUuids = raw.tags.split(',');
    const matched = tagUuids.map(u => sessionTags[u.trim()]).filter(Boolean);
    if (matched.length > 0) return matched[0];
  }

  // Fall back to keyword matching
  const text = ((entry.title || '') + ' ' + (entry.abstract || '')).toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const pattern of departmentPatterns) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern.name;
    }
  }

  return bestMatch || DEFAULT_DEPARTMENT;
}

function generateDescription(entry) {
  const title = entry.title || '';
  const abstract = cleanHtml(entry.abstract || '');
  const firstSentence = abstract.split('.').filter(s => s.trim().length > 10)[0]?.trim() || '';

  if (firstSentence && title) {
    return `Undergrad researcher presenting "${title}" via ${SOURCE_LABEL}. ${firstSentence}.`;
  } else if (title) {
    return `Undergrad researcher presenting "${title}" via ${SOURCE_LABEL}.`;
  }
  return `Undergrad researcher via ${SOURCE_LABEL}.`;
}

// Process all entries
const final = richData.map(e => {
  e.department = inferDepartment(e);
  e.personalized_description = generateDescription(e);
  return e;
});

// Write CSV
const header = 'name,linkedin,email,department,research_experience,track,role,personalized_description';
const lines = [header];
for (const e of final) {
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

// Stats
const deptCounts = {};
const trackCounts = {};
const roleCounts = {};
for (const e of final) {
  deptCounts[e.department] = (deptCounts[e.department] || 0) + 1;
  trackCounts[e.track] = (trackCounts[e.track] || 0) + 1;
  roleCounts[e.role] = (roleCounts[e.role] || 0) + 1;
}

console.log(`✅ Final CSV: ${final.length} contacts`);
console.log(`   With email: ${final.filter(e => e.email).length} (${(100 * final.filter(e => e.email).length / final.length).toFixed(1)}%)`);
console.log(`   With personalized description: ${final.filter(e => e.personalized_description && e.personalized_description.length > 30).length}`);
console.log('\nTrack distribution:', trackCounts);
console.log('Role distribution:', roleCounts);
console.log('\nDepartment distribution:');
for (const [dept, count] of Object.entries(deptCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}: ${dept}`);
}

// Show sample
console.log('\n=== SAMPLE (5 entries) ===');
for (const e of final.slice(0, 5)) {
  console.log(`${e.name} | ${e.department} | ${e.track} | ${e.email}`);
  console.log(`  "${e.personalized_description.substring(0, 100)}..."`);
}
