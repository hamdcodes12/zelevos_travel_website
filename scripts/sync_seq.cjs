const fs = require('fs');
const { Pool } = require('./lib/db/node_modules/pg');

function loadEnv() {
  const env = fs.readFileSync('.env', 'utf-8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx !== -1) {
      const k = t.slice(0, idx).trim();
      let v = t.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadEnv();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env');
    return;
  }
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query(
      "SELECT setval(pg_get_serial_sequence('bpo_centre_media', 'id'), COALESCE(max(id), 1)) FROM bpo_centre_media;"
    );
    console.log("bpo_centre_media sequence synced successfully to:", res.rows[0]);
  } catch (err) {
    console.error("Error setting sequence:", err.message);
  } finally {
    await pool.end();
  }
}

main();
