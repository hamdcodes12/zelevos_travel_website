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
  const { data: bpoProfiles, error: err1 } = await sb
    .from('profiles')
    .select('id, email, full_name, role, account_type, bpo_status, created_at')
    .or('account_type.eq.BPO,account_type.ilike.bpo,role.eq.bpo_partner,role.eq.partner');

  console.log('BPO Profiles count:', bpoProfiles?.length, 'error:', err1);
  if (bpoProfiles && bpoProfiles.length > 0) {
    console.log('Last 5 BPO profiles:', bpoProfiles.slice(-5));
  }

  const { data: apps, error: err2 } = await sb
    .from('bpo_partner_applications')
    .select('id, application_number, applicant_user_id, status, submitted_at, created_at')
    .order('id', { ascending: false })
    .limit(10);

  console.log('Last 10 Applications:');
  for (const a of apps || []) {
    const { data: prof } = await sb.from('profiles').select('id, email, role, account_type, bpo_status').eq('id', a.applicant_user_id).maybeSingle();
    console.log(`App ${a.id} (${a.application_number}) status=${a.status} submitted_at=${a.submitted_at} applicant=${a.applicant_user_id}`);
    console.log('  -> Profile:', prof ? `${prof.email} role=${prof.role} acct=${prof.account_type} bpo_status=${prof.bpo_status}` : 'MISSING PROFILE!');
  }
}

run();
