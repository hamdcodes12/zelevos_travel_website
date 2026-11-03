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

console.log("Supabase URL:", url);
console.log("Service key present:", Boolean(serviceKey && !serviceKey.startsWith("YOUR_")));
console.log("Service key prefix:", serviceKey ? serviceKey.slice(0, 15) + "..." : "none");

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log("client.auth.admin:", !!client.auth?.admin);
console.log("deleteUser function:", typeof client.auth?.admin?.deleteUser);

async function testAuthAdmin() {
  try {
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      console.log("listUsers error:", error.message);
    } else {
      console.log("listUsers success! Count:", data.users.length);
    }
  } catch (e) {
    console.log("listUsers exception:", e.message);
  }
}
testAuthAdmin();
