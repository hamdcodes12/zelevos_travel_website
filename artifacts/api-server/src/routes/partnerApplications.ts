import { Router, type Request, type Response, type NextFunction } from "express";
import { supabase } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  validateUploadedDocument,
  sanitizeString,
  logSecurityEvent,
  uploadRateLimiter,
} from "../lib/security.js";
import { getOnboardingProgress } from "../lib/onboardingProgressService.js";
import { invalidateAdminBpoCache } from "./admin.js";
import { invalidateUserPartnerCache } from "./bpoAgents.js";

const router = Router();

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ success: false, error: message, message, details });
}

// In-memory persistent fallback store for development/testing when remote tables are pending migrations
interface ApplicationRecord {
  id: number;
  application_number: string;
  applicant_user_id: string;
  partner_id?: string | null;
  status: string;
  current_stage: string;
  company_data: Record<string, any>;
  centre_data: Record<string, any>;
  infrastructure_data: Record<string, any>;
  process_experience: string[];
  verification_checks: Record<string, any>;
  missing_information: any[];
  rejection_reason?: string | null;
  centre_id?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationDoc {
  id: number;
  application_id: number;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  status: "pending" | "verified" | "rejected";
  reviewer_notes?: string | null;
  verified_at?: string | null;
  created_at: string;
}

interface ApplicationEvent {
  id: number;
  application_id: number;
  event_type?: string;
  from_status?: string | null;
  to_status: string;
  stage?: string | null;
  note?: string | null;
  notes?: string | null;
  actor_user_id?: string | null;
  actor_admin_id?: number | null;
  actor_name?: string | null;
  created_at: string;
}

// Memory cache seeded with sample / persisted data across server lifecycle
export const memoryStore = {
  applications: new Map<number, ApplicationRecord>(),
  documents: new Map<number, ApplicationDoc[]>(),
  events: new Map<number, ApplicationEvent[]>(),
  nextAppId: 1,
  nextDocId: 1,
  nextEventId: 1,
  nextCentreSeq: 1,
};

function generateAppNumber(id?: number): string {
  const stamp = String(Date.now()).slice(-5);
  const rand = Math.floor(100 + Math.random() * 900);
  return `THK-APP-${stamp}${rand}`;
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function maskPan(pan?: string | null): string {
  if (!pan || pan.length < 10) return pan || "";
  return `${pan.slice(0, 5)}****${pan.slice(9)}`;
}

export function validateAndNormalizePan(rawPan?: any): { valid: boolean; normalized?: string; error?: string } {
  if (rawPan === undefined || rawPan === null) {
    return { valid: true };
  }
  if (typeof rawPan !== "string") {
    return { valid: false, error: "PAN number must be a valid text string." };
  }
  const normalized = rawPan.trim().toUpperCase();
  if (normalized.length === 0) return { valid: true };
  if (!PAN_REGEX.test(normalized)) {
    return {
      valid: false,
      error: "Invalid PAN format. PAN must follow the standard 10-character Indian PAN format: 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).",
    };
  }
  return { valid: true, normalized };
}

export function validateAndNormalizeGst(
  rawGst?: any,
  gstApplicable?: boolean | string
): { valid: boolean; normalized?: string; error?: string } {
  const isApplicable = gstApplicable === true || gstApplicable === "true" || gstApplicable === "applicable";
  if (rawGst === undefined || rawGst === null) {
    if (isApplicable) {
      return { valid: false, error: "GSTIN is mandatory when GST is applicable." };
    }
    return { valid: true };
  }
  if (typeof rawGst !== "string") {
    return { valid: false, error: "GST number must be a valid text string." };
  }
  const normalized = rawGst.trim().toUpperCase();
  if (normalized.length === 0) {
    if (isApplicable) {
      return { valid: false, error: "GSTIN is required when GST is selected as applicable." };
    }
    return { valid: true };
  }
  if (!GST_REGEX.test(normalized)) {
    return {
      valid: false,
      error: "Invalid GSTIN format. GSTIN must be exactly 15 alphanumeric characters matching Indian GST structure (e.g. 07AAAAA0000A1Z5).",
    };
  }
  return { valid: true, normalized };
}

export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length > 150) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== "string") return false;
  const trimmed = phone.trim();
  if (trimmed.length < 7 || trimmed.length > 25) return false;
  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, "");
  return /^(\+)?[0-9]{7,15}$/.test(cleaned);
}

