import pg from '../lib/db/node_modules/pg/lib/index.js';
import fs from 'node:fs';
import { scryptSync, timingSafeEqual } from 'node:crypto';

const envText = fs.readFileSync('.env', 'utf-8');
const dbMatch = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const dbUrl = dbMatch ? dbMatch[1] : null;

const adminPassMatch = envText.match(/ADMIN_PASSWORD=["']?([^"'\r\n]+)/);
const envAdminPass = adminPassMatch ? adminPassMatch[1] : null;

console.log('ADMIN_PASSWORD from .env exists:', Boolean(envAdminPass));

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

const admins = await client.query('SELECT id, admin_id, password_hash, role, totp_enabled FROM admin_users');
console.log('Admins in DB:');

function verifyPassword(password, encoded) {
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

for (const a of admins.rows) {
  console.log(`- ${a.admin_id} (role: ${a.role}, totp: ${a.totp_enabled})`);
  if (envAdminPass) {
    console.log(`   Matches env ADMIN_PASSWORD? ${verifyPassword(envAdminPass, a.password_hash)}`);
  }
  console.log(`   Matches 'AdminPassword2026!'? ${verifyPassword('AdminPassword2026!', a.password_hash)}`);
  console.log(`   Matches 'harshad'? ${verifyPassword('harshad', a.password_hash)}`);
  console.log(`   Matches 'admin123'? ${verifyPassword('admin123', a.password_hash)}`);
  console.log(`   Matches 'admin'? ${verifyPassword('admin', a.password_hash)}`);
}

await client.end();
