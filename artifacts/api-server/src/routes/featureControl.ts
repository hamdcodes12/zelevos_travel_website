import { Router, type Request, type Response, type NextFunction } from "express";
import { supabase } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

export interface FeatureDefinition {
  key: string;
  name: string;
  category: "CORE PLATFORM" | "BPO OPERATIONS" | "FINANCE" | "GROWTH";
  description: string;
  icon: string;
  isCritical?: boolean;
  requiresConfig?: boolean;
  configStatus?: "ready" | "incomplete" | "configured" | "not_required";
  configDetails?: string;
  dependencies?: string[];
  endpointsGoverned: string[];
}

export interface EnrichedFeature extends FeatureDefinition {
  enabled: boolean;
  status: "ACTIVE" | "DISABLED" | "CONFIGURATION_REQUIRED" | "RESTRICTED";
  updated_at: string | null;
  updated_by: number | null;
  dependents: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE PLATFORM FEATURE CATALOG (All 37 Database Keys)
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_FEATURE_CATALOG: FeatureDefinition[] = [
  // ── CORE PLATFORM ──────────────────────────────────────────────────────────
  {
    key: "billing",
    name: "Billing & Invoicing",
    category: "CORE PLATFORM",
    description: "Controls client billing, invoices, payment receipts and enterprise subscription plans.",
    icon: "CreditCard",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/billing/*", "/api/invoices/*"],
  },
  {
    key: "tickets",
    name: "Support Tickets Desk",
    category: "CORE PLATFORM",
    description: "Controls enterprise support desk, ticket submission, status tracking and SLA escalations.",
    icon: "Ticket",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/tickets/*", "/api/admin/tickets/*"],
  },
  {
    key: "client_updates",
    name: "Client Updates Broadcast",
    category: "CORE PLATFORM",
    description: "Controls administrative broadcasts, operational updates and client announcement feeds.",
    icon: "AlertCircle",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/client-updates/*"],
  },
  {
    key: "documents",
    name: "Secure Documents Vault",
    category: "CORE PLATFORM",
    description: "Controls secure document storage, NDA exchange, and file vault capabilities.",
    icon: "FileText",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/documents/*"],
  },
  {
    key: "communication",
    name: "Project Chat & Messages",
    category: "CORE PLATFORM",
    description: "Controls project chat, real-time messaging and operational team communications.",
    icon: "MessageSquare",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/chat/*", "/api/conversations/*"],
  },
  {
    key: "meetings",
    name: "Executive Meetings Sync",
    category: "CORE PLATFORM",
    description: "Controls executive scheduling, project syncs and calendar integrations.",
    icon: "Calendar",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/meetings/*"],
  },
  {
    key: "kyc",
    name: "KYC Verification Engine",
    category: "CORE PLATFORM",
    description: "Controls client corporate verification, identity checks and compliance vetting.",
    icon: "ShieldCheck",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/kyc/*"],
  },
  {
    key: "projects",
    name: "Enterprise Projects",
    category: "CORE PLATFORM",
    description: "Controls core enterprise projects, delivery pipelines and milestone tracking.",
    icon: "FolderKanban",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/projects/*"],
  },

  // ── BPO OPERATIONS ─────────────────────────────────────────────────────────
  {
    key: "bpo_partner_portal",
    name: "BPO Partner Portal",
    category: "BPO OPERATIONS",
    description: "Controls BPO partner portal access and operational partner workspace.",
    icon: "Building2",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/*"],
  },
  {
    key: "bpo_partner_applications",
    name: "BPO Partner Applications",
    category: "BPO OPERATIONS",
    description: "Controls inbound BPO agency applications, screening and onboarding pipeline.",
    icon: "UserCheck",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/applications/*"],
  },
  {
    key: "bpo_partner_agreements",
    name: "BPO Master Agreements",
    category: "BPO OPERATIONS",
    description: "Controls legally binding Master Service Agreements, NDAs and electronic signatures.",
    icon: "FileCheck",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/agreements/*"],
  },
  {
    key: "bpo_centre_verification",
    name: "BPO Centre Verification",
    category: "BPO OPERATIONS",
    description: "Controls physical delivery centre verification, facility audits and certification badges.",
    icon: "Shield",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/centre-verification/*"],
  },
  {
    key: "bpo_certification_engine",
    name: "BPO Certification Engine",
    category: "BPO OPERATIONS",
    description: "Controls workforce skill assessment, agent certifications and compliance validation.",
    icon: "Award",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/certifications/*"],
  },
  {
    key: "bpo_capacity_marketplace",
    name: "BPO Capacity Marketplace",
    category: "BPO OPERATIONS",
    description: "Controls BPO delivery centre seat availability and capacity marketplace.",
    icon: "Layers",
    isCritical: false,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/capacity/*"],
  },
  {
    key: "bpo_capacity_matching",
    name: "BPO Capacity Matching",
    category: "BPO OPERATIONS",
    description: "Controls algorithmic matching between enterprise project demands and partner capacity.",
    icon: "Sparkles",
    dependencies: ["bpo_capacity_marketplace"],
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/capacity/match/*"],
  },
  {
    key: "bpo_adaptive_production",
    name: "BPO Adaptive Production",
    category: "BPO OPERATIONS",
    description: "Controls operational production tracking, agent shift logging and volume metrics.",
    icon: "BarChart3",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/production/*"],
  },
  {
    key: "bpo_ai_qa",
    name: "BPO AI QA System",
    category: "BPO OPERATIONS",
    description: "Controls automated quality evaluation, calibration scoring and QA analytics.",
    icon: "Cpu",
    dependencies: ["bpo_adaptive_production"],
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/qa/*"],
  },
  {
    key: "attendance",
    name: "Workforce Attendance",
    category: "BPO OPERATIONS",
    description: "Controls workforce attendance, shift scheduling and biometric clock-in verification.",
    icon: "Clock",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/user/attendance/*", "/api/partner/attendance/*"],
  },
  {
    key: "partner_attendance",
    name: "Partner Shift Attendance",
    category: "BPO OPERATIONS",
    description: "Controls partner-level attendance management and workforce shift oversight.",
    icon: "CalendarDays",
    dependencies: ["attendance"],
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/attendance/*"],
  },
  {
    key: "partner_productivity",
    name: "Partner Productivity Tracking",
    category: "BPO OPERATIONS",
    description: "Controls operational output tracking, agent activity metrics and SLA adherence.",
    icon: "TrendingUp",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/productivity/*"],
  },
  {
    key: "partner_quality",
    name: "Partner Quality Assurance",
    category: "BPO OPERATIONS",
    description: "Controls delivery quality evaluations, QA dispute handling and calibration scoring.",
    icon: "CheckCircle2",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/quality/*"],
  },
  {
    key: "partner_centres",
    name: "Partner Delivery Centres",
    category: "BPO OPERATIONS",
    description: "Controls multi-facility delivery centre registration, infrastructure and seat allocation.",
    icon: "Building",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/centres/*"],
  },
  {
    key: "partner_agents",
    name: "Partner Workforce Roster",
    category: "BPO OPERATIONS",
    description: "Controls BPO workforce roster, agent profiles, assignments and activation status.",
    icon: "Users",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/agents/*"],
  },
  {
    key: "partner_training",
    name: "Partner Training Programs",
    category: "BPO OPERATIONS",
    description: "Controls partner curriculum programs, onboarding tracks and agent training modules.",
    icon: "GraduationCap",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/training/*"],
  },
  {
    key: "partner_documents",
    name: "Partner Document Vault",
    category: "BPO OPERATIONS",
    description: "Controls partner-specific compliance files, facility leases and security certifications.",
    icon: "Files",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/documents/*"],
  },
  {
    key: "partner_meetings",
    name: "Partner Governance Meetings",
    category: "BPO OPERATIONS",
    description: "Controls governance meetings, operational reviews and partner syncs.",
    icon: "Video",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/meetings/*"],
  },
  {
    key: "partner_projects",
    name: "Partner Project Assignments",
    category: "BPO OPERATIONS",
    description: "Controls partner project assignments, project workspaces and deliverable tracking.",
    icon: "Briefcase",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/projects/*"],
  },
  {
    key: "partner_reports",
    name: "Partner Operations Reports",
    category: "BPO OPERATIONS",
    description: "Controls operations and performance reporting exports for delivery centres.",
    icon: "FileSpreadsheet",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/reports/*"],
  },
  {
    key: "bpo_project_marketplace",
    name: "BPO Project Bidding",
    category: "BPO OPERATIONS",
    description: "Controls enterprise project bidding and partner reservation marketplace.",
    icon: "Store",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/project-marketplace/*"],
  },
  {
    key: "bpo_client_portal",
    name: "BPO Client Transparency",
    category: "BPO OPERATIONS",
    description: "Controls client view of allocated BPO resources, productivity and operations.",
    icon: "Eye",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/client/bpo-transparency/*"],
  },
  {
    key: "bpo_integrations",
    name: "BPO Telephony & CRM Integrations",
    category: "BPO OPERATIONS",
    description: "Controls third-party telephony, CRM, and CCaaS platform integrations.",
    icon: "Cable",
    requiresConfig: true,
    configStatus: "incomplete",
    configDetails: "OAuth and webhook credentials required for Vicidial & Five9",
    endpointsGoverned: ["/api/bpo/integrations/*"],
  },

  // ── FINANCE ────────────────────────────────────────────────────────────────
  {
    key: "bank_payments",
    name: "Bank Wire & ACH Payments",
    category: "FINANCE",
    description: "Controls corporate bank account verification, wire transfers and ACH settlement workflows.",
    icon: "Landmark",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bank-accounts/*"],
  },
  {
    key: "bpo_phase6_billing",
    name: "BPO Automated Rate Billing",
    category: "FINANCE",
    description: "Controls partner rate cards, automated billable hours calculation and invoice generation.",
    icon: "Receipt",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/billing/*"],
  },
  {
    key: "partner_payouts",
    name: "Partner Automated Payouts",
    category: "FINANCE",
    description: "Controls automated partner disbursement schedules, settlement statements and tax records.",
    icon: "CircleDollarSign",
    isCritical: true,
    dependencies: ["bank_payments"],
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/partner/payouts/*"],
  },
  {
    key: "bpo_withdrawals",
    name: "BPO Earnings Withdrawals",
    category: "FINANCE",
    description: "Controls BPO earnings withdrawal requests, treasury approvals and payout processing.",
    icon: "ArrowUpRight",
    isCritical: true,
    dependencies: ["bank_payments"],
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/bpo/withdrawals/*"],
  },
  {
    key: "wallet",
    name: "Prepaid Escrow Wallets",
    category: "FINANCE",
    description: "Controls prepaid escrow balances, instant payouts and platform digital wallet operations.",
    icon: "Wallet",
    isCritical: true,
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/wallets/*"],
  },

  // ── GROWTH ─────────────────────────────────────────────────────────────────
  {
    key: "affiliate",
    name: "Affiliate & Partner Referral",
    category: "GROWTH",
    description: "Controls affiliate partner referrals, commission tracking and promotional attribution.",
    icon: "Users2",
    requiresConfig: false,
    configStatus: "ready",
    endpointsGoverned: ["/api/affiliates/*"],
  },
];

// Helper to check if a feature is enabled
export async function isFeatureEnabled(moduleKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("module_settings")
      .select("enabled")
      .eq("module_key", moduleKey)
      .maybeSingle();

    if (error) {
      logger.warn({ moduleKey, err: error.message }, "Error reading feature flag; defaulting to true");
      return true;
    }
    return data ? Boolean(data.enabled) : true;
  } catch (err: any) {
    logger.warn({ moduleKey, err: err.message }, "Exception reading feature flag; defaulting to true");
    return true;
  }
}

export function requireFeature(moduleKey: string) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const enabled = await isFeatureEnabled(moduleKey);
    if (!enabled) {
      const def = PLATFORM_FEATURE_CATALOG.find((f) => f.key === moduleKey);
      const name = def?.name || moduleKey.replace(/_/g, " ");
      res.status(403).json({
        success: false,
        code: "FEATURE_DISABLED",
        error: `The ${name} module is currently disabled by administrator.`,
        module_key: moduleKey,
      });
      return;
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

type AdminRequest = Request & { admin?: { id: number; username: string } };

// GET /api/admin/features - Authoritative list of all features with real Supabase state
router.get("/admin/features", requireAuth, async (_req: AdminRequest, res: Response) => {
  try {
    // 1. Fetch current module_settings from Supabase
    const { data: dbRows, error } = await supabase
      .from("module_settings")
      .select("module_key, enabled, updated_at, updated_by")
      .order("module_key");

    if (error) throw error;
    const dbMap = new Map((dbRows || []).map((row: any) => [row.module_key, row]));

    // 2. Build map of dependents
    const dependentsMap = new Map<string, string[]>();
    for (const feat of PLATFORM_FEATURE_CATALOG) {
      if (feat.dependencies) {
        for (const dep of feat.dependencies) {
          if (!dependentsMap.has(dep)) dependentsMap.set(dep, []);
          dependentsMap.get(dep)!.push(feat.name);
        }
      }
    }

    // 3. Enrich catalog items
    const features: EnrichedFeature[] = PLATFORM_FEATURE_CATALOG.map((def) => {
      const dbRow = dbMap.get(def.key);
      const enabled = dbRow ? Boolean(dbRow.enabled) : true;

      let status: "ACTIVE" | "DISABLED" | "CONFIGURATION_REQUIRED" | "RESTRICTED" = "ACTIVE";
      if (!enabled) {
        status = "DISABLED";
      } else if (def.requiresConfig && def.configStatus === "incomplete") {
        status = "CONFIGURATION_REQUIRED";
      }

      return {
        ...def,
        enabled,
        status,
        updated_at: dbRow?.updated_at || null,
        updated_by: dbRow?.updated_by || null,
        dependents: dependentsMap.get(def.key) || [],
      };
    });

    res.json(features);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch platform features");
    res.status(500).json({ error: "Failed to fetch platform features", details: error?.message });
  }
});

// GET /api/admin/features/summary - Dynamic KPI summary
router.get("/admin/features/summary", requireAuth, async (_req: AdminRequest, res: Response) => {
  try {
    const { data: dbRows, error } = await supabase
      .from("module_settings")
      .select("module_key, enabled");

    if (error) throw error;
    const dbMap = new Map((dbRows || []).map((row: any) => [row.module_key, Boolean(row.enabled)]));

    const totalFeatures = PLATFORM_FEATURE_CATALOG.length;
    let activeFeatures = 0;
    let disabledFeatures = 0;
    let requiresConfig = 0;

    const categoryCounts: Record<string, { total: number; active: number }> = {
      "CORE PLATFORM": { total: 0, active: 0 },
      "BPO OPERATIONS": { total: 0, active: 0 },
      "FINANCE": { total: 0, active: 0 },
      "GROWTH": { total: 0, active: 0 },
    };

    for (const feat of PLATFORM_FEATURE_CATALOG) {
      const isEnabled = dbMap.has(feat.key) ? dbMap.get(feat.key)! : true;
      if (isEnabled) activeFeatures++;
      else disabledFeatures++;

      if (feat.requiresConfig && feat.configStatus === "incomplete") {
        requiresConfig++;
      }

      if (categoryCounts[feat.category]) {
        categoryCounts[feat.category].total++;
        if (isEnabled) categoryCounts[feat.category].active++;
      }
    }

    const activePercent = Math.round((activeFeatures / totalFeatures) * 100);
    const disabledPercent = Math.round((disabledFeatures / totalFeatures) * 100);
    const configPercent = Math.round((requiresConfig / totalFeatures) * 100);

    res.json({
      totalFeatures,
      activeFeatures,
      disabledFeatures,
      requiresConfig,
      activePercent,
      disabledPercent,
      configPercent,
      categoryCounts,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch feature summary");
    res.status(500).json({ error: "Failed to fetch feature summary", details: error?.message });
  }
});

// PATCH /api/admin/features/:key - Toggle/Update a feature with dependency checks & audit log
router.patch("/admin/features/:key", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const key = String(req.params.key);
    const def = PLATFORM_FEATURE_CATALOG.find((f) => f.key === key);
    if (!def) {
      return res.status(404).json({ error: `Feature '${key}' not found in platform catalog.` });
    }

    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ error: "Field 'enabled' must be a boolean (true/false)." });
    }

    const targetEnabled = req.body.enabled;
    const adminId = req.admin?.id || 1;
    const adminUsername = req.admin?.username || "admin";
    const reason = req.body.reason ? String(req.body.reason) : targetEnabled ? "Admin enabled module" : "Admin disabled module";

    // 1. Fetch previous state from Supabase
    const { data: previousRow } = await supabase
      .from("module_settings")
      .select("enabled")
      .eq("module_key", key)
      .maybeSingle();

    const previousEnabled = previousRow ? Boolean(previousRow.enabled) : true;

    // 2. Dependency validation: If disabling, ensure no active dependent feature relies on this
    if (!targetEnabled) {
      // Find all features in catalog that depend on this key
      const dependentCatalogKeys = PLATFORM_FEATURE_CATALOG.filter((f) => f.dependencies?.includes(key)).map((f) => f.key);

      if (dependentCatalogKeys.length > 0) {
        const { data: activeDependentsRows } = await supabase
          .from("module_settings")
          .select("module_key, enabled")
          .in("module_key", dependentCatalogKeys)
          .eq("enabled", true);

        if (activeDependentsRows && activeDependentsRows.length > 0) {
          const dependentNames = activeDependentsRows.map((r: any) => {
            const dDef = PLATFORM_FEATURE_CATALOG.find((f) => f.key === r.module_key);
            return dDef ? dDef.name : r.module_key;
          });

          return res.status(400).json({
            error: `Cannot disable '${def.name}' because ${dependentNames.length} active feature(s) depend on it: ${dependentNames.join(", ")}. Please disable dependent features first.`,
            dependents: dependentNames,
          });
        }
      }
    }

    // 3. Persist authoritative update in Supabase module_settings
    const nowIso = new Date().toISOString();
    const { data: updatedData, error: updateError } = await supabase
      .from("module_settings")
      .upsert({
        module_key: key,
        enabled: targetEnabled,
        updated_by: adminId,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Record audit log entry in Supabase audit_logs
    try {
      await supabase.from("audit_logs").insert({
        actor_admin_id: adminId,
        action: "module_changed",
        entity_type: "module",
        entity_id: key,
        metadata: {
          feature_name: def.name,
          category: def.category,
          previous_state: previousEnabled ? "ON" : "OFF",
          new_state: targetEnabled ? "ON" : "OFF",
          enabled: targetEnabled,
          admin_username: adminUsername,
          reason,
          timestamp: nowIso,
        },
      });
    } catch (auditErr: any) {
      logger.warn({ auditErr: auditErr.message }, "Audit log write note");
    }

    logger.info({ key, enabled: targetEnabled, adminUsername }, "Feature flag updated");

    // 5. Return updated feature with full metadata
    return res.json({
      ...def,
      enabled: targetEnabled,
      status: targetEnabled ? (def.requiresConfig && def.configStatus === "incomplete" ? "CONFIGURATION_REQUIRED" : "ACTIVE") : "DISABLED",
      updated_at: nowIso,
      updated_by: adminId,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to update feature");
    return res.status(500).json({ error: "Failed to update feature", details: error?.message });
  }
});

// GET /api/admin/features/:key/history - Real audit trail for this feature from Supabase audit_logs
router.get("/admin/features/:key/history", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const key = String(req.params.key);
    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("id, actor_admin_id, action, created_at, metadata")
      .eq("entity_id", key)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const history = (logs || []).map((l: any) => ({
      id: l.id,
      timestamp: l.created_at,
      action: l.action,
      adminId: l.actor_admin_id,
      newState: l.metadata?.new_state || (l.metadata?.enabled ? "ON" : "OFF"),
      previousState: l.metadata?.previous_state || (l.metadata?.enabled ? "OFF" : "ON"),
      adminUsername: l.metadata?.admin_username || "Admin",
      reason: l.metadata?.reason || "State modification",
    }));

    res.json(history);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to load feature audit history");
    res.status(500).json({ error: "Failed to load feature history", details: error?.message });
  }
});

// GET /api/features/public-status - Public/Client/Partner capability check
router.get("/features/public-status", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("module_settings")
      .select("module_key, enabled");

    if (error) throw error;
    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[row.module_key] = Boolean(row.enabled);
    });
    res.json(map);
  } catch {
    res.json({});
  }
});

export default router;
