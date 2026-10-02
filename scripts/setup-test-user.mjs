import pg from '../lib/db/node_modules/pg/lib/index.js';
import { randomBytes, scryptSync } from 'node:crypto';

const { Client } = pg;

async function main() {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('navin0044', salt, 64).toString('hex');
  const pwdHash = `${salt}:${hash}`;

  const client = new Client({
    connectionString: 'postgresql://postgres.hvsvqwrrkxjgrxiozjgz:e5nQzAKmnMQHRRoH@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  });
  await client.connect();

  const res = await client.query('SELECT id, email, customer_id FROM users WHERE lower(email) = $1', ['aarav108@gmail.com']);
  if (res.rows.length === 0) {
    const custId = 'CUST-' + Math.floor(100000 + Math.random() * 900000);
    await client.query(
      'INSERT INTO users (email, password_hash, full_name, role, email_verified, status, customer_id) VALUES ($1, $2, $3, $4, true, $5, $6)',
      ['aarav108@gmail.com', pwdHash, 'Aarav Sharma', 'user', 'active', custId]
    );
    console.log('Created aarav108 user successfully with customerId:', custId);
  } else {
    await client.query(
      'UPDATE users SET password_hash = $1, email_verified = true, status = $2 WHERE lower(email) = $3',
      [pwdHash, 'active', 'aarav108@gmail.com']
    );
    console.log('Updated aarav108 user password successfully');
  }

  // Ensure VND-HIMALAYAN and VND-VALLEYCABS are active and not archived
  await client.query(
    "UPDATE vendors SET is_archived = false, status = 'APPROVED', approval_status = 'approved' WHERE vendor_id IN ('VND-HIMALAYAN', 'VND-VALLEYCABS')"
  );
  console.log('Updated vendors VND-HIMALAYAN and VND-VALLEYCABS to active/unarchived');

  await client.end();
}

main().catch(console.error);
