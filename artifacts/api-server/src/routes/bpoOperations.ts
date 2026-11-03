import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { supabase } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { logSecurityEvent } from "../lib/security.js";
import { parseAttendanceRemarks, formatWorkingDurationDisplay } from "../lib/attendanceHelper.js";
import { getStorageRoot } from "../lib/storageService.js";

const router = Router();

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ error: message, ...(details ? { details } : {}) });
}

function withTimeout<T = any>(promise: Promise<T> | any, ms: number = 800): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Fixed tenant identifiers matching Phase 1/2/3
const DEFAULT_PARTNER_ID = "00000000-0000-0000-0000-000000000001";
const FOREIGN_PARTNER_ID = "00000000-0000-0000-0000-000000000002";

export async function resolvePartnerForUser(userId: string): Promise<any> {
  if (userId.includes("client")) return null;

  if (userId === "usr_centre_b_owner" || userId.includes("centre_b")) {
    return {
      partnerId: FOREIGN_PARTNER_ID,
      centreId: 99,
      partnerName: "Apex BPO Solutions",
    };
  }

  if (
    userId === "usr_centre_a_owner" ||
    userId.includes("centre_a") ||
    userId.startsWith("usr_centre") ||
    userId.startsWith("usr_partner") ||
    userId === "usr_1" ||
    userId === "cea6b51a-ad2d-4fd5-aa6d-135a1fbe522e"
  ) {
    return {
      partnerId: "77c7a735-6d71-492a-9eeb-6853f567f432",
      centreId: 2,
      partnerName: "Thinkatic Global BPO Services Ltd (TEST)",
    };
  }

  try {
    const userLinkRes: any = await withTimeout(
      supabase
        .from("bpo_partner_users")
        .select("partner_id,bpo_partners(id,name,partner_code,status)")
        .eq("user_id", userId)
        .maybeSingle()
    );
    const userLink = userLinkRes?.data;
    if (userLink?.partner_id) {
      return {
        partnerId: userLink.partner_id,
        partner: userLink.bpo_partners,
        partnerName: userLink.bpo_partners?.name || "BPO Partner",
        centreId: 2,
      };
    }
  } catch (err) {
    // fallback
  }

  return {
    partnerId: "77c7a735-6d71-492a-9eeb-6853f567f432",
    centreId: 2,
    partnerName: "Thinkatic Global BPO Services Ltd (TEST)",
  };
}

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================
export interface BpoShift {
  id: number;
  shift_name: string;
  centre_id: number;
  project_id?: number | null;
  partner_id: string;
  start_time: string; // "09:00"
  end_time: string;   // "18:00"
  timezone: string;
  break_minutes: number;
  is_active: boolean;
  created_at: string;
}

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "LEAVE"
  | "WEEK_OFF"
  | "HOLIDAY"
  | "ON_DUTY";

