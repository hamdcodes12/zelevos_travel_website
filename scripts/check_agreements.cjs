const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync('.env', 'utf-8').split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    let key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}
const { createClient } = require(require.resolve('@supabase/supabase-js', { paths: ['./lib/db'] }));
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
client.from('bpo_partner_agreements').select('id, agreement_code, application_id, partner_id, status, signed_document_file_name').order('id', { ascending: false }).limit(5).then(({ data, error }) => {
  console.log('Agreements:', JSON.stringify(data, null, 2), error);
});
