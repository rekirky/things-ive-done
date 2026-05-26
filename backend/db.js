const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'visits.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    state TEXT,
    year INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS concerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    band_name TEXT NOT NULL,
    spotify_id TEXT,
    spotify_image TEXT,
    spotify_genres TEXT,
    year INTEGER NOT NULL,
    location TEXT,
    attendees TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS timeline_settings (
    id INTEGER PRIMARY KEY,
    birthdate TEXT,
    tag_colors TEXT
  )
`);

// Migrate: add tag_colors if table existed before this column was introduced
try { db.exec(`ALTER TABLE timeline_settings ADD COLUMN tag_colors TEXT`); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS timeline_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    tags TEXT DEFAULT '[]',
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS animal_encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animal_name TEXT NOT NULL,
    scientific_name TEXT,
    image_url TEXT,
    wiki_extract TEXT,
    encounter_date TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