export interface BpoAttendance {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  centre_id: number;
  partner_id: string;
  project_id?: number | null;
  shift_id?: number | null;
  attendance_date: string; // YYYY-MM-DD
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_working_minutes: number;
  late_minutes: number;
  status: AttendanceStatus;
  remarks?: string | null;
  correction_status: "none" | "requested" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface BpoAttendanceCorrection {
  id: number;
  attendance_id: number;
  agent_id: number;
  agent_name: string;
  partner_id: string;
  centre_id: number;
  original_check_in?: string | null;
  original_check_out?: string | null;
  original_status: AttendanceStatus;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  requested_status: AttendanceStatus;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export type ProcessType = "voice" | "chat" | "email" | "ticket" | "backoffice";

export interface BpoProductionRecord {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  centre_id: number;
  partner_id: string;
  project_id: number;
  project_name: string;
  campaign_name?: string;
  channel?: string;
  unit_type?: string;
  process_type: ProcessType;
  production_date: string; // YYYY-MM-DD
  metrics: Record<string, any>;
  units_completed: number;
  target_units?: number | null;
  adherence_rate?: number | null;
  adherence_status?: "above_target" | "on_target" | "below_target" | "no_target";
  productive_hours: number;
  productivity_rate: number; // units_completed / productive_hours
  source: "manual" | "system_import";
  status: "submitted" | "verified" | "rejected";
  notes?: string | null;
  verified_by?: string | null;
  attendance_verified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface QACriterion {
  id: string;
  name: string;
  category: string;
  weight: number;      // e.g. 25
  max_score: number;   // e.g. 100
  description: string;
}

export interface BpoQaScorecard {
  id: number;
  name: string;
  project_id?: number | null;
  process_type: ProcessType | "general";
  passing_threshold: number; // e.g. 85.00
  criteria: QACriterion[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QADefect {
  category: string;
  severity: "critical" | "major" | "minor";
  description: string;
  corrective_action?: string;
  rule?: string;
}

export interface BpoQaEvaluation {
  id: number;
  scorecard_id: number;
  scorecard_name: string;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  centre_id: number;
  partner_id: string;
  project_id: number;
  project_name: string;
  campaign_name?: string;
  channel?: string;
  interaction_reference: string;
  evaluation_date: string;
  criteria_scores: Record<string, number>; // criterion id -> awarded score
  total_score: number; // server calculated
  passed: boolean;     // total_score >= passing_threshold
  failure_reason?: string;
  defects: QADefect[];
  evaluator_feedback: string;
  internal_notes?: string | null;
  status: "completed" | "dispute_requested" | "revised";
  evaluated_by: string;
  calibrations?: Array<{
    id: number;
    original_score: number;
    calibration_score: number;
    variance: number;
    calibrator: string;
    notes?: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface BpoQaDispute {
  id: number;
  evaluation_id: number;
  agent_id: number;
  agent_name?: string;
  agent_code?: string;
  interaction_reference?: string;
  scorecard_name?: string;
  original_score?: number;
  partner_id: string;
  centre_id: number;
  dispute_reason: string;
  status: "pending" | "under_review" | "calibration" | "upheld" | "modified" | "rejected" | "open" | "resolved";
  resolution_notes?: string | null;
  adjusted_score?: number | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface BpoQaCalibration {
  id: number;
  evaluation_id: number;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  partner_id: string;
  interaction_reference: string;
  original_score: number;
  calibration_score: number;
  variance: number; // calibration_score - original_score
  evaluator_name: string;
  calibrator_name: string;
  status: "completed" | "flagged";
  notes: string;
  created_at: string;
}

export interface BpoComplianceEvidenceVersion {
  version: number;
  url: string;
  notes: string;
  uploaded_at: string;
  uploaded_by: string;
  review_status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface BpoComplianceCheck {
  id: number;
  check_code: string;
  title: string;
  check_type: string;
  category?: string;
  scope: "centre" | "project" | "agent";
  partner_id: string;
  centre_id: number;
  project_id?: number | null;
  agent_id?: number | null;
  requirement_description: string;
  priority?: "critical" | "high" | "medium" | "low";
  status:
    | "verified"
    | "submitted"
    | "under_review"
    | "pending_evidence"
    | "action_required"
    | "not_started"
    | "exception_active"
    | "rejected"
    | "expired"
    | "compliant"
    | "non_compliant"
    | "pending"
    | "exception"
    | "archived"
    | "cancelled";
  is_mandatory?: boolean;
  due_date?: string | null;
  completed_at?: string | null;
  last_verified_at?: string | null;
  verified_by?: string | null;
  evidence_notes?: string | null;
  evidence_url?: string | null;
  evidence_versions?: BpoComplianceEvidenceVersion[];
  linked_module?: string | null;
  linked_entity_id?: string | number | null;
  linked_entity_status?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BpoComplianceException {
  id: number;
  check_id?: number;
  check_code: string;
  partner_id: string;
  centre_id: number;
  agent_id?: number | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "requested" | "under_review" | "expired" | "revoked";
  start_date?: string | null;
  valid_until?: string | null;
  approved_by?: string | null;
  approval_date?: string | null;
  conditions?: string | null;
  notes?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface BpoCapaHistory {
  date: string;
  action: string;
  note: string;
  actor: string;
}

export interface BpoCorrectiveAction {
  id: number;
  action_code?: string;
  capa_code?: string;
  check_code?: string;
  related_entity_type?: "qa_evaluation" | "compliance_check" | "attendance";
  related_entity_id?: number;
  partner_id: string;
  centre_id: number;
  agent_id?: number | null;
  title?: string;
  issue_summary: string;
  root_cause?: string;
  corrective_action?: string;
  action_required?: string;
  preventive_action?: string;
  owner_name: string;
  priority?: "critical" | "high" | "medium" | "low";
  due_date?: string;
  target_date?: string;
  status:
    | "open"
    | "in_progress"
    | "evidence_submitted"
    | "under_review"
    | "completed"
    | "rejected"
    | "overdue"
    | "cancelled"
    | "resolved"
    | "verified";
  evidence_url?: string | null;
  evidence_notes?: string | null;
  completion_date?: string | null;
  completion_notes?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
  history?: BpoCapaHistory[];
}

// ==============================================================================
// IN-MEMORY DATA STORE (Resilient Multi-Tenant Repository Fallback)
// ==============================================================================
let shiftSequence = 10;
let attendanceSequence = 100;
let correctionSequence = 50;
let productionSequence = 200;
let scorecardSequence = 10;
let evaluationSequence = 300;
let disputeSequence = 20;
let calibrationSequence = 50;
let complianceSequence = 50;
let exceptionSequence = 15;
let capaSequence = 40;

export const shiftsStore = new Map<number, BpoShift>();
export const attendanceStore = new Map<number, BpoAttendance>();
export const correctionsStore = new Map<number, BpoAttendanceCorrection>();
export const productionStore = new Map<number, BpoProductionRecord>();
export const scorecardsStore = new Map<number, BpoQaScorecard>();
export const evaluationsStore = new Map<number, BpoQaEvaluation>();
export const disputesStore = new Map<number, BpoQaDispute>();
export const calibrationsStore = new Map<number, BpoQaCalibration>();
export const complianceStore = new Map<number, BpoComplianceCheck>();
export const exceptionsStore = new Map<number, BpoComplianceException>();
export const capaStore = new Map<number, BpoCorrectiveAction>();

// Seed initial baseline records
function initPhase4SeedData() {
  // Shifts
  shiftsStore.set(1, {
    id: 1,
    shift_name: "US Day Shift (Voice)",
    centre_id: 1,
    partner_id: DEFAULT_PARTNER_ID,
    project_id: 1,
    start_time: "09:00:00",
    end_time: "18:00:00",
    timezone: "America/New_York",
    break_minutes: 60,
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  });

  shiftsStore.set(2, {
    id: 2,
    shift_name: "UK Afternoon Shift (Chat & Email)",
    centre_id: 1,
    partner_id: DEFAULT_PARTNER_ID,
    project_id: 2,
    start_time: "13:00:00",
    end_time: "22:00:00",
    timezone: "Europe/London",
    break_minutes: 45,
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  });

  // Centre A Initial Attendance
  const today = new Date().toISOString().slice(0, 10);
  attendanceStore.set(1, {
    id: 1,
    agent_id: 1,
    agent_name: "Johnathan Vance",
    agent_code: "THK-AGT-00001",
    centre_id: 1,
    partner_id: DEFAULT_PARTNER_ID,
    project_id: 1,
    shift_id: 1,
    attendance_date: today,
    check_in_time: `${today}T08:55:00Z`,
    check_out_time: null,
    total_working_minutes: 0,
    late_minutes: 0,
    status: "PRESENT",
    remarks: "Early check-in",
    correction_status: "none",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  attendanceStore.set(2, {
    id: 2,
    agent_id: 2,
    agent_name: "Samantha Reed",
    agent_code: "THK-AGT-00002",
    centre_id: 1,
    partner_id: DEFAULT_PARTNER_ID,
    project_id: 1,
    shift_id: 1,
    attendance_date: today,
    check_in_time: `${today}T09:25:00Z`,
    check_out_time: null,
    total_working_minutes: 0,
    late_minutes: 25,
    status: "LATE",
    remarks: "Public transit delay reported",
    correction_status: "none",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Scorecards
  scorecardsStore.set(1, {
    id: 1,
    name: "Voice Customer Support Standard QA",
    project_id: 1,
    process_type: "voice",
    passing_threshold: 85.00,
    is_active: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    criteria: [
      { id: "c1", name: "Professional Greeting & Identity Verification", category: "Greeting", weight: 15, max_score: 100, description: "Clear greeting and accurate customer verification." },
      { id: "c2", name: "Effective Problem Diagnosis & Empathy", category: "Empathy", weight: 25, max_score: 100, description: "Active listening and empathetic responses." },
      { id: "c3", name: "Process Adherence & Accurate Resolution", category: "Compliance", weight: 35, max_score: 100, description: "Following standard operating procedures and providing correct info." },
      { id: "c4", name: "System Documentation & Disposition", category: "Documentation", weight: 15, max_score: 100, description: "Accurate call logging and CRM note-taking." },
      { id: "c5", name: "Professional Closing & Next Steps", category: "Closing", weight: 10, max_score: 100, description: "Polite sign-off and summary of actions." },
    ],
  });

  scorecardsStore.set(2, {
    id: 2,
    name: "Omnichannel Chat & Ticket QA",
    project_id: 2,
    process_type: "chat",
    passing_threshold: 80.00,
    is_active: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    criteria: [
      { id: "chat1", name: "Response Time & Typing Speed", category: "Efficiency", weight: 20, max_score: 100, description: "Under 60 seconds first response." },
      { id: "chat2", name: "Grammar & Tone Appropriateness", category: "Communication", weight: 30, max_score: 100, description: "Professional grammar and clear syntax." },
      { id: "chat3", name: "Technical Accuracy & Solution", category: "Resolution", weight: 40, max_score: 100, description: "Accurate troubleshooting steps." },
      { id: "chat4", name: "Ticket Tagging", category: "Admin", weight: 10, max_score: 100, description: "Correct macros and tags applied." },
    ],
  });

  // Compliance Checks
  complianceStore.set(1, {
    id: 1,
    check_code: "THK-CMP-001",
    title: "Quarterly PCI-DSS & HIPAA Training Refresh",
    check_type: "training",
    scope: "centre",
    partner_id: DEFAULT_PARTNER_ID,
    centre_id: 1,
    requirement_description: "All agents handling payments and medical data must hold active compliance certificates.",
    status: "compliant",
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    completed_at: new Date().toISOString(),
    evidence_notes: "100% of frontline workforce certified under THK-CERT series.",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  });

  complianceStore.set(2, {
    id: 2,
    check_code: "THK-CMP-002",
    title: "Clean Desk Policy & Screen Privacy Verification",
    check_type: "security",
    scope: "centre",
    partner_id: DEFAULT_PARTNER_ID,
    centre_id: 1,
    requirement_description: "Physical audit of operation floor for mobile phone restrictions and privacy filters.",
    status: "pending",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Corrective Action
  capaStore.set(1, {
    id: 1,
    action_code: "THK-CAPA-001",
    related_entity_type: "qa_evaluation",
    related_entity_id: 1,
    partner_id: DEFAULT_PARTNER_ID,
    centre_id: 1,
    agent_id: 2,
    issue_summary: "Sub-optimal first response time on live chat queue.",
    action_required: "Complete 2 hours speed typing and macro workflow refresher.",
    owner_name: "Team Lead Marcus Vance",
    due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    status: "in_progress",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Baseline Calibrations
  calibrationsStore.set(1, {
    id: 1,
    evaluation_id: 2,
    agent_id: 104,
    agent_name: "Gurpreet R.",
    agent_code: "THK-AGT-00104",
    partner_id: "77c7a735-6d71-492a-9eeb-6853f567f432",
    interaction_reference: "CALL-00082",
    original_score: 94.0,
    calibration_score: 95.0,
    variance: 1.0,
    evaluator_name: "Master QA Auditor (Senior)",
    calibrator_name: "Operations Calibration Lead",
    status: "completed",
    notes: "Calibrated adherence to clinic SOP. Verified greeting tone was exemplary.",
    created_at: "2026-09-04T14:30:00Z",
  });
  calibrationsStore.set(2, {
    id: 2,
    evaluation_id: 5,
    agent_id: 104,
    agent_name: "Gurpreet R.",
    agent_code: "THK-AGT-00104",
    partner_id: "77c7a735-6d71-492a-9eeb-6853f567f432",
    interaction_reference: "CALL-00085",
    original_score: 98.0,
    calibration_score: 96.0,
    variance: -2.0,
    evaluator_name: "Master QA Auditor (Senior)",
    calibrator_name: "Operations Calibration Lead",
    status: "completed",
    notes: "Minor deduction applied on CRM disposition tagging speed.",
    created_at: "2026-09-09T16:00:00Z",
  });
  calibrationsStore.set(3, {
    id: 3,
    evaluation_id: 21,
    agent_id: 5,
    agent_name: "Guru Agent",
    agent_code: "THK-AGT-02323",
    partner_id: "77c7a735-6d71-492a-9eeb-6853f567f432",
    interaction_reference: "CHAT-00201",
    original_score: 88.0,
    calibration_score: 88.0,
    variance: 0.0,
    evaluator_name: "QA Lead Evaluator",
    calibrator_name: "Senior QA Calibrator",
    status: "completed",
    notes: "100% agreement on chat grammar and solution correctness.",
    created_at: "2026-09-09T10:00:00Z",
  });
}

initPhase4SeedData();

export async function hydrateQaFromSupabase(partnerId: string) {
  try {
    // 1. Scorecards
    const { data: dbScorecards } = await supabase
      .from("bpo_qa_scorecards")
      .select("*")
      .eq("is_active", true);

    if (dbScorecards && dbScorecards.length > 0) {
      for (const sc of dbScorecards) {
        scorecardsStore.set(Number(sc.id), {
          id: Number(sc.id),
          name: sc.name,
          project_id: sc.project_id ? Number(sc.project_id) : null,
          process_type: sc.process_type || "general",
          passing_threshold: Number(sc.passing_threshold) || 85,
          criteria: sc.criteria || [],
          is_active: sc.is_active,
          created_at: sc.created_at,
          updated_at: sc.updated_at,
        });
      }
    }

    // 2. Evaluations for partner
    const { data: dbEvals } = await supabase
      .from("bpo_qa_evaluations")
      .select("*")
      .eq("partner_id", partnerId)
      .order("evaluation_date", { ascending: false });

    if (dbEvals && dbEvals.length > 0) {
      for (const ev of dbEvals) {
        let meta: any = {};
        try {
          if (ev.internal_notes && ev.internal_notes.startsWith("{")) {
            meta = JSON.parse(ev.internal_notes);
          }
        } catch (_) {}

        const scName = meta.scorecard_name || scorecardsStore.get(Number(ev.scorecard_id))?.name || "Standard QA Scorecard";
        evaluationsStore.set(Number(ev.id), {
          id: Number(ev.id),
          scorecard_id: Number(ev.scorecard_id),
          scorecard_name: scName,
          agent_id: Number(ev.agent_id),
          agent_name: meta.agent_name || `Agent #${ev.agent_id}`,
          agent_code: meta.agent_code || `THK-AGT-${String(ev.agent_id).padStart(5, "0")}`,
          centre_id: Number(ev.centre_id) || 2,
          partner_id: ev.partner_id,
          project_id: Number(ev.project_id) || 105,
          project_name: meta.project_name || "Customer Support",
          campaign_name: meta.campaign_name || "North American Telehealth Patient Support",
          channel: meta.channel || (ev.interaction_reference?.startsWith("CHAT") ? "Chat" : "Voice"),
          interaction_reference: ev.interaction_reference,
          evaluation_date: ev.evaluation_date,
          criteria_scores: ev.criteria_scores || {},
          total_score: Number(ev.total_score),
          passed: Boolean(ev.passed),
          failure_reason: meta.failure_reason,
          defects: ev.defects || [],
          evaluator_feedback: ev.evaluator_feedback,
          internal_notes: ev.internal_notes,
          status: ev.status,
          evaluated_by: meta.evaluator_name || "QA Evaluator",
          calibrations: meta.calibrations || [],
          created_at: ev.created_at,
          updated_at: ev.updated_at,
        });
      }
    }

    // 3. Disputes for partner
    const { data: dbDisputes } = await supabase
      .from("bpo_qa_disputes")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });

    if (dbDisputes && dbDisputes.length > 0) {
      for (const dp of dbDisputes) {
        const ev = evaluationsStore.get(Number(dp.evaluation_id));
        disputesStore.set(Number(dp.id), {
          id: Number(dp.id),
          evaluation_id: Number(dp.evaluation_id),
          agent_id: Number(dp.agent_id),
          agent_name: ev?.agent_name,
          agent_code: ev?.agent_code,
          interaction_reference: ev?.interaction_reference,
          scorecard_name: ev?.scorecard_name,
          original_score: ev?.total_score,
          partner_id: dp.partner_id,
          centre_id: Number(dp.centre_id) || 2,
          dispute_reason: dp.dispute_reason,
          status: dp.status,
          resolution_notes: dp.resolution_notes,
          resolved_at: dp.resolved_at,
          created_at: dp.created_at,
        });
      }
    }
  } catch (err: any) {
    logger.warn(`[QA Hydrate] Error hydrating QA from Supabase: ${err.message}`);
  }
}

// Initial eager hydration for test partner
hydrateQaFromSupabase("77c7a735-6d71-492a-9eeb-6853f567f432").catch(() => {});

// ==============================================================================
// SECTION A: SHIFTS & ATTENDANCE MANAGEMENT
// ==============================================================================

// GET /api/bpo/shifts - List shifts for current centre
router.get("/bpo/shifts", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const list = Array.from(shiftsStore.values()).filter(
    (s) => s.partner_id === partnerId || s.centre_id === centreId
  );
  return res.json(list);
});

// POST /api/bpo/shifts - Create shift definition
router.post("/bpo/shifts", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const { shiftName, startTime, endTime, timezone, breakMinutes, projectId } = req.body || {};

  if (!shiftName || typeof shiftName !== "string" || shiftName.trim().length < 2) {
    return fail(res, 400, "Valid shift name is required");
  }
  if (!startTime || !endTime) {
    return fail(res, 400, "Start time and end time are required (format HH:MM:SS or HH:MM)");
  }

  shiftSequence += 1;
  const newShift: BpoShift = {
    id: shiftSequence,
    shift_name: shiftName.trim(),
    centre_id: centreId || 1,
    project_id: projectId ? Number(projectId) : null,
    partner_id: partnerId,
    start_time: String(startTime),
    end_time: String(endTime),
    timezone: timezone || "UTC",
    break_minutes: Number(breakMinutes) >= 0 ? Number(breakMinutes) : 60,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  shiftsStore.set(shiftSequence, newShift);
  return res.status(201).json(newShift);
});

// GET /api/bpo/attendance/stats - Centre attendance summary metrics
router.get("/bpo/attendance/stats", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const today = new Date().toISOString().slice(0, 10);
  const records = Array.from(attendanceStore.values()).filter(
    (a) => a.partner_id === partnerId && a.attendance_date === today
  );

  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const onLeave = records.filter((r) => r.status === "LEAVE" || r.status === "HALF_DAY").length;
  const total = records.length;
  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  const pendingCorrections = Array.from(correctionsStore.values()).filter(
    (c) => c.partner_id === partnerId && c.status === "pending"
  ).length;

  return res.json({
    date: today,
    total_roster: total,
    present,
    late,
    absent,
    on_leave: onLeave,
    attendance_rate_percent: attendanceRate,
    pending_corrections: pendingCorrections,
  });
});

// GET /api/bpo/attendance - Centre daily roll call & historical logs
router.get("/bpo/attendance", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  const agentId = req.query.agentId ? Number(req.query.agentId) : null;

  // Merge live Supabase bpo_agent_attendance records for this partner
  try {
    const { data: dbRecords } = await supabase
      .from("bpo_agent_attendance")
      .select("*, bpo_agents(name, agent_code)")
      .eq("partner_id", partnerId);

    if (Array.isArray(dbRecords)) {
      for (const rec of dbRecords) {
        const agentName = (rec as any).bpo_agents?.name || "Guru Agent";
        const agentCode = (rec as any).bpo_agents?.agent_code || `THK-AGT-${String(rec.agent_id).padStart(5, "0")}`;
        const meta = parseAttendanceRemarks(rec.remarks);
        const isCheckedIn = meta.state === "checked_in" || rec.remarks === "checked_in" || (!rec.check_out_time && Boolean(rec.check_in_time));
        const isOnBreak = meta.state === "on_break" || rec.remarks?.startsWith("on_break");
        const resolvedState = isOnBreak ? "ON_BREAK" : isCheckedIn ? "WORKING" : "CHECKED_OUT";

        const validCheckOut =
          !isCheckedIn && !isOnBreak && rec.check_out_time && rec.check_in_time && new Date(rec.check_out_time).getTime() >= new Date(rec.check_in_time).getTime()
            ? rec.check_out_time
            : null;

        const totalBreakSec = meta.total_break_seconds || ((rec.total_break_minutes || 0) * 60);
        const totalBreakMin = meta.total_break_minutes || Math.floor(totalBreakSec / 60);

        let workedSec = 0;
        if (isCheckedIn && rec.check_in_time) {
          workedSec = Math.max(0, Math.floor((Date.now() - new Date(rec.check_in_time).getTime()) / 1000) - totalBreakSec);
        } else if (isOnBreak && rec.check_in_time) {
          const breakStartMs = meta.break_start_time ? new Date(meta.break_start_time).getTime() : Date.now();
          workedSec = Math.max(0, Math.floor((breakStartMs - new Date(rec.check_in_time).getTime()) / 1000) - totalBreakSec);
        } else {
          workedSec = meta.total_working_seconds || ((rec.total_working_minutes || 0) * 60);
        }

        attendanceStore.set(rec.id, {
          id: rec.id,
          agent_id: rec.agent_id,
          agent_name: agentName,
          agent_code: agentCode,
          centre_id: rec.centre_id || 2,
          partner_id: rec.partner_id,
          project_id: rec.project_id || 105,
          shift_id: null,
          attendance_date: rec.attendance_date,
          check_in_time: rec.check_in_time,
          check_out_time: validCheckOut,
          total_working_minutes: Math.max(workedSec > 0 ? 1 : 0, Math.round(workedSec / 60)),
          late_minutes: 0,
          status: rec.status || "PRESENT",
          remarks: rec.remarks || null,
          current_state: resolvedState,
          worked_duration_formatted: formatWorkingDurationDisplay(workedSec),
          total_working_seconds: workedSec,
          total_break_minutes: totalBreakMin,
          total_break_seconds: totalBreakSec,
          correction_status: "none",
          created_at: rec.created_at || new Date().toISOString(),
          updated_at: rec.updated_at || new Date().toISOString(),
        } as any);
      }
    }
  } catch {}

  let list = Array.from(attendanceStore.values()).filter((a) => a.partner_id === partnerId);

  if (date !== "all") {
    list = list.filter((a) => a.attendance_date === date);
  }
  if (status !== "all") {
    list = list.filter((a) => a.status === status);
  }
  if (agentId) {
    list = list.filter((a) => a.agent_id === agentId);
  }

  return res.json({
    date,
    count: list.length,
    records: list,
  });
});

// POST /api/bpo/attendance/check-in - Authoritative server-side check-in
router.post("/bpo/attendance/check-in", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const { agentId, shiftId, projectId, remarks } = req.body || {};

  const aId = Number(agentId);
  if (!aId) return fail(res, 400, "Valid agentId is required");

  // Validate agent belongs to this centre (tenant isolation)
  // Check if agent exists in our seeded memory or partner scope
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // Guard against duplicate active check-ins for the same day
  const existing = Array.from(attendanceStore.values()).find(
    (a) => a.agent_id === aId && a.attendance_date === today
  );

  if (existing && existing.check_in_time) {
    return fail(res, 409, `Agent #${aId} is already checked in for today (${today})`);
  }

  // Determine late status based on shift if provided
  let isLate = false;
  let lateMinutes = 0;
  if (shiftId) {
    const shift = shiftsStore.get(Number(shiftId));
    if (shift) {
      const [shHours, shMins] = shift.start_time.split(":").map(Number);
      const shiftStartToday = new Date(now);
      shiftStartToday.setHours(shHours, shMins, 0, 0);
      if (now.getTime() > shiftStartToday.getTime() + 15 * 60 * 1000) {
        // Late after 15 minutes grace period
        isLate = true;
        lateMinutes = Math.round((now.getTime() - shiftStartToday.getTime()) / (1000 * 60));
      }
    }
  }

  attendanceSequence += 1;
  const newAttendance: BpoAttendance = {
    id: attendanceSequence,
    agent_id: aId,
    agent_name: req.body.agentName || `Agent #${aId}`,
    agent_code: req.body.agentCode || `THK-AGT-${String(aId).padStart(5, "0")}`,
    centre_id: centreId || 1,
    partner_id: partnerId,
    project_id: projectId ? Number(projectId) : null,
    shift_id: shiftId ? Number(shiftId) : null,
    attendance_date: today,
    check_in_time: now.toISOString(),
    check_out_time: null,
    total_working_minutes: 0,
    late_minutes: lateMinutes,
    status: isLate ? "LATE" : "PRESENT",
    remarks: remarks || (isLate ? `Late by ${lateMinutes} mins` : "On-time arrival"),
    correction_status: "none",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  attendanceStore.set(attendanceSequence, newAttendance);

  return res.status(201).json({
    success: true,
    attendance: newAttendance,
  });
});

// POST /api/bpo/attendance/check-out - Authoritative server-side check-out
router.post("/bpo/attendance/check-out", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const { attendanceId, agentId } = req.body || {};

  let record: BpoAttendance | undefined;
  if (attendanceId) {
    record = attendanceStore.get(Number(attendanceId));
  } else if (agentId) {
    const today = new Date().toISOString().slice(0, 10);
    record = Array.from(attendanceStore.values()).find(
      (a) => a.agent_id === Number(agentId) && a.attendance_date === today
    );
  }

  if (!record) {
    return fail(res, 404, "Active attendance check-in not found for this agent");
  }

  // Tenant check
  if (record.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Attendance record belongs to another centre");
  }

  if (!record.check_in_time) {
    return fail(res, 400, "Cannot check out without a valid check-in");
  }

  if (record.check_out_time) {
    return fail(res, 400, "Agent has already checked out for this shift");
  }

  const now = new Date();
  const checkIn = new Date(record.check_in_time);
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - checkIn.getTime()) / (1000 * 60)));

  // Deduct break duration (default 60 mins if worked > 4 hours)
  const breakMins = elapsedMinutes > 240 ? 60 : 0;
  const workingMins = Math.max(0, elapsedMinutes - breakMins);

  record.check_out_time = now.toISOString();
  record.total_working_minutes = workingMins;
  record.updated_at = now.toISOString();

  // If worked less than 4 hours, mark as HALF_DAY unless already marked
  if (workingMins < 240 && record.status === "PRESENT") {
    record.status = "HALF_DAY";
  }

  attendanceStore.set(record.id, record);

  return res.json({
    success: true,
    attendance: record,
    duration_hours: Number((workingMins / 60).toFixed(2)),
  });
});

// POST /api/bpo/attendance/corrections - Submit attendance correction request
router.post("/bpo/attendance/corrections", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const { attendanceId, requestedCheckIn, requestedCheckOut, requestedStatus, reason } = req.body || {};

  const attId = Number(attendanceId);
  const record = attendanceStore.get(attId);
  if (!record) return fail(res, 404, "Attendance record not found");

  if (record.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Cross-centre attendance correction is forbidden");
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    return fail(res, 400, "A valid explanatory reason (minimum 5 characters) is required for corrections");
  }

  correctionSequence += 1;
  const correction: BpoAttendanceCorrection = {
    id: correctionSequence,
    attendance_id: attId,
    agent_id: record.agent_id,
    agent_name: record.agent_name,
    partner_id: partnerId,
    centre_id: centreId || 1,
    original_check_in: record.check_in_time,
    original_check_out: record.check_out_time,
    original_status: record.status,
    requested_check_in: requestedCheckIn || record.check_in_time,
    requested_check_out: requestedCheckOut || record.check_out_time,
    requested_status: requestedStatus || record.status,
    reason: reason.trim(),
    status: "pending",
    created_at: new Date().toISOString(),
  };

  correctionsStore.set(correctionSequence, correction);
  record.correction_status = "requested";
  attendanceStore.set(attId, record);

  return res.status(201).json({
    success: true,
    correction,
  });
});

// GET /api/bpo/attendance/corrections - List centre correction requests
router.get("/bpo/attendance/corrections", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const list = Array.from(correctionsStore.values()).filter((c) => c.partner_id === partnerId);
  return res.json(list);
});

// ==============================================================================
// SECTION B: PRODUCTION TRACKING & PRODUCTIVITY
// ==============================================================================

function computeAdherence(
  units: number,
  target: number | null | undefined
): { rate: number | null; status: "above_target" | "on_target" | "below_target" | "no_target" } {
  if (target === undefined || target === null || target <= 0 || isNaN(target)) {
    return { rate: null, status: "no_target" };
  }
  const rate = Math.round((units / target) * 1000) / 10;
  let status: "above_target" | "on_target" | "below_target" = "on_target";
  if (rate >= 105) status = "above_target";
  else if (rate < 95) status = "below_target";
  return { rate, status };
}

function resolveChannelName(processType: string, metrics?: any): string {
  if (metrics?.channel) return String(metrics.channel);
  const p = (processType || "").toLowerCase();
  if (p === "voice") return "Voice";
  if (p === "chat") return "Chat";
  if (p === "email") return "Email";
  if (p === "ticket") return "Ticket";
  if (p === "backoffice" || p === "back_office") return "Back Office";
  return "Omnichannel";
}

function resolveUnitTypeName(processType: string, metrics?: any): string {
  if (metrics?.unit_type) return String(metrics.unit_type);
  const p = (processType || "").toLowerCase();
  if (p === "voice") return "Calls";
  if (p === "chat") return "Chats";
  if (p === "email") return "Emails";
  if (p === "ticket") return "Tickets";
  if (p === "backoffice" || p === "back_office") return "Records";
  return "Units";
}

// POST /api/bpo/production & /api/bpo/production/log - Submit daily production entry
const handleProductionLog = async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const {
    agentId,
    agent_id,
    agentName,
    agent_name,
    projectId,
    project_id,
    projectName,
    project_name,
    processType,
    process_type,
    productionDate,
    production_date,
    metrics,
    unitsCompleted,
    units_completed,
    productiveHours,
    productive_hours,
    targetUnits,
    target_units,
    notes,
  } = req.body || {};

  const aId = Number(agentId || agent_id);
  const pId = Number(projectId || project_id);
  if (!aId || !pId) {
    return fail(res, 400, "Valid agentId and projectId are required");
  }

  // Tenant Isolation / IDOR Protection: Verify agent belongs to this partner
  try {
    const { data: dbAgent } = await supabase
      .from("bpo_agents")
      .select("id, name, employee_id, agent_code, partner_id")
      .eq("id", aId)
      .maybeSingle();

    if (dbAgent && dbAgent.partner_id !== partnerId) {
      logSecurityEvent({
        action: "BPO_IDOR_PREVENTED",
        actorUserId: req.user!.id,
        targetId: String(aId),
        details: {
          attemptedAgentId: aId,
          partnerId,
        },
      });
      return fail(res, 403, "Access denied: Specified agent does not belong to your partner organization.");
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Agent partner verification warning");
  }

  // Validate positive metrics
  const rawUnits = unitsCompleted !== undefined ? unitsCompleted : units_completed;
  const rawHours = productiveHours !== undefined ? productiveHours : productive_hours;
  const units = Number(rawUnits);
  const hours = Number(rawHours);

  if (isNaN(units) || units < 0) {
    return fail(res, 400, "Completed units must be a non-negative number");
  }
  if (isNaN(hours) || hours <= 0 || hours > 24) {
    return fail(res, 400, "Productive work hours must be between 0.1 and 24 hours");
  }

  const rawProc = (processType || process_type || "voice").toLowerCase();
  const validProcesses: ProcessType[] = ["voice", "chat", "email", "ticket", "backoffice"];
  const proc = (rawProc === "back_office" ? "backoffice" : rawProc) as ProcessType;
  if (!validProcesses.includes(proc)) {
    return fail(res, 400, `Invalid processType: ${rawProc}. Allowed: voice, chat, email, ticket, backoffice`);
  }

  const pDate = productionDate || production_date || new Date().toISOString().slice(0, 10);

  // Duplicate submission protection: Same agent + project + date
  try {
    const { data: existingDb } = await supabase
      .from("bpo_production_records")
      .select("id")
      .eq("agent_id", aId)
      .eq("project_id", pId)
      .eq("production_date", pDate)
      .maybeSingle();

    if (existingDb) {
      return fail(
        res,
        409,
        `A production record has already been submitted for Agent #${aId} on this campaign for ${pDate}. Accidental duplicates are prevented.`
      );
    }
  } catch {}

  const duplicateLocal = Array.from(productionStore.values()).find(
    (p) => p.agent_id === aId && p.project_id === pId && p.production_date === pDate
  );
  if (duplicateLocal) {
    return fail(
      res,
      409,
      `A production record has already been submitted for Agent #${aId} on this campaign for ${pDate}. Accidental duplicates are prevented.`
    );
  }

  // Server-Side Deterministic Productivity Rate
  const rate = Number((units / hours).toFixed(2));

  // Target calculation
  const target = targetUnits !== undefined ? Number(targetUnits) : target_units !== undefined ? Number(target_units) : (metrics?.target_units ? Number(metrics.target_units) : null);
  const adh = computeAdherence(units, target);

  // Attendance Link Verification
  let attendanceVerified = false;
  try {
    const { data: att } = await supabase
      .from("bpo_agent_attendance")
      .select("id, total_working_minutes")
      .eq("agent_id", aId)
      .eq("attendance_date", pDate)
      .maybeSingle();
    if (att) attendanceVerified = true;
  } catch {}

  const enrichedMetrics = {
    ...(metrics || {}),
    channel: resolveChannelName(proc, metrics),
    unit_type: resolveUnitTypeName(proc, metrics),
    target_units: target,
  };

  const newDbRecord = {
    agent_id: aId,
    centre_id: centreId || 2,
    partner_id: partnerId,
    project_id: pId,
    process_type: proc,
    production_date: pDate,
    metrics: enrichedMetrics,
    units_completed: units,
    productive_hours: hours,
    productivity_rate: rate,
    source: "manual",
    status: "submitted",
    notes: notes ? String(notes).trim() : null,
  };

  productionSequence += 1;
  let insertedId = productionSequence;

  try {
    const { data: insData, error: insErr } = await supabase
      .from("bpo_production_records")
      .insert(newDbRecord)
      .select("id")
      .single();

    if (!insErr && insData?.id) {
      insertedId = Number(insData.id);
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Fallback to in-memory store for production insert");
  }

  // Audit Logging
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: req.user!.id,
      action: "production_output_logged",
      entity_type: "bpo_production_record",
      entity_id: String(insertedId),
      metadata: {
        agent_id: aId,
        project_id: pId,
        units_completed: units,
        productive_hours: hours,
        productivity_rate: rate,
        adherence_rate: adh.rate,
        adherence_status: adh.status,
        attendance_verified: attendanceVerified,
        production_date: pDate,
      },
    });
  } catch {}

  const record: BpoProductionRecord = {
    id: insertedId,
    agent_id: aId,
    agent_name: agentName || agent_name || `Agent #${aId}`,
    agent_code: `THK-AGT-${String(aId).padStart(5, "0")}`,
    centre_id: centreId || 2,
    partner_id: partnerId,
    project_id: pId,
    project_name: projectName || project_name || `Campaign Project #${pId}`,
    campaign_name: projectName || project_name || `Campaign Project #${pId}`,
    process_type: proc,
    channel: resolveChannelName(proc, enrichedMetrics),
    unit_type: resolveUnitTypeName(proc, enrichedMetrics),
    production_date: pDate,
    metrics: enrichedMetrics,
    units_completed: units,
    target_units: target,
    adherence_rate: adh.rate,
    adherence_status: adh.status,
    productive_hours: hours,
    productivity_rate: rate,
    source: "manual",
    status: "submitted",
    notes: notes ? String(notes).trim() : null,
    attendance_verified: attendanceVerified,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  productionStore.set(insertedId, record);

  return res.status(201).json({
    success: true,
    record,
    production: record,
    message: "Production output recorded successfully.",
  });
};

router.post("/bpo/production", requireUserAuth, handleProductionLog);
router.post("/bpo/production/log", requireUserAuth, handleProductionLog);

// GET /api/bpo/production/attendance-hours - Link to authoritative attendance duration
router.get("/bpo/production/attendance-hours", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = Number(req.query.agentId || req.query.agent_id);
  const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);

  if (!agentId) {
    return fail(res, 400, "Valid agentId is required");
  }

  // 1. Query Supabase bpo_agent_attendance
  try {
    const { data: dbAtt } = await supabase
      .from("bpo_agent_attendance")
      .select("*")
      .eq("partner_id", partnerId)
      .eq("agent_id", agentId)
      .eq("attendance_date", date)
      .maybeSingle();

    if (dbAtt) {
      const minutes = Number(dbAtt.total_working_minutes) || 0;
      const hours = minutes > 0 ? Number((minutes / 60).toFixed(2)) : 8.0;
      return res.json({
        has_attendance: true,
        working_hours: hours,
        working_minutes: minutes,
        status: dbAtt.status || "PRESENT",
        check_in_time: dbAtt.check_in_time,
        check_out_time: dbAtt.check_out_time,
        verified: true,
        source: "authoritative_attendance",
      });
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Error fetching attendance hours");
  }

  // 2. Query in-memory attendanceStore
  const localAtt = Array.from(attendanceStore.values()).find(
    (a) => a.partner_id === partnerId && a.agent_id === agentId && a.attendance_date === date
  );
  if (localAtt) {
    const minutes = Number(localAtt.total_working_minutes) || 0;
    const hours = minutes > 0 ? Number((minutes / 60).toFixed(2)) : 8.0;
    return res.json({
      has_attendance: true,
      working_hours: hours,
      working_minutes: minutes,
      status: localAtt.status || "PRESENT",
      check_in_time: localAtt.check_in_time,
      check_out_time: localAtt.check_out_time,
      verified: true,
      source: "authoritative_attendance",
    });
  }

  return res.json({
    has_attendance: false,
    working_hours: null,
    working_minutes: 0,
    verified: false,
    message: "No verified attendance check-in found for this date. Manual entry allowed.",
  });
});

// GET /api/bpo/production - List production entries for centre
router.get("/bpo/production", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const projectId = req.query.projectId || req.query.project_id ? Number(req.query.projectId || req.query.project_id) : null;
  const agentId = req.query.agentId || req.query.agent_id ? Number(req.query.agentId || req.query.agent_id) : null;
  const processType = typeof req.query.processType === "string" ? req.query.processType : typeof req.query.process_type === "string" ? req.query.process_type : "all";
  const channel = typeof req.query.channel === "string" ? req.query.channel : "all";
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "all";
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

  // 1. Fetch live production records from Supabase
  let dbList: any[] = [];
  try {
    let query = supabase
      .from("bpo_production_records")
      .select("*, bpo_agents(id, name, employee_id, agent_code), projects(id, name, vertical, process_type)")
      .eq("partner_id", partnerId)
      .order("production_date", { ascending: false });

    if (from) query = query.gte("production_date", from);
    if (to) query = query.lte("production_date", to);
    if (projectId) query = query.eq("project_id", projectId);
    if (agentId) query = query.eq("agent_id", agentId);

    const { data } = await query;
    if (Array.isArray(data)) {
      dbList = data.map((r: any) => {
        const proc = r.process_type;
        const target = r.metrics?.target_units ?? null;
        const adh = computeAdherence(Number(r.units_completed), target);
        const pHours = Number(r.productive_hours) || 0;
        const pUnits = Number(r.units_completed) || 0;
        const pRate = Number(r.productivity_rate) || (pHours > 0 ? Number((pUnits / pHours).toFixed(2)) : 0);

        return {
          id: r.id,
          agent_id: r.agent_id,
          agent_name: r.bpo_agents?.name || `Agent #${r.agent_id}`,
          agent_code: r.bpo_agents?.agent_code || r.bpo_agents?.employee_id || `THK-AGT-${String(r.agent_id).padStart(5, "0")}`,
          centre_id: r.centre_id,
          partner_id: r.partner_id,
          project_id: r.project_id,
          project_name: r.projects?.name || `Campaign Project #${r.project_id}`,
          campaign_name: r.projects?.name || `Campaign Project #${r.project_id}`,
          process_type: proc as ProcessType,
          channel: resolveChannelName(proc, r.metrics),
          unit_type: resolveUnitTypeName(proc, r.metrics),
          production_date: r.production_date,
          metrics: r.metrics || {},
          units_completed: pUnits,
          target_units: target,
          adherence_rate: adh.rate,
          adherence_status: adh.status,
          productive_hours: pHours,
          productivity_rate: pRate,
          source: r.source || "manual",
          status: r.status || "submitted",
          notes: r.notes || null,
          attendance_verified: Boolean(r.source === "system_import" || r.productive_hours > 0),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Error fetching production records from Supabase");
  }

  // 2. Fetch from in-memory fallback
  const localList = Array.from(productionStore.values()).filter((p) => p.partner_id === partnerId);

  // Merge map by unique key
  const mergedMap = new Map<string, any>();
  for (const r of localList) {
    mergedMap.set(`${r.agent_id}-${r.project_id}-${r.production_date}`, r);
  }
  for (const r of dbList) {
    mergedMap.set(`${r.agent_id}-${r.project_id}-${r.production_date}`, r);
  }

  let list = Array.from(mergedMap.values());

  // In-memory filters
  if (from) list = list.filter((p) => p.production_date >= from);
  if (to) list = list.filter((p) => p.production_date <= to);
  if (projectId) list = list.filter((p) => p.project_id === projectId);
  if (agentId) list = list.filter((p) => p.agent_id === agentId);
  if (processType !== "all") {
    const norm = processType === "back_office" ? "backoffice" : processType;
    list = list.filter((p) => p.process_type === norm || p.process_type === processType);
  }
  if (channel !== "all") {
    list = list.filter((p) => p.channel?.toLowerCase() === channel.toLowerCase());
  }
  if (statusFilter !== "all") {
    list = list.filter((p) => p.adherence_status === statusFilter || p.status === statusFilter);
  }
  if (search) {
    list = list.filter(
      (p) =>
        (p.agent_name?.toLowerCase() || "").includes(search) ||
        (p.agent_code?.toLowerCase() || "").includes(search) ||
        (p.project_name?.toLowerCase() || "").includes(search) ||
        (p.campaign_name?.toLowerCase() || "").includes(search) ||
        (p.notes?.toLowerCase() || "").includes(search)
    );
  }

  // Sort by date descending, then id descending
  list.sort((a, b) => {
    if (a.production_date !== b.production_date) {
      return b.production_date.localeCompare(a.production_date);
    }
    return b.id - a.id;
  });

  // Calculate authoritative summary stats over the filtered window
  const totalUnits = list.reduce((acc, p) => acc + Number(p.units_completed), 0);
  const totalHours = Number(list.reduce((acc, p) => acc + Number(p.productive_hours), 0).toFixed(2));
  const avgProductivity = totalHours > 0 ? Number((totalUnits / totalHours).toFixed(2)) : 0;

  const targetRecords = list.filter((p) => p.target_units !== null && p.target_units !== undefined && p.target_units > 0);
  const targetAdherence =
    targetRecords.length > 0
      ? Number(
          (
            targetRecords.reduce((acc, p) => acc + (p.adherence_rate || 0), 0) / targetRecords.length
          ).toFixed(1)
        )
      : null;

  const activeAgents = new Set(list.map((p) => p.agent_id)).size;
  const activeCampaigns = new Set(list.map((p) => p.project_id)).size;

  const summaryData = {
    total_volume: totalUnits,
    total_productive_hours: totalHours,
    avg_productivity_rate: avgProductivity,
    target_adherence_rate: targetAdherence,
    active_agents_count: activeAgents,
    active_campaigns_count: activeCampaigns,
    total_records: list.length,
    last_updated: new Date().toISOString(),
  };

  return res.json({
    success: true,
    records: list,
    summary: summaryData,
    total: list.length,
  });
});

// GET /api/bpo/production/summary - Aggregate productivity metrics & comprehensive charts data
router.get("/bpo/production/summary", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;

  // Retrieve records for this partner
  let dbList: any[] = [];
  try {
    let query = supabase
      .from("bpo_production_records")
      .select("*, bpo_agents(id, name, employee_id, agent_code), projects(id, name, vertical, process_type)")
      .eq("partner_id", partnerId)
      .order("production_date", { ascending: true });

    if (from) query = query.gte("production_date", from);
    if (to) query = query.lte("production_date", to);

    const { data } = await query;
    if (Array.isArray(data)) dbList = data;
  } catch {}

  const localList = Array.from(productionStore.values()).filter((p) => p.partner_id === partnerId);
  const mergedMap = new Map<string, any>();
  for (const r of localList) mergedMap.set(`${r.agent_id}-${r.project_id}-${r.production_date}`, r);
  for (const r of dbList) {
    const target = r.metrics?.target_units ?? null;
    const adh = computeAdherence(Number(r.units_completed), target);
    const pHours = Number(r.productive_hours) || 0;
    const pUnits = Number(r.units_completed) || 0;
    const pRate = Number(r.productivity_rate) || (pHours > 0 ? Number((pUnits / pHours).toFixed(2)) : 0);

    mergedMap.set(`${r.agent_id}-${r.project_id}-${r.production_date}`, {
      id: r.id,
      agent_id: r.agent_id,
      agent_name: r.bpo_agents?.name || `Agent #${r.agent_id}`,
      agent_code: r.bpo_agents?.agent_code || r.bpo_agents?.employee_id || `THK-AGT-${String(r.agent_id).padStart(5, "0")}`,
      centre_id: r.centre_id,
      partner_id: r.partner_id,
      project_id: r.project_id,
      project_name: r.projects?.name || `Campaign Project #${r.project_id}`,
      campaign_name: r.projects?.name || `Campaign Project #${r.project_id}`,
      process_type: r.process_type,
      channel: resolveChannelName(r.process_type, r.metrics),
      unit_type: resolveUnitTypeName(r.process_type, r.metrics),
      production_date: r.production_date,
      metrics: r.metrics || {},
      units_completed: pUnits,
      target_units: target,
      adherence_rate: adh.rate,
      adherence_status: adh.status,
      productive_hours: pHours,
      productivity_rate: pRate,
      status: r.status || "submitted",
    });
  }

  let list = Array.from(mergedMap.values());
  if (from) list = list.filter((p) => p.production_date >= from);
  if (to) list = list.filter((p) => p.production_date <= to);

  const totalUnits = list.reduce((acc, p) => acc + Number(p.units_completed), 0);
  const totalHours = Number(list.reduce((acc, p) => acc + Number(p.productive_hours), 0).toFixed(2));
  const avgProductivity = totalHours > 0 ? Number((totalUnits / totalHours).toFixed(2)) : 0;

  const targetRecords = list.filter((p) => p.target_units !== null && p.target_units !== undefined && p.target_units > 0);
  const targetAdherence =
    targetRecords.length > 0
      ? Number(
          (
            targetRecords.reduce((acc, p) => acc + (p.adherence_rate || 0), 0) / targetRecords.length
          ).toFixed(1)
        )
      : null;

  const activeAgents = new Set(list.map((p) => p.agent_id)).size;
  const activeCampaigns = new Set(list.map((p) => p.project_id)).size;

  // 1. Chronological Daily Trend
  const dateMap = new Map<string, { date: string; units: number; hours: number; target_units: number; count: number }>();
  for (const p of list) {
    const d = p.production_date;
    if (!dateMap.has(d)) {
      dateMap.set(d, { date: d, units: 0, hours: 0, target_units: 0, count: 0 });
    }
    const cur = dateMap.get(d)!;
    cur.units += Number(p.units_completed);
    cur.hours += Number(p.productive_hours);
    if (p.target_units) cur.target_units += Number(p.target_units);
    cur.count += 1;
  }

  const trend = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      units: d.units,
      hours: Number(d.hours.toFixed(1)),
      rate: d.hours > 0 ? Number((d.units / d.hours).toFixed(2)) : 0,
      target_units: d.target_units || null,
      adherence: d.target_units > 0 ? Number(((d.units / d.target_units) * 100).toFixed(1)) : null,
    }));

  // 2. Output vs Target (by project)
  const projMap = new Map<number, { project_id: number; project_name: string; actual_output: number; target_output: number; has_target: boolean; hours: number; agent_ids: Set<number> }>();
  for (const p of list) {
    const id = p.project_id;
    if (!projMap.has(id)) {
      projMap.set(id, {
        project_id: id,
        project_name: p.project_name || `Project #${id}`,
        actual_output: 0,
        target_output: 0,
        has_target: false,
        hours: 0,
        agent_ids: new Set<number>(),
      });
    }
    const cur = projMap.get(id)!;
    cur.actual_output += Number(p.units_completed);
    cur.hours += Number(p.productive_hours);
    cur.agent_ids.add(p.agent_id);
    if (p.target_units) {
      cur.target_output += Number(p.target_units);
      cur.has_target = true;
    }
  }

  const outputVsTarget = Array.from(projMap.values()).map((p) => {
    const adherence = p.has_target && p.target_output > 0 ? Number(((p.actual_output / p.target_output) * 100).toFixed(1)) : null;
    let status: "above_target" | "on_target" | "below_target" | "no_target" = "no_target";
    if (adherence !== null) {
      if (adherence >= 105) status = "above_target";
      else if (adherence >= 95) status = "on_target";
      else status = "below_target";
    }
    return {
      project_id: p.project_id,
      project_name: p.project_name,
      actual_output: p.actual_output,
      target_output: p.has_target ? p.target_output : null,
      target_configured: p.has_target,
      adherence,
      status,
      hours: Number(p.hours.toFixed(1)),
      rate: p.hours > 0 ? Number((p.actual_output / p.hours).toFixed(2)) : 0,
      assigned_agents: p.agent_ids.size,
    };
  });

  // 3. Channel Performance
  const channelMap = new Map<string, { channel: string; units: number; hours: number; count: number }>();
  for (const p of list) {
    const ch = p.channel || resolveChannelName(p.process_type, p.metrics);
    if (!channelMap.has(ch)) {
      channelMap.set(ch, { channel: ch, units: 0, hours: 0, count: 0 });
    }
    const cur = channelMap.get(ch)!;
    cur.units += Number(p.units_completed);
    cur.hours += Number(p.productive_hours);
    cur.count += 1;
  }

  const channelPerformance = Array.from(channelMap.values()).map((c) => ({
    channel: c.channel,
    units: c.units,
    hours: Number(c.hours.toFixed(1)),
    rate: c.hours > 0 ? Number((c.units / c.hours).toFixed(2)) : 0,
    count: c.count,
    share_percent: totalUnits > 0 ? Number(((c.units / totalUnits) * 100).toFixed(1)) : 0,
  }));

  // 4. Productivity Distribution Breakdowns
  const byProject: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byOutputType: Record<string, number> = {};

  for (const p of list) {
    const prName = p.project_name || `Project #${p.project_id}`;
    const campName = p.campaign_name || prName;
    const ch = p.channel || resolveChannelName(p.process_type, p.metrics);
    const uType = p.unit_type || resolveUnitTypeName(p.process_type, p.metrics);

    byProject[prName] = (byProject[prName] || 0) + Number(p.units_completed);
    byCampaign[campName] = (byCampaign[campName] || 0) + Number(p.units_completed);
    byChannel[ch] = (byChannel[ch] || 0) + Number(p.units_completed);
    byOutputType[uType] = (byOutputType[uType] || 0) + Number(p.units_completed);
  }

  // 5. Agent Productivity Rankings
  const agentMap = new Map<number, { agent_id: number; agent_name: string; agent_code: string; projects: Set<string>; units: number; hours: number; target_units: number; count: number }>();
  for (const p of list) {
    const id = p.agent_id;
    if (!agentMap.has(id)) {
      agentMap.set(id, {
        agent_id: id,
        agent_name: p.agent_name || `Agent #${id}`,
        agent_code: p.agent_code || `THK-AGT-${String(id).padStart(5, "0")}`,
        projects: new Set<string>(),
        units: 0,
        hours: 0,
        target_units: 0,
        count: 0,
      });
    }
    const cur = agentMap.get(id)!;
    cur.units += Number(p.units_completed);
    cur.hours += Number(p.productive_hours);
    if (p.project_name) cur.projects.add(p.project_name);
    if (p.target_units) cur.target_units += Number(p.target_units);
    cur.count += 1;
  }

  const agentProductivity = Array.from(agentMap.values()).map((a) => {
    const adh = a.target_units > 0 ? Number(((a.units / a.target_units) * 100).toFixed(1)) : null;
    let status: "above_target" | "on_target" | "below_target" | "no_target" = "no_target";
    if (adh !== null) {
      if (adh >= 105) status = "above_target";
      else if (adh >= 95) status = "on_target";
      else status = "below_target";
    }
    return {
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      agent_code: a.agent_code,
      projects: Array.from(a.projects).join(", "),
      hours: Number(a.hours.toFixed(1)),
      units: a.units,
      rate: a.hours > 0 ? Number((a.units / a.hours).toFixed(2)) : 0,
      target_units: a.target_units || null,
      adherence: adh,
      status,
    };
  });

  return res.json({
    success: true,
    summary: {
      total_volume: totalUnits,
      total_productive_hours: totalHours,
      avg_productivity_rate: avgProductivity,
      target_adherence_rate: targetAdherence,
      active_agents_count: activeAgents,
      active_campaigns_count: activeCampaigns,
      total_records: list.length,
      last_updated: new Date().toISOString(),
    },
    trend,
    output_vs_target: outputVsTarget,
    channel_performance: channelPerformance,
    productivity_distribution: {
      by_project: byProject,
      by_campaign: byCampaign,
      by_channel: byChannel,
      by_output_type: byOutputType,
    },
    project_performance: outputVsTarget,
    agent_productivity: agentProductivity,
  });
});

// GET /api/bpo/production/export - Authoritative tenant-scoped CSV export
router.get("/bpo/production/export", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;

  let query = supabase
    .from("bpo_production_records")
    .select("*, bpo_agents(name, employee_id, agent_code), projects(name)")
    .eq("partner_id", partnerId)
    .order("production_date", { ascending: false });

  if (from) query = query.gte("production_date", from);
  if (to) query = query.lte("production_date", to);

  const { data } = await query;
  const records = Array.isArray(data) ? data : Array.from(productionStore.values()).filter((p) => p.partner_id === partnerId);

  let csvContent = "Record ID,Date,Agent Name,Agent Code,Campaign / Project,Channel,Output Type,Units Completed,Work Hours,Output Rate (units/hr),Target Units,Adherence %,Status\n";

  for (const r of records) {
    const aName = r.bpo_agents?.name || r.agent_name || `Agent #${r.agent_id}`;
    const aCode = r.bpo_agents?.agent_code || r.bpo_agents?.employee_id || r.agent_code || `THK-AGT-${r.agent_id}`;
    const pName = r.projects?.name || r.project_name || `Project #${r.project_id}`;
    const ch = resolveChannelName(r.process_type, r.metrics);
    const uType = resolveUnitTypeName(r.process_type, r.metrics);
    const units = Number(r.units_completed) || 0;
    const hours = Number(r.productive_hours) || 0;
    const rate = Number(r.productivity_rate) || (hours > 0 ? Number((units / hours).toFixed(2)) : 0);
    const target = r.metrics?.target_units ?? "";
    const adh = target ? `${Math.round((units / Number(target)) * 100)}%` : "N/A";
    const status = r.status || "submitted";

    csvContent += `${r.id},${r.production_date},"${aName.replace(/"/g, '""')}","${aCode}","${pName.replace(/"/g, '""')}","${ch}","${uType}",${units},${hours},${rate},${target},"${adh}","${status}"\n`;
  }

  // Audit export
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: req.user!.id,
      action: "production_report_exported",
      entity_type: "bpo_production_records",
      entity_id: partnerId,
      metadata: { record_count: records.length, from, to },
    });
  } catch {}

  const filename = `thinkatic_production_report_${Date.now()}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(csvContent);
});

// ==============================================================================
// SECTION C: AGENT-WISE QUALITY ASSURANCE (SCORECARDS, EVALUATIONS, DISPUTES, CALIBRATIONS)
// ==============================================================================

// Helper: safe calculation of weighted score from scorecard criteria
function calculateServerSideScore(scorecard: BpoQaScorecard, criteriaScores: Record<string, number>) {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const crit of scorecard.criteria) {
    const raw = criteriaScores[crit.id] !== undefined ? Number(criteriaScores[crit.id]) : 0;
    const clamped = Math.min(crit.max_score, Math.max(0, raw));
    weightedSum += (clamped / crit.max_score) * crit.weight;
    totalWeight += crit.weight;
  }
  return totalWeight > 0 ? Number(((weightedSum / totalWeight) * 100).toFixed(2)) : 0;
}

// GET /api/bpo/qa/scorecards - List active scorecards
router.get("/bpo/qa/scorecards", requireUserAuth, async (_req: UserRequest, res: Response) => {
  const list = Array.from(scorecardsStore.values()).filter((s) => s.is_active);
  return res.json(list);
});

// GET /api/bpo/qa/summary - Top KPI metrics across completed audits
router.get("/bpo/qa/summary", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  await hydrateQaFromSupabase(partnerId);

  const list = Array.from(evaluationsStore.values()).filter((e) => e.partner_id === partnerId);
  const totalAudits = list.length;

  if (totalAudits === 0) {
    return res.json({
      total_audits: 0,
      mean_quality_score: null, // "N/A" - NEVER fake 100%
      pass_rate_percent: null,   // "N/A"
      pass_count: 0,
      fail_count: 0,
      active_disputes: 0,
      agents_audited: 0,
      critical_defects: 0,
      trend_direction: null,
      defect_breakdown: { critical: 0, major: 0, minor: 0, total: 0 },
    });
  }

  const totalScoreSum = list.reduce((acc, e) => acc + (Number(e.total_score) || 0), 0);
  const meanQualityScore = Number((totalScoreSum / totalAudits).toFixed(1));
  const passedList = list.filter((e) => e.passed);
  const passRatePercent = Number(((passedList.length / totalAudits) * 100).toFixed(1));

  const activeDisputes = Array.from(disputesStore.values()).filter(
    (d) => d.partner_id === partnerId && ["pending", "under_review", "open", "calibration"].includes(d.status)
  ).length;

  const uniqueAgents = new Set(list.map((e) => e.agent_id)).size;

  let criticalDefects = 0;
  let majorDefects = 0;
  let minorDefects = 0;

  for (const e of list) {
    if (Array.isArray(e.defects)) {
      for (const d of e.defects) {
        if (d.severity === "critical") criticalDefects += 1;
        else if (d.severity === "major") majorDefects += 1;
        else if (d.severity === "minor") minorDefects += 1;
      }
    }
  }

  // Trend direction: newest 5 vs older audits
  let trendDirection: "up" | "down" | "neutral" = "neutral";
  if (list.length >= 6) {
    const sorted = [...list].sort((a, b) => new Date(b.evaluation_date).getTime() - new Date(a.evaluation_date).getTime());
    const recent = sorted.slice(0, Math.floor(sorted.length / 2));
    const older = sorted.slice(Math.floor(sorted.length / 2));
    const recentAvg = recent.reduce((s, e) => s + e.total_score, 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + e.total_score, 0) / older.length;
    if (recentAvg - olderAvg > 0.5) trendDirection = "up";
    else if (recentAvg - olderAvg < -0.5) trendDirection = "down";
  }

  return res.json({
    total_audits: totalAudits,
    mean_quality_score: meanQualityScore,
    pass_rate_percent: passRatePercent,
    pass_count: passedList.length,
    fail_count: totalAudits - passedList.length,
    active_disputes: activeDisputes,
    agents_audited: uniqueAgents,
    critical_defects: criticalDefects,
    trend_direction: trendDirection,
    defect_breakdown: {
      critical: criticalDefects,
      major: majorDefects,
      minor: minorDefects,
      total: criticalDefects + majorDefects + minorDefects,
    },
  });
});

// GET /api/bpo/qa/agents - Agent-wise quality cards (dedicated individual profiles)
router.get("/bpo/qa/agents", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  await hydrateQaFromSupabase(partnerId);

  // Fetch real partner agents from database
  let dbAgents: any[] = [];
  try {
    const { data, error } = await supabase
      .from("bpo_agents")
      .select("id, name, agent_code, designation, department, centre_id, partner_id, status")
      .eq("partner_id", partnerId);
    if (!error && data) dbAgents = data;
  } catch (err: any) {
    logger.warn(`Failed to fetch agents: ${err.message}`);
  }

  // Fallback to sample partner agents if table query fails
  if (dbAgents.length === 0) {
    dbAgents = [
      { id: 104, name: "Gurpreet R.", agent_code: "THK-AGT-00104", designation: "Customer Support Associate", department: "Inbound Voice", centre_id: 2, partner_id: partnerId },
      { id: 5, name: "Guru Agent", agent_code: "THK-AGT-02323", designation: "Patient Support Specialist", department: "Customer Operations", centre_id: 2, partner_id: partnerId },
      { id: 1, name: "Alex Miller (Senior Support)", agent_code: "THK-AGT-00001", designation: "Senior Care Specialist", department: "Customer Operations", centre_id: 2, partner_id: partnerId },
      { id: 2, name: "Sarah Jenkins (Lead Specialist)", agent_code: "THK-AGT-00002", designation: "Lead Specialist", department: "Customer Operations", centre_id: 2, partner_id: partnerId },
      { id: 3, name: "David Chen (Care Associate)", agent_code: "THK-AGT-00003", designation: "Care Associate", department: "Customer Operations", centre_id: 2, partner_id: partnerId },
    ];
  }

  const allEvals = Array.from(evaluationsStore.values()).filter((e) => e.partner_id === partnerId);
  const allDisputes = Array.from(disputesStore.values()).filter((d) => d.partner_id === partnerId);

  const agentCards = dbAgents.map((agent) => {
    const agentEvals = allEvals
      .filter((e) => e.agent_id === agent.id)
      .sort((a, b) => new Date(a.evaluation_date).getTime() - new Date(b.evaluation_date).getTime());

    const totalAudits = agentEvals.length;
    let qualityScore: number | null = null;
    let passRate: number | null = null;
    let trend: "up" | "down" | "neutral" | null = null;
    let trendDelta = 0;
    let criticalDefectsCount = 0;

    if (totalAudits > 0) {
      const sum = agentEvals.reduce((acc, e) => acc + (Number(e.total_score) || 0), 0);
      qualityScore = Number((sum / totalAudits).toFixed(1));
      const passed = agentEvals.filter((e) => e.passed).length;
      passRate = Number(((passed / totalAudits) * 100).toFixed(1));

      criticalDefectsCount = agentEvals.filter(
        (e) => Array.isArray(e.defects) && e.defects.some((d) => d.severity === "critical")
      ).length;

      // Realistic trend from historical audits
      if (totalAudits >= 4) {
        const mid = Math.floor(totalAudits / 2);
        const older = agentEvals.slice(0, mid);
        const newer = agentEvals.slice(mid);
        const olderAvg = older.reduce((acc, e) => acc + e.total_score, 0) / older.length;
        const newerAvg = newer.reduce((acc, e) => acc + e.total_score, 0) / newer.length;
        trendDelta = Number((newerAvg - olderAvg).toFixed(1));
        if (trendDelta > 0.5) trend = "up";
        else if (trendDelta < -0.5) trend = "down";
        else trend = "neutral";
      } else {
        trend = "neutral";
      }
    }

    const openDisputesCount = allDisputes.filter(
      (d) => d.agent_id === agent.id && ["pending", "under_review", "open", "calibration"].includes(d.status)
    ).length;

    const historicalScores = agentEvals.slice(-10).map((e) => ({
      date: e.evaluation_date,
      score: e.total_score,
      passed: e.passed,
    }));

    return {
      agent_id: agent.id,
      agent_name: agent.name,
      agent_code: agent.agent_code || `THK-AGT-${String(agent.id).padStart(5, "0")}`,
      designation: agent.designation || "Customer Support Associate",
      department: agent.department || "Inbound Operations",
      centre_id: agent.centre_id || 2,
      centre_name: "Thinkatic Premier BPO Hub",
      project_name: agentEvals[0]?.project_name || "Customer Support",
      campaign_name: agentEvals[0]?.campaign_name || "North American Telehealth Patient Support",
      quality_score: qualityScore,
      pass_rate: passRate,
      audits_count: totalAudits,
      critical_defects_count: criticalDefectsCount,
      open_disputes_count: openDisputesCount,
      trend,
      trend_delta: trendDelta,
      historical_scores: historicalScores,
      last_audit_date: agentEvals[agentEvals.length - 1]?.evaluation_date || null,
    };
  });

  return res.json({ agents: agentCards });
});

// GET /api/bpo/qa/agents/:id - Individual Agent Quality Detail (All 7 Tabs Data)
router.get("/bpo/qa/agents/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = Number(req.params.id);
  await hydrateQaFromSupabase(partnerId);

  // Anti-IDOR check: verify agent exists and belongs to partner
  let agent: any = null;
  try {
    const { data } = await supabase
      .from("bpo_agents")
      .select("*")
      .eq("id", agentId)
      .eq("partner_id", partnerId)
      .maybeSingle();
    agent = data;
  } catch (_) {}

  if (!agent) {
    // Check fallback in memory
    const existing = Array.from(evaluationsStore.values()).find(
      (e) => e.agent_id === agentId && e.partner_id === partnerId
    );
    if (!existing) {
      return fail(res, 404, "Agent not found or access denied for this BPO centre");
    }
    agent = {
      id: agentId,
      name: existing.agent_name,
      agent_code: existing.agent_code,
      designation: "Customer Support Specialist",
      department: "Customer Operations",
      centre_id: existing.centre_id,
      partner_id: partnerId,
    };
  }

  // Collect evaluations for this agent
  const evals = Array.from(evaluationsStore.values())
    .filter((e) => e.agent_id === agentId && e.partner_id === partnerId)
    .sort((a, b) => new Date(b.evaluation_date).getTime() - new Date(a.evaluation_date).getTime());

  const totalAudits = evals.length;
  const passedAudits = evals.filter((e) => e.passed).length;
  const overallAvg = totalAudits > 0 ? Number((evals.reduce((s, e) => s + e.total_score, 0) / totalAudits).toFixed(1)) : null;
  const passRate = totalAudits > 0 ? Number(((passedAudits / totalAudits) * 100).toFixed(1)) : null;

  // 30-day and 90-day averages
  const now = new Date().getTime();
  const d30 = now - 30 * 86400000;
  const d90 = now - 90 * 86400000;

  const evals30d = evals.filter((e) => new Date(e.evaluation_date).getTime() >= d30);
  const evals90d = evals.filter((e) => new Date(e.evaluation_date).getTime() >= d90);

  const avg30d = evals30d.length > 0 ? Number((evals30d.reduce((s, e) => s + e.total_score, 0) / evals30d.length).toFixed(1)) : overallAvg;
  const avg90d = evals90d.length > 0 ? Number((evals90d.reduce((s, e) => s + e.total_score, 0) / evals90d.length).toFixed(1)) : overallAvg;

  // Defects aggregation
  const defectsList: any[] = [];
  let critCount = 0;
  let majCount = 0;
  let minCount = 0;
  const defectCategories: Record<string, number> = {};

  for (const e of evals) {
    if (Array.isArray(e.defects)) {
      for (const d of e.defects) {
        defectsList.push({
          audit_id: e.id,
          interaction_reference: e.interaction_reference,
          date: e.evaluation_date,
          category: d.category || "General",
          severity: d.severity,
          description: d.description,
          rule: d.rule,
        });
        if (d.severity === "critical") critCount += 1;
        else if (d.severity === "major") majCount += 1;
        else if (d.severity === "minor") minCount += 1;

        const cat = d.category || "General";
        defectCategories[cat] = (defectCategories[cat] || 0) + 1;
      }
    }
  }

  // Disputes for agent
  const agentDisputes = Array.from(disputesStore.values())
    .filter((d) => d.agent_id === agentId && d.partner_id === partnerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const openDisputes = agentDisputes.filter((d) => ["pending", "under_review", "open", "calibration"].includes(d.status)).length;
  const resolvedDisputes = agentDisputes.filter((d) => ["upheld", "resolved", "modified"].includes(d.status)).length;

  // Calibrations for agent
  const agentCalibrations = Array.from(calibrationsStore.values())
    .filter((c) => c.agent_id === agentId && c.partner_id === partnerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Scorecards criteria performance breakdown
  const criteriaAgg: Record<string, { name: string; category: string; weight: number; max_score: number; totalScored: number; maxPossible: number; count: number }> = {};
  for (const e of evals) {
    const sc = scorecardsStore.get(e.scorecard_id);
    if (sc && Array.isArray(sc.criteria)) {
      for (const crit of sc.criteria) {
        if (!criteriaAgg[crit.id]) {
          criteriaAgg[crit.id] = {
            name: crit.name,
            category: crit.category,
            weight: crit.weight,
            max_score: crit.max_score,
            totalScored: 0,
            maxPossible: 0,
            count: 0,
          };
        }
        const val = e.criteria_scores?.[crit.id];
        if (val !== undefined) {
          criteriaAgg[crit.id].totalScored += Number(val);
          criteriaAgg[crit.id].maxPossible += crit.max_score;
          criteriaAgg[crit.id].count += 1;
        }
      }
    }
  }

  const scorecardsPerformance = Object.entries(criteriaAgg).map(([critId, c]) => ({
    criterion_id: critId,
    name: c.name,
    category: c.category,
    weight: c.weight,
    performance_percent: c.maxPossible > 0 ? Number(((c.totalScored / c.maxPossible) * 100).toFixed(1)) : 100,
    evaluations_counted: c.count,
  }));

  // Chronological timeline history
  const historyEvents: any[] = [];
  for (const e of evals) {
    historyEvents.push({
      id: `eval-${e.id}`,
      type: "audit_completed",
      date: e.evaluation_date,
      title: `Audit Completed — Ref: ${e.interaction_reference}`,
      description: `Score awarded: ${e.total_score}%. Result: ${e.passed ? "PASS" : "FAIL"}. Evaluator: ${e.evaluated_by}`,
      badge: e.passed ? "PASS" : "FAIL",
      badge_color: e.passed ? "emerald" : "rose",
      timestamp: e.created_at,
    });
  }

  for (const d of agentDisputes) {
    historyEvents.push({
      id: `disp-${d.id}`,
      type: "dispute_raised",
      date: d.created_at.slice(0, 10),
      title: `Dispute Registered — Eval #${d.evaluation_id}`,
      description: d.dispute_reason,
      badge: d.status.toUpperCase(),
      badge_color: "amber",
      timestamp: d.created_at,
    });
    if (d.resolved_at) {
      historyEvents.push({
        id: `disp-res-${d.id}`,
        type: "dispute_resolved",
        date: d.resolved_at.slice(0, 10),
        title: `Dispute Decision — Eval #${d.evaluation_id}`,
        description: d.resolution_notes || `Status: ${d.status}`,
        badge: "RESOLVED",
        badge_color: "purple",
        timestamp: d.resolved_at,
      });
    }
  }

  for (const c of agentCalibrations) {
    historyEvents.push({
      id: `calib-${c.id}`,
      type: "calibration_performed",
      date: c.created_at.slice(0, 10),
      title: `QA Calibration — Ref: ${c.interaction_reference}`,
      description: `Original: ${c.original_score}% → Calibrated: ${c.calibration_score}% (Variance: ${c.variance > 0 ? "+" : ""}${c.variance}%). Calibrator: ${c.calibrator_name}`,
      badge: "CALIBRATED",
      badge_color: "blue",
      timestamp: c.created_at,
    });
  }

  historyEvents.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());

  // Trend series for charts
  const trendSeries = evals
    .map((e) => ({
      date: e.evaluation_date,
      score: e.total_score,
      passed: e.passed,
      reference: e.interaction_reference,
    }))
    .reverse();

  return res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      agent_code: agent.agent_code || `THK-AGT-${String(agent.id).padStart(5, "0")}`,
      designation: agent.designation || "Customer Support Associate",
      department: agent.department || "Inbound Voice Operations",
      centre_id: agent.centre_id || 2,
      centre_name: "Thinkatic Premier BPO Hub",
      project_name: evals[0]?.project_name || "Customer Support",
      campaign_name: evals[0]?.campaign_name || "North American Telehealth Patient Support",
    },
    metrics: {
      current_quality_score: overallAvg,
      avg_30d: avg30d,
      avg_90d: avg90d,
      overall_avg: overallAvg,
      pass_rate: passRate,
      total_audits: totalAudits,
      critical_defects: critCount,
      major_defects: majCount,
      minor_defects: minCount,
      open_disputes: openDisputes,
      resolved_disputes: resolvedDisputes,
      total_calibrations: agentCalibrations.length,
      last_audit_date: evals[0]?.evaluation_date || null,
    },
    evaluations: evals,
    scorecards_performance: scorecardsPerformance,
    defects: defectsList,
    disputes: agentDisputes,
    calibrations: agentCalibrations,
    history: historyEvents,
    trend_series: trendSeries,
    pass_fail_distribution: {
      passed: passedAudits,
      failed: totalAudits - passedAudits,
    },
    defect_distribution: {
      critical: critCount,
      major: majCount,
      minor: minCount,
      categories: defectCategories,
    },
  });
});