export function isValidUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string" || !url.trim()) return true;
  if (url.trim().length > 250) return false;
  try {
    const u = url.startsWith("http://") || url.startsWith("https://") ? url.trim() : `https://${url.trim()}`;
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

function generateCentreId(country: string = "IN", state: string = "PN", seq: number): string {
  const cCode = (country || "IN").slice(0, 2).toUpperCase();
  const sCode = (state || "PN").slice(0, 2).toUpperCase();
  return `THK-${cCode}-${sCode}-${String(seq).padStart(5, "0")}`;
}

function formatAppResponse(app: ApplicationRecord) {
  const cd = app.company_data || {};
  const ctd = app.centre_data || {};
  const infra = app.infrastructure_data || {};
  const bpoCentres = app.centre_id ? [{
    id: 1,
    centre_id: app.centre_id,
    name: ctd.centreName || ctd.centre_name || "Main Centre",
    capacity: ctd.totalSeats || ctd.seat_capacity || infra.workstations || 0,
    status: "active",
  }] : [];

  const rawPan = cd.panNumber || cd.pan_number || "";
  const rawGst = cd.gstNumber || cd.gst_number || "";

  return {
    ...app,
    company_name: cd.companyName || cd.company_name || "BPO Partner",
    entity_type: cd.legalEntity || cd.entity_type || "Private Limited",
    registration_number: cd.registrationNumber || cd.registration_number || "",
    year_established: cd.yearEstablished || cd.year_established || "",
    tax_id: rawGst || rawPan || cd.tax_id || "",
    pan_number_masked: maskPan(rawPan),
    pan_number: rawPan,
    gst_number: rawGst,
    gst_applicable: cd.gstApplicable ?? cd.gst_applicable ?? true,
    website: cd.website || "",
    contact_person_name: cd.ownerName || cd.contact_person_name || "",
    contact_email: cd.email || cd.contact_email || "",
    contact_phone: cd.phone || cd.contact_phone || "",
    address_line1: cd.address || cd.address_line1 || "",
    city: cd.city || "",
    state: cd.state || "",
    country: cd.country || "India",
    centre_name: ctd.centreName || ctd.centre_name || "Main Centre",
    seat_capacity: ctd.totalSeats || ctd.seat_capacity || infra.workstations || 0,
    shift_count: ctd.shiftCount || ctd.shift_count || 1,
    facility_type: ctd.facilityType || ctd.facility_type || "Commercial Leased",
    carpet_area_sqft: ctd.carpetAreaSqFt || ctd.carpet_area_sqft || 0,
    power_backup: infra.powerBackup || infra.power_backup || "UPS & DG Backup",
    primary_isp: infra.primaryIsp || infra.primary_isp || "",
    secondary_isp: infra.backupIsp || infra.secondary_isp || "",
    bandwidth_mbps: infra.bandwidthMbps || infra.bandwidth_mbps || 100,
    voice_seats: ctd.voiceSeats || ctd.voice_seats || 0,
    blended_seats: ctd.blendedSeats || ctd.blended_seats || 0,
    non_voice_seats: ctd.nonVoiceSeats || ctd.non_voice_seats || 0,
    dialer_platforms: infra.dialerPlatform ? [infra.dialerPlatform] : infra.dialer_platforms || ["Vicidial"],
    crm_platforms: infra.crmSoftware ? [infra.crmSoftware] : infra.crm_platforms || ["Custom CRM"],
    quality_monitoring: infra.qaTools || infra.quality_monitoring || "Standard QA Monitoring",
    recording_retention_days: infra.retentionDays || infra.recording_retention_days || 90,
    process_experience: app.process_experience || [],
    verification_checks: app.verification_checks || {},
    bpo_centres: bpoCentres,
  };
}

async function addTimelineEvent(
  appId: number,
  toStatus: string,
  fromStatus?: string | null,
  stage?: string | null,
  note?: string | null,
  actor?: { userId?: string; adminId?: number; name?: string },
  eventType?: string
) {
  const evtType = eventType || `application_${toStatus}`;
  const event: ApplicationEvent = {
    id: memoryStore.nextEventId++,
    application_id: appId,
    event_type: evtType,
    from_status: fromStatus ?? null,
    to_status: toStatus,
    stage: stage ?? null,
    note: note ?? null,
    notes: note ?? null,
    actor_user_id: actor?.userId ?? null,
    actor_admin_id: actor?.adminId ?? null,
    actor_name: actor?.name ?? (actor?.adminId ? `Admin #${actor.adminId}` : "Applicant"),
    created_at: new Date().toISOString(),
  };

  const list = memoryStore.events.get(appId) || [];
  list.push(event);
  memoryStore.events.set(appId, list);

  try {
    await supabase.from("bpo_application_events").insert({
      application_id: appId,
      event_type: evtType,
      from_status: fromStatus,
      to_status: toStatus,
      stage,
      note,
      actor_user_id: actor?.userId,
      actor_admin_id: actor?.adminId,
    });
  } catch (err) {
    // Graceful fallback to memory store
  }
}

async function createNotification(userId: string, type: string, title: string, body: string, entityId: string) {
  try {
    await supabase.from("notifications").insert({
      recipient_user_id: userId,
      type,
      title,
      body,
      entity_type: "partner_application",
      entity_id: entityId,
    });
  } catch {
    // Non-fatal
  }
}

export async function resolveApplicationRecord(appId: number): Promise<ApplicationRecord | null> {
  const fromMem = memoryStore.applications.get(appId);
  if (fromMem) return fromMem;

  try {
    const { data, error } = await supabase
      .from("bpo_partner_applications")
      .select("*")
      .eq("id", appId)
      .maybeSingle();

    if (!error && data) {
      const rec: ApplicationRecord = {
        id: Number(data.id),
        application_number: data.application_number || `THK-APP-${String(data.id).padStart(5, "0")}`,
        applicant_user_id: data.applicant_user_id,
        partner_id: data.partner_id || null,
        status: data.status || "draft",
        current_stage: data.current_stage || "submitted",
        company_data: data.company_data || {},
        centre_data: data.centre_data || {},
        infrastructure_data: data.infrastructure_data || {},
        process_experience: data.process_experience || [],
        verification_checks: data.verification_checks || {},
        missing_information: data.missing_information || [],
        rejection_reason: data.rejection_reason || null,
        centre_id: data.centre_id || null,
        submitted_at: data.submitted_at || null,
        reviewed_at: data.reviewed_at || null,
        reviewed_by: data.reviewed_by ? Number(data.reviewed_by) : null,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      };
      memoryStore.applications.set(rec.id, rec);
      return rec;
    }
  } catch {}

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLICANT HELPER & ROUTES (Guarded by requireUserAuth)
// ─────────────────────────────────────────────────────────────────────────────

export async function getApplicationForUser(userId: string): Promise<{
  application: any | null;
  documents: any[];
  events: any[];
}> {
  // Check database first
  try {
    const { data, error } = await supabase
      .from("bpo_partner_applications")
      .select("*")
      .eq("applicant_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const { data: docs } = await supabase
        .from("bpo_application_documents")
        .select("*")
        .eq("application_id", data.id);

      const { data: evts } = await supabase
        .from("bpo_application_events")
        .select("*")
        .eq("application_id", data.id)
        .order("created_at", { ascending: true });

      const combinedDocs = [...(docs || [])];
      const memDocs = memoryStore.documents.get(data.id) || [];
      if (combinedDocs.length === 0) {
        combinedDocs.push(...memDocs);
      } else {
        for (const m of memDocs) {
          const docType = (m as any).document_type || (m as any).documentType;
          const exists = combinedDocs.find((x: any) => (m.id && x.id === m.id) || (docType && x.document_type === docType));
          if (exists) {
            if ((m as any).status && (m as any).status !== "pending") exists.status = (m as any).status;
          } else {
            combinedDocs.push(m);
          }
        }
      }

      return {
        application: data,
        documents: combinedDocs,
        events: evts || [],
      };
    }

    // Auto-provision and link bpo_partner_applications row for existing BPO profiles that don't have one yet
    if (!error && !data) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, email, account_type, bpo_status, bpo_application_details")
        .eq("id", userId)
        .eq("account_type", "BPO")
        .maybeSingle();

      if (prof) {
        const { data: ver } = await supabase
          .from("bpo_centre_verification")
          .select("*")
          .eq("applicant_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const appDetails = (prof.bpo_application_details || {}) as Record<string, any>;
        const resolvedCompanyName = (appDetails.companyName && appDetails.companyName !== "None")
          ? appDetails.companyName
          : (ver?.office_name || prof.full_name || "Thinkatic BPO Partner");
        const resolvedPhone = ver?.contact_number || appDetails.phone || "";

        if (appDetails.companyName === "None" || !appDetails.companyName) {
          await supabase.from("profiles").update({
            bpo_application_details: {
              ...appDetails,
              companyName: resolvedCompanyName,
              phone: resolvedPhone,
            },
          }).eq("id", userId);
        }

        const appNumber = `THK-APP-${String(Date.now()).slice(-5)}`;
        const initialStatus = prof.bpo_status === "APPROVED" ? "approved" : "under_review";
        const newAppPayload: any = {
          applicant_user_id: userId,
          application_number: appNumber,
          status: initialStatus,
          current_stage: prof.bpo_status === "APPROVED" ? "centre_id_generated" : "under_review",
          company_data: {
            companyName: resolvedCompanyName,
            authorizedSignatory: prof.full_name,
            phone: resolvedPhone,
            email: prof.email,
          },
          centre_data: ver ? {
            centreName: ver.office_name,
            centreAddress: ver.address_line_1,
            city: ver.city,
            state: ver.state,
            postalCode: ver.postal_code,
            totalAreaSqFt: ver.total_area_sqft,
          } : {},
          infrastructure_data: {},
          verification_checks: {
            profile: { status: "COMPLETED", verifiedAt: new Date().toISOString() },
            office: ver ? { status: ver.status === "APPROVED" ? "VERIFIED" : "UNDER_REVIEW", submittedAt: ver.submitted_at } : { status: "PENDING" },
          },
        };

        const { data: createdApp, error: createErr } = await supabase
          .from("bpo_partner_applications")
          .insert(newAppPayload)
          .select()
          .maybeSingle();

        if (!createErr && createdApp) {
          if (ver && !ver.application_id) {
            await supabase.from("bpo_centre_verification").update({ application_id: createdApp.id }).eq("id", ver.id);
          }
          return {
            application: createdApp,
            documents: [],
            events: [],
          };
        }
      }
    }
  } catch {
    // fallback to memory
  }

  // Memory store fallback
  let found: ApplicationRecord | null = null;
  for (const app of memoryStore.applications.values()) {
    if (app.applicant_user_id === userId) {
      if (!found || new Date(app.created_at) > new Date(found.created_at)) {
        found = app;
      }
    }
  }

  if (found) {
    const docs = memoryStore.documents.get(found.id) || [];
    const evts = memoryStore.events.get(found.id) || [];
    const formatted = formatAppResponse(found);
    return {
      application: formatted,
      documents: docs,
      events: evts,
    };
  }

  return { application: null, documents: [], events: [] };
}

// GET /api/partner/applications/me - Get current user's active application
router.get("/partner/applications/me", requireUserAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;
  const result = await getApplicationForUser(userId);

  if (result.application) {
    return res.json({
      ...result.application,
      application: result.application,
      documents: result.documents,
      events: result.events,
      timeline: result.events,
    });
  }

  return res.json({ application: null, documents: [], events: [], timeline: [] });
});

// POST /api/partner/applications - Create or save draft application (Duplicate-Protected, debounced autosave endpoint)
router.post("/partner/applications", requireUserAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  // Check suspension status: suspended partners cannot create/modify onboarding applications
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_type, is_active, bpo_status, bpo_application_details")
    .eq("id", userId)
    .maybeSingle();

  if (profile && (profile.is_active === false || profile.bpo_application_details?.suspended === true) && profile.bpo_status !== "REJECTED") {
    return fail(res, 403, "Account is currently under administrative suspension. Onboarding edits are blocked.");
  }

  const b = req.body || {};
  const companyData = b.companyData || (b.company_name ? { companyName: sanitizeString(b.company_name, 200), ...b } : {});
  const centreData = b.centreData || (b.centre_name || b.seat_capacity ? { centreName: sanitizeString(b.centre_name, 200), totalSeats: b.seat_capacity, ...b } : {});
  const infrastructureData = b.infrastructureData || (b.primary_isp || b.bandwidth_mbps ? { primaryIsp: sanitizeString(b.primary_isp, 200), bandwidthMbps: b.bandwidth_mbps, ...b } : {});
  const processExperience = b.processExperience || b.process_experience || [];
  const isDraft = b.isDraft !== undefined ? b.isDraft : (b.status !== "submitted");

  // Validate company fields
  if (companyData) {
    if (companyData.companyName !== undefined && typeof companyData.companyName === "string") {
      companyData.companyName = sanitizeString(companyData.companyName, 200);
    }
    if (companyData.legalEntity !== undefined && typeof companyData.legalEntity === "string") {
      companyData.legalEntity = sanitizeString(companyData.legalEntity, 100);
    }
    if (companyData.ownerName !== undefined && typeof companyData.ownerName === "string") {
      companyData.ownerName = sanitizeString(companyData.ownerName, 150);
    }
    if (companyData.email !== undefined && companyData.email !== null && String(companyData.email).trim() !== "") {
      const emailStr = String(companyData.email).trim();
      if (!isValidEmail(emailStr)) {
        return res.status(400).json({ success: false, error: "Invalid business email format. Please provide a valid email address (e.g. contact@company.com)." });
      }
      companyData.email = emailStr;
    }
    if (companyData.phone !== undefined && companyData.phone !== null && String(companyData.phone).trim() !== "") {
      const phoneStr = String(companyData.phone).trim();
      if (!isValidPhone(phoneStr)) {
        return res.status(400).json({ success: false, error: "Invalid phone number format. Please provide a valid telephone or mobile number (7 to 15 digits)." });
      }
      companyData.phone = phoneStr;
    }
    if (companyData.website !== undefined && companyData.website !== null && String(companyData.website).trim() !== "") {
      const webStr = String(companyData.website).trim();
      if (!isValidUrl(webStr)) {
        return res.status(400).json({ success: false, error: "Invalid website format. Please provide a valid URL (e.g. https://www.company.com)." });
      }
      companyData.website = webStr;
    }
    if (companyData.address !== undefined && typeof companyData.address === "string") {
      companyData.address = sanitizeString(companyData.address, 300);
    }
    if (companyData.city !== undefined && typeof companyData.city === "string") {
      companyData.city = sanitizeString(companyData.city, 100);
    }
    if (companyData.state !== undefined && typeof companyData.state === "string") {
      companyData.state = sanitizeString(companyData.state, 100);
    }
    if (companyData.country !== undefined && typeof companyData.country === "string") {
      companyData.country = sanitizeString(companyData.country, 100);
    }
    if (companyData.registrationNumber !== undefined && typeof companyData.registrationNumber === "string") {
      companyData.registrationNumber = sanitizeString(companyData.registrationNumber, 100);
    }

    const rawPan = companyData.panNumber || companyData.pan_number || companyData.pan || companyData.tax_id;
    if (rawPan !== undefined && rawPan !== null && String(rawPan).trim() !== "") {
      const panCheck = validateAndNormalizePan(rawPan);
      if (!panCheck.valid) {
        return res.status(400).json({ success: false, error: panCheck.error });
      }
      companyData.panNumber = panCheck.normalized;
      companyData.pan_number = panCheck.normalized;
    }

    const rawGst = companyData.gstNumber || companyData.gst_number || companyData.gst;
    const gstApp = companyData.gstApplicable ?? companyData.gst_applicable;
    if (rawGst !== undefined || gstApp !== undefined) {
      const gstCheck = validateAndNormalizeGst(rawGst, gstApp);
      if (!gstCheck.valid) {
        return res.status(400).json({ success: false, error: gstCheck.error });
      }
      if (gstCheck.normalized) {
        companyData.gstNumber = gstCheck.normalized;
        companyData.gst_number = gstCheck.normalized;
      }
    }
  }

  // Validate centre fields
  if (centreData) {
    if (centreData.centreName !== undefined && typeof centreData.centreName === "string") {
      centreData.centreName = sanitizeString(centreData.centreName, 200);
    }
    if (centreData.centreAddress !== undefined && typeof centreData.centreAddress === "string") {
      centreData.centreAddress = sanitizeString(centreData.centreAddress, 300);
    }
    if (centreData.totalSeats !== undefined && centreData.totalSeats !== null && String(centreData.totalSeats).trim() !== "") {
      const seats = parseInt(String(centreData.totalSeats), 10);
      if (isNaN(seats) || seats < 0 || seats > 100000) {
        return res.status(400).json({ success: false, error: "Total seat capacity must be a positive number between 1 and 100,000." });
      }
    }
    if (centreData.city !== undefined && typeof centreData.city === "string") {
      centreData.city = sanitizeString(centreData.city, 100);
    }
    if (centreData.state !== undefined && typeof centreData.state === "string") {
      centreData.state = sanitizeString(centreData.state, 100);
    }
    if (centreData.postalCode !== undefined && typeof centreData.postalCode === "string") {
      centreData.postalCode = sanitizeString(centreData.postalCode, 20);
    }
  }

  // 1. Strictly enforce ONE valid active onboarding/application per user/identity
  const existingResult = await getApplicationForUser(userId);
  if (existingResult.application) {
    const existing = existingResult.application;
    const isTerminal = existing.status === "rejected";

    if (!isTerminal) {
      // If the existing application is in draft status, update it rather than creating a duplicate
      if (existing.status === "draft") {
        const now = new Date().toISOString();
        let targetMem = memoryStore.applications.get(existing.id);
        if (targetMem) {
          targetMem.company_data = { ...targetMem.company_data, ...companyData };
          targetMem.centre_data = { ...targetMem.centre_data, ...centreData };
          targetMem.infrastructure_data = { ...targetMem.infrastructure_data, ...infrastructureData };
          targetMem.process_experience = processExperience.length ? processExperience : targetMem.process_experience;
          if (!isDraft) {
            targetMem.status = "submitted";
            targetMem.current_stage = "documents";
            targetMem.submitted_at = now;
          }
          (targetMem as any).revision = ((targetMem as any).revision || 0) + 1;
          targetMem.updated_at = now;
          memoryStore.applications.set(existing.id, targetMem);
        }

        try {
          await supabase
            .from("bpo_partner_applications")
            .update({
              company_data: companyData,
              centre_data: centreData,
              infrastructure_data: infrastructureData,
              process_experience: processExperience,
              ...(isDraft ? {} : { status: "submitted", current_stage: "documents", submitted_at: now }),
              updated_at: now,
            })
            .eq("id", existing.id);
        } catch (dbErr: any) {
          logger.warn({ err: dbErr?.message }, "Notice updating draft application in Supabase");
        }

        // Authoritative sync to profiles, bpo_partners & bpo_centre_verification
        const updatedCompanyName = companyData.companyName || companyData.company_name;
        if (updatedCompanyName && typeof updatedCompanyName === "string" && updatedCompanyName.trim()) {
          try {
            const curDetails = (profile?.bpo_application_details || {}) as Record<string, any>;
            await Promise.all([
              supabase.from("profiles").update({
                bpo_application_details: {
                  ...curDetails,
                  companyName: updatedCompanyName.trim(),
                },
                updated_at: now,
              }).eq("id", userId),
              supabase.from("bpo_partners").update({ name: updatedCompanyName.trim(), updated_at: now }).eq("user_id", userId),
            ]);
          } catch {}
        }

        const updatedCentreName = centreData.centreName || centreData.centre_name;
        if (updatedCentreName || centreData.centreAddress) {
          try {
            await supabase
              .from("bpo_centre_verification")
              .update({
                office_name: updatedCentreName || undefined,
                address_line_1: centreData.centreAddress || undefined,
                city: centreData.city || undefined,
                state: centreData.state || undefined,
                postal_code: centreData.postalCode || undefined,
                updated_at: now,
              })
              .eq("applicant_user_id", userId);
          } catch {}
        }

        // Invalidate caches immediately
        invalidateAdminBpoCache(userId);
        invalidateUserPartnerCache(userId);

        let onboardingProgress: any = null;
        try {
          onboardingProgress = await getOnboardingProgress(userId, profile);
        } catch {}

        const formatted = formatAppResponse(targetMem || existing);
        return res.json({
          ...formatted,
          success: true,
          application: formatted,
          onboardingProgress,
          revision: (targetMem as any)?.revision || 1,
          message: isDraft ? "Draft application updated successfully" : "Application submitted successfully",
        });
      }

      // If the application is already active, submitted, under review, or approved:
      // Return HTTP 409 Conflict with the existing application record.
      return res.status(409).json({
        success: false,
        code: "APPLICATION_EXISTS",
        message: "You already have an active BPO application in progress.",
        application: existing,
      });
    }
  }

  const id = memoryStore.nextAppId++;
  const appNumber = generateAppNumber(id);
  const now = new Date().toISOString();

  const record: ApplicationRecord = {
    id,
    application_number: appNumber,
    applicant_user_id: userId,
    status: isDraft ? "draft" : "submitted",
    current_stage: isDraft ? "registration" : "documents",
    company_data: companyData,
    centre_data: centreData,
    infrastructure_data: infrastructureData,
    process_experience: processExperience,
    verification_checks: {},
    missing_information: [],
    submitted_at: isDraft ? null : now,
    created_at: now,
    updated_at: now,
  };

  memoryStore.applications.set(id, record);
  await addTimelineEvent(
    id,
    record.status,
    null,
    record.current_stage,
    isDraft ? "Application draft initialized" : "Application submitted for review",
    { userId }
  );

  // Try saving to Supabase
  try {
    const { data: dbData, error } = await supabase
      .from("bpo_partner_applications")
      .insert({
        application_number: appNumber,
        applicant_user_id: userId,
        status: record.status,
        current_stage: record.current_stage,
        company_data: companyData,
        centre_data: centreData,
        infrastructure_data: infrastructureData,
        process_experience: processExperience,
        submitted_at: record.submitted_at,
      })
      .select()
      .single();

    if (!error && dbData) {
      record.id = dbData.id;
      record.application_number = dbData.application_number;
      memoryStore.applications.delete(id);
      memoryStore.applications.set(dbData.id, record);
    } else if (error) {
      logger.warn({ error: error.message, code: error.code, appNumber }, "[PartnerApplications] Supabase insert note");
    }
  } catch (err) {
    logger.warn({ err }, "[PartnerApplications] Saved to memory store");
  }

  // Sync company name to profile & partner
  const initCompanyName = companyData.companyName || companyData.company_name;
  if (initCompanyName && typeof initCompanyName === "string" && initCompanyName.trim()) {
    try {
      const curDetails = (profile?.bpo_application_details || {}) as Record<string, any>;
      await Promise.all([
        supabase.from("profiles").update({
          bpo_application_details: {
            ...curDetails,
            companyName: initCompanyName.trim(),
          },
          updated_at: now,
        }).eq("id", userId),
        supabase.from("bpo_partners").update({ name: initCompanyName.trim(), updated_at: now }).eq("user_id", userId),
      ]);
    } catch {}
  }

  invalidateAdminBpoCache(userId);
  invalidateUserPartnerCache(userId);

  let onboardingProgress: any = null;
  try {
    onboardingProgress = await getOnboardingProgress(userId, profile);
  } catch {}

  const formatted = formatAppResponse(record);
  return res.status(201).json({
    ...formatted,
    success: true,
    application: formatted,
    onboardingProgress,
    message: isDraft ? "Draft saved successfully" : "Application submitted successfully",
  });
});

