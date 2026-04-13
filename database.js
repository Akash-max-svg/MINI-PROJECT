const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'cyber_threat.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      phone TEXT,
      email TEXT UNIQUE,
      address TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Complaints table
    db.run(`CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      address TEXT,
      mobile TEXT,
      email TEXT,
      type TEXT,
      suspicious_number TEXT,
      complaint_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Threat reports table
    db.run(`CREATE TABLE IF NOT EXISTS threat_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT,
      url TEXT,
      threat_type TEXT,
      risk_score INTEGER,
      status TEXT,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Phone directory table (for CSV imports)
    db.run(`CREATE TABLE IF NOT EXISTS phone_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE,
      name TEXT,
      location TEXT,
      country_name TEXT,
      country_code TEXT,
      complaints INTEGER,
      last_status TEXT
    )`);

    // Backfill new columns if table existed previously
    const ensureColumn = (table, column, type) =>
      db.get(`PRAGMA table_info(${table})`, (err) => {
        if (err) return; // ignore
        db.all(`PRAGMA table_info(${table})`, (e2, rows) => {
          if (e2) return;
          const hasCol = rows.some(r => r.name === column);
          if (!hasCol) {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
          }
        });
      });

    // Add optional columns to existing tables
    ensureColumn('phone_directory', 'country_name', 'TEXT');
    ensureColumn('phone_directory', 'country_code', 'TEXT');
    ensureColumn('phone_directory', 'complaints', 'INTEGER');
    ensureColumn('phone_directory', 'last_status', 'TEXT');
    ensureColumn('threat_reports', 'email', 'TEXT');
    // Email and URL directories
    db.run(`CREATE TABLE IF NOT EXISTS email_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      risk_score INTEGER,
      status TEXT,
      reasons TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS url_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE,
      risk_score INTEGER,
      status TEXT,
      reasons TEXT,
      title TEXT
    )`);

    // Ensure optional column exists if table was created earlier
    ensureColumn('url_directory', 'title', 'TEXT');

    console.log('✅ Database initialized');
  });
}

module.exports = { db, initDatabase };