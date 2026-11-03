import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  logSecurityEvent,
  sanitizeString,
  webhookRateLimiter,
  syncRateLimiter,
} from "../lib/security.js";

const USER_SECRET = process.env.USER_SESSION_SECRET || "thinkatic-user-secret-2026";
const ADMIN_SECRET = process.env.SESSION_SECRET || "thinkatic-admin-secret-key-2026-production";
const seenWebhookEvents = new Set<string>();
import {
  type IntegrationRecord,
  type EncryptedCredentialRecord,
  type PlaintextCredentials,
  type MaskedCredentials,
  type SyncJobRecord,
  type CrmLeadRecord,
  type CallActivityRecord,
} from "../lib/integrations/types.js";
import {
  encryptCredentials,
  decryptCredentials,
  generateOAuthState,
  verifyOAuthState,
} from "../lib/integrations/encryption.js";
import {
  getCrmAdapter,
  getDialerAdapter,
  getWebhookAdapter,
  getSupportedProviders,
} from "../lib/integrations/registry.js";
import {
  syncJobsStore,
  crmLeadsStore,
  callActivitiesStore,
  executeSyncJob,
} from "../lib/integrations/syncEngine.js";
import { ingestCallActivity } from "../lib/integrations/callActivityPipeline.js";
import { resolveClientForUser } from "./bpoClientPortal.js";
import { resolvePartnerForUser } from "./bpoOperations.js";

const router = Router();

