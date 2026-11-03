import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: centres, error: cErr } = await supabase.from("bpo_centres").select("*");
  console.log("Centres in DB:", centres, cErr);

  const { data: partners, error: pErr } = await supabase.from("bpo_partners").select("id, name, partner_code, status");
  console.log("Partners in DB:", partners, pErr);
}

main().catch(console.error);
