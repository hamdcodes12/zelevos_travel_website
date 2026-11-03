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
  const { data: prof } = await sb.from('profiles').select('*').eq('id', '5e5ca474-1a9e-4ed6-8196-3ccd313ea3ac').maybeSingle();
  console.log('Profile 5e5ca474:', prof);

  const { data: partner } = await sb.from('bpo_partners').select('*').eq('id', '5e5ca474-1a9e-4ed6-8196-3ccd313ea3ac').maybeSingle();
  console.log('BPO Partner 5e5ca474:', partner);

  const { data: agr50 } = await sb.from('bpo_partner_agreements').select('*').eq('id', 50).maybeSingle();
  console.log('Agreement 50:', agr50);
}

run();
