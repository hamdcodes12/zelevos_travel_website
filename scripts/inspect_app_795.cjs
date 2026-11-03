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
  const { data: app } = await sb.from('bpo_partner_applications').select('id, company_data, centre_data, infrastructure_data').eq('id', 795).single();
  console.log('=== COMPANY DATA FOR 795 ===');
  console.log(JSON.stringify(app.company_data, null, 2));

  console.log('=== CENTRE DATA FOR 795 ===');
  console.log(JSON.stringify(app.centre_data, null, 2));

  console.log('=== INFRASTRUCTURE DATA FOR 795 ===');
  console.log(JSON.stringify(app.infrastructure_data, null, 2));
}

run();