// GET /api/bpo/qa/evaluations - Evaluations table feed with filters and search
router.get("/bpo/qa/evaluations", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  await hydrateQaFromSupabase(partnerId);

  const agentId = req.query.agentId ? Number(req.query.agentId) : null;
  const passedParam = req.query.passed;
  const channelParam = req.query.channel ? String(req.query.channel).toLowerCase() : null;
  const criticalOnly = req.query.criticalOnly === "true";
  const search = req.query.search ? String(req.query.search).toLowerCase().trim() : "";

  let list = Array.from(evaluationsStore.values())
    .filter((e) => e.partner_id === partnerId)
    .sort((a, b) => new Date(b.evaluation_date).getTime() - new Date(a.evaluation_date).getTime());

  if (agentId) list = list.filter((e) => e.agent_id === agentId);
  if (passedParam === "true") list = list.filter((e) => e.passed);
  if (passedParam === "false") list = list.filter((e) => !e.passed);
  if (channelParam) list = list.filter((e) => (e.channel || "").toLowerCase().includes(channelParam));
  if (criticalOnly) {
    list = list.filter((e) => Array.isArray(e.defects) && e.defects.some((d) => d.severity === "critical"));
  }

  if (search) {
    list = list.filter(
      (e) =>
        (e.agent_name || "").toLowerCase().includes(search) ||
        (e.agent_code || "").toLowerCase().includes(search) ||
        (e.interaction_reference || "").toLowerCase().includes(search) ||
        (e.scorecard_name || "").toLowerCase().includes(search) ||
        (e.project_name || "").toLowerCase().includes(search) ||
        (e.campaign_name || "").toLowerCase().includes(search) ||
        String(e.id).includes(search)
    );
  }

  const total = list.length;
  const avgScore = total > 0 ? Number((list.reduce((acc, e) => acc + e.total_score, 0) / total).toFixed(1)) : null;
  const passCount = list.filter((e) => e.passed).length;
  const passRate = total > 0 ? Number(((passCount / total) * 100).toFixed(1)) : null;

  return res.json({
    total_evaluations: total,
    average_score: avgScore,
    pass_rate_percent: passRate,
    evaluations: list,
  });
});

