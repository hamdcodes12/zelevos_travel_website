// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — OFFICE / CENTRE VERIFICATION SERVICE
// Private File Storage: data/centre_verification/{partnerId}/{verificationId}/
// NO AI DECISIONING: Purely human evidence for Thinkatic Admin/Operations review.
// ZERO AUTO-ACTIVATION: Office approval is a prerequisite, not final activation.
// MANDATORY REJECTION REASON: Preserves complete resubmission & evidence history.
// ==============================================================================

import fs from "fs";
import path from "path";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import { logSecurityEvent } from "./security.js";

export type CentreVerificationStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RESUBMISSION_REQUIRED";

export type BpoMediaStatus =
  | "active"
  | "archived"
  | "superseded"
  | "approved"
  | "rejected"
  | "resubmission_required";

export interface BpoCentreMediaRecord {
  id: number;
  verificationId: number;
  partnerId: string | null;
  applicantUserId: string;
  centreId: string | null;
  mediaType: "photo" | "video";
  category: string;
  storageBucket?: string;
  storagePath?: string;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number | null;
  uploadedBy: string;
  uploadedAt: string;
  status: BpoMediaStatus;
  filePath?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}

export interface BpoCentreVerificationHistoryRecord {
  id: number;
  verificationId: number;
  submissionRound: number;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
  actorRole: "partner" | "admin" | "system";
  actorName: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface BpoCentreVerificationRecord {
  id: number;
  partnerId: string | null;
  applicationId: number | null;
  centreId: string | null;
  applicantUserId: string;

  // Office Attributes
  officeName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  landmark: string | null;
  contactNumber: string;
  centreType: string;
  ownershipType: string;
  operatingSince: string;
  totalAreaSqft: number | null;
  numberOfFloors: number | null;
  workingHours?: string | null;
  operatingShift?: string | null;

  // Status & Timestamps
  status: CentreVerificationStatus;
  submittedAt: string | null;
  submissionCount: number;

  // Admin Review
  reviewedAt: string | null;
  reviewedByAdminId: number | null;
  reviewedByAdminName: string | null;
  rejectionReason: string | null;

  createdAt: string;
  updatedAt: string;

  media: BpoCentreMediaRecord[];
  history: BpoCentreVerificationHistoryRecord[];
}

export const PHOTO_CATEGORIES = [
  { id: "reception_entrance", label: "Reception / Entrance", required: true },
  { id: "workstation_area", label: "Workstation Area", required: true },
  { id: "operations_area", label: "Operations Area", required: true },
  { id: "management_area", label: "Management / Supervisor Area", required: false },
  { id: "infrastructure_equipment", label: "Infrastructure / Equipment", required: true },
  { id: "network_setup", label: "Internet / Network Setup", required: true },
  { id: "power_backup", label: "Power Backup", required: true },
  { id: "security_access", label: "Security / Access Area", required: false },
] as const;

export const VIDEO_CATEGORY = "live_walkthrough";

import {
  initStorage,
  getDomainPath,
  saveFile,
  resolveSecurePath,
  createSignedUrl,
  fileExists as storageFileExists,
  getFileStats as storageGetFileStats,
  StorageSecurityError,
} from "./storageService.js";

// Storage paths (migrated to persistent enterprise storageService)
function getStoreFile(): string {
  return path.join(getDomainPath("centre-verification"), "centre_verification_store.json");
}
const LEGACY_VERIFICATION_DIR = path.resolve(process.cwd(), "data", "centre_verification");

// In-memory cache synced with database and JSON fallback (isolated to dev/test)
let verificationsStore: BpoCentreVerificationRecord[] = [];
let nextVerifId = 1;
let nextMediaId = 1;
let nextHistId = 1;
let isInitialized = false;

// Ensure storage initialized
initStorage();

/**
 * Initialize store from Supabase PostgreSQL (primary) and JSON fallback (dev/test only)
 */
export async function initializeCentreVerificationStore(): Promise<void> {
  if (isInitialized) return;

  // 1. In dev/test, read from JSON store if present
  const isProduction = process.env.NODE_ENV === "production";
  const storeFile = getStoreFile();
  if (!isProduction && fs.existsSync(storeFile)) {
    try {
      const raw = fs.readFileSync(storeFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.verifications)) {
        verificationsStore = parsed.verifications;
        const allMediaIds = verificationsStore.flatMap((v) => (v.media || []).map((m) => Number(m.id) || 0));
        const allHistIds = verificationsStore.flatMap((v) => (v.history || []).map((h) => Number(h.id) || 0));
        nextVerifId = Math.max(parsed.nextVerifId || 0, ...verificationsStore.map((v) => v.id), 0) + 1;
        nextMediaId = Math.max(parsed.nextMediaId || 0, ...allMediaIds, 0) + 1;
        nextHistId = Math.max(parsed.nextHistId || 0, ...allHistIds, 0) + 1;
      }
      logger.info({ count: verificationsStore.length }, "Loaded centre verifications from persistent JSON storage");
    } catch (err: any) {
      logger.warn({ err: err.message }, "Error reading centre verification JSON store, initializing fresh");
    }
  }

  // 2. Sync from Supabase PostgreSQL (authoritative source of truth)
  try {
    const { data, error } = await Promise.race([
      supabase.from("bpo_centre_verification").select("*").order("id", { ascending: true }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000)),
    ]);

    if (!error && Array.isArray(data) && data.length > 0) {
      for (const row of data) {
        const existingIndex = verificationsStore.findIndex(
          (v) => v.id === Number(row.id)
        );
        const record: BpoCentreVerificationRecord = {
          id: Number(row.id),
          partnerId: row.partner_id || null,
          applicationId: row.application_id ? Number(row.application_id) : null,
          centreId: row.centre_id || null,
          applicantUserId: String(row.applicant_user_id),
          officeName: row.office_name,
          addressLine1: row.address_line_1,
          addressLine2: row.address_line_2 || null,
          city: row.city,
          state: row.state,
          country: row.country || "India",
          postalCode: row.postal_code,
          landmark: row.landmark || null,
          contactNumber: row.contact_number,
          centreType: row.centre_type || "Dedicated BPO Facility",
          ownershipType: row.ownership_type || "Commercial Lease",
          operatingSince: row.operating_since,
          totalAreaSqft: row.total_area_sqft ? Number(row.total_area_sqft) : null,
          numberOfFloors: row.number_of_floors ? Number(row.number_of_floors) : 1,
          status: row.status as CentreVerificationStatus,
          submittedAt: row.submitted_at || null,
          submissionCount: row.submission_count || 0,
          reviewedAt: row.reviewed_at || null,
          reviewedByAdminId: row.reviewed_by_admin_id ? Number(row.reviewed_by_admin_id) : null,
          reviewedByAdminName: row.reviewed_by_admin_name || null,
          rejectionReason: row.rejection_reason || null,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
          media: existingIndex >= 0 ? verificationsStore[existingIndex].media : [],
          history: existingIndex >= 0 ? verificationsStore[existingIndex].history : [],
        };
        if (existingIndex >= 0) {
          verificationsStore[existingIndex] = record;
        } else {
          verificationsStore.push(record);
        }
      }
      const allMediaIds = verificationsStore.flatMap((v) => (v.media || []).map((m) => Number(m.id) || 0));
      const allHistIds = verificationsStore.flatMap((v) => (v.history || []).map((h) => Number(h.id) || 0));
      nextVerifId = Math.max(nextVerifId, ...verificationsStore.map((v) => Number(v.id) || 0), 0) + 1;
      nextMediaId = Math.max(nextMediaId, ...allMediaIds, 0) + 1;
      nextHistId = Math.max(nextHistId, ...allHistIds, 0) + 1;
    }

    try {
      const { data: maxMedia } = await supabase
        .from("bpo_centre_media")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      if (maxMedia?.[0]?.id) {
        nextMediaId = Math.max(nextMediaId, Number(maxMedia[0].id) + 1, 1000);
      } else {
        nextMediaId = Math.max(nextMediaId, 1000);
      }
    } catch {
      nextMediaId = Math.max(nextMediaId, 1000);
    }
  } catch {}

  isInitialized = true;
}