// GET /api/partner/applications/:id - Get application by ID (Tenant isolated)
router.get("/partner/applications/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;

  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");
  if (app.applicant_user_id !== userId) {
    await logSecurityEvent({
      action: "unauthorized_application_view_attempt",
      actorUserId: userId,
      targetId: String(appId),
      ip: req.ip,
      details: { attemptedApplicationOwner: app.applicant_user_id },
    });
    return fail(res, 403, "Access denied: You can only access your own application");
  }

  const docs = memoryStore.documents.get(appId) || [];
  const evts = memoryStore.events.get(appId) || [];
  const formatted = formatAppResponse(app);
  return res.json({ ...formatted, application: formatted, documents: docs, events: evts, timeline: evts });
});

// PATCH /api/partner/applications/:id - Save draft updates (Tenant isolated, debounced autosave endpoint)
router.patch("/partner/applications/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  const existing = await resolveApplicationRecord(appId);
  if (!existing) return fail(res, 404, "Application not found");
  if (existing.applicant_user_id !== userId) {
    await logSecurityEvent({
      action: "unauthorized_application_patch_attempt",
      actorUserId: userId,
      targetId: String(appId),
      ip: req.ip,
      details: { attemptedApplicationOwner: existing.applicant_user_id },
    });
    return fail(res, 403, "Access denied: You cannot modify another partner's application");
  }

  // Check suspension status: suspended partners cannot autosave/modify onboarding data
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_type, is_active, bpo_status, bpo_application_details")
    .eq("id", userId)
    .maybeSingle();

  if (profile && (profile.is_active === false || profile.bpo_application_details?.suspended === true) && profile.bpo_status !== "REJECTED") {
    return fail(res, 403, "Account is currently under administrative suspension. Onboarding edits are blocked.");
  }

  const b = req.body || {};

  // Concurrency & race condition safety:
  // If client provided a revision or lastKnownUpdatedAt, prevent older delayed request from overwriting newer saved state
  if (b.lastKnownUpdatedAt && existing.updated_at) {
    const clientTime = new Date(b.lastKnownUpdatedAt).getTime();
    const serverTime = new Date(existing.updated_at).getTime();
    if (clientTime < serverTime - 2000) {
      // Return 409 Conflict without overwriting newer data
      const formatted = formatAppResponse(existing);
      const prog = await getOnboardingProgress(userId, profile);
      return res.status(409).json({
        ...formatted,
        success: false,
        staleIgnored: true,
        error: "Conflict: Newer version already persisted",
        application: formatted,
        onboardingProgress: prog,
      });
    }
  }

  const companyData = b.companyData || (b.company_name ? { companyName: sanitizeString(b.company_name, 200), ...b } : undefined);

  if (companyData) {
    if (companyData.companyName !== undefined && typeof companyData.companyName === "string") {
      companyData.companyName = sanitizeString(companyData.companyName, 200);
    }
    if (companyData.legalEntity !== undefined && typeof companyData.legalEntity === "string") {
      companyData.legalEntity = sanitizeString(companyData.legalEntity, 100);
    }
    if (companyData.ownerName !== undefined && typeof companyData.ownerName === "string") {
      companyData.ownerName = sanitizeString(companyData.ownerName, 150);
    }
    if (companyData.email !== undefined && companyData.email !== null && String(companyData.email).trim() !== "") {
      const emailStr = String(companyData.email).trim();
      if (!isValidEmail(emailStr)) {
        return res.status(400).json({ success: false, error: "Invalid business email format. Please provide a valid email address (e.g. contact@company.com)." });
      }
      companyData.email = emailStr;
    }
    if (companyData.phone !== undefined && companyData.phone !== null && String(companyData.phone).trim() !== "") {
      const phoneStr = String(companyData.phone).trim();
      if (!isValidPhone(phoneStr)) {
        return res.status(400).json({ success: false, error: "Invalid phone number format. Please provide a valid telephone or mobile number (7 to 15 digits)." });
      }
      companyData.phone = phoneStr;
    }
    if (companyData.website !== undefined && companyData.website !== null && String(companyData.website).trim() !== "") {
      const webStr = String(companyData.website).trim();
      if (!isValidUrl(webStr)) {
        return res.status(400).json({ success: false, error: "Invalid website format. Please provide a valid URL (e.g. https://www.company.com)." });
      }
      companyData.website = webStr;
    }
    if (companyData.address !== undefined && typeof companyData.address === "string") {
      companyData.address = sanitizeString(companyData.address, 300);
    }
    if (companyData.city !== undefined && typeof companyData.city === "string") {
      companyData.city = sanitizeString(companyData.city, 100);
    }
    if (companyData.state !== undefined && typeof companyData.state === "string") {
      companyData.state = sanitizeString(companyData.state, 100);
    }
    if (companyData.country !== undefined && typeof companyData.country === "string") {
      companyData.country = sanitizeString(companyData.country, 100);
    }
    if (companyData.registrationNumber !== undefined && typeof companyData.registrationNumber === "string") {
      companyData.registrationNumber = sanitizeString(companyData.registrationNumber, 100);
    }

    const rawPan = companyData.panNumber || companyData.pan_number || companyData.pan || companyData.tax_id;
    if (rawPan !== undefined && rawPan !== null && String(rawPan).trim() !== "") {
      const panCheck = validateAndNormalizePan(rawPan);
      if (!panCheck.valid) {
        return res.status(400).json({ success: false, error: panCheck.error });
      }
      companyData.panNumber = panCheck.normalized;
      companyData.pan_number = panCheck.normalized;
    }

    const rawGst = companyData.gstNumber || companyData.gst_number || companyData.gst;
    const gstApp = companyData.gstApplicable ?? companyData.gst_applicable;
    if (rawGst !== undefined || gstApp !== undefined) {
      const gstCheck = validateAndNormalizeGst(rawGst, gstApp);
      if (!gstCheck.valid) {
        return res.status(400).json({ success: false, error: gstCheck.error });
      }
      if (gstCheck.normalized) {
        companyData.gstNumber = gstCheck.normalized;
        companyData.gst_number = gstCheck.normalized;
      }
    }
  }

  const centreData = b.centreData || (b.centre_name || b.seat_capacity ? { centreName: sanitizeString(b.centre_name, 200), totalSeats: b.seat_capacity, ...b } : undefined);
  if (centreData) {
    if (centreData.centreName !== undefined && typeof centreData.centreName === "string") {
      centreData.centreName = sanitizeString(centreData.centreName, 200);
    }
    if (centreData.centreAddress !== undefined && typeof centreData.centreAddress === "string") {
      centreData.centreAddress = sanitizeString(centreData.centreAddress, 300);
    }
    if (centreData.totalSeats !== undefined && centreData.totalSeats !== null && String(centreData.totalSeats).trim() !== "") {
      const seats = parseInt(String(centreData.totalSeats), 10);
      if (isNaN(seats) || seats < 0 || seats > 100000) {
        return res.status(400).json({ success: false, error: "Total seat capacity must be a positive number between 1 and 100,000." });
      }
    }
    if (centreData.city !== undefined && typeof centreData.city === "string") {
      centreData.city = sanitizeString(centreData.city, 100);
    }
    if (centreData.state !== undefined && typeof centreData.state === "string") {
      centreData.state = sanitizeString(centreData.state, 100);
    }
    if (centreData.postalCode !== undefined && typeof centreData.postalCode === "string") {
      centreData.postalCode = sanitizeString(centreData.postalCode, 20);
    }
  }

  const infrastructureData = b.infrastructureData || (b.primary_isp || b.bandwidth_mbps ? { primaryIsp: sanitizeString(b.primary_isp, 200), bandwidthMbps: b.bandwidth_mbps, ...b } : undefined);
  const processExperience = b.processExperience || b.process_experience;
  const currentStage = b.currentStage;

  const now = new Date().toISOString();
  if (companyData) existing.company_data = { ...existing.company_data, ...companyData };
  if (centreData) existing.centre_data = { ...existing.centre_data, ...centreData };
  if (infrastructureData) existing.infrastructure_data = { ...existing.infrastructure_data, ...infrastructureData };
  if (processExperience) existing.process_experience = processExperience;
  if (currentStage) existing.current_stage = currentStage;
  (existing as any).revision = ((existing as any).revision || 0) + 1;
  existing.updated_at = now;
  memoryStore.applications.set(appId, existing);

  // 1. Authoritative Persist to Supabase bpo_partner_applications
  try {
    await supabase
      .from("bpo_partner_applications")
      .update({
        company_data: existing.company_data,
        centre_data: existing.centre_data,
        infrastructure_data: existing.infrastructure_data,
        process_experience: existing.process_experience,
        updated_at: now,
      })
      .eq("id", appId);
  } catch (dbErr: any) {
    logger.warn({ err: dbErr?.message }, "Notice updating bpo_partner_applications in Supabase");
  }

  // 2. Authoritative Company Name Sync to profiles & bpo_partners
  const updatedCompanyName = existing.company_data?.companyName || existing.company_data?.company_name;
  if (updatedCompanyName && typeof updatedCompanyName === "string" && updatedCompanyName.trim()) {
    try {
      const curDetails = (profile?.bpo_application_details || {}) as Record<string, any>;
      await Promise.all([
        supabase.from("profiles").update({
          bpo_application_details: {
            ...curDetails,
            companyName: updatedCompanyName.trim(),
          },
          updated_at: now,
        }).eq("id", userId),
        supabase.from("bpo_partners").update({ name: updatedCompanyName.trim(), updated_at: now }).eq("user_id", userId),
      ]);
    } catch (syncErr: any) {
      logger.warn({ err: syncErr?.message }, "Notice syncing company name to profiles/bpo_partners");
    }
  }

  // 3. Authoritative Centre Sync to bpo_centre_verification
  const updatedCentreName = existing.centre_data?.centreName || existing.centre_data?.centre_name;
  if (updatedCentreName || existing.centre_data?.centreAddress) {
    try {
      await supabase
        .from("bpo_centre_verification")
        .update({
          office_name: updatedCentreName || undefined,
          address_line_1: existing.centre_data?.centreAddress || undefined,
          city: existing.centre_data?.city || undefined,
          state: existing.centre_data?.state || undefined,
          postal_code: existing.centre_data?.postalCode || undefined,
          total_area_sqft: existing.centre_data?.carpetAreaSqFt || existing.centre_data?.totalAreaSqft || undefined,
          number_of_floors: existing.centre_data?.numberOfFloors ? Number(existing.centre_data.numberOfFloors) : undefined,
          working_hours: existing.centre_data?.workingHours || undefined,
          operating_shift: existing.centre_data?.operatingShift || undefined,
          updated_at: now,
        })
        .eq("applicant_user_id", userId);
    } catch (verSyncErr: any) {
      logger.warn({ err: verSyncErr?.message }, "Notice syncing centre data to bpo_centre_verification");
    }
  }

  // 4. Invalidate Admin & Partner Caches immediately
  invalidateAdminBpoCache(userId);
  invalidateUserPartnerCache(userId);

  // 5. Authoritative Onboarding Progress Calculation
  let onboardingProgress: any = null;
  try {
    onboardingProgress = await getOnboardingProgress(userId, profile);
  } catch (progErr: any) {
    logger.warn({ err: progErr?.message }, "Notice calculating onboarding progress after patch");
  }

  const formatted = formatAppResponse(existing);
  return res.json({
    ...formatted,
    success: true,
    application: formatted,
    onboardingProgress,
    revision: (existing as any).revision,
    message: "Draft saved successfully",
  });
});

