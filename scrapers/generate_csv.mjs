import { readFileSync, writeFileSync } from 'fs';
import { isValidEmail, SOURCE_LABEL, SOURCE_DESCRIPTION, DEFAULT_DEPARTMENT } from './config.mjs';

// Load entries
const entries = JSON.parse(readFileSync('scrapers/raw_entries.json', 'utf8'));

// Session tag mapping
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

// ── Entry filter ──────────────────────────────────────────────────────────────
// Filter entries by email. Customize this function to filter by any criteria
// (affiliation text, department, etc.) relevant to your data source.
// ────────────────────────────────────────────────────────────────────────────────
function shouldInclude(entry) {
  const email = entry.advisorEmail || entry.studentEmail || "";
  // Accept any entry with a valid email (optionally filtered by TARGET_DOMAINS)
  return isValidEmail(email);
}

// Clean HTML
function cleanHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').
    replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').
    replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// Get student email from entry
function getStudentEmail(entry) {
  // The "advisorEmail" field is actually the student's email in many cases
  const email = entry.advisorEmail || '';
  if (isValidEmail(email)) return email;
  return '';
}

// Infer department from tags that match session tags
function getDepartment(entry) {
  if (!entry.tags) return '';
  const tagUuids = entry.tags.split(',');
  const matched = tagUuids
    .map(u => sessionTags[u.trim()])
    .filter(Boolean);
  return matched.join(', ');
}

// Infer track from title + abstract
function inferTrack(entry) {
  const title = entry.title || '';
  const abstract = cleanHtml(entry.abstract || '');
  const text = (title + ' ' + abstract).toLowerCase();

  // Tech track keywords
  const techWords = ['computer', 'ai', 'machine learning', 'neural', 'algorithm', 'software',
    'robotic', 'deep learning', 'nlp', 'data', 'comput', 'model', 'simulation', 'agent-based',
    'program', 'coding', 'python', 'tensor', 'gpu', 'autonomous', 'reinforcement learn',
    'cryptograph', 'blockchain', 'quantum', 'cloud comput', 'cyber', 'informatics',
    'computer science', 'informatics', 'mathematic', 'statistic', 'algorithm',
    'optimization', 'control theory', 'conformal predict', 'microservice', 'distributed',
    'computer vision', 'generative', 'llm', 'sparse autoencoder', 'multi-agent',
    'mathematics', 'algebra', 'topolog', 'number theor', 'probability', 'calculus',
    'microfluid', 'nanoscale', 'bioengineering', 'physics', 'astrophysics', 'astronom',
    'lensing', 'stellar', 'technosignatur', 'dark matter', 'exoplanet',
    'electric vehicle', 'charging station', 'persistent homology'];

  // Health track keywords
  const healthWords = ['health', 'medicine', 'medical', 'biomedical', 'clinical', 'patient',
    'disease', 'cancer', 'drug', 'treatment', 'neuroscience', 'brain', 'synapse',
    'cellular', 'genetics', 'genomic', 'protein', 'molecular', 'biology', 'ecology',
    'physiology', 'microbi', 'immun', 'pathogen', 'vaccine', 'epidemiolog',
    'public health', 'healthcare', 'hospital', 'pharmacolog', 'clinical', 'medical',
    'psycholog', 'cognition', 'mental health', 'opioi', 'mesenchymal', 'stem cell',
    'axon', 'loc o motion', 'drosophila', 'nociception', 'pain', 'c. elegans',
    'exosome', 'axotomy', 'locomotion', 'drosophila', 'synaptojanin', 'neuromuscular',
    'global health', 'health outcome', 'healthcare'];

  // Economy track keywords
  const econWords = ['economics', 'econom', 'business', 'market', 'policy', 'financial',
    'government', 'political', 'social', 'law', 'education', 'anthropolog', 'history',
    'cultural', 'gender', 'race', 'power', 'social sc', 'sociolog', 'humanities',
    'linguistic', 'music', 'art', 'design', 'architecture', 'urban planning',
    'environmental', 'sustainability', 'climate', 'ecolog', 'conservation',
    'education', 'exam', 'student performance', 'democrat', 'political', 'mobilization'];

  let techScore = 0, healthScore = 0, econScore = 0;
  for (const word of techWords) {
    if (text.includes(word)) techScore++;
  }
  for (const word of healthWords) {
    if (text.includes(word)) healthScore++;
  }
  for (const word of econWords) {
    if (text.includes(word)) econScore++;
  }

  if (techScore >= healthScore && techScore >= econScore) return 'tech';
  if (healthScore >= econScore) return 'health';
  return 'economy';
}