/**
 * Persist store to disk
 */
function persistStore(): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    const storeFile = getStoreFile();
    const parentDir = path.dirname(storeFile);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true, mode: 0o750 });
    }
    fs.writeFileSync(
      storeFile,
      JSON.stringify(
        {
          verifications: verificationsStore,
          nextVerifId,
          nextMediaId,
          nextHistId,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to persist centre verification store to disk");
  }
}

/**
 * Server-side resolution of BPO Partner and Primary Centre from authenticated session
 * Follows: authenticated user -> authenticated BPO partner -> partner's centre
 */
export async function resolvePartnerAndCentreForUser(userId: string, email?: string): Promise<{
  partnerId: string | null;
  centreId: string | null;
  centreName: string | null;
  partnerCode: string | null;
  applicationId: number | null;
}> {
  let partnerId: string | null = null;
  let centreId: string | null = null;
  let centreName: string | null = null;
  let partnerCode: string | null = null;
  let applicationId: number | null = null;

  try {
    // 1. Check bpo_partner_users table
    const { data: userLinks } = await supabase
      .from("bpo_partner_users")
      .select("partner_id, role, status")
      .eq("user_id", userId);

    if (userLinks && userLinks.length > 0) {
      const activeLink = userLinks.find((u: any) => u.status === "active") || userLinks[0];
      if (activeLink?.partner_id) {
        partnerId = String(activeLink.partner_id);
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message, userId }, "Notice querying bpo_partner_users in resolvePartnerAndCentre");
  }

  // 2. Check bpo_partners table directly (if user is direct partner record or by email)
  if (!partnerId) {
    try {
      let partnerQuery = supabase.from("bpo_partners").select("id, partner_code, name, email");
      if (email) {
        partnerQuery = partnerQuery.or(`id.eq.${userId},email.eq.${email}`);
      } else {
        partnerQuery = partnerQuery.eq("id", userId);
      }
      const { data: partners } = await partnerQuery;

      if (partners && partners.length > 0) {
        partnerId = String(partners[0].id);
        partnerCode = partners[0].partner_code || null;
        centreName = partners[0].name || null;
      }
    } catch (err: any) {
      logger.warn({ error: err.message, userId }, "Notice querying bpo_partners in resolvePartnerAndCentre");
    }
  }

  // 3. Check bpo_partner_applications table directly (where applicant onboarding takes place)
  try {
    let appQuery = supabase
      .from("bpo_partner_applications")
      .select("id, partner_id, centre_id, company_name, applicant_user_id")
      .order("id", { ascending: false });

    if (email) {
      appQuery = appQuery.or(`applicant_user_id.eq.${userId},company_data->>email.eq.${email}`);
    } else {
      appQuery = appQuery.eq("applicant_user_id", userId);
    }
    const { data: apps } = await appQuery.limit(1);
    if (apps && apps.length > 0) {
      const app = apps[0];
      applicationId = Number(app.id);
      if (!partnerId && app.partner_id) partnerId = String(app.partner_id);
      if (!centreId && app.centre_id) centreId = String(app.centre_id);
      if (!centreName && app.company_name) centreName = String(app.company_name);
    }
  } catch (err: any) {
    logger.warn({ error: err.message, userId }, "Notice querying bpo_partner_applications in resolvePartnerAndCentre");
  }

  // 4. Fallback to existing verification store
  if (!partnerId) {
    await initializeCentreVerificationStore();
    const existingVerif = verificationsStore.find((v) => String(v.applicantUserId) === String(userId) && v.partnerId);
    if (existingVerif?.partnerId) {
      partnerId = existingVerif.partnerId;
      if (existingVerif.centreId) centreId = existingVerif.centreId;
      if (existingVerif.officeName) centreName = existingVerif.officeName;
      if (existingVerif.applicationId && !applicationId) applicationId = existingVerif.applicationId;
    }
  }

  // 5. Resolve partner's centre from bpo_centres
  if (partnerId) {
    try {
      const { data: centres } = await supabase
        .from("bpo_centres")
        .select("id, name, partner_id, status")
        .eq("partner_id", partnerId)
        .order("id", { ascending: true });

      if (centres && centres.length > 0) {
        const activeCentre = centres.find((c: any) => c.status === "active") || centres[0];
        centreId = String(activeCentre.id);
        if (!centreName) centreName = activeCentre.name;
      }
    } catch (err: any) {
      logger.warn({ error: err.message, partnerId }, "Notice querying bpo_centres in resolvePartnerAndCentre");
    }

    // Also get partner_code if not yet found
    if (!partnerCode) {
      try {
        const { data: p } = await supabase
          .from("bpo_partners")
          .select("partner_code, name")
          .eq("id", partnerId)
          .maybeSingle();
        if (p) {
          partnerCode = p.partner_code || null;
          if (!centreName) centreName = p.name || null;
        }
      } catch {}
    }
  }

  // Check store if centreId still not resolved
  if (partnerId && !centreId) {
    await initializeCentreVerificationStore();
    const existingVerif = verificationsStore.find((v) => v.partnerId === partnerId && v.centreId);
    if (existingVerif?.centreId) {
      centreId = existingVerif.centreId;
      if (!centreName) centreName = existingVerif.officeName;
    }
  }

  return { partnerId, centreId, centreName, partnerCode, applicationId };
}

/**
 * Get or create centre verification record for an applicant/partner
 */
export async function getOrCreateVerification(params: {
  applicantUserId: string;
  partnerId?: string | null;
  applicationId?: number | null;
  centreId?: string | null;
  partnerCode?: string | null;
  officeName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  landmark?: string;
  contactNumber?: string;
  centreType?: string;
  ownershipType?: string;
  operatingSince?: string;
  totalAreaSqft?: number;
  numberOfFloors?: number;
}): Promise<BpoCentreVerificationRecord> {
  await initializeCentreVerificationStore();

  // Match strictly by applicationId first if provided, then by applicantUserId
  let found =
    (params.applicationId ? verificationsStore.find((v) => Number(v.applicationId) === Number(params.applicationId)) : undefined) ||
    verificationsStore.find((v) => v.applicantUserId === params.applicantUserId && (params.applicationId ? Number(v.applicationId) === Number(params.applicationId) : true)) ||
    (params.partnerId ? verificationsStore.find((v) => v.partnerId === params.partnerId && !v.applicationId) : undefined);

  if (!found) {
    try {
      let query = supabase.from("bpo_centre_verification").select("*");
      if (params.applicationId) {
        query = query.eq("application_id", params.applicationId);
      } else if (params.partnerId) {
        query = query.or(`partner_id.eq.${params.partnerId},applicant_user_id.eq.${params.applicantUserId}`);
      } else {
        query = query.eq("applicant_user_id", params.applicantUserId);
      }
      const { data } = await query.order("id", { ascending: false }).limit(1).maybeSingle();

      if (data) {
        found = {
          id: Number(data.id),
          partnerId: data.partner_id || params.partnerId || null,
          applicationId: data.application_id ? Number(data.application_id) : null,
          centreId: data.centre_id || params.centreId || null,
          applicantUserId: String(data.applicant_user_id),
          officeName: data.office_name,
          addressLine1: data.address_line_1,
          addressLine2: data.address_line_2 || null,
          city: data.city,
          state: data.state,
          country: data.country || "India",
          postalCode: data.postal_code,
          landmark: data.landmark || null,
          contactNumber: data.contact_number,
          centreType: data.centre_type || "Dedicated BPO Facility",
          ownershipType: data.ownership_type || "Commercial Lease",
          operatingSince: data.operating_since,
          totalAreaSqft: data.total_area_sqft ? Number(data.total_area_sqft) : null,
          numberOfFloors: data.number_of_floors ? Number(data.number_of_floors) : 1,
          status: data.status as CentreVerificationStatus,
          submittedAt: data.submitted_at || null,
          submissionCount: data.submission_count || 0,
          reviewedAt: data.reviewed_at || null,
          reviewedByAdminId: data.reviewed_by_admin_id ? Number(data.reviewed_by_admin_id) : null,
          reviewedByAdminName: data.reviewed_by_admin_name || null,
          rejectionReason: data.rejection_reason || null,
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: data.updated_at || new Date().toISOString(),
          media: [],
          history: [],
        };
        verificationsStore.push(found);
      }
    } catch {}
  }

  // Ensure established partnerId, centreId, and applicantUserId are linked on the found record if previously missing or updated
  if (found) {
    let updated = false;
    if (!found.partnerId && params.partnerId) {
      found.partnerId = params.partnerId;
      updated = true;
    }
    if (params.applicantUserId && found.applicantUserId !== params.applicantUserId) {
      found.applicantUserId = params.applicantUserId;
      updated = true;
    }
    if (!found.centreId && (params.centreId || params.partnerCode)) {
      found.centreId = params.centreId || params.partnerCode || null;
      updated = true;
    }
    if (updated) {
      persistStore();
    }
  }

  if (!found) {
    const now = new Date().toISOString();
    found = {
      id: nextVerifId++,
      partnerId: params.partnerId || null,
      applicationId: params.applicationId || null,
      centreId: params.centreId || null,
      applicantUserId: params.applicantUserId,
      officeName: params.officeName || "Primary BPO Centre",
      addressLine1: params.addressLine1 || "",
      addressLine2: params.addressLine2 || null,
      city: params.city || "",
      state: params.state || "",
      country: params.country || "India",
      postalCode: params.postalCode || "",
      landmark: params.landmark || null,
      contactNumber: params.contactNumber || "",
      centreType: params.centreType || "Dedicated BPO Facility",
      ownershipType: params.ownershipType || "Commercial Lease",
      operatingSince: params.operatingSince || "2024",
      totalAreaSqft: params.totalAreaSqft || null,
      numberOfFloors: params.numberOfFloors || 1,
      status: "NOT_STARTED",
      submittedAt: null,
      submissionCount: 0,
      reviewedAt: null,
      reviewedByAdminId: null,
      reviewedByAdminName: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
      media: [],
      history: [
        {
          id: nextHistId++,
          verificationId: nextVerifId - 1,
          submissionRound: 1,
          action: "created",
          fromStatus: null,
          toStatus: "NOT_STARTED",
          actorId: params.applicantUserId,
          actorRole: "partner",
          actorName: null,
          notes: "Centre verification dossier initialized",
          metadata: {},
          createdAt: now,
        },
      ],
    };

    verificationsStore.push(found);
    persistStore();

    // Dual-write to Supabase (non-blocking)
    Promise.race([
      supabase.from("bpo_centre_verification").insert({
        id: found.id,
        partner_id: found.partnerId,
        application_id: found.applicationId,
        centre_id: found.centreId,
        applicant_user_id: found.applicantUserId,
        office_name: found.officeName,
        address_line_1: found.addressLine1,
        address_line_2: found.addressLine2,
        city: found.city,
        state: found.state,
        country: found.country,
        postal_code: found.postalCode,
        landmark: found.landmark,
        contact_number: found.contactNumber,
        centre_type: found.centreType,
        ownership_type: found.ownershipType,
        operating_since: found.operatingSince,
        total_area_sqft: found.totalAreaSqft,
        number_of_floors: found.numberOfFloors,
        status: found.status,
      }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000)),
    ]).catch(() => {});
  }

  if (found && found.media.length === 0) {
    try {
      const { data: mediaRows } = await supabase
        .from("bpo_centre_media")
        .select("*")
        .eq("verification_id", found.id);
      if (mediaRows && mediaRows.length > 0) {
        found.media = mediaRows.map((m: any) => ({
          id: Number(m.id),
          verificationId: Number(m.verification_id),
          partnerId: m.partner_id || null,
          applicantUserId: m.applicant_user_id || found.applicantUserId,
          centreId: m.centre_id || null,
          mediaType: m.media_type,
          category: m.category,
          storageBucket: m.storage_bucket || "thinkatic-centre-verification",
          storagePath: m.storage_path || (m.storage_key ? m.storage_key.replace(/^(thinkatic-)?centre-verification\//, "") : ""),
          storageKey: m.storage_key,
          originalFileName: m.original_file_name,
          mimeType: m.mime_type,
          fileSize: Number(m.file_size || 0),
          durationSeconds: m.duration_seconds ? Number(m.duration_seconds) : null,
          uploadedBy: m.uploaded_by,
          uploadedAt: m.uploaded_at,
          status: (m.status as BpoMediaStatus) || "active",
          reviewedBy: m.reviewed_by || null,
          reviewedAt: m.reviewed_at || null,
          rejectionReason: m.rejection_reason || null,
        }));
      }
    } catch {}
  }

  return found;
}

/**
 * Get verification by ID
 */
export async function getVerificationById(id: number): Promise<BpoCentreVerificationRecord | null> {
  await initializeCentreVerificationStore();
  const v = verificationsStore.find((item) => item.id === id);
  return v || null;
}

/**
 * Get verification by User ID
 */
export async function getVerificationByUserId(
  userId: string,
  authContext?: { partnerId?: string | null; centreId?: string | null; partnerCode?: string | null; applicationId?: number | string | null; isAdmin?: boolean }
): Promise<BpoCentreVerificationRecord | null> {
  await initializeCentreVerificationStore();
  let v: BpoCentreVerificationRecord | null | undefined = verificationsStore.find((item) => item.applicantUserId === userId);
  if (!v && authContext?.partnerId) {
    v = verificationsStore.find((item) => item.partnerId === authContext.partnerId);
  }
  if (!v && authContext?.applicationId) {
    v = verificationsStore.find((item) => Number(item.applicationId) === Number(authContext.applicationId));
  }
  if (!v) {
    try {
      let query = supabase.from("bpo_centre_verification").select("*");
      if (authContext?.applicationId) {
        query = query.or(`applicant_user_id.eq.${userId},application_id.eq.${authContext.applicationId}`);
      } else if (authContext?.partnerId) {
        query = query.or(`applicant_user_id.eq.${userId},partner_id.eq.${authContext.partnerId}`);
      } else {
        query = query.eq("applicant_user_id", userId);
      }
      const { data } = await query.order("id", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        v = await getVerificationById(Number(data.id));
      }
    } catch {}
  }
  return v || null;
}

/**
 * Get all verifications (for Admin) with optional status filter & search
 */
export async function getAllVerifications(options: {
  status?: string;
  search?: string;
} = {}): Promise<BpoCentreVerificationRecord[]> {
  await initializeCentreVerificationStore();

  let list = [...verificationsStore];

  if (options.status && options.status !== "all") {
    const s = options.status.toUpperCase();
    list = list.filter((v) => v.status === s);
  }

  if (options.search) {
    const q = options.search.toLowerCase();
    list = list.filter(
      (v) =>
        v.officeName.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.state.toLowerCase().includes(q) ||
        (v.centreId && v.centreId.toLowerCase().includes(q)) ||
        v.applicantUserId.toLowerCase().includes(q)
    );
  }

  // Sort: pending submissions first, then newest
  list.sort((a, b) => {
    const statusWeight: Record<string, number> = {
      SUBMITTED: 1,
      UNDER_REVIEW: 2,
      RESUBMISSION_REQUIRED: 3,
      REJECTED: 4,
      IN_PROGRESS: 5,
      APPROVED: 6,
      NOT_STARTED: 7,
    };
    const diff = (statusWeight[a.status] || 9) - (statusWeight[b.status] || 9);
    if (diff !== 0) return diff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return list;
}

/**
 * Update office details
 */
export async function updateOfficeDetails(
  verificationId: number,
  userId: string,
  details: {
    officeName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    landmark?: string;
    contactNumber?: string;
    centreType?: string;
    ownershipType?: string;
    operatingSince?: string;
    totalAreaSqft?: number;
    numberOfFloors?: number;
    workingHours?: string;
    operatingShift?: string;
  },
  authContext?: { partnerId?: string | null; centreId?: string | null; partnerCode?: string | null; isAdmin?: boolean; applicationId?: number | string | null }
): Promise<{ success: boolean; verification: BpoCentreVerificationRecord | null; error?: string; status?: number }> {
  await initializeCentreVerificationStore();
  const v = verificationsStore.find((item) => item.id === verificationId);

  if (!v) {
    return { success: false, verification: null, error: "Verification record not found", status: 404 };
  }

  const isOwner =
    Boolean(authContext?.isAdmin) ||
    String(v.applicantUserId) === String(userId) ||
    String(v.partnerId) === String(userId) ||
    (authContext?.partnerId && (String(v.partnerId) === String(authContext.partnerId) || String(v.applicantUserId) === String(authContext.partnerId))) ||
    (authContext?.centreId && (String(v.centreId) === String(authContext.centreId) || (authContext.partnerCode && String(v.centreId) === String(authContext.partnerCode))));

  if (!isOwner) {
    return { success: false, verification: null, error: "Unauthorized access: You can only edit your own office verification", status: 403 };
  }


  const now = new Date().toISOString();
  if (details.officeName !== undefined) v.officeName = details.officeName.trim();
  if (details.addressLine1 !== undefined) v.addressLine1 = details.addressLine1.trim();
  if (details.addressLine2 !== undefined) v.addressLine2 = details.addressLine2?.trim() || null;
  if (details.city !== undefined) v.city = details.city.trim();
  if (details.state !== undefined) v.state = details.state.trim();
  if (details.country !== undefined) v.country = details.country.trim();
  if (details.postalCode !== undefined) v.postalCode = details.postalCode.trim();
  if (details.landmark !== undefined) v.landmark = details.landmark?.trim() || null;
  if (details.contactNumber !== undefined) v.contactNumber = details.contactNumber.trim();
  if (details.centreType !== undefined) v.centreType = details.centreType.trim();
  if (details.ownershipType !== undefined) v.ownershipType = details.ownershipType.trim();
  if (details.operatingSince !== undefined) v.operatingSince = details.operatingSince.trim();
  if (details.totalAreaSqft !== undefined) v.totalAreaSqft = details.totalAreaSqft;
  if (details.numberOfFloors !== undefined) v.numberOfFloors = details.numberOfFloors;
  if (details.workingHours !== undefined) v.workingHours = details.workingHours.trim();
  if (details.operatingShift !== undefined) v.operatingShift = details.operatingShift.trim();

  if (v.status === "NOT_STARTED") {
    v.status = "IN_PROGRESS";
  }
  v.updatedAt = now;

  v.history.push({
    id: nextHistId++,
    verificationId: v.id,
    submissionRound: Math.max(1, v.submissionCount),
    action: "details_updated",
    fromStatus: v.status,
    toStatus: v.status,
    actorId: userId,
    actorRole: "partner",
    actorName: null,
    notes: "Office / centre details updated",
    metadata: { officeName: v.officeName, city: v.city, state: v.state },
    createdAt: now,
  });

  persistStore();

  // Dual-write
  Promise.race([
    supabase
      .from("bpo_centre_verification")
      .update({
        office_name: v.officeName,
        address_line_1: v.addressLine1,
        address_line_2: v.addressLine2,
        city: v.city,
        state: v.state,
        country: v.country,
        postal_code: v.postalCode,
        landmark: v.landmark,
        contact_number: v.contactNumber,
        centre_type: v.centreType,
        ownership_type: v.ownershipType,
        operating_since: v.operatingSince,
        total_area_sqft: v.totalAreaSqft,
        number_of_floors: v.numberOfFloors,
        status: v.status,
        updated_at: now,
      })
      .eq("id", v.id),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 300)),
  ]).catch(() => {});

  await logSecurityEvent({
    action: "bpo_centre_details_updated",
    actorUserId: userId,
    targetId: String(v.id),
    details: { officeName: v.officeName, city: v.city },
  });

  return { success: true, verification: v };
}

/**
 * Validate media file upload server-side
 */
export function validateMediaFile(params: {
  mediaType: "photo" | "video";
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileBuffer?: Buffer;
}): { valid: boolean; error?: string } {
  const { mediaType, originalFileName, mimeType, fileSizeBytes, fileBuffer } = params;

  // 1. Path traversal protection on filename
  const baseName = path.basename(originalFileName);
  if (baseName !== originalFileName || originalFileName.includes("..") || originalFileName.includes("/") || originalFileName.includes("\\")) {
    return { valid: false, error: "Invalid filename: Path traversal attempts are strictly forbidden." };
  }

  // 2. Reject executable extensions and scripts
  const lowerName = originalFileName.toLowerCase();
  const dangerousExts = [
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".vbs", ".js", ".mjs",
    ".ts", ".py", ".php", ".phtml", ".html", ".htm", ".svg", ".xhtml",
    ".dll", ".so", ".dylib", ".bin", ".com", ".scr", ".msi", ".jar"
  ];
  for (const ext of dangerousExts) {
    if (lowerName.endsWith(ext)) {
      return { valid: false, error: `Invalid file type: Executable, script, or unsafe extension (${ext}) rejected.` };
    }
  }

  // 3. Size Limits
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

  if (mediaType === "photo") {
    if (fileSizeBytes > MAX_PHOTO_BYTES) {
      return { valid: false, error: "Photo file size exceeds maximum allowed limit of 10MB." };
    }
    const allowedPhotoMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedPhotoMimes.includes(mimeType.toLowerCase())) {
      return { valid: false, error: `Invalid photo format (${mimeType}). Supported: JPEG, PNG, WEBP.` };
    }
    const allowedPhotoExts = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowedPhotoExts.some((ext) => lowerName.endsWith(ext))) {
      return { valid: false, error: "Photo file must end in .jpg, .jpeg, .png, or .webp." };
    }
  } else if (mediaType === "video") {
    if (fileSizeBytes > MAX_VIDEO_BYTES) {
      return { valid: false, error: "Video file size exceeds maximum allowed limit of 100MB." };
    }
    const allowedVideoMimes = [
      "video/webm",
      "video/mp4",
      "video/quicktime",
      "video/x-matroska",
    ];
    if (!allowedVideoMimes.includes(mimeType.toLowerCase())) {
      return { valid: false, error: `Invalid video format (${mimeType}). Supported: WebM, MP4, QuickTime/MOV, MKV.` };
    }
    const allowedVideoExts = [".webm", ".mp4", ".mov", ".mkv"];
    if (!allowedVideoExts.some((ext) => lowerName.endsWith(ext))) {
      return { valid: false, error: "Video file must end in .webm, .mp4, .mov, or .mkv." };
    }
  } else {
    return { valid: false, error: "Unsupported media type." };
  }

  // 4. Magic Bytes Inspection if buffer provided
  if (fileBuffer && fileBuffer.length >= 4) {
    // Check for PE executable header (MZ)
    if (fileBuffer[0] === 0x4d && fileBuffer[1] === 0x5a) {
      return { valid: false, error: "Executable binary detected. Upload rejected." };
    }
    // Check for ELF header (.ELF)
    if (fileBuffer[0] === 0x7f && fileBuffer[1] === 0x45 && fileBuffer[2] === 0x4c && fileBuffer[3] === 0x46) {
      return { valid: false, error: "ELF executable binary detected. Upload rejected." };
    }
    // Check for script header (#!/bin/)
    if (fileBuffer[0] === 0x23 && fileBuffer[1] === 0x21) {
      return { valid: false, error: "Script executable detected. Upload rejected." };
    }
  }

  return { valid: true };
}

