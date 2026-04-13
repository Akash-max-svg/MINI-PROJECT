const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'cyber_threat.db');
const db = new sqlite3.Database(dbPath);

// Ensure table exists
function ensureTable() {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS phone_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE,
      name TEXT,
      location TEXT,
      country_name TEXT,
      country_code TEXT,
      complaints INTEGER,
      last_status TEXT
    )`, (err) => (err ? reject(err) : resolve()));
  });
}

function normalizeNumber(n) {
  return String(n || '').replace(/\D/g, '');
}

async function importCsv(csvFile) {
  await ensureTable();

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO phone_directory (phone_number, name, location, country_name, country_code, complaints, last_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_number) DO UPDATE SET
        name=excluded.name,
        location=excluded.location,
        country_name=excluded.country_name,
        country_code=excluded.country_code,
        complaints=excluded.complaints,
        last_status=excluded.last_status`);

    let count = 0;
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        const phone = normalizeNumber(row.number || row.phone || row.phone_number);
        const name = row.name || row.full_name || '';
        const location = row.location || row.city || row.place || '';
        const countryName = row.country_name || row.country_n || row.country || '';
        const countryCode = (row.country_code || row.country_c || '').toString();
        const complaints = parseInt(row.complaints || row.complaint || row.report_count || '0', 10) || 0;
        const status = row.status || row.last_status || '';
        if (phone) {
          stmt.run([phone, name, location, countryName, countryCode, complaints, status]);
          count++;
        }
      })
      .on('end', () => {
        stmt.finalize();
        console.log(`✅ Imported ${count} rows into phone_directory`);
        resolve();
      })
      .on('error', (err) => reject(err));
  });
}

(async () => {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node import-phones.js <path-to-csv>');
    process.exit(1);
  }
  try {
    await importCsv(path.resolve(csvPath));
  } catch (e) {
    console.error('❌ Import failed:', e.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
