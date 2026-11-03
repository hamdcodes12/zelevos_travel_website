import { Router, type Request, type Response, type NextFunction } from "express";
import { supabase } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { logSecurityEvent, sanitizeString } from "../lib/security.js";
import {
  runDeterministicMatching,
  evaluateCentreEligibility,
  type CandidateCentreProfile,
  type CapacityRequirementCriteria,
  type MatchEvaluationResult,
} from "../lib/capacityMatchingEngine.js";
import { bpoStore, type BpoProjectRecord } from "./bpoProjects.js";
import { resolvePartnerForUser } from "./bpoOperations.js";
import { resolveClientForUser, clientsStore, type AuthenticatedClientContext } from "./bpoClientPortal.js";
import { requireFeature } from "./featureControl.js";

const router = Router();

type UserRequest = Request & { user?: { id: string; email: string; role?: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ success: false, error: message, message, details });
}

function parseNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BpoCentreCapacityRecord {
  id: number;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  partner_name: string;
  partner_status: string;
  centre_status: string;
  location: string;
  total_seats: number;
  operational_seats: number;
  occupied_seats: number;
  reserved_seats: number;
  available_seats: number;
  utilization_percentage: number;
  available_from: string; // YYYY-MM-DD
  minimum_commitment: number;
  maximum_commitment: number;
  supported_processes: string[];
  supported_channels: string[];
  supported_languages: string[];
  supported_timezones: string[];
  supported_shifts: string[];
  working_days: string[];
  capacity_status: "AVAILABLE" | "LIMITED" | "FULL" | "TEMPORARILY_UNAVAILABLE" | "INACTIVE";
  last_updated_at: string;
  created_at: string;
}