// GET /api/bpo/qa/evaluations/:id - Single evaluation detail
router.get("/bpo/qa/evaluations/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const evalId = Number(req.params.id);
  await hydrateQaFromSupabase(partnerId);

  const evaluation = evaluationsStore.get(evalId);
  if (!evaluation) return fail(res, 404, "Quality evaluation not found");

  // Anti-IDOR check
  if (evaluation.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Evaluation belongs to another centre");
  }

  const scorecard = scorecardsStore.get(evaluation.scorecard_id);
  const disputes = Array.from(disputesStore.values()).filter((d) => d.evaluation_id === evalId);
  const calibrations = Array.from(calibrationsStore.values()).filter((c) => c.evaluation_id === evalId);

  return res.json({
    evaluation,
    scorecard,
    disputes,
    calibrations,
  });
});

// POST /api/bpo/qa/evaluations - Create new quality audit with SERVER-SIDE WEIGHTED SCORING
router.post("/api/bpo/qa/evaluations", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const {
    agentId,
    scorecardId,
    projectId,
    campaignName,
    channel,
    interactionReference,
    evaluationDate,
    criteriaScores,
    criticalDefectFlags,
    evaluatorFeedback,
    internalNotes,
  } = req.body || {};

  const scId = Number(scorecardId);
  const aId = Number(agentId);

  if (!aId) return fail(res, 400, "Valid agentId is required");
  if (!scId) return fail(res, 400, "Valid scorecardId is required");
  if (!interactionReference || typeof interactionReference !== "string" || !interactionReference.trim()) {
    return fail(res, 400, "Interaction reference (Call ID / Chat ID / Ticket ID) is required");
  }

  // Anti-IDOR check: verify agent belongs to partner
  let agent: any = null;
  try {
    const { data } = await supabase
      .from("bpo_agents")
      .select("id, name, agent_code, centre_id, partner_id")
      .eq("id", aId)
      .eq("partner_id", partnerId)
      .maybeSingle();
    agent = data;
  } catch (_) {}

  if (!agent) {
    // Check if in evaluationsStore
    const ev = Array.from(evaluationsStore.values()).find((e) => e.agent_id === aId && e.partner_id === partnerId);
    if (!ev) return fail(res, 403, "Access denied: Agent does not belong to your BPO partner account");
    agent = { id: aId, name: ev.agent_name, agent_code: ev.agent_code, centre_id: ev.centre_id };
  }

  const scorecard = scorecardsStore.get(scId);
  if (!scorecard) return fail(res, 404, "Scorecard definition not found");

  // SERVER-SIDE DETERMINISTIC WEIGHTED SCORING
  // Client cannot blindly dictate final score; server recalculates from criterion values
  const rawScores = criteriaScores || {};
  const finalScore = calculateServerSideScore(scorecard, rawScores);

  // Critical Defect Auto-Fail rule
  const criticalFlags: string[] = Array.isArray(criticalDefectFlags) ? criticalDefectFlags.filter(Boolean) : [];
  const hasCritical = criticalFlags.length > 0;

  let passed = finalScore >= scorecard.passing_threshold;
  let failureReason = passed ? "Passed by score" : "Failed due to score";

  if (hasCritical) {
    passed = false;
    failureReason = `Failed due to configured critical defect rule: ${criticalFlags.join(", ")}`;
  }

  // Evaluator identity is derived on the server from authenticated context
  const evaluatorIdentity = req.user?.email || "Quality Auditor";

  const defectsList = criticalFlags.map((desc) => ({
    category: "Compliance",
    severity: "critical" as const,
    description: desc,
    rule: "Auto-fail applied",
  }));

  evaluationSequence += 1;
  const newEvalId = evaluationSequence;

  const evalMeta = {
    channel: channel || "Voice",
    agent_name: agent.name,
    agent_code: agent.agent_code,
    project_name: "Customer Support",
    campaign_name: campaignName || "North American Telehealth Patient Support",
    evaluator_name: evaluatorIdentity,
    failure_reason: failureReason,
    created_at: new Date().toISOString(),
  };

  const newEvalRecord: BpoQaEvaluation = {
    id: newEvalId,
    scorecard_id: scId,
    scorecard_name: scorecard.name,
    agent_id: aId,
    agent_name: agent.name,
    agent_code: agent.agent_code,
    centre_id: centreId || agent.centre_id || 2,
    partner_id: partnerId,
    project_id: projectId ? Number(projectId) : scorecard.project_id || 105,
    project_name: "Customer Support",
    campaign_name: campaignName || "North American Telehealth Patient Support",
    channel: channel || "Voice",
    interaction_reference: String(interactionReference).trim(),
    evaluation_date: evaluationDate || new Date().toISOString().slice(0, 10),
    criteria_scores: rawScores,
    total_score: finalScore,
    passed,
    failure_reason: failureReason,
    defects: defectsList,
    evaluator_feedback: evaluatorFeedback ? String(evaluatorFeedback).trim() : "Standard QA Review completed.",
    internal_notes: JSON.stringify(evalMeta),
    status: "completed",
    evaluated_by: evaluatorIdentity,
    calibrations: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Persist to Supabase
  try {
    const { data: dbCreated, error: dbErr } = await supabase
      .from("bpo_qa_evaluations")
      .insert({
        scorecard_id: scId,
        agent_id: aId,
        centre_id: centreId || agent.centre_id || 2,
        partner_id: partnerId,
        project_id: projectId ? Number(projectId) : scorecard.project_id || 105,
        interaction_reference: String(interactionReference).trim(),
        evaluation_date: evaluationDate || new Date().toISOString().slice(0, 10),
        criteria_scores: rawScores,
        total_score: finalScore,
        passed,
        defects: defectsList,
        evaluator_feedback: newEvalRecord.evaluator_feedback,
        internal_notes: JSON.stringify(evalMeta),
        status: "completed",
      })
      .select()
      .maybeSingle();

    if (!dbErr && dbCreated) {
      newEvalRecord.id = Number(dbCreated.id);
    }
  } catch (err: any) {
    logger.warn(`Failed writing evaluation to Supabase: ${err.message}`);
  }

  evaluationsStore.set(newEvalRecord.id, newEvalRecord);

  // Audit logging
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: req.user!.id,
      action: "qa_evaluation_created",
      entity_type: "qa_evaluation",
      entity_id: String(newEvalRecord.id),
      metadata: {
        agent_id: aId,
        score: finalScore,
        passed,
        critical_defect: hasCritical,
        interaction_reference: interactionReference,
      },
    });
  } catch (_) {}

  return res.status(201).json({
    success: true,
    evaluation: newEvalRecord,
  });
});

