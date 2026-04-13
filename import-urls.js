const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'cyber_threat.db');
const db = new sqlite3.Database(dbPath);

function ensureTable() {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS url_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE,
      risk_score INTEGER,
      status TEXT,
      reasons TEXT,
      title TEXT
    )`, (err) => (err ? reject(err) : resolve()));
  });
}

function ensureColumn(table, column, type) {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return resolve();
      const hasCol = rows && rows.some(r => r.name === column);
      if (hasCol) return resolve();
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, () => resolve());
    });
  });
}

function normalizeUrl(u){
  if (!u) return '';
  const s = u.toString().trim();
  return s.replace(/\/$/, '');
}

async function importCsv(csvFile) {
  await ensureTable();
  await ensureColumn('url_directory','title','TEXT');
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO url_directory (url, risk_score, status, reasons, title)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        risk_score=excluded.risk_score,
        status=excluded.status,
        reasons=excluded.reasons,
        title=excluded.title`);
    let count = 0;
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        const url = normalizeUrl(row.url || row.website || row.link || row.link_name);
        const score = parseInt(row.score || row.risk_score || '0', 10) || 0;
        const status = (row.status || row.label || '').toString();
        const reasons = (row.reasons || row.reason || '').toString();
        const title = (row.title || row.name || row.link_title || row.link_name_title || row['Login Thre'] || row['Login Threat'] || row['Login'] || row['Threat'] || row['A']) || (row.link_name ? '' : '');
        const finalTitle = (row.link_name && !title) ? row.link_name : (title || '');
        if (url) { stmt.run([url, score, status, reasons, finalTitle]); count++; }
      })
      .on('end', () => { stmt.finalize(); console.log(`✅ Imported ${count} urls`); resolve(); })
      .on('error', (e) => reject(e));
  });
}

(async () => {
  const csvPath = process.argv[2];
  if (!csvPath) { console.error('Usage: node import-urls.js <path-to-csv>'); process.exit(1); }
  try { await importCsv(path.resolve(csvPath)); } catch (e) { console.error('❌ Import failed:', e.message); process.exit(1); } finally { db.close(); }
})();
