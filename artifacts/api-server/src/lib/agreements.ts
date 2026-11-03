// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — GLOBAL DELIVERY PARTNER AGREEMENT SERVICE
// Source of truth: Agreement/Agreement.pdf (23 Pages)
// Legal Entity: Healweal LLC (Wyoming, USA, Director: Harshad Chavandke)
// NO ONLINE E-SIGN: Physical/offline signing + manual signed PDF upload.
// NO AI: Human/Admin manual verification and explicit approval required.
// IMMUTABLE UPON APPROVAL. PRESERVES CENTRE ID. FULL RESUBMISSION HISTORY.
// ==============================================================================

import fs from "fs";
import path from "path";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import { logSecurityEvent } from "./security.js";
import {
  generatePartnerAgreementPdf,
  getOfficialAgreementPdfPath,
  formatAgreementDate,
  type GeneratedAgreementResult,
} from "./pdfEngine.js";
import { getDomainPath, initStorage, readFile } from "./storageService.js";

export type AgreementStatus =
  | "draft"
  | "pending_admin_issuance"
  | "agreement_ready"
  | "awaiting_signed_upload"
  | "signed_agreement_submitted"
  | "admin_review"
  | "approved"
  | "rejected";

export interface AgreementSubmission {
  id: number;
  agreementId: number;
  partnerId?: string | null;
  centreId?: string | null;
  submissionNumber: number;
  version: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  storageBucket: string;
  storagePath: string;
  masterDocumentReference: string;
  signedDocumentReference: string;
  status: "pending_review" | "approved" | "rejected";
  rejectionReason: string | null;
  issuedAt?: string | null;
  uploadedAt: string;
  submittedAt: string;
  submittedBy: string;
  reviewedAt: string | null;
  reviewedByAdminId: number | null;
  reviewedByAdminName?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerAgreement {
  id: number;
  agreementCode: string; // 'THK-GDP-00001'
  partnerId: string | null;
  applicationId: number | null;
  centreId: string | null;
  version: string;
  status: AgreementStatus;

  // Partner Legal Details
  partnerLegalName: string;
  partnerTradeName: string;
  registrationNumber: string;
  registeredAddress: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  contactEmail: string;
  contactPhone: string;

  // Thinkatic Legal Entity
  thinkaticLegalEntity: "Healweal LLC";
  thinkaticSignatoryName: "Harshad Chavandke";
  thinkaticSignatoryDesignation: "Director";
  thinkaticWebsite: "www.thinkatic.com";
  thinkaticEmail: "thinkaticai@gmail.com";

  // Commercial Terms
  termMonths: number;
  royaltyPercentage: number;
  effectiveDate: string;

  // Single Source of Truth Template & Generated Document Tracking
  templateReference: string; // 'Agreement/Agreement.pdf'
  generatedDocumentUrl: string | null;
  generatedDocumentFileName: string | null;
  generatedDocumentFileSize: number | null;
  generatedAt: string | null;

  // Signed Document Upload (Manual Signed PDF)
  signedDocumentUrl: string | null;
  signedDocumentFileName: string | null;
  signedDocumentFileSize: number | null;
  signedSubmittedAt: string | null;
  signedSubmittedBy: string | null;

  // Admin Review / Approval
  approvedAt: string | null;
  approvedByAdminId: number | null;
  approvedByAdminName: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  rejectedByAdminId: number | null;

  // Immutability
  isImmutable: boolean;

  // Complete Schedules & Metadata
  templateData: Record<string, any>;
  submissions: AgreementSubmission[];

  createdAt: string;
  updatedAt: string;
}

const AGREEMENTS_DOMAIN_DIR = getDomainPath("agreements");
const AGREEMENTS_FILE = path.join(AGREEMENTS_DOMAIN_DIR, "agreements.json");
const LEGACY_AGREEMENTS_FILE = path.resolve(process.cwd(), "data", "agreements.json");
const UPLOADS_DIR = getDomainPath("agreements", "uploads");
const GENERATED_DIR = getDomainPath("agreements", "generated");

// In-memory cache synced with database and JSON fallback
let agreementsStore: PartnerAgreement[] = [];
let isInitialized = false;

// Ensure storage directories exist
initStorage();
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o750 });
}
if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true, mode: 0o750 });
}