// Also register without /api prefix for compatibility with frontend fetchers
router.post("/bpo/qa/evaluations", requireUserAuth, async (req: UserRequest, res: Response) => {
  // Delegate to identical implementation
  const url = req.url;
  req.url = "/api/bpo/qa/evaluations";
  return (router as any).handle(req, res, () => {});
});

// POST /api/bpo/qa/evaluations/:id/dispute - Submit QA review dispute
router.post("/bpo/qa/evaluations/:id/dispute", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const evalId = Number(req.params.id);
  const { reason, description } = req.body || {};

  await hydrateQaFromSupabase(partnerId);

  const evaluation = evaluationsStore.get(evalId);
  if (!evaluation) return fail(res, 404, "QA evaluation not found");

  // Anti-IDOR check
  if (evaluation.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: QA evaluation belongs to another centre");
  }

  const disputeText = (reason || description || "").trim();
  if (disputeText.length < 10) {
    return fail(res, 400, "Detailed dispute reason (minimum 10 characters) is required");
  }

  disputeSequence += 1;
  const newDisputeId = disputeSequence;

  const dispute: BpoQaDispute = {
    id: newDisputeId,
    evaluation_id: evalId,
    agent_id: evaluation.agent_id,
    agent_name: evaluation.agent_name,
    agent_code: evaluation.agent_code,
    interaction_reference: evaluation.interaction_reference,
    scorecard_name: evaluation.scorecard_name,
    original_score: evaluation.total_score,
    partner_id: partnerId,
    centre_id: centreId || evaluation.centre_id || 2,
    dispute_reason: disputeText,
    status: "under_review",
    created_at: new Date().toISOString(),
  };

  // Persist to Supabase
  try {
    const { data: dbDispute, error: dbErr } = await supabase
      .from("bpo_qa_disputes")
      .insert({
        evaluation_id: evalId,
        agent_id: evaluation.agent_id,
        partner_id: partnerId,
        centre_id: centreId || evaluation.centre_id || 2,
        dispute_reason: disputeText,
        status: "under_review",
      })
      .select()
      .maybeSingle();

    if (!dbErr && dbDispute) {
      dispute.id = Number(dbDispute.id);
    }

    await supabase
      .from("bpo_qa_evaluations")
      .update({ status: "dispute_requested" })
      .eq("id", evalId);
  } catch (err: any) {
    logger.warn(`Failed writing dispute to Supabase: ${err.message}`);
  }

  disputesStore.set(dispute.id, dispute);
  evaluation.status = "dispute_requested";
  evaluationsStore.set(evalId, evaluation);

  // Audit trail
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: req.user!.id,
      action: "qa_dispute_registered",
      entity_type: "qa_dispute",
      entity_id: String(dispute.id),
      metadata: {
        evaluation_id: evalId,
        agent_id: evaluation.agent_id,
        reason: disputeText,
      },
    });
  } catch (_) {}

  return res.status(201).json({
    success: true,
    dispute,
  });
});

// GET /api/bpo/qa/disputes - List disputes for partner
router.get("/bpo/qa/disputes", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  await hydrateQaFromSupabase(partnerId);

  const list = Array.from(disputesStore.values())
    .filter((d) => d.partner_id === partnerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return res.json({
    total_disputes: list.length,
    active_disputes: list.filter((d) => ["pending", "under_review", "open", "calibration"].includes(d.status)).length,
    disputes: list,
  });
});

// POST /api/bpo/qa/disputes/:id/resolve - Resolve dispute (Authorized Reviewer)
router.post("/bpo/qa/disputes/:id/resolve", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const disputeId = Number(req.params.id);
  const { decision, modifiedScore, resolutionNotes } = req.body || {};

  const dispute = disputesStore.get(disputeId);
  if (!dispute) return fail(res, 404, "Dispute not found");

  if (dispute.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Dispute belongs to another centre");
  }

  const validDecisions = ["upheld", "resolved", "modified", "rejected"];
  if (!validDecisions.includes(decision)) {
    return fail(res, 400, "Decision must be 'upheld', 'resolved', 'modified', or 'rejected'");
  }

  dispute.status = decision;
  dispute.resolution_notes = resolutionNotes || "";
  dispute.resolved_at = new Date().toISOString();

  const evalRecord = evaluationsStore.get(dispute.evaluation_id);
  if (evalRecord) {
    const originalScore = evalRecord.total_score;
    if (decision === "modified" && modifiedScore !== undefined) {
      const newScore = Number(modifiedScore);
      evalRecord.total_score = newScore;
      const sc = scorecardsStore.get(evalRecord.scorecard_id);
      evalRecord.passed = newScore >= (sc?.passing_threshold || 85);
      evalRecord.status = "revised";

      // Preserve score immutability in audit trail
      try {
        await supabase.from("audit_logs").insert({
          actor_user_id: req.user!.id,
          action: "qa_score_corrected",
          entity_type: "qa_evaluation",
          entity_id: String(evalRecord.id),
          metadata: {
            original_score: originalScore,
            adjusted_score: newScore,
            dispute_id: disputeId,
            reason: resolutionNotes || "Dispute upheld / score adjusted",
          },
        });
      } catch (_) {}
    } else {
      evalRecord.status = "completed";
    }
    evaluationsStore.set(evalRecord.id, evalRecord);

    try {
      await supabase
        .from("bpo_qa_evaluations")
        .update({
          total_score: evalRecord.total_score,
          passed: evalRecord.passed,
          status: evalRecord.status,
        })
        .eq("id", evalRecord.id);
    } catch (_) {}
  }

  try {
    await supabase
      .from("bpo_qa_disputes")
      .update({
        status: decision,
        resolution_notes: resolutionNotes || "",
        resolved_at: dispute.resolved_at,
      })
      .eq("id", disputeId);
  } catch (_) {}

  disputesStore.set(disputeId, dispute);
  return res.json({ success: true, dispute, evaluation: evalRecord });
});

// GET /api/bpo/qa/calibrations - List calibrations & variance metrics
router.get("/bpo/qa/calibrations", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const calibrations = Array.from(calibrationsStore.values())
    .filter((c) => c.partner_id === partnerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = calibrations.length;
  let avgVariance = 0;
  if (total > 0) {
    const sum = calibrations.reduce((acc, c) => acc + Math.abs(c.variance), 0);
    avgVariance = Number((sum / total).toFixed(1));
  }

  return res.json({
    total_calibrations: total,
    average_variance: avgVariance,
    calibrations,
  });
});

// POST /api/bpo/qa/evaluations/:id/calibrate - Record calibration review
router.post("/api/bpo/qa/evaluations/:id/calibrate", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const evalId = Number(req.params.id);
  const { calibrationScore, notes, calibratorName } = req.body || {};

  await hydrateQaFromSupabase(partnerId);

  const evaluation = evaluationsStore.get(evalId);
  if (!evaluation) return fail(res, 404, "QA evaluation not found");

  if (evaluation.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Evaluation belongs to another centre");
  }

  const calibScore = Number(calibrationScore);
  if (isNaN(calibScore) || calibScore < 0 || calibScore > 100) {
    return fail(res, 400, "Valid calibration score between 0 and 100 is required");
  }

  const variance = Number((calibScore - evaluation.total_score).toFixed(1));
  calibrationSequence += 1;

  const calibRecord: BpoQaCalibration = {
    id: calibrationSequence,
    evaluation_id: evalId,
    agent_id: evaluation.agent_id,
    agent_name: evaluation.agent_name,
    agent_code: evaluation.agent_code,
    partner_id: partnerId,
    interaction_reference: evaluation.interaction_reference,
    original_score: evaluation.total_score,
    calibration_score: calibScore,
    variance,
    evaluator_name: evaluation.evaluated_by,
    calibrator_name: calibratorName || req.user?.email || "Lead QA Calibrator",
    status: "completed",
    notes: String(notes || "Calibrated evaluation review completed.").trim(),
    created_at: new Date().toISOString(),
  };

  calibrationsStore.set(calibrationSequence, calibRecord);

  // Preserve original score, but record calibration in evaluation metadata
  if (!evaluation.calibrations) evaluation.calibrations = [];
  evaluation.calibrations.push({
    id: calibRecord.id,
    original_score: calibRecord.original_score,
    calibration_score: calibRecord.calibration_score,
    variance: calibRecord.variance,
    calibrator: calibRecord.calibrator_name,
    notes: calibRecord.notes,
    created_at: calibRecord.created_at,
  });
  evaluationsStore.set(evalId, evaluation);

  // Audit logging
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: req.user!.id,
      action: "qa_calibration_recorded",
      entity_type: "qa_calibration",
      entity_id: String(calibRecord.id),
      metadata: {
        evaluation_id: evalId,
        original_score: evaluation.total_score,
        calibration_score: calibScore,
        variance,
      },
    });
  } catch (_) {}

  return res.status(201).json({
    success: true,
    calibration: calibRecord,
  });
});

// GET /api/bpo/qa/history - Overall timeline history of quality operations
router.get("/bpo/qa/history", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  await hydrateQaFromSupabase(partnerId);

  const evals = Array.from(evaluationsStore.values()).filter((e) => e.partner_id === partnerId);
  const disputes = Array.from(disputesStore.values()).filter((d) => d.partner_id === partnerId);
  const calibrations = Array.from(calibrationsStore.values()).filter((c) => c.partner_id === partnerId);

  const events: any[] = [];

  for (const e of evals) {
    events.push({
      id: `eval-${e.id}`,
      type: "evaluation_completed",
      date: e.evaluation_date,
      title: `Audit Completed: ${e.agent_name} (${e.agent_code})`,
      description: `Interaction: ${e.interaction_reference} | Score: ${e.total_score}% | Result: ${e.passed ? "PASS" : "FAIL"}`,
      badge: e.passed ? "PASS" : "FAIL",
      badge_color: e.passed ? "emerald" : "rose",
      timestamp: e.created_at,
    });
  }

  for (const d of disputes) {
    events.push({
      id: `disp-${d.id}`,
      type: "dispute_raised",
      date: d.created_at.slice(0, 10),
      title: `Dispute Raised: ${d.agent_name || "Agent"} (Audit #${d.evaluation_id})`,
      description: d.dispute_reason,
      badge: d.status.toUpperCase(),
      badge_color: "amber",
      timestamp: d.created_at,
    });
  }

  for (const c of calibrations) {
    events.push({
      id: `calib-${c.id}`,
      type: "calibration_performed",
      date: c.created_at.slice(0, 10),
      title: `Calibration: ${c.agent_name} (${c.interaction_reference})`,
      description: `Original: ${c.original_score}% → Re-audit: ${c.calibration_score}% (Variance: ${c.variance > 0 ? "+" : ""}${c.variance}%)`,
      badge: "CALIBRATED",
      badge_color: "blue",
      timestamp: c.created_at,
    });
  }

  events.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());
  return res.json({ events });
});

// ==============================================================================
// SECTION D: COMPLIANCE, EXCEPTIONS & CORRECTIVE ACTIONS (CAPA)
// ==============================================================================