// Determine role
function determineRole(entry) {
  // If presented oral (O-1A, O-2A etc.), they're more likely team_leads
  const number = entry.number || '';
  if (number.startsWith('O')) return 'team_lead';
  // Posters are still good as team_leads but some could be mentors
  if (Math.random() < 0.7) return 'team_lead';
  return 'mentor';
}

// Generate personalized description
function generateDescription(entry) {
  const title = entry.title || '';
  const abstract = cleanHtml(entry.abstract) || '';
  const advisor = entry.advisorName || '';

  // Extract first sentence of abstract
  const firstSentence = abstract.split('.').filter(s => s.trim().length > 10)[0]?.trim() || '';

  if (firstSentence && title) {
    return `Undergrad researcher presenting "${title}" via ${SOURCE_LABEL}. ${firstSentence}.`;
  } else if (title) {
    return `Undergrad researcher presenting "${title}" via ${SOURCE_LABEL}.`;
  }
  return `Undergrad researcher via ${SOURCE_LABEL}.`;
}

// Process entries
const institutionEntries = [];
for (const entry of entries) {
  const firstName = entry.firstName || '';
  const lastName = entry.lastName || '';
  const studentEmail = entry.advisorEmail || '';
  const affiliation = entry.affiliation || '';

  // Filter: only include entries with valid emails
  if (!shouldInclude(entry)) continue;

  // Skip entries with missing name
  if (!firstName || !lastName) continue;

  // Skip entries with obviously placeholder data
  if (firstName.toLowerCase() === 'null' || firstName.toLowerCase() === 'none') continue;

  // Infer department from tags
  const department = getDepartment(entry);

  // Infer track
  const track = inferTrack(entry);

  // Build record
  institutionEntries.push({
    name: `${firstName} ${lastName}`,
    linkedin: '',
    email: studentEmail.includes('@') ? studentEmail : '',
    department: department || DEFAULT_DEPARTMENT,
    research_experience: SOURCE_DESCRIPTION,
    track: track,
    role: determineRole(entry),
    personalized_description: generateDescription(entry),
    // Extra fields for reference
    _advisor: entry.advisorName || '',
    _title: entry.title || '',
    _abstract: cleanHtml(entry.abstract) || '',
    _number: entry.number || '',
  });
}

// Deduplicate by name
const seen = new Map();
const unique = [];
for (const entry of institutionEntries) {
  const key = entry.name.toLowerCase().trim();
  if (!seen.has(key)) {
    seen.set(key, entry);
    unique.push(entry);
  }
}

console.log(`Total ${SOURCE_LABEL} entries: ${institutionEntries.length} → ${unique.length} after dedup`);

// Count by track
const trackCounts = { tech: 0, health: 0, economy: 0 };
for (const e of unique) {
  trackCounts[e.track] = (trackCounts[e.track] || 0) + 1;
}
console.log('\nTrack distribution:', trackCounts);

// Count by role
const roleCounts = { team_lead: 0, mentor: 0, lead_mentor: 0 };
for (const e of unique) {
  roleCounts[e.role] = (roleCounts[e.role] || 0) + 1;
}
console.log('Role distribution:', roleCounts);

// Count emails
const withEmail = unique.filter(e => e.email.includes('@')).length;
console.log(`With email: ${withEmail}/${unique.length} (${(100 * withEmail / unique.length).toFixed(1)}%)`);

// Write CSV
const header = 'name,linkedin,email,department,research_experience,track,role,personalized_description';
const lines = [header];
for (const e of unique) {
  // Escape CSV fields
  const escape = (s) => {
    s = String(s || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  lines.push([
    escape(e.name), escape(e.linkedin), escape(e.email),
    escape(e.department), escape(e.research_experience),
    escape(e.track), escape(e.role), escape(e.personalized_description)
  ].join(','));
}

writeFileSync('outreach/symposiumContacts.csv', lines.join('\n') + '\n');
console.log(`\n✅ Written ${unique.length} contacts to outreach/symposiumContacts.csv`);

// Also save a richer JSON for future reference
const richEntries = unique.map(e => ({
  name: e.name,
  email: e.email,
  department: e.department,
  track: e.track,
  role: e.role,
  advisor: e._advisor,
  title: e._title,
  abstract: e._abstract,
  number: e._number,
}));
writeFileSync('scrapers/symposiumContacts_rich.json', JSON.stringify(richEntries, null, 2));
console.log('✅ Rich data saved to scrapers/symposiumContacts_rich.json');
