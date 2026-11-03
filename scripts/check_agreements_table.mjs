import fs from "fs";
import { createClient } from "../artifacts/api-server/node_modules/@supabase/supabase-js/dist/main/index.js";

function getEnv(key) {
  const envContent = fs.readFileSync(".env", "utf8");
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : process.env[key];
}

const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const { data: user, error: userErr } = await supabase.from("profiles").select("id, bpo_status").eq("account_type", "BPO").limit(1).maybeSingle();
  console.log("user:", user, "userErr:", userErr);
  if (user) {
    const res = await supabase.from("profiles").update({ bpo_status: "UNDER_REVIEW" }).eq("id", user.id);
    console.log("Update with UNDER_REVIEW error:", res.error);
    if (!res.error) {
      await supabase.from("profiles").update({ bpo_status: user.bpo_status }).eq("id", user.id);
    }
  }
}

test();