// POST /api/partner/applications/:id/submit - Final submission / Re-submission
router.post("/partner/applications/:id/submit", requireUserAuth, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");
  if (app.applicant_user_id !== userId) {
    await logSecurityEvent({
      action: "unauthorized_application_submit_attempt",
      actorUserId: userId,
      targetId: String(appId),
      ip: req.ip,
      details: { attemptedApplicationOwner: app.applicant_user_id },
    });
    return fail(res, 403, "Access denied: You cannot submit another partner's application");
  }

  const body = req.body || {};
  const company = {
    ...(app.company_data || {}),
    ...(body.companyData || {}),
  };
  const centre = {
    ...(app.centre_data || {}),
    ...(body.centreData || {}),
  };
  const infrastructure = {
    ...(app.infrastructure_data || {}),
    ...(body.infrastructureData || {}),
  };
  const processExperience = Array.isArray(body.processExperience) && body.processExperience.length > 0
    ? body.processExperience
    : (app.process_experience || []);

  let companyName = company.companyName || company.company_name;
  let email = company.email || company.contact_email;
  let ownerName = company.ownerName || company.contactPerson || company.authorizedSignatory;

  if (!body.companyData && (!companyName || companyName === "None" || !email || !ownerName)) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email, bpo_application_details")
        .eq("id", userId)
        .maybeSingle();

      const { data: agr } = await supabase
        .from("bpo_partner_agreements")
        .select("company_legal_name, authorized_signatory_name")
        .eq("application_id", appId)
        .maybeSingle();

      if (!companyName || companyName === "None") {
        companyName = agr?.company_legal_name || prof?.bpo_application_details?.companyName;
        if (companyName && companyName !== "None") {
          company.companyName = companyName;
        }
      }
      if (!email) {
        email = prof?.email || prof?.bpo_application_details?.email;
        if (email) {
          company.email = email;
        }
      }
      if (!ownerName) {
        ownerName = agr?.authorized_signatory_name || prof?.full_name || prof?.bpo_application_details?.ownerName;
        if (ownerName) {
          company.ownerName = ownerName;
        }
      }
    } catch {}
  }

  const missingFields: string[] = [];
  if (!companyName || companyName === "None") missingFields.push("Company Name");
  if (!email) missingFields.push("Business Email");
  if (!ownerName) missingFields.push("Authorized Contact Person / Owner Name");

  if (missingFields.length > 0) {
    return fail(res, 400, `Please complete all mandatory Company Information fields before submission: ${missingFields.join(", ")}`, { missingFields });
  }

  // Validate PAN if supplied in company data (otherwise verified via uploaded pan_card document)
  const rawPan = company.panNumber || company.pan_number || company.pan;
  if (rawPan) {
    const panCheck = validateAndNormalizePan(rawPan);
    if (!panCheck.valid) {
      return fail(res, 400, panCheck.error!);
    }
    company.panNumber = panCheck.normalized;
    company.pan_number = panCheck.normalized;
  }

  // Validate GST if supplied in company data (otherwise verified via uploaded gst_certificate document)
  const gstApp = company.gstApplicable ?? company.gst_applicable;
  const rawGst = company.gstNumber || company.gst_number || company.gst;
  if (rawGst) {
    const gstCheck = validateAndNormalizeGst(rawGst, gstApp);
    if (!gstCheck.valid) {
      return fail(res, 400, gstCheck.error!);
    }
    if (gstCheck.normalized) {
      company.gstNumber = gstCheck.normalized;
      company.gst_number = gstCheck.normalized;
    }
  }

  const prevStatus = app.status;
  const isResubmission = prevStatus === "documents_required" || prevStatus === "action_required" || prevStatus === "under_review";
  const newStatus = "under_review";
  const newStage = "documents";
  const now = new Date().toISOString();

  app.status = newStatus;
  app.current_stage = newStage;
  app.submitted_at = app.submitted_at || now;
  app.updated_at = now;
  app.company_data = company;
  app.centre_data = centre;
  app.infrastructure_data = infrastructure;
  app.process_experience = processExperience;
  app.missing_information = []; // Clear missing items on re-submission

  memoryStore.applications.set(appId, app);

  await addTimelineEvent(
    appId,
    newStatus,
    prevStatus,
    newStage,
    isResubmission ? "Application updated with requested info and re-submitted" : "Formal application submitted for admin review",
    { userId },
    isResubmission ? "application_resubmitted" : "application_submitted"
  );

  try {
    await supabase
      .from("bpo_partner_applications")
      .update({
        status: newStatus,
        current_stage: newStage,
        company_data: company,
        centre_data: centre,
        infrastructure_data: infrastructure,
        process_experience: processExperience,
        submitted_at: app.submitted_at,
        missing_information: [],
        updated_at: now,
      })
      .eq("id", appId)
      .eq("applicant_user_id", userId);

    const { data: curProf } = await supabase
      .from("profiles")
      .select("bpo_application_details")
      .eq("id", userId)
      .maybeSingle();

    await supabase
      .from("profiles")
      .update({
        bpo_status: "PENDING",
        bpo_application_details: {
          ...(curProf?.bpo_application_details || {}),
          status: "under_review",
          companyName: companyName,
          submittedAt: now,
        },
      })
      .eq("id", userId);
  } catch (err: any) {
    logger.warn({ error: err.message }, "Error during submit db updates");
  }

  invalidateAdminBpoCache(userId);

  // In-app notifications
  await createNotification(
    userId,
    "application_submitted",
    "Application Submitted",
    `Your BPO application ${app.application_number} is now under review by Thinkatic operations.`,
    String(appId)
  );

  const formatted = formatAppResponse(app);
  return res.json({
    ...formatted,
    status: newStatus,
    success: true,
    application: formatted,
    message: isResubmission ? "Application re-submitted successfully" : "Application submitted successfully",
  });
});