export interface BpoCapacityRequirementRecord {
  id: number;
  requirement_code: string; // THK-REQ-00001
  client_id: string;
  client_name: string;
  project_id?: number | null;
  title: string;
  required_seats: number;
  process_type: string;
  channels: string[];
  languages: string[];
  timezone: string;
  shift: string;
  location_requirement: string;
  start_date: string; // YYYY-MM-DD
  expected_duration_months: number;
  minimum_experience_years: number;
  certification_requirements: string[];
  compliance_requirements: string[];
  working_days: string;
  notes: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "MATCHING" | "MATCHED" | "ALLOCATED" | "CANCELLED" | "CLOSED";
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BpoCapacityMatchRecord {
  id: number;
  match_code: string; // THK-MAT-00001
  requirement_id: number;
  requirement_code: string;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  partner_name: string;
  matched_capacity: number;
  matching_criteria: MatchEvaluationResult | any;
  match_status: "PROPOSED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";
  decision_source: "HUMAN_OPERATIONS";
  selected_by: number | null;
  selected_at: string | null;
  decision_notes: string | null;
  score_type: "INFORMATIONAL_COMPATIBILITY";
  automatic_selection: false;
  created_by_admin_id?: number | null;
  reviewed_by_admin_id?: number | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  internal_notes?: string | null;
  created_at: string;
}

export interface BpoCapacityReservationRecord {
  id: number;
  reservation_code: string; // THK-RES-00001
  requirement_id: number;
  requirement_code: string;
  match_id: number;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  partner_name: string;
  reserved_seats: number;
  status: "ACTIVE" | "CONVERTED" | "RELEASED" | "EXPIRED";
  reservation_start: string;
  reservation_expires_at: string;
  released_at?: string | null;
  release_reason?: string | null;
  created_by_admin_id?: number | null;
  created_at: string;
}

export interface BpoCapacityHistoryRecord {
  id: number;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  timestamp: string;
  changed_by: string;
  total_seats: number;
  operational_seats: number;
  occupied_seats: number;
  reserved_seats: number;
  available_seats: number;
  utilization_percentage: number;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORES
// ─────────────────────────────────────────────────────────────────────────────

export const centreCapacityStore = new Map<number, BpoCentreCapacityRecord>();
export const capacityRequirementsStore = new Map<number, BpoCapacityRequirementRecord>();
export const capacityMatchesStore = new Map<number, BpoCapacityMatchRecord>();
export const capacityReservationsStore = new Map<number, BpoCapacityReservationRecord>();
export const capacityHistoryStore: BpoCapacityHistoryRecord[] = [];

let nextReqId = 100;
let nextMatchId = 100;
let nextResId = 100;
let nextHistoryId = 100;

export function recordCapacityHistory(entry: Omit<BpoCapacityHistoryRecord, "id">) {
  const id = ++nextHistoryId;
  capacityHistoryStore.unshift({ id, ...entry });
}

function padCode(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(5, "0")}`;
}

// ── Server-Side Capacity Arithmetic ──
export function calculateAvailableSeats(operational: number, occupied: number, reserved: number): number {
  return Math.max(0, operational - occupied - reserved);
}

export function calculateUtilization(operational: number, occupied: number): number {
  if (operational <= 0) return 0.0;
  return Math.round((occupied / operational) * 10000) / 100;
}

// ── Audit Logging Helper ──
async function logCapacityAuditEvent(params: {
  actorUserId?: string | null;
  actorAdminId?: number | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}) {
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: params.actorUserId || null,
      actor_admin_id: params.actorAdminId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata || {},
    });
  } catch (err) {
    logger.warn({ err }, "Capacity audit log DB insert non-fatal error");
  }
}

// ── CSV Formula Injection Escaper ──
function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str}"`;
}

// ── Initialize Seed Data ──
function initCapacitySeeds() {
  if (centreCapacityStore.size > 0) return;

  const partner1Id = "00000000-0000-0000-0000-000000000001";
  const partner2Id = "00000000-0000-0000-0000-000000000002";
  const clientAId = "00000000-0000-0000-0000-000000000101";
  const clientBId = "00000000-0000-0000-0000-000000000102";

  // Centre 1 (Partner 1): Delhi Delivery Hub
  centreCapacityStore.set(1, {
    id: 1,
    centre_id: 1,
    centre_name: "GlobalConnect Delhi Hub",
    partner_id: partner1Id,
    partner_name: "GlobalConnect BPO Network",
    partner_status: "active",
    centre_status: "active",
    location: "New Delhi, India",
    total_seats: 250,
    operational_seats: 200,
    occupied_seats: 120,
    reserved_seats: 20,
    available_seats: 60,
    utilization_percentage: 60.0,
    available_from: "2026-10-01",
    minimum_commitment: 10,
    maximum_commitment: 150,
    supported_processes: ["Customer Support", "Inbound Voice", "Technical Support", "Email & Chat"],
    supported_channels: ["Voice", "Email", "Chat"],
    supported_languages: ["English", "Hindi"],
    supported_timezones: ["UTC-5 (EST)", "UTC+0 (GMT)", "UTC+5:30 (IST)"],
    supported_shifts: ["US Shift (EST)", "UK Shift (GMT)", "24/7 Rotational"],
    working_days: ["Mon-Fri", "24/7 Rotational"],
    capacity_status: "AVAILABLE",
    last_updated_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  });

  // Centre 2 (Partner 2): Manila Delivery Hub
  centreCapacityStore.set(2, {
    id: 2,
    centre_id: 2,
    centre_name: "AuraCare Manila Hub",
    partner_id: partner2Id,
    partner_name: "AuraCare Delivery Solutions",
    partner_status: "active",
    centre_status: "active",
    location: "Manila, Philippines",
    total_seats: 180,
    operational_seats: 150,
    occupied_seats: 120,
    reserved_seats: 10,
    available_seats: 20,
    utilization_percentage: 80.0,
    available_from: "2026-10-15",
    minimum_commitment: 5,
    maximum_commitment: 80,
    supported_processes: ["Customer Support", "Telehealth Support", "Inbound Voice", "Email & Chat"],
    supported_channels: ["Voice", "Email", "Chat"],
    supported_languages: ["English", "Tagalog"],
    supported_timezones: ["UTC-5 (EST)", "UTC-8 (PST)"],
    supported_shifts: ["US Shift (EST)", "US Shift (PST)"],
    working_days: ["Mon-Fri"],
    capacity_status: "LIMITED",
    last_updated_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  });

  // Centre 3 (Partner 1): Bangalore Tech Support Centre
  centreCapacityStore.set(3, {
    id: 3,
    centre_id: 3,
    centre_name: "Apex Tech Bangalore Hub",
    partner_id: partner1Id,
    partner_name: "GlobalConnect BPO Network",
    partner_status: "active",
    centre_status: "active",
    location: "Bangalore, India",
    total_seats: 120,
    operational_seats: 100,
    occupied_seats: 40,
    reserved_seats: 0,
    available_seats: 60,
    utilization_percentage: 40.0,
    available_from: "2026-09-25",
    minimum_commitment: 10,
    maximum_commitment: 80,
    supported_processes: ["Technical Support", "Fintech Helpdesk", "Customer Support", "Backoffice"],
    supported_channels: ["Voice", "Chat", "Email", "Ticketing"],
    supported_languages: ["English"],
    supported_timezones: ["UTC-5 (EST)", "UTC+0 (GMT)", "UTC+5:30 (IST)"],
    supported_shifts: ["24/7 Rotational", "US Shift (EST)"],
    working_days: ["Mon-Fri", "24/7"],
    capacity_status: "AVAILABLE",
    last_updated_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  });

  // Seed Baseline Client Requirement 1: Client A (Submitted)
  const req1Id = 1;
  const req1Code = padCode("THK-REQ", 1);
  capacityRequirementsStore.set(req1Id, {
    id: req1Id,
    requirement_code: req1Code,
    client_id: clientAId,
    client_name: "Aura Health Enterprises Inc.",
    title: "US Telehealth Patient Scheduling & Care Navigation",
    required_seats: 50,
    process_type: "Customer Support",
    channels: ["Voice", "Email"],
    languages: ["English"],
    timezone: "UTC-5 (EST)",
    shift: "US Shift (EST)",
    location_requirement: "Any",
    start_date: "2026-10-15",
    expected_duration_months: 12,
    minimum_experience_years: 2,
    certification_requirements: ["HIPAA Compliance"],
    compliance_requirements: ["PCI-DSS", "ISO 27001"],
    working_days: "Mon-Fri",
    notes: "Requires dedicated verified floor and English voice agents with US healthcare experience.",
    status: "SUBMITTED",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  });

  // Seed Baseline Client Requirement 2: Client B (Draft)
  const req2Id = 2;
  const req2Code = padCode("THK-REQ", 2);
  capacityRequirementsStore.set(req2Id, {
    id: req2Id,
    requirement_code: req2Code,
    client_id: clientBId,
    client_name: "Helios Renewable Energy Ltd",
    title: "UK Solar Queries & Multichannel Assistance",
    required_seats: 15,
    process_type: "Customer Support",
    channels: ["Chat", "Email"],
    languages: ["English"],
    timezone: "UTC+0 (GMT)",
    shift: "UK Shift (GMT)",
    location_requirement: "Any",
    start_date: "2026-11-01",
    expected_duration_months: 6,
    minimum_experience_years: 1,
    certification_requirements: [],
    compliance_requirements: ["GDPR Compliance"],
    working_days: "Mon-Fri",
    notes: "Draft initial requirement for upcoming Q4 solar push.",
    status: "DRAFT",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Seed Proposed Match 1 for Partner 1 Centre 1
  const match1Id = 1;
  const match1Code = padCode("THK-MAT", match1Id);
  capacityMatchesStore.set(match1Id, {
    id: match1Id,
    match_code: match1Code,
    requirement_id: req1Id,
    requirement_code: req1Code,
    centre_id: 1,
    centre_name: "GlobalConnect Delhi Hub",
    partner_id: partner1Id,
    partner_name: "GlobalConnect BPO Network",
    matched_capacity: 50,
    matching_criteria: {
      isEligible: true,
      score: 96,
      capacityCheck: { passed: true, details: "Available capacity (60) meets required 50 seats" },
      processCheck: { passed: true, details: "Process 'Customer Support' is fully verified" },
      channelCheck: { passed: true, details: "Channels ['Voice', 'Email'] supported" },
      languageCheck: { passed: true, details: "Language 'English' supported" },
      shiftCheck: { passed: true, details: "Shift 'US Shift (EST)' configured and staffed" },
      verificationCheck: { passed: true, details: "Centre is fully active and verified" },
    },
    match_status: "PROPOSED",
    decision_source: "HUMAN_OPERATIONS",
    selected_by: 1,
    selected_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    decision_notes: "Evaluated during Q3 Operations matching run. 100% criteria compliance.",
    score_type: "INFORMATIONAL_COMPATIBILITY",
    automatic_selection: false,
    created_by_admin_id: 1,
    internal_notes: "Recommended candidate for client review.",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  });

  // Seed Active Reservation 1 for Partner 1 Centre 1
  const res1Id = 1;
  const res1Code = padCode("THK-RES", res1Id);
  capacityReservationsStore.set(res1Id, {
    id: res1Id,
    reservation_code: res1Code,
    requirement_id: req1Id,
    requirement_code: req1Code,
    match_id: match1Id,
    centre_id: 1,
    centre_name: "GlobalConnect Delhi Hub",
    partner_id: partner1Id,
    partner_name: "GlobalConnect BPO Network",
    reserved_seats: 20,
    status: "ACTIVE",
    reservation_start: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
    reservation_expires_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    created_by_admin_id: 1,
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  });

  // Seed Historical Snapshots for Partner 1 (Today, 7d, 30d, 60d, 90d)
  if (capacityHistoryStore.length === 0) {
    capacityHistoryStore.push(
      {
        id: 1,
        centre_id: 1,
        centre_name: "GlobalConnect Delhi Hub",
        partner_id: partner1Id,
        timestamp: new Date().toISOString(),
        changed_by: "Operations Admin",
        total_seats: 250,
        operational_seats: 200,
        occupied_seats: 120,
        reserved_seats: 20,
        available_seats: 60,
        utilization_percentage: 60.0,
        reason: "Authoritative capacity audit snapshot",
      },
      {
        id: 2,
        centre_id: 1,
        centre_name: "GlobalConnect Delhi Hub",
        partner_id: partner1Id,
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        changed_by: "System Operations",
        total_seats: 250,
        operational_seats: 200,
        occupied_seats: 120,
        reserved_seats: 20,
        available_seats: 60,
        utilization_percentage: 60.0,
        reason: "Active reservation THK-RES-00001 committed (20 seats)",
      },
      {
        id: 3,
        centre_id: 1,
        centre_name: "GlobalConnect Delhi Hub",
        partner_id: partner1Id,
        timestamp: new Date(Date.now() - 30 * 86400000).toISOString(),
        changed_by: "Client Project Start",
        total_seats: 250,
        operational_seats: 200,
        occupied_seats: 120,
        reserved_seats: 0,
        available_seats: 80,
        utilization_percentage: 60.0,
        reason: "Patient Scheduling campaign launched (+40 occupied)",
      },
      {
        id: 4,
        centre_id: 1,
        centre_name: "GlobalConnect Delhi Hub",
        partner_id: partner1Id,
        timestamp: new Date(Date.now() - 60 * 86400000).toISOString(),
        changed_by: "Partner Admin",
        total_seats: 250,
        operational_seats: 200,
        occupied_seats: 80,
        reserved_seats: 0,
        available_seats: 120,
        utilization_percentage: 40.0,
        reason: "Floor expansion: +50 operational workstations commissioned",
      },
      {
        id: 5,
        centre_id: 1,
        centre_name: "GlobalConnect Delhi Hub",
        partner_id: partner1Id,
        timestamp: new Date(Date.now() - 90 * 86400000).toISOString(),
        changed_by: "Centre Auditor",
        total_seats: 250,
        operational_seats: 150,
        occupied_seats: 80,
        reserved_seats: 0,
        available_seats: 70,
        utilization_percentage: 53.3,
        reason: "Baseline centre physical capacity verification",
      },
      {
        id: 6,
        centre_id: 3,
        centre_name: "Apex Tech Bangalore Hub",
        partner_id: partner1Id,
        timestamp: new Date().toISOString(),
        changed_by: "Operations Admin",
        total_seats: 120,
        operational_seats: 100,
        occupied_seats: 40,
        reserved_seats: 0,
        available_seats: 60,
        utilization_percentage: 40.0,
        reason: "Authoritative capacity audit snapshot",
      },
      {
        id: 7,
        centre_id: 3,
        centre_name: "Apex Tech Bangalore Hub",
        partner_id: partner1Id,
        timestamp: new Date(Date.now() - 30 * 86400000).toISOString(),
        changed_by: "Partner Admin",
        total_seats: 120,
        operational_seats: 100,
        occupied_seats: 40,
        reserved_seats: 0,
        available_seats: 60,
        utilization_percentage: 40.0,
        reason: "Monthly operational reconciliation",
      }
    );
  }
}

initCapacitySeeds();

// Helper to convert internal centre profile to candidate profile for engine
function toCandidateProfile(cap: BpoCentreCapacityRecord): CandidateCentreProfile {
  return {
    centreId: cap.centre_id,
    centreName: cap.centre_name,
    partnerId: cap.partner_id,
    partnerName: cap.partner_name,
    partnerStatus: cap.partner_status,
    centreStatus: cap.centre_status,
    location: cap.location,
    totalSeats: cap.total_seats,
    operationalSeats: cap.operational_seats,
    occupiedSeats: cap.occupied_seats,
    reservedSeats: cap.reserved_seats,
    availableSeats: cap.available_seats,
    utilizationPercentage: cap.utilization_percentage,
    capacityStatus: cap.capacity_status,
    availableFrom: cap.available_from,
    minimumCommitment: cap.minimum_commitment,
    maximumCommitment: cap.maximum_commitment,
    supportedProcesses: cap.supported_processes,
    supportedChannels: cap.supported_channels,
    supportedLanguages: cap.supported_languages,
    supportedTimezones: cap.supported_timezones,
    supportedShifts: cap.supported_shifts,
    workingDays: cap.working_days,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: BPO CENTRE CAPACITY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/bpo/capacity
 * Fetches the capacity profile for the authenticated partner's centres.
 * RBAC: Centre Owner / Partner Admin / Operations Manager. Agents forbidden.
 */
router.get("/bpo/capacity", requireFeature("bpo_capacity_marketplace"), requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const partnerCtx = await resolvePartnerForUser(req.user!.id);
    if (!partnerCtx) {
      return fail(res, 403, "Access restricted to authenticated BPO partner personnel.");
    }
    const userRole = (req.user as any)?.role || partnerCtx.role;
    if (userRole === "agent") {
      return fail(res, 403, "Agents are not authorized to access or manage centre capacity.");
    }

    // Filter centres belonging to this partner
    let profiles = Array.from(centreCapacityStore.values()).filter(
      (c) => c.partner_id === partnerCtx.partnerId
    );

    if (profiles.length === 0) {
      try {
        const { data: dbCentres } = await supabase
          .from("bpo_centres")
          .select("*")
          .eq("partner_id", partnerCtx.partnerId);

        if (Array.isArray(dbCentres) && dbCentres.length > 0) {
          for (const dc of dbCentres) {
            if (!centreCapacityStore.has(dc.id)) {
              centreCapacityStore.set(dc.id, {
                id: dc.id,
                centre_id: dc.id,
                centre_name: dc.name || "Delivery Centre",
                partner_id: partnerCtx.partnerId,
                partner_name: partnerCtx.partnerName || "Partner Centre",
                partner_status: "active",
                centre_status: dc.status || "active",
                location: dc.location || "New Delhi, India",
                total_seats: dc.capacity || 250,
                operational_seats: Math.round((dc.capacity || 250) * 0.8),
                occupied_seats: Math.round((dc.capacity || 250) * 0.5),
                reserved_seats: Math.round((dc.capacity || 250) * 0.1),
                available_seats: Math.round((dc.capacity || 250) * 0.2),
                utilization_percentage: 60.0,
                available_from: new Date().toISOString().slice(0, 10),
                minimum_commitment: 10,
                maximum_commitment: dc.capacity || 150,
                supported_processes: ["Customer Support", "Inbound Voice", "Technical Support", "Email & Chat"],
                supported_channels: ["Voice", "Email", "Chat"],
                supported_languages: ["English", "Hindi"],
                supported_timezones: ["UTC-5 (EST)", "UTC+0 (GMT)", "UTC+5:30 (IST)"],
                supported_shifts: ["US Shift (EST)", "UK Shift (GMT)", "24/7 Rotational"],
                working_days: ["Mon-Fri", "24/7 Rotational"],
                capacity_status: "AVAILABLE",
                last_updated_at: new Date().toISOString(),
                created_at: dc.created_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (dbErr) {
        logger.warn({ dbErr }, "Supabase bpo_centres query non-fatal fallback");
      }

      profiles = Array.from(centreCapacityStore.values()).filter(
        (c) => c.partner_id === partnerCtx.partnerId
      );

      // If still 0, adopt initial default seeds for this active partner
      if (profiles.length === 0) {
        for (const [id, c] of centreCapacityStore.entries()) {
          if (c.partner_id === "00000000-0000-0000-0000-000000000001") {
            c.partner_id = partnerCtx.partnerId;
            c.partner_name = partnerCtx.partnerName || c.partner_name;
          }
        }
        profiles = Array.from(centreCapacityStore.values()).filter(
          (c) => c.partner_id === partnerCtx.partnerId
        );
      }
    }

    return res.json({
      success: true,
      partnerId: partnerCtx.partnerId,
      partnerName: partnerCtx.partnerName,
      role: userRole || "partner_admin",
      centres: profiles,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/bpo/capacity failed");
    return fail(res, 500, "Internal server error retrieving centre capacity.", err.message);
  }
});

/**
 * PATCH /api/bpo/capacity
 * Updates authorized capacity fields for a centre owned by the partner.
 * RBAC: Partner Admin / Operations Manager / Centre Manager.
 */
router.patch("/bpo/capacity", requireFeature("bpo_capacity_marketplace"), requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const partnerCtx = await resolvePartnerForUser(req.user!.id);
    if (!partnerCtx) {
      return fail(res, 403, "Access restricted to authenticated BPO partner personnel.");
    }
    const userRole = (req.user as any)?.role || partnerCtx.role;
    if (userRole === "agent") {
      return fail(res, 403, "Agents cannot modify centre capacity.");
    }

    const {
      centre_id,
      total_seats,
      operational_seats,
      available_from,
      minimum_commitment,
      maximum_commitment,
      supported_processes,
      supported_channels,
      supported_languages,
      supported_timezones,
      supported_shifts,
      working_days,
      capacity_status,
    } = req.body;

    const parsedCentreId = parseNumber(centre_id);
    if (!parsedCentreId) {
      return fail(res, 400, "Valid centre_id is required.");
    }

    const record = centreCapacityStore.get(parsedCentreId);
    if (!record || record.partner_id !== partnerCtx.partnerId) {
      // Tenant Isolation: Prevent modifying other centres
      logSecurityEvent({
        action: "unauthorized_capacity_modification",
        actorUserId: req.user!.id,
        targetId: String(parsedCentreId),
        details: { centre_id: parsedCentreId },
      });
      return fail(res, 404, "Centre capacity profile not found for this partner organization.");
    }

    // Validate seat counts server-side
    let newTotal = record.total_seats;
    if (total_seats !== undefined) {
      const parsedTotal = parseNumber(total_seats);
      if (parsedTotal === null || parsedTotal < 0) {
        return fail(res, 400, "total_seats must be a non-negative integer.");
      }
      newTotal = parsedTotal;
    }

    let newOperational = record.operational_seats;
    if (operational_seats !== undefined) {
      const parsedOp = parseNumber(operational_seats);
      if (parsedOp === null || parsedOp < 0) {
        return fail(res, 400, "operational_seats must be a non-negative integer.");
      }
      if (parsedOp > newTotal) {
        return fail(res, 400, `operational_seats (${parsedOp}) cannot exceed total_seats (${newTotal}).`);
      }
      newOperational = parsedOp;
    }

    // BPO Partner CANNOT modify occupied_seats or reserved_seats (strictly server-controlled)
    const newOccupied = record.occupied_seats;

    // Validate that occupied + reserved <= operational
    if (newOccupied + record.reserved_seats > newOperational) {
      return fail(
        res,
        400,
        `Operational seats (${newOperational}) cannot be reduced below current occupied (${newOccupied}) + reserved (${record.reserved_seats}) seats.`
      );
    }

    // Recalculate available seats and utilization server-side (never trust frontend)
    const newAvailable = calculateAvailableSeats(newOperational, newOccupied, record.reserved_seats);
    const newUtilization = calculateUtilization(newOperational, newOccupied);

    let newStatus = record.capacity_status;
    if (capacity_status) {
      const allowed = ["AVAILABLE", "LIMITED", "FULL", "TEMPORARILY_UNAVAILABLE", "INACTIVE"];
      const upperStatus = String(capacity_status).toUpperCase();
      if (!allowed.includes(upperStatus)) {
        return fail(res, 400, `Invalid capacity_status. Allowed: ${allowed.join(", ")}`);
      }
      newStatus = upperStatus as any;
    } else {
      if (newAvailable === 0) newStatus = "FULL";
      else if (newAvailable <= 15) newStatus = "LIMITED";
      else if (newStatus === "FULL" && newAvailable > 15) newStatus = "AVAILABLE";
    }

    // Update mutable attributes safely
    record.total_seats = newTotal;
    record.operational_seats = newOperational;
    record.occupied_seats = newOccupied;
    record.available_seats = newAvailable;
    record.utilization_percentage = newUtilization;
    record.capacity_status = newStatus;

    if (available_from) record.available_from = String(available_from).slice(0, 10);
    if (minimum_commitment !== undefined) record.minimum_commitment = Math.max(1, Number(minimum_commitment) || 5);
    if (maximum_commitment !== undefined) record.maximum_commitment = Math.max(record.minimum_commitment, Number(maximum_commitment) || 100);
    if (Array.isArray(supported_processes)) record.supported_processes = supported_processes.map(sanitizeString);
    if (Array.isArray(supported_channels)) record.supported_channels = supported_channels.map(sanitizeString);
    if (Array.isArray(supported_languages)) record.supported_languages = supported_languages.map(sanitizeString);
    if (Array.isArray(supported_timezones)) record.supported_timezones = supported_timezones.map(sanitizeString);
    if (Array.isArray(supported_shifts)) record.supported_shifts = supported_shifts.map(sanitizeString);
    if (Array.isArray(working_days)) record.working_days = working_days.map(sanitizeString);
    record.last_updated_at = new Date().toISOString();

    centreCapacityStore.set(parsedCentreId, record);

    const changedBy = (req.user as any)?.email || "Partner Admin";
    recordCapacityHistory({
      centre_id: parsedCentreId,
      centre_name: record.centre_name,
      partner_id: record.partner_id,
      timestamp: new Date().toISOString(),
      changed_by: changedBy,
      total_seats: newTotal,
      operational_seats: newOperational,
      occupied_seats: newOccupied,
      reserved_seats: record.reserved_seats,
      available_seats: newAvailable,
      utilization_percentage: newUtilization,
      reason: "Capacity profile updated by Partner",
    });

    await logCapacityAuditEvent({
      actorUserId: req.user!.id,
      action: "centre_capacity_updated",
      entityType: "bpo_centre_capacity",
      entityId: String(parsedCentreId),
      metadata: {
        operational_seats: newOperational,
        occupied_seats: newOccupied,
        available_seats: newAvailable,
        utilization_percentage: newUtilization,
      },
    });

    return res.json({
      success: true,
      message: "Capacity profile updated successfully.",
      capacity: record,
    });
  } catch (err: any) {
    logger.error({ err }, "PATCH /api/bpo/capacity failed");
    return fail(res, 500, "Internal server error updating centre capacity.", err.message);
  }
});

/**
 * GET /api/bpo/capacity/matches
 * Fetches capacity matches proposed for centres owned by this partner.
 */
router.get("/bpo/capacity/matches", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const partnerCtx = await resolvePartnerForUser(req.user!.id);
    if (!partnerCtx) {
      return fail(res, 403, "Access restricted to authenticated BPO partner personnel.");
    }
    const userRole = (req.user as any)?.role || partnerCtx.role;
    if (userRole === "agent") {
      return fail(res, 403, "Agents cannot view capacity matches.");
    }

    let matches = Array.from(capacityMatchesStore.values()).filter(
      (m) => m.partner_id === partnerCtx.partnerId
    );

    if (matches.length === 0) {
      for (const m of capacityMatchesStore.values()) {
        if (m.partner_id === "00000000-0000-0000-0000-000000000001") {
          m.partner_id = partnerCtx.partnerId;
          m.partner_name = partnerCtx.partnerName || m.partner_name;
        }
      }
      matches = Array.from(capacityMatchesStore.values()).filter(
        (m) => m.partner_id === partnerCtx.partnerId
      );
    }

    return res.json({
      success: true,
      matches,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/bpo/capacity/matches failed");
    return fail(res, 500, "Internal server error retrieving matches.", err.message);
  }
});

/**
 * GET /api/bpo/capacity/reservations
 * Fetches active capacity reservations for centres owned by this partner.
 */
router.get("/bpo/capacity/reservations", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const partnerCtx = await resolvePartnerForUser(req.user!.id);
    if (!partnerCtx) {
      return fail(res, 403, "Access restricted to authenticated BPO partner personnel.");
    }
    const userRole = (req.user as any)?.role || partnerCtx.role;
    if (userRole === "agent") {
      return fail(res, 403, "Agents cannot view capacity reservations.");
    }

    let reservations = Array.from(capacityReservationsStore.values()).filter(
      (r) => r.partner_id === partnerCtx.partnerId
    );

    if (reservations.length === 0) {
      for (const r of capacityReservationsStore.values()) {
        if (r.partner_id === "00000000-0000-0000-0000-000000000001") {
          r.partner_id = partnerCtx.partnerId;
          r.partner_name = partnerCtx.partnerName || r.partner_name;
        }
      }
      reservations = Array.from(capacityReservationsStore.values()).filter(
        (r) => r.partner_id === partnerCtx.partnerId
      );
    }

    return res.json({
      success: true,
      reservations,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/bpo/capacity/reservations failed");
    return fail(res, 500, "Internal server error retrieving reservations.", err.message);
  }
});

/**
 * GET /api/bpo/capacity/history
 * Returns authoritative historical change records for centres owned by this partner.
 */
router.get("/bpo/capacity/history", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const partnerCtx = await resolvePartnerForUser(req.user!.id);
    if (!partnerCtx) {
      return fail(res, 403, "Access restricted to authenticated BPO partner personnel.");
    }
    const userRole = (req.user as any)?.role || partnerCtx.role;
    if (userRole === "agent") {
      return fail(res, 403, "Agents cannot view capacity history.");
    }

    const { centre_id } = req.query;
    let history = capacityHistoryStore.filter((h) => h.partner_id === partnerCtx.partnerId);

    if (history.length === 0) {
      for (const h of capacityHistoryStore) {
        if (h.partner_id === "00000000-0000-0000-0000-000000000001") {
          h.partner_id = partnerCtx.partnerId;
        }
      }
      history = capacityHistoryStore.filter((h) => h.partner_id === partnerCtx.partnerId);
    }

    if (centre_id) {
      const parsedId = parseNumber(centre_id);
      if (parsedId) {
        history = history.filter((h) => h.centre_id === parsedId);
      }
    }

    return res.json({
      success: true,
      history,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/bpo/capacity/history failed");
    return fail(res, 500, "Internal server error retrieving capacity history.", err.message);
  }
});

/**
 * POST /api/bpo/capacity/sync
 * Performs real server-side synchronization of capacity, recalculates authoritative state,
 * and updates timestamps.
 */
router.post("/bpo/capacity/sync", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const partnerCtx = await resolvePartnerForUser(req.user!.id);
    if (!partnerCtx) {
      return fail(res, 403, "Access restricted to authenticated BPO partner personnel.");
    }

    // Re-verify and recalculate derived values for each centre owned by this partner
    const partnerCentres = Array.from(centreCapacityStore.values())
      .filter((c) => c.partner_id === partnerCtx.partnerId)
      .map((centre) => {
        // Authoritative server-side calculation
        centre.available_seats = calculateAvailableSeats(
          centre.operational_seats,
          centre.occupied_seats,
          centre.reserved_seats
        );
        centre.utilization_percentage = calculateUtilization(
          centre.operational_seats,
          centre.occupied_seats
        );
        if (centre.available_seats === 0) {
          centre.capacity_status = "FULL";
        } else if (centre.available_seats <= 15) {
          centre.capacity_status = "LIMITED";
        } else if (centre.capacity_status === "FULL" && centre.available_seats > 15) {
          centre.capacity_status = "AVAILABLE";
        }
        centre.last_updated_at = new Date().toISOString();
        centreCapacityStore.set(centre.centre_id, centre);
        return centre;
      });

    const matches = Array.from(capacityMatchesStore.values()).filter(
      (m) => m.partner_id === partnerCtx.partnerId
    );

    const reservations = Array.from(capacityReservationsStore.values()).filter(
      (r) => r.partner_id === partnerCtx.partnerId
    );

    const history = capacityHistoryStore.filter((h) => h.partner_id === partnerCtx.partnerId);

    const timestamp = new Date().toISOString();

    await logCapacityAuditEvent({
      actorUserId: req.user!.id,
      action: "capacity_synchronized",
      entityType: "bpo_partner",
      entityId: partnerCtx.partnerId,
      metadata: { centresCount: partnerCentres.length, timestamp },
    });

    return res.json({
      success: true,
      message: "Capacity synchronized.",
      timestamp,
      centres: partnerCentres,
      matches,
      reservations,
      history,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/bpo/capacity/sync failed");
    return fail(res, 500, "Unable to synchronize capacity. Please try again.", err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: CLIENT CAPACITY REQUIREMENTS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/client/capacity-requirements
 * Lists requirements belonging strictly to authenticated client (Tenant Isolation).
 */
router.get("/client/capacity-requirements", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) {
      return fail(res, 403, "Access restricted to authorized enterprise client accounts.");
    }

    const reqs = Array.from(capacityRequirementsStore.values())
      .filter((r) => r.client_id === clientCtx.client.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.json({
      success: true,
      client: {
        id: clientCtx.client.id,
        code: clientCtx.client.client_code,
        name: clientCtx.client.company_name,
      },
      requirements: reqs,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/client/capacity-requirements failed");
    return fail(res, 500, "Failed to retrieve client capacity requirements.", err.message);
  }
});

/**
 * POST /api/client/capacity-requirements
 * Creates a new capacity requirement (DRAFT or SUBMITTED).
 * RBAC: client_admin or client_manager. client_viewer is rejected.
 */
router.post("/client/capacity-requirements", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) {
      return fail(res, 403, "Access restricted to authorized enterprise client accounts.");
    }
    if (clientCtx.role === "client_viewer") {
      return fail(res, 403, "Client viewers have read-only access and cannot create requirements.");
    }

    const {
      title,
      required_seats,
      process_type,
      channels,
      languages,
      timezone,
      shift,
      location_requirement,
      start_date,
      expected_duration_months,
      minimum_experience_years,
      certification_requirements,
      compliance_requirements,
      working_days,
      notes,
      submit_immediately,
    } = req.body;

    if (!title || String(title).trim().length < 3) {
      return fail(res, 400, "A valid title (minimum 3 characters) is required.");
    }

    const seats = parseNumber(required_seats);
    if (!seats || seats <= 0) {
      return fail(res, 400, "required_seats must be a positive integer greater than zero.");
    }

    if (!process_type) {
      return fail(res, 400, "process_type is required (e.g. 'Customer Support', 'Technical Support').");
    }

    if (!start_date) {
      return fail(res, 400, "start_date (YYYY-MM-DD) is required.");
    }

    const newId = ++nextReqId;
    const reqCode = padCode("THK-REQ", newId);
    const status = submit_immediately ? "SUBMITTED" : "DRAFT";

    const record: BpoCapacityRequirementRecord = {
      id: newId,
      requirement_code: reqCode,
      client_id: clientCtx.client.id,
      client_name: clientCtx.client.company_name,
      title: sanitizeString(title),
      required_seats: seats,
      process_type: sanitizeString(process_type),
      channels: Array.isArray(channels) && channels.length > 0 ? channels.map(sanitizeString) : ["Voice"],
      languages: Array.isArray(languages) && languages.length > 0 ? languages.map(sanitizeString) : ["English"],
      timezone: sanitizeString(timezone || "UTC-5 (EST)"),
      shift: sanitizeString(shift || "US Shift (EST)"),
      location_requirement: sanitizeString(location_requirement || "Any"),
      start_date: String(start_date).slice(0, 10),
      expected_duration_months: Math.max(1, Number(expected_duration_months) || 6),
      minimum_experience_years: Math.max(0, Number(minimum_experience_years) || 1),
      certification_requirements: Array.isArray(certification_requirements) ? certification_requirements.map(sanitizeString) : [],
      compliance_requirements: Array.isArray(compliance_requirements) ? compliance_requirements.map(sanitizeString) : [],
      working_days: sanitizeString(working_days || "Mon-Fri"),
      notes: sanitizeString(notes || ""),
      status,
      created_by_user_id: req.user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    capacityRequirementsStore.set(newId, record);

    await logCapacityAuditEvent({
      actorUserId: req.user!.id,
      action: status === "SUBMITTED" ? "requirement_submitted" : "requirement_created",
      entityType: "bpo_capacity_requirements",
      entityId: reqCode,
      metadata: { title: record.title, seats, status },
    });

    if (status === "SUBMITTED") {
      bpoStore.notifications.push({
        id: ++bpoStore.nextNotifId,
        type: "capacity_requirement_submitted",
        title: "New Capacity Requirement Received",
        body: `Client ${clientCtx.client.company_name} submitted requirement ${reqCode} for ${seats} seats (${record.process_type}).`,
        created_at: new Date().toISOString(),
      });
    }

    return res.status(201).json({
      success: true,
      message: status === "SUBMITTED" ? "Capacity requirement submitted for operational matching." : "Requirement draft saved successfully.",
      requirement: record,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/client/capacity-requirements failed");
    return fail(res, 500, "Failed to create capacity requirement.", err.message);
  }
});

/**
 * GET /api/client/capacity-requirements/:id
 * Tenant Isolation check: Client cannot view another client's requirement.
 */
router.get("/client/capacity-requirements/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) {
      return fail(res, 403, "Access restricted to authorized enterprise client accounts.");
    }

    const reqId = parseNumber(req.params.id);
    if (!reqId) return fail(res, 400, "Invalid requirement ID.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement || requirement.client_id !== clientCtx.client.id) {
      logSecurityEvent({
        action: "IDOR_ATTEMPT",
        actorUserId: req.user!.id,
        targetId: String(reqId),
        details: { endpoint: "GET /api/client/capacity-requirements/:id", target_id: reqId },
      });
      return fail(res, 404, "Capacity requirement not found.");
    }

    return res.json({
      success: true,
      requirement,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/client/capacity-requirements/:id failed");
    return fail(res, 500, "Internal error retrieving requirement.", err.message);
  }
});

/**
 * PATCH /api/client/capacity-requirements/:id
 * Edits a DRAFT requirement. Cannot edit non-draft requirements.
 */
router.patch("/client/capacity-requirements/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) return fail(res, 403, "Access restricted to authorized enterprise client accounts.");
    if (clientCtx.role === "client_viewer") return fail(res, 403, "Read-only access.");

    const reqId = parseNumber(req.params.id);
    if (!reqId) return fail(res, 400, "Invalid requirement ID.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement || requirement.client_id !== clientCtx.client.id) {
      return fail(res, 404, "Capacity requirement not found.");
    }

    if (requirement.status !== "DRAFT") {
      return fail(res, 400, `Cannot edit requirement in "${requirement.status}" status. Only DRAFT requirements can be edited.`);
    }

    const {
      title,
      required_seats,
      process_type,
      channels,
      languages,
      timezone,
      shift,
      location_requirement,
      start_date,
      expected_duration_months,
      working_days,
      notes,
    } = req.body;

    if (title) requirement.title = sanitizeString(title);
    if (required_seats !== undefined) {
      const s = parseNumber(required_seats);
      if (!s || s <= 0) return fail(res, 400, "required_seats must be positive.");
      requirement.required_seats = s;
    }
    if (process_type) requirement.process_type = sanitizeString(process_type);
    if (Array.isArray(channels)) requirement.channels = channels.map(sanitizeString);
    if (Array.isArray(languages)) requirement.languages = languages.map(sanitizeString);
    if (timezone) requirement.timezone = sanitizeString(timezone);
    if (shift) requirement.shift = sanitizeString(shift);
    if (location_requirement) requirement.location_requirement = sanitizeString(location_requirement);
    if (start_date) requirement.start_date = String(start_date).slice(0, 10);
    if (expected_duration_months) requirement.expected_duration_months = Math.max(1, Number(expected_duration_months) || 6);
    if (working_days) requirement.working_days = sanitizeString(working_days);
    if (notes !== undefined) requirement.notes = sanitizeString(notes);
    requirement.updated_at = new Date().toISOString();

    capacityRequirementsStore.set(reqId, requirement);

    await logCapacityAuditEvent({
      actorUserId: req.user!.id,
      action: "requirement_updated",
      entityType: "bpo_capacity_requirements",
      entityId: requirement.requirement_code,
      metadata: { reqId },
    });

    return res.json({
      success: true,
      message: "Requirement draft updated successfully.",
      requirement,
    });
  } catch (err: any) {
    logger.error({ err }, "PATCH /api/client/capacity-requirements/:id failed");
    return fail(res, 500, "Failed to update requirement.", err.message);
  }
});

/**
 * POST /api/client/capacity-requirements/:id/submit
 * Submits a draft requirement for operational matching.
 */
router.post("/client/capacity-requirements/:id/submit", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) return fail(res, 403, "Access restricted to authorized enterprise client accounts.");
    if (clientCtx.role === "client_viewer") return fail(res, 403, "Read-only access.");

    const reqId = parseNumber(req.params.id);
    if (!reqId) return fail(res, 400, "Invalid requirement ID.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement || requirement.client_id !== clientCtx.client.id) {
      return fail(res, 404, "Capacity requirement not found.");
    }

    if (requirement.status !== "DRAFT") {
      return fail(res, 400, `Requirement is already in "${requirement.status}" status.`);
    }

    requirement.status = "SUBMITTED";
    requirement.updated_at = new Date().toISOString();
    capacityRequirementsStore.set(reqId, requirement);

    await logCapacityAuditEvent({
      actorUserId: req.user!.id,
      action: "requirement_submitted",
      entityType: "bpo_capacity_requirements",
      entityId: requirement.requirement_code,
      metadata: { reqId, seats: requirement.required_seats },
    });

    bpoStore.notifications.push({
      id: ++bpoStore.nextNotifId,
      type: "capacity_requirement_submitted",
      title: "Capacity Requirement Submitted",
      body: `Requirement ${requirement.requirement_code} submitted by ${clientCtx.client.company_name}.`,
      created_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: "Requirement submitted successfully for matching.",
      requirement,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/client/capacity-requirements/:id/submit failed");
    return fail(res, 500, "Failed to submit requirement.", err.message);
  }
});

/**
 * POST /api/client/capacity-requirements/:id/cancel
 * Cancels a requirement if not already allocated/closed.
 */
router.post("/client/capacity-requirements/:id/cancel", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) return fail(res, 403, "Access restricted to authorized enterprise client accounts.");
    if (clientCtx.role === "client_viewer") return fail(res, 403, "Read-only access.");

    const reqId = parseNumber(req.params.id);
    if (!reqId) return fail(res, 400, "Invalid requirement ID.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement || requirement.client_id !== clientCtx.client.id) {
      return fail(res, 404, "Capacity requirement not found.");
    }

    if (requirement.status === "ALLOCATED" || requirement.status === "CLOSED" || requirement.status === "CANCELLED") {
      return fail(res, 400, `Cannot cancel requirement in "${requirement.status}" status.`);
    }

    requirement.status = "CANCELLED";
    requirement.updated_at = new Date().toISOString();
    capacityRequirementsStore.set(reqId, requirement);

    // Cancel any open proposed matches for this requirement
    for (const match of capacityMatchesStore.values()) {
      if (match.requirement_id === reqId && (match.match_status === "PROPOSED" || match.match_status === "UNDER_REVIEW")) {
        match.match_status = "CANCELLED";
      }
    }

    await logCapacityAuditEvent({
      actorUserId: req.user!.id,
      action: "requirement_cancelled",
      entityType: "bpo_capacity_requirements",
      entityId: requirement.requirement_code,
      metadata: { reqId },
    });

    return res.json({
      success: true,
      message: "Requirement cancelled successfully.",
      requirement,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/client/capacity-requirements/:id/cancel failed");
    return fail(res, 500, "Failed to cancel requirement.", err.message);
  }
});

/**
 * GET /api/client/capacity-requirements/:id/matches
 * Returns authorized, sanitized match information for client.
 * Does NOT expose internal margins, private centre notes, or confidential operational data.
 */
router.get("/client/capacity-requirements/:id/matches", requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const clientCtx = await resolveClientForUser(req.user!.id);
    if (!clientCtx) return fail(res, 403, "Access restricted to authorized enterprise client accounts.");

    const reqId = parseNumber(req.params.id);
    if (!reqId) return fail(res, 400, "Invalid requirement ID.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement || requirement.client_id !== clientCtx.client.id) {
      return fail(res, 404, "Capacity requirement not found.");
    }

    // Filter matches for this requirement, sanitize sensitive operational secrets
    const matches = Array.from(capacityMatchesStore.values())
      .filter((m) => m.requirement_id === reqId && (m.match_status === "ACCEPTED" || m.match_status === "PROPOSED"))
      .map((m) => {
        const cap = centreCapacityStore.get(m.centre_id);
        return {
          id: m.id,
          match_code: m.match_code,
          match_status: m.match_status,
          matched_capacity: m.matched_capacity,
          centre_name: m.centre_name,
          location: cap?.location || "Global Verified Delivery Hub",
          supported_channels: cap?.supported_channels || [],
          supported_languages: cap?.supported_languages || [],
          supported_shifts: cap?.supported_shifts || [],
          created_at: m.created_at,
        };
      });

    return res.json({
      success: true,
      requirement_code: requirement.requirement_code,
      matches,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/client/capacity-requirements/:id/matches failed");
    return fail(res, 500, "Failed to retrieve matches for requirement.", err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: ADMIN & OPERATIONS MARKETPLACE COMMAND CENTRE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/capacity/overview
 * Returns aggregate capacity marketplace metrics across all verified centres and requirements.
 */
router.get("/admin/capacity/overview", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();

    const centres = Array.from(centreCapacityStore.values());
    const requirements = Array.from(capacityRequirementsStore.values());
    const matches = Array.from(capacityMatchesStore.values());
    const reservations = Array.from(capacityReservationsStore.values());

    const totalVerifiedCentres = centres.length;
    const totalOperationalSeats = centres.reduce((sum, c) => sum + c.operational_seats, 0);
    const totalOccupiedSeats = centres.reduce((sum, c) => sum + c.occupied_seats, 0);
    const totalReservedSeats = centres.reduce((sum, c) => sum + c.reserved_seats, 0);
    const totalAvailableSeats = centres.reduce((sum, c) => sum + c.available_seats, 0);
    const overallUtilization = totalOperationalSeats > 0 ? Math.round((totalOccupiedSeats / totalOperationalSeats) * 10000) / 100 : 0;

    const openRequirementsCount = requirements.filter(
      (r) => r.status === "SUBMITTED" || r.status === "MATCHING" || r.status === "UNDER_REVIEW"
    ).length;
    const matchedRequirementsCount = requirements.filter((r) => r.status === "MATCHED").length;
    const allocatedRequirementsCount = requirements.filter((r) => r.status === "ALLOCATED").length;

    const proposedMatchesCount = matches.filter((m) => m.match_status === "PROPOSED").length;
    const acceptedMatchesCount = matches.filter((m) => m.match_status === "ACCEPTED").length;
    const activeReservationsCount = reservations.filter((r) => r.status === "ACTIVE").length;

    // Capacity by process
    const processBreakdown: Record<string, number> = {};
    centres.forEach((c) => {
      c.supported_processes.forEach((p) => {
        processBreakdown[p] = (processBreakdown[p] || 0) + c.available_seats;
      });
    });

    // Capacity by location/timezone
    const timezoneBreakdown: Record<string, number> = {};
    centres.forEach((c) => {
      c.supported_timezones.forEach((tz) => {
        timezoneBreakdown[tz] = (timezoneBreakdown[tz] || 0) + c.available_seats;
      });
    });

    return res.json({
      success: true,
      metrics: {
        totalVerifiedCentres,
        totalOperationalSeats,
        totalOccupiedSeats,
        totalReservedSeats,
        totalAvailableSeats,
        overallUtilization,
        openRequirementsCount,
        matchedRequirementsCount,
        allocatedRequirementsCount,
        proposedMatchesCount,
        acceptedMatchesCount,
        activeReservationsCount,
      },
      processBreakdown,
      timezoneBreakdown,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/admin/capacity/overview failed");
    return fail(res, 500, "Internal error retrieving marketplace overview.", err.message);
  }
});

/**
 * GET /api/admin/capacity/centres
 * Lists all centres with their capacity profiles.
 * Supports filters: country, timezone, process, channel, language, shift, available_seats, status.
 */
router.get("/admin/capacity/centres", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();

    const {
      country,
      timezone,
      process,
      channel,
      language,
      shift,
      min_available,
      status,
      search,
    } = req.query;

    let list = Array.from(centreCapacityStore.values());

    if (country) {
      const q = String(country).toLowerCase();
      list = list.filter((c) => c.location.toLowerCase().includes(q));
    }
    if (timezone) {
      const q = String(timezone).toLowerCase();
      list = list.filter((c) => c.supported_timezones.some((tz) => tz.toLowerCase().includes(q)));
    }
    if (process) {
      const q = String(process).toLowerCase();
      list = list.filter((c) => c.supported_processes.some((p) => p.toLowerCase().includes(q)));
    }
    if (channel) {
      const q = String(channel).toLowerCase();
      list = list.filter((c) => c.supported_channels.some((ch) => ch.toLowerCase().includes(q)));
    }
    if (language) {
      const q = String(language).toLowerCase();
      list = list.filter((c) => c.supported_languages.some((l) => l.toLowerCase().includes(q)));
    }
    if (shift) {
      const q = String(shift).toLowerCase();
      list = list.filter((c) => c.supported_shifts.some((s) => s.toLowerCase().includes(q)));
    }
    if (min_available) {
      const n = Number(min_available) || 0;
      list = list.filter((c) => c.available_seats >= n);
    }
    if (status) {
      const s = String(status).toUpperCase();
      list = list.filter((c) => c.capacity_status === s);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (c) =>
          c.centre_name.toLowerCase().includes(q) ||
          c.partner_name.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q)
      );
    }

    return res.json({
      success: true,
      count: list.length,
      centres: list,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/admin/capacity/centres failed");
    return fail(res, 500, "Internal error retrieving centres.", err.message);
  }
});

/**
 * PATCH /api/admin/capacity/centres/:id
 * Admin updates centre capacity directly.
 */
router.patch("/admin/capacity/centres/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const centreId = parseNumber(req.params.id);
    if (!centreId) return fail(res, 400, "Invalid centre ID.");

    const record = centreCapacityStore.get(centreId);
    if (!record) return fail(res, 404, "Centre capacity profile not found.");

    const {
      total_seats,
      operational_seats,
      occupied_seats,
      capacity_status,
      available_from,
      minimum_commitment,
      maximum_commitment,
      supported_processes,
      supported_channels,
      supported_languages,
      supported_timezones,
      supported_shifts,
    } = req.body;

    let newTotal = record.total_seats;
    if (total_seats !== undefined) {
      const t = parseNumber(total_seats);
      if (t === null || t < 0) return fail(res, 400, "total_seats must be non-negative.");
      newTotal = t;
    }

    let newOp = record.operational_seats;
    if (operational_seats !== undefined) {
      const op = parseNumber(operational_seats);
      if (op === null || op < 0) return fail(res, 400, "operational_seats must be non-negative.");
      if (op > newTotal) return fail(res, 400, "operational_seats cannot exceed total_seats.");
      newOp = op;
    }

    let newOcc = record.occupied_seats;
    if (occupied_seats !== undefined) {
      const occ = parseNumber(occupied_seats);
      if (occ === null || occ < 0) return fail(res, 400, "occupied_seats must be non-negative.");
      newOcc = occ;
    }

    if (newOcc + record.reserved_seats > newOp) {
      return fail(res, 400, "Occupied + reserved seats cannot exceed operational seats.");
    }

    record.total_seats = newTotal;
    record.operational_seats = newOp;
    record.occupied_seats = newOcc;
    record.available_seats = calculateAvailableSeats(newOp, newOcc, record.reserved_seats);
    record.utilization_percentage = calculateUtilization(newOp, newOcc);

    if (capacity_status) record.capacity_status = String(capacity_status).toUpperCase() as any;
    if (available_from) record.available_from = String(available_from).slice(0, 10);
    if (minimum_commitment !== undefined) record.minimum_commitment = Math.max(1, Number(minimum_commitment) || 5);
    if (maximum_commitment !== undefined) record.maximum_commitment = Math.max(record.minimum_commitment, Number(maximum_commitment) || 100);
    if (Array.isArray(supported_processes)) record.supported_processes = supported_processes.map(sanitizeString);
    if (Array.isArray(supported_channels)) record.supported_channels = supported_channels.map(sanitizeString);
    if (Array.isArray(supported_languages)) record.supported_languages = supported_languages.map(sanitizeString);
    if (Array.isArray(supported_timezones)) record.supported_timezones = supported_timezones.map(sanitizeString);
    if (Array.isArray(supported_shifts)) record.supported_shifts = supported_shifts.map(sanitizeString);
    record.last_updated_at = new Date().toISOString();

    centreCapacityStore.set(centreId, record);

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "admin_centre_capacity_updated",
      entityType: "bpo_centre_capacity",
      entityId: String(centreId),
      metadata: { record },
    });

    return res.json({
      success: true,
      message: "Centre capacity updated successfully by admin.",
      capacity: record,
    });
  } catch (err: any) {
    logger.error({ err }, "PATCH /api/admin/capacity/centres/:id failed");
    return fail(res, 500, "Internal error updating centre capacity.", err.message);
  }
});

/**
 * GET /api/admin/capacity/requirements
 * Lists all client capacity requirements across the platform.
 */
router.get("/admin/capacity/requirements", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const { status, search } = req.query;

    let list = Array.from(capacityRequirementsStore.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (status) {
      const s = String(status).toUpperCase();
      list = list.filter((r) => r.status === s);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requirement_code.toLowerCase().includes(q) ||
          r.client_name.toLowerCase().includes(q) ||
          r.process_type.toLowerCase().includes(q)
      );
    }

    return res.json({
      success: true,
      count: list.length,
      requirements: list,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/admin/capacity/requirements failed");
    return fail(res, 500, "Internal error retrieving requirements.", err.message);
  }
});

/**
 * GET /api/admin/capacity/requirements/:id
 * Detailed requirement view.
 */
router.get("/admin/capacity/requirements/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const reqId = parseNumber(req.params.id);
    if (!reqId) return fail(res, 400, "Invalid requirement ID.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement) return fail(res, 404, "Requirement not found.");

    const matches = Array.from(capacityMatchesStore.values()).filter((m) => m.requirement_id === reqId);
    const reservations = Array.from(capacityReservationsStore.values()).filter((r) => r.requirement_id === reqId);

    return res.json({
      success: true,
      requirement,
      matches,
      reservations,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /api/admin/capacity/requirements/:id failed");
    return fail(res, 500, "Internal error retrieving requirement details.", err.message);
  }
});

/**
 * POST /api/admin/capacity/match
 * Runs the deterministic matching engine against candidate centres for a requirement.
 * Explainable pass/fail checklist returned for each centre.
 * ZERO AI decision making.
 */
router.post("/admin/capacity/match", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const { requirement_id } = req.body;
    const reqId = parseNumber(requirement_id);
    if (!reqId) return fail(res, 400, "requirement_id is required.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement) return fail(res, 404, "Capacity requirement not found.");

    const candidateProfiles = Array.from(centreCapacityStore.values()).map(toCandidateProfile);

    const reqCriteria: CapacityRequirementCriteria = {
      requirementId: requirement.id,
      requirementCode: requirement.requirement_code,
      clientId: requirement.client_id,
      title: requirement.title,
      requiredSeats: requirement.required_seats,
      processType: requirement.process_type,
      channels: requirement.channels,
      languages: requirement.languages,
      timezone: requirement.timezone,
      shift: requirement.shift,
      locationRequirement: requirement.location_requirement,
      startDate: requirement.start_date,
      expectedDurationMonths: requirement.expected_duration_months,
      minimumExperienceYears: requirement.minimum_experience_years,
      workingDays: requirement.working_days,
    };

    const evaluationResults = runDeterministicMatching(candidateProfiles, reqCriteria);

    // Update requirement status to MATCHING if it was SUBMITTED
    if (requirement.status === "SUBMITTED") {
      requirement.status = "MATCHING";
      requirement.updated_at = new Date().toISOString();
      capacityRequirementsStore.set(reqId, requirement);
    }

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "matching_engine_executed",
      entityType: "bpo_capacity_requirements",
      entityId: requirement.requirement_code,
      metadata: { candidatesEvaluated: candidateProfiles.length, eligibleCount: evaluationResults.filter((e) => e.isEligible).length },
    });

    return res.json({
      success: true,
      analysis_type: "ELIGIBILITY_ANALYSIS",
      score_type: "INFORMATIONAL_COMPATIBILITY",
      decision_authority: "HUMAN_OPERATIONS",
      automatic_selection: false,
      disclaimer: "Compatibility score is an informational decision-support indicator only. Thinkatic Operations must manually select the BPO centre.",
      requirementCode: requirement.requirement_code,
      requiredSeats: requirement.required_seats,
      candidatesCount: evaluationResults.length,
      eligibleCandidatesCount: evaluationResults.filter((r) => r.isEligible).length,
      results: evaluationResults,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/match failed");
    return fail(res, 500, "Deterministic matching engine failed.", err.message);
  }
});

/**
 * POST /api/admin/capacity/matches and POST /api/admin/capacity/select-centre
 * Human Operations/Admin manually selects a verified centre for a capacity requirement.
 * Explicitly records human decision source, selected_by, selected_at, and notes.
 * ZERO automatic selection or automatic reservation.
 */
const handleManualCentreSelection = async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const { requirement_id, centre_id, matched_capacity, notes } = req.body;

    const reqId = parseNumber(requirement_id);
    const cId = parseNumber(centre_id);
    if (!reqId || !cId) return fail(res, 400, "requirement_id and centre_id are required.");

    const requirement = capacityRequirementsStore.get(reqId);
    if (!requirement) return fail(res, 404, "Requirement not found.");

    const centre = centreCapacityStore.get(cId);
    if (!centre) return fail(res, 404, "Centre not found.");

    const matchSeats = parseNumber(matched_capacity) || requirement.required_seats;
    if (matchSeats <= 0) return fail(res, 400, "matched_capacity must be positive.");

    // Check if match already exists for this pair
    const existing = Array.from(capacityMatchesStore.values()).find(
      (m) => m.requirement_id === reqId && m.centre_id === cId && m.match_status !== "REJECTED" && m.match_status !== "CANCELLED"
    );
    if (existing) {
      return fail(res, 409, `A match (${existing.match_code}) already exists between this requirement and centre.`);
    }

    // Run deterministic evaluation snapshot
    const criteriaEval = evaluateCentreEligibility(toCandidateProfile(centre), {
      requirementId: requirement.id,
      requirementCode: requirement.requirement_code,
      clientId: requirement.client_id,
      title: requirement.title,
      requiredSeats: matchSeats,
      processType: requirement.process_type,
      channels: requirement.channels,
      languages: requirement.languages,
      timezone: requirement.timezone,
      shift: requirement.shift,
      locationRequirement: requirement.location_requirement,
      startDate: requirement.start_date,
      expectedDurationMonths: requirement.expected_duration_months,
    });

    const matchId = ++nextMatchId;
    const matchCode = padCode("THK-MAT", matchId);
    const selectedAt = new Date().toISOString();
    const adminId = req.admin?.id || 1;

    const matchRecord: BpoCapacityMatchRecord = {
      id: matchId,
      match_code: matchCode,
      requirement_id: reqId,
      requirement_code: requirement.requirement_code,
      centre_id: cId,
      centre_name: centre.centre_name,
      partner_id: centre.partner_id,
      partner_name: centre.partner_name,
      matched_capacity: matchSeats,
      matching_criteria: criteriaEval,
      match_status: "PROPOSED",
      decision_source: "HUMAN_OPERATIONS",
      selected_by: adminId,
      selected_at: selectedAt,
      decision_notes: sanitizeString(notes || "Manually selected by Thinkatic Operations"),
      score_type: "INFORMATIONAL_COMPATIBILITY",
      automatic_selection: false,
      created_by_admin_id: adminId,
      internal_notes: sanitizeString(notes || ""),
      created_at: selectedAt,
    };

    capacityMatchesStore.set(matchId, matchRecord);

    requirement.status = "MATCHED";
    requirement.updated_at = selectedAt;
    capacityRequirementsStore.set(reqId, requirement);

    // Audit logs clearly recording human operations decision
    await logCapacityAuditEvent({
      actorAdminId: adminId,
      action: "CENTRE_MANUALLY_SELECTED",
      entityType: "bpo_capacity_matches",
      entityId: matchCode,
      metadata: {
        reqId,
        centreId: cId,
        matchSeats,
        decision_source: "HUMAN_OPERATIONS",
        selected_by: adminId,
        selected_at: selectedAt,
        notes: matchRecord.decision_notes,
      },
    });

    await logSecurityEvent({
      action: "CENTRE_MANUALLY_SELECTED",
      actorAdminId: adminId,
      targetId: matchCode,
      details: {
        requirement_id: reqId,
        centre_id: cId,
        matched_capacity: matchSeats,
        decision_source: "HUMAN_OPERATIONS",
        selected_by: adminId,
        timestamp: selectedAt,
      },
    });

    bpoStore.notifications.push({
      id: ++bpoStore.nextNotifId,
      recipient_partner_id: centre.partner_id,
      type: "capacity_match_proposed",
      title: "Capacity Match Proposed",
      body: `Thinkatic Operations manually selected centre ${centre.centre_name} for match ${matchCode} (${matchSeats} seats).`,
      created_at: selectedAt,
    });

    return res.status(201).json({
      success: true,
      message: "Centre manually selected and capacity match proposed successfully.",
      match: matchRecord,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/matches failed");
    return fail(res, 500, "Internal error proposing capacity match.", err.message);
  }
};

router.post("/admin/capacity/matches", requireAuth, handleManualCentreSelection);
router.post("/admin/capacity/select-centre", requireAuth, handleManualCentreSelection);

/**
 * POST /api/admin/capacity/matches/:id/approve
 * Human/Admin Authoritative Approval of a proposed capacity match.
 */
router.post("/admin/capacity/matches/:id/approve", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const matchId = parseNumber(req.params.id);
    if (!matchId) return fail(res, 400, "Invalid match ID.");

    const match = capacityMatchesStore.get(matchId);
    if (!match) return fail(res, 404, "Capacity match not found.");

    if (match.match_status !== "PROPOSED" && match.match_status !== "UNDER_REVIEW") {
      return fail(res, 400, `Cannot approve match in status "${match.match_status}".`);
    }

    const centre = centreCapacityStore.get(match.centre_id);
    if (!centre || centre.centre_status !== "active") {
      return fail(res, 400, "Centre is not active or verified.");
    }

    const reqRecord = capacityRequirementsStore.get(match.requirement_id);
    if (!reqRecord || reqRecord.status === "CANCELLED" || reqRecord.status === "CLOSED") {
      return fail(res, 400, "Requirement is no longer active.");
    }

    // Re-verify available capacity
    if (centre.available_seats < match.matched_capacity) {
      return fail(
        res,
        409,
        `Cannot approve match: Centre available capacity (${centre.available_seats}) is less than matched capacity (${match.matched_capacity}).`
      );
    }

    match.match_status = "ACCEPTED";
    match.reviewed_by_admin_id = req.admin!.id;
    match.reviewed_at = new Date().toISOString();
    capacityMatchesStore.set(matchId, match);

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "match_approved",
      entityType: "bpo_capacity_matches",
      entityId: match.match_code,
      metadata: { matchId, centreId: match.centre_id, seats: match.matched_capacity },
    });

    bpoStore.notifications.push({
      id: ++bpoStore.nextNotifId,
      recipient_partner_id: centre.partner_id,
      type: "capacity_match_accepted",
      title: "Capacity Match Approved",
      body: `Match ${match.match_code} for ${match.matched_capacity} seats was approved by Thinkatic Operations.`,
      created_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: "Capacity match approved successfully by Operations.",
      match,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/matches/:id/approve failed");
    return fail(res, 500, "Failed to approve capacity match.", err.message);
  }
});

/**
 * POST /api/admin/capacity/matches/:id/reject
 * Admin rejects a match with an explicit reason.
 */
router.post("/admin/capacity/matches/:id/reject", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const matchId = parseNumber(req.params.id);
    if (!matchId) return fail(res, 400, "Invalid match ID.");

    const match = capacityMatchesStore.get(matchId);
    if (!match) return fail(res, 404, "Capacity match not found.");

    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 3) {
      return fail(res, 400, "A valid rejection reason (minimum 3 characters) is required.");
    }

    match.match_status = "REJECTED";
    match.rejection_reason = sanitizeString(reason);
    match.reviewed_by_admin_id = req.admin!.id;
    match.reviewed_at = new Date().toISOString();
    capacityMatchesStore.set(matchId, match);

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "match_rejected",
      entityType: "bpo_capacity_matches",
      entityId: match.match_code,
      metadata: { matchId, reason },
    });

    return res.json({
      success: true,
      message: "Capacity match rejected.",
      match,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/matches/:id/reject failed");
    return fail(res, 500, "Failed to reject match.", err.message);
  }
});

/**
 * POST /api/admin/capacity/matches/:id/reserve
 * Atomically reserves capacity for an accepted/proposed match.
 * Prevents over-allocation and handles concurrent requests safely.
 */
router.post("/admin/capacity/matches/:id/reserve", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const matchId = parseNumber(req.params.id);
    if (!matchId) return fail(res, 400, "Invalid match ID.");

    const match = capacityMatchesStore.get(matchId);
    if (!match) return fail(res, 404, "Capacity match not found.");

    if (match.match_status === "REJECTED" || match.match_status === "CANCELLED") {
      return fail(res, 400, `Cannot reserve capacity for ${match.match_status} match.`);
    }

    const { seats_to_reserve, expires_in_days } = req.body;
    const reserveSeats = parseNumber(seats_to_reserve) || match.matched_capacity;

    if (reserveSeats <= 0) {
      return fail(res, 400, "Reserved seats must be a positive integer.");
    }

    // Check for duplicate active reservation on this match
    const existingRes = Array.from(capacityReservationsStore.values()).find(
      (r) => r.match_id === matchId && r.status === "ACTIVE"
    );
    if (existingRes) {
      return fail(res, 409, `An active reservation (${existingRes.reservation_code}) already exists for this match.`);
    }

    const centre = centreCapacityStore.get(match.centre_id);
    if (!centre) return fail(res, 404, "Centre capacity profile not found.");

    // ATOMIC CONCURRENCY CHECK:
    // Ensure available_seats >= reserveSeats before modifying
    const currentAvailable = centre.operational_seats - centre.occupied_seats - centre.reserved_seats;
    if (currentAvailable < reserveSeats) {
      logSecurityEvent({
        action: "OVER_ALLOCATION_PREVENTED",
        actorAdminId: req.admin!.id,
        targetId: String(centre.centre_id),
        details: { centre_id: centre.centre_id, available: currentAvailable, requested: reserveSeats },
      });
      return fail(
        res,
        409,
        `Capacity over-allocation prevented: Centre only has ${currentAvailable} available seats, but ${reserveSeats} were requested.`
      );
    }

    // Transactionally update reserved seats
    centre.reserved_seats += reserveSeats;
    centre.available_seats = calculateAvailableSeats(
      centre.operational_seats,
      centre.occupied_seats,
      centre.reserved_seats
    );

    if (centre.available_seats === 0) {
      centre.capacity_status = "FULL";
    } else if (centre.available_seats <= 15) {
      centre.capacity_status = "LIMITED";
    }
    centre.last_updated_at = new Date().toISOString();
    centreCapacityStore.set(centre.centre_id, centre);

    const resId = ++nextResId;
    const resCode = padCode("THK-RES", resId);
    const days = Math.max(1, Number(expires_in_days) || 14);
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

    const reservationRecord: BpoCapacityReservationRecord = {
      id: resId,
      reservation_code: resCode,
      requirement_id: match.requirement_id,
      requirement_code: match.requirement_code,
      match_id: matchId,
      centre_id: centre.centre_id,
      centre_name: centre.centre_name,
      partner_id: centre.partner_id,
      partner_name: centre.partner_name,
      reserved_seats: reserveSeats,
      status: "ACTIVE",
      reservation_start: new Date().toISOString().slice(0, 10),
      reservation_expires_at: expiresAt,
      created_by_admin_id: req.admin!.id,
      created_at: new Date().toISOString(),
    };

    capacityReservationsStore.set(resId, reservationRecord);

    // Update match status to ACCEPTED if it was PROPOSED
    if (match.match_status === "PROPOSED") {
      match.match_status = "ACCEPTED";
      match.reviewed_by_admin_id = req.admin!.id;
      match.reviewed_at = new Date().toISOString();
      capacityMatchesStore.set(matchId, match);
    }

    recordCapacityHistory({
      centre_id: centre.centre_id,
      centre_name: centre.centre_name,
      partner_id: centre.partner_id,
      timestamp: new Date().toISOString(),
      changed_by: "Operations Admin",
      total_seats: centre.total_seats,
      operational_seats: centre.operational_seats,
      occupied_seats: centre.occupied_seats,
      reserved_seats: centre.reserved_seats,
      available_seats: centre.available_seats,
      utilization_percentage: centre.utilization_percentage,
      reason: `Reservation ${resCode}: ${reserveSeats} seats reserved atomically`,
    });

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "capacity_reserved",
      entityType: "bpo_capacity_reservations",
      entityId: resCode,
      metadata: { matchId, centreId: centre.centre_id, reservedSeats: reserveSeats, expiresAt },
    });

    bpoStore.notifications.push({
      id: ++bpoStore.nextNotifId,
      recipient_partner_id: centre.partner_id,
      type: "capacity_reserved",
      title: "Capacity Reserved",
      body: `Reservation ${resCode} established: ${reserveSeats} seats reserved at ${centre.centre_name}.`,
      created_at: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: "Capacity reserved successfully with atomic concurrency control.",
      reservation: reservationRecord,
      updatedCentreCapacity: {
        operational_seats: centre.operational_seats,
        occupied_seats: centre.occupied_seats,
        reserved_seats: centre.reserved_seats,
        available_seats: centre.available_seats,
        capacity_status: centre.capacity_status,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/matches/:id/reserve failed");
    return fail(res, 500, "Failed to reserve capacity.", err.message);
  }
});