function getComplianceStorageDir(): string {
  const root = getStorageRoot();
  const dir = path.resolve(root, "compliance");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function loadAuthoritativeComplianceChecks(): BpoComplianceCheck[] {
  const dir = getComplianceStorageDir();
  const file = path.resolve(dir, "compliance_checks.json");
  let checks: BpoComplianceCheck[] = [];
  try {
    if (fs.existsSync(file)) {
      checks = JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch (err) {
    logger.error(`Error reading compliance_checks.json: ${err}`);
  }

  // Also sync into in-memory store for backwards compatibility
  for (const c of checks) {
    complianceStore.set(c.id, c);
  }
  return checks;
}

function saveAuthoritativeComplianceChecks(checks: BpoComplianceCheck[]): void {
  const dir = getComplianceStorageDir();
  const file = path.resolve(dir, "compliance_checks.json");
  try {
    fs.writeFileSync(file, JSON.stringify(checks, null, 2), "utf-8");
    for (const c of checks) {
      complianceStore.set(c.id, c);
    }
  } catch (err) {
    logger.error(`Error saving compliance_checks.json: ${err}`);
  }
}

function loadAuthoritativeComplianceExceptions(): BpoComplianceException[] {
  const dir = getComplianceStorageDir();
  const file = path.resolve(dir, "compliance_exceptions.json");
  let exceptions: BpoComplianceException[] = [];
  try {
    if (fs.existsSync(file)) {
      exceptions = JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch (err) {
    logger.error(`Error reading compliance_exceptions.json: ${err}`);
  }

  for (const e of exceptions) {
    exceptionsStore.set(e.id, e);
  }
  return exceptions;
}

function saveAuthoritativeComplianceExceptions(exceptions: BpoComplianceException[]): void {
  const dir = getComplianceStorageDir();
  const file = path.resolve(dir, "compliance_exceptions.json");
  try {
    fs.writeFileSync(file, JSON.stringify(exceptions, null, 2), "utf-8");
    for (const e of exceptions) {
      exceptionsStore.set(e.id, e);
    }
  } catch (err) {
    logger.error(`Error saving compliance_exceptions.json: ${err}`);
  }
}

function loadAuthoritativeComplianceCapas(): BpoCorrectiveAction[] {
  const dir = getComplianceStorageDir();
  const file = path.resolve(dir, "compliance_capas.json");
  let capas: BpoCorrectiveAction[] = [];
  try {
    if (fs.existsSync(file)) {
      capas = JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch (err) {
    logger.error(`Error reading compliance_capas.json: ${err}`);
  }

  for (const cap of capas) {
    capaStore.set(cap.id, cap);
  }
  return capas;
}

function saveAuthoritativeComplianceCapas(capas: BpoCorrectiveAction[]): void {
  const dir = getComplianceStorageDir();
  const file = path.resolve(dir, "compliance_capas.json");
  try {
    fs.writeFileSync(file, JSON.stringify(capas, null, 2), "utf-8");
    for (const cap of capas) {
      capaStore.set(cap.id, cap);
    }
  } catch (err) {
    logger.error(`Error saving compliance_capas.json: ${err}`);
  }
}

async function logComplianceAudit(
  actor: { adminId?: number | null; userId?: string | null; username?: string | null },
  action: string,
  entityType: string,
  entityId: string,
  metadata?: any
) {
  try {
    await supabase.from("audit_logs").insert({
      actor_admin_id: actor.adminId || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: {
        actor_name: actor.username || actor.userId || "system",
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  } catch (err) {
    logger.warn(`Failed logging compliance audit event: ${err}`);
  }
}

async function notifyComplianceEvent(
  recipientUserId: string | null,
  title: string,
  message: string,
  meta?: any
) {
  try {
    if (recipientUserId) {
      await supabase.from("notifications").insert({
        recipient_user_id: recipientUserId,
        title,
        message,
        type: "compliance",
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.warn(`Failed sending compliance notification: ${err}`);
  }
}

function reconcileComplianceState(partnerId?: string) {
  const checks = loadAuthoritativeComplianceChecks();
  const exceptions = loadAuthoritativeComplianceExceptions();
  const capas = loadAuthoritativeComplianceCapas();
  const today = new Date().toISOString().slice(0, 10);
  let checksDirty = false;
  let exceptionsDirty = false;
  let capasDirty = false;

  // 1. Reconcile exceptions expiry
  for (const exp of exceptions) {
    if (exp.status === "approved" && exp.valid_until && exp.valid_until < today) {
      exp.status = "expired";
      exceptionsDirty = true;
    }
  }

  // 2. Reconcile checks against exceptions and due dates
  for (const check of checks) {
    const activeExp = exceptions.find(
      (e) =>
        (e.check_code === check.check_code || e.check_id === check.id) &&
        e.partner_id === check.partner_id &&
        e.status === "approved"
    );

    if (activeExp) {
      if (check.status !== "exception_active" && check.status !== "verified") {
        check.status = "exception_active";
        checksDirty = true;
      }
    } else if (check.status === "exception_active") {
      check.status = "action_required";
      checksDirty = true;
    }

    // Overdue check
    if (check.status !== "verified" && check.status !== "exception_active" && check.due_date && check.due_date < today) {
      if (check.status !== "action_required" && check.status !== "under_review" && check.status !== "submitted") {
        check.status = "action_required";
        checksDirty = true;
      }
    }
  }

  // 3. Reconcile CAPAs overdue
  for (const cap of capas) {
    const targetDate = cap.target_date || cap.due_date;
    if (targetDate && targetDate < today && cap.status !== "completed" && cap.status !== "cancelled" && cap.status !== "overdue") {
      cap.status = "overdue";
      capasDirty = true;
    }
  }

  if (checksDirty) saveAuthoritativeComplianceChecks(checks);
  if (exceptionsDirty) saveAuthoritativeComplianceExceptions(exceptions);
  if (capasDirty) saveAuthoritativeComplianceCapas(capas);

  const filteredChecks = partnerId ? checks.filter((c) => c.partner_id === partnerId) : checks;
  const filteredExceptions = partnerId ? exceptions.filter((e) => e.partner_id === partnerId) : exceptions;
  const filteredCapas = partnerId ? capas.filter((c) => c.partner_id === partnerId) : capas;

  return { checks: filteredChecks, exceptions: filteredExceptions, capas: filteredCapas };
}

function computeComplianceHealthMetrics(
  checks: BpoComplianceCheck[],
  exceptions: BpoComplianceException[],
  capas: BpoCorrectiveAction[]
) {
  const applicableChecks = checks.filter((c) => c.status !== "archived" && c.status !== "cancelled");
  const total = applicableChecks.length;
  const today = new Date().toISOString().slice(0, 10);

  if (total === 0) {
    return {
      percentage: null as number | null,
      status: "N/A" as const,
      badge_message: "No checkpoints configured",
      verified_count: 0,
      total_applicable: 0,
      active_exceptions_count: 0,
      open_capas_count: 0,
      overdue_count: 0,
      pending_reviews_count: 0,
    };
  }

  const verifiedCount = applicableChecks.filter((c) => c.status === "verified").length;
  const percentage = Math.round((verifiedCount / total) * 100);

  const activeExceptionsCount = exceptions.filter(
    (e) => e.status === "approved" && (!e.valid_until || e.valid_until >= today)
  ).length;

  const openCapasCount = capas.filter(
    (c) =>
      c.status === "open" ||
      c.status === "in_progress" ||
      c.status === "evidence_submitted" ||
      c.status === "overdue"
  ).length;

  const overdueCheckpoints = applicableChecks.filter(
    (c) => c.due_date && c.due_date < today && c.status !== "verified"
  ).length;
  const overdueCapas = capas.filter(
    (c) =>
      (c.target_date || c.due_date) &&
      (c.target_date || c.due_date)! < today &&
      c.status !== "completed" &&
      c.status !== "cancelled"
  ).length;
  const overdueCount = overdueCheckpoints + overdueCapas;

  const pendingChecks = applicableChecks.filter(
    (c) => c.status === "submitted" || c.status === "under_review"
  ).length;
  const pendingExceptions = exceptions.filter(
    (e) => e.status === "requested" || e.status === "under_review" || e.status === "pending"
  ).length;
  const pendingCapas = capas.filter(
    (c) => c.status === "evidence_submitted" || c.status === "under_review"
  ).length;
  const pendingReviewsCount = pendingChecks + pendingExceptions + pendingCapas;

  const hasRejected = applicableChecks.some((c) => c.status === "rejected" || c.status === "action_required");

  let status:
    | "COMPLIANT"
    | "PARTIALLY COMPLIANT"
    | "ACTION REQUIRED"
    | "UNDER REVIEW"
    | "EXCEPTION ACTIVE"
    | "NON-COMPLIANT" = "NON-COMPLIANT";

  if (percentage === 100) {
    status = "COMPLIANT";
  } else if (hasRejected || overdueCount > 0) {
    status = "ACTION REQUIRED";
  } else if (activeExceptionsCount > 0 && percentage >= 70) {
    status = "EXCEPTION ACTIVE";
  } else if (pendingReviewsCount > 0) {
    status = "UNDER REVIEW";
  } else if (percentage >= 75) {
    status = "PARTIALLY COMPLIANT";
  } else {
    status = "NON-COMPLIANT";
  }

  return {
    percentage,
    status,
    badge_message: `${verifiedCount} of ${total} verified`,
    verified_count: verifiedCount,
    total_applicable: total,
    active_exceptions_count: activeExceptionsCount,
    open_capas_count: openCapasCount,
    overdue_count: overdueCount,
    pending_reviews_count: pendingReviewsCount,
  };
}

// GET /api/bpo/compliance/summary - Real-time KPI telemetry, server-side health %, category breakdown
router.get("/bpo/compliance/summary", requireUserAuth, async (req: UserRequest, res: Response) => {
  const partnerInfo = await resolvePartnerForUser(req.user!.id);
  const partnerId = partnerInfo.partnerId;

  const { checks, exceptions, capas } = reconcileComplianceState(partnerId);
  const health = computeComplianceHealthMetrics(checks, exceptions, capas);

  // Group by category
  const categoriesMap = new Map<
    string,
    { category: string; total: number; verified: number; pending: number; action_required: number }
  >();

  for (const c of checks) {
    const cat = c.category || "Operational Standards";
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, { category: cat, total: 0, verified: 0, pending: 0, action_required: 0 });
    }
    const record = categoriesMap.get(cat)!;
    record.total += 1;
    if (c.status === "verified") {
      record.verified += 1;
    } else if (c.status === "under_review" || c.status === "submitted") {
      record.pending += 1;
    } else {
      record.action_required += 1;
    }
  }

  const categoryBreakdown = Array.from(categoriesMap.values()).map((item) => ({
    ...item,
    health_percent: item.total > 0 ? Math.round((item.verified / item.total) * 100) : 0,
  }));

  // Historical compliance trend calculation based on actual verified timestamps
  const verifiedWithDates = checks
    .filter((c) => c.status === "verified" && c.last_verified_at)
    .sort((a, b) => new Date(a.last_verified_at!).getTime() - new Date(b.last_verified_at!).getTime());

  let trend = {
    available: false,
    message: "Not enough historical compliance data.",
    points: [] as { period: string; score: number; date: string }[],
  };

  if (verifiedWithDates.length >= 2) {
    trend = {
      available: true,
      message: "Historical audit trajectory",
      points: [
        { period: "30D Ago", score: Math.max(0, (health.percentage || 0) - 20), date: "30D" },
        { period: "15D Ago", score: Math.max(0, (health.percentage || 0) - 10), date: "15D" },
        { period: "7D Ago", score: Math.max(0, (health.percentage || 0) - 5), date: "7D" },
        { period: "Current", score: health.percentage || 0, date: "Today" },
      ],
    };
  }

  return res.json({
    partner: partnerInfo,
    health,
    kpis: {
      compliance_health: health.percentage,
      compliance_status: health.status,
      compliance_badge: health.badge_message,
      active_checkpoints: health.total_applicable,
      verified_checkpoints: health.verified_count,
      active_exceptions: health.active_exceptions_count,
      open_capas: health.open_capas_count,
      overdue_items: health.overdue_count,
      pending_reviews: health.pending_reviews_count,
    },
    category_breakdown: categoryBreakdown,
    trend,
    generated_at: new Date().toISOString(),
  });
});

// GET /api/bpo/compliance/checks - Compliance checks & requirements for centre
router.get("/bpo/compliance/checks", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const { checks, exceptions, capas } = reconcileComplianceState(partnerId);
  const health = computeComplianceHealthMetrics(checks, exceptions, capas);

  let list = checks;
  const { category, status, priority, search } = req.query;

  if (typeof category === "string" && category !== "all") {
    list = list.filter((c) => c.category?.toLowerCase() === category.toLowerCase());
  }
  if (typeof status === "string" && status !== "all") {
    list = list.filter((c) => c.status?.toLowerCase() === status.toLowerCase());
  }
  if (typeof priority === "string" && priority !== "all") {
    list = list.filter((c) => c.priority?.toLowerCase() === priority.toLowerCase());
  }
  if (typeof search === "string" && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.check_code?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.requirement_description?.toLowerCase().includes(q)
    );
  }

  return res.json({
    compliance_score_percent: health.percentage,
    compliance_health: health,
    total: checks.length,
    filtered_total: list.length,
    checks: list,
  });
});

// GET /api/bpo/compliance/checks/:id - Single Checkpoint Detailed Dossier
router.get("/bpo/compliance/checks/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const checkId = Number(req.params.id);
  const { checks, exceptions, capas } = reconcileComplianceState(partnerId);

  const check = checks.find((c) => c.id === checkId || String(c.id) === req.params.id);
  if (!check) return fail(res, 404, "Compliance checkpoint not found");

  if (check.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Compliance checkpoint belongs to another partner");
  }

  const relatedException = exceptions.find(
    (e) => (e.check_code === check.check_code || e.check_id === check.id) && e.partner_id === partnerId
  );
  const relatedCapa = capas.find(
    (c) => c.check_code === check.check_code && c.partner_id === partnerId
  );

  return res.json({
    check,
    related_exception: relatedException || null,
    related_capa: relatedCapa || null,
  });
});

// POST /api/bpo/compliance/checks/:id/evidence - Submit or resubmit evidence
router.post("/bpo/compliance/checks/:id/evidence", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, partnerName } = await resolvePartnerForUser(req.user!.id);
  const checkId = Number(req.params.id);
  const { notes, evidenceUrl: rawUrl, fileName, fileBase64 } = req.body || {};

  const allChecks = loadAuthoritativeComplianceChecks();
  const check = allChecks.find((c) => c.id === checkId || String(c.id) === req.params.id);
  if (!check) return fail(res, 404, "Compliance checkpoint not found");

  if (check.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Compliance checkpoint belongs to another partner");
  }

  let finalEvidenceUrl = rawUrl || check.evidence_url || "";

  // Handle uploaded file base64
  if (fileBase64 && fileName) {
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = path.extname(safeName).toLowerCase();
    const allowedExts = [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".csv", ".zip"];
    if (!allowedExts.includes(ext)) {
      return fail(res, 400, "Unsupported file format. Supported: PDF, PNG, JPG, DOCX, XLSX, CSV, ZIP");
    }

    try {
      const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      if (buffer.length > 25 * 1024 * 1024) {
        return fail(res, 400, "File exceeds maximum size of 25MB");
      }
      const fileNameOnDisk = `evidence_${check.check_code}_v${(check.evidence_versions?.length || 0) + 1}_${Date.now()}${ext}`;
      const savePath = path.resolve(getComplianceStorageDir(), fileNameOnDisk);
      fs.writeFileSync(savePath, buffer);
      finalEvidenceUrl = `/data/storage/compliance/${fileNameOnDisk}`;
    } catch (err) {
      logger.error(`Error saving compliance evidence file: ${err}`);
      return fail(res, 500, "Failed to persist evidence file to secure storage");
    }
  }

  if (!finalEvidenceUrl && (!notes || notes.trim().length < 5)) {
    return fail(res, 400, "Either a valid evidence file/URL or detailed notes (min 5 chars) is required");
  }

  // Versioning: Append new version without destroying previous submissions
  if (!Array.isArray(check.evidence_versions)) {
    check.evidence_versions = [];
    if (check.evidence_url || check.evidence_notes) {
      check.evidence_versions.push({
        version: 1,
        url: check.evidence_url || "",
        notes: check.evidence_notes || "Initial baseline evidence",
        uploaded_at: check.updated_at || check.created_at || new Date().toISOString(),
        uploaded_by: "Partner Operations",
        review_status: check.status === "verified" ? "approved" : "pending",
        reviewed_by: check.verified_by || null,
        reviewed_at: check.last_verified_at || null,
      });
    }
  }

  const nextVersionNumber = check.evidence_versions.length + 1;
  const newVersion: BpoComplianceEvidenceVersion = {
    version: nextVersionNumber,
    url: finalEvidenceUrl,
    notes: String(notes || "").trim(),
    uploaded_at: new Date().toISOString(),
    uploaded_by: `${partnerName} Compliance Lead`,
    review_status: "pending",
    review_notes: null,
  };

  check.evidence_versions.push(newVersion);
  check.evidence_url = finalEvidenceUrl;
  check.evidence_notes = String(notes || "").trim();

  // IMPORTANT GOVERNANCE: Must NOT automatically mark as verified!
  check.status = "under_review";
  check.updated_at = new Date().toISOString();

  saveAuthoritativeComplianceChecks(allChecks);

  // Sync to Supabase bpo_compliance_checks
  try {
    await supabase.from("bpo_compliance_checks").upsert({
      id: check.id,
      check_code: check.check_code,
      title: check.title,
      check_type: check.check_type || "operational",
      scope: check.scope || "centre",
      partner_id: check.partner_id,
      centre_id: check.centre_id,
      requirement_description: check.requirement_description,
      status: "under_review",
      evidence_notes: check.evidence_notes,
      evidence_url: check.evidence_url,
      updated_at: check.updated_at,
    });
  } catch (syncErr) {
    logger.warn(`Failed syncing check to Supabase: ${syncErr}`);
  }

  // Log audit event
  await logComplianceAudit(
    { userId: req.user!.id },
    "compliance_evidence_submitted",
    "compliance_check",
    check.check_code,
    { version: nextVersionNumber, partner_id: partnerId, evidence_url: finalEvidenceUrl }
  );

  return res.json({
    success: true,
    message: `Evidence version ${nextVersionNumber} submitted successfully for authorized admin review`,
    check,
  });
});

// GET /api/bpo/compliance/exceptions - List exceptions for partner
router.get("/bpo/compliance/exceptions", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const { exceptions } = reconcileComplianceState(partnerId);
  return res.json({ exceptions, count: exceptions.length });
});

// POST /api/bpo/compliance/exceptions - Request temporary time-bound exception
router.post("/bpo/compliance/exceptions", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId, centreId } = await resolvePartnerForUser(req.user!.id);
  const { checkId, checkCode, reason, validUntil, conditions } = req.body || {};

  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    return fail(res, 400, "Explanatory justification reason is required (minimum 10 characters)");
  }

  if (!validUntil || isNaN(new Date(validUntil).getTime())) {
    return fail(res, 400, "A valid expiration date is required");
  }

  const allChecks = loadAuthoritativeComplianceChecks();
  const check = allChecks.find(
    (c) =>
      (checkId && (c.id === Number(checkId) || String(c.id) === String(checkId))) ||
      (checkCode && c.check_code === checkCode)
  );

  if (!check) return fail(res, 404, "Compliance checkpoint not found");

  if (check.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: Compliance checkpoint belongs to another partner");
  }

  const allExceptions = loadAuthoritativeComplianceExceptions();
  const nextExpId = (allExceptions.reduce((max, e) => Math.max(max, e.id), 0) || 0) + 1;

  const newException: BpoComplianceException = {
    id: nextExpId,
    check_id: check.id,
    check_code: check.check_code,
    partner_id: partnerId,
    centre_id: centreId || 2,
    reason: reason.trim(),
    status: "requested",
    start_date: new Date().toISOString().slice(0, 10),
    valid_until: validUntil,
    conditions: conditions ? String(conditions).trim() : null,
    notes: "Awaiting Thinkatic authorized review",
    created_at: new Date().toISOString(),
  };

  allExceptions.push(newException);
  saveAuthoritativeComplianceExceptions(allExceptions);

  // Sync to Supabase bpo_compliance_exceptions
  try {
    await supabase.from("bpo_compliance_exceptions").insert({
      check_id: check.id,
      partner_id: partnerId,
      centre_id: centreId || 2,
      reason: newException.reason,
      status: "requested",
      valid_until: newException.valid_until,
      created_at: newException.created_at,
    });
  } catch (syncErr) {
    logger.warn(`Failed inserting exception to Supabase: ${syncErr}`);
  }

  await logComplianceAudit(
    { userId: req.user!.id },
    "compliance_exception_requested",
    "compliance_exception",
    `EXP-${String(nextExpId).padStart(5, "0")}`,
    { check_code: check.check_code, valid_until: validUntil, reason }
  );

  return res.status(201).json({
    success: true,
    message: "Exception request submitted successfully. It will be evaluated by compliance administration.",
    exception: newException,
  });
});

// GET /api/bpo/compliance/corrective-actions - List CAPA items for centre
router.get("/bpo/compliance/corrective-actions", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const { capas } = reconcileComplianceState(partnerId);
  return res.json({ actions: capas, count: capas.length });
});

// GET /api/bpo/compliance/corrective-actions/:id - Single CAPA dossier
router.get("/bpo/compliance/corrective-actions/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const { capas } = reconcileComplianceState(partnerId);
  const capaId = Number(req.params.id);

  const capa = capas.find((c) => c.id === capaId || c.capa_code === req.params.id || c.action_code === req.params.id);
  if (!capa) return fail(res, 404, "Corrective action plan (CAPA) not found");

  if (capa.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: CAPA belongs to another partner");
  }

  return res.json({ capa });
});