// POST /api/partner/applications/:id/documents - Secure document upload with validation
router.post("/partner/applications/:id/documents", requireUserAuth, uploadRateLimiter, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");
  if (app.applicant_user_id !== userId) {
    await logSecurityEvent({
      action: "unauthorized_document_upload_attempt",
      actorUserId: userId,
      targetId: String(appId),
      ip: req.ip,
      details: { attemptedApplicationOwner: app.applicant_user_id },
    });
    return fail(res, 403, "Access denied: You can only upload documents to your own application");
  }

  const documentType = req.body?.documentType || req.body?.document_type;
  const rawFileName = req.body?.fileName || req.body?.original_file_name || req.body?.file_name;
  const fileData = req.body?.fileData || req.body?.file_url || req.body?.fileDataUrl;
  const mimeType = req.body?.mime_type || req.body?.mimeType;
  const fileSizeBytes = req.body?.file_size_bytes || req.body?.fileSizeBytes;

  if (!documentType || !rawFileName) return fail(res, 400, "Document type and filename are required");

  // Validate document security (MIME type, extension, size, path traversal)
  const validation = validateUploadedDocument(rawFileName, mimeType, fileSizeBytes, fileData);
  if (!validation.valid) {
    await logSecurityEvent({
      action: "invalid_document_upload_rejected",
      actorUserId: userId,
      targetId: String(appId),
      ip: req.ip,
      details: { fileName: rawFileName, error: validation.error },
    });
    return fail(res, 400, validation.error || "Invalid file upload");
  }

  const fileName = validation.sanitizedFileName || rawFileName;
  const now = new Date().toISOString();
  const docId = memoryStore.nextDocId++;
  const docUrl = fileData ? (fileData.startsWith("data:") ? fileData : `/uploads/documents/${appId}-${docId}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`) : "";

  const newDoc: ApplicationDoc = {
    id: docId,
    application_id: appId,
    document_type: documentType,
    file_name: fileName,
    file_url: docUrl,
    file_size: fileSizeBytes,
    status: "pending",
    created_at: now,
  };

  const list = memoryStore.documents.get(appId) || [];
  const idx = list.findIndex((d) => d.document_type === documentType);
  if (idx >= 0) {
    list[idx] = newDoc;
  } else {
    list.push(newDoc);
  }
  memoryStore.documents.set(appId, list);

  await addTimelineEvent(
    appId,
    app?.status || "under_review",
    null,
    "documents",
    `Document uploaded: ${documentType.replace(/_/g, " ")} (${fileName})`,
    { userId }
  );

  try {
    await supabase.from("bpo_application_documents").insert({
      application_id: appId,
      document_type: documentType,
      file_name: fileName,
      file_url: docUrl,
      file_size_bytes: fileSizeBytes,
      status: "pending",
    });
  } catch {}

  return res.status(200).json({
    success: true,
    document: newDoc,
    message: "Document uploaded successfully",
  });
});

