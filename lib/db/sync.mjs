import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('c:/GIT DESK/THINK/.env', 'utf-8');
const connStr = env.match(/DATABASE_URL=([^\r\n]+)/)[1].trim();

const pool = new pg.Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const q = "SELECT setval(pg_get_serial_sequence('bpo_centre_media', 'id'), COALESCE(max(id), 1)) FROM bpo_centre_media;";
    const res = await pool.query(q);
    console.log('Sequence updated:', res.rows[0]);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
main();