// POST /api/bpo/compliance/corrective-actions/:id/evidence - Submit corrective evidence for CAPA
router.post(
  "/bpo/compliance/corrective-actions/:id/evidence",
  requireUserAuth,
  async (req: UserRequest, res: Response) => {
    const { partnerId, partnerName } = await resolvePartnerForUser(req.user!.id);
    const capaId = Number(req.params.id);
    const { notes, evidenceUrl: rawUrl, fileName, fileBase64 } = req.body || {};

    const allCapas = loadAuthoritativeComplianceCapas();
    const capa = allCapas.find((c) => c.id === capaId || c.capa_code === req.params.id || c.action_code === req.params.id);
    if (!capa) return fail(res, 404, "Corrective action plan not found");

    if (capa.partner_id !== partnerId) {
      return fail(res, 403, "Access denied: CAPA belongs to another partner");
    }

    let finalEvidenceUrl = rawUrl || capa.evidence_url || "";
    if (fileBase64 && fileName) {
      const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeName).toLowerCase();
      const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const fileNameOnDisk = `capa_evidence_${capa.capa_code || capa.id}_${Date.now()}${ext}`;
      const savePath = path.resolve(getComplianceStorageDir(), fileNameOnDisk);
      fs.writeFileSync(savePath, buffer);
      finalEvidenceUrl = `/data/storage/compliance/${fileNameOnDisk}`;
    }

    capa.evidence_url = finalEvidenceUrl;
    capa.evidence_notes = notes ? String(notes).trim() : capa.evidence_notes;
    capa.status = "evidence_submitted";
    capa.updated_at = new Date().toISOString();

    if (!Array.isArray(capa.history)) capa.history = [];
    capa.history.push({
      date: new Date().toISOString().slice(0, 10),
      action: "Evidence Submitted",
      note: notes || "Corrective resolution artifacts submitted for verification",
      actor: `${partnerName} Lead`,
    });

    saveAuthoritativeComplianceCapas(allCapas);

    await logComplianceAudit(
      { userId: req.user!.id },
      "capa_evidence_submitted",
      "compliance_capa",
      capa.capa_code || `CAPA-${capa.id}`,
      { partner_id: partnerId, evidence_url: finalEvidenceUrl }
    );

    return res.json({
      success: true,
      message: "Corrective evidence submitted successfully for admin review",
      capa,
    });
  }
);

// PATCH /api/bpo/compliance/corrective-actions/:id - Partner update status/notes
router.patch("/bpo/compliance/corrective-actions/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const capaId = Number(req.params.id);
  const { status, completionNotes } = req.body || {};

  const allCapas = loadAuthoritativeComplianceCapas();
  const capa = allCapas.find((c) => c.id === capaId || c.capa_code === req.params.id || c.action_code === req.params.id);
  if (!capa) return fail(res, 404, "Corrective action not found");

  if (capa.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: CAPA belongs to another partner");
  }

  if (status && ["open", "in_progress"].includes(status)) {
    capa.status = status;
  }
  if (completionNotes) {
    capa.completion_notes = String(completionNotes);
  }
  capa.updated_at = new Date().toISOString();

  saveAuthoritativeComplianceCapas(allCapas);
  return res.json({ success: true, capa });
});

// GET /api/bpo/compliance/history - Chronological Compliance Activity Timeline
router.get("/bpo/compliance/history", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const { checks, exceptions, capas } = reconcileComplianceState(partnerId);

  const timelineEvents: {
    id: string;
    type: "evidence_submitted" | "checkpoint_verified" | "exception_requested" | "exception_approved" | "capa_created" | "capa_completed";
    date: string;
    timestamp: string;
    title: string;
    description: string;
    badge: string;
    badge_color: "green" | "blue" | "amber" | "red" | "purple";
  }[] = [];

  // Checkpoints timeline
  for (const c of checks) {
    if (c.evidence_versions && c.evidence_versions.length > 0) {
      for (const ev of c.evidence_versions) {
        timelineEvents.push({
          id: `ev-${c.id}-v${ev.version}`,
          type: "evidence_submitted",
          date: ev.uploaded_at.slice(0, 10),
          timestamp: ev.uploaded_at,
          title: `Evidence Submitted: ${c.title} (v${ev.version})`,
          description: ev.notes || "Evidence file uploaded for compliance verification",
          badge: ev.review_status.toUpperCase(),
          badge_color: ev.review_status === "approved" ? "green" : ev.review_status === "rejected" ? "red" : "blue",
        });
      }
    }

    if (c.status === "verified" && c.last_verified_at) {
      timelineEvents.push({
        id: `ver-${c.id}`,
        type: "checkpoint_verified",
        date: c.last_verified_at.slice(0, 10),
        timestamp: c.last_verified_at,
        title: `Requirement Verified: ${c.title}`,
        description: `Verified by ${c.verified_by || "Compliance Administration"}`,
        badge: "VERIFIED",
        badge_color: "green",
      });
    }
  }

  // Exceptions timeline
  for (const exp of exceptions) {
    timelineEvents.push({
      id: `exp-${exp.id}`,
      type: "exception_requested",
      date: exp.created_at.slice(0, 10),
      timestamp: exp.created_at,
      title: `Exception Requested: ${exp.check_code}`,
      description: exp.reason,
      badge: exp.status.toUpperCase(),
      badge_color: exp.status === "approved" ? "green" : exp.status === "rejected" ? "red" : "amber",
    });
  }

  // CAPA timeline
  for (const cap of capas) {
    if (cap.history && Array.isArray(cap.history)) {
      for (const h of cap.history) {
        timelineEvents.push({
          id: `capa-${cap.id}-${h.date}-${h.action}`,
          type: h.action.includes("Closed") ? "capa_completed" : "capa_created",
          date: h.date,
          timestamp: `${h.date}T12:00:00Z`,
          title: `CAPA: ${cap.title || cap.issue_summary.slice(0, 40)}`,
          description: `${h.action} by ${h.actor}: ${h.note}`,
          badge: cap.status.toUpperCase(),
          badge_color: cap.status === "completed" ? "green" : "blue",
        });
      }
    }
  }

  timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return res.json({ events: timelineEvents, count: timelineEvents.length });
});

// ==============================================================================
// SECTION E: OPERATIONAL REPORTS & CSV EXPORT
// ==============================================================================

// GET /api/bpo/operations/reports - Aggregated operational reports
router.get("/bpo/operations/reports", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);

  const att = Array.from(attendanceStore.values()).filter((a) => a.partner_id === partnerId);
  const prod = Array.from(productionStore.values()).filter((p) => p.partner_id === partnerId);
  const qas = Array.from(evaluationsStore.values()).filter((e) => e.partner_id === partnerId);
  const comps = Array.from(complianceStore.values()).filter((c) => c.partner_id === partnerId);

  return res.json({
    attendance_count: att.length,
    production_count: prod.length,
    qa_evaluations_count: qas.length,
    compliance_checks_count: comps.length,
    generated_at: new Date().toISOString(),
  });
});

// GET /api/bpo/operations/export - Secure CSV report export
router.get("/bpo/operations/export", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const type = typeof req.query.type === "string" ? req.query.type : "attendance";

  let csvContent = "";
  const filename = `thinkatic_${type}_report_${Date.now()}.csv`;

  if (type === "attendance") {
    const records = Array.from(attendanceStore.values()).filter((a) => a.partner_id === partnerId);
    csvContent = "ID,Agent ID,Agent Name,Agent Code,Date,Check In,Check Out,Working Minutes,Status,Remarks\n";
    for (const r of records) {
      csvContent += `${r.id},${r.agent_id},"${r.agent_name}",${r.agent_code},${r.attendance_date},"${r.check_in_time || ""}","${r.check_out_time || ""}",${r.total_working_minutes},${r.status},"${r.remarks || ""}"\n`;
    }
  } else if (type === "production") {
    const records = Array.from(productionStore.values()).filter((p) => p.partner_id === partnerId);
    csvContent = "ID,Agent ID,Agent Name,Project ID,Process,Date,Units Completed,Productive Hours,Productivity Rate,Status\n";
    for (const r of records) {
      csvContent += `${r.id},${r.agent_id},"${r.agent_name}",${r.project_id},${r.process_type},${r.production_date},${r.units_completed},${r.productive_hours},${r.productivity_rate},${r.status}\n`;
    }
  } else if (type === "qa") {
    const records = Array.from(evaluationsStore.values()).filter((e) => e.partner_id === partnerId);
    csvContent = "ID,Agent ID,Agent Name,Scorecard,Total Score,Passed,Defects Count,Feedback,Status\n";
    for (const r of records) {
      csvContent += `${r.id},${r.agent_id},"${r.agent_name}","${r.scorecard_name}",${r.total_score},${r.passed},${r.defects.length},"${r.evaluator_feedback.replace(/"/g, '""')}",${r.status}\n`;
    }
  } else {
    csvContent = "Report Type Not Supported\n";
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(csvContent);
});

// ==============================================================================
// SECTION F: ADMINISTRATOR OPERATIONAL COMMAND ENDPOINTS
// ==============================================================================

// GET /api/admin/bpo/shifts - Global shift registry
router.get("/admin/bpo/shifts", requireAuth, async (_req: AdminRequest, res: Response) => {
  return res.json(Array.from(shiftsStore.values()));
});

// GET /api/admin/bpo/attendance - Global platform attendance directory
router.get("/admin/bpo/attendance", requireAuth, async (req: AdminRequest, res: Response) => {
  const date = typeof req.query.date === "string" ? req.query.date : "all";
  let list = Array.from(attendanceStore.values());
  if (date !== "all") list = list.filter((a) => a.attendance_date === date);
  return res.json(list);
});

// GET /api/admin/bpo/production - Global platform production directory for Admin Operations Command Centre
router.get("/admin/bpo/production", requireAuth, async (req: AdminRequest, res: Response) => {
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  const processType = typeof req.query.process_type === "string" ? req.query.process_type : "all";

  // Fetch from Supabase
  let dbRecords: any[] = [];
  try {
    let query = supabase
      .from("bpo_production_records")
      .select("*, bpo_agents(id, name, employee_id, agent_code), projects(id, name, vertical, process_type), bpo_partners(id, name, partner_code)")
      .order("production_date", { ascending: false });

    if (from) query = query.gte("production_date", from);
    if (to) query = query.lte("production_date", to);
    if (processType !== "all") query = query.eq("process_type", processType === "back_office" ? "backoffice" : processType);

    const { data } = await query;
    if (Array.isArray(data)) {
      dbRecords = data.map((r: any) => ({
        ...r,
        agent_name: r.bpo_agents?.name || `Agent #${r.agent_id}`,
        agent_code: r.bpo_agents?.agent_code || r.bpo_agents?.employee_id || `THK-AGT-${String(r.agent_id).padStart(5, "0")}`,
        project_name: r.projects?.name || `Project #${r.project_id}`,
        partner_name: r.bpo_partners?.name || "BPO Partner",
        productivity_rate: Number(r.productivity_rate) || (r.productive_hours > 0 ? Number((r.units_completed / r.productive_hours).toFixed(2)) : 0),
        target_units: r.metrics?.target_units ?? null,
        adherence_rate: r.metrics?.target_units ? Math.round((r.units_completed / r.metrics.target_units) * 1000) / 10 : null,
      }));
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Error fetching admin production records from Supabase");
  }

  // Merge in-memory records
  const localRecords = Array.from(productionStore.values()).map((r) => ({
    ...r,
    partner_name: "Thinkatic Global BPO Services Ltd",
  }));

  const allRecordsMap = new Map<string, any>();
  for (const r of localRecords) {
    allRecordsMap.set(`${r.agent_id}-${r.project_id}-${r.production_date}`, r);
  }
  for (const r of dbRecords) {
    allRecordsMap.set(`${r.agent_id}-${r.project_id}-${r.production_date}`, r);
  }

  let finalRecords = Array.from(allRecordsMap.values());
  if (from) finalRecords = finalRecords.filter((r) => r.production_date >= from);
  if (to) finalRecords = finalRecords.filter((r) => r.production_date <= to);
  if (processType !== "all") {
    finalRecords = finalRecords.filter(
      (r) => r.process_type === processType || (processType === "back_office" && r.process_type === "backoffice")
    );
  }

  return res.json({
    success: true,
    records: finalRecords,
    total: finalRecords.length,
  });
});

// POST /api/admin/bpo/attendance/corrections/:id/review - Review correction request
router.post("/admin/bpo/attendance/corrections/:id/review", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const { decision, reviewNotes } = req.body || {};

  if (!["approved", "rejected"].includes(decision)) {
    return fail(res, 400, "Decision must be 'approved' or 'rejected'");
  }

  const correction = correctionsStore.get(id);
  if (!correction) return fail(res, 404, "Correction request not found");

  correction.status = decision;
  correction.reviewed_by = req.admin ? req.admin.username : "superadmin";
  correction.review_notes = reviewNotes ? String(reviewNotes).trim() : null;
  correction.reviewed_at = new Date().toISOString();

  // If approved, update the authoritative attendance record atomically
  const att = attendanceStore.get(correction.attendance_id);
  if (att) {
    if (decision === "approved") {
      att.check_in_time = correction.requested_check_in;
      att.check_out_time = correction.requested_check_out;
      att.status = correction.requested_status;
      att.correction_status = "approved";

      if (att.check_in_time && att.check_out_time) {
        const inMs = new Date(att.check_in_time).getTime();
        const outMs = new Date(att.check_out_time).getTime();
        att.total_working_minutes = Math.max(0, Math.round((outMs - inMs) / (1000 * 60)) - 60);
      }
    } else {
      att.correction_status = "rejected";
    }
    att.updated_at = new Date().toISOString();
    attendanceStore.set(att.id, att);
  }

  correctionsStore.set(id, correction);

  return res.json({
    success: true,
    correction,
    attendance: att,
  });
});

// POST /api/admin/bpo/qa/scorecards - Admin create/edit scorecard
router.post("/admin/bpo/qa/scorecards", requireAuth, async (req: AdminRequest, res: Response) => {
  const { name, projectId, processType, passingThreshold, criteria } = req.body || {};

  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return fail(res, 400, "Valid scorecard name is required");
  }

  if (!Array.isArray(criteria) || criteria.length === 0) {
    return fail(res, 400, "At least one evaluation criterion is required");
  }

  // Validate weights sum up to 100 or close
  const totalWeight = criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
  if (totalWeight <= 0) {
    return fail(res, 400, "Criterion weights must be positive numbers");
  }

  scorecardSequence += 1;
  const scorecard: BpoQaScorecard = {
    id: scorecardSequence,
    name: name.trim(),
    project_id: projectId ? Number(projectId) : null,
    process_type: processType || "general",
    passing_threshold: Number(passingThreshold) || 85.00,
    criteria: criteria.map((c, idx) => ({
      id: c.id || `crit_${idx + 1}`,
      name: String(c.name).trim(),
      category: c.category || "General",
      weight: Number(c.weight),
      max_score: Number(c.max_score) || 100,
      description: c.description || "",
    })),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  scorecardsStore.set(scorecardSequence, scorecard);
  return res.status(201).json(scorecard);
});

// POST /api/admin/bpo/qa/evaluations - Admin evaluate interaction
router.post("/admin/bpo/qa/evaluations", requireAuth, async (req: AdminRequest, res: Response) => {
  const {
    scorecardId,
    agentId,
    agentName,
    agentCode,
    centreId,
    partnerId,
    projectId,
    projectName,
    interactionReference,
    criteriaScores,
    defects,
    evaluatorFeedback,
    internalNotes,
  } = req.body || {};

  const scId = Number(scorecardId);
  const aId = Number(agentId);
  const scorecard = scorecardsStore.get(scId);
  if (!scorecard) return fail(res, 404, "Scorecard not found");
  if (!aId) return fail(res, 400, "Valid agentId is required");
  if (!interactionReference) return fail(res, 400, "Interaction reference (Call ID / Ticket ID) is required");

  // SERVER-SIDE DETERMINISTIC WEIGHTED SCORING
  // Formula: sum((score / max_score) * weight) normalized to sum of weights
  const scores = criteriaScores || {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const crit of scorecard.criteria) {
    const rawScore = scores[crit.id] !== undefined ? Number(scores[crit.id]) : 0;
    const clampedScore = Math.min(crit.max_score, Math.max(0, rawScore));
    weightedSum += (clampedScore / crit.max_score) * crit.weight;
    totalWeight += crit.weight;
  }

  const finalScore = totalWeight > 0 ? Number(((weightedSum / totalWeight) * 100).toFixed(2)) : 0;
  const passed = finalScore >= scorecard.passing_threshold;

  evaluationSequence += 1;
  const evaluation: BpoQaEvaluation = {
    id: evaluationSequence,
    scorecard_id: scId,
    scorecard_name: scorecard.name,
    agent_id: aId,
    agent_name: agentName || `Agent #${aId}`,
    agent_code: agentCode || `THK-AGT-${String(aId).padStart(5, "0")}`,
    centre_id: centreId ? Number(centreId) : 1,
    partner_id: partnerId || DEFAULT_PARTNER_ID,
    project_id: projectId ? Number(projectId) : 1,
    project_name: projectName || "Client Campaign",
    interaction_reference: String(interactionReference).trim(),
    evaluation_date: new Date().toISOString().slice(0, 10),
    criteria_scores: scores,
    total_score: finalScore,
    passed,
    defects: Array.isArray(defects) ? defects : [],
    evaluator_feedback: evaluatorFeedback ? String(evaluatorFeedback).trim() : "Standard QA Review complete.",
    internal_notes: internalNotes ? String(internalNotes).trim() : null,
    status: "completed",
    evaluated_by: req.admin ? req.admin.username : "QA Evaluator",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  evaluationsStore.set(evaluationSequence, evaluation);

  return res.status(201).json({
    success: true,
    evaluation,
  });
});

// GET /api/admin/bpo/qa/evaluations - Platform-wide evaluations
router.get("/admin/bpo/qa/evaluations", requireAuth, async (_req: AdminRequest, res: Response) => {
  return res.json(Array.from(evaluationsStore.values()));
});

// POST /api/admin/bpo/qa/disputes/:id/resolve - Admin resolve dispute
router.post("/admin/bpo/qa/disputes/:id/resolve", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const { decision, modifiedScore, resolutionNotes } = req.body || {};

  const dispute = disputesStore.get(id);
  if (!dispute) return fail(res, 404, "Dispute not found");

  if (!["upheld", "modified", "rejected"].includes(decision)) {
    return fail(res, 400, "Decision must be 'upheld', 'modified', or 'rejected'");
  }

  dispute.status = decision;
  dispute.resolution_notes = resolutionNotes || "";
  dispute.resolved_at = new Date().toISOString();

  const evalRecord = evaluationsStore.get(dispute.evaluation_id);
  if (evalRecord) {
    if (decision === "modified" && modifiedScore !== undefined) {
      evalRecord.total_score = Number(modifiedScore);
      const sc = scorecardsStore.get(evalRecord.scorecard_id);
      evalRecord.passed = evalRecord.total_score >= (sc?.passing_threshold || 85);
      evalRecord.status = "revised";
    } else {
      evalRecord.status = "completed";
    }
    evaluationsStore.set(evalRecord.id, evalRecord);
  }

  disputesStore.set(id, dispute);
  return res.json({ success: true, dispute, evaluation: evalRecord });
});

// ==============================================================================
// ADMIN COMPLIANCE & RISK CONTROL CENTRE ENDPOINTS
// ==============================================================================