// GET /api/partner/applications/:id/timeline - Get application timeline events
router.get("/partner/applications/:id/timeline", requireUserAuth, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");
  if (app.applicant_user_id !== userId) {
    await logSecurityEvent({
      action: "unauthorized_timeline_view_attempt",
      actorUserId: userId,
      targetId: String(appId),
      ip: req.ip,
      details: { attemptedApplicationOwner: app.applicant_user_id },
    });
    return fail(res, 403, "Access denied: You can only view your own application timeline");
  }

  try {
    const { data, error } = await supabase
      .from("bpo_application_events")
      .select("*")
      .eq("application_id", appId)
      .order("created_at", { ascending: true });

    if (!error && data && data.length) {
      return res.json({ events: data });
    }
  } catch {}

  const evts = memoryStore.events.get(appId) || [];
  return res.json({ events: evts });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES (Guarded by requireAuth)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/partner-applications - List all applications with filtering
router.get("/admin/partner-applications", requireAuth, async (req: AdminRequest, res: Response) => {
  const { status, search, limit = "50", offset = "0" } = req.query as {
    status?: string;
    search?: string;
    limit?: string;
    offset?: string;
  };

  let allApps: ApplicationRecord[] = [];

  try {
    let query = supabase.from("bpo_partner_applications").select("*").order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (!error && data) allApps = data as ApplicationRecord[];
  } catch {}

  // If DB empty or not available, use memory store
  if (allApps.length === 0) {
    allApps = Array.from(memoryStore.applications.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  let filtered = allApps;
  if (status && status !== "all") {
    filtered = filtered.filter((a) => a.status.toLowerCase() === status.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.application_number.toLowerCase().includes(s) ||
        (a.company_data?.companyName && a.company_data.companyName.toLowerCase().includes(s)) ||
        (a.company_data?.email && a.company_data.email.toLowerCase().includes(s)) ||
        (a.company_data?.ownerName && a.company_data.ownerName.toLowerCase().includes(s))
    );
  }

  // Summary counts
  const counts = {
    total: allApps.length,
    draft: allApps.filter((a) => a.status === "draft").length,
    submitted: allApps.filter((a) => a.status === "submitted").length,
    under_review: allApps.filter((a) => a.status === "under_review").length,
    action_required: allApps.filter((a) => a.status === "action_required" || a.status === "documents_required").length,
    approved: allApps.filter((a) => a.status === "approved").length,
    rejected: allApps.filter((a) => a.status === "rejected").length,
  };

  return res.json({
    applications: filtered.map(formatAppResponse),
    counts,
  });
});

// GET /api/admin/partner-applications/:id - Full details for review
router.get("/admin/partner-applications/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  let app: ApplicationRecord | null = null;
  let docs: ApplicationDoc[] = [];
  let evts: ApplicationEvent[] = [];

  try {
    const { data } = await supabase.from("bpo_partner_applications").select("*").eq("id", appId).maybeSingle();
    if (data) {
      app = data as ApplicationRecord;
      const { data: d } = await supabase.from("bpo_application_documents").select("*").eq("application_id", appId);
      const { data: e } = await supabase.from("bpo_application_events").select("*").eq("application_id", appId).order("created_at", { ascending: true });
      if (d) docs = d as any[];
      if (e) evts = e as any[];
    }
  } catch {}

  const memDocs = memoryStore.documents.get(appId) || [];
  if (docs.length === 0) {
    docs = memDocs;
  } else {
    for (const m of memDocs) {
      const docType = (m as any).document_type || (m as any).documentType;
      const exists = docs.find((x: any) => (m.id && x.id === m.id) || (docType && x.document_type === docType));
      if (exists) {
        if ((m as any).status && (m as any).status !== "pending") exists.status = (m as any).status;
      } else {
        docs.push(m);
      }
    }
  }

  if (!app) {
    app = memoryStore.applications.get(appId) || null;
    if (docs.length === 0) docs = memoryStore.documents.get(appId) || [];
    if (evts.length === 0) evts = memoryStore.events.get(appId) || [];
  }

  if (!app) return fail(res, 404, "Application not found");

  const formatted = formatAppResponse(app);
  return res.json({
    ...formatted,
    application: formatted,
    documents: docs,
    events: evts,
    timeline: evts,
    verification_checks: app.verification_checks || {},
  });
});

// PATCH /api/admin/partner-applications/:id/status - Update stage/status
router.patch("/admin/partner-applications/:id/status", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const { status, stage, note } = req.body || {};
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");
  if (!status) return fail(res, 400, "Status is required");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");

  const prevStatus = app.status;
  app.status = status;
  if (stage) app.current_stage = stage;
  app.updated_at = new Date().toISOString();

  await addTimelineEvent(appId, status, prevStatus, stage || app.current_stage, note || `Status updated to ${status}`, {
    adminId: req.admin!.id,
    name: req.admin!.username,
  });

  try {
    await supabase
      .from("bpo_partner_applications")
      .update({
        status,
        ...(stage ? { current_stage: stage } : {}),
        updated_at: app.updated_at,
      })
      .eq("id", appId);
  } catch {}

  const formatted = formatAppResponse(app);
  return res.json({ ...formatted, status: app.status, success: true, application: formatted });
});

// POST /api/admin/partner-applications/:id/verification - Update checklist item
router.post("/admin/partner-applications/:id/verification", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const itemKey = req.body?.itemKey || req.body?.check_key || req.body?.key;
  let status = req.body?.status;
  const verified = req.body?.verified !== undefined ? Boolean(req.body.verified) : (status === "verified");
  if (!status) status = verified ? "verified" : "pending";
  const notes = req.body?.notes || req.body?.remarks || null;

  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");
  if (!itemKey) return fail(res, 400, "itemKey is required");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");

  app.verification_checks = app.verification_checks || {};
  app.verification_checks[itemKey] = {
    status,
    verified,
    notes,
    verified_at: new Date().toISOString(),
    verified_by: req.admin!.id,
  };
  app.updated_at = new Date().toISOString();

  memoryStore.applications.set(appId, app);

  try {
    await supabase
      .from("bpo_partner_applications")
      .update({
        verification_checks: app.verification_checks,
        updated_at: app.updated_at,
      })
      .eq("id", appId);
  } catch {}

  return res.json({ success: true, verification_checks: app.verification_checks });
});