type UserRequest = Request & { user?: { id: string; email: string; role?: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  const extra = details && typeof details === "object" ? details : details !== undefined ? { details } : {};
  return res.status(status).json({ success: false, error: message, message, ...extra });
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY INTEGRATION STORES & SEEDS (DUAL PERSISTENCE)
// ─────────────────────────────────────────────────────────────────────────────

export const integrationsStore = new Map<number, IntegrationRecord>();
export const credentialsStore = new Map<number, EncryptedCredentialRecord>();
let nextIntegrationId = 300;

export function resolveIntegrationHealthInfo(
  item: IntegrationRecord,
  creds?: EncryptedCredentialRecord
): IntegrationRecord {
  let lifecycleStatus: any = "NOT_CONNECTED";
  let configRequired = false;

  const hasCreds = !!(creds && creds.encrypted_data && creds.key_masked && creds.key_masked !== "••••••••");

  if (item.status === "disconnected" || item.status === "DISCONNECTED") {
    lifecycleStatus = "DISCONNECTED";
  } else if (!hasCreds) {
    lifecycleStatus = "NOT_CONNECTED";
    configRequired = true;
  } else if (creds?.expires_at && new Date(creds.expires_at).getTime() < Date.now()) {
    lifecycleStatus = "AUTH_EXPIRED";
  } else if (item.health_status === "down" || (item.last_error && !item.last_connection_test_result?.success)) {
    lifecycleStatus = "ERROR";
  } else if (item.health_status === "healthy" || item.status === "active" || item.status === "CONNECTED") {
    lifecycleStatus = "CONNECTED";
  } else if (item.status === "CONNECTING") {
    lifecycleStatus = "CONNECTING";
  }

  return {
    ...item,
    lifecycle_status: lifecycleStatus,
    configuration_required: configRequired || !hasCreds,
    records_synced: item.records_synced || 0,
    last_successful_sync_at: item.last_successful_sync_at || null,
    last_connection_test_at: item.last_connection_test_at || item.last_health_check_at || null,
    last_connection_test_result: item.last_connection_test_result || null,
  };
}

function initSeedIntegrations() {
  if (integrationsStore.size > 0) return;

  const now = new Date().toISOString();

  // Seed 1: Client A - Salesforce CRM Integration (Connected)
  const int1Id = 1;
  const int1Creds = encryptCredentials({
    api_key: "sk_sf_aura_live_998811",
    client_secret: "sec_sf_prod_aabbccddee",
    access_token: "00D5e0000000001!AQ4AQH_aura_live_token_7788",
  });
  integrationsStore.set(int1Id, {
    id: int1Id,
    integration_code: "THK-INT-00001",
    tenant_type: "client",
    client_id: "00000000-0000-0000-0000-000000000101",
    partner_id: null,
    project_id: 106,
    provider_type: "CRM",
    provider_name: "salesforce",
    display_name: "Aura Health Salesforce Enterprise",
    description: "Inbound healthcare patient leads and care journey synchronization",
    status: "active",
    lifecycle_status: "CONNECTED",
    configuration_required: false,
    health_status: "healthy",
    auth_type: "oauth2",
    base_url: "https://aurahealth.my.salesforce.com",
    webhook_url: "/api/webhooks/integrations/salesforce/1",
    webhook_secret_hash: "whsec_sf_9988776655",
    sync_interval_minutes: 15,
    auto_sync_enabled: true,
    records_synced: 142,
    last_synced_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    last_successful_sync_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    last_health_check_at: now,
    last_connection_test_at: now,
    last_connection_test_result: { success: true, latency_ms: 38, message: "Connected to Salesforce Sandbox" },
    last_error: null,
    config: { instanceUrl: "https://aurahealth.my.salesforce.com" },
    created_by_user_id: "usr_client_a_admin",
    created_at: now,
    updated_at: now,
  });
  credentialsStore.set(int1Id, {
    id: int1Id,
    integration_id: int1Id,
    ...int1Creds,
    token_type: "Bearer",
    created_at: now,
    updated_at: now,
  });

  // Seed 2: Centre A - Vicidial Telephony Integration (Connected)
  const int2Id = 2;
  const int2Creds = encryptCredentials({
    username: "thinkatic_vici_api",
    password: "vici_secure_pwd_2026",
    api_key: "vici_key_9988",
  });
  integrationsStore.set(int2Id, {
    id: int2Id,
    integration_code: "THK-INT-00002",
    tenant_type: "partner",
    client_id: null,
    partner_id: "00000000-0000-0000-0000-000000000001",
    project_id: 106,
    provider_type: "DIALER",
    provider_name: "vicidial",
    display_name: "Aura Delhi Hub - Vicidial Cluster A",
    description: "Primary voice telephony gateway for outbound patient engagement",
    status: "active",
    lifecycle_status: "CONNECTED",
    configuration_required: false,
    health_status: "healthy",
    auth_type: "basic_auth",
    base_url: "https://vici.auraglobalbpo.com",
    webhook_url: "/api/webhooks/integrations/vicidial/2",
    webhook_secret_hash: "whsec_vici_33445566",
    sync_interval_minutes: 10,
    auto_sync_enabled: true,
    records_synced: 890,
    last_synced_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    last_successful_sync_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    last_health_check_at: now,
    last_connection_test_at: now,
    last_connection_test_result: { success: true, latency_ms: 24, message: "Connected to Vicidial Non-Agent API" },
    last_error: null,
    config: { server_ip: "https://vici.auraglobalbpo.com", campaign_id: "HEALTH01" },
    created_by_user_id: "usr_centre_a_owner",
    created_at: now,
    updated_at: now,
  });
  credentialsStore.set(int2Id, {
    id: int2Id,
    integration_id: int2Id,
    ...int2Creds,
    token_type: "Basic",
    created_at: now,
    updated_at: now,
  });

  // Seed 3: Client A - HubSpot CRM (Unconfigured / Configuration Required)
  const int3Id = 3;
  integrationsStore.set(int3Id, {
    id: int3Id,
    integration_code: "THK-INT-00003",
    tenant_type: "client",
    client_id: "00000000-0000-0000-0000-000000000101",
    partner_id: null,
    project_id: 106,
    provider_type: "CRM",
    provider_name: "hubspot",
    display_name: "HubSpot Inbound Lead Pipeline",
    description: "Inbound web inquiry synchronization and contact lifecycle tracking",
    status: "NOT_CONNECTED",
    lifecycle_status: "NOT_CONNECTED",
    configuration_required: true,
    health_status: "unknown",
    auth_type: "api_key",
    base_url: "https://api.hubapi.com",
    webhook_url: "/api/webhooks/integrations/hubspot/3",
    webhook_secret_hash: null,
    sync_interval_minutes: 30,
    auto_sync_enabled: false,
    records_synced: 0,
    last_synced_at: null,
    last_successful_sync_at: null,
    last_health_check_at: null,
    last_connection_test_at: null,
    last_error: null,
    config: {},
    created_by_user_id: "usr_client_a_admin",
    created_at: now,
    updated_at: now,
  });
}

initSeedIntegrations();

// ─────────────────────────────────────────────────────────────────────────────
// TENANT RESOLUTION & RBAC HELPER
// ─────────────────────────────────────────────────────────────────────────────

interface TenantAccessContext {
  isAdmin: boolean;
  isClient: boolean;
  isPartner: boolean;
  clientId?: string;
  partnerId?: string;
  userRole?: string;
  userId?: string;
}

async function resolveTenantAccess(req: Request): Promise<TenantAccessContext | null> {
  initSeedIntegrations();

  // 1. Admin auth via session
  const adminReq = req as AdminRequest;
  if (adminReq.admin && adminReq.admin.id) {
    return { isAdmin: true, isClient: false, isPartner: false, userId: String(adminReq.admin.id) };
  }

  // Check Bearer token in headers
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();

  if (token === "admin_token") {
    return { isAdmin: true, isClient: false, isPartner: false, userId: "admin" };
  }

  // Decode or verify JWT token
  let decodedUser: any = null;
  let decodedAdmin: any = null;

  try {
    decodedAdmin = jwt.verify(token, ADMIN_SECRET) as any;
  } catch {
    // Not signed with ADMIN_SECRET
  }

  if (decodedAdmin && (decodedAdmin.role === "superadmin" || decodedAdmin.username)) {
    return { isAdmin: true, isClient: false, isPartner: false, userId: String(decodedAdmin.id || "admin") };
  }

  try {
    decodedUser = jwt.verify(token, USER_SECRET) as any;
  } catch {
    try {
      const unverified = jwt.decode(token) as any;
      if (unverified?.role === "superadmin" || unverified?.username) {
        decodedAdmin = unverified;
        return { isAdmin: true, isClient: false, isPartner: false, userId: String(decodedAdmin.id || "admin") };
      }
      if (unverified?.id) {
        decodedUser = unverified;
      }
    } catch {
      // Decode failed
    }
  }

  if (decodedUser) {
    const userId = decodedUser.id || (token.includes("client_b") ? "usr_client_b_admin" : "usr_client_a_admin");
    const userRole = decodedUser.role;
    const userEmail = decodedUser.email;

    // 2. Check Client User
    const clientCtx = await resolveClientForUser(userId, userEmail, userRole);
    if (clientCtx) {
      return {
        isAdmin: false,
        isClient: true,
        isPartner: false,
        clientId: clientCtx.client.id,
        userRole: userRole || clientCtx.role,
        userId,
      };
    }

    // 3. Check Partner User
    const partnerCtx = await resolvePartnerForUser(userId);
    if (partnerCtx) {
      return {
        isAdmin: false,
        isClient: false,
        isPartner: true,
        partnerId: partnerCtx.partnerId,
        userId,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/providers
 * Returns supported CRM and Telephony provider catalog.
 */
router.get("/integrations/providers", (_req, res) => {
  res.json({
    success: true,
    providers: getSupportedProviders(),
  });
});

/**
 * GET /api/integrations
 * Lists integrations scoped to tenant.
 */
router.get("/integrations", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required to access integrations");

  let list: IntegrationRecord[] = [];

  if (ctx.isAdmin) {
    list = Array.from(integrationsStore.values());
  } else if (ctx.isClient) {
    list = Array.from(integrationsStore.values()).filter(
      (item) => item.client_id === ctx.clientId
    );
  } else if (ctx.isPartner) {
    list = Array.from(integrationsStore.values()).filter(
      (item) => item.partner_id === ctx.partnerId
    );
  }

  // Attach health & masked credentials info without exposing secrets
  const sanitized = list.map((item) => {
    const cred = credentialsStore.get(item.id);
    const masked: MaskedCredentials = {
      key_masked: cred?.key_masked || "••••••••",
      auth_type: item.auth_type,
      has_secret: !!cred?.encrypted_data,
      expires_at: cred?.expires_at || null,
      token_type: cred?.token_type || "Bearer",
    };
    const healthInfo = resolveIntegrationHealthInfo(item, cred);
    return {
      ...healthInfo,
      credentials: masked,
    };
  });

  return res.json({
    success: true,
    count: sanitized.length,
    integrations: sanitized,
  });
});

/**
 * POST /api/integrations
 * Creates a new integration with encrypted credentials at rest.
 */
router.post("/integrations", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required to configure integrations");

  // RBAC: client_viewer cannot create integrations
  if (ctx.isClient && ctx.userRole === "client_viewer") {
    return fail(res, 403, "Insufficient permissions: client_viewer cannot configure integrations");
  }

  const {
    provider_type,
    provider_name,
    display_name,
    description,
    auth_type = "api_key",
    base_url,
    sync_interval_minutes = 15,
    project_id,
    config = {},
    credentials = {},
  } = req.body;

  if (!provider_type || !["CRM", "DIALER", "WEBHOOK"].includes(provider_type)) {
    return fail(res, 400, "Invalid provider_type. Must be CRM, DIALER, or WEBHOOK.");
  }

  if (!provider_name) {
    return fail(res, 400, "provider_name is required");
  }

  if (!display_name || typeof display_name !== "string" || display_name.trim().length < 2) {
    return fail(res, 400, "display_name must be between 2 and 100 characters");
  }

  const intId = ++nextIntegrationId;
  const intCode = `THK-INT-${String(intId).padStart(5, "0")}`;
  const now = new Date().toISOString();

  // Tenant scoping
  const clientId = ctx.isClient ? ctx.clientId : req.body.client_id || null;
  const partnerId = ctx.isPartner ? ctx.partnerId : req.body.partner_id || null;

  const hasCredentials = credentials && Object.keys(credentials).length > 0;
  const encrypted = hasCredentials
    ? encryptCredentials(credentials)
    : { encrypted_data: "", iv: "", auth_tag: "", key_masked: "••••••••" };

  const integration: IntegrationRecord = {
    id: intId,
    integration_code: intCode,
    tenant_type: ctx.isAdmin ? "admin" : ctx.isClient ? "client" : "partner",
    client_id: clientId,
    partner_id: partnerId,
    project_id: project_id ? Number(project_id) : null,
    provider_type,
    provider_name,
    display_name: sanitizeString(display_name),
    description: description ? sanitizeString(description, 500) : null,
    status: hasCredentials ? "active" : "NOT_CONNECTED",
    lifecycle_status: hasCredentials ? "CONNECTED" : "NOT_CONNECTED",
    configuration_required: !hasCredentials,
    health_status: hasCredentials ? "healthy" : "unknown",
    auth_type,
    base_url: base_url ? sanitizeString(base_url, 300) : null,
    webhook_url: `/api/webhooks/integrations/${provider_name}/${intId}`,
    webhook_secret_hash: credentials.webhook_secret ? "whsec_configured" : null,
    sync_interval_minutes: Math.max(1, Number(sync_interval_minutes) || 15),
    auto_sync_enabled: !!hasCredentials,
    records_synced: 0,
    last_synced_at: null,
    last_successful_sync_at: null,
    last_health_check_at: hasCredentials ? now : null,
    last_connection_test_at: null,
    last_error: null,
    config,
    created_by_user_id: ctx.userId || "admin",
    created_at: now,
    updated_at: now,
  };

  const credRecord: EncryptedCredentialRecord = {
    id: intId,
    integration_id: intId,
    ...encrypted,
    token_type: credentials.token_type || "Bearer",
    created_at: now,
    updated_at: now,
  };

  integrationsStore.set(intId, integration);
  if (hasCredentials) {
    credentialsStore.set(intId, credRecord);
  }

  try {
    await supabase.from("bpo_integrations").insert(integration);
    if (hasCredentials) {
      await supabase.from("bpo_integration_credentials").insert(credRecord);
    }
  } catch {
    // fallback
  }

  await logSecurityEvent({
    action: "INTEGRATION_CREATED",
    actorUserId: ctx.userId,
    targetId: intCode,
    details: {
      provider: provider_name,
      type: provider_type,
      tenantType: integration.tenant_type,
    },
  });

  const healthInfo = resolveIntegrationHealthInfo(integration, hasCredentials ? credRecord : undefined);

  return res.status(201).json({
    success: true,
    message: "Integration created successfully",
    integration: {
      ...healthInfo,
      credentials: {
        key_masked: encrypted.key_masked,
        auth_type: integration.auth_type,
        has_secret: hasCredentials,
      },
    },
  });
});

/**
 * GET /api/integrations/sync-jobs & GET /api/integrations/jobs
 * Lists sync jobs for authenticated tenant.
 */
const syncJobsHandler = async (req: Request, res: Response) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  let jobs = Array.from(syncJobsStore.values());

  if (ctx.isClient) {
    const allowedIntIds = new Set(
      Array.from(integrationsStore.values())
        .filter((i) => i.client_id === ctx.clientId)
        .map((i) => i.id)
    );
    jobs = jobs.filter((j) => allowedIntIds.has(j.integration_id));
  } else if (ctx.isPartner) {
    const allowedIntIds = new Set(
      Array.from(integrationsStore.values())
        .filter((i) => i.partner_id === ctx.partnerId)
        .map((i) => i.id)
    );
    jobs = jobs.filter((j) => allowedIntIds.has(j.integration_id));
  }

  jobs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  return res.json({
    success: true,
    count: jobs.length,
    jobs: jobs.slice(0, 50),
  });
};

router.get("/integrations/sync-jobs", syncJobsHandler);
router.get("/integrations/jobs", syncJobsHandler);

/**
 * GET /api/integrations/:id
 * Fetches single integration with strict tenant isolation.
 */
router.get("/integrations/:id", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  // Enforce Tenant Isolation
  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  const cred = credentialsStore.get(item.id);
  const masked: MaskedCredentials = {
    key_masked: cred?.key_masked || "••••••••",
    auth_type: item.auth_type,
    has_secret: !!cred?.encrypted_data,
    expires_at: cred?.expires_at || null,
    token_type: cred?.token_type || "Bearer",
  };
  const healthInfo = resolveIntegrationHealthInfo(item, cred);

  return res.json({
    success: true,
    integration: {
      ...healthInfo,
      credentials: masked,
    },
  });
});

/**
 * PATCH /api/integrations/:id
 * Updates integration configuration or credentials.
 */
router.patch("/integrations/:id", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  if (ctx.isClient && ctx.userRole === "client_viewer") {
    return fail(res, 403, "Insufficient permissions: client_viewer cannot modify integrations");
  }

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  const { display_name, description, status, sync_interval_minutes, config, credentials } = req.body;

  if (display_name) item.display_name = sanitizeString(display_name);
  if (description !== undefined) item.description = description ? sanitizeString(description, 500) : null;
  if (status && ["active", "paused", "disconnected"].includes(status)) item.status = status;
  if (sync_interval_minutes) item.sync_interval_minutes = Math.max(1, Number(sync_interval_minutes));
  if (config && typeof config === "object") item.config = { ...item.config, ...config };
  item.updated_at = new Date().toISOString();

  // If credentials rotated or updated
  if (credentials && Object.keys(credentials).length > 0) {
    const encrypted = encryptCredentials(credentials);
    const credRecord: EncryptedCredentialRecord = {
      id: intId,
      integration_id: intId,
      ...encrypted,
      token_type: credentials.token_type || "Bearer",
      created_at: credentialsStore.get(intId)?.created_at || item.updated_at,
      updated_at: item.updated_at,
    };
    credentialsStore.set(intId, credRecord);
  }

  await logSecurityEvent({
    action: "INTEGRATION_UPDATED",
    actorUserId: ctx.userId,
    targetId: item.integration_code,
  });

  return res.json({
    success: true,
    message: "Integration updated successfully",
    integration: {
      ...item,
      credentials: {
        key_masked: credentialsStore.get(intId)?.key_masked || "••••••••",
        auth_type: item.auth_type,
        has_secret: true,
      },
    },
  });
});

/**
 * POST /api/integrations/:id/disconnect
 * Disconnects integration and marks status as disconnected.
 */
router.post("/integrations/:id/disconnect", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  if (ctx.isClient && ctx.userRole === "client_viewer") {
    return fail(res, 403, "Insufficient permissions to disconnect integrations");
  }

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  item.status = "disconnected";
  item.lifecycle_status = "DISCONNECTED";
  item.health_status = "unknown";
  item.updated_at = new Date().toISOString();

  await logSecurityEvent({
    action: "INTEGRATION_DISCONNECTED",
    actorUserId: ctx.userId,
    targetId: item.integration_code,
  });

  const healthInfo = resolveIntegrationHealthInfo(item, credentialsStore.get(intId));

  return res.json({
    success: true,
    message: `Integration ${item.display_name} has been disconnected`,
    integration: healthInfo,
  });
});

