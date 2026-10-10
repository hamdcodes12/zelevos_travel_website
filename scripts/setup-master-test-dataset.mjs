import pg from '../lib/db/node_modules/pg/lib/index.js';
import { scryptSync, randomBytes } from 'node:crypto';

const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres.hvsvqwrrkxjgrxiozjgz:e5nQzAKmnMQHRRoH@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
await client.connect();

function hashPwd(pwd) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pwd, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

console.log('--- SETTING UP CONTROLLED TEST DATASET FOR ZLV-REAL-TEST-001 ---');

// 1. Admin account: zelevos-travelai00
const adminHash = hashPwd('AdminPassword2026!');
await client.query(
  `UPDATE admin_users SET password_hash = $1, totp_enabled = false, totp_secret = NULL WHERE lower(admin_id) = 'zelevos-travelai00'`,
  [adminHash]
);
console.log('✓ Admin zelevos-travelai00 password configured.');

// 2. Customer A: aarav108@gmail.com
const custAHash = hashPwd('navin0044');
await client.query(
  `UPDATE users SET password_hash = $1, email_verified = true, status = 'active' WHERE lower(email) = 'aarav108@gmail.com'`,
  [custAHash]
);
console.log('✓ Customer A (aarav108@gmail.com) verified.');

// 3. Customer B: navin.kumar.chakraborty2453@gmail.com
const custBHash = hashPwd('navin0044');
await client.query(
  `UPDATE users SET password_hash = $1, email_verified = true, status = 'active' WHERE lower(email) = 'navin.kumar.chakraborty2453@gmail.com'`,
  [custBHash]
);
console.log('✓ Customer B (navin.kumar.chakraborty2453@gmail.com) verified.');

// 4. Partner: partner.voyage@zelevos.travel (VOYAGE10)
const partnerHash = hashPwd('PartnerPassword2026!');
await client.query(
  `UPDATE partners SET password_hash = $1, status = 'approved', is_archived = false WHERE lower(email) = 'partner.voyage@zelevos.travel'`,
  [partnerHash]
);
console.log('✓ Partner partner.voyage@zelevos.travel configured.');

// 5. Vendor: vendor.himalayan@zelevos.partner (VND-HIMALAYAN)
const vendorHash = hashPwd('VendorPassword2026!');
// Ensure user row exists for vendor
const existingUser = await client.query(`SELECT id FROM users WHERE lower(email) = 'vendor.himalayan@zelevos.partner'`);
let vendorUserId;
if (existingUser.rows.length === 0) {
  const insertUser = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, status, email_verified) 
     VALUES ('vendor.himalayan@zelevos.partner', $1, 'Himalayan Vendor Rep', 'vendor', 'active', true) RETURNING id`,
    [vendorHash]
  );
  vendorUserId = insertUser.rows[0].id;
} else {
  vendorUserId = existingUser.rows[0].id;
  await client.query(
    `UPDATE users SET password_hash = $1, role = 'vendor', status = 'active', email_verified = true WHERE id = $2`,
    [vendorHash, vendorUserId]
  );
}

await client.query(
  `UPDATE vendors SET user_id = $1, status = 'APPROVED', approval_status = 'approved', is_archived = false, temporary_password = $2 WHERE vendor_id = 'VND-HIMALAYAN'`,
  [vendorUserId, vendorHash]
);
console.log('✓ Vendor VND-HIMALAYAN configured.');

// 6. Vendor 2: vendor.valleycabs@zelevos.partner (VND-VALLEYCABS)
const existingV2 = await client.query(`SELECT id FROM users WHERE lower(email) = 'vendor.valleycabs@zelevos.partner'`);
let v2UserId;
if (existingV2.rows.length === 0) {
  const insertV2 = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, status, email_verified) 
     VALUES ('vendor.valleycabs@zelevos.partner', $1, 'Valley Cabs Rep', 'vendor', 'active', true) RETURNING id`,
    [vendorHash]
  );
  v2UserId = insertV2.rows[0].id;
} else {
  v2UserId = existingV2.rows[0].id;
  await client.query(
    `UPDATE users SET password_hash = $1, role = 'vendor', status = 'active', email_verified = true WHERE id = $2`,
    [vendorHash, v2UserId]
  );
}

await client.query(
  `UPDATE vendors SET user_id = $1, status = 'APPROVED', approval_status = 'approved', is_archived = false, temporary_password = $2 WHERE vendor_id = 'VND-VALLEYCABS'`,
  [v2UserId, vendorHash]
);
console.log('✓ Vendor VND-VALLEYCABS configured.');

await client.end();
console.log('--- ALL TEST DATASET ACCOUNTS INITIALIZED SUCCESSFULLY ---');
