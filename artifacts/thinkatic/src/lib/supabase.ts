import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kajeoxbyyokauddoiumf.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!supabaseUrl) {
  console.warn("[Supabase] Warning: VITE_SUPABASE_URL is not set.");
}

if (!supabaseAnonKey) {
  console.warn("[Supabase] Warning: VITE_SUPABASE_PUBLISHABLE_KEY is not set.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