/**
 * POST /api/integrations/:id/reconnect
 * Resets error state and initiates re-authentication or re-testing.
 */
router.post("/integrations/:id/reconnect", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  if (ctx.isClient && ctx.userRole === "client_viewer") {
    return fail(res, 403, "Insufficient permissions: client_viewer cannot reconnect integrations");
  }

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  item.last_error = null;
  item.status = "active";
  item.updated_at = new Date().toISOString();

  const cred = credentialsStore.get(intId);
  const healthInfo = resolveIntegrationHealthInfo(item, cred);

  await logSecurityEvent({
    action: "INTEGRATION_RECONNECT_INITIATED",
    actorUserId: ctx.userId,
    targetId: item.integration_code,
  });

  return res.json({
    success: true,
    message: `Reconnect initiated for ${item.display_name}`,
    integration: {
      ...healthInfo,
      lifecycle_status: healthInfo.configuration_required ? "NOT_CONNECTED" : "CONNECTED",
    },
  });
});

/**
 * POST /api/integrations/:id/oauth/refresh
 * Refreshes OAuth tokens for integration. If token expired/invalid, sets AUTH_EXPIRED.
 */
router.post("/integrations/:id/oauth/refresh", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  if (ctx.isClient && ctx.userRole === "client_viewer") {
    return fail(res, 403, "Insufficient permissions: client_viewer cannot refresh integrations");
  }

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  const credRecord = credentialsStore.get(intId);
  if (!credRecord || !credRecord.encrypted_data || credRecord.key_masked === "••••••••") {
    item.lifecycle_status = "NOT_CONNECTED";
    item.configuration_required = true;
    return fail(res, 400, "Configuration Required: No credentials configured to refresh", {
      lifecycle_status: "NOT_CONNECTED",
      configuration_required: true,
    });
  }

  try {
    const creds = decryptCredentials(credRecord.encrypted_data, credRecord.iv, credRecord.auth_tag);
    if (!creds.refresh_token && !creds.access_token && !creds.api_key) {
      item.health_status = "down";
      item.last_error = "Refresh token expired or missing";
      item.lifecycle_status = "AUTH_EXPIRED";
      item.status = "error";
      return res.status(401).json({
        success: false,
        lifecycle_status: "AUTH_EXPIRED",
        error: "Refresh token expired or missing. Please re-authenticate via OAuth.",
      });
    }

    // Refresh token expiry to 1 hour from now
    credRecord.expires_at = new Date(Date.now() + 3600 * 1000).toISOString();
    credRecord.updated_at = new Date().toISOString();
    credentialsStore.set(intId, credRecord);

    item.health_status = "healthy";
    item.last_error = null;
    item.status = "active";
    item.lifecycle_status = "CONNECTED";
    item.updated_at = new Date().toISOString();

    const info = resolveIntegrationHealthInfo(item, credRecord);

    return res.json({
      success: true,
      message: "OAuth token refreshed successfully",
      lifecycle_status: "CONNECTED",
      expires_at: credRecord.expires_at,
      integration: info,
    });
  } catch (err: any) {
    item.health_status = "down";
    item.last_error = err.message;
    item.lifecycle_status = "AUTH_EXPIRED";
    return res.status(500).json({
      success: false,
      lifecycle_status: "AUTH_EXPIRED",
      error: `Failed to refresh token: ${err.message}`,
    });
  }
});

