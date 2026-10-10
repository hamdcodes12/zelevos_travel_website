import pg from '../lib/db/node_modules/pg/lib/index.js';
import { scryptSync, randomBytes } from 'node:crypto';

const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres.hvsvqwrrkxjgrxiozjgz:e5nQzAKmnMQHRRoH@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
await client.connect();

const salt = randomBytes(16).toString('hex');
const hash = scryptSync('navin0044', salt, 64).toString('hex');
const encoded = `${salt}:${hash}`;

await client.query('UPDATE users SET password_hash = $1 WHERE lower(email) = $2', [encoded, 'navin.kumar.chakraborty2453@gmail.com']);
console.log('Customer B password set to navin0044 successfully');
await client.end();