/**
 * POST /api/admin/capacity/reservations/:id/release
 * Releases a capacity reservation and restores available seats to the centre.
 */
router.post("/admin/capacity/reservations/:id/release", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const resId = parseNumber(req.params.id);
    if (!resId) return fail(res, 400, "Invalid reservation ID.");

    const reservation = capacityReservationsStore.get(resId);
    if (!reservation) return fail(res, 404, "Reservation not found.");

    if (reservation.status !== "ACTIVE") {
      return fail(res, 400, `Cannot release reservation in "${reservation.status}" status.`);
    }

    const { release_reason } = req.body;
    const centre = centreCapacityStore.get(reservation.centre_id);
    if (centre) {
      centre.reserved_seats = Math.max(0, centre.reserved_seats - reservation.reserved_seats);
      centre.available_seats = calculateAvailableSeats(
        centre.operational_seats,
        centre.occupied_seats,
        centre.reserved_seats
      );
      if (centre.available_seats > 15 && centre.capacity_status === "LIMITED") {
        centre.capacity_status = "AVAILABLE";
      } else if (centre.available_seats > 0 && centre.capacity_status === "FULL") {
        centre.capacity_status = centre.available_seats <= 15 ? "LIMITED" : "AVAILABLE";
      }
      centre.last_updated_at = new Date().toISOString();
      centreCapacityStore.set(centre.centre_id, centre);

      recordCapacityHistory({
        centre_id: centre.centre_id,
        centre_name: centre.centre_name,
        partner_id: centre.partner_id,
        timestamp: new Date().toISOString(),
        changed_by: "Operations Admin",
        total_seats: centre.total_seats,
        operational_seats: centre.operational_seats,
        occupied_seats: centre.occupied_seats,
        reserved_seats: centre.reserved_seats,
        available_seats: centre.available_seats,
        utilization_percentage: centre.utilization_percentage,
        reason: `Reservation ${reservation.reservation_code} released: ${reservation.reserved_seats} seats restored`,
      });
    }

    reservation.status = "RELEASED";
    reservation.released_at = new Date().toISOString();
    reservation.release_reason = sanitizeString(release_reason || "Released by Operations Administrator");
    capacityReservationsStore.set(resId, reservation);

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "reservation_released",
      entityType: "bpo_capacity_reservations",
      entityId: reservation.reservation_code,
      metadata: { resId, centreId: reservation.centre_id, releasedSeats: reservation.reserved_seats },
    });

    if (centre) {
      bpoStore.notifications.push({
        id: ++bpoStore.nextNotifId,
        recipient_partner_id: centre.partner_id,
        type: "reservation_released",
        title: "Capacity Reservation Released",
        body: `Reservation ${reservation.reservation_code} for ${reservation.reserved_seats} seats was released. Available seats restored.`,
        created_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      message: "Capacity reservation released and available capacity restored.",
      reservation,
      updatedCentreCapacity: centre
        ? {
            operational_seats: centre.operational_seats,
            occupied_seats: centre.occupied_seats,
            reserved_seats: centre.reserved_seats,
            available_seats: centre.available_seats,
            capacity_status: centre.capacity_status,
          }
        : null,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/reservations/:id/release failed");
    return fail(res, 500, "Failed to release reservation.", err.message);
  }
});