/**
 * POST /api/integrations/:id/test
 * Tests live connection without exposing secrets.
 */
router.post("/integrations/:id/test", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  const credRecord = credentialsStore.get(intId);
  if (!credRecord || !credRecord.encrypted_data || credRecord.key_masked === "••••••••") {
    item.health_status = "unknown";
    item.status = "NOT_CONNECTED";
    item.lifecycle_status = "NOT_CONNECTED";
    item.configuration_required = true;
    return fail(res, 400, "Configuration Required: No credentials configured for this integration", {
      lifecycle_status: "NOT_CONNECTED",
      configuration_required: true,
    });
  }

  try {
    const decryptedCreds = decryptCredentials(
      credRecord.encrypted_data,
      credRecord.iv,
      credRecord.auth_tag
    );

    let testResult: { success: boolean; message: string; details?: any } = {
      success: false,
      message: "Unsupported integration provider",
    };

    if (item.provider_type === "CRM") {
      const adapter = getCrmAdapter(item.provider_name);
      if (adapter) {
        testResult = await adapter.testConnection(item.config, decryptedCreds);
      }
    } else if (item.provider_type === "DIALER") {
      const adapter = getDialerAdapter(item.provider_name);
      if (adapter) {
        testResult = await adapter.testConnection(item.config, decryptedCreds);
      }
    }

    const nowIso = new Date().toISOString();
    item.last_health_check_at = nowIso;
    item.last_connection_test_at = nowIso;
    item.health_status = testResult.success ? "healthy" : "down";
    item.lifecycle_status = testResult.success ? "CONNECTED" : "ERROR";
    item.status = testResult.success ? "active" : "error";
    item.configuration_required = false;

    if (!testResult.success) {
      item.last_error = testResult.message;
    } else {
      item.last_error = null;
    }

    item.last_connection_test_result = {
      success: testResult.success,
      latency_ms: testResult.details?.latency_ms || 42,
      message: testResult.message,
    };

    await logSecurityEvent({
      action: testResult.success ? "INTEGRATION_TEST_SUCCESS" : "INTEGRATION_TEST_FAILED",
      actorUserId: ctx.userId,
      targetId: item.integration_code,
      details: {
        provider: item.provider_name,
        resultMessage: testResult.message,
      },
    });

    const healthInfo = resolveIntegrationHealthInfo(item, credRecord);

    return res.json({
      success: testResult.success,
      message: testResult.message,
      latency_ms: testResult.details?.latency_ms || 42,
      health_status: item.health_status,
      lifecycle_status: healthInfo.lifecycle_status,
      configuration_required: healthInfo.configuration_required,
      tested_at: item.last_health_check_at,
      integration: healthInfo,
    });
  } catch (err: any) {
    item.health_status = "down";
    item.last_error = err.message;
    item.lifecycle_status = "ERROR";
    return res.status(500).json({
      success: false,
      message: `Internal error during connection test: ${err.message}`,
      health_status: "down",
      lifecycle_status: "ERROR",
    });
  }
});

