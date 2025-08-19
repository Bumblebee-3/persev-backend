const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('better-sqlite3');

if (!process.env.DATABASE_PATH) {
  throw new Error('DATABASE_PATH environment variable not set');
}

const DB_PATH = path.resolve(process.env.DATABASE_PATH);

let db = null;
let isConnected = false;

/** Create updated_at trigger */
function createTimestampTrigger(table) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ${table}_updated_at
    AFTER UPDATE ON ${table}
    FOR EACH ROW
    BEGIN
      UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;
  `);
}

/** Create all tables (idempotent) */
function createSchema() {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contingent_code TEXT UNIQUE,
      teacher_name TEXT NOT NULL,
      teacher_mobile TEXT NOT NULL,
      teacher_email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  createTimestampTrigger('schools');

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  createTimestampTrigger('event_categories');

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      description TEXT,
      min_participants INTEGER NOT NULL,
      max_participants INTEGER NOT NULL,
      min_grade INTEGER NOT NULL CHECK (min_grade BETWEEN 8 AND 12),
      max_grade INTEGER NOT NULL CHECK (max_grade BETWEEN 8 AND 12),
      gender_requirement TEXT NOT NULL DEFAULT 'any'
        CHECK (gender_requirement IN ('any','male_female_required','male_only','female_only')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (category_id) REFERENCES event_categories(id) ON DELETE RESTRICT
    );
  `);
  createTimestampTrigger('events');

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      registration_status TEXT NOT NULL DEFAULT 'registered'
        CHECK (registration_status IN ('registered','confirmed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      UNIQUE (school_id, event_id),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE CASCADE
    );
  `);
  createTimestampTrigger('event_registrations');

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_registration_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_registration_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL CHECK (grade BETWEEN 8 AND 12),
      gender TEXT CHECK (gender IN ('male','female','other')),
      participant_order INTEGER NOT NULL,
      FOREIGN KEY (event_registration_id)
        REFERENCES event_registrations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_erp_reg_id ON event_registration_participants(event_registration_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sports_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      registration_date TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sports_registration_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sports_registration_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL,
      gender TEXT,
      weight REAL,
      participant_order INTEGER NOT NULL,
      FOREIGN KEY (sports_registration_id)
        REFERENCES sports_registrations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_srp_reg_id ON sports_registration_participants(sports_registration_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS classroom_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      registration_date TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS classroom_registration_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_registration_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL,
      participant_order INTEGER NOT NULL,
      FOREIGN KEY (classroom_registration_id)
        REFERENCES classroom_registrations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_crp_reg_id ON classroom_registration_participants(classroom_registration_id);
  `);
}

/** Insert registration + participants transactionally */
function createEventRegistration({ schoolId, eventId, registrationStatus = 'registered', participants }) {
  if (!db) throw new Error('Database not initialized');

  const getEvent = db.prepare(`
    SELECT id, min_participants, max_participants, min_grade, max_grade, gender_requirement
    FROM events WHERE id = ?
  `);
  const event = getEvent.get(eventId);
  if (!event) throw new Error('Event not found');

  const exists = db.prepare(`SELECT id FROM event_registrations WHERE school_id = ? AND event_id = ?`).get(schoolId, eventId);
  if (exists) throw new Error('Duplicate registration: this school is already registered for the event');

  const insertRegistration = db.prepare(`
    INSERT INTO event_registrations (school_id, event_id, registration_status)
    VALUES (?, ?, ?)
  `);
  const insertParticipant = db.prepare(`
    INSERT INTO event_registration_participants (event_registration_id, name, grade, gender, participant_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const info = insertRegistration.run(schoolId, eventId, registrationStatus);
    const registrationId = info.lastInsertRowid;
    for (const p of participants) {
      insertParticipant.run(registrationId, p.name, p.grade, p.gender ?? null, p.participantOrder);
    }
    return registrationId;
  });

  return tx();
}

/** Initialize SQLite */
async function initializeDatabase() {
  if (isConnected && db) {
    console.log('Using existing SQLite connection');
    return models;
  }

  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log('🔧 Opening SQLite at:', DB_PATH);
    db = new Database(DB_PATH);   // opening creates the file if it doesn't exist
    isConnected = true;
    console.log('✅ Connected to SQLite');

    createSchema();

    process.on('exit', () => { try { db && db.close(); } catch (_) {} });

    console.log('🎉 Database tables initialized successfully!');
    return models;
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
    throw error;
  }
}

async function disconnectFromDatabase() {
  if (!isConnected || !db) return;
  try {
    db.close();
    db = null;
    isConnected = false;
    console.log('Disconnected from SQLite');
  } catch (error) {
    console.error('Error disconnecting from SQLite:', error);
    throw error;
  }
}

const models = {
  School: 'schools',
  EventCategory: 'event_categories',
  Event: 'events',
  EventRegistration: 'event_registrations',
  SportsRegistration: 'sports_registrations',
  ClassroomRegistration: 'classroom_registrations',
  StageEvent: 'events',
  StageRegistration: 'event_registrations',

  db: () => db,
  initializeDatabase,
  disconnectFromDatabase,
  createEventRegistration,
};

console.log('Available models:', Object.keys(models));

module.exports = models;

/* ---------- run if called directly ---------- */
if (require.main === module) {
  initializeDatabase()
    .then(async () => {
      // Do a no-op write to guarantee file timestamp changes even if schema already existed
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      console.log('Database initialization completed successfully at:', DB_PATH);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}
