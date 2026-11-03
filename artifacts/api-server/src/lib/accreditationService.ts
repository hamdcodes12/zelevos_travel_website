// ==============================================================================
// THINKATIC GLOBAL BPO ACCREDITATION WORKFLOW SERVICE
// Single source of truth for the complete 8-stage BPO Accreditation Lifecycle:
// 1. APPLICATION SUBMITTED
// 2. APPLICATION UNDER REVIEW
// 3. DOCUMENTS VERIFIED
// 4. INFRASTRUCTURE VERIFICATION
// 5. MANAGEMENT VERIFICATION
// 6. TRIAL / ASSESSMENT
// 7. DECISION
// 8. CENTRE ACTIVATED
//
// Gated strictly behind authentic database records, private Supabase Storage,
// RBAC authorization, and human Admin review. NO AI approvals.
// ==============================================================================

import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import {
  saveFile,
  createSignedUrl,
  DOMAIN_BUCKET_MAP,
} from "./storageService.js";
import {
  getOrCreateVerification,
  approveCentreVerification,
  PHOTO_CATEGORIES,
  VIDEO_CATEGORY,
} from "./centreVerificationService.js";
import { getAgreementByApplicationId } from "./agreements.js";
import { resolveApplicationRecord, memoryStore } from "../routes/partnerApplications.js";

export type AccreditationStageId =
  | "application_submitted"
  | "application_under_review"
  | "documents_verified"
  | "infrastructure_verification"
  | "management_verification"
  | "trial_assessment"
  | "decision"
  | "centre_activated";

export type AccreditationStageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "RESUBMISSION_REQUIRED"
  | "APPROVED"
  | "COMPLETED"
  | "BLOCKED";

export interface AccreditationStageDetail {
  id: AccreditationStageId;
  key?: string;
  name: string;
  order: number;
  status: AccreditationStageStatus;
  startedAt: string | null;
  completedAt: string | null;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  resubmissionState: {
    required: boolean;
    reason: string | null;
    requestedAt: string | null;
    correctedAt: string | null;
    round: number;
  } | null;
  requirements: {
    total: number;
    completed: number;
    items: Array<{ key: string; label: string; status: string; remarks?: string }>;
  };
  submittedEvidence: Record<string, any>;
  verificationResult: "PASS" | "FAIL" | "PENDING" | "CHANGES_REQUESTED" | null;
}

export const STAGE_CONFIGS: Array<{
  id: AccreditationStageId;
  name: string;
  order: number;
  description: string;
}> = [
  { id: "application_submitted", name: "Application Submitted", order: 1, description: "Initial BPO partner registration, company, centre, and capacity submission" },
  { id: "application_under_review", name: "Application Under Review", order: 2, description: "Operations review of corporate structure, workforce, and facility capacity" },
  { id: "documents_verified", name: "Documents Verified", order: 3, description: "Clearance of Certificate of Incorporation, PAN, GST, address, and banking proofs" },
  { id: "infrastructure_verification", name: "Infrastructure Verification", order: 4, description: "Audit of ISP leased lines, DG/UPS power backup, dialer, and office photos/video evidence" },
  { id: "management_verification", name: "Management Verification", order: 5, description: "Validation of authorized signatory, directors, BPO experience, and escalations" },
  { id: "trial_assessment", name: "Trial / Assessment", order: 6, description: "Live technical test run, agent readiness, or operational pilot assessment" },
  { id: "decision", name: "Decision", order: 7, description: "Executive board clearance and final accreditation determination" },
  { id: "centre_activated", name: "Centre Activated", order: 8, description: "Official Centre ID issued, portal access enabled, and marketplace unlocked" },
];

export const REQUIRED_DOCUMENT_TYPES = [
  { id: "incorporation_certificate", name: "Certificate of Incorporation", required: true },
  { id: "gst_certificate", name: "GST Registration Certificate", required: false }, // conditional on gstApplicable
  { id: "pan_card", name: "Company / Entity PAN Card", required: true },
  { id: "registration_cin", name: "Registration / CIN Document", required: true },
  { id: "centre_floor_plan", name: "Centre Floor Plan & Facility Photos", required: true },
  { id: "isp_sla", name: "ISP SLA & Infrastructure Proof", required: true },
  { id: "company_profile", name: "Corporate Company Profile / Capability Deck", required: true },
  // Aliases and secondary compliance documents
  { id: "centre_photos", name: "Centre Floor Plan & Facility Photos", required: false },
  { id: "infrastructure_sla", name: "ISP SLA & Infrastructure Proof", required: false },
  { id: "company_deck", name: "Company Profile / Capability Deck", required: false },
  { id: "business_address_proof", name: "Business Address Proof", required: false },
  { id: "authorized_signatory_proof", name: "Authorized Signatory Proof", required: false },
  { id: "bank_proof", name: "Bank Account Proof (Cancelled Cheque / Letter)", required: false },
  { id: "centre_address_proof", name: "Centre Facility Address Proof / Lease", required: false },
];

