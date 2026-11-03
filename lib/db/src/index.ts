import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import Decimal from "decimal.js";
import {
  AUTHORITATIVE_CATALOGUE,
  AI_EXCLUDED_PLANS,
  type ServicePackageDefinition,
} from "./catalogueData.js";

export { AUTHORITATIVE_CATALOGUE, AI_EXCLUDED_PLANS, type ServicePackageDefinition };

const { Pool } = pg;

// Database URL (PostgreSQL Direct Connection)
export const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";

export const pgPool: pg.Pool | null = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
    })
  : null;

if (pgPool) {
  pgPool.on("error", () => {});
}

// Supabase URL - fallback to VITE_ prefix for compatibility, with production default
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://kajeoxbyyokauddoiumf.supabase.co";

// Supabase API Key resolution with safe fallback
let rawKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!rawKey || rawKey.startsWith("YOUR_")) {
  rawKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
}
const supabaseKey = rawKey;

// Validate configuration
if (!supabaseUrl) {
  console.error("[Supabase] CRITICAL: Supabase URL is not configured. Set SUPABASE_URL or VITE_SUPABASE_URL environment variable.");
}

if (!supabaseKey && !databaseUrl) {
  console.error("[Database] CRITICAL: Neither Supabase API key nor DATABASE_URL is configured.");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Database credentials (DATABASE_URL or SUPABASE_SECRET_KEY) must be configured in production");
  }
}

// Log connection status safely without exposing secrets
if (databaseUrl) {
  console.log(`[Database] Direct PostgreSQL connection configured`);
}
if (supabaseKey) {
  const keySource = process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith("YOUR_")
    ? "SUPABASE_SECRET_KEY"
    : process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("YOUR_")
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : "VITE_SUPABASE_PUBLISHABLE_KEY";
  console.log(`[Supabase] Initialized with URL: ${supabaseUrl}`);
  console.log(`[Supabase] Using key from: ${keySource}`);
  console.log(`[Supabase] Key format check: ${supabaseKey.startsWith("eyJ") ? "JWT format" : supabaseKey.startsWith("sb_") ? "Prefixed key" : "Unknown format"}`);
}

