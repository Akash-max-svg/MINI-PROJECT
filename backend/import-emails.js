const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'cyber_threat.db');
const db = new sqlite3.Database(dbPath);

function ensureTable() {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS email_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      risk_score INTEGER,
      status TEXT,
      reasons TEXT
    )`, (err) => (err ? reject(err) : resolve()));
  });
}

async function importCsv(csvFile) {
  await ensureTable();
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO email_directory (email, risk_score, status, reasons)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        risk_score=excluded.risk_score,
        status=excluded.status,
        reasons=excluded.reasons`);
    let count = 0;
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        const email = (row.email || row.mail || '').toString().trim().toLowerCase();
        const score = parseInt(row.score || row.risk_score || '0', 10) || 0;
        const status = (row.status || row.label || '').toString();
        const reasons = (row.reasons || row.reason || '').toString();
        if (email) { stmt.run([email, score, status, reasons]); count++; }
      })
      .on('end', () => { stmt.finalize(); console.log(`✅ Imported ${count} emails`); resolve(); })
      .on('error', (e) => reject(e));
  });
}

(async () => {
  const csvPath = process.argv[2];
  if (!csvPath) { console.error('Usage: node import-emails.js <path-to-csv>'); process.exit(1); }
  try { await importCsv(path.resolve(csvPath)); } catch (e) { console.error('❌ Import failed:', e.message); process.exit(1); } finally { db.close(); }
})();










