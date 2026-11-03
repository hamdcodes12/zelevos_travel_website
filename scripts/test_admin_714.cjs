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
const ADMIN_JWT_SECRET = process.env.SESSION_SECRET || "thinkatic-admin-secret-key-2026-production";

const adminToken = jwt.sign(
  { id: 1, username: 'admin@thinkatic.com', role: 'admin' },
  ADMIN_JWT_SECRET,
  { expiresIn: '7d' }
);

async function testAdmin() {
  console.log('Testing Admin API for App 714 and user b60d62d5-0518-48c9-8f94-d171ee470203...');
  try {
    const res1 = await fetch('http://localhost:4317/api/admin/accreditation/applications/714', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('/admin/accreditation/applications/714 status:', res1.status);
    const body1 = await res1.json();
    console.log('Accreditation progress:', body1.dossier?.progressPercentage);
    console.log('Accreditation stages count:', body1.dossier?.stages?.length);
    console.log('Stages summary:', body1.dossier?.stages?.map(s => ({ id: s.id, status: s.status })));
  } catch (e) {
    console.error('Error 1:', e);
  }

  try {
    const res2 = await fetch('http://localhost:4317/api/admin/bpo-applications/b60d62d5-0518-48c9-8f94-d171ee470203', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('/admin/bpo-applications/:id status:', res2.status);
    const body2 = await res2.json();
    console.log('Application status in dossier:', body2.bpo?.bpo_status);
    console.log('Formal app status:', body2.formalApplication?.status);
    console.log('Company Name in dossier:', body2.bpo?.companyName);
  } catch (e) {
    console.error('Error 2:', e);
  }
}

testAdmin();
