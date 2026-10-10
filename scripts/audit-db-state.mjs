import pg from '../lib/db/node_modules/pg/lib/index.js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
const dbMatch = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const dbUrl = dbMatch ? dbMatch[1] : null;

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

console.log('=== 1. USERS ===');
const users = await client.query('SELECT id, email, full_name, role, status, created_at FROM users ORDER BY created_at DESC');
users.rows.forEach(u => console.log(`${u.id} | ${u.email} | ${u.full_name} | ${u.role} | ${u.status}`));

console.log('\n=== 2. BOOKINGS ===');
const bookings = await client.query('SELECT id, booking_id, customer_id, status, payment_status, total_price, created_at FROM bookings ORDER BY created_at DESC');
bookings.rows.forEach(b => console.log(`${b.id} | ${b.booking_id} | ${b.status} | ${b.payment_status} | ${b.total_price}`));

console.log('\n=== 3. PARTNERS ===');
const partners = await client.query('SELECT id, partner_id, agency_name, email, referral_code, status FROM partners ORDER BY created_at DESC');
partners.rows.forEach(p => console.log(`${p.id} | ${p.partner_id} | ${p.agency_name} | ${p.email} | ${p.referral_code} | ${p.status}`));

await client.end();