// POST /api/admin/partner-applications/:id/request-info - Request more info from applicant
router.post("/admin/partner-applications/:id/request-info", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const missingItems = req.body?.missingItems || req.body?.missing_items || [];
  const notes = req.body?.notes || req.body?.remarks || "";
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");
  if (!notes && (!missingItems || missingItems.length === 0)) {
    return fail(res, 400, "Please provide the missing requirements or a remark for the applicant.");
  }

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");

  const prevStatus = app.status;
  const now = new Date().toISOString();
  app.status = "action_required";
  app.missing_information = missingItems.map((item: any) =>
    typeof item === "string" ? { item, notes, requestedAt: now } : item
  );
  app.updated_at = now;

  memoryStore.applications.set(appId, app);

  await addTimelineEvent(
    appId,
    "action_required",
    prevStatus,
    "documents",
    `Action Required: ${notes || "More information requested"} (${missingItems.join(", ")})`,
    { adminId: req.admin!.id, name: req.admin!.username },
    "application_action_required"
  );

  try {
    await supabase
      .from("bpo_partner_applications")
      .update({
        status: "action_required",
        missing_information: app.missing_information,
        updated_at: now,
      })
      .eq("id", appId);
  } catch {}

  // Send notification to applicant
  await createNotification(
    app.applicant_user_id,
    "application_action_required",
    "Action Required: BPO Application",
    `Your BPO application ${app.application_number} requires additional details: ${notes || missingItems.join(", ")}`,
    String(appId)
  );

  const formatted = formatAppResponse(app);
  return res.json({
    ...formatted,
    status: "action_required",
    success: true,
    application: formatted,
    message: "Requested information sent to applicant successfully",
  });
});

