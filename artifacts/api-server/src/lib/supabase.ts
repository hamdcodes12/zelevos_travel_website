export type SupabaseConfigStatus = {
  configured: boolean;
  url: string;
  publishableKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  databaseConfigured: boolean;
};

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

  return {
    configured: Boolean(url && publishableKey && secretKey && databaseConfigured),
    url,
    publishableKeyConfigured: Boolean(publishableKey),
    secretKeyConfigured: Boolean(secretKey),
    databaseConfigured,
  };
}

export function requireProductionSupabaseConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    throw new Error("Supabase production configuration is incomplete: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, and DATABASE_URL are required.");
  }
}
