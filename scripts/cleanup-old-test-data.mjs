import pg from '../lib/db/node_modules/pg/lib/index.js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
const dbMatch = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const dbUrl = dbMatch ? dbMatch[1] : null;

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

console.log('====================================================');
console.log('SAFE TARGETED CLEANUP OF OLD TEMPORARY TEST DATA');
console.log('====================================================\n');

// 1. Identify abandoned draft bookings (booking_id IS NULL AND total_price = 0)
const draftBookings = await client.query(`SELECT id FROM bookings WHERE booking_id IS NULL AND (total_price = 0 OR total_price IS NULL)`);
console.log(`Identified ${draftBookings.rows.length} abandoned draft bookings with NULL booking_id and 0 price.`);

// 2. Identify old automated test users
const testUsers = await client.query(`
  SELECT id, email FROM users 
  WHERE email LIKE 'render-origin%' 
     OR email LIKE 'cors-success%' 
     OR email LIKE 'sbtest_%'
     OR email LIKE 'testuser_probe%'
     OR email LIKE 'test_%@example.com'
     OR email LIKE 'supplier.test.%'
     OR email LIKE 'foreign.%'
`);
console.log(`Identified ${testUsers.rows.length} automated test user accounts (render-origin, cors-success, sbtest, foreign, probe).`);

// 3. Identify old automated test vendors (SUP-FOREIGN, supplier.test, test-supplier)
const testVendors = await client.query(`
  SELECT id, vendor_id, business_name, email FROM vendors
  WHERE vendor_id LIKE 'SUP-FOREIGN-%'
     OR email LIKE 'supplier.test.%'
     OR email LIKE 'test-supplier-%@himalayanadventures.com'
     OR email LIKE 'foreign.%@example.com'
     OR email LIKE 'vnd_1790%'
`);
console.log(`Identified ${testVendors.rows.length} test vendor records (SUP-FOREIGN, supplier.test, test-supplier).`);

// 4. Identify old automated test partners
const testPartners = await client.query(`
  SELECT id, partner_id, agency_name, email FROM partners
  WHERE email LIKE 'rls-agency-%'
     OR email LIKE 'partner_1790%@testagency.com'
     OR email LIKE 'partner_1790%@zelevospartner.test'
     OR email LIKE 'partner_1790%@example.com'
     OR agency_name LIKE 'Apex Holidays 1790%'
     OR agency_name LIKE 'Pinnacle Travels 1790%'
     OR agency_name LIKE 'Agency 1790%'
`);
console.log(`Identified ${testPartners.rows.length} test partner records (rls-agency, Apex Holidays 1790*, Pinnacle 1790*).`);

// 5. Identify expired OTPs
const expiredOtps = await client.query(`SELECT COUNT(*) as count FROM email_otps WHERE expires_at < NOW() - INTERVAL '1 day'`);
console.log(`Identified ${expiredOtps.rows[0].count} expired email OTP records older than 24 hours.`);

console.log('\n--- EXECUTING TARGETED DELETION ---');

// Perform cleanups in dependency order
if (draftBookings.rows.length > 0) {
  const ids = draftBookings.rows.map(r => String(r.id));
  await client.query(`DELETE FROM audit_logs WHERE resource_id = ANY($1::text[])`, [ids]);
  await client.query(`DELETE FROM payment_transactions WHERE booking_id = ANY($1::uuid[])`, [ids]);
  await client.query(`DELETE FROM booking_services WHERE booking_id = ANY($1::uuid[])`, [ids]);
  await client.query(`DELETE FROM travellers WHERE booking_id = ANY($1::uuid[])`, [ids]);
  await client.query(`DELETE FROM bookings WHERE id = ANY($1::uuid[])`, [ids]);
  console.log(`✓ Deleted ${ids.length} abandoned draft bookings.`);
}

if (testVendors.rows.length > 0) {
  const vIds = testVendors.rows.map(r => r.id);
  await client.query(`DELETE FROM vendor_documents WHERE vendor_id = ANY($1::uuid[])`, [vIds]);
  await client.query(`DELETE FROM vendor_services WHERE vendor_id = ANY($1::uuid[])`, [vIds]);
  await client.query(`DELETE FROM vendor_invoices WHERE vendor_id = ANY($1::uuid[])`, [vIds]);
  await client.query(`DELETE FROM supplier_suspensions WHERE vendor_id = ANY($1::uuid[])`, [vIds]);
  await client.query(`DELETE FROM trip_fulfillment_items WHERE vendor_id = ANY($1::uuid[])`, [vIds]);
  await client.query(`DELETE FROM vendors WHERE id = ANY($1::uuid[])`, [vIds]);
  console.log(`✓ Deleted ${vIds.length} test vendor records.`);
}

if (testPartners.rows.length > 0) {
  const pIds = testPartners.rows.map(r => r.id);
  await client.query(`DELETE FROM commissions WHERE partner_id = ANY($1::uuid[])`, [pIds]);
  await client.query(`DELETE FROM partner_suspensions WHERE partner_id = ANY($1::uuid[])`, [pIds]);
  await client.query(`DELETE FROM partners WHERE id = ANY($1::uuid[])`, [pIds]);
  console.log(`✓ Deleted ${pIds.length} test partner records.`);
}

if (testUsers.rows.length > 0) {
  const uIds = testUsers.rows.map(r => r.id);
  await client.query(`DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`, [uIds]);
  await client.query(`DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])`, [uIds]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [uIds]);
  console.log(`✓ Deleted ${uIds.length} test user records.`);
}

await client.query(`DELETE FROM email_otps WHERE expires_at < NOW() - INTERVAL '1 day'`);
console.log(`✓ Deleted expired email OTP records.`);

console.log('\n--- POST-CLEANUP DATABASE SUMMARY ---');
const uCount = await client.query('SELECT COUNT(*) as count FROM users');
const bCount = await client.query('SELECT COUNT(*) as count FROM bookings');
const pCount = await client.query('SELECT COUNT(*) as count FROM partners');
const vCount = await client.query('SELECT COUNT(*) as count FROM vendors');
console.log(`Users remaining: ${uCount.rows[0].count}`);
console.log(`Bookings remaining: ${bCount.rows[0].count}`);
console.log(`Partners remaining: ${pCount.rows[0].count}`);
console.log(`Vendors remaining: ${vCount.rows[0].count}`);

await client.end();
console.log('\nCleanup completed safely.');
