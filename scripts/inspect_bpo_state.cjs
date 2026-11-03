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

const supabaseJsPath = require.resolve('@supabase/supabase-js', { paths: ['./lib/db'] });
const { createClient } = require(supabaseJsPath);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { data: apps, error } = await sb
    .from('bpo_partner_applications')
    .select('*')
    .order('id', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching apps:', error);
    return;
  }

  console.log('Found', apps.length, 'latest applications:');
  if (apps.length > 0) {
    console.log('COLUMNS in bpo_partner_applications:', Object.keys(apps[0]));
  }
  for (const a of apps) {
    console.log('--------------------------------------------------');
    console.log(`ID: ${a.id} | Num: ${a.application_number} | Status: ${a.status} | SubmittedAt: ${a.submitted_at}`);
    console.log(`Applicant: ${a.applicant_user_id} | Partner: ${a.partner_id}`);
    console.log(`Company: ${a.company_data?.companyName} | Centre: ${a.centre_data?.centreName}`);
    console.log('verification_checks:', JSON.stringify(a.verification_checks));
  }
}

run();