// POST /api/admin/partner-applications/:id/approve - Approve and activate partner + generate Centre ID
router.post("/admin/partner-applications/:id/approve", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");

  const country = app.company_data?.country || "IN";
  const state = app.company_data?.state || "PN";
  const centreSeq = memoryStore.nextCentreSeq++;
  const centreId = generateCentreId(country, state, centreSeq);

  const prevStatus = app.status;
  const now = new Date().toISOString();

  app.status = "approved";
  app.current_stage = "centre_id_generated";
  app.centre_id = centreId;
  app.reviewed_at = now;
  app.reviewed_by = req.admin!.id;
  app.updated_at = now;

  memoryStore.applications.set(appId, app);

  await addTimelineEvent(
    appId,
    "approved",
    prevStatus,
    "centre_id_generated",
    `Application approved. Centre ID generated: ${centreId}. Partner account activated.`,
    { adminId: req.admin!.id, name: req.admin!.username },
    "application_approved"
  );

  // Activate BPO partner record and update user role
  let partnerUuid: string | null = null;
  try {
    // 1. Create or activate BPO partner organization
    let partnerRec: any = null;
    const partnerEmail = app.company_data?.email || null;
    if (partnerEmail) {
      const { data: existingPartner } = await supabase
        .from("bpo_partners")
        .select("id")
        .eq("email", partnerEmail)
        .maybeSingle();

      if (existingPartner) {
        const { data: updated } = await supabase
          .from("bpo_partners")
          .update({
            partner_code: centreId,
            name: app.company_data?.companyName || "BPO Partner",
            legal_name: app.company_data?.legalEntity || null,
            contact_name: app.company_data?.ownerName || null,
            phone: app.company_data?.phone || null,
            address: `${app.company_data?.address || ""}, ${app.company_data?.city || ""}, ${app.company_data?.state || ""}`,
            status: "active",
          })
          .eq("id", existingPartner.id)
          .select()
          .maybeSingle();
        partnerRec = updated || existingPartner;
      }
    }

    if (!partnerRec) {
      const { data: inserted } = await supabase
        .from("bpo_partners")
        .insert({
          partner_code: centreId,
          name: app.company_data?.companyName || "BPO Partner",
          legal_name: app.company_data?.legalEntity || null,
          contact_name: app.company_data?.ownerName || null,
          email: app.company_data?.email || null,
          phone: app.company_data?.phone || null,
          address: `${app.company_data?.address || ""}, ${app.company_data?.city || ""}, ${app.company_data?.state || ""}`,
          status: "active",
        })
        .select()
        .maybeSingle();
      partnerRec = inserted;
    }

    partnerUuid = partnerRec?.id || null;
  } catch (partnerErr: any) {
    logger.warn({ err: partnerErr?.message }, "[PartnerApplications] bpo_partners insert notice");
  }

  if (partnerUuid) {
    app.partner_id = partnerUuid;
    // 2. Create centre profile (optional)
    try {
      await supabase.from("bpo_centres").insert({
        partner_id: partnerUuid,
        name: app.centre_data?.centreName || `${app.company_data?.companyName} Centre`,
        location: `${app.centre_data?.centreAddress || ""}, ${app.company_data?.city || ""}`,
        capacity: Number(app.centre_data?.totalSeats) || 0,
        status: "active",
      });
    } catch (centreErr: any) {
      logger.warn({ err: centreErr?.message }, "[PartnerApplications] bpo_centres insert notice");
    }

    // 3. Link partner membership (optional)
    try {
      await supabase.from("bpo_partner_users").insert({
        partner_id: partnerUuid,
        user_id: app.applicant_user_id,
        role: "partner_admin",
        status: "active",
      });
    } catch (userErr: any) {
      logger.warn({ err: userErr?.message }, "[PartnerApplications] bpo_partner_users insert notice");
    }
  }

  // 4. Update profile role to bpo_partner & status to APPROVED
  try {
    await supabase
      .from("profiles")
      .update({
        role: "bpo_partner",
        account_type: "BPO",
        bpo_status: "APPROVED",
        is_active: true,
        approved_at: now,
      })
      .eq("id", app.applicant_user_id);
  } catch (profErr: any) {
    logger.warn({ err: profErr?.message }, "[PartnerApplications] profiles update error");
  }

  // 5. Update application record in DB
  try {
    await supabase
      .from("bpo_partner_applications")
      .update({
        status: "approved",
        centre_id: centreId,
        current_stage: "centre_id_generated",
        reviewed_at: now,
        reviewed_by: req.admin!.id,
        partner_id: partnerUuid || null,
        updated_at: now,
      })
      .eq("id", appId);
  } catch (appDbErr: any) {
    logger.warn({ err: appDbErr?.message }, "[PartnerApplications] bpo_partner_applications update error");
  }

  // 6. Audit log
  try {
    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "partner_application_approved",
      entity_type: "bpo_partner_application",
      entity_id: String(appId),
      metadata: { centreId, partnerId: partnerUuid, applicantUserId: app.applicant_user_id },
    });
  } catch {}

  invalidateAdminBpoCache(app.applicant_user_id);

  // 7. Send notification to applicant
  await createNotification(
    app.applicant_user_id,
    "application_approved",
    "🎉 BPO Partner Application Approved!",
    `Congratulations! Your Thinkatic BPO Partner application has been approved. Your Centre ID is ${centreId}. All operational partner features are now unlocked!`,
    String(appId)
  );

  const formatted = formatAppResponse(app);
  return res.json({
    ...formatted,
    success: true,
    centreId,
    centre_id: centreId,
    status: "approved",
    application: formatted,
    message: `Application approved! Generated Centre ID: ${centreId}`,
  });
});

// POST /api/admin/partner-applications/:id/reject - Reject application with reason
router.post("/admin/partner-applications/:id/reject", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const { reason } = req.body || {};
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID");
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return fail(res, 400, "Rejection reason is required");
  }

  const app = await resolveApplicationRecord(appId);
  if (!app) return fail(res, 404, "Application not found");

  const prevStatus = app.status;
  const now = new Date().toISOString();

  app.status = "rejected";
  app.rejection_reason = reason.trim();
  app.reviewed_at = now;
  app.reviewed_by = req.admin!.id;
  app.updated_at = now;

  memoryStore.applications.set(appId, app);

  await addTimelineEvent(
    appId,
    "rejected",
    prevStatus,
    "decision",
    `Application rejected. Reason: ${reason.trim()}`,
    { adminId: req.admin!.id, name: req.admin!.username },
    "application_rejected"
  );

  try {
    await supabase
      .from("profiles")
      .update({
        bpo_status: "REJECTED",
        rejected_at: now,
      })
      .eq("id", app.applicant_user_id);

    await supabase
      .from("bpo_partner_applications")
      .update({
        status: "rejected",
        rejection_reason: reason.trim(),
        reviewed_at: now,
        reviewed_by: req.admin!.id,
        updated_at: now,
      })
      .eq("id", appId);

    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "partner_application_rejected",
      entity_type: "bpo_partner_application",
      entity_id: String(appId),
      metadata: { reason: reason.trim(), applicantUserId: app.applicant_user_id },
    });
  } catch {}

  invalidateAdminBpoCache(app.applicant_user_id);

  await createNotification(
    app.applicant_user_id,
    "application_rejected",
    "BPO Application Status Update",
    `Your BPO application has not been approved. Reason: ${reason.trim()}`,
    String(appId)
  );

  const formatted = formatAppResponse(app);
  return res.json({
    ...formatted,
    success: true,
    status: "rejected",
    application: formatted,
    message: "Application rejected",
  });
});

/**
 * Purge in-memory application records for a deleted user
 */
export function removeApplicationFromMemory(userId: string, appIds?: number[]): void {
  if (!userId && (!appIds || appIds.length === 0)) return;
  for (const [id, app] of memoryStore.applications.entries()) {
    if (app.applicant_user_id === userId || (appIds && appIds.includes(id))) {
      memoryStore.applications.delete(id);
      memoryStore.documents.delete(id);
      memoryStore.events.delete(id);
    }
  }
}

export default router;