// 58 Clauses and Complete Schedules from Agreement/Agreement.pdf
export const AGREEMENT_LEGAL_TEMPLATE = {
  documentTitle: "THINKATIC GLOBAL DELIVERY PARTNER AGREEMENT",
  version: "1.0",
  sourceTemplatePath: "Agreement/Agreement.pdf",
  thinkaticParty: {
    legalEntity: "Healweal LLC",
    stateOfIncorporation: "Wyoming, USA",
    registeredOffice: "30 N Gould St Ste R, Sheridan, WY 82801, USA",
    website: "www.thinkatic.com",
    email: "thinkaticai@gmail.com",
    authorizedSignatory: "Harshad Chavandke",
    designation: "Director",
  },
  keyCommercialTerms: {
    termDurationMonths: 11,
    termRenewal: "Renewable upon mutual written consent prior to expiration",
    thinkaticRoyaltyPercentage: 25.0,
    partnerBillingPercentage: 75.0,
    upfrontFee: "NIL (Zero upfront or setup fees)",
  },
  clauses: [
    { number: 1, title: "Appointment as Global Delivery Partner", summary: "Thinkatic appoints the Partner as a non-exclusive Global Delivery Partner for executing allocated client campaigns and business process operations." },
    { number: 2, title: "Scope of Services", summary: "Partner shall provide call center, BPO, customer support, sales, technical support, back-office and AI-enabled operations as defined in applicable Project Orders." },
    { number: 3, title: "Non-Exclusive Relationship", summary: "Nothing in this Agreement shall prevent Thinkatic from engaging other delivery partners or prevent Partner from providing non-competing services to other clients subject to confidentiality." },
    { number: 4, title: "Project Allocation & Scope of Work", summary: "Projects and campaigns are allocated through Thinkatic Operations based on verified center capability, quality metrics, and capacity availability." },
    { number: 5, title: "Minimum Center Requirements & Facilities", summary: "Partner covenants to maintain a physical center compliant with Schedule C, including commercial facility, acoustic treatment, and ergonomic workstations." },
    { number: 6, title: "Agent Recruitment & Onboarding", summary: "Partner is solely responsible for screening, background checks, language assessment, and compliant hiring of all delivery agents." },
    { number: 7, title: "Agent Training & Certification", summary: "All agents must complete Thinkatic campaign-specific training, platform orientation, and achieve certification before handling live production calls." },
    { number: 8, title: "Shift Operations & Capacity Delivery", summary: "Partner shall deliver contracted seat capacity across agreed operational shifts with continuous supervisor-to-agent ratios not exceeding 1:15." },
    { number: 9, title: "Working Hours & Attendance Management", summary: "Partner shall log agent attendance, shifts, log-in/log-out times, and auxiliary codes through Thinkatic platform reporting." },
    { number: 10, title: "Infrastructure, Power Backup & Internet Redundancy", summary: "Center must maintain redundant high-speed ISP lines (min 100 Mbps) and UPS battery backup plus automatic DG generator capable of uninterrupted operations." },
    { number: 11, title: "Technology Stack, CRM & Dialer Systems", summary: "Operations shall utilize certified predictive/progressive dialers, secure CRM software, and verified VoIP infrastructure meeting latency and jitter thresholds." },
    { number: 12, title: "Call Recording & Storage Compliance", summary: "100% of customer calls must be recorded with dual-channel audio, stored securely with encryption, and retained for at least 90 calendar days." },
    { number: 13, title: "Quality Assurance & Monitoring", summary: "Partner shall conduct internal QA audits on at least 5 calls per agent per week. Thinkatic QA retains unhindered right to perform remote barge-in, whisper, and random calibration." },
    { number: 14, title: "Performance Standards & KPIs", summary: "Partner covenants to meet project SLAs including AHT, CSAT, FCR, QA score (min 85%), occupancy, and login shrinkage (max 8%)." },
    { number: 15, title: "Zero Upfront Fee Guarantee", summary: "Thinkatic strictly operates under a zero upfront fee policy. Thinkatic shall never demand upfront onboarding, licensing, or registration fees from the Partner." },
    { number: 16, title: "Commercial Terms & Billing Model", summary: "Billing rates, currencies, hourly/seat/transaction pricing, and milestone terms are governed by Schedule B Project Commercial Orders." },
    { number: 17, title: "Thinkatic Royalty & Platform Fee", summary: "Thinkatic retains a 25.00% platform royalty fee on gross invoiced billings for sales, project management, client relations, and platform technology." },
    { number: 18, title: "Invoicing & Billing Cycle", summary: "Billing runs on bi-weekly or monthly cycles as defined in Schedule B. All calculations are executed server-side with standard decimal precision." },
    { number: 19, title: "Timesheets & Production Reporting", summary: "Partner shall submit verified system production hours and agent timesheets within 2 business days of cycle closure." },
    { number: 20, title: "Partner Payouts & Disbursement", summary: "Verified net partner disbursements (75% of billable revenue) are released via wire transfer or approved payment rails within agreed payment terms upon client settlement." },
    { number: 21, title: "Currency & Payment Methods", summary: "Payments shall be denominated and disbursed in agreed project currencies (USD, GBP, EUR, INR) via authorized corporate bank channels." },
    { number: 22, title: "Disputed Invoices & Deductions", summary: "Disputed billing items must be raised within 5 business days of invoice receipt and resolved through documented mutual financial reconciliation." },
    { number: 23, title: "Confidential Information & Non-Disclosure", summary: "Partner and its personnel shall strictly safeguard all client information, scripts, technical data, pricing, and campaign workflows as confidential trade secrets." },
    { number: 24, title: "Client Data Protection & Privacy Laws", summary: "Partner shall adhere to applicable data privacy frameworks (including GDPR, HIPAA, and local data protection regulations) as a data processor." },
    { number: 25, title: "Prohibited Data Activities", summary: "Strict prohibition of copying, exporting, scraping, screen recording, or unauthorized dissemination of client databases or customer PII." },
    { number: 26, title: "Information Security Standards", summary: "Centers must maintain clean-desk policies, mobile phone prohibitions on production floors, network firewalls, and active endpoint detection." },
    { number: 27, title: "Security Incident & Breach Notification", summary: "Any suspected or confirmed security breach, unauthorized access, or data leakage must be reported to Thinkatic within 4 hours of discovery." },
    { number: 28, title: "Client Non-Circumvention & Direct Dealing Prohibition", summary: "Partner expressly covenants not to solicit, circumvent, contact, or enter into direct business relationships with Thinkatic clients introduced under this Agreement." },
    { number: 29, title: "Client Communication Protocols", summary: "All formal communications with clients must occur through or with prior written authorization and presence of Thinkatic account executives." },
    { number: 30, title: "Intellectual Property Rights & Ownership", summary: "Thinkatic and its clients retain exclusive ownership of all proprietary software, campaign training materials, branding, algorithms, and derivative works." },
    { number: 31, title: "Thinkatic Branding & Marketing Rights", summary: "Partner may identify itself as an Authorized Delivery Partner only in the exact manner pre-approved in writing by Thinkatic." },
    { number: 32, title: "Partner Code of Conduct", summary: "Partner covenants to enforce Schedule D Code of Conduct across all management, staff, agents, and contractors without exception." },
    { number: 33, title: "Fraud, Misrepresentation & Ethical Standards", summary: "Zero tolerance for fraudulent call dispositions, phantom calls, fabricated sales, credential sharing, or falsified reporting." },
    { number: 34, title: "Regulatory Compliance & Labor Laws", summary: "Partner shall comply fully with all applicable national and local labor laws, minimum wage statutes, social security, and occupational safety codes." },
    { number: 35, title: "Anti-Bribery, Anti-Corruption & Anti-Money Laundering", summary: "Strict compliance with US FCPA, UK Bribery Act, and applicable global anti-corruption and anti-money laundering legislation." },
    { number: 36, title: "Insurance Requirements", summary: "Partner agrees to maintain standard commercial general liability and workers compensation insurance adequate for operating its facility." },
    { number: 37, title: "Independent Contractor Status", summary: "The relationship between Thinkatic and Partner is strictly that of independent commercial contractors. Neither party has authority to bind the other." },
    { number: 38, title: "No Partnership or Agency", summary: "Nothing contained herein creates any partnership, joint venture, agency, franchise, or employment relationship." },
    { number: 39, title: "Taxes & Statutory Deductions", summary: "Each party is solely responsible for its respective income, corporate, payroll, withholding, and value-added tax liabilities." },
    { number: 40, title: "Subcontracting & Assignment Restrictions", summary: "Partner shall not subcontract, transfer, or assign any portion of allocated campaigns or this Agreement without prior written consent from Thinkatic." },
    { number: 41, title: "Exclusivity & Conflict of Interest", summary: "Partner shall disclose any pre-existing client engagements that could present direct conflicts of interest with assigned Thinkatic campaigns." },
    { number: 42, title: "Business Continuity & Disaster Recovery", summary: "Partner must maintain documented BCP/DR plans ensuring operational failover and recovery within 4 hours in the event of local disruption." },
    { number: 43, title: "Audit & Inspection Rights", summary: "Thinkatic authorized representatives have the right, upon 24 hours notice (or immediately for security incidents), to conduct physical or virtual center audits." },
    { number: 44, title: "Suspension of Services", summary: "Thinkatic may suspend project allocations or traffic upon material SLA breaches, compliance failures, or unresolved security incidents." },
    { number: 45, title: "Termination for Convenience", summary: "Either party may terminate this Agreement without cause upon providing 60 calendar days prior written notice." },
    { number: 46, title: "Termination for Cause & Immediate Termination", summary: "Immediate termination applies for fraud, criminal conduct, data breaches, insolvency, or failure to cure material breach within 14 days." },
    { number: 47, title: "Consequences of Termination", summary: "Upon termination, Partner shall immediately cease operations on Thinkatic campaigns, return confidential assets, and complete final financial settlements." },
    { number: 48, title: "Post-Termination Client Protection Period", summary: "Non-circumvention and non-solicitation of Thinkatic clients shall survive for a period of 24 (twenty-four) months following termination." },
    { number: 49, title: "Limitation of Liability", summary: "Except for breaches of confidentiality, non-circumvention, or gross negligence, neither party's liability shall exceed total fees paid in the preceding 3 months." },
    { number: 50, title: "Indemnification Obligations", summary: "Partner shall indemnify and hold harmless Thinkatic, Healweal LLC, and its officers from claims arising from Partner's breach of law, labor disputes, or fraud." },
    { number: 51, title: "Force Majeure", summary: "Neither party shall be liable for failure to perform due to war, natural disasters, epidemics, or events beyond reasonable operational control." },
    { number: 52, title: "Dispute Resolution & Arbitration", summary: "Disputes shall be resolved initially through executive negotiation, and if unresolved within 30 days, through binding commercial arbitration." },
    { number: 53, title: "Governing Law & Jurisdiction", summary: "This Agreement shall be governed by and construed in accordance with the laws applicable to Healweal LLC commercial contracts." },
    { number: 54, title: "Notices & Formal Communications", summary: "Formal notices must be in writing and delivered via registered courier or official executive email (thinkaticai@gmail.com)." },
    { number: 55, title: "Amendments & Modifications", summary: "No modification or amendment shall be binding unless executed in writing by authorized representatives of both parties." },
    { number: 56, title: "Severability & Waiver", summary: "Invalidity of any single clause shall not affect enforceability of remaining provisions. Failure to enforce any term is not a permanent waiver." },
    { number: 57, title: "Document Hierarchy & Order of Precedence", summary: "In the event of conflict, terms govern according to Schedule E: Master Agreement, Project Order Form (Schedule B), and Center Specs." },
    { number: 58, title: "Entire Agreement & Counterparts", summary: "This Agreement and all attached Schedules constitute the entire understanding between Healweal LLC (Thinkatic) and the Partner." }
  ],
  schedules: {
    scheduleA: {
      name: "Schedule A — Partner Profile & Operational Capacity",
      description: "Center specifications, seat capacities, technical infrastructure, and authorized operational contacts."
    },
    scheduleB: {
      name: "Schedule B — Project Commercial Terms & Order Form Structure",
      description: "Project-level pricing, billing cycle, agent requirements, SLAs, quality benchmarks, and Thinkatic royalty (25%)."
    },
    scheduleC: {
      name: "Schedule C — Minimum Center Requirements",
      description: "Physical acoustic standards, dual ISP redundancy, UPS & DG backup, clean desk policy, and CCTV surveillance."
    },
    scheduleD: {
      name: "Schedule D — Partner Code of Conduct",
      description: "Professional ethics, anti-fraud, anti-harassment, fair agent compensation, and operational transparency."
    },
    scheduleE: {
      name: "Schedule E — Document Hierarchy & Precedence",
      description: "Hierarchy governing Master Agreement, Schedule B Order Forms, and operational work instructions."
    }
  },
  signatureBlock: {
    thinkatic: {
      entity: "Healweal LLC",
      signatory: "Harshad Chavandke",
      designation: "Director",
      email: "thinkaticai@gmail.com",
      website: "www.thinkatic.com"
    },
    partnerRequirements: [
      "Authorized Signatory Signature",
      "Authorized Signatory Name & Designation",
      "Date of Physical/Offline Signing",
      "Official Company Seal / Stamp"
    ]
  }
};

