/**
 * Tests for gmail_auto_send.js
 *
 * Covers: CSV parsing, contact filtering, CSV update logic,
 * batch cap warning, and markdown stripping.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Import the pure (non-browser) functions from the implementation
// ---------------------------------------------------------------------------

const {
  parseCSV,
  serializeCSV,
  loadContactsFromText,
  filterPendingContacts,
  updateContactSent,
  shouldWarnBatchCap,
  stripMarkdown,
  BATCH_CAP,
} = require('../gmail_auto_send.js');

// ---------------------------------------------------------------------------
// 1. parseCSV
// ---------------------------------------------------------------------------

describe('parseCSV', () => {
  it('parses a simple header + data CSV', () => {
    const text = '"name","email","status"\n"Alice","alice@example.com","pending"\n"Bob","bob@example.com","sent"\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['name', 'email', 'status'],
      ['Alice', 'alice@example.com', 'pending'],
      ['Bob', 'bob@example.com', 'sent'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const text = '"name","bio"\n"Alice","likes code, runs, and pizza"\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['name', 'bio'],
      ['Alice', 'likes code, runs, and pizza'],
    ]);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    const text = '"name","quote"\n"Alice","she said ""hello"""\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['name', 'quote'],
      ['Alice', 'she said "hello"'],
    ]);
  });

  it('handles multi-line quoted fields (newlines inside quotes)', () => {
    const text = '"name","body"\n"Alice","Line 1\nLine 2\nLine 3"\n"Bob","short"\n';
    const rows = parseCSV(text);
    assert.equal(rows.length, 3); // header + 2 data rows
    assert.deepStrictEqual(rows[0], ['name', 'body']);
    assert.deepStrictEqual(rows[1], ['Alice', 'Line 1\nLine 2\nLine 3']);
    assert.deepStrictEqual(rows[2], ['Bob', 'short']);
  });

  it('handles empty input string', () => {
    const rows = parseCSV('');
    assert.deepStrictEqual(rows, []);
  });

  it('handles a single header row with no trailing newline', () => {
    const text = '"col1","col2","col3"';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['col1', 'col2', 'col3'],
    ]);
  });

  it('handles empty fields', () => {
    const text = '"name","email","phone"\n"Alice",,"555-1234"\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['name', 'email', 'phone'],
      ['Alice', '', '555-1234'],
    ]);
  });

  it('handles fields that are not quoted (no special chars)', () => {
    const text = 'id,name,status\n001,Alice,pending\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['id', 'name', 'status'],
      ['001', 'Alice', 'pending'],
    ]);
  });

  it('handles mixed quoted and unquoted fields', () => {
    const text = 'id,"name","status"\n001,Alice,"pending, special"\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['id', 'name', 'status'],
      ['001', 'Alice', 'pending, special'],
    ]);
  });

  it('handles Windows-style CRLF line endings', () => {
    const text = '"name","email"\r\n"Alice","alice@example.com"\r\n';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      ['name', 'email'],
      ['Alice', 'alice@example.com'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. serializeCSV
// ---------------------------------------------------------------------------

describe('serializeCSV', () => {
  it('round-trips a simple CSV without data loss', () => {
    const headers = ['name', 'email', 'status'];
    const rows = [
      { name: 'Alice', email: 'alice@example.com', status: 'pending' },
      { name: 'Bob', email: 'bob@example.com', status: 'sent' },
    ];
    const serialized = serializeCSV(headers, rows);
    const reparsed = parseCSV(serialized);
    assert.deepStrictEqual(reparsed, [
      ['name', 'email', 'status'],
      ['Alice', 'alice@example.com', 'pending'],
      ['Bob', 'bob@example.com', 'sent'],
    ]);
  });

  it('properly escapes double-quotes in field values', () => {
    const headers = ['name', 'quote'];
    const rows = [
      { name: 'Alice', quote: 'she said "hello"' },
    ];
    const serialized = serializeCSV(headers, rows);
    // The value should be "she said ""hello"""
    assert.ok(serialized.includes('"she said ""hello"""'));
  });

  it('quotes fields containing commas', () => {
    const headers = ['name', 'bio'];
    const rows = [
      { name: 'Alice', bio: 'likes code, runs' },
    ];
    const serialized = serializeCSV(headers, rows);
    assert.ok(serialized.includes('"likes code, runs"'));
  });

  it('handles empty rows array', () => {
    const headers = ['name', 'email'];
    const rows = [];
    const serialized = serializeCSV(headers, rows);
    const reparsed = parseCSV(serialized);
    assert.deepStrictEqual(reparsed, [['name', 'email']]);
  });

  it('handles missing keys by outputting empty string', () => {
    const headers = ['name', 'email', 'phone'];
    const rows = [
      { name: 'Alice', email: 'alice@example.com' }, // no phone
    ];
    const serialized = serializeCSV(headers, rows);
    const reparsed = parseCSV(serialized);
    assert.deepStrictEqual(reparsed, [
      ['name', 'email', 'phone'],
      ['Alice', 'alice@example.com', ''],
    ]);
  });

  it('produces trailing newline', () => {
    const headers = ['name'];
    const rows = [{ name: 'Alice' }];
    const serialized = serializeCSV(headers, rows);
    assert.ok(serialized.endsWith('\n'));
  });
});

// ---------------------------------------------------------------------------
// 3. loadContactsFromText
// ---------------------------------------------------------------------------

describe('loadContactsFromText', () => {
  it('loads contacts from CSV text into objects keyed by headers', () => {
    const text = '"contact_id","name","email","draft_status","send_status","sent_at"\n"001","Alice","alice@example.com","approved","pending",""\n"002","Bob","bob@example.com","approved","sent","2026-01-01T00:00:00.000Z"\n';
    const { headers, contacts } = loadContactsFromText(text);
    assert.deepStrictEqual(headers, ['contact_id', 'name', 'email', 'draft_status', 'send_status', 'sent_at']);
    assert.equal(contacts.length, 2);
    assert.deepStrictEqual(contacts[0], {
      contact_id: '001',
      name: 'Alice',
      email: 'alice@example.com',
      draft_status: 'approved',
      send_status: 'pending',
      sent_at: '',
    });
    assert.deepStrictEqual(contacts[1], {
      contact_id: '002',
      name: 'Bob',
      email: 'bob@example.com',
      draft_status: 'approved',
      send_status: 'sent',
      sent_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns empty contacts array for header-only CSV', () => {
    const text = '"contact_id","name","email","draft_status","send_status","sent_at"\n';
    const { headers, contacts } = loadContactsFromText(text);
    assert.equal(contacts.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 4. filterPendingContacts
// ---------------------------------------------------------------------------

describe('filterPendingContacts', () => {
  it('returns only contacts with draft_status=approved AND send_status=pending', () => {
    const contacts = [
      { contact_id: '001', name: 'Alice', draft_status: 'approved', send_status: 'pending' },
      { contact_id: '002', name: 'Bob', draft_status: 'approved', send_status: 'sent' },
      { contact_id: '003', name: 'Carol', draft_status: 'draft', send_status: 'pending' },
      { contact_id: '004', name: 'Dave', draft_status: 'approved', send_status: 'pending' },
      { contact_id: '005', name: 'Eve', draft_status: 'rejected', send_status: 'pending' },
    ];
    const result = filterPendingContacts(contacts);
    assert.equal(result.length, 2);
    assert.deepStrictEqual(result.map(c => c.contact_id), ['001', '004']);
  });

  it('returns empty array when no contacts match', () => {
    const contacts = [
      { contact_id: '001', draft_status: 'approved', send_status: 'sent' },
      { contact_id: '002', draft_status: 'draft', send_status: 'pending' },
    ];
    const result = filterPendingContacts(contacts);
    assert.deepStrictEqual(result, []);
  });

  it('returns empty array for empty input', () => {
    const result = filterPendingContacts([]);
    assert.deepStrictEqual(result, []);
  });

  it('handles contacts with extra whitespace in status fields', () => {
    const contacts = [
      { contact_id: '001', draft_status: ' approved ', send_status: ' pending ' },
      { contact_id: '002', draft_status: 'approved', send_status: 'pending' },
    ];
    const result = filterPendingContacts(contacts);
    assert.equal(result.length, 1);
    assert.equal(result[0].contact_id, '002');
  });

  it('handles missing draft_status or send_status fields', () => {
    const contacts = [
      { contact_id: '001', draft_status: 'approved' }, // missing send_status
      { contact_id: '002', send_status: 'pending' }, // missing draft_status
      { contact_id: '003', draft_status: 'approved', send_status: 'pending' },
    ];
    const result = filterPendingContacts(contacts);
    assert.equal(result.length, 1);
    assert.equal(result[0].contact_id, '003');
  });
});

// ---------------------------------------------------------------------------
// 5. updateContactSent
// ---------------------------------------------------------------------------

describe('updateContactSent', () => {
  it('sets send_status="sent" and sent_at to an ISO timestamp for the correct contact', () => {
    const contacts = [
      { contact_id: '001', name: 'Alice', send_status: 'pending', sent_at: '' },
      { contact_id: '002', name: 'Bob', send_status: 'pending', sent_at: '' },
    ];
    const before = Date.now();
    updateContactSent(contacts, '001');
    const after = Date.now();

    const updated = contacts.find(c => c.contact_id === '001');
    assert.equal(updated.send_status, 'sent');
    const ts = Date.parse(updated.sent_at);
    assert.ok(!isNaN(ts), 'sent_at should be a valid date');
    assert.ok(ts >= before && ts <= after + 1000, 'sent_at should be within expected time window');
  });

  it('does not modify other contacts', () => {
    const contacts = [
      { contact_id: '001', name: 'Alice', send_status: 'pending', sent_at: '' },
      { contact_id: '002', name: 'Bob', send_status: 'pending', sent_at: '' },
    ];
    updateContactSent(contacts, '001');
    const other = contacts.find(c => c.contact_id === '002');
    assert.equal(other.send_status, 'pending');
    assert.equal(other.sent_at, '');
  });

  it('throws when contact_id is not found', () => {
    const contacts = [
      { contact_id: '001', name: 'Alice', send_status: 'pending', sent_at: '' },
    ];
    assert.throws(
      () => updateContactSent(contacts, 'nonexistent'),
      /contact_id.*not found/i,
    );
  });

  it('updates a contact that already had a previous sent_at value', () => {
    const contacts = [
      { contact_id: '001', name: 'Alice', send_status: 'pending', sent_at: '2025-01-01T00:00:00.000Z' },
    ];
    updateContactSent(contacts, '001');
    const updated = contacts.find(c => c.contact_id === '001');
    assert.equal(updated.send_status, 'sent');
    assert.notEqual(updated.sent_at, '2025-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// 6. shouldWarnBatchCap
// ---------------------------------------------------------------------------

describe('shouldWarnBatchCap', () => {
  it('returns false when count is under BATCH_CAP', () => {
    assert.equal(shouldWarnBatchCap(10), false);
    assert.equal(shouldWarnBatchCap(BATCH_CAP - 1), false);
  });

  it('returns false when count equals BATCH_CAP', () => {
    assert.equal(shouldWarnBatchCap(BATCH_CAP), false);
  });

  it('returns true when count exceeds BATCH_CAP', () => {
    assert.equal(shouldWarnBatchCap(BATCH_CAP + 1), true);
    assert.equal(shouldWarnBatchCap(200), true);
  });

  it('returns false for zero count', () => {
    assert.equal(shouldWarnBatchCap(0), false);
  });
});

// ---------------------------------------------------------------------------
// 7. stripMarkdown
// ---------------------------------------------------------------------------

describe('stripMarkdown', () => {
  it('removes **bold** markers from text', () => {
    const input = 'This is **bold** text.';
    const result = stripMarkdown(input);
    assert.equal(result, 'This is bold text.');
  });

  it('handles multiple bold sections', () => {
    const input = '**Hello** world **again**!';
    const result = stripMarkdown(input);
    assert.equal(result, 'Hello world again!');
  });

  it('returns text unchanged when there is no markdown', () => {
    const input = 'Plain text without any formatting.';
    const result = stripMarkdown(input);
    assert.equal(result, input);
  });

  it('handles empty string', () => {
    const result = stripMarkdown('');
    assert.equal(result, '');
  });

  it('handles text where bold markers are adjacent', () => {
    const input = '**bold1****bold2**';
    const result = stripMarkdown(input);
    assert.equal(result, 'bold1bold2');
  });

  it('handles single asterisks that are not bold markers', () => {
    const input = 'This has *single* asterisks and **double** ones.';
    const result = stripMarkdown(input);
    assert.equal(result, 'This has *single* asterisks and double ones.');
  });
});