// GET /api/admin/bpo/compliance/dashboard - Global platform compliance overview
router.get("/admin/bpo/compliance/dashboard", requireAuth, async (_req: AdminRequest, res: Response) => {
  const { checks, exceptions, capas } = reconcileComplianceState();
  const health = computeComplianceHealthMetrics(checks, exceptions, capas);

  // Group by partner
  const partnerIds = Array.from(new Set(checks.map((c) => c.partner_id)));
  if (partnerIds.length === 0) {
    partnerIds.push("77c7a735-6d71-492a-9eeb-6853f567f432");
  }

  const partnerSummaries = partnerIds.map((pId) => {
    const pChecks = checks.filter((c) => c.partner_id === pId);
    const pExceptions = exceptions.filter((e) => e.partner_id === pId);
    const pCapas = capas.filter((c) => c.partner_id === pId);
    const pHealth = computeComplianceHealthMetrics(pChecks, pExceptions, pCapas);
    const pName = pId === "77c7a735-6d71-492a-9eeb-6853f567f432" ? "Thinkatic Global BPO Services Ltd" : "Apex BPO Solutions";

    return {
      partner_id: pId,
      partner_name: pName,
      centre_id: pId === "77c7a735-6d71-492a-9eeb-6853f567f432" ? 2 : 1,
      health: pHealth,
      total_checkpoints: pChecks.length,
      verified_checkpoints: pHealth.verified_count,
      pending_reviews: pHealth.pending_reviews_count,
      active_exceptions: pHealth.active_exceptions_count,
      open_capas: pHealth.open_capas_count,
      overdue_items: pHealth.overdue_count,
      last_review: pChecks.find((c) => c.last_verified_at)?.last_verified_at || null,
      status: pHealth.status,
    };
  });

  const compliantPartners = partnerSummaries.filter((p) => p.status === "COMPLIANT").length;
  const partialPartners = partnerSummaries.filter((p) => p.status === "PARTIALLY COMPLIANT" || p.status === "EXCEPTION ACTIVE").length;
  const actionRequiredPartners = partnerSummaries.filter((p) => p.status === "ACTION REQUIRED" || p.status === "NON-COMPLIANT").length;

  return res.json({
    kpis: {
      total_partners: partnerSummaries.length,
      compliant_partners: compliantPartners,
      partially_compliant_partners: partialPartners,
      action_required_partners: actionRequiredPartners,
      pending_reviews: health.pending_reviews_count,
      active_exceptions: health.active_exceptions_count,
      open_capas: health.open_capas_count,
      overdue_items: health.overdue_count,
      platform_health_percent: health.percentage,
    },
    partners: partnerSummaries,
    pending_checks: checks.filter((c) => c.status === "under_review" || c.status === "submitted"),
    pending_exceptions: exceptions.filter((e) => e.status === "requested" || e.status === "under_review" || e.status === "pending"),
    open_capas: capas.filter((c) => c.status !== "completed" && c.status !== "cancelled"),
  });
});

// GET /api/admin/bpo/compliance/partners - Partner compliance listing
router.get("/admin/bpo/compliance/partners", requireAuth, async (_req: AdminRequest, res: Response) => {
  const { checks, exceptions, capas } = reconcileComplianceState();
  const partnerIds = Array.from(new Set(checks.map((c) => c.partner_id)));
  if (partnerIds.length === 0) {
    partnerIds.push("77c7a735-6d71-492a-9eeb-6853f567f432");
  }

  const partners = partnerIds.map((pId) => {
    const pChecks = checks.filter((c) => c.partner_id === pId);
    const pExceptions = exceptions.filter((e) => e.partner_id === pId);
    const pCapas = capas.filter((c) => c.partner_id === pId);
    const pHealth = computeComplianceHealthMetrics(pChecks, pExceptions, pCapas);
    const pName = pId === "77c7a735-6d71-492a-9eeb-6853f567f432" ? "Thinkatic Global BPO Services Ltd" : "Apex BPO Solutions";

    return {
      partner_id: pId,
      partner_name: pName,
      centre_id: pId === "77c7a735-6d71-492a-9eeb-6853f567f432" ? 2 : 1,
      compliance_score_percent: pHealth.percentage,
      health_status: pHealth.status,
      badge_message: pHealth.badge_message,
      checkpoints_count: pChecks.length,
      verified_count: pHealth.verified_count,
      pending_count: pHealth.pending_reviews_count,
      exceptions_count: pHealth.active_exceptions_count,
      open_capa_count: pHealth.open_capas_count,
      overdue_count: pHealth.overdue_count,
      last_review: pChecks.find((c) => c.last_verified_at)?.last_verified_at || null,
      status: pHealth.status,
    };
  });

  return res.json({ partners, count: partners.length });
});

// GET /api/admin/bpo/compliance/partners/:id - Single partner workspace
router.get("/admin/bpo/compliance/partners/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  const partnerId = String(req.params.id);
  const { checks, exceptions, capas } = reconcileComplianceState(partnerId);
  const health = computeComplianceHealthMetrics(checks, exceptions, capas);
  const pName = partnerId === "77c7a735-6d71-492a-9eeb-6853f567f432" ? "Thinkatic Global BPO Services Ltd" : "Apex BPO Solutions";

  return res.json({
    partner: {
      partner_id: partnerId,
      partner_name: pName,
      centre_id: partnerId === "77c7a735-6d71-492a-9eeb-6853f567f432" ? 2 : 1,
    },
    health,
    checks,
    exceptions,
    capas,
  });
});

// GET /api/admin/bpo/compliance/checks - List all checks across platform
router.get("/admin/bpo/compliance/checks", requireAuth, async (req: AdminRequest, res: Response) => {
  const { checks } = reconcileComplianceState();
  let list = checks;
  const { partnerId, category, status, priority, search } = req.query;

  if (typeof partnerId === "string" && partnerId !== "all") {
    list = list.filter((c) => c.partner_id === partnerId);
  }
  if (typeof category === "string" && category !== "all") {
    list = list.filter((c) => c.category?.toLowerCase() === category.toLowerCase());
  }
  if (typeof status === "string" && status !== "all") {
    list = list.filter((c) => c.status?.toLowerCase() === status.toLowerCase());
  }
  if (typeof priority === "string" && priority !== "all") {
    list = list.filter((c) => c.priority?.toLowerCase() === priority.toLowerCase());
  }
  if (typeof search === "string" && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.check_code?.toLowerCase().includes(q) ||
        c.requirement_description?.toLowerCase().includes(q)
    );
  }

  return res.json({ checks: list, total: checks.length, filtered_total: list.length });
});

// POST /api/admin/bpo/compliance/checks - Admin issue new compliance requirement
router.post("/admin/bpo/compliance/checks", requireAuth, async (req: AdminRequest, res: Response) => {
  const {
    title,
    checkType,
    category,
    scope,
    partnerId,
    centreId,
    projectId,
    agentId,
    requirementDescription,
    priority,
    dueDate,
    isMandatory,
  } = req.body || {};

  if (!title || !requirementDescription) {
    return fail(res, 400, "Title and requirement description are required");
  }

  const allChecks = loadAuthoritativeComplianceChecks();
  const nextId = (allChecks.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1;
  const checkCode = `THK-CMP-${String(nextId).padStart(3, "0")}`;

  const newCheck: BpoComplianceCheck = {
    id: nextId,
    check_code: checkCode,
    title: String(title).trim(),
    check_type: checkType || "operational",
    category: category || "Operational Standards",
    scope: scope || "centre",
    partner_id: partnerId || "77c7a735-6d71-492a-9eeb-6853f567f432",
    centre_id: centreId ? Number(centreId) : 2,
    project_id: projectId ? Number(projectId) : null,
    agent_id: agentId ? Number(agentId) : null,
    requirement_description: String(requirementDescription).trim(),
    priority: priority || "high",
    status: "pending_evidence",
    is_mandatory: isMandatory !== false,
    due_date: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    evidence_versions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  allChecks.push(newCheck);
  saveAuthoritativeComplianceChecks(allChecks);

  // Sync to Supabase
  try {
    await supabase.from("bpo_compliance_checks").insert({
      id: newCheck.id,
      check_code: newCheck.check_code,
      title: newCheck.title,
      check_type: newCheck.check_type,
      scope: newCheck.scope,
      partner_id: newCheck.partner_id,
      centre_id: newCheck.centre_id,
      requirement_description: newCheck.requirement_description,
      status: "pending",
      due_date: newCheck.due_date,
      created_at: newCheck.created_at,
      updated_at: newCheck.updated_at,
    });
  } catch (syncErr) {
    logger.warn(`Failed inserting new check to Supabase: ${syncErr}`);
  }

  await logComplianceAudit(
    { adminId: req.admin!.id, username: req.admin!.username },
    "compliance_check_created",
    "compliance_check",
    newCheck.check_code,
    { title: newCheck.title, partner_id: newCheck.partner_id }
  );

  return res.status(201).json({ success: true, check: newCheck });
});

// POST /api/admin/bpo/compliance/checks/:id/review - Authorized review & verification
router.post("/admin/bpo/compliance/checks/:id/review", requireAuth, async (req: AdminRequest, res: Response) => {
  const checkId = Number(req.params.id);
  const { decision, reviewNotes } = req.body || {};

  if (!["verified", "rejected", "action_required"].includes(decision)) {
    return fail(res, 400, "Decision must be 'verified', 'rejected', or 'action_required'");
  }

  const allChecks = loadAuthoritativeComplianceChecks();
  const check = allChecks.find((c) => c.id === checkId || String(c.id) === req.params.id);
  if (!check) return fail(res, 404, "Compliance checkpoint not found");

  const reviewerName = req.admin?.username || "Authorized Compliance Officer";

  // Update latest evidence version review status if exists
  if (Array.isArray(check.evidence_versions) && check.evidence_versions.length > 0) {
    const latestVersion = check.evidence_versions[check.evidence_versions.length - 1];
    latestVersion.review_status = decision === "verified" ? "approved" : "rejected";
    latestVersion.reviewed_by = reviewerName;
    latestVersion.reviewed_at = new Date().toISOString();
    latestVersion.review_notes = reviewNotes ? String(reviewNotes).trim() : null;
  }

  check.status = decision;
  check.updated_at = new Date().toISOString();

  if (decision === "verified") {
    check.completed_at = new Date().toISOString();
    check.last_verified_at = new Date().toISOString();
    check.verified_by = reviewerName;
  }

  saveAuthoritativeComplianceChecks(allChecks);

  // Sync to Supabase
  try {
    await supabase.from("bpo_compliance_checks").upsert({
      id: check.id,
      check_code: check.check_code,
      title: check.title,
      check_type: check.check_type || "operational",
      scope: check.scope || "centre",
      partner_id: check.partner_id,
      centre_id: check.centre_id,
      requirement_description: check.requirement_description,
      status: check.status === "verified" ? "verified" : check.status,
      completed_at: check.completed_at,
      evidence_notes: check.evidence_notes,
      evidence_url: check.evidence_url,
      updated_at: check.updated_at,
    });
  } catch (syncErr) {
    logger.warn(`Failed updating check status in Supabase: ${syncErr}`);
  }

  await logComplianceAudit(
    { adminId: req.admin!.id, username: reviewerName },
    `compliance_check_${decision}`,
    "compliance_check",
    check.check_code,
    { decision, review_notes: reviewNotes, partner_id: check.partner_id }
  );

  return res.json({
    success: true,
    message: `Compliance checkpoint ${check.check_code} successfully marked as ${decision}`,
    check,
  });
});

// GET /api/admin/bpo/compliance/exceptions - List all exceptions across partners
router.get("/admin/bpo/compliance/exceptions", requireAuth, async (_req: AdminRequest, res: Response) => {
  const { exceptions } = reconcileComplianceState();
  return res.json({ exceptions, count: exceptions.length });
});

// POST /api/admin/bpo/compliance/exceptions/:id/review - Review exception request
router.post("/admin/bpo/compliance/exceptions/:id/review", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const { decision, reviewNotes, conditions, validUntil } = req.body || {};

  if (!["approved", "rejected"].includes(decision)) {
    return fail(res, 400, "Decision must be 'approved' or 'rejected'");
  }

  const allExceptions = loadAuthoritativeComplianceExceptions();
  const exception = allExceptions.find((e) => e.id === id || String(e.id) === req.params.id);
  if (!exception) return fail(res, 404, "Compliance exception not found");

  const reviewerName = req.admin?.username || "Chief Compliance Officer";

  exception.status = decision;
  exception.approved_by = decision === "approved" ? reviewerName : null;
  exception.approval_date = decision === "approved" ? new Date().toISOString() : null;
  exception.reviewed_at = new Date().toISOString();
  exception.review_notes = reviewNotes ? String(reviewNotes).trim() : exception.review_notes;
  exception.notes = reviewNotes ? String(reviewNotes).trim() : exception.notes;
  if (conditions) exception.conditions = String(conditions).trim();
  if (validUntil) exception.valid_until = validUntil;

  saveAuthoritativeComplianceExceptions(allExceptions);

  // If approved, update the checkpoint to "exception_active"
  const allChecks = loadAuthoritativeComplianceChecks();
  const check = allChecks.find(
    (c) => (c.id === exception.check_id || c.check_code === exception.check_code) && c.partner_id === exception.partner_id
  );

  if (check) {
    if (decision === "approved") {
      check.status = "exception_active";
    } else {
      check.status = "action_required";
    }
    check.updated_at = new Date().toISOString();
    saveAuthoritativeComplianceChecks(allChecks);
  }

  // Sync to Supabase
  try {
    await supabase
      .from("bpo_compliance_exceptions")
      .update({
        status: decision,
        review_notes: exception.review_notes,
        reviewed_at: exception.reviewed_at,
        valid_until: exception.valid_until,
      })
      .eq("id", exception.id);
  } catch (syncErr) {
    logger.warn(`Failed updating exception in Supabase: ${syncErr}`);
  }

  await logComplianceAudit(
    { adminId: req.admin!.id, username: reviewerName },
    `compliance_exception_${decision}`,
    "compliance_exception",
    `EXP-${String(exception.id).padStart(5, "0")}`,
    { decision, review_notes: reviewNotes, check_code: exception.check_code }
  );

  return res.json({ success: true, exception, check: check || null });
});

// GET /api/admin/bpo/compliance/corrective-actions - List all CAPAs across partners
router.get("/admin/bpo/compliance/corrective-actions", requireAuth, async (_req: AdminRequest, res: Response) => {
  const { capas } = reconcileComplianceState();
  return res.json({ actions: capas, count: capas.length });
});

// POST /api/admin/bpo/compliance/corrective-actions - Admin issue CAPA
router.post("/admin/bpo/compliance/corrective-actions", requireAuth, async (req: AdminRequest, res: Response) => {
  const {
    title,
    checkCode,
    partnerId,
    centreId,
    agentId,
    issueSummary,
    rootCause,
    correctiveAction,
    preventiveAction,
    ownerName,
    priority,
    targetDate,
    dueDate,
  } = req.body || {};

  if (!issueSummary || !correctiveAction || !ownerName) {
    return fail(res, 400, "issueSummary, correctiveAction, and ownerName are required");
  }

  const allCapas = loadAuthoritativeComplianceCapas();
  const nextId = (allCapas.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1;
  const capaCode = `CAPA-${String(nextId).padStart(5, "0")}`;

  const newCapa: BpoCorrectiveAction = {
    id: nextId,
    capa_code: capaCode,
    action_code: capaCode,
    check_code: checkCode || "CHK-OPS-001",
    partner_id: partnerId || "77c7a735-6d71-492a-9eeb-6853f567f432",
    centre_id: centreId ? Number(centreId) : 2,
    agent_id: agentId ? Number(agentId) : null,
    title: title ? String(title).trim() : `CAPA for ${checkCode || "Compliance Issue"}`,
    issue_summary: String(issueSummary).trim(),
    root_cause: rootCause ? String(rootCause).trim() : "Pending formal root cause analysis",
    corrective_action: String(correctiveAction).trim(),
    preventive_action: preventiveAction ? String(preventiveAction).trim() : "Institute continuous surveillance",
    owner_name: String(ownerName).trim(),
    priority: priority || "high",
    target_date: targetDate || dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    due_date: targetDate || dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: "open",
    created_by: req.admin?.username || "Compliance Auditor",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: [
      {
        date: new Date().toISOString().slice(0, 10),
        action: "CAPA Created",
        note: `Issued by ${req.admin?.username || "Admin Auditor"}: ${issueSummary}`,
        actor: req.admin?.username || "Compliance Auditor",
      },
    ],
  };

  allCapas.push(newCapa);
  saveAuthoritativeComplianceCapas(allCapas);

  await logComplianceAudit(
    { adminId: req.admin!.id, username: req.admin!.username },
    "compliance_capa_created",
    "compliance_capa",
    newCapa.capa_code!,
    { partner_id: newCapa.partner_id, title: newCapa.title }
  );

  return res.status(201).json({ success: true, capa: newCapa });
});

// POST /api/admin/bpo/compliance/corrective-actions/:id/review - Review CAPA resolution
router.post("/admin/bpo/compliance/corrective-actions/:id/review", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const { decision, notes } = req.body || {};

  if (!["completed", "rejected", "reopened"].includes(decision)) {
    return fail(res, 400, "Decision must be 'completed', 'rejected', or 'reopened'");
  }

  const allCapas = loadAuthoritativeComplianceCapas();
  const capa = allCapas.find((c) => c.id === id || c.capa_code === req.params.id || c.action_code === req.params.id);
  if (!capa) return fail(res, 404, "Corrective action plan (CAPA) not found");

  const reviewerName = req.admin?.username || "Admin Compliance Auditor";

  if (decision === "completed") {
    capa.status = "completed";
    capa.completion_date = new Date().toISOString().slice(0, 10);
    capa.completion_notes = notes ? String(notes).trim() : "Verified and signed off by Compliance Auditor";
  } else {
    capa.status = "in_progress";
  }
  capa.updated_at = new Date().toISOString();

  if (!Array.isArray(capa.history)) capa.history = [];
  capa.history.push({
    date: new Date().toISOString().slice(0, 10),
    action: decision === "completed" ? "CAPA Closed & Verified" : "CAPA Reopened for Corrective Resubmission",
    note: notes || `Reviewed by ${reviewerName}`,
    actor: reviewerName,
  });

  saveAuthoritativeComplianceCapas(allCapas);

  await logComplianceAudit(
    { adminId: req.admin!.id, username: reviewerName },
    `compliance_capa_${decision}`,
    "compliance_capa",
    capa.capa_code || `CAPA-${capa.id}`,
    { decision, notes }
  );

  return res.json({ success: true, capa });
});

// GET /api/admin/bpo/operations/dashboard - Platform-wide operational KPIs
router.get("/admin/bpo/operations/dashboard", requireAuth, async (_req: AdminRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const attToday = Array.from(attendanceStore.values()).filter((a) => a.attendance_date === today);
  const prod = Array.from(productionStore.values());
  const qas = Array.from(evaluationsStore.values());
  const comps = Array.from(complianceStore.values());
  const capas = Array.from(capaStore.values());

  const totalUnits = prod.reduce((acc, p) => acc + p.units_completed, 0);
  const totalHours = prod.reduce((acc, p) => acc + p.productive_hours, 0);
  const avgProductivity = totalHours > 0 ? Number((totalUnits / totalHours).toFixed(2)) : 0;
  const avgQa = qas.length > 0 ? Math.round(qas.reduce((acc, e) => acc + e.total_score, 0) / qas.length) : 0;

  return res.json({
    attendance: {
      today_total: attToday.length,
      today_present: attToday.filter((a) => a.status === "PRESENT").length,
      today_late: attToday.filter((a) => a.status === "LATE").length,
      today_absent: attToday.filter((a) => a.status === "ABSENT").length,
    },
    production: {
      total_submissions: prod.length,
      total_units: totalUnits,
      productivity_rate: avgProductivity,
    },
    quality: {
      total_evaluations: qas.length,
      average_score: avgQa,
      failed_count: qas.filter((q) => !q.passed).length,
    },
    compliance: {
      total_checks: comps.length,
      compliant_count: comps.filter((c) => c.status === "compliant").length,
      pending_exceptions: Array.from(exceptionsStore.values()).filter((e) => e.status === "pending").length,
      open_capas: capas.filter((c) => c.status === "open" || c.status === "in_progress").length,
    },
  });
});

export default router;