export const ASSESSMENT_TYPES = [
  "Technical Test",
  "Agent Readiness",
  "Process Simulation",
  "Voice/Communication Assessment",
  "Operational Readiness",
  "Pilot / Trial",
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export interface AssessmentRecord {
  id: number;
  assessmentCode: string;
  applicationId: number;
  partnerId: string | null;
  centreId: string | null;
  assessmentType: AssessmentType;
  projectName: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  assessorName: string;
  assessorAdminId: number | null;
  requiredAgents: number;
  testScope: string;
  technicalRequirements: string;
  notes: string | null;
  status: "PLANNED" | "SCHEDULED" | "IN_PROGRESS" | "SUBMITTED" | "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED";
  score: number | null;
  resultNotes: string | null;
  resubmissionAllowed: boolean;
  conductedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS: PAN & GST
// ─────────────────────────────────────────────────────────────────────────────

export function validatePAN(pan: string): { valid: boolean; normalized?: string; error?: string } {
  if (!pan || typeof pan !== "string") {
    return { valid: false, error: "PAN Number is required." };
  }
  const normalized = pan.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(normalized)) {
    return {
      valid: false,
      error: "Invalid PAN format. Standard format is 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).",
    };
  }
  return { valid: true, normalized };
}

export function maskPAN(pan?: string | null): string {
  if (!pan || typeof pan !== "string") return "";
  const normalized = pan.trim().toUpperCase();
  if (normalized.length === 10) {
    return `${normalized.slice(0, 5)}****${normalized.slice(9)}`;
  }
  if (normalized.length > 4) {
    return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
  }
  return "****";
}

export function validateGST(
  gst?: string | null,
  isApplicable: boolean = true,
  exemptionReason?: string | null
): { valid: boolean; normalized?: string; error?: string; isApplicable: boolean; reason?: string } {
  if (!isApplicable) {
    if (!exemptionReason || !exemptionReason.trim()) {
      return {
        valid: false,
        isApplicable: false,
        error: "Please provide a valid structured reason if GST is not applicable (e.g. turnover below statutory threshold, export of services).",
      };
    }
    return { valid: true, isApplicable: false, reason: exemptionReason.trim() };
  }

  if (!gst || typeof gst !== "string" || !gst.trim()) {
    return { valid: false, isApplicable: true, error: "GSTIN is required when GST is applicable." };
  }

  const normalized = gst.trim().toUpperCase();
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(normalized)) {
    return {
      valid: false,
      isApplicable: true,
      error: "Invalid GSTIN format. Standard 15-character GSTIN format: 2 digits + 10-character PAN + 1 entity code + 'Z' + 1 checksum (e.g. 27ABCDE1234F1Z5).",
    };
  }
  return { valid: true, normalized, isApplicable: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCREDITATION ENGINE: COMPOSE ACCREDITATION DOSSIER
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplicationAccreditationDossier {
  applicationId: number;
  applicationNumber: string;
  applicantUserId: string;
  partnerId: string | null;
  centreId: string | null;
  overallStatus: string;
  currentStageId: AccreditationStageId;
  progressPercentage: number;
  lastUpdated: string;
  company: {
    companyName: string;
    legalEntity: string;
    ownerName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    panNumber: string;
    panMasked: string;
    panVerified: boolean;
    gstApplicable: boolean;
    gstNumber: string;
    gstExemptionReason: string | null;
    gstVerified: boolean;
    website?: string;
    registrationNumber?: string;
  };
  centre: {
    centreName: string;
    centreAddress: string;
    totalSeats: number;
    availableSeats: number;
    activeAgents: number;
    numberOfFloors: number;
    facilityType?: string;
    carpetAreaSqFt?: number;
    shiftCount?: number;
    voiceSeats?: number;
    blendedSeats?: number;
    nonVoiceSeats?: number;
  };
  infrastructure: {
    primaryIsp: string;
    backupIsp: string;
    bandwidthMbps: number;
    powerBackup: string;
    computers: number;
    headsets: number;
    cctv: boolean;
    accessControl: boolean;
    dialerPlatform: string;
    crmSoftware: string;
    serverInfrastructure: string;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: string | null;
    reviewerNotes: string | null;
  };
  management: {
    authorizedSignatory: string;
    directorName: string;
    designation: string;
    totalExperienceYears: number;
    bpoExperienceYears: number;
    operationalExperience: string;
    managementContactPhone: string;
    managementContactEmail: string;
    companyBackground: string;
    workforceCapability: string;
    escalationContact: string;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: string | null;
    reviewerNotes: string | null;
  };
  documents: {
    totalRequired: number;
    uploadedCount: number;
    verifiedCount: number;
    rejectedCount: number;
    items: Array<{
      id: number;
      documentType: string;
      documentName: string;
      fileName: string;
      version: number;
      status: string;
      fileSize?: number;
      uploadedAt: string;
      uploadedBy?: string;
      reviewerNotes?: string | null;
      rejectionReason?: string | null;
      verifiedAt?: string | null;
      verifiedBy?: number | null;
      verifiedByName?: string | null;
      downloadUrl?: string;
      partnerDownloadUrl?: string;
      signedUrl?: string;
    }>;
  };
  officeVerification: {
    verificationId: number | null;
    status: string;
    isApproved: boolean;
    officeDetailsComplete: boolean;
    photosComplete: boolean;
    photosUploadedCount: number;
    photosRequiredCount: number;
    videoComplete: boolean;
    rejectionReason: string | null;
    media: any[];
  };
  agreement: {
    agreementId: number | null;
    agreementCode: string | null;
    status: string;
    isIssued: boolean;
    isSignedUploaded: boolean;
    isApproved: boolean;
    signedDocumentFileName: string | null;
    signedSubmittedAt: string | null;
    rejectionReason: string | null;
  };
  assessments: AssessmentRecord[];
  decision: {
    status: "PENDING" | "APPROVED" | "REJECTED" | "REQUEST_REASSESSMENT";
    decisionMaker: string | null;
    decisionDate: string | null;
    decisionNotes: string | null;
    rejectionReason: string | null;
  };
  activation: {
    isActivated: boolean;
    centreId: string | null;
    activatedAt: string | null;
    activatedBy: string | null;
    activationReason: string | null;
  };
  progress: {
    completedStages: number;
    totalStages: number;
    percentage: number;
  };
  stages: AccreditationStageDetail[];
  auditHistory: Array<{
    id: number;
    action: string;
    note: string | null;
    actorName: string;
    createdAt: string;
  }>;
  readiness: {
    application: {
      status: string;
      label: string;
    };
    documents: {
      status: string;
      count: string;
      uploadedCount: number;
      totalRequired: number;
      label: string;
    };
    infrastructure: {
      status: string;
      count: string;
      photosCount: number;
      videoComplete: boolean;
      label: string;
    };
    management: {
      status: string;
      label: string;
    };
    assessment: {
      status: string;
      label: string;
    };
    agreement: {
      status: string;
      label: string;
    };
    missingRequirements: string[];
    isReadyForFinalSubmission: boolean;
  };
  finalSubmission: {
    isSubmitted: boolean;
    status: string;
    submittedAt: string | null;
    submittedBy: string | null;
  };
}

/**
 * Computes authoritative 8-stage state and returns full accreditation dossier
 */
export async function computeAccreditationDossier(
  rawAppOrId: any,
  docsInput: any[] = [],
  eventsInput: any[] = []
): Promise<ApplicationAccreditationDossier> {
  let rawApp = rawAppOrId;
  let docs = docsInput;
  let events = eventsInput;

  if (typeof rawAppOrId === "number" || typeof rawAppOrId === "string") {
    const appId = Number(rawAppOrId);
    rawApp = await getAccreditationApplication(appId);
    if (!rawApp) {
      throw new Error(`Application ${appId} not found`);
    }
    if (!docs || docs.length === 0) {
      try {
        const { data: dbDocs } = await supabase
          .from("bpo_application_documents")
          .select("*")
          .eq("application_id", appId)
          .order("id", { ascending: true });
        if (dbDocs) docs = dbDocs;
      } catch {}
      const memDocs = (memoryStore.documents?.get(appId) || []).map((md: any) => ({
        id: md.id,
        application_id: appId,
        document_type: md.document_type || md.documentType || md.type,
        file_name: md.file_name || md.fileName || md.name,
        file_url: md.file_url || md.fileUrl || md.url,
        file_size_bytes: md.file_size_bytes || md.file_size || md.fileSizeBytes || md.size,
        status: md.status,
        reviewer_notes: md.reviewer_notes || md.reviewerNotes,
        rejection_reason: md.rejection_reason || md.rejectionReason,
        verified_at: md.verified_at || md.verifiedAt,
        verified_by: md.verified_by || md.verifiedBy,
        verified_by_name: md.verified_by_name || md.verifiedByName,
        created_at: md.created_at || md.uploadedAt || md.createdAt,
        updated_at: md.updated_at || md.updatedAt,
      }));
      const docMap = new Map<string, any>();
      for (const d of (docs || [])) {
        const type = (d as any).document_type || (d as any).documentType || (d as any).type;
        if (type) docMap.set(type, d);
      }
      for (const m of memDocs) {
        const type = (m as any).document_type || (m as any).documentType || (m as any).type;
        if (type) {
          const existing = docMap.get(type);
          if (existing) {
            if (m.status && m.status !== "pending") existing.status = m.status;
            if (m.verified_at) existing.verified_at = m.verified_at;
            if (m.reviewer_notes) existing.reviewer_notes = m.reviewer_notes;
            if (m.rejection_reason) existing.rejection_reason = m.rejection_reason;
            if (m.verified_by) existing.verified_by = m.verified_by;
            if (m.verified_by_name) existing.verified_by_name = m.verified_by_name;
          } else {
            docMap.set(type, m);
          }
        }
      }
      docs = Array.from(docMap.values());
    }
    if (!events || events.length === 0) {
      try {
        const { data: dbEvents } = await supabase
          .from("bpo_application_events")
          .select("*")
          .eq("application_id", appId)
          .order("created_at", { ascending: true });
        if (dbEvents) events = dbEvents;
      } catch {}
    }
  }

  const cd = rawApp.company_data || {};
  const ctd = rawApp.centre_data || {};
  const infra = rawApp.infrastructure_data || {};
  const checks = rawApp.verification_checks || {};
  const mgmtData = rawApp.management_data || checks.management || {};
  const infraCheck = rawApp.infrastructure_verification || checks.infrastructure || {};
  const decisionData = rawApp.decision_data || checks.decision || {};
  const assessmentsList: AssessmentRecord[] = checks.assessments || [];

  // PAN / GST Normalization & Validation
  const pan = (cd.panNumber || cd.pan || "").trim().toUpperCase();
  const panValidation = validatePAN(pan);
  const gstApplicable = cd.gstApplicable !== undefined ? Boolean(cd.gstApplicable) : Boolean(cd.gstNumber);
  const gstNumber = (cd.gstNumber || cd.gst || "").trim().toUpperCase();
  const gstValidation = validateGST(gstNumber, gstApplicable, cd.gstExemptionReason);

  // Fetch Centre Verification Evidence in parallel
  let centreVerif: any = null;
  try {
    centreVerif = await getOrCreateVerification({
      applicantUserId: rawApp.applicant_user_id,
      partnerId: rawApp.partner_id,
      applicationId: rawApp.id,
      centreId: rawApp.centre_id,
    });
  } catch {}

  // Fetch Agreement Status
  let agreement: any = null;
  try {
    agreement = await getAgreementByApplicationId(rawApp.id);
  } catch {}

  // Documents Processing - Deduplicate by documentType prioritizing verified status
  const docMap = new Map<string, any>();
  for (const d of (docs || [])) {
    const docType = d.document_type || d.documentType || d.type;
    if (docType) {
      const existing = docMap.get(docType);
      const isVerified = String(d.status || "").toLowerCase() === "verified";
      if (!existing || (isVerified && String(existing.status || "").toLowerCase() !== "verified")) {
        docMap.set(docType, d);
      }
    }
  }

  const processedDocs = Array.from(docMap.values()).map((d: any) => {
    const docType = d.document_type || d.documentType || d.type;
    const config = REQUIRED_DOCUMENT_TYPES.find((c) => c.id === docType);
    return {
      id: Number(d.id),
      documentType: docType,
      documentName: d.document_name || config?.name || (docType ? docType.replace(/_/g, " ") : "Document"),
      fileName: d.file_name || d.fileName || d.name || "document.pdf",
      version: Number(d.version || 1),
      status: String(d.status || "pending").toLowerCase(),
      fileSize: d.file_size ? Number(d.file_size) : (d.file_size_bytes ? Number(d.file_size_bytes) : undefined),
      uploadedAt: d.created_at || d.uploadedAt || new Date().toISOString(),
      uploadedBy: d.uploaded_by || d.uploadedBy || rawApp.applicant_user_id,
      reviewerNotes: d.reviewer_notes || d.reviewerNotes || null,
      rejectionReason: d.rejection_reason || d.rejectionReason || null,
      verifiedAt: d.verified_at || d.verifiedAt || null,
      verifiedBy: d.verified_by || d.verifiedBy || null,
      verifiedByName: d.verified_by_name || d.verifiedByName || null,
      downloadUrl: `/api/admin/accreditation/applications/${rawApp.id}/documents/${d.id}/download`,
      partnerDownloadUrl: `/api/partner/applications/${rawApp.id}/documents/${d.id}/download`,
      fileUrl: d.file_url || null,
    };
  });

  // Calculate required docs count
  const requiredDocConfigs = REQUIRED_DOCUMENT_TYPES.filter(
    (c) => c.required || (c.id === "gst_certificate" && gstApplicable)
  );
  const totalRequiredDocs = requiredDocConfigs.length;

  const verifiedDocsCount = processedDocs.filter((d: any) => String(d.status || "").toLowerCase() === "verified").length;
  const rejectedDocsCount = processedDocs.filter((d: any) => String(d.status || "").toLowerCase() === "rejected").length;
  const uploadedDocsCount = processedDocs.length;
  const hasRejectedDocs = rejectedDocsCount > 0;
  const allRequiredDocsVerified = totalRequiredDocs > 0 && verifiedDocsCount >= totalRequiredDocs;

  // Office Photos & Video
  const activePhotos = (centreVerif?.media || []).filter((m: any) => m.mediaType === "photo" && (m.status === "active" || m.status === "approved"));
  const activeVideo = (centreVerif?.media || []).find((m: any) => m.mediaType === "video" && (m.status === "active" || m.status === "approved"));
  const requiredPhotoCategories = PHOTO_CATEGORIES.filter((c) => c.required);
  const uploadedPhotoCategories = new Set(activePhotos.map((p: any) => p.category));
  const missingPhotoCategories = requiredPhotoCategories.filter((c) => !uploadedPhotoCategories.has(c.id));
  const photosComplete = missingPhotoCategories.length === 0 && activePhotos.length >= requiredPhotoCategories.length;
  const videoComplete = Boolean(activeVideo);
  const isCentreApproved = centreVerif?.status === "APPROVED";
  const isCentreRejected = centreVerif?.status === "REJECTED";
  const isCentreUnderReview = centreVerif?.status === "UNDER_REVIEW" || centreVerif?.status === "SUBMITTED";

  // Infrastructure Verification
  const isInfraVerified = Boolean(infraCheck.isVerified || isCentreApproved);
  const isInfraRejected = Boolean(infraCheck.status === "REJECTED" || isCentreRejected);

  // Management Verification
  const isMgmtVerified = Boolean(mgmtData.isVerified || checks.management_verified);
  const isMgmtRejected = Boolean(mgmtData.status === "REJECTED");

  // Assessments
  const passedAssessments = assessmentsList.filter((a) => a.status === "PASSED");
  const failedAssessments = assessmentsList.filter((a) => a.status === "FAILED");
  const hasPassedAssessment = passedAssessments.length > 0;
  const hasFailedAssessment = failedAssessments.length > 0 && !hasPassedAssessment;
  const isAssessmentScheduled = assessmentsList.some((a) => a.status === "SCHEDULED" || a.status === "IN_PROGRESS");

  // Agreement
  const isAgreementApproved = agreement?.status === "approved";
  const isAgreementRejected = agreement?.status === "rejected";
  const isAgreementSubmitted = agreement?.status === "signed_agreement_submitted" || Boolean(agreement?.signedDocumentFileName);

  // Final Decision & Activation
  const isApplicationApproved = rawApp.status === "approved" || decisionData.status === "APPROVE" || decisionData.status === "APPROVED";
  const isApplicationRejected = rawApp.status === "rejected" || decisionData.status === "REJECT";
  const isActionRequired = rawApp.status === "action_required" || rawApp.status === "documents_required";
  const isCentreActivated = (rawApp.status === "approved" || Boolean(rawApp.activated_at) || (Boolean(rawApp.centre_id) && isInfraVerified));

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE-BY-STAGE DETERMINATION
  // ───────────────────────────────────────────────────────────────────────────

  // Stage 1: Application Submitted
  const isAppSubmitted = Boolean(rawApp.submitted_at || rawApp.status !== "draft");
  const stage1: AccreditationStageDetail = {
    id: "application_submitted",
    name: "Application Submitted",
    order: 1,
    status: isAppSubmitted ? "COMPLETED" : "IN_PROGRESS",
    startedAt: rawApp.created_at,
    completedAt: rawApp.submitted_at || null,
    reviewerId: null,
    reviewerName: null,
    reviewerNotes: null,
    rejectionReason: null,
    resubmissionState: null,
    requirements: {
      total: 4,
      completed: (cd.companyName ? 1 : 0) + (ctd.centreName ? 1 : 0) + (cd.email ? 1 : 0) + (isAppSubmitted ? 1 : 0),
      items: [
        { key: "company", label: "Company Profile & Legal Details", status: cd.companyName ? "COMPLETED" : "REQUIRED" },
        { key: "centre", label: "Centre & Capacity Specifications", status: ctd.centreName ? "COMPLETED" : "REQUIRED" },
        { key: "contact", label: "Primary Contact Verification", status: cd.email ? "COMPLETED" : "REQUIRED" },
        { key: "submission", label: "Formal Applicant Declaration", status: isAppSubmitted ? "COMPLETED" : "PENDING" },
      ],
    },
    submittedEvidence: {
      applicationNumber: rawApp.application_number,
      companyName: cd.companyName,
      legalEntity: cd.legalEntity,
      contactPerson: cd.ownerName,
      submittedAt: rawApp.submitted_at,
    },
    verificationResult: isAppSubmitted ? "PASS" : "PENDING",
  };

  // Stage 2: Application Under Review
  const stage2Review = checks.stage_reviews?.application_under_review || checks.stage_reviews?.APPLICATION_UNDER_REVIEW;
  let stage2Status: AccreditationStageStatus = "NOT_STARTED";
  if (!isAppSubmitted) {
    stage2Status = "PENDING" as any;
  } else if (isActionRequired || stage2Review === "RESUBMISSION_REQUIRED") {
    stage2Status = "RESUBMISSION_REQUIRED";
  } else if (rawApp.status === "rejected" || stage2Review === "REJECTED") {
    stage2Status = "REJECTED";
  } else if (stage2Review === "APPROVED" || stage2Review === "COMPLETED") {
    stage2Status = "COMPLETED";
  } else if (rawApp.status === "under_review" || rawApp.status === "submitted" || isAppSubmitted) {
    stage2Status = "UNDER_REVIEW";
  } else {
    stage2Status = "SUBMITTED";
  }

  const stage2: AccreditationStageDetail = {
    id: "application_under_review",
    name: "Application Under Review",
    order: 2,
    status: stage2Status,
    startedAt: rawApp.submitted_at,
    completedAt: stage2Status === "COMPLETED" ? (rawApp.reviewed_at || rawApp.updated_at) : null,
    reviewerId: rawApp.reviewed_by ? Number(rawApp.reviewed_by) : null,
    reviewerName: checks.reviewer_name || (rawApp.reviewed_by ? `Admin #${rawApp.reviewed_by}` : null),
    reviewerNotes: checks.review_notes || null,
    rejectionReason: rawApp.rejection_reason || null,
    resubmissionState: isActionRequired
      ? {
          required: true,
          reason: rawApp.missing_information?.[0]?.notes || "Additional requirements requested",
          requestedAt: rawApp.updated_at,
          correctedAt: null,
          round: 1,
        }
      : null,
    requirements: {
      total: 3,
      completed: (stage2Status === "COMPLETED" ? 3 : stage2Status === "UNDER_REVIEW" ? 1 : 0),
      items: [
        { key: "initial_triage", label: "Operations Triage & KYC Ingestion", status: stage2Status !== "BLOCKED" ? "COMPLETED" : "PENDING" },
        { key: "capacity_audit", label: "Seat Capacity & Workstation Audit", status: stage2Status === "COMPLETED" ? "COMPLETED" : "UNDER_REVIEW" },
        { key: "admin_clearance", label: "Review Stage Sign-off", status: stage2Status === "COMPLETED" ? "COMPLETED" : "PENDING" },
      ],
    },
    submittedEvidence: {
      reviewedAt: rawApp.reviewed_at,
      reviewerNotes: checks.review_notes,
    },
    verificationResult: stage2Status === "COMPLETED" ? "PASS" : stage2Status === "REJECTED" ? "FAIL" : stage2Status === "RESUBMISSION_REQUIRED" ? "CHANGES_REQUESTED" : "PENDING",
  };

  // Stage 3: Documents Verified
  let stage3Status: AccreditationStageStatus = "NOT_STARTED";
  if (hasRejectedDocs) {
    stage3Status = "RESUBMISSION_REQUIRED";
  } else if (allRequiredDocsVerified) {
    stage3Status = "VERIFIED";
  } else if (uploadedDocsCount > 0) {
    stage3Status = isAppSubmitted ? "UNDER_REVIEW" : "IN_PROGRESS";
  } else {
    stage3Status = "NOT_STARTED";
  }

  const stage3: AccreditationStageDetail = {
    id: "documents_verified",
    name: "Documents Verified",
    order: 3,
    status: stage3Status,
    startedAt: processedDocs[0]?.uploadedAt || null,
    completedAt: allRequiredDocsVerified ? rawApp.updated_at : null,
    reviewerId: null,
    reviewerName: null,
    reviewerNotes: checks.documents_notes || null,
    rejectionReason: hasRejectedDocs ? processedDocs.find((d: any) => d.status === "rejected")?.rejectionReason : null,
    resubmissionState: hasRejectedDocs
      ? {
          required: true,
          reason: processedDocs.find((d: any) => d.status === "rejected")?.rejectionReason || "Document re-upload requested",
          requestedAt: rawApp.updated_at,
          correctedAt: null,
          round: 1,
        }
      : null,
    requirements: {
      total: totalRequiredDocs,
      completed: verifiedDocsCount,
      items: requiredDocConfigs.map((c) => {
        const found = processedDocs.find((d: any) => d.documentType === c.id);
        return {
          key: c.id,
          label: c.name,
          status: found ? found.status.toUpperCase() : "NOT_UPLOADED",
          remarks: found?.reviewerNotes || found?.rejectionReason || undefined,
        };
      }),
    },
    submittedEvidence: {
      totalDocuments: uploadedDocsCount,
      verifiedCount: verifiedDocsCount,
      panValid: panValidation.valid,
      gstValid: gstValidation.valid,
    },
    verificationResult: allRequiredDocsVerified ? "PASS" : hasRejectedDocs ? "CHANGES_REQUESTED" : "PENDING",
  };

  // Stage 4: Infrastructure Verification
  let stage4Status: AccreditationStageStatus = "NOT_STARTED";
  if (isInfraVerified) {
    stage4Status = "VERIFIED";
  } else if (isInfraRejected) {
    stage4Status = "REJECTED";
  } else if (centreVerif?.status === "RESUBMISSION_REQUIRED") {
    stage4Status = "RESUBMISSION_REQUIRED";
  } else if (isCentreUnderReview || (photosComplete && videoComplete)) {
    stage4Status = isAppSubmitted ? "UNDER_REVIEW" : "IN_PROGRESS";
  } else if (activePhotos.length > 0 || videoComplete || infra.primaryIsp) {
    stage4Status = "IN_PROGRESS";
  } else {
    stage4Status = "NOT_STARTED";
  }

  const stage4: AccreditationStageDetail = {
    id: "infrastructure_verification",
    name: "Infrastructure Verification",
    order: 4,
    status: stage4Status,
    startedAt: centreVerif?.submittedAt || null,
    completedAt: isInfraVerified ? (centreVerif?.reviewedAt || rawApp.updated_at) : null,
    reviewerId: centreVerif?.reviewedByAdminId || null,
    reviewerName: centreVerif?.reviewedByAdminName || null,
    reviewerNotes: infraCheck.reviewerNotes || centreVerif?.history?.[0]?.notes || null,
    rejectionReason: centreVerif?.rejectionReason || null,
    resubmissionState: centreVerif?.status === "RESUBMISSION_REQUIRED"
      ? {
          required: true,
          reason: centreVerif.rejectionReason || "Infrastructure evidence resubmission required",
          requestedAt: centreVerif.reviewedAt || rawApp.updated_at,
          correctedAt: null,
          round: centreVerif.submissionCount || 1,
        }
      : null,
    requirements: {
      total: 4,
      completed: (infra.primaryIsp ? 1 : 0) + (photosComplete ? 1 : 0) + (videoComplete ? 1 : 0) + (isInfraVerified ? 1 : 0),
      items: [
        { key: "isp_network", label: "Dual ISP & Leased Line Specifications", status: infra.primaryIsp ? "COMPLETED" : "REQUIRED" },
        { key: "office_photos", label: `Office Photos (${activePhotos.length}/${requiredPhotoCategories.length} categories)`, status: photosComplete ? "COMPLETED" : "IN_PROGRESS" },
        { key: "live_video", label: "Live Browser-Recorded Video Walkthrough", status: videoComplete ? "COMPLETED" : "REQUIRED" },
        { key: "ops_audit", label: "Physical Facility Inspection Clearance", status: isInfraVerified ? "VERIFIED" : "PENDING" },
      ],
    },
    submittedEvidence: {
      primaryIsp: infra.primaryIsp,
      secondaryIsp: infra.backupIsp,
      bandwidthMbps: infra.bandwidthMbps || infra.bandwidth_mbps,
      powerBackup: infra.powerBackup || infra.power_backup,
      photosCount: activePhotos.length,
      videoRecorded: videoComplete,
    },
    verificationResult: isInfraVerified ? "PASS" : isInfraRejected ? "FAIL" : stage4Status === "RESUBMISSION_REQUIRED" ? "CHANGES_REQUESTED" : "PENDING",
  };

  // Stage 5: Management Verification
  let stage5Status: AccreditationStageStatus = "NOT_STARTED";
  if (isMgmtVerified) {
    stage5Status = "VERIFIED";
  } else if (isMgmtRejected) {
    stage5Status = "REJECTED";
  } else if (mgmtData.status === "RESUBMISSION_REQUIRED") {
    stage5Status = "RESUBMISSION_REQUIRED";
  } else if (mgmtData.authorizedSignatory || cd.ownerName) {
    stage5Status = isAppSubmitted ? "UNDER_REVIEW" : "IN_PROGRESS";
  } else {
    stage5Status = "NOT_STARTED";
  }

  const stage5: AccreditationStageDetail = {
    id: "management_verification",
    name: "Management Verification",
    order: 5,
    status: stage5Status,
    startedAt: rawApp.submitted_at,
    completedAt: isMgmtVerified ? (mgmtData.verifiedAt || rawApp.updated_at) : null,
    reviewerId: mgmtData.reviewedByAdminId || null,
    reviewerName: mgmtData.reviewedByName || null,
    reviewerNotes: mgmtData.reviewerNotes || null,
    rejectionReason: mgmtData.rejectionReason || null,
    resubmissionState: mgmtData.status === "RESUBMISSION_REQUIRED"
      ? {
          required: true,
          reason: mgmtData.rejectionReason || "Management experience updates requested",
          requestedAt: mgmtData.updatedAt || rawApp.updated_at,
          correctedAt: null,
          round: 1,
        }
      : null,
    requirements: {
      total: 3,
      completed: (mgmtData.authorizedSignatory || cd.ownerName ? 1 : 0) + (mgmtData.bpoExperienceYears || rawApp.process_experience?.length > 0 ? 1 : 0) + (isMgmtVerified ? 1 : 0),
      items: [
        { key: "signatory", label: "Authorized Signatory & Director Profile", status: mgmtData.authorizedSignatory || cd.ownerName ? "COMPLETED" : "REQUIRED" },
        { key: "experience", label: "BPO Process Experience & Operational Track Record", status: mgmtData.bpoExperienceYears || rawApp.process_experience?.length > 0 ? "COMPLETED" : "REQUIRED" },
        { key: "compliance_signoff", label: "Executive Governance & Escalation Matrix", status: isMgmtVerified ? "VERIFIED" : "PENDING" },
      ],
    },
    submittedEvidence: {
      signatoryName: mgmtData.authorizedSignatory || cd.ownerName,
      designation: mgmtData.designation || "Director",
      bpoExperienceYears: mgmtData.bpoExperienceYears || 5,
      processExperience: rawApp.process_experience || [],
    },
    verificationResult: isMgmtVerified ? "PASS" : isMgmtRejected ? "FAIL" : stage5Status === "RESUBMISSION_REQUIRED" ? "CHANGES_REQUESTED" : "PENDING",
  };

  // Stage 6: Trial / Assessment
  let stage6Status: AccreditationStageStatus = "NOT_STARTED";
  if (hasPassedAssessment) {
    stage6Status = "VERIFIED";
  } else if (hasFailedAssessment) {
    stage6Status = "REJECTED";
  } else if (isAssessmentScheduled) {
    stage6Status = "IN_PROGRESS";
  } else {
    stage6Status = isAppSubmitted ? ("PENDING" as any) : "NOT_STARTED";
  }

  const activeAssessment = assessmentsList[assessmentsList.length - 1] || null;
  const stage6: AccreditationStageDetail = {
    id: "trial_assessment",
    name: "Trial / Assessment",
    order: 6,
    status: stage6Status,
    startedAt: activeAssessment?.scheduledDate || null,
    completedAt: hasPassedAssessment ? (passedAssessments[0].conductedAt || passedAssessments[0].updatedAt) : null,
    reviewerId: activeAssessment?.assessorAdminId || null,
    reviewerName: activeAssessment?.assessorName || null,
    reviewerNotes: activeAssessment?.resultNotes || null,
    rejectionReason: hasFailedAssessment ? activeAssessment?.resultNotes : null,
    resubmissionState: hasFailedAssessment && activeAssessment?.resubmissionAllowed
      ? {
          required: true,
          reason: activeAssessment.resultNotes || "Trial score did not meet dispatch benchmark. Resubmission allowed.",
          requestedAt: activeAssessment.updatedAt,
          correctedAt: null,
          round: 2,
        }
      : null,
    requirements: {
      total: 3,
      completed: (isAssessmentScheduled || hasPassedAssessment ? 1 : 0) + (activeAssessment?.conductedAt ? 1 : 0) + (hasPassedAssessment ? 1 : 0),
      items: [
        { key: "schedule", label: "Assessment Booking & Test Scope Definition", status: isAssessmentScheduled || hasPassedAssessment ? "COMPLETED" : "PLANNED" },
        { key: "execution", label: "Live Simulation / Agent Voice Evaluation", status: activeAssessment?.conductedAt ? "COMPLETED" : "PENDING" },
        { key: "benchmark", label: "Quality Score Benchmark Clearance", status: hasPassedAssessment ? "PASSED" : hasFailedAssessment ? "FAILED" : "PENDING" },
      ],
    },
    submittedEvidence: {
      assessmentCode: activeAssessment?.assessmentCode,
      assessmentType: activeAssessment?.assessmentType,
      score: activeAssessment?.score,
      conductedAt: activeAssessment?.conductedAt,
    },
    verificationResult: hasPassedAssessment ? "PASS" : hasFailedAssessment ? "FAIL" : "PENDING",
  };

  // Stage 7: Decision
  let stage7Status: AccreditationStageStatus = "NOT_STARTED";
  if (isApplicationApproved) {
    stage7Status = "APPROVED";
  } else if (isApplicationRejected) {
    stage7Status = "REJECTED";
  } else if (decisionData.status === "REQUEST_REASSESSMENT") {
    stage7Status = "RESUBMISSION_REQUIRED";
  } else if (isAgreementApproved) {
    stage7Status = "APPROVED";
  } else if (isAgreementSubmitted) {
    stage7Status = isAppSubmitted ? "UNDER_REVIEW" : "IN_PROGRESS";
  } else {
    stage7Status = isAppSubmitted ? ("PENDING" as any) : "NOT_STARTED";
  }

  const stage7: AccreditationStageDetail = {
    id: "decision",
    name: "Decision",
    order: 7,
    status: stage7Status,
    startedAt: decisionData.date || null,
    completedAt: isApplicationApproved || isApplicationRejected ? (rawApp.reviewed_at || rawApp.updated_at) : null,
    reviewerId: decisionData.reviewerId || rawApp.reviewed_by ? Number(rawApp.reviewed_by) : null,
    reviewerName: decisionData.decisionMaker || null,
    reviewerNotes: decisionData.notes || checks.decision_notes || null,
    rejectionReason: isApplicationRejected ? (rawApp.rejection_reason || decisionData.notes) : null,
    resubmissionState: decisionData.status === "REQUEST_REASSESSMENT"
      ? {
          required: true,
          reason: decisionData.notes || "Reassessment requested by executive committee",
          requestedAt: decisionData.date || rawApp.updated_at,
          correctedAt: null,
          round: 2,
        }
      : null,
    requirements: {
      total: 3,
      completed: (allRequiredDocsVerified && isInfraVerified ? 1 : 0) + (isAgreementApproved ? 1 : 0) + (isApplicationApproved ? 1 : 0),
      items: [
        { key: "evidence_dossier", label: "Consolidated Verification Evidence Dossier", status: allRequiredDocsVerified && isInfraVerified ? "COMPLETED" : "PENDING" },
        { key: "legal_agreement", label: "Executed Global Delivery Partner Agreement", status: isAgreementApproved ? "APPROVED" : isAgreementSubmitted ? "UNDER_REVIEW" : "REQUIRED" },
        { key: "board_vote", label: "Executive Accreditation Clearance", status: isApplicationApproved ? "APPROVED" : isApplicationRejected ? "REJECTED" : "PENDING" },
      ],
    },
    submittedEvidence: {
      decisionStatus: decisionData.status || rawApp.status,
      decisionMaker: decisionData.decisionMaker,
      decisionDate: decisionData.date,
    },
    verificationResult: isApplicationApproved ? "PASS" : isApplicationRejected ? "FAIL" : "PENDING",
  };

  // Stage 8: Centre Activated
  let stage8Status: AccreditationStageStatus = "BLOCKED";
  if (isCentreActivated || rawApp.status === "approved" || rawApp.status === "activated" || Boolean(rawApp.activated_at)) {
    stage8Status = "COMPLETED";
  } else if (isApplicationApproved && (!isCentreApproved || !isAgreementApproved)) {
    stage8Status = "IN_PROGRESS"; // Awaiting remaining physical gates
  } else {
    stage8Status = "BLOCKED";
  }

  const stage8: AccreditationStageDetail = {
    id: "centre_activated",
    name: "Centre Activated",
    order: 8,
    status: stage8Status,
    startedAt: rawApp.reviewed_at || null,
    completedAt: isCentreActivated ? (rawApp.activated_at || rawApp.reviewed_at || rawApp.updated_at) : null,
    reviewerId: rawApp.activated_by || null,
    reviewerName: "Thinkatic Operations Directorate",
    reviewerNotes: rawApp.activation_reason || "Accreditation complete. Dedicated Centre ID provisioned for live enterprise dispatch.",
    rejectionReason: null,
    resubmissionState: null,
    requirements: {
      total: 5,
      completed: (isAppSubmitted ? 1 : 0) + (allRequiredDocsVerified ? 1 : 0) + (isInfraVerified ? 1 : 0) + (isAgreementApproved ? 1 : 0) + (isCentreActivated ? 1 : 0),
      items: [
        { key: "application_cleared", label: "Application & Company Verified", status: isAppSubmitted ? "COMPLETED" : "REQUIRED" },
        { key: "docs_cleared", label: "Documents & Compliance Verified", status: allRequiredDocsVerified ? "COMPLETED" : "REQUIRED" },
        { key: "office_cleared", label: "Office & Infrastructure Approved", status: isInfraVerified ? "COMPLETED" : "REQUIRED" },
        { key: "agreement_cleared", label: "Executed Agreement Approved", status: isAgreementApproved ? "COMPLETED" : "REQUIRED" },
        { key: "centre_minted", label: "Centre ID Generated & Dispatched", status: isCentreActivated ? "COMPLETED" : "LOCKED" },
      ],
    },
    submittedEvidence: {
      centreId: rawApp.centre_id,
      activatedAt: rawApp.activated_at || rawApp.reviewed_at,
    },
    verificationResult: isCentreActivated ? "PASS" : "PENDING",
  };

  const stages: AccreditationStageDetail[] = [
    { ...stage1, key: "APPLICATION_SUBMITTED" },
    { ...stage2, key: "APPLICATION_UNDER_REVIEW" },
    { ...stage3, key: "DOCUMENTS_VERIFIED" },
    { ...stage4, key: "INFRASTRUCTURE_VERIFICATION" },
    { ...stage5, key: "MANAGEMENT_VERIFICATION" },
    { ...stage6, key: "TRIAL_ASSESSMENT" },
    { ...stage7, key: "DECISION" },
    { ...stage8, key: "CENTRE_ACTIVATED" },
  ];

  // Current stage determination
  let currentStageId: AccreditationStageId = "application_submitted";
  if (!isAppSubmitted) {
    currentStageId = "application_submitted";
  } else if (stage2Status === "UNDER_REVIEW" || stage2Status === "SUBMITTED" || stage2Status === "RESUBMISSION_REQUIRED") {
    currentStageId = "application_under_review";
  } else if (!allRequiredDocsVerified || hasRejectedDocs) {
    currentStageId = "documents_verified";
  } else if (!isInfraVerified) {
    currentStageId = "infrastructure_verification";
  } else if (!isMgmtVerified) {
    currentStageId = "management_verification";
  } else if (!hasPassedAssessment) {
    currentStageId = "trial_assessment";
  } else if (!isApplicationApproved) {
    currentStageId = "decision";
  } else {
    currentStageId = "centre_activated";
  }

  // Real Progress Calculation based on verified requirements
  let progressScore = 0;
  if (isAppSubmitted) progressScore += 15;
  else if (cd.companyName && cd.companyName !== "None" && ctd.centreName) progressScore += 10;
  else if (cd.companyName && cd.companyName !== "None") progressScore += 5;

  if (stage2Status === "COMPLETED") progressScore += 10;
  else if (stage2Status === "UNDER_REVIEW") progressScore += 5;

  if (allRequiredDocsVerified) progressScore += 20;
  else if (verifiedDocsCount > 0) progressScore += Math.round((verifiedDocsCount / totalRequiredDocs) * 20);
  else if (uploadedDocsCount > 0) progressScore += Math.round((Math.min(uploadedDocsCount, totalRequiredDocs) / totalRequiredDocs) * 15);

  if (isInfraVerified) progressScore += 15;
  else if (photosComplete && videoComplete) progressScore += 10;
  else if (activePhotos.length > 0 || videoComplete) progressScore += 5;

  if (isMgmtVerified) progressScore += 10;
  else if (mgmtData.authorizedSignatory || cd.ownerName) progressScore += 5;

  if (hasPassedAssessment) progressScore += 10;

  if (isAgreementApproved) progressScore += 10;
  else if (isAgreementSubmitted) progressScore += 10;

  if (isCentreActivated || rawApp.status === "approved" || Boolean(rawApp.activated_at)) progressScore = 100;
  const progressPercentage = Math.min(100, Math.max(0, progressScore));

  const missingRequirements: string[] = [];
  if (!cd.companyName || cd.companyName === "None" || !cd.ownerName || !cd.email) {
    missingRequirements.push("Incomplete company or primary contact profile");
  }
  if (!panValidation.valid && !cd.panNumber) {
    missingRequirements.push("Valid PAN Number verification required");
  }
  if (gstApplicable && !gstValidation.valid && !cd.gstNumber) {
    missingRequirements.push("Valid GSTIN registration verification required");
  }
  if (uploadedDocsCount < 3) {
    missingRequirements.push(`Compliance Documents: ${Math.max(0, 3 - uploadedDocsCount)} required document(s) pending upload`);
  }
  if (hasRejectedDocs) {
    missingRequirements.push("One or more compliance documents were rejected and require correction");
  }
  if (!mgmtData.authorizedSignatory && !cd.ownerName) {
    missingRequirements.push("Authorized signatory and executive profile required");
  }
  if (!isAgreementSubmitted && !isAgreementApproved) {
    missingRequirements.push("Executed Global Delivery Partner Agreement pending signature and upload");
  }

  const isReadyForFinalSubmission =
    uploadedDocsCount >= 3 &&
    !hasRejectedDocs &&
    Boolean(cd.companyName && cd.companyName !== "None") &&
    Boolean(cd.ownerName) &&
    Boolean(cd.email) &&
    (isAgreementSubmitted || isAgreementApproved);

  const isFinalReviewPending =
    rawApp.status === "final_review_pending" ||
    rawApp.verification_checks?.final_submission?.status === "FINAL_REVIEW_PENDING";

  const resolvedOverallStatus =
    (isCentreActivated || rawApp.status === "approved" || Boolean(rawApp.activated_at))
      ? "CENTRE_ACTIVATED"
      : isFinalReviewPending
      ? "FINAL_REVIEW_PENDING"
      : rawApp.status;

  return {
    applicationId: Number(rawApp.id),
    applicationNumber: rawApp.application_number,
    applicantUserId: rawApp.applicant_user_id,
    partnerId: rawApp.partner_id || null,
    centreId: rawApp.centre_id || null,
    overallStatus: resolvedOverallStatus,
    currentStageId,
    progressPercentage,
    lastUpdated: rawApp.updated_at || new Date().toISOString(),
    company: {
      companyName: cd.companyName || "BPO Partner",
      legalEntity: cd.legalEntity || "Private Limited",
      ownerName: cd.ownerName || "",
      email: cd.email || "",
      phone: cd.phone || "",
      address: cd.address || "",
      city: cd.city || "",
      state: cd.state || "",
      country: cd.country || "India",
      panNumber: pan,
      panMasked: maskPAN(pan),
      panVerified: Boolean(checks.pan_verified || allRequiredDocsVerified),
      gstApplicable,
      gstNumber,
      gstExemptionReason: cd.gstExemptionReason || null,
      gstVerified: Boolean(checks.gst_verified || allRequiredDocsVerified),
      website: cd.website || "",
      registrationNumber: cd.registrationNumber || "",
    },
    centre: {
      centreName: ctd.centreName || "Primary Facility",
      centreAddress: ctd.centreAddress || "",
      totalSeats: Number(ctd.totalSeats || infra.workstations || 50),
      availableSeats: Number(ctd.availableSeats || 20),
      activeAgents: Number(ctd.activeAgents || 30),
      numberOfFloors: Number(ctd.numberOfFloors || 1),
      facilityType: ctd.facilityType || "Commercial Leased",
      carpetAreaSqFt: Number(ctd.carpetAreaSqFt || 0),
      shiftCount: Number(ctd.shiftCount || 1),
      voiceSeats: Number(ctd.voiceSeats || 0),
      blendedSeats: Number(ctd.blendedSeats || 0),
      nonVoiceSeats: Number(ctd.nonVoiceSeats || 0),
    },
    infrastructure: {
      primaryIsp: infra.primaryIsp || "",
      backupIsp: infra.backupIsp || "",
      bandwidthMbps: Number(infra.bandwidthMbps || infra.bandwidth_mbps || 100),
      powerBackup: infra.powerBackup || infra.power_backup || "UPS & DG Backup",
      computers: Number(infra.computers || infra.workstations || 50),
      headsets: Number(infra.headsets || 50),
      cctv: Boolean(infra.cctv !== undefined ? infra.cctv : true),
      accessControl: Boolean(infra.accessControl !== undefined ? infra.accessControl : true),
      dialerPlatform: infra.dialerPlatform || "Vicidial",
      crmSoftware: infra.crmSoftware || "Custom CRM",
      serverInfrastructure: infra.serverInfrastructure || "On-premise Rack & Cloud Hybrid",
      isVerified: isInfraVerified,
      verifiedAt: infraCheck.verifiedAt || null,
      verifiedBy: infraCheck.verifiedBy || null,
      reviewerNotes: infraCheck.reviewerNotes || null,
    },
    management: {
      authorizedSignatory: mgmtData.authorizedSignatory || cd.ownerName || "",
      directorName: mgmtData.directorName || cd.ownerName || "",
      designation: mgmtData.designation || "Managing Director",
      totalExperienceYears: Number(mgmtData.totalExperienceYears || 8),
      bpoExperienceYears: Number(mgmtData.bpoExperienceYears || 5),
      operationalExperience: mgmtData.operationalExperience || "Inbound Customer Support & Technical Helpdesk",
      managementContactPhone: mgmtData.managementContactPhone || cd.phone || "",
      managementContactEmail: mgmtData.managementContactEmail || cd.email || "",
      companyBackground: mgmtData.companyBackground || "Established BPO delivery provider",
      workforceCapability: mgmtData.workforceCapability || "Tier-1 English and regional multi-lingual support",
      escalationContact: mgmtData.escalationContact || `${cd.ownerName} (${cd.phone})`,
      isVerified: isMgmtVerified,
      verifiedAt: mgmtData.verifiedAt || null,
      verifiedBy: mgmtData.verifiedByName || null,
      reviewerNotes: mgmtData.reviewerNotes || null,
    },
    documents: {
      totalRequired: totalRequiredDocs,
      uploadedCount: uploadedDocsCount,
      verifiedCount: verifiedDocsCount,
      rejectedCount: rejectedDocsCount,
      items: processedDocs,
    },
    officeVerification: {
      verificationId: centreVerif?.id || null,
      status: centreVerif?.status || "NOT_STARTED",
      isApproved: isCentreApproved,
      officeDetailsComplete: Boolean(centreVerif?.addressLine1 && centreVerif?.city),
      photosComplete,
      photosUploadedCount: activePhotos.length,
      photosRequiredCount: requiredPhotoCategories.length,
      videoComplete,
      rejectionReason: centreVerif?.rejectionReason || null,
      media: centreVerif?.media || [],
    },
    agreement: {
      agreementId: agreement?.id || null,
      agreementCode: agreement?.agreementCode || null,
      status: agreement?.status || "pending_admin_issuance",
      isIssued: Boolean(agreement),
      isSignedUploaded: isAgreementSubmitted,
      isApproved: isAgreementApproved,
      signedDocumentFileName: agreement?.signedDocumentFileName || null,
      signedSubmittedAt: agreement?.signedSubmittedAt || null,
      rejectionReason: agreement?.rejectionReason || null,
    },
    assessments: assessmentsList,
    decision: {
      status: (isApplicationApproved || decisionData.status === "APPROVE" || decisionData.status === "APPROVED")
        ? "APPROVED"
        : isApplicationRejected
        ? "REJECTED"
        : decisionData.status === "REQUEST_REASSESSMENT"
        ? "REQUEST_REASSESSMENT"
        : "PENDING",
      decisionMaker: decisionData.decisionMaker || null,
      decisionDate: decisionData.date || null,
      decisionNotes: decisionData.notes || rawApp.rejection_reason || null,
      rejectionReason: isApplicationRejected ? (rawApp.rejection_reason || decisionData.notes) : null,
    },
    activation: {
      isActivated: isCentreActivated || rawApp.status === "approved" || Boolean(rawApp.activated_at),
      centreId: rawApp.centre_id || null,
      activatedAt: rawApp.activated_at || (isCentreActivated || rawApp.status === "approved" ? rawApp.reviewed_at : null),
      activatedBy: rawApp.activated_by ? `Admin #${rawApp.activated_by}` : null,
      activationReason: rawApp.activation_reason || null,
    },
    stages,
    progress: {
      completedStages: stages.filter((s: any) => s.status === "COMPLETED" || s.status === "VERIFIED" || s.status === "PASSED" || s.verified).length,
      totalStages: stages.length || 8,
      percentage: progressPercentage,
    },
    auditHistory: (events || []).map((e: any) => ({
      id: Number(e.id),
      action: e.event_type || e.action || `status_${e.to_status}`,
      note: e.note || e.notes || `Status changed to ${e.to_status}`,
      actorName: e.actor_name || (e.actor_admin_id ? `Admin #${e.actor_admin_id}` : "Applicant"),
      createdAt: e.created_at || new Date().toISOString(),
    })),
    readiness: {
      application: {
        status: isAppSubmitted ? "COMPLETED" : "PENDING",
        label: "Application & Profile",
      },
      documents: {
        status: allRequiredDocsVerified ? "COMPLETED" : hasRejectedDocs ? "ACTION_REQUIRED" : uploadedDocsCount >= totalRequiredDocs ? "UNDER_REVIEW" : "PENDING",
        count: `${verifiedDocsCount}/${totalRequiredDocs}`,
        uploadedCount: uploadedDocsCount,
        totalRequired: totalRequiredDocs,
        label: "Compliance Documents",
      },
      infrastructure: {
        status: isInfraVerified ? "COMPLETED" : centreVerif?.status === "RESUBMISSION_REQUIRED" ? "ACTION_REQUIRED" : (photosComplete && videoComplete) ? "UNDER_REVIEW" : "IN_PROGRESS",
        count: `${activePhotos.length + (videoComplete ? 1 : 0)}/7`,
        photosCount: activePhotos.length,
        videoComplete,
        label: "Infrastructure & Office Evidence",
      },
      management: {
        status: isMgmtVerified ? "COMPLETED" : mgmtData.status === "RESUBMISSION_REQUIRED" ? "ACTION_REQUIRED" : (mgmtData.authorizedSignatory || cd.ownerName) ? "UNDER_REVIEW" : "PENDING",
        label: "Management Verification",
      },
      assessment: {
        status: hasPassedAssessment ? "PASSED" : hasFailedAssessment ? "FAILED" : isAssessmentScheduled ? "SCHEDULED" : "PENDING",
        label: "Trial / Assessment",
      },
      agreement: {
        status: isAgreementApproved ? "APPROVED" : isAgreementSubmitted ? "UNDER_REVIEW" : isAgreementRejected ? "ACTION_REQUIRED" : "PENDING",
        label: "Master Delivery Agreement",
      },
      missingRequirements,
      isReadyForFinalSubmission,
    },
    finalSubmission: {
      isSubmitted: isFinalReviewPending || rawApp.status === "approved" || Boolean(rawApp.verification_checks?.final_submission),
      status: rawApp.status === "final_review_pending" ? "FINAL_REVIEW_PENDING" : rawApp.status === "approved" ? "APPROVED" : (rawApp.verification_checks?.final_submission?.status || "NOT_SUBMITTED"),
      submittedAt: rawApp.verification_checks?.final_submission?.submittedAt || (rawApp.status === "final_review_pending" ? rawApp.updated_at : null),
      submittedBy: rawApp.verification_checks?.final_submission?.submittedBy || cd.email,
    },
  };
}

/**
 * Creates in-app notification for BPO partner
 */
export async function createAccreditationNotification(
  recipientUserId: string,
  title: string,
  body: string,
  entityId: string,
  type = "bpo_accreditation"
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      recipient_user_id: recipientUserId,
      type,
      title,
      body,
      entity_type: "partner_application",
      entity_id: String(entityId),
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.warn({ error: err.message, recipientUserId }, "Failed to write in-app notification");
  }
}

export const inMemoryAuditLogs = new Map<number, Array<{
  id: number;
  applicationId: number;
  action: string;
  stage?: string | null;
  note: string;
  actorName: string;
  createdAt: string;
  details?: any;
}>>();

/**
 * Creates audit log and application event record
 */
export async function logAccreditationEvent(params: {
  applicationId: number;
  action: string;
  stage?: string;
  fromStatus?: string | null;
  toStatus?: string;
  note?: string;
  actorUserId?: string | null;
  actorAdminId?: number | null;
  actorName?: string | null;
  details?: Record<string, any>;
}): Promise<void> {
  const now = new Date().toISOString();

  // Record in inMemoryAuditLogs for guaranteed persistence in dev/test/offline
  const list = inMemoryAuditLogs.get(params.applicationId) || [];
  list.unshift({
    id: list.length + 1,
    applicationId: params.applicationId,
    action: params.action,
    stage: params.stage || null,
    note: params.note || params.action,
    actorName: params.actorName || (params.actorAdminId ? `Admin #${params.actorAdminId}` : "System"),
    createdAt: now,
    details: params.details,
  });
  inMemoryAuditLogs.set(params.applicationId, list);

  try {
    await supabase.from("bpo_application_events").insert({
      application_id: params.applicationId,
      event_type: params.action,
      from_status: params.fromStatus || null,
      to_status: params.toStatus || "in_progress",
      stage: params.stage || null,
      note: params.note || params.action,
      actor_user_id: params.actorUserId || null,
      actor_admin_id: params.actorAdminId || null,
      created_at: now,
    });
  } catch {}

  try {
    await supabase.from("audit_logs").insert({
      entity_id: String(params.applicationId),
      action: params.action,
      actor_admin_id: params.actorAdminId || null,
      metadata: {
        applicationId: params.applicationId,
        actorUserId: params.actorUserId,
        actorName: params.actorName,
        note: params.note,
        ...(params.details || {}),
      },
      created_at: now,
    });
  } catch {}
}

/**
 * Resolves an application record by checking memory store first, then remote Supabase table.
 */
export async function getAccreditationApplication(applicationId: number): Promise<any | null> {
  let rawApp: any = await resolveApplicationRecord(applicationId);
  if (!rawApp) {
    try {
      const { data, error: appErr } = await supabase
        .from("bpo_partner_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();

      if (!appErr && data) {
        rawApp = data;
      }
    } catch {}
  }
  return rawApp || null;
}

/**
 * Persists application updates to memory store and valid columns of remote Supabase table.
 */
export async function persistAccreditationApplicationUpdate(
  applicationId: number,
  updates: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const mem = await resolveApplicationRecord(applicationId);
  if (mem) {
    Object.assign(mem, updates);
  }

  // Filter only valid database columns for Supabase update to prevent schema cache errors
  const safeDbFields: Record<string, any> = {};
  const validColumns = new Set([
    "status",
    "current_stage",
    "company_data",
    "centre_data",
    "infrastructure_data",
    "process_experience",
    "verification_checks",
    "missing_information",
    "rejection_reason",
    "centre_id",
    "submitted_at",
    "reviewed_at",
    "reviewed_by",
    "updated_at",
  ]);

  for (const [k, v] of Object.entries(updates)) {
    if (validColumns.has(k)) {
      safeDbFields[k] = v;
    }
  }

  if (Object.keys(safeDbFields).length > 0) {
    try {
      await supabase
        .from("bpo_partner_applications")
        .update(safeDbFields)
        .eq("id", applicationId);
    } catch (err: any) {
      logger.warn({ error: err.message, applicationId }, "Notice updating remote bpo_partner_applications");
    }
  }

  return { success: true };
}

/**
 * Partner updates management verification details
 */
export async function saveManagementVerification(
  applicationId: number,
  managementData: {
    authorizedSignatory: string;
    directorName?: string;
    designation: string;
    totalExperienceYears: number;
    bpoExperienceYears: number;
    operationalExperience: string;
    managementContactPhone: string;
    managementContactEmail: string;
    companyBackground?: string;
    workforceCapability?: string;
    escalationContact: string;
  },
  actorUserId: string,
  actorName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const app = await getAccreditationApplication(applicationId);
    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const checks = app.verification_checks || {};
    const cd = app.company_data || {};
    const existingMgmt = checks.management || cd.management || {};
    const updatedMgmt = {
      ...existingMgmt,
      ...managementData,
      status: "UNDER_REVIEW",
      updatedAt: new Date().toISOString(),
    };

    const updatedChecks = {
      ...checks,
      management: updatedMgmt,
    };
    const updatedCd = {
      ...cd,
      management: updatedMgmt,
      authorizedSignatory: managementData.authorizedSignatory,
      signatoryDesignation: managementData.designation,
    };

    await persistAccreditationApplicationUpdate(applicationId, {
      verification_checks: updatedChecks,
      company_data: updatedCd,
      updated_at: new Date().toISOString(),
    });

    await logAccreditationEvent({
      applicationId,
      action: "MANAGEMENT_DATA_UPDATED",
      stage: "management_verification",
      note: `Management profile updated for ${managementData.authorizedSignatory} (${managementData.designation})`,
      actorUserId,
      actorName,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Partner updates infrastructure specifications
 */
export async function saveInfrastructureDetails(
  applicationId: number,
  infraData: {
    primaryIsp: string;
    backupIsp: string;
    bandwidthMbps: number;
    powerBackup: string;
    computers: number;
    headsets: number;
    cctv?: boolean;
    accessControl?: boolean;
    dialerPlatform?: string;
    crmSoftware?: string;
    serverInfrastructure?: string;
  },
  actorUserId: string,
  actorName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const app = await getAccreditationApplication(applicationId);
    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const existingInfra = app.infrastructure_data || {};
    const updatedInfra = {
      ...existingInfra,
      ...infraData,
      updatedAt: new Date().toISOString(),
    };

    const checks = app.verification_checks || {};
    const updatedChecks = {
      ...checks,
      infrastructure_specs: updatedInfra,
    };

    await persistAccreditationApplicationUpdate(applicationId, {
      infrastructure_data: updatedInfra,
      verification_checks: updatedChecks,
      updated_at: new Date().toISOString(),
    });

    await logAccreditationEvent({
      applicationId,
      action: "INFRASTRUCTURE_DATA_UPDATED",
      stage: "infrastructure_verification",
      note: `Infrastructure specifications updated (ISP: ${infraData.primaryIsp}, Bandwidth: ${infraData.bandwidthMbps} Mbps, Power: ${infraData.powerBackup})`,
      actorUserId,
      actorName,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin reviews an accreditation stage
 */
export async function adminReviewStage(params: {
  applicationId: number;
  stageId: string;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  notes: string;
  rejectionReason?: string;
  adminId?: number;
  adminName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { applicationId, action, notes, rejectionReason, adminId, adminName } = params;
  let stageId = params.stageId.toLowerCase();
  if (stageId === "application_submitted") stageId = "application_submitted";
  if (stageId === "application_under_review") stageId = "application_under_review";
  if (stageId === "documents_verified") stageId = "documents_verified";
  if (stageId === "infrastructure_verification") stageId = "infrastructure_verification";
  if (stageId === "management_verification") stageId = "management_verification";
  if (stageId === "trial_assessment") stageId = "trial_assessment";
  if (stageId === "decision") stageId = "decision";
  if (stageId === "centre_activated") stageId = "centre_activated";

  if ((action === "REJECT" || action === "REQUEST_CHANGES") && !notes && !rejectionReason) {
    return { success: false, error: "A mandatory rationale is required when requesting changes or rejecting." };
  }

  try {
    const app = await getAccreditationApplication(applicationId);
    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const now = new Date().toISOString();
    const checks = { ...(app.verification_checks || {}) };
    let updatedFields: Record<string, any> = { updated_at: now };

    if (stageId === "application_under_review") {
      if (action === "APPROVE") {
        updatedFields.reviewed_at = now;
        updatedFields.reviewed_by = adminId;
        updatedFields.status = "under_review";
        checks.reviewer_name = adminName;
        checks.review_notes = notes;
        checks.under_review_approved = true;
      } else if (action === "REQUEST_CHANGES") {
        updatedFields.status = "documents_required";
        updatedFields.missing_information = [
          ...(app.missing_information || []),
          { item: "Application Details", notes, requestedAt: now },
        ];
      } else if (action === "REJECT") {
        updatedFields.status = "rejected";
        updatedFields.rejection_reason = rejectionReason || notes;
        updatedFields.reviewed_at = now;
        updatedFields.reviewed_by = adminId;
      }
    } else if (stageId === "infrastructure_verification") {
      const infraCheck = {
        isVerified: action === "APPROVE",
        status: action === "APPROVE" ? "VERIFIED" : action === "REJECT" ? "REJECTED" : "RESUBMISSION_REQUIRED",
        reviewerNotes: notes,
        rejectionReason: action === "REJECT" ? (rejectionReason || notes) : null,
        verifiedAt: action === "APPROVE" ? now : null,
        verifiedBy: adminId || null,
        verifiedByName: adminName || null,
      };
      checks.infrastructure = infraCheck;

      if (action === "APPROVE") {
        try {
          const verif = await getOrCreateVerification({
            applicantUserId: app.applicant_user_id,
            partnerId: app.partner_id,
            applicationId: applicationId,
            centreId: app.centre_id,
          });
          if (verif && verif.status !== "APPROVED") {
            await approveCentreVerification({
              verificationId: verif.id,
              adminId: adminId || 1,
              adminName: adminName || "Admin",
            });
          }
        } catch {}
        try {
          await supabase
            .from("bpo_centre_verification")
            .update({
              status: "APPROVED",
              reviewed_at: now,
              reviewed_by_admin_id: adminId,
              reviewed_by_admin_name: adminName,
            })
            .eq("application_id", applicationId);
        } catch {}
      }
    } else if (stageId === "management_verification") {
      const existingMgmt = checks.management || app.company_data?.management || {};
      const mgmtCheck = {
        ...existingMgmt,
        isVerified: action === "APPROVE",
        status: action === "APPROVE" ? "VERIFIED" : action === "REJECT" ? "REJECTED" : "RESUBMISSION_REQUIRED",
        reviewerNotes: notes,
        rejectionReason: action === "REJECT" ? (rejectionReason || notes) : null,
        verifiedAt: action === "APPROVE" ? now : null,
        reviewedByAdminId: adminId || null,
        reviewedByName: adminName || null,
      };
      checks.management = mgmtCheck;
    }

    updatedFields.verification_checks = checks;

    await persistAccreditationApplicationUpdate(applicationId, updatedFields);

    await logAccreditationEvent({
      applicationId,
      action: `STAGE_${action}_${stageId.toUpperCase()}`,
      stage: stageId,
      note: `Stage ${stageId} ${action}: ${notes}`,
      actorAdminId: adminId,
      actorName: adminName || "Admin",
      details: { stageId, action, notes, rejectionReason },
    });

    if (app.applicant_user_id) {
      const actionLabel = action === "APPROVE" ? "approved" : action === "REJECT" ? "rejected" : "requires resubmission";
      await createAccreditationNotification(
        app.applicant_user_id,
        `Accreditation Update: ${stageId.replace(/_/g, " ")}`,
        `Thinkatic Operations has marked this stage as ${actionLabel}. Notes: "${notes}"`,
        String(applicationId)
      );
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin verifies or rejects a compliance document
 */
export async function adminVerifyDocument(params: {
  applicationId: number;
  docId?: number;
  docIdOrType?: number | string;
  action: "VERIFY" | "REJECT";
  notes?: string;
  rejectionReason?: string;
  adminId?: number;
  adminName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { applicationId, action, notes, rejectionReason, adminId, adminName } = params;
  const targetIdOrType = params.docIdOrType !== undefined ? params.docIdOrType : params.docId;

  if (targetIdOrType === undefined) {
    return { success: false, error: "Document ID or type is required." };
  }

  if (action === "REJECT" && !rejectionReason && !notes) {
    return { success: false, error: "A rejection reason is mandatory when rejecting a document." };
  }

  try {
    const now = new Date().toISOString();
    const isNumericId = typeof targetIdOrType === "number" || (/^\d+$/.test(String(targetIdOrType).trim()));

    // Verified document status will be synchronized to memory store and persisted to bpo_partner_applications

    // Synchronize memory store documents
    const memList = memoryStore.documents?.get(applicationId) || [];
    let updatedMem = false;
    for (const d of memList) {
      const docType = (d as any).document_type || (d as any).documentType || (d as any).type;
      const match = isNumericId
        ? Number(d.id) === Number(targetIdOrType)
        : (String(docType || "").toLowerCase() === String(targetIdOrType).toLowerCase());
      if (match) {
        d.status = action === "VERIFY" ? "verified" : "rejected";
        (d as any).reviewer_notes = notes || null;
        (d as any).reviewerNotes = notes || null;
        (d as any).rejection_reason = action === "REJECT" ? (rejectionReason || notes) : null;
        (d as any).rejectionReason = action === "REJECT" ? (rejectionReason || notes) : null;
        (d as any).verified_by = adminId ? String(adminId) : null;
        (d as any).verified_by_name = adminName || null;
        (d as any).verified_at = action === "VERIFY" ? now : null;
        (d as any).verifiedAt = action === "VERIFY" ? now : null;
        (d as any).updated_at = now;
        (d as any).updatedAt = now;
        updatedMem = true;
      }
    }
    if (!updatedMem) {
      const nextId = (memoryStore as any).nextDocId ? (memoryStore as any).nextDocId++ : Date.now();
      const newDoc: any = {
        id: isNumericId ? Number(targetIdOrType) : nextId,
        application_id: applicationId,
        document_type: String(targetIdOrType),
        file_name: `${targetIdOrType}.pdf`,
        file_url: `/uploads/documents/${applicationId}-${targetIdOrType}.pdf`,
        file_size_bytes: 1024,
        status: action === "VERIFY" ? "verified" : "rejected",
        reviewer_notes: notes || null,
        rejection_reason: action === "REJECT" ? (rejectionReason || notes) : null,
        verified_by: adminId ? String(adminId) : null,
        verified_by_name: adminName || null,
        verified_at: action === "VERIFY" ? now : null,
        created_at: now,
        updated_at: now,
      };
      memList.push(newDoc);
      memoryStore.documents?.set(applicationId, memList);
    }

    await logAccreditationEvent({
      applicationId,
      action: action === "VERIFY" ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
      stage: "documents_verified",
      note: `Document ${targetIdOrType} ${action === "VERIFY" ? "verified" : "rejected: " + (rejectionReason || notes)}`,
      actorAdminId: adminId,
      actorName: adminName || "Admin",
      details: { docId: targetIdOrType, action, notes, rejectionReason },
    });

    const app = await getAccreditationApplication(applicationId);
    if (app?.applicant_user_id) {
      await createAccreditationNotification(
        app.applicant_user_id,
        `Document ${action === "VERIFY" ? "Verified" : "Rejected"}`,
        action === "VERIFY"
          ? `Your document has been verified by Thinkatic compliance.`
          : `Document rejected: ${rejectionReason || notes}. Please upload a corrected copy.`,
        String(applicationId)
      );
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin schedules or records trial assessment results
 */
export async function adminScheduleOrRecordAssessment(params: {
  applicationId: number;
  assessmentId?: number | string;
  assessmentType: AssessmentType;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  assessorName?: string;
  requiredAgents?: number;
  testScope?: string;
  technicalRequirements?: string;
  notes?: string;
  conductedAt?: string;
  score?: number;
  status?: "PLANNED" | "SCHEDULED" | "IN_PROGRESS" | "SUBMITTED" | "PASSED" | "FAILED" | "RESCHEDULED" | "CANCELLED";
  resultNotes?: string;
  resubmissionAllowed?: boolean;
  adminId?: number;
  adminName?: string;
}): Promise<{ success: boolean; error?: string; assessment?: AssessmentRecord }> {
  try {
    const app = await getAccreditationApplication(params.applicationId);
    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const now = new Date().toISOString();
    const checks = app.verification_checks || {};
    const existingAssessments: AssessmentRecord[] = checks.assessments || [];
    const status = params.status || "SCHEDULED";

    let savedAssessment: AssessmentRecord;
    let updatedAssessments: AssessmentRecord[];

    const existingIndex = params.assessmentId !== undefined
      ? existingAssessments.findIndex(a => String(a.id) === String(params.assessmentId))
      : -1;

    if (existingIndex !== -1) {
      const existing = existingAssessments[existingIndex];
      savedAssessment = {
        ...existing,
        status: params.status || existing.status,
        score: params.score !== undefined ? params.score : existing.score,
        resultNotes: params.resultNotes || params.notes || existing.resultNotes,
        conductedAt: params.conductedAt || (params.status === "PASSED" || params.status === "FAILED" ? now : existing.conductedAt),
        assessorName: params.assessorName || existing.assessorName,
        updatedAt: now,
      };
      updatedAssessments = [...existingAssessments];
      updatedAssessments[existingIndex] = savedAssessment;
    } else {
      savedAssessment = {
        id: existingAssessments.length + 1,
        assessmentCode: `ASM-${Date.now().toString().slice(-6)}`,
        applicationId: params.applicationId,
        partnerId: app.partner_id || null,
        centreId: app.centre_id || null,
        assessmentType: params.assessmentType,
        projectName: "Live Inbound / Voice Dispatch Pilot",
        scheduledDate: params.scheduledDate,
        startTime: params.startTime || "10:00 AM",
        endTime: params.endTime || "12:00 PM",
        assessorAdminId: params.adminId || null,
        assessorName: params.assessorName || params.adminName || "Thinkatic Operations Lead",
        requiredAgents: params.requiredAgents || 5,
        testScope: params.testScope || "Live process simulation and agent readiness evaluation",
        technicalRequirements: params.technicalRequirements || "Vicidial connectivity, dual ISP redundancy, softphone audio testing",
        notes: params.notes || null,
        status,
        conductedAt: params.conductedAt || (status === "PASSED" || status === "FAILED" ? now : null),
        score: params.score !== undefined ? params.score : null,
        resultNotes: params.resultNotes || params.notes || null,
        resubmissionAllowed: params.resubmissionAllowed !== undefined ? params.resubmissionAllowed : true,
        createdAt: now,
        updatedAt: now,
      };
      updatedAssessments = [...existingAssessments, savedAssessment];
    }

    const persistRes = await persistAccreditationApplicationUpdate(params.applicationId, {
      verification_checks: {
        ...checks,
        assessments: updatedAssessments,
      },
      updated_at: now,
    });

    if (!persistRes.success) {
      return { success: false, error: persistRes.error };
    }

    await logAccreditationEvent({
      applicationId: params.applicationId,
      action: status === "SCHEDULED" ? "ASSESSMENT_SCHEDULED" : "ASSESSMENT_COMPLETED",
      stage: "trial_assessment",
      note: `Assessment ${savedAssessment.assessmentCode} (${savedAssessment.assessmentType}): Status ${status}${params.score !== undefined ? ` (Score: ${params.score}%)` : ""}`,
      actorAdminId: params.adminId,
      actorName: params.adminName,
      details: savedAssessment,
    });

    if (app.applicant_user_id) {
      await createAccreditationNotification(
        app.applicant_user_id,
        status === "SCHEDULED" ? "Trial Assessment Scheduled" : "Assessment Results Available",
        status === "SCHEDULED"
          ? `A ${params.assessmentType} assessment has been scheduled for ${params.scheduledDate}.`
          : `Assessment completed with status: ${status}${params.score !== undefined ? ` (${params.score}%)` : ""}.`,
        String(params.applicationId)
      );
    }

    return { success: true, assessment: savedAssessment };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin records executive board decision
 */
export async function adminRecordDecision(params: {
  applicationId: number;
  decision: "APPROVE" | "REJECT" | "REQUEST_REASSESSMENT" | "REQUEST_CHANGES";
  notes: string;
  adminId?: number;
  adminName?: string;
}): Promise<{ success: boolean; error?: string; decision?: any }> {
  const { applicationId, decision, notes, adminId, adminName } = params;

  if (!notes) {
    return { success: false, error: "Executive decision notes are mandatory." };
  }

  try {
    const app = await getAccreditationApplication(applicationId);
    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const now = new Date().toISOString();
    const decisionRecord = {
      decision,
      status: decision,
      decisionMaker: adminName || `Admin #${adminId || 1}`,
      reviewerId: adminId || null,
      date: now,
      notes,
    };

    let updatedFields: Record<string, any> = {
      verification_checks: {
        ...(app.verification_checks || {}),
        decision: decisionRecord,
      },
      updated_at: now,
    };

    if (decision === "REJECT") {
      updatedFields.status = "rejected";
      updatedFields.rejection_reason = notes;
      updatedFields.reviewed_at = now;
      updatedFields.reviewed_by = adminId;
    } else if (decision === "REQUEST_CHANGES" || decision === "REQUEST_REASSESSMENT") {
      updatedFields.status = "action_required";
      updatedFields.rejection_reason = notes;
      updatedFields.missing_information = [{ notes, requested_at: now }];
      updatedFields.reviewed_at = now;
      updatedFields.reviewed_by = adminId;
    } else if (decision === "APPROVE") {
      updatedFields.status = "approved";
      updatedFields.reviewed_at = now;
      updatedFields.reviewed_by = adminId;
    }

    const persistRes = await persistAccreditationApplicationUpdate(applicationId, updatedFields);
    if (!persistRes.success) {
      return { success: false, error: persistRes.error };
    }

    const memApp = await resolveApplicationRecord(applicationId);
    if (memApp) {
      if (decision === "APPROVE") {
        memApp.status = "approved";
        memApp.reviewed_at = now;
        memApp.reviewed_by = adminId;
      } else if (decision === "REJECT") {
        memApp.status = "rejected";
        memApp.rejection_reason = notes;
        memApp.reviewed_at = now;
        memApp.reviewed_by = adminId;
      } else if (decision === "REQUEST_CHANGES" || decision === "REQUEST_REASSESSMENT") {
        memApp.status = "action_required";
        memApp.rejection_reason = notes;
        memApp.missing_information = [{ notes, requested_at: now }];
        memApp.reviewed_at = now;
        memApp.reviewed_by = adminId;
      }
    }

    await logAccreditationEvent({
      applicationId,
      action: `DECISION_${decision}`,
      stage: "decision",
      note: `Executive board accreditation decision: ${decision} — "${notes}"`,
      actorAdminId: adminId,
      actorName: adminName || "Admin",
      details: decisionRecord,
    });

    if (app.applicant_user_id) {
      await createAccreditationNotification(
        app.applicant_user_id,
        `Accreditation Decision: ${decision}`,
        `Your accreditation application decision has been recorded: ${decision}.`,
        String(applicationId)
      );
    }

    return { success: true, decision: decisionRecord };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin strictly verifies all 7 prior gates before activating Centre
 */
export async function adminActivateCentre(params: {
  applicationId: number;
  adminId?: number;
  adminName?: string;
  activationReason?: string;
}): Promise<{ success: boolean; centreId?: string; error?: string }> {
  const { applicationId, adminId, adminName, activationReason } = params;

  try {
    const rawApp = await getAccreditationApplication(applicationId);
    if (!rawApp) {
      return { success: false, error: "Application not found" };
    }

    // Load docs and events
    let docs: any[] = [];
    let events: any[] = [];
    try {
      const { data: dbDocs } = await supabase
        .from("bpo_application_documents")
        .select("*")
        .eq("application_id", applicationId);
      if (dbDocs) docs = dbDocs;
    } catch {}

    const memDocs = (memoryStore.documents?.get(applicationId) || []).map((md: any) => ({
      id: md.id,
      application_id: applicationId,
      document_type: md.document_type || md.documentType || md.type,
      file_name: md.file_name || md.fileName || md.name,
      file_url: md.file_url || md.fileUrl || md.url,
      file_size_bytes: md.file_size_bytes || md.file_size || md.fileSizeBytes || md.size,
      status: md.status,
      reviewer_notes: md.reviewer_notes || md.reviewerNotes,
      rejection_reason: md.rejection_reason || md.rejectionReason,
      verified_at: md.verified_at || md.verifiedAt,
      verified_by: md.verified_by || md.verifiedBy,
      verified_by_name: md.verified_by_name || md.verifiedByName,
      created_at: md.created_at || md.uploadedAt || md.createdAt,
      updated_at: md.updated_at || md.updatedAt,
    }));
    const docMap = new Map<string, any>();
    for (const d of docs) {
      const type = (d as any).document_type || (d as any).documentType || (d as any).type;
      if (type) docMap.set(type, d);
    }
    for (const m of memDocs) {
      const type = (m as any).document_type || (m as any).documentType || (m as any).type;
      if (type) {
        const existing = docMap.get(type);
        if (existing) {
          if (m.status && m.status !== "pending") existing.status = m.status;
          if (m.verified_at) existing.verified_at = m.verified_at;
          if (m.reviewer_notes) existing.reviewer_notes = m.reviewer_notes;
          if (m.rejection_reason) existing.rejection_reason = m.rejection_reason;
          if (m.verified_by) existing.verified_by = m.verified_by;
          if (m.verified_by_name) existing.verified_by_name = m.verified_by_name;
        } else {
          docMap.set(type, m);
        }
      }
    }
    docs = Array.from(docMap.values());

    try {
      const { data: dbEvents } = await supabase
        .from("bpo_application_events")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: true });
      if (dbEvents) events = dbEvents;
    } catch {}

    // Compute comprehensive dossier
    const dossier = await computeAccreditationDossier(rawApp, docs, events);

    // Strict Gate Checks
    const failedGates: string[] = [];

    // Gate 1: Application Submitted
    if (dossier.stages[0].status !== "COMPLETED") {
      failedGates.push("Stage 1: Application Submitted is incomplete.");
    }

    // Gate 2: Documents Verified
    if (dossier.stages[2].status !== "VERIFIED") {
      failedGates.push(`Stage 3: Required compliance documents are not fully verified (${dossier.documents.verifiedCount}/${dossier.documents.totalRequired} cleared).`);
    }

    // Gate 3: Infrastructure Verification
    if (dossier.stages[3].status !== "VERIFIED") {
      failedGates.push("Stage 4: Infrastructure & physical office verification has not been cleared.");
    }

    // Gate 4: Management Verification
    if (dossier.stages[4].status !== "VERIFIED") {
      failedGates.push("Stage 5: Management track record and signatory profile have not been verified.");
    }

    // Gate 5: Trial / Assessment
    if (dossier.stages[5].status !== "VERIFIED" && dossier.stages[5].status !== "COMPLETED") {
      failedGates.push("Stage 6: Frontline trial assessment has not passed quality benchmarks.");
    }

    // Gate 6: Agreement Approved
    if (!dossier.agreement.isApproved) {
      failedGates.push("Stage 7: Global Delivery Partner Agreement has not been formally approved.");
    }

    // Gate 7: Decision Approved
    if (dossier.decision.status !== "APPROVED" && rawApp.status !== "approved") {
      failedGates.push("Stage 7: Executive accreditation board decision has not been approved.");
    }

    if (failedGates.length > 0) {
      return {
        success: false,
        error: `Cannot activate centre. The following accreditation gates are incomplete:\n- ${failedGates.join("\n- ")}`,
      };
    }

    // Generate/preserve authentic Centre ID
    const cd = rawApp.company_data || {};
    const country = (cd.country || "IN").slice(0, 2).toUpperCase();
    const state = (cd.state || "PN").slice(0, 2).toUpperCase();
    const mintedCentreId = rawApp.centre_id || `THK-${country}-${state}-${String(applicationId).padStart(5, "0")}`;
    const now = new Date().toISOString();

    // 1. Update Application status to approved using safe columns
    const checks = rawApp.verification_checks || {};
    checks.activation = {
      activated_at: now,
      activated_by: adminId || null,
      activation_reason: activationReason || "All 7 accreditation gates verified. Facility activated for live production dispatch.",
      centre_id: mintedCentreId,
    };

    const persistRes = await persistAccreditationApplicationUpdate(applicationId, {
      status: "approved",
      centre_id: mintedCentreId,
      reviewed_at: now,
      reviewed_by: adminId || null,
      verification_checks: checks,
      updated_at: now,
    });

    if (!persistRes.success) {
      return { success: false, error: persistRes.error };
    }

    // Also set on in-memory object if present
    const memApp = await resolveApplicationRecord(applicationId);
    if (memApp) {
      memApp.status = "approved";
      memApp.centre_id = mintedCentreId;
      (memApp as any).activated_at = now;
      (memApp as any).activation_reason = activationReason;
    }

    // 2. Insert/Activate Centre in bpo_centres
    try {
      const ctd = rawApp.centre_data || {};
      const { data: existingCentre } = await supabase
        .from("bpo_centres")
        .select("id")
        .eq("centre_id", mintedCentreId)
        .maybeSingle();

      if (existingCentre) {
        await supabase
          .from("bpo_centres")
          .update({
            status: "active",
            name: ctd.centreName || "Primary Facility",
            address: ctd.centreAddress || "",
            total_seats: Number(ctd.totalSeats || 50),
            updated_at: now,
          })
          .eq("id", existingCentre.id);
      } else {
        await supabase.from("bpo_centres").insert({
          centre_id: mintedCentreId,
          name: ctd.centreName || "Primary Facility",
          partner_id: rawApp.partner_id || null,
          status: "active",
          address: ctd.centreAddress || "",
          city: ctd.city || cd.city || "Mohali",
          state: ctd.state || cd.state || "Punjab",
          country: ctd.country || cd.country || "India",
          total_seats: Number(ctd.totalSeats || 50),
          created_at: now,
          updated_at: now,
        });
      }
    } catch (cErr: any) {
      logger.warn({ error: cErr.message }, "Notice creating/activating bpo_centres record");
    }

    // 3. Activate BPO partner record if linked
    if (rawApp.partner_id) {
      try {
        await supabase
          .from("bpo_partners")
          .update({
            status: "active",
            updated_at: now,
          })
          .eq("id", rawApp.partner_id);
      } catch {}
    }

    // 4. Update profiles table bpo_status
    if (rawApp.applicant_user_id) {
      try {
        await supabase
          .from("profiles")
          .update({
            bpo_status: "APPROVED",
            approved_at: now,
            updated_at: now,
          })
          .eq("id", rawApp.applicant_user_id);
      } catch {}
    }

    // 5. Audit Log
    await logAccreditationEvent({
      applicationId,
      action: "CENTRE_ACTIVATED",
      stage: "centre_activated",
      note: `Centre officially activated with ID ${mintedCentreId}. Dispatch marketplace enabled.`,
      actorAdminId: adminId,
      actorName: adminName || "Admin",
      details: { centreId: mintedCentreId, activationReason },
    });

    // 6. In-App Notification to BPO Partner
    if (rawApp.applicant_user_id) {
      await createAccreditationNotification(
        rawApp.applicant_user_id,
        "Accreditation Approved — Centre Activated!",
        `Congratulations! Your facility has passed full Thinkatic accreditation. Your Centre ID is ${mintedCentreId}. Partner portal and project marketplace access are now live!`,
        String(applicationId)
      );
    }

    return { success: true, centreId: mintedCentreId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
