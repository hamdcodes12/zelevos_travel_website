const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const jwt = require(require.resolve('jsonwebtoken', { paths: ['./artifacts/api-server'] }));
const USER_JWT_SECRET = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";

const token = jwt.sign(
  { id: '5ddb8508-540d-4583-a5af-0fecbd66c1ca', email: 'testguru0@gmail.com', role: 'bpo_partner', bpoStatus: 'PENDING' },
  USER_JWT_SECRET,
  { expiresIn: '7d' }
);

async function testSubmit() {
  console.log('Testing submit for app 795...');
  try {
    const res1 = await fetch('http://localhost:4317/api/partner/applications/795/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    console.log('/submit status:', res1.status);
    const body1 = await res1.json();
    console.log('/submit response:', body1);
  } catch (e) {
    console.error('Submit error:', e);
  }

  try {
    const res2 = await fetch('http://localhost:4317/api/partner/applications/795/submit-final', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    console.log('/submit-final status:', res2.status);
    const body2 = await res2.json();
    console.log('/submit-final response:', body2);
  } catch (e) {
    console.error('Submit-final error:', e);
  }
}

testSubmit();