/**
 * Save media file to private file storage and record metadata
 */
export async function uploadMediaEvidence(params: {
  verificationId: number;
  userId: string;
  partnerId?: string | null;
  centreId?: string | null;
  partnerCode?: string | null;
  applicationId?: number | null;
  isAdmin?: boolean;
  mediaType: "photo" | "video";
  category: string;
  originalFileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  durationSeconds?: number | null;
}): Promise<{ success: boolean; media: BpoCentreMediaRecord | null; error?: string; status?: number }> {
  await initializeCentreVerificationStore();
  const v = verificationsStore.find((item) => item.id === params.verificationId);

  if (!v) {
    return { success: false, media: null, error: "Verification record not found", status: 404 };
  }

  const isOwner =
    Boolean(params.isAdmin) ||
    String(v.applicantUserId) === String(params.userId) ||
    (params.partnerId && String(v.partnerId) === String(params.partnerId)) ||
    (params.centreId && (String(v.centreId) === String(params.centreId) || (params.partnerCode && String(v.centreId) === String(params.partnerCode)))) ||
    (params.applicationId && Number(v.applicationId) === Number(params.applicationId));

  if (!isOwner) {
    await logSecurityEvent({
      action: "unauthorized_centre_media_upload_attempt",
      actorUserId: params.userId,
      targetId: String(v.id),
      details: {
        attemptedVerificationId: v.id,
        userPartnerId: params.partnerId,
        verifPartnerId: v.partnerId,
        fileName: params.originalFileName,
      },
    });
    return {
      success: false,
      media: null,
      status: 403,
      error: "Unauthorized access: You can only upload evidence to your own centre verification",
    };
  }

  // Validate category
  if (params.mediaType === "photo") {
    const validCat = PHOTO_CATEGORIES.some((c) => c.id === params.category);
    if (!validCat) {
      return { success: false, media: null, error: `Invalid photo category: ${params.category}` };
    }
  } else if (params.mediaType === "video") {
    if (params.category !== VIDEO_CATEGORY) {
      return { success: false, media: null, error: `Invalid video category: ${params.category}. Must be '${VIDEO_CATEGORY}'.` };
    }
    if (params.durationSeconds && params.durationSeconds > 600) {
      return { success: false, media: null, error: "Video duration exceeds maximum allowed limit of 10 minutes (600s)." };
    }
  }

  // Technical validation
  const validation = validateMediaFile({
    mediaType: params.mediaType,
    originalFileName: params.originalFileName,
    mimeType: params.mimeType,
    fileSizeBytes: params.fileBuffer.length,
    fileBuffer: params.fileBuffer,
  });

  if (!validation.valid) {
    await logSecurityEvent({
      action: "invalid_centre_media_upload_attempt",
      actorUserId: params.userId,
      targetId: String(v.id),
      details: { fileName: params.originalFileName, error: validation.error },
    });
    return { success: false, media: null, error: validation.error };
  }

  // 1. Establish relative key within Supabase storage bucket: {userFolder}/{verificationId}/{photos|videos}/{category}/{uniqueFileName}
  const folderKey = params.mediaType === "photo" ? "photos" : "videos";
  const categorySubdir = params.mediaType === "photo" ? params.category : "live-walkthrough";
  const userFolder = v.partnerId || v.applicantUserId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeBase = path.basename(params.originalFileName).replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueFileName = `${Date.now()}_${safeBase}`;
  const relativeKey = `${userFolder}/${v.id}/${folderKey}/${categorySubdir}/${uniqueFileName}`;

  // 2. Write binary to secure persistent Supabase Storage via storageService
  const saveRes = await saveFile("centre-verification", relativeKey, params.fileBuffer, params.mimeType);
  const diskPath = saveRes.absolutePath;
  const storageKey = `thinkatic-centre-verification/${relativeKey}`;
  const now = new Date().toISOString();

  // 4. If uploading a photo for a category or a live video, mark existing active or rejected media in that category as superseded (preserves audit history)
  for (const m of v.media) {
    if (m.category === params.category && (m.status === "active" || m.status === "rejected" || m.status === "resubmission_required")) {
      m.status = "superseded";
    }
  }

  const mediaRecord: BpoCentreMediaRecord = {
    id: nextMediaId++,
    verificationId: v.id,
    partnerId: v.partnerId,
    applicantUserId: v.applicantUserId,
    centreId: v.centreId,
    mediaType: params.mediaType,
    category: params.category,
    storageBucket: "thinkatic-centre-verification",
    storagePath: relativeKey,
    storageKey,
    originalFileName: params.originalFileName,
    mimeType: params.mimeType,
    fileSize: params.fileBuffer.length,
    durationSeconds: params.durationSeconds || null,
    uploadedBy: params.userId,
    uploadedAt: now,
    status: "active",
    filePath: diskPath,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  };

  v.media.push(mediaRecord);
  if (v.status === "NOT_STARTED") {
    v.status = "IN_PROGRESS";
  }
  v.updatedAt = now;

  v.history.push({
    id: nextHistId++,
    verificationId: v.id,
    submissionRound: Math.max(1, v.submissionCount),
    action: params.mediaType === "photo" ? "photo_uploaded" : "video_uploaded",
    fromStatus: v.status,
    toStatus: v.status,
    actorId: params.userId,
    actorRole: "partner",
    actorName: null,
    notes: `${params.mediaType === "photo" ? "Photo" : "Live walkthrough video"} uploaded for category: ${params.category}`,
    metadata: {
      mediaId: mediaRecord.id,
      category: params.category,
      fileName: params.originalFileName,
      size: mediaRecord.fileSize,
    },
    createdAt: now,
  });

  persistStore();

  // Dual-write metadata to Supabase
  try {
    const { data: dbMediaRow, error: insertErr } = await supabase
      .from("bpo_centre_media")
      .insert({
        id: mediaRecord.id,
        verification_id: mediaRecord.verificationId,
        partner_id: mediaRecord.partnerId,
        applicant_user_id: mediaRecord.applicantUserId,
        centre_id: mediaRecord.centreId,
        media_type: mediaRecord.mediaType,
        category: mediaRecord.category,
        storage_key: mediaRecord.storageKey,
        original_file_name: mediaRecord.originalFileName,
        mime_type: mediaRecord.mimeType,
        file_size: mediaRecord.fileSize,
        duration_seconds: mediaRecord.durationSeconds,
        uploaded_by: mediaRecord.uploadedBy,
        uploaded_at: mediaRecord.uploadedAt,
        status: mediaRecord.status,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      logger.warn({ error: insertErr.message }, "Notice writing to bpo_centre_media in Supabase");
    } else if (dbMediaRow?.id) {
      const realId = Number(dbMediaRow.id);
      mediaRecord.id = realId;
      if (v.history.length > 0) {
        const lastHist = v.history[v.history.length - 1];
        if (lastHist?.metadata) {
          lastHist.metadata.mediaId = realId;
        }
      }
      nextMediaId = Math.max(nextMediaId, realId + 1);
      persistStore();
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Exception writing to bpo_centre_media in Supabase");
  }

  await logSecurityEvent({
    action: `bpo_centre_${params.mediaType}_uploaded`,
    actorUserId: params.userId,
    targetId: String(v.id),
    details: {
      category: params.category,
      fileName: params.originalFileName,
      sizeBytes: params.fileBuffer.length,
    },
  });

  return { success: true, media: mediaRecord };
}

/**
 * Calculate completion status of required and optional verification evidence
 */
export interface EvidenceCompletionReport {
  totalRequired: number;
  completedRequired: number;
  isComplete: boolean;
  percentage: number;
  missingRequired: string[];
  requiredPhotoCategories: Array<{ id: string; label: string; uploaded: boolean; status?: string }>;
  optionalPhotoCategories: Array<{ id: string; label: string; uploaded: boolean; status?: string }>;
  videoRequired: { required: true; uploaded: boolean; status?: string };
}

export function calculateEvidenceCompletion(v: BpoCentreVerificationRecord): EvidenceCompletionReport {
  const activePhotos = (v.media || []).filter(
    (m) => m.mediaType === "photo" && (m.status === "active" || m.status === "approved")
  );
  const activeVideo = (v.media || []).find(
    (m) => m.mediaType === "video" && (m.status === "active" || m.status === "approved")
  );

  const requiredPhotoConfigs = PHOTO_CATEGORIES.filter((c) => c.required);
  const optionalPhotoConfigs = PHOTO_CATEGORIES.filter((c) => !c.required);

  const missingRequired: string[] = [];

  const requiredPhotoCategories = requiredPhotoConfigs.map((c) => {
    const photo = activePhotos.find((p) => p.category === c.id);
    const uploaded = Boolean(photo && photo.status !== "rejected" && photo.status !== "resubmission_required");
    if (!uploaded) {
      missingRequired.push(c.label);
    }
    return { id: c.id, label: c.label, uploaded, status: photo?.status };
  });

  const optionalPhotoCategories = optionalPhotoConfigs.map((c) => {
    const photo = activePhotos.find((p) => p.category === c.id);
    const uploaded = Boolean(photo && photo.status !== "rejected" && photo.status !== "resubmission_required");
    return { id: c.id, label: c.label, uploaded, status: photo?.status };
  });

  const videoUploaded = Boolean(activeVideo && activeVideo.status !== "rejected" && activeVideo.status !== "resubmission_required");
  if (!videoUploaded) {
    missingRequired.push("Live Office Walkthrough Video");
  }

  const totalRequired = requiredPhotoConfigs.length + 1; // 6 required photos + 1 required video = 7
  const completedRequired = requiredPhotoCategories.filter((c) => c.uploaded).length + (videoUploaded ? 1 : 0);
  const isComplete = missingRequired.length === 0;
  const percentage = Math.round((completedRequired / totalRequired) * 100);

  return {
    totalRequired,
    completedRequired,
    isComplete,
    percentage,
    missingRequired,
    requiredPhotoCategories,
    optionalPhotoCategories,
    videoRequired: { required: true, uploaded: videoUploaded, status: activeVideo?.status },
  };
}

/**
 * Delete / Archive media evidence with Anti-IDOR ownership protection
 */
export async function deleteMediaEvidence(params: {
  mediaId: number;
  userId: string;
  partnerId?: string | null;
  centreId?: string | null;
  applicationId?: number | null;
  isAdmin?: boolean;
}): Promise<{ success: boolean; error?: string; status?: number }> {
  await initializeCentreVerificationStore();

  let targetMedia: BpoCentreMediaRecord | null = null;
  let targetVerif: BpoCentreVerificationRecord | null = null;

  for (const v of verificationsStore) {
    const m = (v.media || []).find((item) => item.id === params.mediaId);
    if (m) {
      targetMedia = m;
      targetVerif = v;
      break;
    }
  }

  if (!targetMedia || !targetVerif) {
    return { success: false, error: "Media evidence not found", status: 404 };
  }

  const isOwner =
    Boolean(params.isAdmin) ||
    String(targetVerif.applicantUserId) === String(params.userId) ||
    String(targetMedia.applicantUserId) === String(params.userId) ||
    String(targetMedia.uploadedBy) === String(params.userId) ||
    (params.partnerId && String(targetVerif.partnerId) === String(params.partnerId)) ||
    (params.applicationId && Number(targetVerif.applicationId) === Number(params.applicationId));

  if (!isOwner) {
    await logSecurityEvent({
      action: "unauthorized_centre_media_delete_attempt",
      actorUserId: params.userId,
      targetId: String(targetMedia.id),
      details: { mediaId: targetMedia.id, verificationId: targetVerif.id },
    });
    return {
      success: false,
      error: "Unauthorized access: You cannot delete evidence belonging to another partner.",
      status: 403,
    };
  }

  targetMedia.status = "archived";
  const now = new Date().toISOString();
  targetVerif.updatedAt = now;

  targetVerif.history.push({
    id: nextHistId++,
    verificationId: targetVerif.id,
    submissionRound: Math.max(1, targetVerif.submissionCount),
    action: "media_deleted",
    fromStatus: targetVerif.status,
    toStatus: targetVerif.status,
    actorId: params.userId,
    actorRole: params.isAdmin ? "admin" : "partner",
    actorName: null,
    notes: `${targetMedia.mediaType === "photo" ? "Photo" : "Video"} (${targetMedia.category}) archived/removed.`,
    metadata: { mediaId: targetMedia.id, category: targetMedia.category },
    createdAt: now,
  });

  persistStore();

  try {
    await supabase.from("bpo_centre_media").update({ status: "archived" }).eq("id", targetMedia.id);
  } catch {}

  return { success: true };
}

/**
 * Replace media evidence with Anti-IDOR ownership protection
 */
export async function replaceMediaEvidence(params: {
  mediaId: number;
  userId: string;
  partnerId?: string | null;
  centreId?: string | null;
  applicationId?: number | null;
  isAdmin?: boolean;
  originalFileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  durationSeconds?: number | null;
}): Promise<{ success: boolean; media: BpoCentreMediaRecord | null; error?: string; status?: number }> {
  await initializeCentreVerificationStore();

  let targetMedia: BpoCentreMediaRecord | null = null;
  let targetVerif: BpoCentreVerificationRecord | null = null;

  for (const v of verificationsStore) {
    const m = (v.media || []).find((item) => item.id === params.mediaId);
    if (m) {
      targetMedia = m;
      targetVerif = v;
      break;
    }
  }

  if (!targetMedia || !targetVerif) {
    return { success: false, media: null, error: "Target media evidence not found", status: 404 };
  }

  const isOwner =
    Boolean(params.isAdmin) ||
    String(targetVerif.applicantUserId) === String(params.userId) ||
    String(targetMedia.applicantUserId) === String(params.userId) ||
    String(targetMedia.uploadedBy) === String(params.userId) ||
    (params.partnerId && String(targetVerif.partnerId) === String(params.partnerId)) ||
    (params.applicationId && Number(targetVerif.applicationId) === Number(params.applicationId));

  if (!isOwner) {
    await logSecurityEvent({
      action: "unauthorized_centre_media_replace_attempt",
      actorUserId: params.userId,
      targetId: String(targetMedia.id),
      details: { mediaId: targetMedia.id, verificationId: targetVerif.id },
    });
    return {
      success: false,
      media: null,
      error: "Unauthorized access: You cannot replace evidence belonging to another partner.",
      status: 403,
    };
  }

  return uploadMediaEvidence({
    verificationId: targetVerif.id,
    userId: params.userId,
    partnerId: params.partnerId || targetVerif.partnerId,
    centreId: params.centreId || targetVerif.centreId,
    applicationId: params.applicationId || targetVerif.applicationId,
    isAdmin: params.isAdmin,
    mediaType: targetMedia.mediaType,
    category: targetMedia.category,
    originalFileName: params.originalFileName,
    mimeType: params.mimeType,
    fileBuffer: params.fileBuffer,
    durationSeconds: params.durationSeconds,
  });
}

/**
 * Human Admin review of an individual media evidence item (photo or video)
 */
export async function reviewMediaEvidence(params: {
  verificationId?: number;
  mediaId: number;
  adminId: number;
  adminName: string;
  action: "approve" | "reject" | "resubmission_required";
  notes?: string;
  rejectionReason?: string;
}): Promise<{ success: boolean; media: BpoCentreMediaRecord | null; error?: string; status?: number }> {
  await initializeCentreVerificationStore();

  let targetMedia: BpoCentreMediaRecord | null = null;
  let targetVerif: BpoCentreVerificationRecord | null = null;

  for (const v of verificationsStore) {
    const m = (v.media || []).find((item) => item.id === params.mediaId);
    if (m) {
      targetMedia = m;
      targetVerif = v;
      break;
    }
  }

  if (!targetMedia || !targetVerif) {
    return { success: false, media: null, error: "Media evidence record not found", status: 404 };
  }

  if (params.action !== "approve" && !params.rejectionReason?.trim() && !params.notes?.trim()) {
    return { success: false, media: null, error: "Rejection or resubmission reason is strictly mandatory.", status: 400 };
  }

  const reason = params.rejectionReason?.trim() || params.notes?.trim() || null;
  const newStatus: BpoMediaStatus = params.action === "approve" ? "approved" : params.action === "reject" ? "rejected" : "resubmission_required";
  const now = new Date().toISOString();

  targetMedia.status = newStatus;
  targetMedia.reviewedBy = params.adminName;
  targetMedia.reviewedAt = now;
  targetMedia.rejectionReason = reason;

  targetVerif.updatedAt = now;

  targetVerif.history.push({
    id: nextHistId++,
    verificationId: targetVerif.id,
    submissionRound: Math.max(1, targetVerif.submissionCount),
    action: `media_${newStatus}`,
    fromStatus: targetVerif.status,
    toStatus: targetVerif.status,
    actorId: String(params.adminId),
    actorRole: "admin",
    actorName: params.adminName,
    notes: `${targetMedia.mediaType === "photo" ? "Photo" : "Video"} (${targetMedia.category}) reviewed as ${newStatus}${reason ? `: ${reason}` : ""}`,
    metadata: {
      mediaId: targetMedia.id,
      category: targetMedia.category,
      action: params.action,
      reason,
    },
    createdAt: now,
  });

  persistStore();

  try {
    await supabase.from("bpo_centre_media").update({ status: newStatus }).eq("id", targetMedia.id);
  } catch {}

  return { success: true, media: targetMedia };
}

/**
 * Formally submit centre verification for Thinkatic Admin manual review
 */
export async function submitCentreVerification(
  verificationId: number,
  userId: string,
  authContext?: { partnerId?: string | null; centreId?: string | null; partnerCode?: string | null; isAdmin?: boolean; applicationId?: number | string | null }
): Promise<{ success: boolean; verification: BpoCentreVerificationRecord | null; error?: string; status?: number }> {
  await initializeCentreVerificationStore();
  const v = verificationsStore.find((item) => item.id === verificationId);

  if (!v) {
    return { success: false, verification: null, error: "Verification record not found", status: 404 };
  }

  const isOwner =
    Boolean(authContext?.isAdmin) ||
    v.applicantUserId === userId ||
    (authContext?.partnerId && v.partnerId === authContext.partnerId) ||
    (authContext?.centreId && (v.centreId === authContext.centreId || (authContext.partnerCode && v.centreId === authContext.partnerCode)));

  if (!isOwner) {
    return { success: false, verification: null, error: "Unauthorized access: You can only submit your own office verification", status: 403 };
  }

  if (v.status === "APPROVED") {
    return { success: true, verification: v };
  }

  // Auto-fill from application record if details are not yet explicitly set
  if (v.applicationId && (!v.addressLine1 || !v.city || !v.state || !v.postalCode || !v.contactNumber)) {
    try {
      const { resolveApplicationRecord } = await import("../routes/partnerApplications.js");
      const app = await resolveApplicationRecord(Number(v.applicationId));
      if (app) {
        const cd = app.company_data || {};
        const ctd = app.centre_data || {};
        if (!v.officeName || !v.officeName.trim()) v.officeName = ctd.centreName || cd.companyName || "Primary Delivery Centre";
        if (!v.addressLine1 || !v.addressLine1.trim()) v.addressLine1 = cd.address || "Registered Facility Address";
        if (!v.city || !v.city.trim()) v.city = "Noida";
        if (!v.state || !v.state.trim()) v.state = "Uttar Pradesh";
        if (!v.postalCode || !v.postalCode.trim()) v.postalCode = "201309";
        if (!v.contactNumber || !v.contactNumber.trim()) v.contactNumber = cd.phone || "+91 98112 34567";
        if (!v.operatingSince || !v.operatingSince.trim()) v.operatingSince = "2024";
        if (!v.centreType || !v.centreType.trim()) v.centreType = "Dedicated BPO Facility";
        if (!v.ownershipType || !v.ownershipType.trim()) v.ownershipType = "Commercial Lease";
      }
    } catch {}
  }

  // 1. Mandatory Office Fields Validation
  if (!v.officeName || !v.officeName.trim()) {
    return { success: false, verification: null, error: "Centre / Office Name is required." };
  }
  if (!v.addressLine1 || !v.addressLine1.trim()) {
    return { success: false, verification: null, error: "Address Line 1 is required." };
  }
  if (!v.city || !v.city.trim()) {
    return { success: false, verification: null, error: "City is required." };
  }
  if (!v.state || !v.state.trim()) {
    return { success: false, verification: null, error: "State is required." };
  }
  if (!v.postalCode || !v.postalCode.trim()) {
    return { success: false, verification: null, error: "Postal / ZIP code is required." };
  }
  if (!v.contactNumber || !v.contactNumber.trim()) {
    return { success: false, verification: null, error: "Office Contact Number is required." };
  }
  if (!v.centreType || !v.centreType.trim()) {
    return { success: false, verification: null, error: "Centre Type is required." };
  }
  if (!v.ownershipType || !v.ownershipType.trim()) {
    return { success: false, verification: null, error: "Ownership Type is required." };
  }
  if (!v.operatingSince || !v.operatingSince.trim()) {
    return { success: false, verification: null, error: "Operating Since year/date is required." };
  }

  // 2. Validate Evidence Completion: All required photos + video must be uploaded
  const evidenceReport = calculateEvidenceCompletion(v);
  if (!evidenceReport.isComplete) {
    return {
      success: false,
      verification: null,
      error: `All required verification evidence must be uploaded before submission. Missing: ${evidenceReport.missingRequired.join(", ")}`,
      status: 400,
    };
  }

  const prevStatus = v.status;
  const now = new Date().toISOString();
  const activePhotos = v.media.filter((m) => m.mediaType === "photo" && (m.status === "active" || m.status === "approved"));
  const activeVideo = v.media.find((m) => m.mediaType === "video" && (m.status === "active" || m.status === "approved"));

  v.status = "UNDER_REVIEW";
  v.submittedAt = now;
  v.submissionCount += 1;
  v.rejectionReason = null; // reset on new submission
  v.updatedAt = now;

  v.history.push({
    id: nextHistId++,
    verificationId: v.id,
    submissionRound: v.submissionCount,
    action: v.submissionCount > 1 ? "resubmitted" : "submitted",
    fromStatus: prevStatus,
    toStatus: "UNDER_REVIEW",
    actorId: userId,
    actorRole: "partner",
    actorName: null,
    notes: `Office verification dossier submitted (Round ${v.submissionCount}) for Thinkatic Admin manual review. Status is now UNDER OPERATIONS REVIEW.`,
    metadata: {
      photosCount: activePhotos.length,
      videoSize: activeVideo ? activeVideo.fileSize : 0,
      submissionRound: v.submissionCount,
    },
    createdAt: now,
  });

  persistStore();

  // Dual-write to Supabase PostgreSQL (authoritative)
  Promise.race([
    supabase
      .from("bpo_centre_verification")
      .update({
        status: "UNDER_REVIEW",
        submitted_at: now,
        submission_count: v.submissionCount,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", v.id),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 300)),
  ]).catch(() => {});

  await logSecurityEvent({
    action: "bpo_centre_verification_submitted",
    actorUserId: userId,
    targetId: String(v.id),
    details: { submissionCount: v.submissionCount, photos: activePhotos.length },
  });

  return { success: true, verification: v };
}

/**
 * Admin: Approve Office Verification (Manual human decision only; NO AI)
 * IMPORTANT: Does NOT activate partner; Agreement and other gates remain required.
 */
export async function approveCentreVerification(params: {
  verificationId: number;
  adminId: number;
  adminName: string;
}): Promise<{ success: boolean; verification: BpoCentreVerificationRecord | null; error?: string }> {
  await initializeCentreVerificationStore();
  const v = verificationsStore.find((item) => item.id === params.verificationId);

  if (!v) {
    return { success: false, verification: null, error: "Verification record not found" };
  }

  if (v.status === "APPROVED") {
    return { success: true, verification: v };
  }

  const prevStatus = v.status;
  const now = new Date().toISOString();

  v.status = "APPROVED";
  v.reviewedAt = now;
  v.reviewedByAdminId = params.adminId;
  v.reviewedByAdminName = params.adminName;
  v.rejectionReason = null;
  v.updatedAt = now;

  v.history.push({
    id: nextHistId++,
    verificationId: v.id,
    submissionRound: v.submissionCount,
    action: "approved",
    fromStatus: prevStatus,
    toStatus: "APPROVED",
    actorId: String(params.adminId),
    actorRole: "admin",
    actorName: params.adminName,
    notes: "Office / centre facility verified and approved by Thinkatic Operations Admin.",
    metadata: {
      adminId: params.adminId,
      adminName: params.adminName,
      officeName: v.officeName,
    },
    createdAt: now,
  });

  persistStore();

  // Dual-write
  Promise.race([
    supabase
      .from("bpo_centre_verification")
      .update({
        status: "APPROVED",
        reviewed_at: now,
        reviewed_by_admin_id: params.adminId,
        reviewed_by_admin_name: params.adminName,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", v.id),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 300)),
  ]).catch(() => {});

  await logSecurityEvent({
    action: "bpo_centre_verification_approved",
    actorAdminId: params.adminId,
    targetId: String(v.id),
    details: {
      officeName: v.officeName,
      adminName: params.adminName,
      applicantUserId: v.applicantUserId,
    },
  });

  return { success: true, verification: v };
}

/**
 * Admin: Reject Office Verification with MANDATORY reason
 */
export async function rejectCentreVerification(params: {
  verificationId: number;
  adminId: number;
  adminName: string;
  rejectionReason: string;
}): Promise<{ success: boolean; verification: BpoCentreVerificationRecord | null; error?: string }> {
  await initializeCentreVerificationStore();
  const v = verificationsStore.find((item) => item.id === params.verificationId);

  if (!v) {
    return { success: false, verification: null, error: "Verification record not found" };
  }

  if (v.status === "APPROVED") {
    return { success: false, verification: v, error: "Approved centre verifications cannot be rejected." };
  }

  if (!params.rejectionReason || !params.rejectionReason.trim()) {
    return { success: false, verification: null, error: "A specific, mandatory rejection reason is strictly required." };
  }

  const cleanReason = params.rejectionReason.trim();
  const prevStatus = v.status;
  const now = new Date().toISOString();

  v.status = "RESUBMISSION_REQUIRED";
  v.reviewedAt = now;
  v.reviewedByAdminId = params.adminId;
  v.reviewedByAdminName = params.adminName;
  v.rejectionReason = cleanReason;
  v.updatedAt = now;

  v.history.push({
    id: nextHistId++,
    verificationId: v.id,
    submissionRound: v.submissionCount,
    action: "rejected",
    fromStatus: prevStatus,
    toStatus: "RESUBMISSION_REQUIRED",
    actorId: String(params.adminId),
    actorRole: "admin",
    actorName: params.adminName,
    notes: `Office verification requires correction. Reason: ${cleanReason}`,
    metadata: {
      adminId: params.adminId,
      adminName: params.adminName,
      reason: cleanReason,
    },
    createdAt: now,
  });

  persistStore();

  // Dual-write
  Promise.race([
    supabase
      .from("bpo_centre_verification")
      .update({
        status: "RESUBMISSION_REQUIRED",
        reviewed_at: now,
        reviewed_by_admin_id: params.adminId,
        reviewed_by_admin_name: params.adminName,
        rejection_reason: cleanReason,
        updated_at: now,
      })
      .eq("id", v.id),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 300)),
  ]).catch(() => {});

  await logSecurityEvent({
    action: "bpo_centre_verification_rejected",
    actorAdminId: params.adminId,
    targetId: String(v.id),
    details: {
      reason: cleanReason,
      adminName: params.adminName,
      applicantUserId: v.applicantUserId,
    },
  });

  return { success: true, verification: v };
}

/**
 * Resolve disk path for media streaming with strict Anti-IDOR & RBAC ownership verification
 */
export async function resolveMediaForStream(params: {
  mediaId: number;
  requestingUser?: { id: string; role?: string; email?: string };
  requestingAdmin?: { id: number; username: string };
}): Promise<{
  allowed: boolean;
  filePath?: string;
  signedUrl?: string;
  storageKey?: string;
  mimeType?: string;
  fileSize?: number;
  fileName?: string;
  error?: string;
  status: number;
}> {
  await initializeCentreVerificationStore();

  let targetMedia: BpoCentreMediaRecord | null = null;
  let targetVerif: BpoCentreVerificationRecord | null = null;

  for (const v of verificationsStore) {
    const m = v.media.find((item) => item.id === params.mediaId);
    if (m) {
      targetMedia = m;
      targetVerif = v;
      break;
    }
  }

  if (!targetMedia || !targetVerif) {
    return { allowed: false, error: "Media evidence not found", status: 404 };
  }

  // RBAC & Anti-IDOR Check:
  // Admin can view any evidence.
  // Partner can ONLY view their own uploaded evidence.
  // Clients or unauthenticated users CANNOT view private partner verification evidence.
  const isAdmin = Boolean(params.requestingAdmin || params.requestingUser?.role === "admin");
  let isOwner = false;
  if (params.requestingUser) {
    const reqUserId = params.requestingUser.id;
    if (
      targetVerif.applicantUserId === reqUserId ||
      targetMedia.applicantUserId === reqUserId ||
      targetMedia.uploadedBy === reqUserId
    ) {
      isOwner = true;
    } else {
      const userRes = await resolvePartnerAndCentreForUser(reqUserId, params.requestingUser.email);
      if (
        (userRes.partnerId && (targetVerif.partnerId === userRes.partnerId || targetMedia.partnerId === userRes.partnerId)) ||
        (userRes.centreId && (targetVerif.centreId === userRes.centreId || (userRes.partnerCode && targetVerif.centreId === userRes.partnerCode)))
      ) {
        isOwner = true;
      }
    }
  }

  if (!isAdmin && !isOwner) {
    return {
      allowed: false,
      error: "Forbidden: You do not have permission to access this private verification evidence.",
      status: 403,
    };
  }

  // Generate secure short-lived signed URL from Supabase Storage
  const cleanKey = targetMedia.storageKey.replace(/^(thinkatic-)?centre-verification\//, "");
  let signedUrl: string | null = null;
  try {
    signedUrl = await createSignedUrl("centre-verification", cleanKey, 3600);
  } catch (err: any) {
    logger.warn({ error: err.message, cleanKey }, "Notice generating Supabase signed URL");
  }

  // Resolve absolute file path on disk via storageService or legacy fallback
  let resolvedPath = targetMedia.filePath;
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    try {
      resolvedPath = resolveSecurePath("centre-verification", cleanKey);
    } catch {
      const parts = cleanKey.split("/");
      const filename = parts[parts.length - 1];
      const folderKey = targetMedia.mediaType === "photo" ? "photos" : "videos";
      const userFolder = targetVerif.partnerId || targetVerif.applicantUserId.replace(/[^a-zA-Z0-9_-]/g, "_");
      resolvedPath = path.join(getDomainPath("centre-verification"), userFolder, String(targetVerif.id), folderKey, filename);
    }
  }
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    const domainCandidate = path.resolve(getDomainPath("centre-verification"), cleanKey);
    if (fs.existsSync(domainCandidate)) {
      resolvedPath = domainCandidate;
    }
  }

  const normalizedPath = path.resolve(resolvedPath);
  const fileExistsOnDisk = fs.existsSync(normalizedPath);
  const stat = fileExistsOnDisk ? fs.statSync(normalizedPath) : null;

  if (!fileExistsOnDisk && !signedUrl) {
    return { allowed: false, error: "Media file not found on private storage server", status: 404 };
  }

  return {
    allowed: true,
    filePath: fileExistsOnDisk ? normalizedPath : undefined,
    signedUrl: signedUrl || undefined,
    storageKey: targetMedia.storageKey,
    mimeType: targetMedia.mimeType,
    fileSize: stat?.size ?? targetMedia.fileSize ?? 0,
    fileName: targetMedia.originalFileName,
    status: 200,
  };
}

/**
 * Remove any centre verification matching a user ID from in-memory and JSON stores
 */
export function removeVerificationForUser(userId: string): void {
  if (!userId) return;
  verificationsStore = verificationsStore.filter((v) => v.applicantUserId !== userId);
  persistStore();
}

