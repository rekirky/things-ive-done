// One-off concert import from CSV.
// Usage: node --experimental-sqlite import-concerts.js concerts.csv
//
// CSV format (header row required):
//   Band,Year,Location,Attendees,Notes
//
// Attendees: pipe-separated e.g. Jon|Mel|Adam
// Wrap fields containing commas in double quotes.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node --experimental-sqlite import-concerts.js <file.csv>');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(file), 'utf8');

// Minimal RFC-4180 CSV parser (handles quoted fields with commas/newlines)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuote = false;
  const push = () => { row.push(field.trim()); field = ''; };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') push();
      else if (ch === '\n' || ch === '\r') {
        push();
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && next === '\n') i++;
      } else field += ch;
    }
  }
  push();
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

const rows = parseCSV(raw);
if (rows.length < 2) { console.error('No data rows found.'); process.exit(1); }

const header = rows[0].map(h => h.toLowerCase().trim());
const col = (row, name) => row[header.indexOf(name)]?.trim() || null;

const insert = db.prepare(
  'INSERT INTO concerts (band_name, spotify_id, spotify_image, spotify_genres, year, location, attendees, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

let ok = 0, skip = 0;

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const band = col(row, 'band');
  const year = parseInt(col(row, 'year'));
  if (!band || isNaN(year)) {
    console.warn(`Row ${i + 1}: missing band or year — skipped`);
    skip++;
    continue;
  }
  const location = col(row, 'location');
  const attendeesRaw = col(row, 'attendees');
  const attendees = attendeesRaw ? attendeesRaw.split('|').map(a => a.trim()).filter(Boolean) : [];
  const notes = col(row, 'notes');

  insert.run(
    band, null, null, null,
    year,
    location,
    attendees.length ? JSON.stringify(attendees) : null,
    notes
  );
  ok++;
}

console.log(`Done. Imported ${ok} concerts${skip ? `, skipped ${skip} rows` : ''}.`);
console.log('No Spotify data — open each band in the app to add images/genres later, or re-save entries to trigger a lookup.');