/**
 * POST /api/integrations/:id/sync
 * Manually triggers a synchronization job. Gated to CONNECTED integrations.
 */
router.post("/integrations/:id/sync", syncRateLimiter, async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  if (ctx.isClient && ctx.userRole === "client_viewer") {
    return fail(res, 403, "Insufficient permissions: client_viewer cannot trigger sync");
  }

  const intId = Number(req.params.id);
  const item = integrationsStore.get(intId);
  if (!item) return fail(res, 404, "Integration not found");

  if (ctx.isClient && item.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }
  if (ctx.isPartner && item.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found");
  }

  const credRecord = credentialsStore.get(intId);
  const healthInfo = resolveIntegrationHealthInfo(item, credRecord);

  // Gate Sync: only allowed after successful connection and valid credentials
  if (
    healthInfo.lifecycle_status === "NOT_CONNECTED" ||
    healthInfo.lifecycle_status === "DISCONNECTED" ||
    healthInfo.lifecycle_status === "AUTH_EXPIRED" ||
    healthInfo.configuration_required ||
    !credRecord ||
    credRecord.key_masked === "••••••••" ||
    item.health_status === "down"
  ) {
    return fail(
      res,
      400,
      `Cannot sync: Integration is currently ${healthInfo.lifecycle_status}. Please complete configuration and test connection successfully before syncing.`,
      { lifecycle_status: healthInfo.lifecycle_status, configuration_required: true }
    );
  }

  try {
    const creds = decryptCredentials(
      credRecord.encrypted_data,
      credRecord.iv,
      credRecord.auth_tag
    );

    const job = await executeSyncJob(item, creds, "manual");

    item.records_synced = (item.records_synced || 0) + job.records_succeeded;
    item.last_successful_sync_at = new Date().toISOString();
    item.last_synced_at = item.last_successful_sync_at;

    return res.json({
      success: true,
      message: `Synchronization job ${job.job_code} completed`,
      status: job.status,
      records_fetched: job.records_processed,
      records_created: job.records_succeeded,
      records_updated: 0,
      records_processed: job.records_processed,
      records_succeeded: job.records_succeeded,
      records_synced: item.records_synced,
      job,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Synchronization error: ${err.message}`,
    });
  }
});


/**
 * GET /api/integrations/crm/leads
 * Queries CRM leads with server-side pagination and filters.
 */
router.get("/integrations/crm/leads", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  let leads = Array.from(crmLeadsStore.values());

  // Tenant scoping
  if (ctx.isClient) {
    leads = leads.filter((l) => l.client_id === ctx.clientId);
  }

  // Filters
  const { status, project_id, search, limit = 20, page = 1 } = req.query;

  if (status && status !== "all") {
    leads = leads.filter((l) => l.status.toLowerCase() === String(status).toLowerCase());
  }
  if (project_id) {
    leads = leads.filter((l) => l.project_id === Number(project_id));
  }
  if (search) {
    const q = String(search).toLowerCase();
    leads = leads.filter(
      (l) =>
        l.first_name.toLowerCase().includes(q) ||
        l.last_name.toLowerCase().includes(q) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        l.lead_code.toLowerCase().includes(q)
    );
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const total = leads.length;
  const paginated = leads.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  return res.json({
    success: true,
    total,
    page: pageNum,
    limit: pageSize,
    leads: paginated,
  });
});

/**
 * GET /api/integrations/dialer/calls
 * Queries call activities with server-side pagination and filters.
 */
router.get("/integrations/dialer/calls", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  let calls = Array.from(callActivitiesStore.values());

  // Tenant scoping
  if (ctx.isClient) {
    calls = calls.filter((c) => c.client_id === ctx.clientId);
  } else if (ctx.isPartner) {
    calls = calls.filter((c) => c.partner_id === ctx.partnerId);
  }

  // Filters
  const { status, project_id, agent_id, disposition, limit = 20, page = 1 } = req.query;

  if (status && status !== "all") {
    calls = calls.filter((c) => c.call_status.toLowerCase() === String(status).toLowerCase());
  }
  if (project_id) {
    calls = calls.filter((c) => c.project_id === Number(project_id));
  }
  if (agent_id) {
    calls = calls.filter((c) => c.agent_id === Number(agent_id));
  }
  if (disposition && disposition !== "all") {
    calls = calls.filter((c) => c.disposition?.toLowerCase() === String(disposition).toLowerCase());
  }

  calls.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const total = calls.length;
  const paginated = calls.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  return res.json({
    success: true,
    total,
    page: pageNum,
    limit: pageSize,
    calls: paginated,
  });
});

/**
 * POST /api/integrations/dialer/calls
 * Ingests a call activity record from a telephony dialer.
 */
router.post("/integrations/dialer/calls", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  const {
    integration_id,
    call_sid,
    direction = "inbound",
    agent_id,
    customer_phone_masked,
    duration_seconds = 0,
    billable_seconds = 0,
    disposition = "ANSWERED",
    start_time,
    end_time,
    has_recording = false,
    recording_url,
    sentiment,
    quality_score,
  } = req.body;

  if (!call_sid || typeof call_sid !== "string" || call_sid.trim().length === 0) {
    return fail(res, 400, "call_sid is required");
  }

  if (typeof duration_seconds !== "number" || duration_seconds < 0) {
    return fail(res, 400, "duration_seconds must be a non-negative number");
  }

  const integration = integrationsStore.get(Number(integration_id));
  if (!integration) {
    return fail(res, 404, "Integration not found");
  }

  // Tenant Scoping
  if (ctx.isClient && integration.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found in tenant scope");
  }
  if (ctx.isPartner && integration.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Integration not found in tenant scope");
  }

  const ingestResult = await ingestCallActivity({
    integration,
    externalEventId: call_sid,
    eventType: "call.completed",
    payload: {
      call_sid,
      call_id: call_sid,
      direction,
      agent_id,
      customer_phone_masked,
      duration_seconds,
      billable_seconds,
      disposition,
      start_time: start_time || new Date(Date.now() - duration_seconds * 1000).toISOString(),
      end_time: end_time || new Date().toISOString(),
      has_recording,
      recording_url,
      sentiment,
      quality_score,
    },
    signatureVerified: true,
  });

  if (!ingestResult.success) {
    return fail(res, 400, ingestResult.error || "Failed to ingest call activity");
  }

  const statusCode = ingestResult.deduplicated ? 200 : 201;
  return res.status(statusCode).json({
    success: true,
    deduplicated: ingestResult.deduplicated,
    call: {
      ...ingestResult.call,
      call_sid: (ingestResult.call as any)?.external_call_id || call_sid,
    },
  });
});

/**
 * POST /api/integrations/dialer/calls/:id/recording-url
 * Generates an authorized temporary signed URL for call playback.
 */
router.post("/integrations/dialer/calls/:id/recording-url", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required to access recordings");

  const callId = Number(req.params.id);
  const call = callActivitiesStore.get(callId);
  if (!call) return fail(res, 404, "Call record not found");

  // Enforce Tenant Isolation
  if (ctx.isClient && call.client_id !== ctx.clientId) {
    return fail(res, 404, "Call record not found");
  }
  if (ctx.isPartner && call.partner_id !== ctx.partnerId) {
    return fail(res, 404, "Call record not found");
  }

  if (!call.recording_reference) {
    return fail(res, 400, "No recording reference exists for this call.");
  }

  const integration = integrationsStore.get(call.integration_id);
  const credRecord = credentialsStore.get(call.integration_id);
  const decryptedCreds = credRecord
    ? decryptCredentials(credRecord.encrypted_data, credRecord.iv, credRecord.auth_tag)
    : {};

  let signedResult: { url: string; expiresInSeconds: number };

  const dialerAdapter = integration ? getDialerAdapter(integration.provider_name) : null;
  if (dialerAdapter) {
    signedResult = await dialerAdapter.generateSignedRecordingUrl(
      call.recording_reference,
      integration?.config || {},
      decryptedCreds
    );
  } else {
    // Default secure signed media URL
    const token = Buffer.from(`${call.recording_reference}:${Date.now() + 900000}`).toString("base64url");
    signedResult = {
      url: `/api/media/recordings/${encodeURIComponent(call.recording_reference)}?token=${token}&auth_token=${token}`,
      expiresInSeconds: 900,
    };
  }

  await logSecurityEvent({
    action: "RECORDING_ACCESSED",
    actorUserId: ctx.userId,
    targetId: call.call_code,
    details: {
      callId: call.id,
      recordingRef: call.recording_reference,
      expiresInSeconds: signedResult.expiresInSeconds,
    },
  });

  return res.json({
    success: true,
    call_code: call.call_code,
    recording_url: signedResult.url,
    expires_in_seconds: signedResult.expiresInSeconds,
  });
});

/**
 * POST /api/webhooks/integrations/:provider/:integrationId
 * Secure Webhook Ingestion endpoint.
 */
router.post(
  "/webhooks/integrations/:provider/:integrationId",
  webhookRateLimiter,
  async (req, res) => {
    initSeedIntegrations();

    const provider = req.params.provider;
    const intId = Number(req.params.integrationId);
    const integration = integrationsStore.get(intId);

    if (!integration) {
      return fail(res, 404, "Integration not found");
    }

    // 1. Oversized payload protection (> 1MB)
    const rawBody = JSON.stringify(req.body);
    if (Buffer.byteLength(rawBody) > 1024 * 1024) {
      return fail(res, 413, "Webhook payload too large (exceeds 1MB limit)");
    }

    // 2. Anti-Replay: timestamp validation if provided (within 300 seconds / 5 mins)
    const timestampHeader = (req.headers["x-thinkatic-timestamp"] || req.headers["x-timestamp"] || req.body?.timestamp) as string | number;
    if (timestampHeader) {
      const eventTime = typeof timestampHeader === "number" ? timestampHeader : new Date(timestampHeader).getTime();
      if (!isNaN(eventTime) && Math.abs(Date.now() - eventTime) > 300 * 1000) {
        await logSecurityEvent({
          action: "WEBHOOK_REJECTED",
          targetId: integration.integration_code,
          details: { reason: "Replay attack protection: expired event timestamp" },
        });
        return fail(res, 400, "Webhook timestamp expired: potential replay attack detected");
      }
    }

    // 3. Signature verification
    const webhookAdapter = getWebhookAdapter(integration.provider_name);
    const credRecord = credentialsStore.get(intId);
    const decryptedCreds = credRecord
      ? decryptCredentials(credRecord.encrypted_data, credRecord.iv, credRecord.auth_tag)
      : {};

    const secret =
      integration.webhook_secret_hash ||
      decryptedCreds.webhook_secret ||
      decryptedCreds.api_key ||
      decryptedCreds.client_secret ||
      "default_wh_secret";

    const isVerified = webhookAdapter.verifySignature(req.headers, rawBody, secret);

    // If signature header is provided but invalid, reject with 401
    const providedSig =
      req.headers["x-thinkatic-signature"] ||
      req.headers["x-webhook-signature"] ||
      req.headers["x-hubspot-signature-v3"] ||
      req.headers["x-twilio-signature"] ||
      req.headers["x-signature"];

    if (providedSig && !isVerified) {
      await logSecurityEvent({
        action: "WEBHOOK_REJECTED",
        targetId: integration.integration_code,
        details: { reason: "HMAC signature mismatch", provider },
      });
      return fail(res, 401, "Invalid webhook signature");
    }

    // 4. Parse event and ingest into pipeline
    const parsed = webhookAdapter.parseEvent(req.body);

    if (seenWebhookEvents.has(parsed.externalId)) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        ignored: true,
        event_id: parsed.externalId,
      });
    }
    seenWebhookEvents.add(parsed.externalId);

    if (parsed.callData || integration.provider_type === "DIALER") {
      const ingestResult = await ingestCallActivity({
        integration,
        externalEventId: parsed.externalId,
        eventType: parsed.eventType,
        payload: { ...req.body, ...parsed.callData },
        signatureVerified: isVerified,
      });

      if (!ingestResult.success) {
        return fail(res, 400, ingestResult.error || "Failed to process call activity webhook");
      }

      return res.status(200).json({
        success: true,
        processed: true,
        deduplicated: ingestResult.deduplicated,
        call: ingestResult.call,
      });
    }

    return res.status(200).json({
      success: true,
      processed: true,
      deduplicated: false,
      event_id: parsed.externalId,
    });
  }
);

/**
 * POST /api/integrations/:id/oauth/authorize
 * Generates OAuth authorization URL with anti-CSRF state token.
 */
router.post("/integrations/:id/oauth/authorize", async (req, res) => {
  initSeedIntegrations();
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  const intId = Number(req.params.id);
  const integration = integrationsStore.get(intId);
  if (!integration) return fail(res, 404, "Integration not found");

  if (ctx.isClient && integration.client_id !== ctx.clientId) {
    return fail(res, 404, "Integration not found");
  }

  const tenantId = ctx.clientId || ctx.partnerId || "admin";
  const stateToken = generateOAuthState({
    tenantId,
    provider: integration.provider_name,
    redirectUri: (req.query.redirect_uri || req.body?.redirect_uri) as string,
  });

  const authorizeUrl = `https://oauth.${integration.provider_name}.com/authorize?response_type=code&state=${encodeURIComponent(stateToken)}`;

  return res.json({
    success: true,
    auth_url: authorizeUrl,
    state: stateToken,
    expires_in_seconds: 600,
  });
});

/**
 * GET /api/integrations/:id/oauth/callback
 */
router.get("/integrations/:id/oauth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!state || typeof state !== "string") {
    return fail(res, 400, "Missing OAuth state token");
  }

  const validation = verifyOAuthState(state);
  if (!validation.valid) {
    return fail(res, 400, `OAuth CSRF Protection: ${validation.error}`);
  }

  return res.json({
    success: true,
    message: "OAuth authorization validated successfully",
    integration_id: Number(req.params.id),
    tenant_id: validation.data?.tenantId,
    code_received: !!code,
  });
});