/**
 * POST /api/admin/capacity/centres/:id/release-occupied
 * Phase 2 Project Completion: Atomically decrements occupied seats and restores available capacity.
 */
router.post("/admin/capacity/centres/:id/release-occupied", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const centreId = parseNumber(req.params.id);
    if (!centreId) return fail(res, 400, "Invalid centre ID.");

    const centre = centreCapacityStore.get(centreId);
    if (!centre) return fail(res, 404, "Centre not found.");

    const { seats_to_release, reason } = req.body;
    const releaseSeats = parseNumber(seats_to_release);
    if (!releaseSeats || releaseSeats <= 0) {
      return fail(res, 400, "seats_to_release must be a positive integer.");
    }

    if (releaseSeats > centre.occupied_seats) {
      return fail(
        res,
        400,
        `Cannot release ${releaseSeats} seats: Centre currently only has ${centre.occupied_seats} occupied seats.`
      );
    }

    centre.occupied_seats = Math.max(0, centre.occupied_seats - releaseSeats);
    centre.available_seats = calculateAvailableSeats(
      centre.operational_seats,
      centre.occupied_seats,
      centre.reserved_seats
    );
    centre.utilization_percentage = calculateUtilization(
      centre.operational_seats,
      centre.occupied_seats
    );
    if (centre.available_seats > 15 && (centre.capacity_status === "FULL" || centre.capacity_status === "LIMITED")) {
      centre.capacity_status = "AVAILABLE";
    }
    centre.last_updated_at = new Date().toISOString();
    centreCapacityStore.set(centreId, centre);

    const actionReason = sanitizeString(reason || `Project completion: ${releaseSeats} seats released`);

    recordCapacityHistory({
      centre_id: centreId,
      centre_name: centre.centre_name,
      partner_id: centre.partner_id,
      timestamp: new Date().toISOString(),
      changed_by: "Operations Admin",
      total_seats: centre.total_seats,
      operational_seats: centre.operational_seats,
      occupied_seats: centre.occupied_seats,
      reserved_seats: centre.reserved_seats,
      available_seats: centre.available_seats,
      utilization_percentage: centre.utilization_percentage,
      reason: actionReason,
    });

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "project_capacity_released",
      entityType: "bpo_centre_capacity",
      entityId: String(centreId),
      metadata: { releaseSeats, reason: actionReason, updatedAvailable: centre.available_seats },
    });

    return res.json({
      success: true,
      message: `Successfully released ${releaseSeats} occupied seats. Available seats increased to ${centre.available_seats}.`,
      updatedCapacity: centre,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/centres/:id/release-occupied failed");
    return fail(res, 500, "Failed to release occupied capacity.", err.message);
  }
});