const effectiveKey = supabaseKey || "sb-unconfigured-placeholder-key";
export const supabase: SupabaseClient = createClient(supabaseUrl || "https://placeholder.supabase.co", effectiveKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function getSupabaseAdminClient(): SupabaseClient {
  return supabase;
}

export async function checkDatabaseConnection(): Promise<{ ok: boolean; type: string; details?: string }> {
  if (pgPool) {
    try {
      const client = await pgPool.connect();
      try {
        await client.query("SELECT 1;");
        return { ok: true, type: "PostgreSQL" };
      } finally {
        client.release(true);
      }
    } catch (err: any) {
      try {
        const { error } = await supabase.from("plans").select("id").limit(1);
        if (!error) return { ok: true, type: "Supabase REST (PG note: " + err.message + ")" };
      } catch {}
      return { ok: false, type: "PostgreSQL", details: err.message };
    }
  }
  try {
    const { error } = await supabase.from("plans").select("id").limit(1);
    if (error) return { ok: false, type: "Supabase REST", details: error.message };
    return { ok: true, type: "Supabase REST" };
  } catch (err: any) {
    return { ok: false, type: "Supabase REST", details: err.message };
  }
}

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface PlanRow {
  id: number;
  service_id: string;
  service_number: string;
  category: string;
  name: string;
  price: number;
  tag: string;
  description: string;
  features: string[];
  popular: boolean;
  sort_order: number;
  enabled?: boolean;
  client_visible?: boolean;
  service_name?: string;
  status?: string;
  payment_enabled?: boolean;
  package_slug?: string;
  target_customer?: string;
  billing_interval?: "one_time" | "monthly";
  currency?: string;
  delivery_timeline?: string;
  support_duration?: string;
  included_units?: string | null;
  price_display?: string;
  price_max?: number | null;
  pricing_type?: "fixed" | "range" | "custom";
  public_visible?: boolean;
  created_at: string;
  updated_at: string;
}

export type PlanStatus = "DRAFT" | "WAITING" | "PUBLISHED" | "ARCHIVED";

export interface Plan {
  id: number;
  serviceId: string;
  serviceNumber: string;
  category: string;
  serviceName?: string;
  packageName?: string;
  packageSlug?: string;
  name: string;
  tier?: string;
  price: number;
  priceMax?: number | null;
  priceDisplay?: string;
  pricingType?: "fixed" | "range" | "custom";
  currency?: string;
  billingInterval?: "one_time" | "monthly";
  tag: string;
  description: string;
  targetCustomer?: string;
  features: string[];
  deliveryTimeline?: string;
  supportDuration?: string;
  includedUnits?: string | null;
  popular: boolean;
  sortOrder: number;
  status: PlanStatus;
  paymentEnabled: boolean;
  enabled?: boolean;
  clientVisible?: boolean;
  publicVisible?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmissionRow {
  id: number;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  status: string;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  email: string;
  passwordHash?: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  accountType: "USER" | "BPO";
  bpoStatus: "PENDING" | "APPROVED" | "REJECTED";
  isActive: boolean;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  bpoApplicationDetails: Record<string, unknown>;
  selectedPlan: string | null;
  referralCode: string | null;
  referredBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceRecord {
  id: number;
  userId: string;
  date: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
  durationMinutes: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycVerification {
  id: number;
  userId: string;
  fullName: string;
  dateOfBirth: string | null;
  country: string;
  documentType: string;
  documentNumber: string;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateReferral {
  id: number;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  status: string;
  commissionRate: number;
  totalReward: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: number;
  userId: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: number;
  walletId: number;
  userId: string;
  type: string;
  amount: number;
  fee: number;
  status: string;
  description: string;
  referenceId: string | null;
  createdAt: Date;
}

export interface Purchase {
  id: number;
  userId: string;
  bpoId: string | null;
  packageId: string;
  packageName: string;
  paypalOrderId: string;
  paypalCaptureId: string | null;
  amount: number;
  currency: string;
  status: string;
  purchasedAt: Date | null;
  createdAt: Date;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  receiptId?: number | null;
  receiptNumber?: string | null;
}

export interface ActivePlanDetails {
  hasActivePlan: boolean;
  serviceId?: string;
  serviceNumber?: string;
  serviceName?: string;
  packageName?: string;
  category?: string;
  billingInterval?: string;
  price?: number;
  priceDisplay?: string;
  deliveryTimeline?: string;
  supportDuration?: string;
  features?: string[];
  paymentStatus?: "ACTIVE" | "INACTIVE";
  purchasedAt?: Date | null;
  orderId?: string | null;
  captureId?: string | null;
  invoice?: {
    id: number;
    invoiceNumber: string;
    status: string;
    total: number;
    amountPaid: number;
    paidAt: string | null;
  } | null;
  plan?: Plan | null;
  activePlan?: (Plan & { tier?: string; invoiceNumber?: string }) | null;
  purchase?: Purchase | null;
}

export interface PayoutDetail {
  id: number;
  method: "paypal" | "indian_bank";
  displayLabel: string;
  createdAt: Date;
}

export interface Withdrawal {
  id: number;
  userId: string;
  amount: number;
  currency: string;
  method: "paypal" | "indian_bank";
  payoutDetailsId: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface ClientUpdate {
  id: number;
  userId: string;
  title: string;
  message: string;
  category: string | null;
  status: "draft" | "published";
  createdBy: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientUpdateClient {
  userId: string;
  clientName: string;
  email: string;
  assignedPlan: string | null;
  planPrice: number | null;
  planSeats: string | null;
  planStatus: string;
  lastUpdateSent: string | null;
  updateCount: number;
}

// -----------------------------------------------------------------------------
// Mappers
// -----------------------------------------------------------------------------

const CATALOGUE_META_KEY = "service_catalog_extended";

// In-memory cache for fast metadata lookup
let _extendedMetaCache: Record<string, any> | null = null;

export async function getExtendedCatalogMetadata(): Promise<Record<string, any>> {
  if (_extendedMetaCache) return _extendedMetaCache;
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", CATALOGUE_META_KEY)
      .maybeSingle();

    if (data?.setting_value && typeof data.setting_value === "object") {
      _extendedMetaCache = data.setting_value as Record<string, any>;
      return _extendedMetaCache;
    }
  } catch (err) {
    console.warn("[Plans] Could not load extended metadata from platform_settings:", err);
  }

  // Fallback to AUTHORITATIVE_CATALOGUE defaults
  const defaults: Record<string, any> = {};
  for (const pkg of AUTHORITATIVE_CATALOGUE) {
    defaults[pkg.serviceId] = {
      serviceName: pkg.serviceName,
      packageName: pkg.name,
      name: pkg.name,
      tier: pkg.tier || pkg.name,
      packageSlug: pkg.serviceId,
      targetCustomer: pkg.targetCustomer,
      billingInterval: pkg.billingInterval,
      currency: pkg.currency,
      deliveryTimeline: pkg.deliveryTimeline,
      supportDuration: pkg.supportDuration,
      includedUnits: pkg.includedUnits,
      priceDisplay: pkg.priceDisplay,
      priceMax: pkg.priceMax,
      pricingType: pkg.pricingType,
      publicVisible: pkg.clientVisible,
    };
  }
  _extendedMetaCache = defaults;

  // Persist to platform_settings asynchronously
  (async () => {
    try {
      await supabase.from("platform_settings").upsert({
        setting_key: CATALOGUE_META_KEY,
        setting_value: defaults,
        updated_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn("[Plans] Could not persist default metadata:", e?.message || e);
    }
  })();

  return _extendedMetaCache;
}

export function mapPlanRow(row: PlanRow, extraMetadata?: Record<string, any>): Plan {
  const meta = extraMetadata?.[row.service_id] || (row as any).metadata || {};
  const authDefault = AUTHORITATIVE_CATALOGUE.find((c) => c.serviceId === row.service_id);

  const serviceName =
    row.service_name ||
    meta.serviceName ||
    meta.service_name ||
    authDefault?.serviceName ||
    row.category;

  const packageName = row.name;
  const tier = (row as any).tier || meta.tier || authDefault?.tier || row.name;
  const packageSlug = row.package_slug || meta.packageSlug || meta.package_slug || row.service_id;
  const targetCustomer =
    row.target_customer ||
    meta.targetCustomer ||
    meta.target_customer ||
    authDefault?.targetCustomer ||
    "";

  const billingInterval =
    row.billing_interval ||
    meta.billingInterval ||
    meta.billing_interval ||
    authDefault?.billingInterval ||
    (["Managed Services", "OPERATE"].includes(row.category) || row.tag?.includes("/mo") || row.tag?.includes("/month")
      ? "monthly"
      : "one_time");

  const currency = row.currency || meta.currency || authDefault?.currency || "USD";
  const deliveryTimeline =
    row.delivery_timeline ||
    meta.deliveryTimeline ||
    meta.delivery_timeline ||
    authDefault?.deliveryTimeline ||
    "Standard";

  const supportDuration =
    row.support_duration ||
    meta.supportDuration ||
    meta.support_duration ||
    authDefault?.supportDuration ||
    "Standard";

  const includedUnits =
    row.included_units !== undefined
      ? row.included_units
      : meta.includedUnits || meta.included_units || authDefault?.includedUnits || null;

  const priceMax =
    row.price_max !== undefined ? row.price_max : meta.priceMax ?? meta.price_max ?? authDefault?.priceMax ?? null;

  const priceDisplay =
    row.price_display ||
    meta.priceDisplay ||
    meta.price_display ||
    authDefault?.priceDisplay ||
    `$${Number(row.price).toLocaleString()}`;

  const pricingType: "fixed" | "range" | "custom" =
    row.pricing_type ||
    meta.pricingType ||
    authDefault?.pricingType ||
    (priceDisplay.toLowerCase().includes("custom")
      ? "custom"
      : priceDisplay.includes("+") || priceDisplay.includes("–") || priceDisplay.includes("-")
      ? "range"
      : "fixed");

  const publicVisible =
    row.public_visible !== undefined
      ? row.public_visible
      : meta.publicVisible !== undefined
      ? meta.publicVisible
      : row.client_visible !== false;

  // Status resolution
  let status: PlanStatus = "PUBLISHED";
  const rawStatus = String(row.status || meta.status || "").toUpperCase();
  if (rawStatus === "DRAFT" || rawStatus === "WAITING" || rawStatus === "PUBLISHED" || rawStatus === "ARCHIVED") {
    status = rawStatus as PlanStatus;
  } else if (row.client_visible === false && row.enabled === false) {
    status = "ARCHIVED";
  } else if (row.client_visible === false) {
    status = "DRAFT";
  } else if (meta.isWaiting || meta.status === "WAITING") {
    status = "WAITING";
  } else {
    status = "PUBLISHED";
  }

  // Payment enabled resolution
  let paymentEnabled = false;
  if (meta.paymentEnabled !== undefined) {
    paymentEnabled = Boolean(meta.paymentEnabled);
  } else if (meta.payment_enabled !== undefined) {
    paymentEnabled = Boolean(meta.payment_enabled);
  } else if (row.payment_enabled !== undefined) {
    paymentEnabled = Boolean(row.payment_enabled);
  } else {
    paymentEnabled = row.enabled !== false && pricingType === "fixed" && status === "PUBLISHED";
  }

  // Under WAITING, DRAFT, or ARCHIVED, payment is unconditionally disabled
  if (status === "WAITING" || status === "DRAFT" || status === "ARCHIVED") {
    paymentEnabled = false;
  }

  return {
    id: Number(row.id),
    serviceId: row.service_id,
    serviceNumber: row.service_number,
    category: row.category,
    serviceName,
    name: packageName,
    tier,
    packageName,
    packageSlug,
    price: Number(row.price),
    priceMax,
    priceDisplay,
    pricingType,
    currency,
    billingInterval,
    tag: row.tag,
    description: row.description,
    targetCustomer,
    features: Array.isArray(row.features) ? row.features : [],
    deliveryTimeline,
    supportDuration,
    includedUnits,
    popular: Boolean(row.popular),
    sortOrder: Number(row.sort_order),
    status,
    paymentEnabled,
    enabled: row.enabled !== false,
    clientVisible: status === "PUBLISHED" || status === "WAITING" ? row.client_visible !== false : false,
    publicVisible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function invalidateCatalogMetadataCache(): void {
  _extendedMetaCache = null;
}

export function mapContactRow(row: ContactSubmissionRow): ContactSubmission {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    company: row.company,
    budget: row.budget,
    message: row.message,
    status: row.status,
    notes: row.notes,
    source: row.source,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapAdminRow(row: AdminUserRow): AdminUser {
  return {
    id: Number(row.id),
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// -----------------------------------------------------------------------------
// Plans Repository
// -----------------------------------------------------------------------------

let _catalogueSyncPromise: Promise<void> | null = null;

async function ensureAuthoritativeCatalogue(): Promise<void> {
  if (_catalogueSyncPromise) return _catalogueSyncPromise;

  _catalogueSyncPromise = (async () => {
    try {
      // 1. Fetch current plans from DB
      const { data: existingRows, error: fetchErr } = await supabase
        .from("plans")
        .select("id, service_id, category, enabled, client_visible, price");

      if (fetchErr) {
        console.warn("[Plans] Could not verify existing catalogue:", fetchErr.message);
        return;
      }

      const existingMap = new Map((existingRows || []).map((r: any) => [r.service_id, r]));

      // 2. Disable legacy AI internal plans
      for (const [sId, row] of existingMap.entries()) {
        if (AI_EXCLUDED_PLANS.has(sId) || row.category === "AI & Automation") {
          if (row.client_visible !== false) {
            await supabase
              .from("plans")
              .update({ client_visible: false, updated_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        }
      }

      // 3. Seed missing authoritative packages WITHOUT overwriting existing database prices/edits
      const existingMeta = await getExtendedCatalogMetadata();
      const metaToPersist: Record<string, any> = { ...existingMeta };
      let metaChanged = false;

      for (const pkg of AUTHORITATIVE_CATALOGUE) {
        if (!metaToPersist[pkg.serviceId]) {
          metaToPersist[pkg.serviceId] = {
            serviceName: pkg.serviceName,
            packageName: pkg.name,
            name: pkg.name,
            tier: pkg.tier || pkg.name,
            packageSlug: pkg.serviceId,
            targetCustomer: pkg.targetCustomer,
            billingInterval: pkg.billingInterval,
            currency: pkg.currency,
            deliveryTimeline: pkg.deliveryTimeline,
            supportDuration: pkg.supportDuration,
            includedUnits: pkg.includedUnits,
            priceDisplay: pkg.priceDisplay,
            priceMax: pkg.priceMax,
            pricingType: pkg.pricingType,
            publicVisible: pkg.clientVisible,
            status: pkg.clientVisible ? "PUBLISHED" : "DRAFT",
            paymentEnabled: pkg.pricingType === "fixed",
          };
          metaChanged = true;
        }

        const existing = existingMap.get(pkg.serviceId);
        if (!existing) {
          await supabase.from("plans").insert({
            service_id: pkg.serviceId,
            service_number: pkg.serviceNumber,
            category: pkg.category,
            name: pkg.name,
            price: pkg.price,
            tag: pkg.tag,
            description: pkg.description,
            features: pkg.features,
            popular: Boolean(pkg.popular),
            sort_order: pkg.sortOrder,
            enabled: pkg.enabled,
            client_visible: pkg.clientVisible,
          });
        }
        // Note: If existing exists in DB, we DO NOT OVERWRITE IT. The DB is authoritative!
      }

      if (metaChanged) {
        await supabase.from("platform_settings").upsert(
          {
            setting_key: CATALOGUE_META_KEY,
            setting_value: metaToPersist,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );
        _extendedMetaCache = metaToPersist;
      }
    } catch (syncError: any) {
      console.warn("[Plans] Catalogue sync notice:", syncError?.message || syncError);
    }
  })();

  return _catalogueSyncPromise;
}

export const plansRepository = {
  async getAll(): Promise<Plan[]> {
    await ensureAuthoritativeCatalogue();
    const meta = await getExtendedCatalogMetadata();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("service_number", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return ((data as PlanRow[]) || [])
      .filter((r) => !AI_EXCLUDED_PLANS.has(r.service_id))
      .map((r) => mapPlanRow(r, meta));
  },

  async getClientVisible(): Promise<Plan[]> {
    await ensureAuthoritativeCatalogue();
    const meta = await getExtendedCatalogMetadata();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("client_visible", true)
      .order("service_number", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const mapped = ((data as PlanRow[]) || []).map((r) => mapPlanRow(r, meta));

    // Client visible rule:
    // - status must be PUBLISHED or WAITING
    // - clientVisible must be true
    // - status must not be DRAFT or ARCHIVED
    // - not in AI_EXCLUDED_PLANS
    return mapped.filter(
      (p) =>
        p.clientVisible !== false &&
        (p.status === "PUBLISHED" || p.status === "WAITING") &&
        !AI_EXCLUDED_PLANS.has(p.serviceId)
    );
  },

  async getById(id: number): Promise<Plan | null> {
    const meta = await getExtendedCatalogMetadata();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPlanRow(data as PlanRow, meta) : null;
  },

  async getByServiceId(serviceId: string): Promise<Plan | null> {
    await ensureAuthoritativeCatalogue();
    const meta = await getExtendedCatalogMetadata();
    const cleanId = serviceId.trim().toLowerCase();

    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .ilike("service_id", cleanId)
      .maybeSingle();

    if (error) throw error;
    if (data) return mapPlanRow(data as PlanRow, meta);

    // Fallback: search in AUTHORITATIVE_CATALOGUE defaults
    const auth = AUTHORITATIVE_CATALOGUE.find(
      (c) => c.serviceId.toLowerCase() === cleanId || c.name.toLowerCase() === cleanId
    );
    if (!auth) return null;

    return mapPlanRow(
      {
        id: 0,
        service_id: auth.serviceId,
        service_number: auth.serviceNumber,
        category: auth.category,
        name: auth.name,
        price: auth.price,
        tag: auth.tag,
        description: auth.description,
        features: auth.features,
        popular: Boolean(auth.popular),
        sort_order: auth.sortOrder,
        enabled: auth.enabled,
        client_visible: auth.clientVisible,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      meta
    );
  },

  async create(plan: Partial<Plan> & { serviceId: string; name: string; price: number; category: string }): Promise<Plan> {
    const serviceId = (plan.serviceId || plan.packageSlug || (plan.name || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();
    const status: PlanStatus = plan.status || "DRAFT";
    const clientVisible = status === "PUBLISHED" || status === "WAITING";
    const paymentEnabled = status === "PUBLISHED" && Boolean(plan.paymentEnabled);

    const { data, error } = await supabase
      .from("plans")
      .insert({
        service_id: serviceId,
        service_number: plan.serviceNumber || "99",
        category: plan.category || "BUILD",
        name: plan.name,
        price: Number(plan.price) || 0,
        tag: plan.tag || plan.tier || "Standard",
        description: plan.description || "",
        features: Array.isArray(plan.features) ? plan.features : [],
        popular: Boolean(plan.popular),
        sort_order: Number(plan.sortOrder) || 0,
        enabled: status !== "ARCHIVED",
        client_visible: clientVisible,
      })
      .select()
      .single();

    if (error) throw error;

    // Persist extended metadata in platform_settings
    const meta = await getExtendedCatalogMetadata();
    meta[serviceId] = {
      serviceName: plan.serviceName || plan.name,
      packageName: plan.name,
      name: plan.name,
      tier: plan.tier || plan.name,
      packageSlug: serviceId,
      targetCustomer: plan.targetCustomer || "",
      billingInterval: plan.billingInterval || "one_time",
      currency: plan.currency || "USD",
      deliveryTimeline: plan.deliveryTimeline || "Standard",
      supportDuration: plan.supportDuration || "Standard",
      includedUnits: plan.includedUnits || null,
      priceDisplay: plan.priceDisplay || (plan.pricingType === "custom" ? "Custom Pricing" : `$${Number(plan.price).toLocaleString()}`),
      priceMax: plan.priceMax || null,
      pricingType: plan.pricingType || (Number(plan.price) > 0 ? "fixed" : "custom"),
      publicVisible: clientVisible,
      status,
      paymentEnabled,
    };

    _extendedMetaCache = meta;
    await supabase.from("platform_settings").upsert(
      { setting_key: CATALOGUE_META_KEY, setting_value: meta, updated_at: new Date().toISOString() },
      { onConflict: "setting_key" }
    );

    return mapPlanRow(data as PlanRow, meta);
  },

  async update(id: number, updates: Partial<Plan>): Promise<Plan | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const serviceId = updates.serviceId || current.serviceId;
    const status: PlanStatus = updates.status || current.status;
    let clientVisible = updates.clientVisible !== undefined ? updates.clientVisible : current.clientVisible;
    if (updates.status) {
      if (updates.status === "DRAFT" || updates.status === "ARCHIVED") {
        clientVisible = false;
      } else if (updates.status === "WAITING" || updates.status === "PUBLISHED") {
        clientVisible = true;
      }
    }

    let paymentEnabled = updates.paymentEnabled !== undefined ? updates.paymentEnabled : current.paymentEnabled;
    if (status === "WAITING" || status === "DRAFT" || status === "ARCHIVED") {
      paymentEnabled = false;
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      client_visible: clientVisible,
      enabled: status !== "ARCHIVED",
    };

    if (updates.serviceId !== undefined) payload.service_id = updates.serviceId;
    if (updates.serviceNumber !== undefined) payload.service_number = updates.serviceNumber;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.price !== undefined) payload.price = Number(updates.price);
    if (updates.tag !== undefined) payload.tag = updates.tag;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.features !== undefined) payload.features = updates.features;
    if (updates.popular !== undefined) payload.popular = updates.popular;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from("plans")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Update metadata in platform_settings
    const meta = await getExtendedCatalogMetadata();
    meta[serviceId] = {
      ...meta[serviceId],
      ...(updates.serviceName !== undefined ? { serviceName: updates.serviceName } : {}),
      ...(updates.name !== undefined ? { packageName: updates.name, name: updates.name } : {}),
      ...(updates.tier !== undefined ? { tier: updates.tier } : {}),
      ...(updates.targetCustomer !== undefined ? { targetCustomer: updates.targetCustomer } : {}),
      ...(updates.billingInterval !== undefined ? { billingInterval: updates.billingInterval } : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
      ...(updates.deliveryTimeline !== undefined ? { deliveryTimeline: updates.deliveryTimeline } : {}),
      ...(updates.supportDuration !== undefined ? { supportDuration: updates.supportDuration } : {}),
      ...(updates.includedUnits !== undefined ? { includedUnits: updates.includedUnits } : {}),
      ...(updates.priceDisplay !== undefined ? { priceDisplay: updates.priceDisplay } : {}),
      ...(updates.priceMax !== undefined ? { priceMax: updates.priceMax } : {}),
      ...(updates.pricingType !== undefined ? { pricingType: updates.pricingType } : {}),
      publicVisible: clientVisible,
      status,
      paymentEnabled,
    };

    _extendedMetaCache = meta;
    await supabase.from("platform_settings").upsert(
      { setting_key: CATALOGUE_META_KEY, setting_value: meta, updated_at: new Date().toISOString() },
      { onConflict: "setting_key" }
    );

    return mapPlanRow(data as PlanRow, meta);
  },

  async isReferenced(serviceId: string, planName?: string): Promise<{ referenced: boolean; count: number; details: string[] }> {
    const details: string[] = [];
    let count = 0;

    try {
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, package_id, package_name")
        .or(`package_id.eq.${serviceId},package_name.ilike.%${planName || serviceId}%`)
        .limit(5);

      if (purchases && purchases.length > 0) {
        count += purchases.length;
        details.push(`${purchases.length} historical purchase(s)`);
      }
    } catch {}

    try {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, selected_plan")
        .eq("selected_plan", serviceId)
        .limit(5);

      if (users && users.length > 0) {
        count += users.length;
        details.push(`${users.length} active client profile(s)`);
      }
    } catch {}

    return { referenced: count > 0, count, details };
  },

  async archive(id: number): Promise<Plan | null> {
    return this.update(id, {
      status: "ARCHIVED",
      clientVisible: false,
      paymentEnabled: false,
    });
  },

  async duplicate(id: number): Promise<Plan | null> {
    const original = await this.getById(id);
    if (!original) return null;

    const copyServiceId = `${original.serviceId}-copy-${Date.now().toString().slice(-4)}`;
    const copyName = `${original.name} (Copy)`;

    return this.create({
      ...original,
      serviceId: copyServiceId,
      name: copyName,
      status: "DRAFT",
      clientVisible: false,
      paymentEnabled: false,
      sortOrder: (original.sortOrder || 0) + 1,
    });
  },

  async delete(id: number): Promise<{ success: boolean; archivedInstead?: boolean; message?: string }> {
    const existing = await this.getById(id);
    if (!existing) return { success: false, message: "Plan not found" };

    // Check if referenced
    const refCheck = await this.isReferenced(existing.serviceId, existing.name);
    if (refCheck.referenced) {
      await this.archive(id);
      return {
        success: true,
        archivedInstead: true,
        message: `Plan is referenced by ${refCheck.details.join(", ")}. It has been safely ARCHIVED instead of deleted to protect historical records.`,
      };
    }

    const { error, count } = await supabase
      .from("plans")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw error;
    if (existing?.serviceId && _extendedMetaCache) {
      delete _extendedMetaCache[existing.serviceId];
      await supabase.from("platform_settings").upsert(
        { setting_key: CATALOGUE_META_KEY, setting_value: _extendedMetaCache, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
      );
    }
    return { success: (count ?? 0) > 0 };
  },

  async logAudit(adminId: number | string | null, action: string, planId: number | string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await supabase.from("audit_logs").insert({
        actor_admin_id: typeof adminId === "number" ? adminId : null,
        actor_user_id: typeof adminId === "string" ? adminId : null,
        action,
        entity_type: "plan",
        entity_id: String(planId),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn("[Plans] Could not write audit log:", err);
    }
  },

  async getAuditLogs(planId?: number | string): Promise<any[]> {
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "plan")
        .order("created_at", { ascending: false })
        .limit(50);

      if (planId) {
        query = query.eq("entity_id", String(planId));
      }

      const { data } = await query;
      return data || [];
    } catch {
      return [];
    }
  },

  async syncCatalogue(): Promise<void> {
    _catalogueSyncPromise = null;
    await ensureAuthoritativeCatalogue();
  },

  async seedIfEmpty(_seedPlans?: Array<Omit<Plan, "id" | "createdAt" | "updatedAt">>): Promise<void> {
    await ensureAuthoritativeCatalogue();
  },
};

// -----------------------------------------------------------------------------
// Contacts Repository (Leads)
// -----------------------------------------------------------------------------

export const contactsRepository = {
  async create(data: {
    name: string;
    email: string;
    company?: string | null;
    budget?: string | null;
    message: string;
    source?: string | null;
  }): Promise<ContactSubmission> {
    const { data: created, error } = await supabase
      .from("contact_submissions")
      .insert({
        name: data.name,
        email: data.email,
        company: data.company ?? null,
        budget: data.budget ?? null,
        message: data.message,
        source: data.source ?? "contact_form",
        status: "new",
      })
      .select()
      .single();

    if (error) throw error;
    return mapContactRow(created as ContactSubmissionRow);
  },

  async list(options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ContactSubmission[]> {
    let query = supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }
    if (options.limit !== undefined) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as ContactSubmissionRow[] || []).map(mapContactRow);
  },

  async getById(id: number): Promise<ContactSubmission | null> {
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapContactRow(data as ContactSubmissionRow) : null;
  },

  async update(id: number, updates: { status?: string; notes?: string | null }): Promise<ContactSubmission | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabase
      .from("contact_submissions")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data ? mapContactRow(data as ContactSubmissionRow) : null;
  },

  async delete(id: number): Promise<boolean> {
    const { error, count } = await supabase
      .from("contact_submissions")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async getStats() {
    const { data: allRows, error: rowsErr } = await supabase
      .from("contact_submissions")
      .select("status, budget, created_at");
    if (rowsErr) throw rowsErr;

    const total = allRows ? allRows.length : 0;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let today = 0;
    let thisWeek = 0;
    const statusMap = new Map<string, number>();
    const budgetMap = new Map<string, number>();

    for (const r of (allRows || [])) {
      const createdAtMs = new Date(r.created_at).getTime();
      if (createdAtMs >= oneDayAgo) today++;
      if (createdAtMs >= sevenDaysAgo) thisWeek++;

      const st = r.status || "new";
      statusMap.set(st, (statusMap.get(st) || 0) + 1);

      if (r.budget) {
        budgetMap.set(r.budget, (budgetMap.get(r.budget) || 0) + 1);
      }
    }

    const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
    const byBudget = Array.from(budgetMap.entries()).map(([budget, count]) => ({ budget, count }));

    return {
      total: total ?? 0,
      today,
      thisWeek,
      byStatus,
      byBudget,
    };
  },
};

// -----------------------------------------------------------------------------
// Admin Repository
// -----------------------------------------------------------------------------

export const adminRepository = {
  async getByUsername(username: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    return data ? mapAdminRow(data as AdminUserRow) : null;
  },

  async getById(id: number): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapAdminRow(data as AdminUserRow) : null;
  },

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    const { error } = await supabase
      .from("admin_users")
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },

  async ensureDefaultAdmin(defaultPasswordHash: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id")
        .eq("username", "admin")
        .maybeSingle();

      if (error) {
        console.warn("[Admin] Could not check admin existence:", error.message);
        return;
      }

      if (!data) {
        await supabase.from("admin_users").insert({
          username: "admin",
          password_hash: defaultPasswordHash,
        });
        console.log("[Admin] Default admin user initialized in Supabase.");
      }
    } catch (err: any) {
      console.warn("[Admin] Ensure default admin warning:", err?.message || err);
    }
  },
};

// -----------------------------------------------------------------------------
// User Profile Repository
// -----------------------------------------------------------------------------

export const userProfileRepository = {
  async getAll(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash ?? null,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      role: row.role,
      accountType: row.account_type ?? (row.role === "partner" || row.role === "bpo_partner" ? "BPO" : "USER"),
      bpoStatus: row.bpo_status ?? "APPROVED",
      isActive: row.is_active ?? true,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
      bpoApplicationDetails: row.bpo_application_details ?? {},
      selectedPlan: row.selected_plan ?? null,
      referralCode: row.referral_code,
      referredBy: row.referred_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  },

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash ?? null,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      role: data.role,
      accountType: data.account_type ?? (data.role === "partner" || data.role === "bpo_partner" ? "BPO" : "USER"),
      bpoStatus: data.bpo_status ?? "APPROVED",
      isActive: data.is_active ?? true,
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      rejectedAt: data.rejected_at ? new Date(data.rejected_at) : null,
      bpoApplicationDetails: data.bpo_application_details ?? {},
      selectedPlan: data.selected_plan ?? null,
      referralCode: data.referral_code,
      referredBy: data.referred_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async getByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash ?? null,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      role: data.role,
      accountType: data.account_type ?? (data.role === "partner" || data.role === "bpo_partner" ? "BPO" : "USER"),
      bpoStatus: data.bpo_status ?? "APPROVED",
      isActive: data.is_active ?? true,
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      rejectedAt: data.rejected_at ? new Date(data.rejected_at) : null,
      bpoApplicationDetails: data.bpo_application_details ?? {},
      selectedPlan: data.selected_plan ?? null,
      referralCode: data.referral_code,
      referredBy: data.referred_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async getByReferralCode(code: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("referral_code", code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash ?? null,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      role: data.role,
      accountType: data.account_type ?? (data.role === "partner" || data.role === "bpo_partner" ? "BPO" : "USER"),
      bpoStatus: data.bpo_status ?? "APPROVED",
      isActive: data.is_active ?? true,
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      rejectedAt: data.rejected_at ? new Date(data.rejected_at) : null,
      bpoApplicationDetails: data.bpo_application_details ?? {},
      selectedPlan: data.selected_plan ?? null,
      referralCode: data.referral_code,
      referredBy: data.referred_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async create(data: {
    id?: string;
    email: string;
    passwordHash?: string;
    fullName?: string;
    avatarUrl?: string;
    role?: string;
    selectedPlan?: string;
    referralCode?: string;
    referredBy?: string;
    accountType?: "USER" | "BPO";
    bpoStatus?: "PENDING" | "APPROVED" | "REJECTED";
    isActive?: boolean;
    bpoApplicationDetails?: Record<string, unknown>;
  }): Promise<Profile> {
    const payload: Record<string, unknown> = {
      email: data.email,
      password_hash: data.passwordHash ?? null,
      full_name: data.fullName ?? null,
      avatar_url: data.avatarUrl ?? null,
      role: data.role ?? "user",
      selected_plan: data.selectedPlan ?? null,
      referral_code: data.referralCode ?? ("REF_" + Math.random().toString(36).substring(2, 8).toUpperCase()),
      referred_by: data.referredBy ?? null,
      account_type: data.accountType ?? "USER",
      bpo_status: data.bpoStatus ?? "APPROVED",
      is_active: data.isActive ?? true,
      bpo_application_details: data.bpoApplicationDetails ?? {},
    };
    if (data.id) payload.id = data.id;

    const { data: created, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: created.id,
      email: created.email,
      passwordHash: created.password_hash ?? null,
      fullName: created.full_name,
      avatarUrl: created.avatar_url,
      role: created.role,
      accountType: created.account_type ?? (created.role === "partner" || created.role === "bpo_partner" ? "BPO" : "USER"),
      bpoStatus: created.bpo_status ?? "APPROVED",
      isActive: created.is_active ?? true,
      approvedAt: created.approved_at ? new Date(created.approved_at) : null,
      rejectedAt: created.rejected_at ? new Date(created.rejected_at) : null,
      bpoApplicationDetails: created.bpo_application_details ?? {},
      selectedPlan: created.selected_plan ?? null,
      referralCode: created.referral_code,
      referredBy: created.referred_by,
      createdAt: new Date(created.created_at),
      updatedAt: new Date(created.updated_at),
    };
  },

  async update(
    id: string,
    updates: Partial<{
      fullName: string;
      avatarUrl: string;
      role: string;
      selectedPlan: string;
      passwordHash: string;
      isActive: boolean;
      accountType: "USER" | "BPO";
      bpoStatus: "PENDING" | "APPROVED" | "REJECTED";
      bpoApplicationDetails: Record<string, any>;
    }>
  ): Promise<Profile | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.selectedPlan !== undefined) payload.selected_plan = updates.selectedPlan;
    if (updates.passwordHash !== undefined) payload.password_hash = updates.passwordHash;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.accountType !== undefined) payload.account_type = updates.accountType;
    if (updates.bpoStatus !== undefined) payload.bpo_status = updates.bpoStatus;
    if (updates.bpoApplicationDetails !== undefined) payload.bpo_application_details = updates.bpoApplicationDetails;

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash ?? null,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      role: data.role,
      accountType: data.account_type ?? (data.role === "partner" || data.role === "bpo_partner" ? "BPO" : "USER"),
      bpoStatus: data.bpo_status ?? "APPROVED",
      isActive: data.is_active ?? true,
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      rejectedAt: data.rejected_at ? new Date(data.rejected_at) : null,
      bpoApplicationDetails: data.bpo_application_details ?? {},
      selectedPlan: data.selected_plan ?? null,
      referralCode: data.referral_code,
      referredBy: data.referred_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async selectPlan(userId: string, planServiceId: string): Promise<Profile | null> {
    return this.update(userId, { selectedPlan: planServiceId });
  },

  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const { error } = await supabase
      .from("profiles")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", userId);
    return !error;
  },
};

// -----------------------------------------------------------------------------
// Client Updates Repository
// -----------------------------------------------------------------------------

function mapClientUpdateRow(row: any): ClientUpdate {
  return {
    id: Number(row.id),
    userId: row.user_id,
    title: row.title,
    message: row.message,
    category: row.category ?? null,
    status: row.status === "published" ? "published" : "draft",
    createdBy: row.created_by,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const clientUpdatesRepository = {
  async getPublishedForUser(userId: string): Promise<ClientUpdate[]> {
    const { data, error } = await supabase
      .from("client_updates")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapClientUpdateRow);
  },

  async getForUser(userId: string): Promise<ClientUpdate[]> {
    const { data, error } = await supabase
      .from("client_updates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapClientUpdateRow);
  },

  async getById(id: number): Promise<ClientUpdate | null> {
    const { data, error } = await supabase
      .from("client_updates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapClientUpdateRow(data) : null;
  },

  async create(data: {
    userId: string;
    title: string;
    message: string;
    category?: string | null;
    status: "draft" | "published";
    createdBy: string;
  }): Promise<ClientUpdate> {
    const publishedAt = data.status === "published" ? new Date().toISOString() : null;
    const { data: created, error } = await supabase
      .from("client_updates")
      .insert({
        user_id: data.userId,
        title: data.title,
        message: data.message,
        category: data.category ?? null,
        status: data.status,
        created_by: data.createdBy,
        published_at: publishedAt,
      })
      .select()
      .single();
    if (error) throw error;
    return mapClientUpdateRow(created);
  },

  async update(id: number, updates: {
    title?: string;
    message?: string;
    category?: string | null;
    status?: "draft" | "published";
  }): Promise<ClientUpdate | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.message !== undefined) payload.message = updates.message;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.status !== undefined) {
      payload.status = updates.status;
      payload.published_at = updates.status === "published" ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase
      .from("client_updates")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapClientUpdateRow(data) : null;
  },

  async delete(id: number): Promise<boolean> {
    const { error, count } = await supabase
      .from("client_updates")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
};

// -----------------------------------------------------------------------------
// Attendance Repository
// -----------------------------------------------------------------------------

export const attendanceRepository = {
  async checkIn(userId: string, notes?: string): Promise<AttendanceRecord> {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("attendance")
      .upsert(
        {
          user_id: userId,
          date: today,
          check_in: new Date().toISOString(),
          status: "present",
          notes: notes ?? null,
        },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) throw error;
    return {
      id: Number(data.id),
      userId: data.user_id,
      date: data.date,
      checkIn: new Date(data.check_in),
      checkOut: data.check_out ? new Date(data.check_out) : null,
      status: data.status,
      durationMinutes: data.duration_minutes ?? 0,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async checkOut(userId: string): Promise<AttendanceRecord | null> {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    const { data: current } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    let durationMinutes = 0;
    if (current && current.check_in) {
      durationMinutes = Math.max(0, Math.round((now.getTime() - new Date(current.check_in).getTime()) / 60000));
    }

    const { data, error } = await supabase
      .from("attendance")
      .update({
        check_out: now.toISOString(),
        duration_minutes: durationMinutes,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId)
      .eq("date", today)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: Number(data.id),
      userId: data.user_id,
      date: data.date,
      checkIn: new Date(data.check_in),
      checkOut: data.check_out ? new Date(data.check_out) : null,
      status: data.status,
      durationMinutes: data.duration_minutes ?? 0,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async getUserAttendance(userId: string, limit = 30): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: Number(r.id),
      userId: r.user_id,
      date: r.date,
      checkIn: new Date(r.check_in),
      checkOut: r.check_out ? new Date(r.check_out) : null,
      status: r.status,
      durationMinutes: r.duration_minutes ?? 0,
      notes: r.notes,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }));
  },

  async getAllAttendance(options: { date?: string; status?: string; limit?: number } = {}): Promise<AttendanceRecord[]> {
    let query = supabase.from("attendance").select("*").order("date", { ascending: false });
    if (options.date) query = query.eq("date", options.date);
    if (options.status) query = query.eq("status", options.status);
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: Number(r.id),
      userId: r.user_id,
      date: r.date,
      checkIn: new Date(r.check_in),
      checkOut: r.check_out ? new Date(r.check_out) : null,
      status: r.status,
      durationMinutes: r.duration_minutes ?? 0,
      notes: r.notes,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }));
  },
};

// -----------------------------------------------------------------------------
// KYC Repository
// -----------------------------------------------------------------------------

export const kycRepository = {
  async submit(data: {
    userId: string;
    fullName: string;
    dateOfBirth?: string;
    country?: string;
    documentType: string;
    documentNumber: string;
    documentFrontUrl?: string;
    documentBackUrl?: string;
    selfieUrl?: string;
  }): Promise<KycVerification> {
    const { data: created, error } = await supabase
      .from("kyc_verifications")
      .upsert(
        {
          user_id: data.userId,
          full_name: data.fullName,
          date_of_birth: data.dateOfBirth ?? null,
          country: data.country ?? "US",
          document_type: data.documentType,
          document_number: data.documentNumber,
          document_front_url: data.documentFrontUrl ?? null,
          document_back_url: data.documentBackUrl ?? null,
          selfie_url: data.selfieUrl ?? null,
          status: "pending",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return {
      id: Number(created.id),
      userId: created.user_id,
      fullName: created.full_name,
      dateOfBirth: created.date_of_birth,
      country: created.country,
      documentType: created.document_type,
      documentNumber: created.document_number,
      documentFrontUrl: created.document_front_url,
      documentBackUrl: created.document_back_url,
      selfieUrl: created.selfie_url,
      status: created.status,
      rejectionReason: created.rejection_reason,
      reviewedBy: created.reviewed_by,
      submittedAt: new Date(created.submitted_at),
      verifiedAt: created.verified_at ? new Date(created.verified_at) : null,
      createdAt: new Date(created.created_at),
      updatedAt: new Date(created.updated_at),
    };
  },

  async getByUserId(userId: string): Promise<KycVerification | null> {
    const { data, error } = await supabase
      .from("kyc_verifications")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: Number(data.id),
      userId: data.user_id,
      fullName: data.full_name,
      dateOfBirth: data.date_of_birth,
      country: data.country,
      documentType: data.document_type,
      documentNumber: data.document_number,
      documentFrontUrl: data.document_front_url,
      documentBackUrl: data.document_back_url,
      selfieUrl: data.selfie_url,
      status: data.status,
      rejectionReason: data.rejection_reason,
      reviewedBy: data.reviewed_by,
      submittedAt: new Date(data.submitted_at),
      verifiedAt: data.verified_at ? new Date(data.verified_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async listAll(options: { status?: string; limit?: number } = {}): Promise<KycVerification[]> {
    let query = supabase.from("kyc_verifications").select("*").order("submitted_at", { ascending: false });
    if (options.status) query = query.eq("status", options.status);
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: Number(d.id),
      userId: d.user_id,
      fullName: d.full_name,
      dateOfBirth: d.date_of_birth,
      country: d.country,
      documentType: d.document_type,
      documentNumber: d.document_number,
      documentFrontUrl: d.document_front_url,
      documentBackUrl: d.document_back_url,
      selfieUrl: d.selfie_url,
      status: d.status,
      rejectionReason: d.rejection_reason,
      reviewedBy: d.reviewed_by,
      submittedAt: new Date(d.submitted_at),
      verifiedAt: d.verified_at ? new Date(d.verified_at) : null,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    }));
  },

  async review(id: number, status: "verified" | "rejected", reason?: string, reviewer?: string): Promise<boolean> {
    const payload: Record<string, unknown> = {
      status,
      reviewed_by: reviewer ?? "admin",
      rejection_reason: status === "rejected" ? reason : null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error, count } = await supabase
      .from("kyc_verifications")
      .update(payload, { count: "exact" })
      .eq("id", id);

    if (error) throw error;
    return (count ?? 0) > 0;
  },
};

// -----------------------------------------------------------------------------
// Affiliate & Referrals Repository
// -----------------------------------------------------------------------------

export const affiliateRepository = {
  async registerReferral(referrerId: string, referredUserId: string, referralCode: string): Promise<AffiliateReferral> {
    const { data, error } = await supabase
      .from("affiliate_referrals")
      .insert({
        referrer_id: referrerId,
        referred_user_id: referredUserId,
        referral_code: referralCode,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: Number(data.id),
      referrerId: data.referrer_id,
      referredUserId: data.referred_user_id,
      referralCode: data.referral_code,
      status: data.status,
      commissionRate: Number(data.commission_rate),
      totalReward: Number(data.total_reward),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async getUserReferrals(referrerId: string): Promise<AffiliateReferral[]> {
    const { data, error } = await supabase
      .from("affiliate_referrals")
      .select("*")
      .eq("referrer_id", referrerId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: Number(d.id),
      referrerId: d.referrer_id,
      referredUserId: d.referred_user_id,
      referralCode: d.referral_code,
      status: d.status,
      commissionRate: Number(d.commission_rate),
      totalReward: Number(d.total_reward),
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    }));
  },

  async addReward(referredUserId: string, rewardAmount: number): Promise<void> {
    const { data: ref } = await supabase
      .from("affiliate_referrals")
      .select("id, total_reward")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();

    if (ref) {
      const newTotal = Number(ref.total_reward || 0) + rewardAmount;
      await supabase
        .from("affiliate_referrals")
        .update({ total_reward: newTotal, updated_at: new Date().toISOString() })
        .eq("id", ref.id);
    }
  },
};

// -----------------------------------------------------------------------------
// Wallet Repository
// -----------------------------------------------------------------------------

export const walletRepository = {
  async getOrCreate(userId: string): Promise<Wallet> {
    const { data: existing } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return {
        id: Number(existing.id),
        userId: existing.user_id,
        balance: Number(existing.balance),
        pendingBalance: Number(existing.pending_balance),
        currency: existing.currency,
        isLocked: Boolean(existing.is_locked),
        createdAt: new Date(existing.created_at),
        updatedAt: new Date(existing.updated_at),
      };
    }

    const { data: created, error } = await supabase
      .from("wallets")
      .insert({ user_id: userId, balance: 0, pending_balance: 0, currency: "USD" })
      .select()
      .single();

    if (error) throw error;
    return {
      id: Number(created.id),
      userId: created.user_id,
      balance: Number(created.balance),
      pendingBalance: Number(created.pending_balance),
      currency: created.currency,
      isLocked: Boolean(created.is_locked),
      createdAt: new Date(created.created_at),
      updatedAt: new Date(created.updated_at),
    };
  },

  async addTransaction(data: {
    walletId: number;
    userId: string;
    type: "deposit" | "withdrawal" | "commission" | "payment" | "refund" | "adjustment";
    amount: number;
    fee?: number;
    description: string;
    referenceId?: string;
  }): Promise<WalletTransaction> {
    const { data: tx, error } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: data.walletId,
        user_id: data.userId,
        type: data.type,
        amount: data.amount,
        fee: data.fee ?? 0,
        status: "completed",
        description: data.description,
        reference_id: data.referenceId ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Adjust balance
    const delta = (data.type === "withdrawal" || data.type === "payment") ? -Math.abs(data.amount) : Math.abs(data.amount);
    const { data: w } = await supabase.from("wallets").select("balance").eq("id", data.walletId).single();
    if (w) {
      const updatedBalance = Number(w.balance || 0) + delta;
      await supabase.from("wallets").update({ balance: updatedBalance, updated_at: new Date().toISOString() }).eq("id", data.walletId);
    }

    return {
      id: Number(tx.id),
      walletId: Number(tx.wallet_id),
      userId: tx.user_id,
      type: tx.type,
      amount: Number(tx.amount),
      fee: Number(tx.fee),
      status: tx.status,
      description: tx.description,
      referenceId: tx.reference_id,
      createdAt: new Date(tx.created_at),
    };
  },

  async getTransactions(userId: string, limit = 50): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((t: any) => ({
      id: Number(t.id),
      walletId: Number(t.wallet_id),
      userId: t.user_id,
      type: t.type,
      amount: Number(t.amount),
      fee: Number(t.fee),
      status: t.status,
      description: t.description,
      referenceId: t.reference_id,
      createdAt: new Date(t.created_at),
    }));
  },
};

const mapPurchase = (row: any): Purchase => ({
  id: Number(row.id),
  userId: row.user_id,
  bpoId: row.bpo_id ?? null,
  packageId: row.package_id,
  packageName: row.package_name,
  paypalOrderId: row.paypal_order_id,
  paypalCaptureId: row.paypal_capture_id ?? null,
  amount: Number(row.amount),
  currency: row.currency,
  status: row.status,
  purchasedAt: row.purchased_at ? new Date(row.purchased_at) : null,
  createdAt: new Date(row.created_at),
  invoiceId: row.invoice_id ? Number(row.invoice_id) : undefined,
  invoiceNumber: row.invoice_number ?? undefined,
  receiptId: row.receipt_id ? Number(row.receipt_id) : undefined,
  receiptNumber: row.receipt_number ?? undefined,
});

export async function generateSequentialReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { count } = await supabase
      .from("invoice_receipts")
      .select("id", { count: "exact", head: true });

    const { data: latestThk } = await supabase
      .from("invoice_receipts")
      .select("receipt_number")
      .ilike("receipt_number", `THK-RCPT-${year}-%`)
      .order("receipt_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextVal = (count || 0) + 1;
    if (latestThk?.receipt_number) {
      const match = latestThk.receipt_number.match(/THK-RCPT-\d{4}-(\d+)/);
      if (match) {
        nextVal = Math.max(nextVal, parseInt(match[1], 10) + 1);
      }
    }
    return `THK-RCPT-${year}-${String(nextVal).padStart(6, "0")}`;
  } catch {
    const randReceipt = Math.floor(100000 + Math.random() * 900000);
    return `THK-RCPT-${year}-${randReceipt}`;
  }
}

const mapWithdrawal = (row: any): Withdrawal => ({
  id: Number(row.id), userId: row.user_id, amount: Number(row.amount), currency: row.currency,
  method: row.method, payoutDetailsId: Number(row.payout_details_id), status: row.status,
  rejectionReason: row.rejection_reason ?? null, reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
  createdAt: new Date(row.created_at),
});

export const purchaseRepository = {
  async createPending(data: { userId: string; bpoId?: string | null; packageId: string; packageName: string; orderId: string; amount: number; currency: string }) {
    const { data: row, error } = await supabase.from("purchases").insert({
      user_id: data.userId, bpo_id: data.bpoId ?? null, package_id: data.packageId, package_name: data.packageName,
      paypal_order_id: data.orderId, amount: data.amount, currency: data.currency, status: "PENDING",
    }).select().single();
    if (error) throw error;
    return mapPurchase(row);
  },

  async cancelPending(orderId: string, userId: string): Promise<Purchase | null> {
    const { data, error } = await supabase.from("purchases").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("paypal_order_id", orderId).eq("user_id", userId).eq("status", "PENDING").select().maybeSingle();
    if (error) throw error;
    return data ? mapPurchase(data) : this.getByOrderId(orderId);
  },

  async getByOrderId(orderId: string): Promise<Purchase | null> {
    const { data, error } = await supabase.from("purchases").select("*").eq("paypal_order_id", orderId).maybeSingle();
    if (error) throw error;
    return data ? mapPurchase(data) : null;
  },

  async markPaid(
    orderIdOrOpts: string | { purchaseId?: string; orderId?: string; paypalOrderId?: string; captureId?: string; [key: string]: any },
    captureIdArg?: string
  ): Promise<Purchase & { invoiceId?: number; invoiceNumber?: string }> {
    let orderId = typeof orderIdOrOpts === "string" ? orderIdOrOpts : (orderIdOrOpts.orderId || orderIdOrOpts.paypalOrderId || "");
    const captureId = typeof orderIdOrOpts === "string" ? captureIdArg! : (orderIdOrOpts.captureId || `CAP-${Date.now()}`);

    let purchaseRow: any = null;

    if (typeof orderIdOrOpts === "object" && orderIdOrOpts.purchaseId && !orderId) {
      const { data: pRow } = await supabase.from("purchases").select("*").eq("id", orderIdOrOpts.purchaseId).maybeSingle();
      if (pRow) {
        orderId = pRow.paypal_order_id || "";
        purchaseRow = pRow;
      }
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.split("T")[0];

    if (!purchaseRow) {
      let query = supabase.from("purchases").update({
        paypal_capture_id: captureId,
        status: "PAID",
        purchased_at: nowIso,
        updated_at: nowIso,
      });

      if (orderId) {
        query = query.eq("paypal_order_id", orderId);
      } else if (typeof orderIdOrOpts === "object" && orderIdOrOpts.purchaseId) {
        query = query.eq("id", orderIdOrOpts.purchaseId);
      }

      const { data, error } = await query.select().maybeSingle();
      if (error) throw error;
      purchaseRow = data;
    } else {
      const { data, error } = await supabase.from("purchases").update({
        paypal_capture_id: captureId,
        status: "PAID",
        purchased_at: nowIso,
        updated_at: nowIso,
      }).eq("id", purchaseRow.id).select().maybeSingle();
      if (error) throw error;
      if (data) purchaseRow = data;
    }

    if (!purchaseRow) {
      if (orderId) {
        const existing = await this.getByOrderId(orderId);
        if (!existing || !["PAID", "paid"].includes(existing.status)) throw new Error("Purchase could not be finalized");
        purchaseRow = {
          id: existing.id,
          user_id: existing.userId,
          bpo_id: existing.bpoId,
          package_id: existing.packageId,
          package_name: existing.packageName,
          paypal_order_id: existing.paypalOrderId,
          paypal_capture_id: existing.paypalCaptureId || captureId,
          amount: existing.amount,
          currency: existing.currency,
          status: existing.status,
          purchased_at: existing.purchasedAt ? existing.purchasedAt.toISOString() : nowIso,
          created_at: existing.createdAt.toISOString(),
        };
      } else {
        throw new Error("Purchase could not be finalized");
      }
    }

    // 1. Activate plan on user profile
    await supabase.from("profiles").update({
      selected_plan: purchaseRow.package_id,
      updated_at: nowIso,
    }).eq("id", purchaseRow.user_id);

    // 2. Authoritative Invoice Creation (public.invoices)
    let invoiceRecord: any = null;
    let receiptRecord: any = null;

    // Check if invoice already linked via payment or purchase
    const { data: existingPayment } = await supabase
      .from("invoice_payments")
      .select("id, invoice_id")
      .eq("gateway_order_id", orderId)
      .maybeSingle();

    if (existingPayment?.invoice_id) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", existingPayment.invoice_id)
        .maybeSingle();
      invoiceRecord = inv;

      if (inv) {
        const { data: rcpt } = await supabase
          .from("invoice_receipts")
          .select("*")
          .eq("invoice_id", inv.id)
          .maybeSingle();
        receiptRecord = rcpt;
      }
    }

    if (!invoiceRecord) {
      const amountDec = new Decimal(purchaseRow.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          client_id: purchaseRow.user_id,
          purchase_id: purchaseRow.id,
          invoice_date: today,
          due_date: today,
          currency: purchaseRow.currency || "USD",
          subtotal: amountDec,
          tax_rate: 0,
          tax_amount: 0,
          discount_amount: 0,
          total: amountDec,
          amount_paid: amountDec,
          status: "paid",
          sent_at: nowIso,
          paid_at: nowIso,
          notes: `Thinkatic Package Plan Purchase: ${purchaseRow.package_name}`,
          terms: "Full payment received via PayPal.",
        })
        .select()
        .single();

      if (invErr) {
        console.error("[Purchase] Error creating authoritative invoice:", invErr);
      } else {
        invoiceRecord = inv;

        // Link invoice_id back to purchases record if column exists
        try {
          await supabase.from("purchases").update({ invoice_id: inv.id }).eq("id", purchaseRow.id);
        } catch {}

        // Insert invoice line item
        await supabase.from("invoice_items").insert({
          invoice_id: inv.id,
          sort_order: 0,
          description: `${purchaseRow.package_name} Package`,
          quantity: 1,
          unit_price: amountDec,
          line_total: amountDec,
        });

        // Insert invoice payment record
        const { data: pmt } = await supabase
          .from("invoice_payments")
          .insert({
            invoice_id: inv.id,
            client_id: purchaseRow.user_id,
            amount: amountDec,
            currency: purchaseRow.currency || "USD",
            payment_method: "paypal",
            gateway: "paypal",
            gateway_order_id: orderId,
            gateway_capture_id: captureId,
            reference: orderId,
            status: "successful",
            paid_at: nowIso,
            notes: `PayPal capture ID: ${captureId}`,
          })
          .select()
          .single();

        // Insert receipt idempotently
        const { data: existingRcpt } = await supabase
          .from("invoice_receipts")
          .select("*")
          .eq("invoice_id", inv.id)
          .maybeSingle();

        if (existingRcpt) {
          receiptRecord = existingRcpt;
        } else {
          let receiptNumber = await generateSequentialReceiptNumber();
          for (let attempt = 0; attempt < 5; attempt++) {
            const { data: rcpt, error: rcptErr } = await supabase
              .from("invoice_receipts")
              .insert({
                receipt_number: receiptNumber,
                invoice_id: inv.id,
                payment_id: pmt?.id || null,
                client_id: purchaseRow.user_id,
                amount: amountDec,
                currency: purchaseRow.currency || "USD",
              })
              .select()
              .single();

            if (!rcptErr && rcpt) {
              receiptRecord = rcpt;
              break;
            }
            const nextSeq = Math.floor(Math.random() * 900000) + 100000;
            receiptNumber = `THK-RCPT-${new Date().getFullYear()}-${String(nextSeq).padStart(6, "0")}`;
          }
        }

        // Record Audit Log
        await supabase.from("audit_logs").insert({
          actor_user_id: purchaseRow.user_id,
          action: "plan_purchase_successful",
          entity_type: "invoice",
          entity_id: String(inv.id),
          metadata: {
            packageId: purchaseRow.package_id,
            packageName: purchaseRow.package_name,
            orderId,
            captureId,
            invoiceNumber: inv.invoice_number,
            receiptNumber: receiptRecord?.receipt_number,
            amount: amountDec,
          },
        });

        // Client Notification
        await supabase.from("notifications").insert({
          recipient_user_id: purchaseRow.user_id,
          type: "plan_activated",
          title: `Plan Activated: ${purchaseRow.package_name}`,
          body: `Your payment was verified. Invoice #${inv.invoice_number} is finalized and your receipt ${receiptRecord?.receipt_number || ""} is available.`,
          entity_type: "invoice",
          entity_id: String(inv.id),
        });

        // Admin Notifications
        const { data: admins } = await supabase.from("admin_users").select("id");
        if (admins && admins.length > 0) {
          await supabase.from("notifications").insert(
            admins.map((a: any) => ({
              recipient_admin_id: a.id,
              type: "plan_purchased",
              title: "New Client Plan Purchase",
              body: `Client completed purchase of ${purchaseRow.package_name} for $${amountDec.toLocaleString()} (Invoice #${inv.invoice_number})`,
              entity_type: "invoice",
              entity_id: String(inv.id),
            }))
          );
        }
      }
    } else if (!receiptRecord) {
      // If invoice existed but receipt was not created, generate it idempotently
      let receiptNumber = await generateSequentialReceiptNumber();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: rcpt, error: rcptErr } = await supabase
          .from("invoice_receipts")
          .insert({
            receipt_number: receiptNumber,
            invoice_id: invoiceRecord.id,
            payment_id: existingPayment?.id || null,
            client_id: purchaseRow.user_id,
            amount: new Decimal(purchaseRow.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
            currency: purchaseRow.currency || "USD",
          })
          .select()
          .single();

        if (!rcptErr && rcpt) {
          receiptRecord = rcpt;
          break;
        }
        const nextSeq = Math.floor(Math.random() * 900000) + 100000;
        receiptNumber = `THK-RCPT-${new Date().getFullYear()}-${String(nextSeq).padStart(6, "0")}`;
      }
    }

    const mapped = mapPurchase(purchaseRow);
    return {
      ...mapped,
      invoiceId: invoiceRecord?.id ?? undefined,
      invoiceNumber: invoiceRecord?.invoice_number ?? undefined,
      receiptId: receiptRecord?.id ?? undefined,
      receiptNumber: receiptRecord?.receipt_number ?? undefined,
    };
  },

  async getActivePlanForUser(userId: string): Promise<ActivePlanDetails> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_plan, is_active, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !profile.selected_plan || AI_EXCLUDED_PLANS.has(profile.selected_plan)) {
      return { hasActivePlan: false, plan: null, purchase: null, invoice: null };
    }

    // Only genuine PAID purchases grant active plan access
    const { data: purchaseRow } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["PAID", "paid"])
      .order("purchased_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!purchaseRow) {
      return { hasActivePlan: false, plan: null, purchase: null, invoice: null };
    }

    const plan = await plansRepository.getByServiceId(profile.selected_plan);
    if (!plan) {
      return { hasActivePlan: false, plan: null, purchase: null, invoice: null };
    }

    let invoiceInfo = null;
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, paid_at")
      .eq("client_id", userId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invoice) {
      invoiceInfo = {
        id: Number(invoice.id),
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        total: Number(invoice.total),
        amountPaid: Number(invoice.amount_paid),
        paidAt: invoice.paid_at,
      };
    }

    return {
      hasActivePlan: true,
      serviceId: plan.serviceId,
      serviceNumber: plan.serviceNumber,
      serviceName: plan.serviceName,
      packageName: plan.name,
      category: plan.category,
      billingInterval: plan.billingInterval,
      price: plan.price,
      priceDisplay: plan.priceDisplay,
      deliveryTimeline: plan.deliveryTimeline,
      supportDuration: plan.supportDuration,
      features: plan.features,
      paymentStatus: "ACTIVE",
      purchasedAt: purchaseRow.purchased_at ? new Date(purchaseRow.purchased_at) : new Date(purchaseRow.created_at),
      orderId: purchaseRow.paypal_order_id,
      captureId: purchaseRow.paypal_capture_id,
      invoice: invoiceInfo,
      plan,
      activePlan: {
        ...plan,
        tier: plan.tier || plan.name,
        invoiceNumber: invoiceInfo?.invoiceNumber,
      },
      purchase: mapPurchase(purchaseRow),
    };
  },

  async listForUser(userId: string): Promise<Purchase[]> {
    const { data, error } = await supabase.from("purchases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPurchase);
  },

  async hasPaidBpo(userId: string): Promise<boolean> {
    const { count, error } = await supabase.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "PAID").in("package_id", ["bpo-starter", "bpo-growth", "bpo-enterprise"]);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
};

export const withdrawalRepository = {
  async savePayoutDetail(data: { userId: string; method: "paypal" | "indian_bank"; encrypted: string; displayLabel: string }) {
    const { data: row, error } = await supabase.from("payout_details").upsert({
      user_id: data.userId, method: data.method, details_encrypted: data.encrypted, display_label: data.displayLabel, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,method" }).select("id,method,display_label,created_at").single();
    if (error) throw error;
    return { id: Number(row.id), method: row.method, displayLabel: row.display_label, createdAt: new Date(row.created_at) } as PayoutDetail;
  },

  async listPayoutDetails(userId: string): Promise<PayoutDetail[]> {
    const { data, error } = await supabase.from("payout_details").select("id,method,display_label,created_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({ id: Number(row.id), method: row.method, displayLabel: row.display_label, createdAt: new Date(row.created_at) }));
  },

  async getPayoutDetail(userId: string, id: number) {
    const { data, error } = await supabase.from("payout_details").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(userId: string, amount: number, currency: string, method: "paypal" | "indian_bank", payoutDetailsId: number): Promise<Withdrawal> {
    const wallet = await walletRepository.getOrCreate(userId);
    if (wallet.balance < amount) throw new Error("Insufficient wallet balance");
    const { count } = await supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "PENDING");
    if ((count ?? 0) > 0) throw new Error("A withdrawal is already pending");
    const { data, error } = await supabase.from("withdrawals").insert({ user_id: userId, amount, currency, method, payout_details_id: payoutDetailsId }).select().single();
    if (error) throw error;
    const { error: walletError } = await supabase.from("wallets").update({ balance: wallet.balance - amount, pending_balance: wallet.pendingBalance + amount, updated_at: new Date().toISOString() }).eq("id", wallet.id).eq("balance", wallet.balance);
    if (walletError) throw walletError;
    return mapWithdrawal(data);
  },

  async listForUser(userId: string): Promise<Withdrawal[]> {
    const { data, error } = await supabase.from("withdrawals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapWithdrawal);
  },

  async listAll(): Promise<Withdrawal[]> {
    const { data, error } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapWithdrawal);
  },

  async review(id: number, adminId: number, status: "APPROVED" | "REJECTED", rejectionReason?: string) {
    const { data: withdrawal, error } = await supabase.from("withdrawals").select("*").eq("id", id).eq("status", "PENDING").maybeSingle();
    if (error) throw error;
    if (!withdrawal) throw new Error("Withdrawal not found or already reviewed");
    const { error: updateError } = await supabase.from("withdrawals").update({ status, rejection_reason: status === "REJECTED" ? rejectionReason ?? "Rejected by admin" : null, reviewed_by: adminId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    const wallet = await walletRepository.getOrCreate(withdrawal.user_id);
    const nextPending = Math.max(0, wallet.pendingBalance - Number(withdrawal.amount));
    const nextBalance = status === "REJECTED" ? wallet.balance + Number(withdrawal.amount) : wallet.balance;
    await supabase.from("wallets").update({ balance: nextBalance, pending_balance: nextPending, updated_at: new Date().toISOString() }).eq("id", wallet.id);
    const reviewed = await supabase.from("withdrawals").select("*").eq("id", id).single();
    if (reviewed.error) throw reviewed.error;
    return mapWithdrawal(reviewed.data);
  },
};

// -----------------------------------------------------------------------------
// Retry Helper (Supabase compatible)
// -----------------------------------------------------------------------------

export async function withDbRetry<T>(operation: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delayMs = 150 * 2 ** (attempt - 1);
      console.warn(`${label} transient error; retrying in ${delayMs}ms`, { attempt });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`${label} failed after retries`);
}

// -----------------------------------------------------------------------------
// Bank Accounts Repository (Corporate Wire Transfer & Bank Details)
// -----------------------------------------------------------------------------

export interface BankAccountRow {
  id: string;
  currency: string;
  bank_name: string;
  bank_address: string;
  beneficiary: string;
  account_type: string | null;
  account_number_encrypted: string | null;
  account_number_masked: string;
  routing_aba: string | null;
  swift: string | null;
  sort_code: string | null;
  iban_encrypted: string | null;
  iban_masked: string | null;
  bic: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_available: boolean;
  notes: string | null;
  unavailable_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccountItem {
  id: string;
  currency: "USD" | "GBP" | "EUR" | "INR";
  bankName: string;
  bankAddress: string;
  beneficiary: string;
  accountType?: string;
  accountNumberEncrypted?: string | null;
  accountNumberMasked: string;
  routingAba?: string | null;
  swift?: string | null;
  sortCode?: string | null;
  ibanEncrypted?: string | null;
  ibanMasked?: string | null;
  bic?: string | null;
  isActive: boolean;
  isVerified: boolean;
  isAvailable: boolean;
  notes?: string | null;
  unavailableMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapBankAccountRow(row: any): BankAccountItem {
  return {
    id: row.id,
    currency: row.currency,
    bankName: row.bank_name,
    bankAddress: row.bank_address,
    beneficiary: row.beneficiary || "HEALWEAL LLC",
    accountType: row.account_type ?? undefined,
    accountNumberEncrypted: row.account_number_encrypted ?? null,
    accountNumberMasked: row.account_number_masked || "—",
    routingAba: row.routing_aba ?? undefined,
    swift: row.swift ?? undefined,
    sortCode: row.sort_code ?? undefined,
    ibanEncrypted: row.iban_encrypted ?? null,
    ibanMasked: row.iban_masked ?? undefined,
    bic: row.bic ?? undefined,
    isActive: Boolean(row.is_active),
    isVerified: Boolean(row.is_verified),
    isAvailable: Boolean(row.is_available),
    notes: row.notes ?? undefined,
    unavailableMessage: row.unavailable_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const bankAccountRepository = {
  async listAll(): Promise<BankAccountItem[]> {
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapBankAccountRow);
  },

  async getByCurrency(currency: string): Promise<BankAccountItem | null> {
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("currency", currency.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data ? mapBankAccountRow(data) : null;
  },

  async getById(id: string): Promise<BankAccountItem | null> {
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBankAccountRow(data) : null;
  },

  async update(id: string, updates: Partial<BankAccountItem>): Promise<BankAccountItem | null> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.isVerified !== undefined) payload.is_verified = updates.isVerified;
    if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.unavailableMessage !== undefined) payload.unavailable_message = updates.unavailableMessage;
    if (updates.bankName !== undefined) payload.bank_name = updates.bankName;
    if (updates.bankAddress !== undefined) payload.bank_address = updates.bankAddress;
    if (updates.accountType !== undefined) payload.account_type = updates.accountType;
    if (updates.routingAba !== undefined) payload.routing_aba = updates.routingAba;
    if (updates.swift !== undefined) payload.swift = updates.swift;
    if (updates.sortCode !== undefined) payload.sort_code = updates.sortCode;
    if (updates.bic !== undefined) payload.bic = updates.bic;
    if (updates.accountNumberMasked !== undefined) payload.account_number_masked = updates.accountNumberMasked;
    if (updates.accountNumberEncrypted !== undefined) payload.account_number_encrypted = updates.accountNumberEncrypted;
    if (updates.ibanMasked !== undefined) payload.iban_masked = updates.ibanMasked;
    if (updates.ibanEncrypted !== undefined) payload.iban_encrypted = updates.ibanEncrypted;

    const { data, error } = await supabase
      .from("bank_accounts")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapBankAccountRow(data) : null;
  },

  async upsert(account: BankAccountItem): Promise<BankAccountItem> {
    const payload = {
      id: account.id,
      currency: account.currency,
      bank_name: account.bankName,
      bank_address: account.bankAddress,
      beneficiary: "HEALWEAL LLC",
      account_type: account.accountType || "CHECKING",
      account_number_encrypted: account.accountNumberEncrypted || null,
      account_number_masked: account.accountNumberMasked,
      routing_aba: account.routingAba || null,
      swift: account.swift || null,
      sort_code: account.sortCode || null,
      iban_encrypted: account.ibanEncrypted || null,
      iban_masked: account.ibanMasked || null,
      bic: account.bic || null,
      is_active: account.isActive,
      is_verified: account.isVerified,
      is_available: account.isAvailable,
      notes: account.notes || null,
      unavailable_message: account.unavailableMessage || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("bank_accounts")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return mapBankAccountRow(data);
  }
};

export * from "./schema/index.js";

