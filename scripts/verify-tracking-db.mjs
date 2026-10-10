import pg from '../lib/db/node_modules/pg/lib/index.js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
const dbMatch = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const dbUrl = dbMatch ? dbMatch[1] : null;

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

console.log('=== 1. VERIFY TRACKING TABLES IN DATABASE ===');
const tablesRes = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('trip_tracking_sessions', 'trip_location_updates', 'trip_tracking_events')
  ORDER BY table_name;
`);
console.log('Tracking tables found:', tablesRes.rows.map(r => r.table_name));

console.log('\n=== 2. VERIFY TRACKING INDEXES ===');
const indexesRes = await client.query(`
  SELECT indexname, tablename 
  FROM pg_indexes 
  WHERE tablename IN ('trip_tracking_sessions', 'trip_location_updates', 'trip_tracking_events')
  ORDER BY tablename, indexname;
`);
indexesRes.rows.forEach(idx => console.log(`  ${idx.tablename} -> ${idx.indexname}`));

console.log('\n=== 3. VERIFY ADMIN ACCOUNTS ===');
const adminRes = await client.query(`SELECT id, admin_id, role, created_at FROM admin_users ORDER BY created_at DESC`);
adminRes.rows.forEach(a => console.log(`  ${a.id} | ${a.admin_id} | ${a.role}`));

console.log('\n=== 4. VERIFY CONFIRMED BOOKING & FULFILLMENT WITH CAB ===');
const bookingRes = await client.query(`
  SELECT b.id, b.booking_id, b.customer_id, b.status, b.payment_status, u.full_name as customer_name, u.email as customer_email, u.customer_id as cus_code, u.password_hash
  FROM bookings b
  LEFT JOIN users u ON b.customer_id = u.id
  WHERE b.booking_id = 'ZL261002009' OR b.status = 'CONFIRMED'
  ORDER BY b.created_at DESC
  LIMIT 5;
`);
bookingRes.rows.forEach(b => console.log(`  Booking: ${b.booking_id} (${b.id}) | Customer: ${b.customer_name} (${b.customer_email}, ${b.cus_code}) | PwdHash: ${b.password_hash ? b.password_hash.substring(0, 15) + '...' : 'none'}`));

const cabFulfillmentRes = await client.query(`
  SELECT tfi.id, tfi.component_type, tfi.status, tfi.details, b.booking_id
  FROM trip_fulfillment_items tfi
  JOIN trip_fulfillments tf ON tfi.fulfillment_id = tf.id
  JOIN bookings b ON tf.booking_id = b.id
  WHERE b.booking_id = 'ZL261002009' OR tfi.component_type = 'CAB'
  ORDER BY b.booking_id DESC
  LIMIT 10;
`);
console.log('\n=== 5. CAB FULFILLMENT ITEMS ===');
cabFulfillmentRes.rows.forEach(c => console.log(`  FulfillmentItem: ${c.id} | Booking: ${c.booking_id} | Type: ${c.component_type} | Status: ${c.status} | Details:`, JSON.stringify(c.details)));

console.log('\n=== 6. EXISTING TRACKING SESSIONS ===');
const trackingRes = await client.query(`SELECT id, booking_id, customer_id, status, customer_tracking_enabled, driver_tracking_enabled FROM trip_tracking_sessions LIMIT 5;`);
console.log('Tracking sessions count:', trackingRes.rows.length);
trackingRes.rows.forEach(t => console.log(`  Session: ${t.id} | Booking: ${t.booking_id} | Status: ${t.status}`));

await client.end();
console.log('\n=== VERIFICATION COMPLETE ===');
