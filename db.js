'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'karma-jobs.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    dog_name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    proposed_time TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'declined')),
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(slot_id, owner_id)
  );
`);

// Migrations for existing databases
try { db.exec('ALTER TABLE slots ADD COLUMN end_time TEXT'); } catch {}
try { db.exec('ALTER TABLE applications ADD COLUMN proposed_time TEXT'); } catch {}
try { db.exec('ALTER TABLE applications ADD COLUMN message TEXT'); } catch {}

module.exports = db;