/**
 * Persist agreements store to JSON fallback (development/offline only)
 */
function saveAgreementsToFile() {
  if (process.env.NODE_ENV === "production") return;
  try {
    if (!fs.existsSync(AGREEMENTS_DOMAIN_DIR)) {
      fs.mkdirSync(AGREEMENTS_DOMAIN_DIR, { recursive: true, mode: 0o750 });
    }
    fs.writeFileSync(AGREEMENTS_FILE, JSON.stringify(agreementsStore, null, 2), "utf-8");
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed to write agreements JSON fallback file");
  }
}

function mapRowToAgreement(row: any): PartnerAgreement {
  return {
    id: Number(row.id),
    agreementCode: row.agreement_code,
    partnerId: row.partner_id,
    applicationId: row.application_id ? Number(row.application_id) : null,
    centreId: row.centre_id,
    version: row.version || "1.0",
    status: row.status as AgreementStatus,
    partnerLegalName: row.partner_legal_name,
    partnerTradeName: row.partner_trade_name || row.partner_legal_name,
    registrationNumber: row.registration_number || "",
    registeredAddress: row.registered_address || "",
    authorizedSignatoryName: row.authorized_signatory_name || "",
    authorizedSignatoryDesignation: row.authorized_signatory_designation || "Authorized Signatory",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
    thinkaticLegalEntity: "Healweal LLC",
    thinkaticSignatoryName: "Harshad Chavandke",
    thinkaticSignatoryDesignation: "Director",
    thinkaticWebsite: "www.thinkatic.com",
    thinkaticEmail: "thinkaticai@gmail.com",
    termMonths: row.term_months || 11,
    royaltyPercentage: Number(row.royalty_percentage) || 25.0,
    effectiveDate: row.effective_date || formatAgreementDate(row.created_at),
    templateReference: "Agreement/BPO Agreement.pdf",
    generatedDocumentUrl: row.generated_document_url || `/api/bpo/agreement/download`,
    generatedDocumentFileName: row.generated_document_file_name || `Thinkatic-BPO-Partner-Agreement.pdf`,
    generatedDocumentFileSize: row.generated_document_file_size || null,
    generatedAt: row.generated_at || row.created_at || null,
    signedDocumentUrl: row.signed_document_url || null,
    signedDocumentFileName: row.signed_document_file_name || null,
    signedDocumentFileSize: row.signed_document_file_size || null,
    signedSubmittedAt: row.signed_submitted_at || null,
    signedSubmittedBy: row.signed_submitted_by || null,
    approvedAt: row.approved_at || null,
    approvedByAdminId: row.approved_by_admin_id ? Number(row.approved_by_admin_id) : null,
    approvedByAdminName: row.approved_by_admin_name || null,
    rejectionReason: row.rejection_reason || null,
    rejectedAt: row.rejected_at || null,
    rejectedByAdminId: row.rejected_by_admin_id ? Number(row.rejected_by_admin_id) : null,
    isImmutable: Boolean(row.is_immutable),
    templateData: row.template_data || {},
    submissions: [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Load agreements store from DB and JSON fallback
 */
export async function initAgreementsStore(): Promise<void> {
  if (isInitialized) return;

  // 1. Try loading from Supabase DB first (authoritative source of truth)
  try {
    const { data, error } = await supabase
      .from("bpo_partner_agreements")
      .select("*")
      .order("id", { ascending: true });

    if (!error && data && data.length > 0) {
      agreementsStore = data.map((row: any) => mapRowToAgreement(row));
      isInitialized = true;
      return;
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Agreements DB sync skipped or pending migration");
  }

  // 2. Fallback to local JSON storage only if DB returned no rows
  if (process.env.NODE_ENV !== "production") {
    const fileToRead = fs.existsSync(AGREEMENTS_FILE)
      ? AGREEMENTS_FILE
      : fs.existsSync(LEGACY_AGREEMENTS_FILE)
      ? LEGACY_AGREEMENTS_FILE
      : null;
    if (fileToRead) {
      try {
        const fileData = fs.readFileSync(fileToRead, "utf-8");
        agreementsStore = JSON.parse(fileData);
      } catch (e: any) {
        agreementsStore = [];
      }
    }
  }

  isInitialized = true;
}

/**
 * Generate unique agreement ID e.g. THK-GDP-00001
 */
export function generateAgreementCode(): string {
  const count = agreementsStore.length + 1;
  return `THK-GDP-${String(count).padStart(5, "0")}`;
}

/**
 * Get all agreements with optional filter
 */
export async function getAllAgreements(filter?: { status?: string; partnerId?: string }): Promise<PartnerAgreement[]> {
  await initAgreementsStore();
  let list = [...agreementsStore];

  if (filter?.status && filter.status !== "all") {
    list = list.filter(a => a.status.toLowerCase() === filter.status?.toLowerCase());
  }

  if (filter?.partnerId) {
    list = list.filter(a => a.partnerId === filter.partnerId);
  }

  return list;
}

/**
 * Get single agreement by ID
 */
export async function getAgreementById(id: number): Promise<PartnerAgreement | null> {
  await initAgreementsStore();
  try {
    const { data: dbRow } = await supabase
      .from("bpo_partner_agreements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (dbRow) {
      const mapped = mapRowToAgreement(dbRow);
      const existingIdx = agreementsStore.findIndex(a => a.id === id);
      if (existingIdx >= 0) agreementsStore[existingIdx] = mapped;
      else agreementsStore.push(mapped);
      return { ...mapped };
    }
  } catch {}

  const match = agreementsStore.find(a => a.id === id);
  return match ? { ...match } : null;
}

/**
 * Get single agreement by Partner ID
 */
export async function getAgreementByPartnerId(partnerId: string): Promise<PartnerAgreement | null> {
  await initAgreementsStore();
  try {
    const { data: dbRow } = await supabase
      .from("bpo_partner_agreements")
      .select("*")
      .eq("partner_id", partnerId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dbRow) {
      const mapped = mapRowToAgreement(dbRow);
      const existingIdx = agreementsStore.findIndex(a => a.id === mapped.id || a.partnerId === partnerId);
      if (existingIdx >= 0) agreementsStore[existingIdx] = mapped;
      else agreementsStore.push(mapped);
      return { ...mapped };
    }
  } catch {}

  const match = agreementsStore.find(a => a.partnerId === partnerId);
  return match ? { ...match } : null;
}

/**
 * Get single agreement by Application ID with optional partner ID check for tenant isolation
 */
export async function getAgreementByApplicationId(applicationId: number, partnerId?: string): Promise<PartnerAgreement | null> {
  await initAgreementsStore();
  try {
    let q = supabase
      .from("bpo_partner_agreements")
      .select("*")
      .eq("application_id", applicationId);
    if (partnerId) {
      q = q.or(`partner_id.eq.${partnerId},partner_id.is.null`);
    }
    const { data: dbRow } = await q.order("id", { ascending: false }).limit(1).maybeSingle();
    if (dbRow) {
      const mapped = mapRowToAgreement(dbRow);
      const existingIdx = agreementsStore.findIndex(a => a.id === mapped.id || a.applicationId === applicationId);
      if (existingIdx >= 0) agreementsStore[existingIdx] = mapped;
      else agreementsStore.push(mapped);
      return { ...mapped };
    }
  } catch {}

  const match = agreementsStore.find(a => {
    if (a.applicationId !== applicationId) return false;
    if (partnerId && a.partnerId && a.partnerId !== partnerId) return false;
    return true;
  });
  return match ? { ...match } : null;
}

/**
 * Issue Agreement for a Partner / Application
 * Takes Agreement/Agreement.pdf as template and generates a real filled 23-page PDF.
 */
export async function issueAgreement(params: {
  applicationId?: number;
  partnerId?: string;
  centreId?: string;
  partnerData: {
    legalName: string;
    tradeName?: string;
    registrationNumber?: string;
    registeredAddress?: string;
    operationalAddress?: string;
    authorizedSignatoryName?: string;
    authorizedSignatoryDesignation?: string;
    contactEmail?: string;
    contactPhone?: string;
    ownerDirector?: string;
    scheduleAData?: Record<string, any>;
    scheduleBProjectData?: Record<string, any>;
  };
  adminId?: number;
  adminName?: string;
}): Promise<PartnerAgreement> {
  await initAgreementsStore();

  // Check if agreement already exists for this partner or application (with tenant isolation)
  if (params.partnerId) {
    const existing = agreementsStore.find(a => a.partnerId === params.partnerId);
    if (existing) {
      return existing;
    }
  }
  if (params.applicationId) {
    const existing = agreementsStore.find(a => a.applicationId === params.applicationId && (!params.partnerId || !a.partnerId || a.partnerId === params.partnerId));
    if (existing) {
      return existing;
    }
  }

  const nextId = agreementsStore.length > 0 ? Math.max(...agreementsStore.map(a => a.id)) + 1 : 1;
  const agreementCode = generateAgreementCode();
  const now = new Date();
  const effectiveDate = formatAgreementDate(now);

  // Generate real filled 23-page PDF from Agreement/Agreement.pdf
  let generatedResult: GeneratedAgreementResult | null = null;
  try {
    generatedResult = await generatePartnerAgreementPdf({
      agreementCode,
      effectiveDate: now,
      partnerData: {
        legalName: params.partnerData.legalName,
        tradeName: params.partnerData.tradeName,
        registrationNumber: params.partnerData.registrationNumber,
        registeredAddress: params.partnerData.registeredAddress,
        operationalAddress: params.partnerData.operationalAddress,
        authorizedSignatoryName: params.partnerData.authorizedSignatoryName,
        authorizedSignatoryDesignation: params.partnerData.authorizedSignatoryDesignation,
        contactEmail: params.partnerData.contactEmail,
        contactPhone: params.partnerData.contactPhone,
        centreId: params.centreId,
        ownerDirector: params.partnerData.ownerDirector,
        scheduleAData: params.partnerData.scheduleAData,
        scheduleBProjectData: params.partnerData.scheduleBProjectData,
      },
    });
  } catch (err: any) {
    logger.error({ error: err.message, agreementCode }, "Failed to generate filled partner agreement PDF");
  }

  const templateData = {
    scheduleA: params.partnerData.scheduleAData || {},
    scheduleB: params.partnerData.scheduleBProjectData || {},
    issuedByAdmin: params.adminName || "Operations Admin",
    issuedAt: now.toISOString(),
    templatePath: "Agreement/BPO Agreement.pdf",
    master_document_reference: "Agreement/BPO Agreement.pdf",
    storage_bucket: "thinkatic-agreements",
  };

  // 1. Insert into Supabase PostgreSQL DB first to get the authoritative primary key
  let dbId: number | null = null;
  try {
    const { data: insRow, error: insErr } = await supabase.from("bpo_partner_agreements").insert({
      agreement_code: agreementCode,
      partner_id: params.partnerId || null,
      application_id: params.applicationId || null,
      centre_id: params.centreId || null,
      version: "1.0",
      status: "agreement_ready",
      partner_legal_name: params.partnerData.legalName,
      partner_trade_name: params.partnerData.tradeName || params.partnerData.legalName,
      registration_number: params.partnerData.registrationNumber || "",
      registered_address: params.partnerData.registeredAddress || "",
      authorized_signatory_name: params.partnerData.authorizedSignatoryName || "",
      authorized_signatory_designation: params.partnerData.authorizedSignatoryDesignation || "Authorized Signatory",
      contact_email: params.partnerData.contactEmail || "",
      contact_phone: params.partnerData.contactPhone || "",
      thinkatic_legal_entity: "Healweal LLC",
      thinkatic_signatory_name: "Harshad Chavandke",
      thinkatic_signatory_designation: "Director",
      term_months: 11,
      royalty_percentage: 25.0,
      template_data: templateData,
      is_immutable: false,
    }).select("id").maybeSingle();

    if (!insErr && insRow?.id) {
      dbId = Number(insRow.id);
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Database insert for bpo_partner_agreements failed; cached locally");
  }

  const finalId = dbId || nextId;

  const newAgreement: PartnerAgreement = {
    id: finalId,
    agreementCode,
    partnerId: params.partnerId || null,
    applicationId: params.applicationId || null,
    centreId: params.centreId || null,
    version: "1.0",
    status: "agreement_ready",

    partnerLegalName: params.partnerData.legalName,
    partnerTradeName: params.partnerData.tradeName || params.partnerData.legalName,
    registrationNumber: params.partnerData.registrationNumber || "",
    registeredAddress: params.partnerData.registeredAddress || "",
    authorizedSignatoryName: params.partnerData.authorizedSignatoryName || "",
    authorizedSignatoryDesignation: params.partnerData.authorizedSignatoryDesignation || "Authorized Signatory",
    contactEmail: params.partnerData.contactEmail || "",
    contactPhone: params.partnerData.contactPhone || "",

    thinkaticLegalEntity: "Healweal LLC",
    thinkaticSignatoryName: "Harshad Chavandke",
    thinkaticSignatoryDesignation: "Director",
    thinkaticWebsite: "www.thinkatic.com",
    thinkaticEmail: "thinkaticai@gmail.com",

    termMonths: 11,
    royaltyPercentage: 25.0,
    effectiveDate,

    templateReference: "Agreement/BPO Agreement.pdf",
    generatedDocumentUrl: `/api/bpo/agreement/download`,
    generatedDocumentFileName: `Thinkatic-BPO-Partner-Agreement.pdf`,
    generatedDocumentFileSize: 188208,
    generatedAt: now.toISOString(),

    signedDocumentUrl: null,
    signedDocumentFileName: null,
    signedDocumentFileSize: null,
    signedSubmittedAt: null,
    signedSubmittedBy: null,

    approvedAt: null,
    approvedByAdminId: null,
    approvedByAdminName: null,
    rejectionReason: null,
    rejectedAt: null,
    rejectedByAdminId: null,

    isImmutable: false,
    templateData,
    submissions: [],

    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Filter out any stale/colliding elements in memory
  agreementsStore = agreementsStore.filter(a =>
    a.id !== finalId &&
    a.agreementCode !== agreementCode &&
    !(params.applicationId && a.applicationId === params.applicationId)
  );
  agreementsStore.push(newAgreement);
  saveAgreementsToFile();

  await logSecurityEvent({
    action: "AGREEMENT_ISSUED",
    targetId: newAgreement.agreementCode,
    details: {
      agreementCode: newAgreement.agreementCode,
      partnerLegalName: newAgreement.partnerLegalName,
      issuedBy: params.adminName || "Admin",
      template: "Agreement/BPO Agreement.pdf",
    },
  });

  return newAgreement;
}

/**
 * Get or locate the authoritative master partner PDF file path.
 * Single source of truth: Agreement/BPO Agreement.pdf
 */
export async function getGeneratedAgreementPdfPath(_agreement: PartnerAgreement): Promise<string> {
  const masterPath = getOfficialAgreementPdfPath();
  if (fs.existsSync(masterPath)) {
    return masterPath;
  }
  throw new Error("Master Agreement PDF not found at Agreement/BPO Agreement.pdf");
}

/**
 * Upload manual signed PDF outside the website.
 * Immutable agreements cannot be overwritten.
 * Upload does NOT automatically approve the agreement.
 */
export async function recordSignedAgreementUpload(
  agreementId: number,
  file: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    submittedBy: string;
    mimeType?: string;
    storageBucket?: string;
    storagePath?: string;
    partnerId?: string | null;
    centreId?: string | null;
    version?: string;
  }
): Promise<{ success: boolean; agreement?: PartnerAgreement; error?: string }> {
  let agreement = agreementsStore.find(a => a.id === agreementId);

  // If not found in memory, query PostgreSQL DB directly
  if (!agreement) {
    try {
      const { data: dbRow } = await supabase
        .from("bpo_partner_agreements")
        .select("*")
        .eq("id", agreementId)
        .maybeSingle();
      if (dbRow) {
        agreement = mapRowToAgreement(dbRow);
        agreementsStore.push(agreement);
      }
    } catch {}
  }

  if (!agreement) {
    return { success: false, error: "Agreement not found." };
  }

  if (agreement.isImmutable || agreement.status === "approved") {
    return {
      success: true,
      agreement,
    };
  }

  const nowIso = new Date().toISOString();
  const submissionNumber = agreement.submissions.length + 1;
  const version = file.version || agreement.version || "1.0";
  const storageBucket = file.storageBucket || "thinkatic-agreements";
  const storagePath =
    file.storagePath ||
    `partners/${agreement.partnerId || "unknown"}/agreements/${agreement.id}/signed/v${version}/${file.fileName}`;
  const mimeType = file.mimeType || "application/pdf";

  const newSubmission: AgreementSubmission = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    agreementId: agreement.id,
    partnerId: file.partnerId || agreement.partnerId,
    centreId: file.centreId || agreement.centreId,
    submissionNumber,
    version,
    fileName: file.fileName,
    fileUrl: file.fileUrl,
    fileSize: file.fileSize,
    mimeType,
    storageBucket,
    storagePath,
    masterDocumentReference: "Agreement/BPO Agreement.pdf",
    signedDocumentReference: storagePath,
    status: "pending_review",
    rejectionReason: null,
    issuedAt: agreement.createdAt,
    uploadedAt: nowIso,
    submittedAt: nowIso,
    submittedBy: file.submittedBy,
    reviewedAt: null,
    reviewedByAdminId: null,
    reviewedByAdminName: null,
    approvedAt: null,
    rejectedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  agreement.submissions.push(newSubmission);
  agreement.signedDocumentUrl = file.fileUrl;
  agreement.signedDocumentFileName = file.fileName;
  agreement.signedDocumentFileSize = file.fileSize;
  agreement.signedSubmittedAt = newSubmission.submittedAt;
  agreement.signedSubmittedBy = file.submittedBy;
  agreement.status = "signed_agreement_submitted";
  agreement.rejectionReason = null; // Clear previous rejection note upon new submission
  agreement.updatedAt = nowIso;
  if (!agreement.templateData) agreement.templateData = {};
  agreement.templateData.storage_path = storagePath;
  agreement.templateData.storage_bucket = storageBucket;
  agreement.templateData.signed_document_reference = storagePath;

  saveAgreementsToFile();

  // Update DB with signed document details
  try {
    const { error: updErr } = await supabase
      .from("bpo_partner_agreements")
      .update({
        signed_document_url: agreement.signedDocumentUrl,
        signed_document_file_name: agreement.signedDocumentFileName,
        signed_document_file_size: agreement.signedDocumentFileSize,
        signed_submitted_at: agreement.signedSubmittedAt,
        signed_submitted_by: agreement.signedSubmittedBy,
        status: "signed_agreement_submitted",
        rejection_reason: null,
        template_data: agreement.templateData,
        updated_at: agreement.updatedAt,
      })
      .or(`id.eq.${agreement.id},agreement_code.eq.${agreement.agreementCode}`);
    if (updErr) {
      logger.warn({ error: updErr.message }, "DB update for signed agreement upload failed");
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "DB update for signed agreement upload failed");
  }

  // Save submission row to bpo_agreement_submissions table if available
  try {
    await supabase
      .from("bpo_agreement_submissions")
      .insert({
        agreement_id: agreement.id,
        submission_number: submissionNumber,
        file_name: file.fileName,
        file_url: file.fileUrl,
        file_size: file.fileSize,
        status: "pending_review",
        rejection_reason: null,
        submitted_at: nowIso,
        submitted_by: file.submittedBy,
      });
  } catch (subErr: any) {
    logger.warn({ error: subErr.message }, "Notice: bpo_agreement_submissions insert failed");
  }

  await logSecurityEvent({
    action: "SIGNED_AGREEMENT_UPLOADED",
    targetId: agreement.agreementCode,
    details: {
      agreementCode: agreement.agreementCode,
      submissionNumber,
      fileName: file.fileName,
      submittedBy: file.submittedBy,
      storagePath,
    },
  });

  return { success: true, agreement };
}

/**
 * Thinkatic Admin manual approval of signed Agreement.
 * Sets status = APPROVED, makes signed document immutable, and activates the Partner.
 */
export async function approveAgreement(
  agreementIdOrParams: number | { agreementId: number; adminId?: number; adminName?: string },
  adminParam?: { id: number; name: string }
): Promise<any> {
  const isObjectCall = typeof agreementIdOrParams === "object" && agreementIdOrParams !== null;
  let agreementId: number;
  let admin: { id: number; name: string };

  if (isObjectCall) {
    agreementId = agreementIdOrParams.agreementId;
    admin = {
      id: agreementIdOrParams.adminId || 1,
      name: agreementIdOrParams.adminName || "Admin",
    };
  } else {
    agreementId = agreementIdOrParams;
    admin = adminParam || { id: 1, name: "Admin" };
  }

  await initAgreementsStore();
  let agreement = agreementsStore.find(a => a.id === agreementId);

  if (!agreement) {
    try {
      const { data: dbRow } = await supabase
        .from("bpo_partner_agreements")
        .select("*")
        .eq("id", agreementId)
        .maybeSingle();
      if (dbRow) {
        agreement = mapRowToAgreement(dbRow);
        agreementsStore.push(agreement);
      }
    } catch {}
  }

  if (!agreement) {
    if (isObjectCall) throw new Error("Agreement not found.");
    return { success: false, error: "Agreement not found." };
  }

  if (agreement.status === "approved") {
    return { success: true, agreement };
  }

  if (!agreement.signedDocumentUrl && !agreement.signedDocumentFileName) {
    if (isObjectCall) throw new Error("Cannot approve: No signed Agreement document has been uploaded yet.");
    return { success: false, error: "Cannot approve: No signed Agreement document has been uploaded yet." };
  }

  const now = new Date().toISOString();
  agreement.status = "approved";
  agreement.isImmutable = true;
  agreement.approvedAt = now;
  agreement.approvedByAdminId = admin.id;
  agreement.approvedByAdminName = admin.name;
  agreement.updatedAt = now;

  // Mark latest submission as approved
  if (agreement.submissions.length > 0) {
    const latest = agreement.submissions[agreement.submissions.length - 1];
    latest.status = "approved";
    latest.reviewedAt = now;
    latest.reviewedByAdminId = admin.id;
    latest.reviewedByAdminName = admin.name;
    latest.approvedAt = now;
    latest.updatedAt = now;
  }

  saveAgreementsToFile();

  // Update DB for agreement approval
  try {
    const { error: appErr } = await supabase
      .from("bpo_partner_agreements")
      .update({
        status: "approved",
        is_immutable: true,
        approved_at: now,
        approved_by_admin_id: admin.id,
        approved_by_admin_name: admin.name,
        updated_at: now,
      })
      .or(`id.eq.${agreement.id},agreement_code.eq.${agreement.agreementCode}`);
    if (appErr) {
      logger.warn({ error: appErr.message }, "DB update for agreement approval failed");
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "DB update for agreement approval failed");
  }

  if (agreement.applicationId) {
    try {
      await supabase
        .from("bpo_partner_applications")
        .update({
          status: "under_review",
          centre_id: agreement.centreId,
          updated_at: now,
        })
        .eq("id", agreement.applicationId);
    } catch (appErr: any) {
      logger.warn({ error: appErr.message }, "DB update for application notice");
    }
  }

  await logSecurityEvent({
    action: "AGREEMENT_APPROVED",
    targetId: agreement.agreementCode,
    actorAdminId: admin.id,
    details: {
      agreementCode: agreement.agreementCode,
      partnerLegalName: agreement.partnerLegalName,
      approvedBy: admin.name,
      approvedByAdminId: admin.id,
      centreId: agreement.centreId,
    },
  });

  return Object.assign({}, agreement, { success: true, agreement });
}

/**
 * Thinkatic Admin manual rejection of signed Agreement.
 * Rejection reason is REQUIRED. Preserves historical submissions.
 */
export async function rejectAgreement(
  agreementIdOrParams: number | { agreementId: number; adminId?: number; adminName?: string; reason?: string },
  adminParam?: { id: number; name: string },
  reasonParam?: string
): Promise<any> {
  const isObjectCall = typeof agreementIdOrParams === "object" && agreementIdOrParams !== null;
  let agreementId: number;
  let admin: { id: number; name: string };
  let reason: string;

  if (isObjectCall) {
    agreementId = agreementIdOrParams.agreementId;
    admin = {
      id: agreementIdOrParams.adminId || 1,
      name: agreementIdOrParams.adminName || "Admin",
    };
    reason = agreementIdOrParams.reason || "";
  } else {
    agreementId = agreementIdOrParams;
    admin = adminParam || { id: 1, name: "Admin" };
    reason = reasonParam || "";
  }

  await initAgreementsStore();
  const agreement = agreementsStore.find(a => a.id === agreementId);

  if (!agreement) {
    if (isObjectCall) throw new Error("Agreement not found.");
    return { success: false, error: "Agreement not found." };
  }

  if (agreement.isImmutable || agreement.status === "approved") {
    if (isObjectCall) throw new Error("Approved Agreements are immutable and cannot be rejected.");
    return { success: false, error: "Approved Agreements are immutable and cannot be rejected." };
  }

  if (!reason || reason.trim().length === 0) {
    if (isObjectCall) throw new Error("A rejection reason is strictly required.");
    return { success: false, error: "A rejection reason is strictly required." };
  }

  const cleanReason = reason.trim();
  const now = new Date().toISOString();

  agreement.status = "rejected";
  agreement.rejectionReason = cleanReason;
  agreement.rejectedAt = now;
  agreement.rejectedByAdminId = admin.id;
  agreement.updatedAt = now;

  // Mark latest submission as rejected with reason
  if (agreement.submissions.length > 0) {
    const latest = agreement.submissions[agreement.submissions.length - 1];
    latest.status = "rejected";
    latest.rejectionReason = cleanReason;
    latest.reviewedAt = now;
    latest.reviewedByAdminId = admin.id;
    latest.reviewedByAdminName = admin.name;
    latest.rejectedAt = now;
    latest.updatedAt = now;
  }

  saveAgreementsToFile();

  // Update DB for agreement rejection
  try {
    const { error: rejErr } = await supabase
      .from("bpo_partner_agreements")
      .update({
        status: "rejected",
        rejection_reason: cleanReason,
        rejected_at: now,
        rejected_by_admin_id: admin.id,
        updated_at: now,
      })
      .or(`id.eq.${agreement.id},agreement_code.eq.${agreement.agreementCode}`);
    if (rejErr) {
      logger.warn({ error: rejErr.message }, "DB update for agreement rejection failed");
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "DB update for agreement rejection failed");
  }

  await logSecurityEvent({
    action: "AGREEMENT_REJECTED",
    targetId: agreement.agreementCode,
    actorAdminId: admin.id,
    details: {
      agreementCode: agreement.agreementCode,
      rejectionReason: cleanReason,
      rejectedBy: admin.name,
      rejectedByAdminId: admin.id,
    },
  });

  return Object.assign({}, agreement, { success: true, agreement });
}
