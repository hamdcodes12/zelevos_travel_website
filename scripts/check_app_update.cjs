const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const supabaseJsPath = require.resolve('@supabase/supabase-js', { paths: ['./lib/db'] });
const { createClient } = require(supabaseJsPath);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const testStages = [
    'registration',
    'company_info',
    'centre_info',
    'infrastructure',
    'experience',
    'documents',
    'verification',
    'agreement',
    'under_review',
    'submitted',
    'review',
    'pending_review',
    'approved',
    'centre_id_generated'
  ];

  for (const st of testStages) {
    const res = await client.from("bpo_partner_applications").update({ current_stage: st }).eq("id", 9);
    console.log(`Stage '${st}':`, res.error ? `Error: ${res.error.message}` : 'VALID');
  }

  const testStatuses = [
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'resubmission_required'
  ];

  for (const st of testStatuses) {
    const res = await client.from("bpo_partner_applications").update({ status: st }).eq("id", 9);
    console.log(`Status '${st}':`, res.error ? `Error: ${res.error.message}` : 'VALID');
  }

  // Restore
  await client.from("bpo_partner_applications").update({ status: 'draft', current_stage: 'registration' }).eq("id", 9);
}

run();