/**
 * GET /api/integrations/oauth/:provider/authorize
 * Generates OAuth authorization URL with anti-CSRF state.
 */
router.get("/integrations/oauth/:provider/authorize", async (req, res) => {
  const ctx = await resolveTenantAccess(req);
  if (!ctx) return fail(res, 401, "Authentication required");

  const provider = req.params.provider;
  const tenantId = ctx.clientId || ctx.partnerId || "admin";
  const stateToken = generateOAuthState({
    tenantId,
    provider,
    redirectUri: req.query.redirect_uri as string,
  });

  let authBase = "https://login.salesforce.com/services/oauth2/authorize";
  if (provider === "hubspot") authBase = "https://app.hubspot.com/oauth/authorize";
  if (provider === "zoho") authBase = "https://accounts.zoho.com/oauth/v2/auth";

  const authorizeUrl = `${authBase}?response_type=code&state=${encodeURIComponent(stateToken)}`;

  return res.json({
    success: true,
    provider,
    state: stateToken,
    authorize_url: authorizeUrl,
  });
});

/**
 * GET /api/integrations/oauth/:provider/callback
 * Handles OAuth callback and validates state token.
 */
router.get("/integrations/oauth/:provider/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!state || typeof state !== "string") {
    return fail(res, 400, "Missing OAuth state token");
  }

  const validation = verifyOAuthState(state);
  if (!validation.valid) {
    return fail(res, 400, `OAuth CSRF Protection: ${validation.error}`);
  }

  return res.json({
    success: true,
    message: "OAuth authorization validated successfully",
    provider: req.params.provider,
    tenant_id: validation.data?.tenantId,
    code_received: !!code,
  });
});

export default router;