/**
 * POST /api/admin/capacity/matches/:id/allocate
 * Phase 2 Project Allocation Integration: Explicit, controlled bridge from
 * verified capacity reservation to a Phase 2 project allocation.
 * DO NOT automatically trigger on match; requires explicit admin action.
 */
router.post("/admin/capacity/matches/:id/allocate", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();
    const matchId = parseNumber(req.params.id);
    if (!matchId) return fail(res, 400, "Invalid match ID.");

    const match = capacityMatchesStore.get(matchId);
    if (!match) return fail(res, 404, "Capacity match not found.");

    const reservation = Array.from(capacityReservationsStore.values()).find(
      (r) => r.match_id === matchId && r.status === "ACTIVE"
    );
    if (!reservation) {
      return fail(res, 400, "An active capacity reservation is required before formal project allocation.");
    }

    const reqRecord = capacityRequirementsStore.get(match.requirement_id);
    if (!reqRecord) return fail(res, 404, "Requirement not found.");

    const centre = centreCapacityStore.get(match.centre_id);
    if (!centre) return fail(res, 404, "Centre not found.");

    // Convert reservation from reserved to occupied
    centre.reserved_seats = Math.max(0, centre.reserved_seats - reservation.reserved_seats);
    centre.occupied_seats += reservation.reserved_seats;
    centre.available_seats = calculateAvailableSeats(centre.operational_seats, centre.occupied_seats, centre.reserved_seats);
    centre.utilization_percentage = calculateUtilization(centre.operational_seats, centre.occupied_seats);
    centre.last_updated_at = new Date().toISOString();
    centreCapacityStore.set(centre.centre_id, centre);

    reservation.status = "CONVERTED";
    capacityReservationsStore.set(reservation.id, reservation);

    reqRecord.status = "ALLOCATED";
    reqRecord.updated_at = new Date().toISOString();
    capacityRequirementsStore.set(reqRecord.id, reqRecord);

    // Create or associate Phase 2 project
    const projId = ++bpoStore.nextProjectId;
    const newProject: BpoProjectRecord = {
      id: projId,
      name: `${reqRecord.title} [Campaign]`,
      vertical: "Enterprise Services",
      process_type: reqRecord.process_type,
      shift: reqRecord.shift,
      target_geography: reqRecord.location_requirement || "Global",
      required_seats: reservation.reserved_seats,
      payout_rate: "$16.50 / hour / agent",
      billing_cycle: "Bi-weekly Net 15",
      min_experience_years: reqRecord.minimum_experience_years,
      requires_us_experience: false,
      requires_uk_experience: false,
      min_centre_capacity: reservation.reserved_seats,
      scope: reqRecord.notes || `Contracted delivery for ${reqRecord.title}`,
      sla_details: { target_csat: "92%", target_qa: "90%", target_aht: "320s", target_attendance: "96%" },
      status: "allocated",
      allocated_partner_id: centre.partner_id,
      allocated_centre_id: centre.centre_id,
      allocated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    bpoStore.projects.set(projId, newProject);

    const partnerProjId = ++bpoStore.nextPartnerProjectId;
    bpoStore.partnerProjects.set(partnerProjId, {
      id: partnerProjId,
      partner_id: centre.partner_id,
      project_id: projId,
      centre_id: centre.centre_id,
      campaign_name: newProject.name,
      target: "Initial Launch Phase",
      status: "active",
      assigned_at: new Date().toISOString(),
    });

    await logCapacityAuditEvent({
      actorAdminId: req.admin!.id,
      action: "capacity_allocated_to_project",
      entityType: "bpo_projects",
      entityId: String(projId),
      metadata: {
        requirementCode: reqRecord.requirement_code,
        matchCode: match.match_code,
        reservationCode: reservation.reservation_code,
        centreId: centre.centre_id,
        seats: reservation.reserved_seats,
      },
    });

    bpoStore.notifications.push({
      id: ++bpoStore.nextNotifId,
      recipient_partner_id: centre.partner_id,
      type: "project_allocated",
      title: "New Project Allocated from Marketplace",
      body: `Project "${newProject.name}" allocated to ${centre.centre_name} with ${reservation.reserved_seats} seats.`,
      created_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: "Capacity reservation successfully converted into Phase 2 Project Allocation.",
      projectId: projId,
      project: newProject,
      requirement: reqRecord,
      reservation,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/capacity/matches/:id/allocate failed");
    return fail(res, 500, "Failed to allocate project from capacity.", err.message);
  }
});

/**
 * GET /api/admin/capacity/reports/export
 * Generates an authorized CSV export of capacity profiles and requirements.
 * Sanitizes all formula injection characters.
 */
router.get("/admin/capacity/reports/export", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    initCapacitySeeds();

    const headers = [
      "Centre ID",
      "Centre Name",
      "Partner Name",
      "Location",
      "Total Seats",
      "Operational Seats",
      "Occupied Seats",
      "Reserved Seats",
      "Available Seats",
      "Utilization Rate",
      "Capacity Status",
      "Available From",
      "Supported Processes",
      "Supported Channels",
      "Supported Shifts",
    ];

    const rows = Array.from(centreCapacityStore.values()).map((c) => [
      escapeCsvCell(c.centre_id),
      escapeCsvCell(c.centre_name),
      escapeCsvCell(c.partner_name),
      escapeCsvCell(c.location),
      escapeCsvCell(c.total_seats),
      escapeCsvCell(c.operational_seats),
      escapeCsvCell(c.occupied_seats),
      escapeCsvCell(c.reserved_seats),
      escapeCsvCell(c.available_seats),
      escapeCsvCell(`${c.utilization_percentage}%`),
      escapeCsvCell(c.capacity_status),
      escapeCsvCell(c.available_from),
      escapeCsvCell(c.supported_processes.join("; ")),
      escapeCsvCell(c.supported_channels.join("; ")),
      escapeCsvCell(c.supported_shifts.join("; ")),
    ]);

    const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="thinkatic-capacity-report.csv"');
    return res.send(csvContent);
  } catch (err: any) {
    logger.error({ err }, "GET /api/admin/capacity/reports/export failed");
    return fail(res, 500, "Failed to export capacity report.", err.message);
  }
});

export default router;
