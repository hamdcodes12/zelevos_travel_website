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

async function inspectColumns() {
  const tables = [
    "profiles",
    "bpo_partners",
    "bpo_partner_users",
    "bpo_partner_applications",
    "bpo_centre_verification",
    "bpo_centre_media",
    "bpo_centre_verification_history",
    "bpo_partner_agreements",
    "bpo_agreement_submissions",
    "bpo_partner_documents",
    "bpo_application_documents",
    "bpo_application_events",
    "audit_logs"
  ];

  for (const t of tables) {
    const { data, error } = await client.from(t).select("*").limit(1);
    if (error) {
      console.log(`Table ${t}: Error: ${error.message}`);
    } else {
      const sample = data[0] || {};
      console.log(`Table ${t}: Columns:`, Object.keys(sample).join(", "));
    }
  }
}

inspectColumns();
