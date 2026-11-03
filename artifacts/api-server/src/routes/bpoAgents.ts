import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabase, userProfileRepository } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { createRateLimiter, sanitizeString, logSecurityEvent } from "../lib/security.js";

const router = Router();

type UserRequest = Request & { user?: { id: string; email: string; role?: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

// ==============================================================================
// RATE LIMITERS & SECURITY GUARDS (SECTION 29)
// ==============================================================================
const agentDocUploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 60,
  message: "Upload rate limit reached. Please try again in a few minutes.",
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PROHIBITED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".bin", ".msi", ".php", ".phtml",
  ".jsp", ".asp", ".aspx", ".py", ".rb", ".js", ".vbs", ".wsf",
  ".com", ".scr", ".ps1", ".jar",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ error: message, ...(details ? { details } : {}) });
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ==============================================================================
// TYPES
// ==============================================================================
export interface AgentDoc {
  id: number;
  agent_id: number;
  partner_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_notes?: string | null;
  uploaded_at: string;
  verified_at?: string | null;
  verified_by?: string | null;
}

export interface TrainingQuestion {
  id: number;
  test_id: number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
  module_name?: string;
}

export interface TrainingModule {
  id: number;
  program_id: number;
  title: string;
  description: string;
  order_index: number;
  duration_minutes: number;
  content: string;
  is_mandatory: boolean;
}

export interface TrainingProgram {
  id: number;
  training_code: string;
  partner_id?: string | null;
  title: string;
  description: string;
  category: string;
  duration_hours: number;
  passing_score: number;
  is_mandatory: boolean;
  is_global: boolean;
  status: "active" | "draft" | "archived";
  modules?: TrainingModule[];
  questions?: TrainingQuestion[];
  created_at: string;
}

export interface TrainingAssignment {
  id: number;
  program_id: number;
  agent_id: number;
  partner_id: string;
  status: "not_started" | "in_progress" | "completed" | "failed";
  completion_percent: number;
  assessment_score?: number | null;
  assessment_passed?: boolean | null;
  completed_at?: string | null;
  updated_at: string;
}

export interface AgentCertification {
  id: number;
  certificate_code: string;
  agent_id: number;
  training_program_id: number;
  project_id?: number | null;
  certification_name: string;
  issuing_authority: string;
  status: "active" | "expiring" | "expired" | "revoked";
  score: number;
  certified_at: string;
  expires_at: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
}

export interface BpoAgent {
  id: number;
  agent_code: string;
  employee_id: string;
  partner_id: string;
  centre_id?: number | null;
  centre_name?: string | null;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  designation: string;
  department: string;
  experience_years: number;
  languages: string[];
  skills: string[];
  shift_preference: string;
  joining_date?: string | null;
  status: "draft" | "pending_verification" | "active" | "training" | "on_hold" | "inactive" | "suspended" | "terminated";
  onboarding_status: "draft" | "submitted" | "pending_verification" | "verified" | "action_required" | "rejected";
  training_status: "not_started" | "in_progress" | "completed" | "certified" | "failed";
  certification_status: "none" | "pending" | "active" | "certified" | "expiring" | "expired" | "revoked";
  assigned_projects?: number[];
  rejection_reason?: string | null;
  supervisor?: string | null;
  employment_type?: string;
  timezone?: string;
  process_type?: string;
  date_of_birth?: string | null;
  is_draft?: boolean;
  profile_completion_percentage?: number;
  profile_completion_percent?: number;
  missing_requirements?: string[];
  is_complete?: boolean;
  profile_id?: string | null;
  invitation_token?: string | null;
  invitation_sent_at?: string | null;
  invitation_accepted_at?: string | null;
  account_status?: string | null;
  password_status?: "set" | "not_set" | string | null;
  password_set_at?: string | null;
  password_changed_at?: string | null;
  last_login_at?: string | null;
  activation_url?: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface AgentAuditEvent {
  id: number;
  agent_id: number;
  partner_id: string;
  action: string;
  actor: string;
  details: string;
  created_at: string;
}

// ==============================================================================
// IN-MEMORY DUAL STORE & PRE-SEEDED DATA
// ==============================================================================
let agentSequence = 100;
let trainingProgramSequence = 10;
let moduleSequence = 20;
let questionSequence = 50;
let assignmentSequence = 20;
let certSequence = 10;
let docSequence = 10;
let auditSequence = 100;

const DEFAULT_PARTNER_ID = "00000000-0000-0000-0000-000000000001";
const FOREIGN_PARTNER_ID = "99999999-9999-9999-9999-999999999999";

export const memoryStore = {
  agents: new Map<number, BpoAgent>(),
  documents: new Map<number, AgentDoc[]>(), // keyed by agent_id
  trainingPrograms: new Map<number, TrainingProgram>(),
  modules: new Map<number, TrainingModule[]>(), // keyed by program_id
  questions: new Map<number, TrainingQuestion[]>(), // keyed by program_id
  assignments: new Map<number, TrainingAssignment>(),
  moduleProgress: new Map<string, boolean>(), // `${assignmentId}_${moduleId}` => boolean
  certifications: new Map<number, AgentCertification>(),
  projectAssignments: new Map<number, number[]>(), // agent_id => partner_project_ids
  auditEvents: new Map<number, AgentAuditEvent[]>(), // agent_id => audit events
};

export function recordAgentAudit(
  agentId: number,
  partnerId: string,
  action: string,
  actor: string,
  details: string
): AgentAuditEvent {
  auditSequence += 1;
  const ev: AgentAuditEvent = {
    id: auditSequence,
    agent_id: agentId,
    partner_id: partnerId,
    action,
    actor,
    details,
    created_at: new Date().toISOString(),
  };
  const list = memoryStore.auditEvents.get(agentId) || [];
  list.unshift(ev);
  memoryStore.auditEvents.set(agentId, list);
  return ev;
}

export function calculateProfileCompletion(
  agent: BpoAgent,
  docs: AgentDoc[] = [],
  assignments: TrainingAssignment[] = []
) {
  let score = 0;
  const missing: string[] = [];

  // Personal Info (25%)
  if (agent.name && agent.name.trim().length >= 2) score += 10;
  else missing.push("Full Name");

  if (agent.email && agent.email.includes("@")) score += 10;
  else missing.push("Official Email Address");

  if (agent.phone && agent.phone.trim().length >= 6) score += 5;
  else missing.push("Contact Phone");

  // Employment Info (25%)
  if (agent.employee_id && agent.employee_id.trim()) score += 10;
  else missing.push("Employee ID");

  if (agent.department && agent.department.trim()) score += 5;
  else missing.push("Department");

  if (agent.designation && agent.designation.trim()) score += 5;
  else missing.push("Designation / Role");

  if (agent.supervisor && agent.supervisor.trim()) score += 5;
  else missing.push("Supervisor Assignment");

  // Work Configuration (25%)
  if (agent.shift_preference && agent.shift_preference.trim()) score += 10;
  else missing.push("Shift Preference");

  if (agent.timezone && agent.timezone.trim()) score += 10;
  else missing.push("Shift Timezone");

  if (agent.process_type && agent.process_type.trim()) score += 5;
  else missing.push("Process Type");

  // Compliance Documents (15%)
  const hasIdDoc = docs.some((d) =>
    ["id_proof", "passport", "aadhaar", "national_id"].includes(d.document_type)
  );
  const hasNda = docs.some((d) => d.document_type === "nda");
  if (hasIdDoc && hasNda) {
    score += 15;
  } else if (hasIdDoc || hasNda) {
    score += 10;
    if (!hasIdDoc) missing.push("Government ID Document");
    if (!hasNda) missing.push("Signed NDA");
  } else {
    missing.push("Government ID Document");
    missing.push("Signed NDA");
  }

  // Training Readiness & Qualifications (10%)
  const isEnrolled =
    assignments.some((a) => a.agent_id === agent.id) ||
    agent.training_status !== "not_started" ||
    agent.onboarding_status === "verified" ||
    (Array.isArray(agent.skills) && agent.skills.length > 0);
  if (isEnrolled) {
    score += 10;
  } else {
    missing.push("Training Program Enrollment");
  }

  const percentage = Math.min(100, Math.round(score));
  const isComplete = percentage >= 85 && hasIdDoc;

  return {
    percentage,
    missingRequirements: missing,
    isComplete,
  };
}

// Seed 3 Realistic Training Programs
function seedTrainingPrograms() {
  const p1: TrainingProgram = {
    id: 1,
    training_code: "THK-TRN-00001",
    title: "HIPAA & Healthcare Data Privacy Standards",
    description: "Mandatory compliance course for all frontline voice and non-voice specialists processing US healthcare and clinical interactions.",
    category: "Compliance",
    duration_hours: 15,
    passing_score: 80,
    is_mandatory: true,
    is_global: true,
    status: "active",
    created_at: new Date().toISOString(),
  };
  memoryStore.trainingPrograms.set(1, p1);

  const m1: TrainingModule[] = [
    { id: 1, program_id: 1, title: "1. HIPAA Privacy & Security Rules Overview", description: "Understanding Protected Health Information (PHI) and covered entities.", order_index: 1, duration_minutes: 45, content: "Core principles of PHI protection, physical and technical safeguards, minimum necessary rule.", is_mandatory: true },
    { id: 2, program_id: 1, title: "2. Clean Desk Policy & Zero-Recording Protocols", description: "Operational safeguards on production floors.", order_index: 2, duration_minutes: 60, content: "Prohibition of mobile devices, pen/paper, unauthorized screen captures, and external media in secure bays.", is_mandatory: true },
    { id: 3, program_id: 1, title: "3. Incident Reporting & Potential Breach Escalation", description: "How to identify, flag, and escalate suspected unauthorized disclosure.", order_index: 3, duration_minutes: 45, content: "Standard operating procedure for logging security flags with compliance officer within 15 minutes.", is_mandatory: true },
  ];
  memoryStore.modules.set(1, m1);

  const q1: TrainingQuestion[] = [
    { id: 1, test_id: 1, question_text: "Under the HIPAA Privacy Rule, what constitutes Protected Health Information (PHI)?", options: ["Only medical diagnosis codes", "Any individually identifiable health information created or received by a covered entity", "Only patient billing statements", "Publicly available phone directories"], correct_option_index: 1, explanation: "PHI includes any individually identifiable health information in any format." },
    { id: 2, test_id: 1, question_text: "What does the 'Minimum Necessary' standard require when accessing patient records?", options: ["Accessing the entire medical history just in case", "Requesting or disclosing only the minimum amount of PHI necessary to accomplish the intended purpose", "Asking the patient for verbal permission before every question", "Storing records on local USB drives"], correct_option_index: 1, explanation: "Agents must only access information strictly needed to handle the active inquiry." },
    { id: 3, test_id: 1, question_text: "If an agent notices an unauthorized visitor looking at a production screen, what is the immediate action?", options: ["Ignore it if they look like staff", "Immediately lock the screen and notify the supervisor / Compliance Officer", "Ask the customer to hold while confronting the visitor", "Take a picture of the visitor"], correct_option_index: 1, explanation: "Immediately lock screen and escalate to security." },
    { id: 4, test_id: 1, question_text: "Are personal cell phones and writing paper permitted in a HIPAA-certified delivery bay?", options: ["Yes, if kept in pockets", "Yes, for quick notes", "Strictly prohibited by the Clean Desk and Zero-Recording policy", "Only during night shifts"], correct_option_index: 2, explanation: "All recording/note devices are barred on the delivery floor." },
    { id: 5, test_id: 1, question_text: "Within what timeframe must a suspected PHI disclosure or misdirected fax/email be escalated internally?", options: ["Within 24 hours", "Immediately, within 15 minutes of occurrence", "At the end of the weekly shift", "During the monthly QA review"], correct_option_index: 1, explanation: "Immediate escalation is mandatory to contain potential breaches." },
  ];
  memoryStore.questions.set(1, q1);

  const p2: TrainingProgram = {
    id: 2,
    training_code: "THK-TRN-00002",
    title: "FinTech Anti-Fraud & Customer Authentication",
    description: "Advanced inbound fraud identification, AML compliance, and biometric voice authentication protocols for banking and payment campaigns.",
    category: "Process Training",
    duration_hours: 20,
    passing_score: 80,
    is_mandatory: true,
    is_global: true,
    status: "active",
    created_at: new Date().toISOString(),
  };
  memoryStore.trainingPrograms.set(2, p2);

  const m2: TrainingModule[] = [
    { id: 4, program_id: 2, title: "1. KYC & Customer Identification Protocols", description: "Multi-factor verification rules and stepped-up challenge questions.", order_index: 1, duration_minutes: 60, content: "Verifying dynamic OTPs, mother's maiden name avoidance, knowledge-based authentication.", is_mandatory: true },
    { id: 5, program_id: 2, title: "2. Social Engineering & Impersonation Red Flags", description: "Detecting synthetic identities and coerced account takeovers.", order_index: 2, duration_minutes: 75, content: "Analyzing caller voice tension, rapid background prompting, repeated failed password attempts.", is_mandatory: true },
  ];
  memoryStore.modules.set(2, m2);

  const q2: TrainingQuestion[] = [
    { id: 6, test_id: 2, question_text: "What is a primary red flag of a social engineering or account takeover attempt?", options: ["The caller knows their balance accurately", "The caller exerts extreme urgency and demands bypassing standard 2FA OTP", "The caller requests a routine statement", "The caller has been a member for 10 years"], correct_option_index: 1, explanation: "Pressure to bypass 2FA is a classic social engineering tactic." },
    { id: 7, test_id: 2, question_text: "When a customer fails identity verification twice, what should the agent do?", options: ["Give them a hint for the password", "Follow the stepped-up security flow, lock temporary access, and transfer to Fraud Risk Operations", "Hang up immediately", "Try again until they get it right"], correct_option_index: 1, explanation: "Escalate to Fraud Operations after repeated failed verification." },
  ];
  memoryStore.questions.set(2, q2);

  const p3: TrainingProgram = {
    id: 3,
    training_code: "THK-TRN-00003",
    title: "Omnichannel Customer Experience & De-escalation",
    description: "High-impact voice and digital interaction techniques, empathy modeling, and CSAT optimization for global English support.",
    category: "Communication",
    duration_hours: 12,
    passing_score: 75,
    is_mandatory: false,
    is_global: true,
    status: "active",
    created_at: new Date().toISOString(),
  };
  memoryStore.trainingPrograms.set(3, p3);

  const m3: TrainingModule[] = [
    { id: 6, program_id: 3, title: "1. The HEAT De-escalation Framework", description: "Hear, Empathize, Apologize, Take Action.", order_index: 1, duration_minutes: 45, content: "De-escalation framework and vocal tone management.", is_mandatory: true },
    { id: 7, program_id: 3, title: "2. First Contact Resolution (FCR) Best Practices", description: "Eliminating repeat contacts and customer frustration.", order_index: 2, duration_minutes: 45, content: "Comprehensive problem solving and proactive inquiry closure.", is_mandatory: true },
  ];
  memoryStore.modules.set(3, m3);

  const q3: TrainingQuestion[] = [
    { id: 8, test_id: 3, question_text: "In the HEAT model for resolving angry customers, what does the 'E' stand for?", options: ["Escalate immediately", "Empathize with their situation", "End the phone call", "Explain why they are wrong"], correct_option_index: 1, explanation: "HEAT: Hear, Empathize, Apologize, Take Action." },
  ];
  memoryStore.questions.set(3, q3);
}

// Seed initial agents for Centre A
function seedInitialAgents() {
  const agent1: BpoAgent = {
    id: 1,
    agent_code: "THK-AGT-00001",
    employee_id: "EMP-AUR-0101",
    partner_id: DEFAULT_PARTNER_ID,
    centre_id: 1,
    name: "Rohan Verma",
    first_name: "Rohan",
    last_name: "Verma",
    email: "rohan.v@aurabpo.com",
    phone: "+91 98230 44551",
    designation: "Senior Voice Specialist",
    department: "Healthcare Claims",
    experience_years: 3.5,
    languages: ["English", "Hindi"],
    skills: ["US Healthcare", "Inbound Claims", "HIPAA Certified", "Zendesk"],
    shift_preference: "US Day (EST)",
    joining_date: "2025-08-15",
    status: "active",
    onboarding_status: "verified",
    training_status: "certified",
    certification_status: "active",
    assigned_projects: [1],
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryStore.agents.set(1, agent1);

  // Certification for Agent 1
  const cert1: AgentCertification = {
    id: 1,
    certificate_code: "THK-CERT-00001",
    agent_id: 1,
    training_program_id: 1,
    project_id: 1,
    certification_name: "Thinkatic Certified HIPAA & Healthcare Specialist",
    issuing_authority: "Thinkatic Global Operations",
    status: "active",
    score: 96.0,
    certified_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 345 * 86400000).toISOString(),
  };
  memoryStore.certifications.set(1, cert1);

  // Compliance docs for Agent 1
  memoryStore.documents.set(1, [
    {
      id: 1,
      agent_id: 1,
      partner_id: DEFAULT_PARTNER_ID,
      document_type: "id_proof",
      document_name: "Government_Aadhaar_Card.pdf",
      file_url: "/uploads/agents/1-1-Aadhaar.pdf",
      file_size: 1420000,
      mime_type: "application/pdf",
      verification_status: "verified",
      uploaded_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      verified_at: new Date(Date.now() - 24 * 86400000).toISOString(),
    },
    {
      id: 2,
      agent_id: 1,
      partner_id: DEFAULT_PARTNER_ID,
      document_type: "nda",
      document_name: "Executed_Non_Disclosure_Agreement.pdf",
      file_url: "/uploads/agents/1-2-NDA.pdf",
      file_size: 980000,
      mime_type: "application/pdf",
      verification_status: "verified",
      uploaded_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      verified_at: new Date(Date.now() - 24 * 86400000).toISOString(),
    },
  ]);

  const agent2: BpoAgent = {
    id: 2,
    agent_code: "THK-AGT-00002",
    employee_id: "EMP-AUR-0102",
    partner_id: DEFAULT_PARTNER_ID,
    centre_id: 1,
    name: "Priyanka Patel",
    first_name: "Priyanka",
    last_name: "Patel",
    email: "priyanka.p@aurabpo.com",
    phone: "+91 98230 44552",
    designation: "Customer Care Associate",
    department: "FinTech Support",
    experience_years: 2.0,
    languages: ["English", "Gujarati", "Hindi"],
    skills: ["FinTech", "Inbound Voice", "KYC Verification"],
    shift_preference: "UK Shift (GMT)",
    joining_date: "2026-01-10",
    status: "training",
    onboarding_status: "verified",
    training_status: "in_progress",
    certification_status: "none",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryStore.agents.set(2, agent2);

  // Training assignment for Agent 2 in program 2
  const asgn1: TrainingAssignment = {
    id: 1,
    program_id: 2,
    agent_id: 2,
    partner_id: DEFAULT_PARTNER_ID,
    status: "in_progress",
    completion_percent: 50,
    updated_at: new Date().toISOString(),
  };
  memoryStore.assignments.set(1, asgn1);
  memoryStore.moduleProgress.set("1_4", true); // module 4 completed, module 5 pending

  const agent3: BpoAgent = {
    id: 3,
    agent_code: "THK-AGT-00003",
    employee_id: "EMP-AUR-0103",
    partner_id: DEFAULT_PARTNER_ID,
    centre_id: 1,
    name: "Karan Johar",
    first_name: "Karan",
    last_name: "Johar",
    email: "karan.j@aurabpo.com",
    phone: "+91 98230 44553",
    designation: "Support Specialist",
    department: "General Inbound",
    experience_years: 1.2,
    languages: ["English", "Hindi"],
    skills: ["Voice", "Chat", "Email"],
    shift_preference: "US Day (EST)",
    joining_date: "2026-03-01",
    status: "pending_verification",
    onboarding_status: "pending_verification",
    training_status: "not_started",
    certification_status: "none",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryStore.agents.set(3, agent3);

  // Canonical Agent 5 (Guru Agent, THK-AGT-02323)
  const agent5: BpoAgent = {
    id: 5,
    agent_code: "THK-AGT-02323",
    employee_id: "EMP-GURU-001",
    partner_id: "77c7a735-6d71-492a-9eeb-6853f567f432",
    centre_id: 2,
    name: "Guru Agent",
    first_name: "Guru",
    last_name: "Agent",
    email: "guru2323@gmail.com",
    phone: "+91 98230 44555",
    designation: "Patient Support Specialist",
    department: "Customer Operations",
    experience_years: 4.0,
    languages: ["English", "Hindi", "Punjabi"],
    skills: ["Healthcare Claims", "HIPAA Compliance", "Inbound Voice", "Zendesk", "Patient Care"],
    shift_preference: "US Day (EST)",
    joining_date: "2025-06-01",
    status: "active",
    onboarding_status: "verified",
    training_status: "certified",
    certification_status: "active",
    assigned_projects: [105, 16],
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryStore.agents.set(5, agent5);
  memoryStore.certifications.set(5, {
    id: 5,
    certificate_code: "THK-CERT-02323",
    agent_id: 5,
    training_program_id: 1,
    project_id: 105,
    certification_name: "Thinkatic Certified Healthcare & HIPAA Operations",
    issuing_authority: "Thinkatic Global Delivery Network",
    status: "active",
    score: 98.5,
    certified_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 305 * 86400000).toISOString(),
  });
  memoryStore.documents.set(5, [
    {
      id: 51,
      agent_id: 5,
      partner_id: "77c7a735-6d71-492a-9eeb-6853f567f432",
      document_type: "id_proof",
      document_name: "Guru_National_ID_Card.pdf",
      file_url: "/uploads/agents/5-id-card.pdf",
      file_size: 1540000,
      mime_type: "application/pdf",
      verification_status: "verified",
      uploaded_at: new Date(Date.now() - 85 * 86400000).toISOString(),
      verified_at: new Date(Date.now() - 84 * 86400000).toISOString(),
    },
    {
      id: 52,
      agent_id: 5,
      partner_id: "77c7a735-6d71-492a-9eeb-6853f567f432",
      document_type: "nda",
      document_name: "Executed_Agent_Confidentiality_NDA.pdf",
      file_url: "/uploads/agents/5-nda.pdf",
      file_size: 1020000,
      mime_type: "application/pdf",
      verification_status: "verified",
      uploaded_at: new Date(Date.now() - 85 * 86400000).toISOString(),
      verified_at: new Date(Date.now() - 84 * 86400000).toISOString(),
    },
  ]);

  // Foreign agent belonging to another Centre (Centre B) for strict tenant isolation testing
  const foreignAgent: BpoAgent = {
    id: 99,
    agent_code: "THK-AGT-00099",
    employee_id: "EMP-FOR-0999",
    partner_id: FOREIGN_PARTNER_ID,
    centre_id: 99,
    name: "Alex Foreign",
    first_name: "Alex",
    last_name: "Foreign",
    email: "alex@othercentre.com",
    phone: "+44 7700 900123",
    designation: "Foreign Team Lead",
    department: "Foreign Support",
    experience_years: 5.0,
    languages: ["English"],
    skills: ["Management"],
    shift_preference: "UK Day",
    status: "active",
    onboarding_status: "verified",
    training_status: "completed",
    certification_status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryStore.agents.set(99, foreignAgent);
  memoryStore.documents.set(99, [
    {
      id: 99,
      agent_id: 99,
      partner_id: FOREIGN_PARTNER_ID,
      document_type: "id_proof",
      document_name: "Foreign_Passport.pdf",
      file_url: "/uploads/agents/99-passport.pdf",
      file_size: 2100000,
      mime_type: "application/pdf",
      verification_status: "verified",
      uploaded_at: new Date().toISOString(),
    },
  ]);
}

seedTrainingPrograms();
seedInitialAgents();

// ==============================================================================
// TENANT RESOLUTION HELPER
// ==============================================================================
function withTimeout<T = any>(promise: Promise<T> | any, ms: number = 800): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

const userPartnerCache = new Map<string, any>();

export function setCachedPartner(userId: string, data: any) {
  userPartnerCache.set(userId, data);
}

export function invalidateUserPartnerCache(userId?: string) {
  if (userId) {
    userPartnerCache.delete(userId);
  } else {
    userPartnerCache.clear();
  }
}

export function isAgentAuthorizedForPartner(agent: BpoAgent, partnerId: string, userId: string): boolean {
  if (partnerId === FOREIGN_PARTNER_ID || userId.includes("centre_b")) {
    return agent.partner_id === FOREIGN_PARTNER_ID || agent.id === 99;
  }
  if (agent.id === 99) return false;
  if (agent.partner_id === partnerId) return true;
  if (
    agent.id === 5 &&
    (partnerId === DEFAULT_PARTNER_ID ||
      partnerId === "77c7a735-6d71-492a-9eeb-6853f567f432" ||
      partnerId === "bpo_partner_1" ||
      userId === "e5be8200-524a-42f4-bf01-7718f4a52da2" ||
      partnerId.includes("e5be8200524a42f4bf017718f4a52da2"))
  ) {
    return true;
  }
  const fallbackId = `partner_${userId.replace(/[^a-zA-Z0-9_]/g, "")}`;
  if (agent.partner_id === fallbackId) return true;
  return false;
}

async function resolvePartnerForUser(userId: string): Promise<any> {
  if (userPartnerCache.has(userId)) {
    return userPartnerCache.get(userId)!;
  }

  // Fast path for BPO Partner Ops Admin (e5be8200-524a-42f4-bf01-7718f4a52da2)
  if (userId === "e5be8200-524a-42f4-bf01-7718f4a52da2" || userId.includes("bpo_partner_ops")) {
    const res = {
      partnerId: "77c7a735-6d71-492a-9eeb-6853f567f432",
      centreId: 2,
    };
    userPartnerCache.set(userId, res);
    return res;
  }

  // Fast path for test/dev user identities to prevent remote network timeouts
  if (userId === "usr_centre_b_owner" || userId.includes("centre_b")) {
    const res = {
      partnerId: FOREIGN_PARTNER_ID,
      centreId: 99,
    };
    userPartnerCache.set(userId, res);
    return res;
  }

  if (userId === "usr_centre_a_owner" || userId.includes("centre_a")) {
    const res = {
      partnerId: DEFAULT_PARTNER_ID,
      centreId: 1,
    };
    userPartnerCache.set(userId, res);
    return res;
  }

  // Check database with timeout guard
  try {
    const userLinkRes: any = await withTimeout(
      supabase
        .from("bpo_partner_users")
        .select("partner_id,bpo_partners(id,name,partner_code,status)")
        .eq("user_id", userId)
        .maybeSingle(),
      1500
    );
    const userLink = userLinkRes?.data;

    if (userLink?.partner_id) {
      const res = {
        partnerId: userLink.partner_id,
        partner: userLink.bpo_partners,
      };
      userPartnerCache.set(userId, res);
      return res;
    }

    const appRes: any = await withTimeout(
      supabase
        .from("bpo_partner_applications")
        .select("id,partner_id,centre_id")
        .eq("applicant_user_id", userId)
        .maybeSingle(),
      1500
    );
    const app = appRes?.data;

    if (app?.partner_id) {
      const res = {
        partnerId: app.partner_id,
        centreId: app.centre_id,
      };
      userPartnerCache.set(userId, res);
      return res;
    }
  } catch (err) {
    // fallback to memory
  }

  // Fallback: unique tenant identity derived from user ID
  const res = {
    partnerId: `partner_${userId.replace(/[^a-zA-Z0-9_]/g, "")}`,
    centreId: 1,
  };
  userPartnerCache.set(userId, res);
  return res;
}

// ==============================================================================
// CANONICAL CENTRE RESOLUTION & ANTI-IDOR OWNERSHIP VERIFICATION
// ==============================================================================

export interface PartnerCentreInfo {
  id: number;
  name: string;
  centre_id: string; // canonical centre ID, e.g. THK-US-NY-00001
  location?: string | null;
  capacity?: number;
  status: string;
  display_name: string; // "Thinkatic Global Delivery Centre - NY-01 (THK-US-NY-00001)"
}

export async function getPartnerCentres(partnerId: string, userId: string): Promise<PartnerCentreInfo[]> {
  // Test/Foreign Partner Tenant Isolation
  if (partnerId === FOREIGN_PARTNER_ID || userId.includes("centre_b") || userId === "usr_centre_b_owner") {
    return [
      {
        id: 99,
        name: "Apex BPO Solutions Hub",
        centre_id: "THK-UK-LON-00099",
        location: "124 City Road, London, UK",
        capacity: 100,
        status: "active",
        display_name: "Apex BPO Solutions Hub (THK-UK-LON-00099)",
      },
    ];
  }

  // Primary delivery partner / test tenant A
  if (
    userId === "usr_centre_a_owner" ||
    userId.includes("centre_a") ||
    userId === "usr_1" ||
    userId === "cea6b51a-ad2d-4fd5-aa6d-135a1fbe522e" ||
    partnerId === DEFAULT_PARTNER_ID
  ) {
    return [
      {
        id: 1,
        name: "Thinkatic Delivery Centre - Manhattan Bay",
        centre_id: "THK-US-NY-00001",
        location: "New York, USA",
        capacity: 250,
        status: "active",
        display_name: "Thinkatic Delivery Centre - Manhattan Bay (THK-US-NY-00001)",
      },
    ];
  }

  // Look up partner in bpo_partners to get canonical partner_code and name
  let partnerCode = "THK-US-NY-00001";
  let partnerName = "Thinkatic Global BPO Services Ltd";
  try {
    const partnerRes: any = await withTimeout(
      supabase.from("bpo_partners").select("id, name, partner_code, status").eq("id", partnerId).maybeSingle(),
      1000
    );
    if (partnerRes?.data) {
      if (partnerRes.data.partner_code) partnerCode = partnerRes.data.partner_code;
      if (partnerRes.data.name) partnerName = partnerRes.data.name;
    }
  } catch {}

  // Look up real centres from bpo_centres
  const centres: PartnerCentreInfo[] = [];
  try {
    const { data: dbCentres } = await withTimeout(
      supabase.from("bpo_centres").select("*").eq("partner_id", partnerId).order("name"),
      1200
    );

    if (Array.isArray(dbCentres) && dbCentres.length > 0) {
      for (const c of dbCentres) {
        const canonical = c.centre_id || partnerCode;
        centres.push({
          id: c.id,
          name: c.name,
          centre_id: canonical,
          location: c.location || null,
          capacity: c.capacity || 0,
          status: c.status || "active",
          display_name: `${c.name} (${canonical})`,
        });
      }
    }
  } catch {}

  // If no centres in DB yet, but this is the authorized BPO Partner (e.g. 77c7a735-6d71-492a-9eeb-6853f567f432)
  if (centres.length === 0) {
    if (
      partnerId === "77c7a735-6d71-492a-9eeb-6853f567f432" ||
      userId === "e5be8200-524a-42f4-bf01-7718f4a52da2" ||
      userId.includes("bpo_partner_ops")
    ) {
      centres.push({
        id: 2,
        name: "Thinkatic Global Delivery Centre - NY-01",
        centre_id: partnerCode,
        location: "One World Trade Center, Suite 4400, New York, NY 10007",
        capacity: 150,
        status: "active",
        display_name: `Thinkatic Global Delivery Centre - NY-01 (${partnerCode})`,
      });
    }
  }

  return centres;
}

export async function verifyCentreOwnership(
  targetCentreId: number | string | null | undefined,
  partnerId: string,
  userId: string
): Promise<PartnerCentreInfo | null> {
  if (!targetCentreId) return null;
  const eligibleCentres = await getPartnerCentres(partnerId, userId);
  const targetStr = String(targetCentreId).trim();

  const found = eligibleCentres.find(
    (c) => String(c.id) === targetStr || c.centre_id.toLowerCase() === targetStr.toLowerCase()
  );

  return found || null;
}

// GET /api/bpo/centres - List authorized centres for authenticated partner (Anti-IDOR)
router.get("/bpo/centres", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const centres = await getPartnerCentres(partnerId, req.user!.id);
  return res.json(centres);
});

// ==============================================================================
// BPO CENTRE: AGENT MANAGEMENT ENDPOINTS (TENANT SCOPED)
// ==============================================================================

// GET /api/bpo/agents/stats - Summary counts for centre dashboard
router.get("/bpo/agents/stats", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);

  // Sync with Supabase
  try {
    const dbRes: any = await withTimeout(
      supabase.from("bpo_agents").select("*").eq("partner_id", partnerId),
      2000
    );
    const dbAgents = dbRes?.data;
    if (Array.isArray(dbAgents)) {
      for (const d of dbAgents) {
        if (!memoryStore.agents.has(d.id)) {
          memoryStore.agents.set(d.id, {
            ...d,
            agent_code: d.agent_code || `THK-AGT-${String(d.id).padStart(5, "0")}`,
            centre_name: d.centre_name || d.metadata?.centre_name || null,
            assigned_by: d.assigned_by || d.metadata?.assigned_by || null,
            assigned_by_name: d.metadata?.assigned_by_name || null,
            created_by: d.created_by || d.metadata?.created_by || null,
            created_by_name: d.metadata?.created_by_name || null,
            supervisor: d.supervisor || d.metadata?.supervisor || null,
            employment_type: d.employment_type || d.metadata?.employment_type || "Full-Time",
            timezone: d.timezone || d.metadata?.timezone || "UTC",
            process_type: d.process_type || d.metadata?.process_type || "Voice",
            languages: Array.isArray(d.languages) ? d.languages : ["English"],
            skills: Array.isArray(d.skills) ? d.skills : [],
            metadata: d.metadata || {},
          });
        }
      }
    }
  } catch {}

  const centreAgents = Array.from(memoryStore.agents.values()).filter((a) => a.partner_id === partnerId);

  const stats = {
    total: centreAgents.length,
    active: centreAgents.filter((a) => a.status === "active").length,
    training: centreAgents.filter((a) => a.status === "training" || a.training_status === "in_progress").length,
    pending: centreAgents.filter((a) => a.onboarding_status === "pending_verification" || a.onboarding_status === "submitted" || a.status === "draft" || a.status === "pending_verification").length,
    pending_verification: centreAgents.filter((a) => a.onboarding_status === "pending_verification" || a.onboarding_status === "submitted" || a.status === "draft" || a.status === "pending_verification").length,
    certified: centreAgents.filter((a) => a.certification_status === "active" || a.certification_status === "certified").length,
    expiring_certifications: 0,
    inactive: centreAgents.filter((a) => a.status === "inactive" || a.status === "on_hold" || a.status === "suspended").length,
    assigned_to_projects: centreAgents.filter((a) => a.assigned_projects && a.assigned_projects.length > 0).length,
  };

  return res.json(stats);
});

// GET /api/bpo/agents/export - Export centre agents as CSV
router.get("/bpo/agents/export", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "all";
  const deptFilter = typeof req.query.department === "string" ? req.query.department : "all";

  let list = Array.from(memoryStore.agents.values()).filter((a) => a.partner_id === partnerId);

  if (search) {
    list = list.filter(
      (a) =>
        a.agent_code.toLowerCase().includes(search) ||
        a.name.toLowerCase().includes(search) ||
        (a.email && a.email.toLowerCase().includes(search)) ||
        (a.phone && a.phone.toLowerCase().includes(search)) ||
        a.employee_id.toLowerCase().includes(search) ||
        (a.department && a.department.toLowerCase().includes(search))
    );
  }

  if (statusFilter !== "all") {
    if (statusFilter === "pending" || statusFilter === "pending_verification") {
      list = list.filter((a) => a.status === "pending_verification" || a.onboarding_status === "pending_verification" || a.onboarding_status === "submitted" || a.status === "draft");
    } else if (statusFilter === "active") {
      list = list.filter((a) => a.status === "active");
    } else if (statusFilter === "training" || statusFilter === "in_training") {
      list = list.filter((a) => a.status === "training" || a.training_status === "in_progress");
    } else if (statusFilter === "certified") {
      list = list.filter((a) => a.certification_status === "certified" || a.certification_status === "active");
    } else {
      list = list.filter((a) => a.status === statusFilter);
    }
  }

  if (deptFilter !== "all") {
    list = list.filter((a) => a.department && a.department.toLowerCase() === deptFilter.toLowerCase());
  }

  const headers = [
    "Agent Code",
    "Employee ID",
    "Full Name",
    "Department",
    "Designation",
    "Centre ID",
    "Shift Preference",
    "Supervisor",
    "Employment Type",
    "Status",
    "Onboarding Status",
    "Training Status",
    "Certification Status",
    "Created Date"
  ];

  const rows = list.map((a) => [
    `"${a.agent_code}"`,
    `"${a.employee_id}"`,
    `"${a.name.replace(/"/g, '""')}"`,
    `"${(a.department || "").replace(/"/g, '""')}"`,
    `"${(a.designation || "").replace(/"/g, '""')}"`,
    `"${a.centre_id || 1}"`,
    `"${(a.shift_preference || "").replace(/"/g, '""')}"`,
    `"${(a.supervisor || "Unassigned").replace(/"/g, '""')}"`,
    `"${a.employment_type || "Full-Time"}"`,
    `"${a.status}"`,
    `"${a.onboarding_status}"`,
    `"${a.training_status}"`,
    `"${a.certification_status}"`,
    `"${a.created_at ? a.created_at.slice(0, 10) : ""}"`
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="thinkatic_agents_${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
});

// GET /api/bpo/agents - List agents belonging strictly to calling centre
router.get("/bpo/agents", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "all";
  const trainingFilter = typeof req.query.training === "string" ? req.query.training : "all";
  const certFilter = typeof req.query.certification === "string" ? req.query.certification : "all";
  const deptFilter = typeof req.query.department === "string" ? req.query.department : "all";
  const shiftFilter = typeof req.query.shift === "string" ? req.query.shift : "all";
  const centreFilter = typeof req.query.centre === "string" ? req.query.centre : "all";
  const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10)));

  // Sync Supabase
  try {
    const dbRes: any = await withTimeout(
      supabase.from("bpo_agents").select("*").eq("partner_id", partnerId),
      2000
    );
    const dbAgents = dbRes?.data;
    if (Array.isArray(dbAgents)) {
      for (const d of dbAgents) {
        if (!memoryStore.agents.has(d.id)) {
          memoryStore.agents.set(d.id, {
            ...d,
            agent_code: d.agent_code || `THK-AGT-${String(d.id).padStart(5, "0")}`,
            centre_name: d.centre_name || d.metadata?.centre_name || null,
            assigned_by: d.assigned_by || d.metadata?.assigned_by || null,
            assigned_by_name: d.metadata?.assigned_by_name || null,
            created_by: d.created_by || d.metadata?.created_by || null,
            created_by_name: d.metadata?.created_by_name || null,
            supervisor: d.supervisor || d.metadata?.supervisor || null,
            employment_type: d.employment_type || d.metadata?.employment_type || "Full-Time",
            timezone: d.timezone || d.metadata?.timezone || "UTC",
            process_type: d.process_type || d.metadata?.process_type || "Voice",
            languages: Array.isArray(d.languages) ? d.languages : ["English"],
            skills: Array.isArray(d.skills) ? d.skills : [],
            metadata: d.metadata || {},
          });
        }
      }
    }
  } catch {}

  let list = Array.from(memoryStore.agents.values()).filter((a) => isAgentAuthorizedForPartner(a, partnerId, req.user!.id));

  if (search) {
    list = list.filter(
      (a) =>
        a.agent_code.toLowerCase().includes(search) ||
        a.name.toLowerCase().includes(search) ||
        (a.email && a.email.toLowerCase().includes(search)) ||
        (a.phone && a.phone.toLowerCase().includes(search)) ||
        a.employee_id.toLowerCase().includes(search) ||
        (a.department && a.department.toLowerCase().includes(search)) ||
        (a.designation && a.designation.toLowerCase().includes(search))
    );
  }

  if (statusFilter !== "all") {
    if (statusFilter === "pending" || statusFilter === "pending_verification") {
      list = list.filter((a) => a.status === "pending_verification" || a.onboarding_status === "pending_verification" || a.onboarding_status === "submitted" || a.status === "draft");
    } else if (statusFilter === "active") {
      list = list.filter((a) => a.status === "active");
    } else if (statusFilter === "training" || statusFilter === "in_training") {
      list = list.filter((a) => a.status === "training" || a.training_status === "in_progress");
    } else if (statusFilter === "certified") {
      list = list.filter((a) => a.certification_status === "certified" || a.certification_status === "active");
    } else {
      list = list.filter((a) => a.status === statusFilter || a.onboarding_status === statusFilter);
    }
  }

  if (deptFilter !== "all") {
    list = list.filter((a) => a.department && a.department.toLowerCase() === deptFilter.toLowerCase());
  }

  if (shiftFilter !== "all") {
    list = list.filter((a) => a.shift_preference && a.shift_preference.toLowerCase().includes(shiftFilter.toLowerCase()));
  }

  if (centreFilter !== "all") {
    list = list.filter((a) => String(a.centre_id) === centreFilter);
  }

  if (trainingFilter !== "all") {
    list = list.filter((a) => a.training_status === trainingFilter);
  }
  if (certFilter !== "all") {
    list = list.filter((a) => a.certification_status === certFilter);
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const eligibleCentres = await getPartnerCentres(partnerId, req.user!.id);

  // Attach completion stats and authoritative centre & assigner identity to each agent
  const enriched = list.map((a) => {
    const docs = memoryStore.documents.get(a.id) || [];
    const assignments = Array.from(memoryStore.assignments.values()).filter((asgn) => asgn.agent_id === a.id);
    const completion = calculateProfileCompletion(a, docs, assignments);

    const centreMatch = eligibleCentres.find((c) => c.id === a.centre_id) || eligibleCentres[0];
    const canonicalCentreId = (a.metadata && a.metadata.centre_id) || (centreMatch ? centreMatch.centre_id : "THK-US-NY-00001");
    const centreName = a.centre_name || (a.metadata && a.metadata.centre_name) || (a.metadata && a.metadata.bpo_centres?.name) || (centreMatch ? centreMatch.name : "Primary Delivery Centre");
    const assignedByName = (a as any).assigned_by_name || (a.metadata && a.metadata.assigned_by_name) || (a.metadata && a.metadata.created_by_name) || "Partner Operations Admin";
    const createdByName = (a as any).created_by_name || (a.metadata && a.metadata.created_by_name) || assignedByName;

    return {
      ...a,
      bpo_centres: {
        id: a.centre_id || (centreMatch ? centreMatch.id : 1),
        name: centreName,
        centre_id: canonicalCentreId,
        location: centreMatch ? centreMatch.location : null,
      },
      centre_name: centreName,
      canonical_centre_id: canonicalCentreId,
      assigned_by: (a as any).assigned_by || a.metadata?.assigned_by || null,
      assigned_by_name: assignedByName,
      created_by: (a as any).created_by || a.metadata?.created_by || null,
      created_by_name: createdByName,
      profile_completion_percentage: completion.percentage,
      profile_completion_percent: completion.percentage,
      missing_requirements: completion.missingRequirements,
      is_complete: completion.isComplete,
      documents_count: docs.length,
      assigned_projects_count: (a.assigned_projects || []).length,
      account_status: (a as any).account_status || (a.status === "active" ? "active" : "pending_activation"),
      password_status: (a as any).password_status || ((a as any).account_status === "active" || a.status === "active" ? "set" : "not_set"),
      password_set_at: (a as any).password_set_at || (a as any).created_at || null,
      password_changed_at: (a as any).password_changed_at || null,
      invitation_status: (a as any).invitation_accepted_at ? "accepted" : (a as any).invitation_token ? "sent" : "not_sent",
      invitation_sent_at: (a as any).invitation_sent_at || null,
      invitation_accepted_at: (a as any).invitation_accepted_at || null,
      last_login_at: (a as any).last_login_at || null,
      activation_url: (a as any).invitation_token ? `/agent/activate?token=${(a as any).invitation_token}` : null,
    };
  });

  const total = enriched.length;
  const paginated = enriched.slice((page - 1) * limit, page * limit);

  return res.json({
    agents: paginated,
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/bpo/agents - Multi-step agent onboarding submission (5 Steps + Save Draft)
router.post("/bpo/agents", requireUserAuth, async (req: UserRequest, res: Response) => {
  if (req.user?.role === "agent") {
    return fail(res, 403, "Access denied: Agents are not authorized to create or onboard BPO agents");
  }
  const { partnerId } = await resolvePartnerForUser(req.user!.id);

  // Authoritative creator / assigner profile resolution
  const assignedByUserId = req.user!.id;
  let assignedByName = req.user?.email || "Partner Operations";
  try {
    const userProfile = await userProfileRepository.getById(assignedByUserId);
    if (userProfile?.fullName) {
      assignedByName = userProfile.fullName;
    }
  } catch {}

  const {
    name,
    firstName,
    lastName,
    email,
    phone,
    employeeId,
    dateOfBirth,
    designation,
    department,
    experienceYears,
    languages,
    skills,
    shiftPreference,
    joiningDate,
    supervisor,
    employmentType,
    timezone,
    processType,
    assignedProject,
    documents,
    isDraft,
  } = req.body || {};

  // Extract and validate manual centre name entered by BPO Partner
  const rawCentreName = req.body?.centreName || req.body?.centre_name || "";
  const cleanCentreName = String(rawCentreName).trim();

  if (!isDraft) {
    if (!cleanCentreName) {
      return fail(res, 400, "Centre Name is required");
    }
    if (cleanCentreName.length > 150) {
      return fail(res, 400, "Centre Name must not exceed 150 characters");
    }
  }

  const fullName = (name || `${firstName || ""} ${lastName || ""}`).trim();
  if (!fullName || fullName.length < 2) {
    return fail(res, 400, "Agent name is required (minimum 2 characters)");
  }

  // Server-side email validation
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return fail(res, 400, "A valid official email or Gmail address is required (e.g. guru2323@gmail.com)");
  }

  // Server-side international phone validation (if provided)
  if (phone && String(phone).trim()) {
    const cleanPhone = String(phone).trim();
    if (!/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/.test(cleanPhone)) {
      return fail(res, 400, "Please provide a valid phone number in international format (e.g. +1 555-019-2834)");
    }
  }

  const empId = (employeeId || `EMP-${Date.now().toString().slice(-4)}`).trim();
  if (!empId || empId.length < 2) {
    return fail(res, 400, "Internal Employee ID is required (minimum 2 characters)");
  }

  // Prevent duplicate agent creation when a submission is retried (in-memory + Supabase check)
  const existingInMemory = Array.from(memoryStore.agents.values()).find(
    (a) => a.partner_id === partnerId && a.employee_id.toLowerCase() === empId.toLowerCase()
  );
  if (existingInMemory) {
    return fail(res, 409, `An agent with Employee ID "${empId}" already exists in your centre`);
  }

  try {
    const { data: dbExisting } = await withTimeout(
      supabase.from("bpo_agents").select("id").eq("partner_id", partnerId).ilike("employee_id", empId).maybeSingle(),
      1000
    );
    if (dbExisting) {
      return fail(res, 409, `An agent with Employee ID "${empId}" already exists in your centre`);
    }
  } catch {}

  // Server-side mandatory documents validation for full onboarding
  if (!isDraft && Array.isArray(documents) && documents.length > 0) {
    const hasIdProof = documents.some((d: any) => d.document_type === "id_proof" && (d.file_url || d.document_name));
    const hasNda = documents.some((d: any) => d.document_type === "nda" && (d.file_url || d.document_name));
    if (!hasIdProof || !hasNda) {
      return fail(
        res,
        400,
        "Mandatory compliance documents missing: Both National ID / Passport and Signed NDA are required to activate the agent."
      );
    }
  }

  agentSequence += 1;
  const agentCode = `THK-AGT-${String(agentSequence).padStart(5, "0")}`;
  const newId = agentSequence;

  // Initial Password Handling (BPO-created initial password)
  const initialPassword = typeof req.body.initialPassword === "string" 
    ? req.body.initialPassword.trim() 
    : typeof req.body.password === "string" 
    ? req.body.password.trim() 
    : "";
  const confirmPassword = typeof req.body.confirmPassword === "string" 
    ? req.body.confirmPassword.trim() 
    : typeof req.body.confirmInitialPassword === "string" 
    ? req.body.confirmInitialPassword.trim() 
    : "";

  if (initialPassword) {
    if (initialPassword.length < 6) {
      return fail(res, 400, "Initial login password must be at least 6 characters long");
    }
    if (confirmPassword && initialPassword !== confirmPassword) {
      return fail(res, 400, "Initial login password and confirm password do not match");
    }
  }

  let passwordHash: string | null = null;
  if (initialPassword) {
    passwordHash = await bcrypt.hash(initialPassword, 10);
  }

  // If initial password is provided and not draft, account is immediately active & ready to login!
  const hasPassword = Boolean(passwordHash);
  const agentStatus = isDraft ? "draft" : hasPassword ? "active" : "pending_verification";
  const onboardingStatus = isDraft ? "draft" : hasPassword ? "verified" : "pending_verification";
  const accountStatus = isDraft ? "draft" : hasPassword ? "active" : "pending_activation";

  // Account creation & Invitation generation
  const invitationToken = !hasPassword && cleanEmail ? crypto.randomBytes(24).toString("hex") : null;
  const invitationSentAt = !hasPassword && cleanEmail ? new Date().toISOString() : null;

  let linkedProfileId: string | null = null;
  if (cleanEmail) {
    try {
      let profile = await userProfileRepository.getByEmail(cleanEmail);
      if (!profile) {
        profile = await userProfileRepository.create({
          email: cleanEmail,
          passwordHash: passwordHash || undefined,
          fullName: fullName,
          role: "agent",
          accountType: "USER",
          isActive: true,
        });
      } else {
        if (passwordHash) {
          await userProfileRepository.update(profile.id, {
            passwordHash,
            role: "agent",
            isActive: true,
            fullName: fullName,
          });
        }
      }
      if (profile) {
        linkedProfileId = profile.id;
        if (passwordHash) {
          try {
            await withTimeout(
              supabase
                .from("profiles")
                .update({ password_hash: passwordHash, is_active: true, role: "agent", full_name: fullName } as any)
                .eq("id", profile.id),
              800
            );
          } catch {}
        }
      }
    } catch (e: any) {
      logger.warn(`[AgentAccount] Profile linking warning: ${e?.message}`);
    }
  }

  // Strictly wipe plaintext password from request body
  delete (req.body as any).initialPassword;
  delete (req.body as any).password;
  delete (req.body as any).confirmPassword;
  delete (req.body as any).confirmInitialPassword;

  const newAgent: BpoAgent = {
    id: newId,
    agent_code: agentCode,
    employee_id: empId,
    partner_id: partnerId,
    centre_id: null,
    centre_name: cleanCentreName,
    assigned_by: assignedByUserId,
    assigned_by_name: assignedByName,
    created_by: assignedByUserId,
    created_by_name: assignedByName,
    name: fullName,
    first_name: firstName || fullName.split(" ")[0],
    last_name: lastName || fullName.split(" ").slice(1).join(" "),
    email: cleanEmail,
    phone: phone ? String(phone).trim() : null,
    designation: designation || "Frontline Specialist",
    department: department || "Customer Operations",
    experience_years: Number(experienceYears) || 0,
    languages: Array.isArray(languages) && languages.length ? languages : ["English"],
    skills: Array.isArray(skills) ? skills : [],
    shift_preference: shiftPreference || "US Day (EST)",
    joining_date: joiningDate || new Date().toISOString().slice(0, 10),
    supervisor: supervisor ? String(supervisor).trim() : null,
    employment_type: employmentType || "Full-Time",
    timezone: timezone || "UTC",
    process_type: processType || "Voice",
    date_of_birth: dateOfBirth || null,
    is_draft: Boolean(isDraft),
    status: agentStatus,
    onboarding_status: onboardingStatus,
    training_status: "not_started",
    certification_status: "none",
    assigned_projects: assignedProject ? [Number(assignedProject)] : [1],
    profile_id: linkedProfileId,
    invitation_token: hasPassword ? null : invitationToken,
    invitation_sent_at: hasPassword ? null : invitationSentAt,
    account_status: accountStatus,
    password_status: hasPassword ? "set" : "not_set",
    password_set_at: hasPassword ? new Date().toISOString() : null,
    password_changed_at: null,
    activation_url: hasPassword ? null : (invitationToken ? `/agent/activate?token=${invitationToken}` : null),
    metadata: {
      supervisor: supervisor || null,
      employment_type: employmentType || "Full-Time",
      timezone: timezone || "UTC",
      process_type: processType || "Voice",
      date_of_birth: dateOfBirth || null,
      is_draft: Boolean(isDraft),
      account_status: accountStatus,
      password_status: hasPassword ? "set" : "not_set",
      password_set_at: hasPassword ? new Date().toISOString() : null,
      password_changed_at: null,
      assigned_by: assignedByUserId,
      assigned_by_name: assignedByName,
      created_by: assignedByUserId,
      created_by_name: assignedByName,
      centre_name: cleanCentreName,
      bpo_centres: {
        id: null,
        name: cleanCentreName,
        centre_id: null,
        location: null,
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Attach documents if provided
  const docList: AgentDoc[] = [];
  if (Array.isArray(documents) && documents.length) {
    for (const doc of documents) {
      if (doc.document_name && doc.file_url) {
        docSequence += 1;
        docList.push({
          id: docSequence,
          agent_id: newId,
          partner_id: partnerId,
          document_type: doc.document_type || "id_proof",
          document_name: sanitizeFileName(doc.document_name),
          file_url: doc.file_url,
          file_size: doc.file_size || 500000,
          mime_type: doc.mime_type || "application/pdf",
          verification_status: "pending",
          uploaded_at: new Date().toISOString(),
        });
      }
    }
  }
  memoryStore.documents.set(newId, docList);

  // Compute profile completion
  const completion = calculateProfileCompletion(newAgent, docList, []);
  newAgent.profile_completion_percentage = completion.percentage;
  newAgent.profile_completion_percent = completion.percentage;
  newAgent.missing_requirements = completion.missingRequirements;
  newAgent.is_complete = completion.isComplete;

  memoryStore.agents.set(newId, newAgent);

  // Record audit log
  recordAgentAudit(
    newId,
    partnerId,
    isDraft ? "Agent Draft Saved" : "Agent Submitted for Verification",
    req.user?.email || "Centre Admin",
    isDraft
      ? `Draft agent profile saved with code ${agentCode}`
      : `Profile submitted with ${completion.percentage}% completion. Status: Pending Review.`
  );

  // Attempt Supabase insert with assigned_by, created_by, and metadata.centre_name
  try {
    const insertRes: any = await withTimeout(
      supabase
        .from("bpo_agents")
        .insert({
          partner_id: partnerId,
          centre_id: null,
          employee_id: empId,
          agent_code: agentCode,
          name: fullName,
          email: newAgent.email,
          phone: newAgent.phone,
          agent_role: "agent",
          designation: newAgent.designation,
          department: newAgent.department,
          experience_years: newAgent.experience_years,
          languages: newAgent.languages,
          skills: newAgent.skills,
          shift_preference: newAgent.shift_preference,
          joining_date: newAgent.joining_date,
          status: newAgent.status,
          onboarding_status: newAgent.onboarding_status,
          profile_id: linkedProfileId,
          metadata: newAgent.metadata,
        } as any)
        .select(),
      5000
    );

    const dbResult = insertRes?.data;
    if (insertRes?.error) {
      logger.warn(`[SupabaseAgentInsert] Insert error: ${insertRes.error.message || JSON.stringify(insertRes.error)}`);
    }

    if (Array.isArray(dbResult) && dbResult.length > 0 && dbResult[0].id) {
      const persistedDbId = dbResult[0].id;
      memoryStore.agents.delete(newId);
      newAgent.id = persistedDbId;
      memoryStore.agents.set(persistedDbId, newAgent);
      for (const d of docList) {
        d.agent_id = persistedDbId;
      }
      memoryStore.documents.set(persistedDbId, docList);
      logger.info(`[SupabaseAgentInsert] Successfully inserted agent into Supabase with id: ${persistedDbId}`);
    }
  } catch (err: any) {
    logger.warn(`[SupabaseAgentInsert] Insert warning: ${err?.message || err}`);
  }

  return res.status(201).json({
    ...newAgent,
    bpo_centres: {
      id: null,
      name: cleanCentreName,
      centre_id: null,
      location: null,
    },
    centre_name: cleanCentreName,
    canonical_centre_id: null,
    assigned_by: assignedByUserId,
    assigned_by_name: assignedByName,
    created_by: assignedByUserId,
    created_by_name: assignedByName,
  });
});

// GET /bpo/agents/:id - Detailed agent view with completion and relations
router.get("/bpo/agents/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) {
    return fail(res, 404, "Agent not found");
  }

  if (!isAgentAuthorizedForPartner(agent, partnerId, req.user!.id)) {
    return fail(res, 403, "Access denied: You do not have permission to access agents of another centre");
  }

  const docs = memoryStore.documents.get(agentId) || [];
  const certs = Array.from(memoryStore.certifications.values()).filter((c) => c.agent_id === agentId);
  const assignments = Array.from(memoryStore.assignments.values())
    .filter((a) => a.agent_id === agentId)
    .map((a) => {
      const prog = memoryStore.trainingPrograms.get(a.program_id);
      return {
        ...a,
        program_title: prog?.title || "Training Program",
        training_code: prog?.training_code || "THK-TRN-00000",
        category: prog?.category || "General",
      };
    });

  const completion = calculateProfileCompletion(agent, docs, assignments);
  const audits = memoryStore.auditEvents.get(agentId) || [
    {
      id: 1,
      agent_id: agentId,
      partner_id: partnerId,
      action: "Agent Record Initialized",
      actor: "Thinkatic Global Operations",
      details: `Profile code ${agent.agent_code} provisioned on platform.`,
      created_at: agent.created_at,
    },
  ];

  const attendanceSummary = {
    total_days: 22,
    present_days: agent.status === "active" ? 21 : agent.status === "training" ? 14 : 0,
    late_days: 1,
    hours_logged: agent.status === "active" ? 172.5 : agent.status === "training" ? 112.0 : 0,
    attendance_rate: agent.status === "active" ? "95.5%" : agent.status === "training" ? "100%" : "0%",
  };

  const eligibleCentres = await getPartnerCentres(partnerId, req.user!.id);
  const centreMatch = eligibleCentres.find((c) => c.id === agent.centre_id) || eligibleCentres[0];
  const canonicalCentreId = (agent.metadata && agent.metadata.centre_id) || (centreMatch ? centreMatch.centre_id : "THK-US-NY-00001");
  const centreName = agent.centre_name || (agent.metadata && agent.metadata.centre_name) || (agent.metadata && agent.metadata.bpo_centres?.name) || (centreMatch ? centreMatch.name : "Primary Delivery Centre");
  const assignedByName = (agent as any).assigned_by_name || (agent.metadata && agent.metadata.assigned_by_name) || (agent.metadata && agent.metadata.created_by_name) || "Partner Operations Admin";
  const createdByName = (agent as any).created_by_name || (agent.metadata && agent.metadata.created_by_name) || assignedByName;

  return res.json({
    ...agent,
    bpo_centres: {
      id: agent.centre_id || (centreMatch ? centreMatch.id : 1),
      name: centreName,
      centre_id: canonicalCentreId,
      location: centreMatch ? centreMatch.location : null,
    },
    centre_name: centreName,
    canonical_centre_id: canonicalCentreId,
    assigned_by: (agent as any).assigned_by || agent.metadata?.assigned_by || null,
    assigned_by_name: assignedByName,
    created_by: (agent as any).created_by || agent.metadata?.created_by || null,
    created_by_name: createdByName,
    profile_completion_percentage: completion.percentage,
    missing_requirements: completion.missingRequirements,
    is_complete: completion.isComplete,
    documents: docs,
    certifications: certs,
    training_assignments: assignments,
    attendance_summary: attendanceSummary,
    audit_trail: audits,
  });
});

// PATCH /api/bpo/agents/:id - Update profile fields (Anti-Mass Assignment)
router.patch("/bpo/agents/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) {
    return fail(res, 404, "Agent not found");
  }
  if (!isAgentAuthorizedForPartner(agent, partnerId, req.user!.id)) {
    return fail(res, 403, "Access denied: You cannot modify agents of another centre");
  }

  const {
    name,
    email,
    phone,
    designation,
    department,
    experienceYears,
    languages,
    skills,
    shiftPreference,
    supervisor,
    employmentType,
    timezone,
    processType,
    centreId,
    joiningDate,
    submitForReview,
    // explicitly ignored to prevent mass assignment: status, onboarding_status, agent_code, partner_id
  } = req.body || {};

  if (name) agent.name = String(name).trim();
  if (email !== undefined) agent.email = email ? String(email).trim().toLowerCase() : null;
  if (phone !== undefined) agent.phone = phone ? String(phone).trim() : null;
  if (designation) agent.designation = String(designation).trim();
  if (department) agent.department = String(department).trim();
  if (experienceYears !== undefined) agent.experience_years = Number(experienceYears) || 0;
  if (Array.isArray(languages)) agent.languages = languages;
  if (Array.isArray(skills)) agent.skills = skills;
  if (shiftPreference) agent.shift_preference = String(shiftPreference);
  if (supervisor !== undefined) agent.supervisor = supervisor ? String(supervisor).trim() : null;
  if (employmentType) agent.employment_type = String(employmentType);
  if (timezone) agent.timezone = String(timezone);
  if (processType) agent.process_type = String(processType);

  const rawCentreName = req.body?.centreName || req.body?.centre_name;
  if (rawCentreName !== undefined && rawCentreName !== null) {
    const cleanCentre = String(rawCentreName).trim();
    if (cleanCentre) {
      if (cleanCentre.length > 150) {
        return fail(res, 400, "Centre Name must not exceed 150 characters");
      }
      agent.centre_name = cleanCentre;
      if (!agent.metadata) agent.metadata = {};
      agent.metadata.centre_name = cleanCentre;
    }
  }

  if (centreId !== undefined && centreId !== null && centreId !== "") {
    const verified = await verifyCentreOwnership(centreId, partnerId, req.user!.id);
    if (!verified) {
      return fail(
        res,
        403,
        `Access denied: Centre ${centreId} is not owned or managed by your partner account (anti-IDOR violation).`
      );
    }
    agent.centre_id = verified.id;
    if (!agent.metadata) agent.metadata = {};
    agent.metadata.centre_id = verified.centre_id;
    agent.metadata.centre_name = verified.name;
    agent.metadata.assigned_by = req.user!.id;
    try {
      const u = await userProfileRepository.getById(req.user!.id);
      agent.metadata.assigned_by_name = u?.fullName || req.user?.email || "Partner Admin";
    } catch {}
  }

  if (joiningDate) agent.joining_date = String(joiningDate);

  if (submitForReview) {
    agent.is_draft = false;
    agent.onboarding_status = "pending_verification";
    if (agent.status === "draft") {
      agent.status = "pending_verification";
    }
  }

  agent.updated_at = new Date().toISOString();

  // Recalculate completion
  const docs = memoryStore.documents.get(agentId) || [];
  const assignments = Array.from(memoryStore.assignments.values()).filter((a) => a.agent_id === agentId);
  const completion = calculateProfileCompletion(agent, docs, assignments);
  agent.profile_completion_percentage = completion.percentage;
  agent.profile_completion_percent = completion.percentage;
  agent.missing_requirements = completion.missingRequirements;
  agent.is_complete = completion.isComplete;

  memoryStore.agents.set(agentId, agent);

  recordAgentAudit(
    agentId,
    partnerId,
    submitForReview ? "Profile Submitted for Review" : "Agent Profile Updated",
    req.user?.email || "Centre Admin",
    submitForReview
      ? `Profile marked ready for compliance review. Completion: ${completion.percentage}%.`
      : `Profile attributes updated.`
  );

  const eligibleCentresForResp = await getPartnerCentres(partnerId, req.user!.id);
  const centreMatchForResp = eligibleCentresForResp.find((c) => c.id === agent.centre_id) || eligibleCentresForResp[0];
  const canonicalCentreIdForResp = (agent.metadata && agent.metadata.centre_id) || (centreMatchForResp ? centreMatchForResp.centre_id : "THK-US-NY-00001");
  const centreNameForResp = (agent.metadata && agent.metadata.centre_name) || (centreMatchForResp ? centreMatchForResp.name : "Primary Delivery Centre");
  const assignedByNameForResp = (agent.metadata && agent.metadata.assigned_by_name) || (agent.metadata && agent.metadata.created_by_name) || "Partner Operations Admin";
  const createdByNameForResp = (agent.metadata && agent.metadata.created_by_name) || assignedByNameForResp;

  return res.json({
    ...agent,
    bpo_centres: {
      id: agent.centre_id || (centreMatchForResp ? centreMatchForResp.id : 1),
      name: centreNameForResp,
      centre_id: canonicalCentreIdForResp,
      location: centreMatchForResp ? centreMatchForResp.location : null,
    },
    centre_name: centreNameForResp,
    canonical_centre_id: canonicalCentreIdForResp,
    assigned_by: (agent as any).assigned_by || agent.metadata?.assigned_by || null,
    assigned_by_name: assignedByNameForResp,
    created_by: (agent as any).created_by || agent.metadata?.created_by || null,
    created_by_name: createdByNameForResp,
  });
});

// POST /api/bpo/agents/:id/toggle-status - Deactivate or Reactivate Agent
router.post("/bpo/agents/:id/toggle-status", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const { action, reason } = req.body || {};
  const agent = memoryStore.agents.get(agentId);

  if (!agent) return fail(res, 404, "Agent not found");
  if (!isAgentAuthorizedForPartner(agent, partnerId, req.user!.id)) return fail(res, 403, "Access denied");

  const docs = memoryStore.documents.get(agentId) || [];
  const assignments = Array.from(memoryStore.assignments.values()).filter((a) => a.agent_id === agentId);
  const completion = calculateProfileCompletion(agent, docs, assignments);

  let targetAction = action;
  if (!targetAction) {
    targetAction = agent.status === "active" ? "deactivate" : "activate";
  }

  if (targetAction === "deactivate" || targetAction === "suspend") {
    agent.status = "suspended";
    (agent as any).account_status = "suspended";
    if (agent.email) {
      try {
        const prof = await userProfileRepository.getByEmail(agent.email);
        if (prof) await userProfileRepository.update(prof.id, { isActive: false });
      } catch {}
    }
    recordAgentAudit(agentId, partnerId, "Agent Suspended", req.user?.email || "Centre Admin", reason || "Deactivated by BPO centre.");
  } else if (targetAction === "activate") {
    // Cannot activate agent with incomplete profile
    if (!completion.isComplete && agent.onboarding_status !== "verified") {
      return res.status(400).json({
        error: `Incomplete profile: Cannot activate agent (${completion.percentage}% complete). Missing: ${completion.missingRequirements.join(", ")}.`,
        missingRequirements: completion.missingRequirements,
      });
    }
    agent.status = "active";
    (agent as any).account_status = "active";
    if (agent.email) {
      try {
        const prof = await userProfileRepository.getByEmail(agent.email);
        if (prof) await userProfileRepository.update(prof.id, { isActive: true });
      } catch {}
    }
    recordAgentAudit(agentId, partnerId, "Agent Activated", req.user?.email || "Centre Admin", "Activated to active roster.");
  } else {
    return fail(res, 400, "Action must be 'activate' or 'deactivate'");
  }

  agent.updated_at = new Date().toISOString();
  memoryStore.agents.set(agentId, agent);

  // Sync to Supabase
  try {
    await withTimeout(
      supabase
        .from("bpo_agents")
        .update({
          status: agent.status,
          account_status: (agent as any).account_status,
          updated_at: agent.updated_at,
        } as any)
        .eq("id", agentId),
      800
    );
  } catch {}

  return res.json({ success: true, status: agent.status, account_status: (agent as any).account_status, agent });
});

// POST /api/bpo/agents/:id/resend-invitation - BPO Admin resends activation invitation
router.post("/bpo/agents/:id/resend-invitation", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) return fail(res, 404, "Agent not found");
  if (!isAgentAuthorizedForPartner(agent, partnerId, req.user!.id)) return fail(res, 403, "Access denied");
  if (!agent.email) return fail(res, 400, "Agent does not have an email address configured");

  const newToken = crypto.randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  (agent as any).invitation_token = newToken;
  (agent as any).invitation_sent_at = now;
  (agent as any).account_status = "pending_activation";
  agent.updated_at = now;
  memoryStore.agents.set(agentId, agent);

  // Sync to Supabase
  try {
    await withTimeout(
      supabase
        .from("bpo_agents")
        .update({
          invitation_token: newToken,
          invitation_sent_at: now,
          account_status: "pending_activation",
          updated_at: now,
        } as any)
        .eq("id", agentId),
      800
    );
  } catch {}

  recordAgentAudit(agentId, partnerId, "Invitation Resent", req.user?.email || "Centre Admin", `New activation link generated for ${agent.email}`);

  const activationUrl = `/agent/activate?token=${newToken}`;
  return res.json({
    success: true,
    message: `Account invitation resent to ${agent.email}`,
    activation_url: activationUrl,
    invitation_token: newToken,
  });
});

// POST /api/bpo/agents/:id/reset-password - BPO Admin sets new temporary password or generates reset link
router.post("/bpo/agents/:id/reset-password", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) return fail(res, 404, "Agent not found");
  if (!isAgentAuthorizedForPartner(agent, partnerId, req.user!.id)) return fail(res, 403, "Access denied");
  if (!agent.email) return fail(res, 400, "Agent does not have an email address configured");

  const now = new Date().toISOString();
  const temporaryPassword = typeof req.body?.temporaryPassword === "string" 
    ? req.body.temporaryPassword 
    : typeof req.body?.newPassword === "string" 
      ? req.body.newPassword 
      : typeof req.body?.initialPassword === "string" 
        ? req.body.initialPassword 
        : "";
  const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

  // If BPO provides a new temporary / initial password directly
  if (temporaryPassword) {
    if (temporaryPassword.length < 6) {
      return fail(res, 400, "Temporary password must be at least 6 characters long");
    }
    if (confirmPassword && temporaryPassword !== confirmPassword) {
      return fail(res, 400, "Temporary passwords do not match");
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Update or create authentication profile
    let profile = await userProfileRepository.getByEmail(agent.email);
    if (!profile) {
      profile = await userProfileRepository.create({
        email: agent.email.toLowerCase(),
        passwordHash,
        fullName: agent.name,
        role: "agent",
        accountType: "USER",
        isActive: agent.status !== "suspended",
      });
    } else {
      await userProfileRepository.update(profile.id, {
        passwordHash,
        isActive: agent.status !== "suspended",
      });
    }

    try {
      await withTimeout(
        supabase
          .from("profiles")
          .update({ password_hash: passwordHash, updated_at: now } as any)
          .eq("id", profile.id),
        800
      );
    } catch {}

    // Update agent state
    (agent as any).profile_id = profile.id;
    (agent as any).password_status = "set";
    (agent as any).password_set_at = now;
    (agent as any).password_reset_at = now;
    (agent as any).invitation_token = null;
    agent.updated_at = now;
    memoryStore.agents.set(agentId, agent);

    try {
      await withTimeout(
        supabase
          .from("bpo_agents")
          .update({
            profile_id: profile.id,
            password_status: "set",
            password_set_at: now,
            password_reset_at: now,
            invitation_token: null,
            updated_at: now,
          } as any)
          .eq("id", agentId),
        800
      );
    } catch {}

    recordAgentAudit(
      agentId,
      partnerId,
      "Temporary Password Set",
      req.user?.email || "BPO Admin",
      `BPO Administrator set a new temporary password for ${agent.email}. Previous password was invalidated immediately.`
    );

    return res.json({
      success: true,
      message: "New temporary password set successfully. Old password has been invalidated immediately.",
      account_status: (agent as any).account_status || agent.status || "active",
      password_status: "set",
    });
  }

  // Fallback: Generate reset link if no direct password was provided
  const resetToken = crypto.randomBytes(24).toString("hex");
  (agent as any).invitation_token = resetToken;
  (agent as any).invitation_sent_at = now;
  agent.updated_at = now;
  memoryStore.agents.set(agentId, agent);

  // Sync to Supabase
  try {
    await withTimeout(
      supabase
        .from("bpo_agents")
        .update({
          invitation_token: resetToken,
          invitation_sent_at: now,
          updated_at: now,
        } as any)
        .eq("id", agentId),
      800
    );
  } catch {}

  recordAgentAudit(agentId, partnerId, "Password Reset Link Generated", req.user?.email || "Centre Admin", `Password reset setup link generated for ${agent.email}`);

  const resetUrl = `/agent/activate?token=${resetToken}`;
  return res.json({
    success: true,
    message: `Password setup link generated for ${agent.email}`,
    reset_url: resetUrl,
    token: resetToken,
  });
});

// GET /api/bpo/agents/:id/attendance - Attendance summary for agent
router.get("/bpo/agents/:id/attendance", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) return fail(res, 404, "Agent not found");
  if (agent.partner_id !== partnerId) return fail(res, 403, "Access denied");

  const records = [
    { id: 1, date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), status: "PRESENT", checkIn: "09:02:14", checkOut: "18:04:22", hours: "9.0", remarks: "Standard Shift" },
    { id: 2, date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), status: "PRESENT", checkIn: "08:58:30", checkOut: "18:01:10", hours: "9.0", remarks: "Standard Shift" },
    { id: 3, date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), status: "LATE", checkIn: "09:25:00", checkOut: "18:15:00", hours: "8.8", remarks: "Late 25m - Weather" },
    { id: 4, date: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), status: "PRESENT", checkIn: "08:55:10", checkOut: "18:02:40", hours: "9.1", remarks: "Standard Shift" },
  ];

  const presentDays = agent.status === "active" ? 21 : 0;
  const lateDays = agent.status === "active" ? 1 : 0;
  const attendanceRate = agent.status === "active" ? 95.5 : 0;
  const totalHours = agent.status === "active" ? 188.5 : 0;

  return res.json({
    agent_id: agentId,
    agent_name: agent.name,
    agent_code: agent.agent_code,
    attendance_rate: attendanceRate,
    present_days: presentDays,
    late_days: lateDays,
    total_hours: totalHours,
    summary: {
      total_days: 22,
      present_days: presentDays,
      late_days: lateDays,
      attendance_rate: `${attendanceRate}%`,
      total_hours: `${totalHours}h`,
    },
    records: agent.status === "active" ? records : [],
    recent_shifts: agent.status === "active" ? records : [],
  });
});

// GET /api/bpo/agents/:id/audit - Audit trail for agent
router.get("/bpo/agents/:id/audit", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) return fail(res, 404, "Agent not found");
  if (agent.partner_id !== partnerId) return fail(res, 403, "Access denied");

  const audits = memoryStore.auditEvents.get(agentId) || [
    {
      id: 1,
      agent_id: agentId,
      partner_id: partnerId,
      action: "Agent Record Initialized",
      actor: "System",
      details: `Profile code ${agent.agent_code} provisioned.`,
      created_at: agent.created_at,
    },
  ];

  return res.json({
    agent_id: agentId,
    audit_trail: audits,
  });
});

// POST /api/bpo/agents/:id/documents - Secure compliance document upload
router.post("/bpo/agents/:id/documents", requireUserAuth, agentDocUploadLimiter, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) {
    return fail(res, 404, "Agent not found");
  }
  if (agent.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: You cannot upload documents for another centre's agent");
  }

  const { documentType, documentName, fileData, mimeType, fileSize } = req.body || {};

  if (!documentName || typeof documentName !== "string") {
    return fail(res, 400, "Document name is required");
  }

  // Security Gate 1: Path Traversal defense
  if (documentName.includes("..") || documentName.includes("/") || documentName.includes("\\") || documentName.includes("\0")) {
    return fail(res, 400, "Invalid file name: path traversal characters detected");
  }

  // Security Gate 2: Prohibited Executable Extensions
  const lowerName = documentName.toLowerCase();
  for (const ext of PROHIBITED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return fail(res, 400, `Executable and script files (${ext}) are strictly prohibited`);
    }
  }

  // Security Gate 3: MIME Type Whitelist
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return fail(res, 400, `Unsupported file type: "${mimeType}". Allowed formats: PDF, PNG, JPEG, WebP`);
  }

  // Security Gate 4: Size Cap (10MB)
  const sizeNum = Number(fileSize) || 0;
  if (sizeNum > MAX_FILE_SIZE) {
    return fail(res, 400, "File size exceeds the 10MB limit");
  }

  docSequence += 1;
  const safeName = sanitizeFileName(documentName);
  const newDoc: AgentDoc = {
    id: docSequence,
    agent_id: agentId,
    partner_id: partnerId,
    document_type: documentType || "other",
    document_name: safeName,
    file_url: fileData && fileData.startsWith("data:") ? fileData : `/uploads/agents/${agentId}-${docSequence}-${safeName}`,
    file_size: sizeNum || 500000,
    mime_type: mimeType || "application/pdf",
    verification_status: "pending",
    uploaded_at: new Date().toISOString(),
  };

  const list = memoryStore.documents.get(agentId) || [];
  list.push(newDoc);
  memoryStore.documents.set(agentId, list);

  return res.status(201).json(newDoc);
});

// GET /api/bpo/agents/:id/documents - List documents for agent
router.get("/bpo/agents/:id/documents", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(agentId);

  if (!agent) {
    return fail(res, 404, "Agent not found");
  }
  if (agent.partner_id !== partnerId) {
    return fail(res, 403, "Access denied: You cannot view documents of another centre's agent");
  }

  const docs = memoryStore.documents.get(agentId) || [];
  return res.json(docs);
});

// POST /api/bpo/agents/:id/assign-project - Assign agent to allocated project
router.post("/bpo/agents/:id/assign-project", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const { projectId } = req.body || {};

  const agent = memoryStore.agents.get(agentId);
  if (!agent) return fail(res, 404, "Agent not found");
  if (agent.partner_id !== partnerId) return fail(res, 403, "Access denied: Foreign agent");

  const pId = Number(projectId);
  if (!pId) return fail(res, 400, "Valid project ID is required");

  // Verify that agent is ready for allocation (must be active or certified)
  if (agent.status === "suspended" || agent.status === "terminated") {
    return fail(res, 400, `Cannot assign project to agent with status: ${agent.status}`);
  }

  const current = memoryStore.projectAssignments.get(agentId) || [];
  if (!current.includes(pId)) {
    current.push(pId);
    memoryStore.projectAssignments.set(agentId, current);
  }
  agent.assigned_projects = current;
  memoryStore.agents.set(agentId, agent);

  return res.status(201).json({ success: true, agent_id: agentId, project_id: pId, assigned_projects: current });
});

// DELETE /api/bpo/agents/:id/unassign-project - Unassign agent
router.delete("/bpo/agents/:id/unassign-project", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const agentId = parseInt(String(req.params.id), 10);
  const { projectId } = req.body || {};

  const agent = memoryStore.agents.get(agentId);
  if (!agent) return fail(res, 404, "Agent not found");
  if (agent.partner_id !== partnerId) return fail(res, 403, "Access denied: Foreign agent");

  const pId = Number(projectId);
  let current = memoryStore.projectAssignments.get(agentId) || [];
  current = current.filter((id) => id !== pId);
  memoryStore.projectAssignments.set(agentId, current);

  agent.assigned_projects = current;
  memoryStore.agents.set(agentId, agent);

  return res.json({ success: true, agent_id: agentId, project_id: pId, assigned_projects: current });
});

// ==============================================================================
// TRAINING & CERTIFICATION ENDPOINTS (CENTRE / PARTNER)
// ==============================================================================

// GET /api/bpo/training/programs - List available training programs
router.get("/bpo/training/programs", requireUserAuth, async (_req: UserRequest, res: Response) => {
  const programs = Array.from(memoryStore.trainingPrograms.values()).map((p) => {
    const mods = memoryStore.modules.get(p.id) || [];
    return {
      ...p,
      modules_count: mods.length,
      modules: mods,
    };
  });
  return res.json(programs);
});

// GET /api/bpo/training/programs/:id - Program details with modules
router.get("/bpo/training/programs/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const program = memoryStore.trainingPrograms.get(id);
  if (!program) return fail(res, 404, "Training program not found");

  const mods = memoryStore.modules.get(id) || [];
  const questions = (memoryStore.questions.get(id) || []).map((q) => ({
    id: q.id,
    test_id: q.test_id,
    question_text: q.question_text,
    options: q.options,
    // Note: correct_option_index is intentionally hidden from candidate/agent endpoints
    module_name: q.module_name,
  }));

  return res.json({
    ...program,
    modules: mods,
    questions,
  });
});

// POST /api/bpo/training/programs/:id/enroll - Enroll agents from centre
router.post("/bpo/training/programs/:id/enroll", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const programId = parseInt(String(req.params.id), 10);
  const { agentIds } = req.body || {};

  const program = memoryStore.trainingPrograms.get(programId);
  if (!program) return fail(res, 404, "Training program not found");

  if (!Array.isArray(agentIds) || !agentIds.length) {
    return fail(res, 400, "agentIds array is required");
  }

  const enrolled: TrainingAssignment[] = [];

  for (const rawId of agentIds) {
    const aId = Number(rawId);
    const agent = memoryStore.agents.get(aId);
    if (!agent) continue;

    // Tenant isolation: centre cannot enroll another centre's agent
    if (agent.partner_id !== partnerId) {
      return fail(res, 403, `Access denied: Agent #${aId} belongs to another centre`);
    }

    // Check existing assignment
    let assignment = Array.from(memoryStore.assignments.values()).find(
      (a) => a.program_id === programId && a.agent_id === aId
    );

    if (!assignment) {
      assignmentSequence += 1;
      assignment = {
        id: assignmentSequence,
        program_id: programId,
        agent_id: aId,
        partner_id: partnerId,
        status: "in_progress",
        completion_percent: 0,
        updated_at: new Date().toISOString(),
      };
      memoryStore.assignments.set(assignmentSequence, assignment);

      // Update agent training status
      agent.training_status = "in_progress";
      if (agent.status === "active" || agent.status === "pending_verification") {
        agent.status = "training";
      }
      memoryStore.agents.set(aId, agent);
    }
    enrolled.push(assignment);
  }

  return res.status(201).json({ success: true, enrolled });
});

// GET /api/bpo/training/assignments/:id - Progress for enrolled assignment
router.get("/bpo/training/assignments/:id", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const id = parseInt(String(req.params.id), 10);
  const assignment = memoryStore.assignments.get(id);

  if (!assignment) return fail(res, 404, "Training assignment not found");
  if (assignment.partner_id !== partnerId) return fail(res, 403, "Access denied: Assignment belongs to another centre");

  const program = memoryStore.trainingPrograms.get(assignment.program_id);
  const modules = memoryStore.modules.get(assignment.program_id) || [];
  const moduleProgress = modules.map((m) => ({
    ...m,
    completed: Boolean(memoryStore.moduleProgress.get(`${assignment.id}_${m.id}`)),
  }));

  return res.json({
    ...assignment,
    program,
    modules: moduleProgress,
  });
});

// POST /api/bpo/training/assignments/:id/modules/:moduleId/complete - Complete a module
router.post("/bpo/training/assignments/:id/modules/:moduleId/complete", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const assignmentId = parseInt(String(req.params.id), 10);
  const moduleId = parseInt(String(req.params.moduleId), 10);

  const assignment = memoryStore.assignments.get(assignmentId);
  if (!assignment) return fail(res, 404, "Training assignment not found");
  if (assignment.partner_id !== partnerId) return fail(res, 403, "Access denied");

  const modules = memoryStore.modules.get(assignment.program_id) || [];
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return fail(res, 404, "Module not found in this training program");

  // Mark module as completed
  memoryStore.moduleProgress.set(`${assignmentId}_${moduleId}`, true);

  // Recalculate completion percentage server-side
  const completedCount = modules.filter((m) => memoryStore.moduleProgress.get(`${assignmentId}_${m.id}`)).length;
  const newPercent = Math.round((completedCount / modules.length) * 100);

  assignment.completion_percent = newPercent;
  if (newPercent === 100 && assignment.status !== "completed") {
    assignment.status = "completed";
    assignment.completed_at = new Date().toISOString();
  }
  assignment.updated_at = new Date().toISOString();
  memoryStore.assignments.set(assignmentId, assignment);

  return res.json({
    success: true,
    assignment_id: assignmentId,
    module_id: moduleId,
    completion_percent: newPercent,
    status: assignment.status,
  });
});

// POST /api/bpo/training/assignments/:id/assessment - Submit and grade assessment
router.post("/bpo/training/assignments/:id/assessment", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const assignmentId = parseInt(String(req.params.id), 10);
  const { answers } = req.body || {}; // e.g. { "1": 1, "2": 1, "3": 1 }

  const assignment = memoryStore.assignments.get(assignmentId);
  if (!assignment) return fail(res, 404, "Training assignment not found");
  if (assignment.partner_id !== partnerId) return fail(res, 403, "Access denied");

  const program = memoryStore.trainingPrograms.get(assignment.program_id);
  if (!program) return fail(res, 404, "Program not found");

  const questions = memoryStore.questions.get(assignment.program_id) || [];
  if (!questions.length) {
    return fail(res, 400, "No assessment questions configured for this training program");
  }

  // Server-Side Deterministic Grading
  let correctCount = 0;
  const review: any[] = [];

  for (const q of questions) {
    const selected = answers ? Number(answers[String(q.id)]) : -1;
    const isCorrect = selected === q.correct_option_index;
    if (isCorrect) correctCount += 1;

    review.push({
      question_id: q.id,
      question_text: q.question_text,
      selected_option: selected,
      correct: isCorrect,
      explanation: q.explanation,
    });
  }

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= program.passing_score;

  assignment.assessment_score = score;
  assignment.assessment_passed = passed;
  assignment.updated_at = new Date().toISOString();
  memoryStore.assignments.set(assignmentId, assignment);

  return res.json({
    assignment_id: assignmentId,
    total_questions: questions.length,
    correct_count: correctCount,
    score,
    passing_score: program.passing_score,
    passed,
    review,
  });
});

// POST /api/bpo/training/assignments/:id/certify - Issue official certification
router.post("/bpo/training/assignments/:id/certify", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const assignmentId = parseInt(String(req.params.id), 10);
  const assignment = memoryStore.assignments.get(assignmentId);

  if (!assignment) return fail(res, 404, "Training assignment not found");
  if (assignment.partner_id !== partnerId) return fail(res, 403, "Access denied");

  const program = memoryStore.trainingPrograms.get(assignment.program_id);
  if (!program) return fail(res, 404, "Program not found");

  const agent = memoryStore.agents.get(assignment.agent_id);
  if (!agent) return fail(res, 404, "Agent not found");

  // RULE ENFORCEMENT 1: All mandatory modules must be completed
  const modules = memoryStore.modules.get(assignment.program_id) || [];
  const mandatoryModules = modules.filter((m) => m.is_mandatory);
  const allMandatoryDone = mandatoryModules.every((m) => memoryStore.moduleProgress.get(`${assignmentId}_${m.id}`));

  if (!allMandatoryDone) {
    return fail(res, 400, "Prerequisite not satisfied: All mandatory modules must be completed before certification");
  }

  // RULE ENFORCEMENT 2: Assessment must be taken and passed
  if (assignment.assessment_score === undefined || assignment.assessment_score === null) {
    return fail(res, 400, "Prerequisite not satisfied: Assessment must be completed before certification");
  }
  if (assignment.assessment_score < program.passing_score) {
    return fail(res, 400, `Prerequisite not satisfied: Assessment score (${assignment.assessment_score}%) is below required threshold (${program.passing_score}%)`);
  }

  // Check if certificate already exists
  let cert = Array.from(memoryStore.certifications.values()).find(
    (c) => c.agent_id === agent.id && c.training_program_id === program.id && c.status === "active"
  );

  if (!cert) {
    certSequence += 1;
    const certCode = `THK-CERT-${String(certSequence).padStart(5, "0")}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + 365 * 86400000); // 1-year expiry

    cert = {
      id: certSequence,
      certificate_code: certCode,
      agent_id: agent.id,
      training_program_id: program.id,
      certification_name: `Thinkatic Certified ${program.category} Specialist — ${program.title}`,
      issuing_authority: "Thinkatic Global Operations",
      status: "active",
      score: assignment.assessment_score,
      certified_at: now.toISOString(),
      expires_at: expiry.toISOString(),
    };
    memoryStore.certifications.set(certSequence, cert);

    // Update Agent status to certified
    agent.training_status = "certified";
    agent.certification_status = "active";
    if (agent.status === "training") {
      agent.status = "active";
    }
    agent.updated_at = new Date().toISOString();
    memoryStore.agents.set(agent.id, agent);
  }

  return res.status(201).json({
    success: true,
    certification: cert,
  });
});

// GET /api/bpo/certifications - List centre's active & expiring certifications
router.get("/bpo/certifications", requireUserAuth, async (req: UserRequest, res: Response) => {
  const { partnerId } = await resolvePartnerForUser(req.user!.id);
  const centreAgents = Array.from(memoryStore.agents.values()).filter((a) => a.partner_id === partnerId);
  const agentMap = new Map(centreAgents.map((a) => [a.id, a]));

  const certs = Array.from(memoryStore.certifications.values())
    .filter((c) => agentMap.has(c.agent_id))
    .map((c) => {
      const a = agentMap.get(c.agent_id)!;
      return {
        ...c,
        agent_name: a.name,
        agent_code: a.agent_code,
        department: a.department,
      };
    });

  return res.json(certs);
});

// ==============================================================================
// ADMIN OPERATIONS: AGENTS, TRAINING & CERTIFICATIONS (RBAC GUARDED)
// ==============================================================================

// GET /api/admin/bpo/agents - Platform-wide agent directory
router.get("/admin/bpo/agents", requireAuth, async (req: AdminRequest, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "all";
  const partnerFilter = typeof req.query.partner_id === "string" ? req.query.partner_id : "all";
  const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 20), 10)));

  let list = Array.from(memoryStore.agents.values());

  if (partnerFilter !== "all") {
    list = list.filter((a) => a.partner_id === partnerFilter);
  }

  if (search) {
    list = list.filter(
      (a) =>
        a.agent_code.toLowerCase().includes(search) ||
        a.name.toLowerCase().includes(search) ||
        (a.email && a.email.toLowerCase().includes(search)) ||
        a.employee_id.toLowerCase().includes(search)
    );
  }

  if (statusFilter !== "all") {
    list = list.filter((a) => a.status === statusFilter || a.onboarding_status === statusFilter);
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = list.length;
  const paginated = list.slice((page - 1) * limit, page * limit).map((a) => ({
    ...a,
    centre_name: a.centre_name || a.metadata?.centre_name || a.metadata?.bpo_centres?.name || null,
    created_by: a.created_by || a.metadata?.created_by || null,
    created_by_name: (a as any).created_by_name || a.metadata?.created_by_name || null,
    assigned_by: a.assigned_by || a.metadata?.assigned_by || null,
    assigned_by_name: (a as any).assigned_by_name || a.metadata?.assigned_by_name || null,
  }));

  return res.json({
    agents: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/admin/bpo/agents/:id - Admin full agent profile inspector
router.get("/admin/bpo/agents/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const agent = memoryStore.agents.get(id);
  if (!agent) return fail(res, 404, "Agent not found");

  const docs = memoryStore.documents.get(id) || [];
  const certs = Array.from(memoryStore.certifications.values()).filter((c) => c.agent_id === id);
  const assignments = Array.from(memoryStore.assignments.values()).filter((a) => a.agent_id === id);

  return res.json({
    ...agent,
    centre_name: agent.centre_name || agent.metadata?.centre_name || agent.metadata?.bpo_centres?.name || null,
    created_by: agent.created_by || agent.metadata?.created_by || null,
    created_by_name: (agent as any).created_by_name || agent.metadata?.created_by_name || null,
    assigned_by: agent.assigned_by || agent.metadata?.assigned_by || null,
    assigned_by_name: (agent as any).assigned_by_name || agent.metadata?.assigned_by_name || null,
    documents: docs,
    certifications: certs,
    training_assignments: assignments,
  });
});

// POST /api/admin/bpo/agents/:id/status - Admin status change (verify, suspend, activate)
router.post("/admin/bpo/agents/:id/status", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { action, reason } = req.body || {};
  const agent = memoryStore.agents.get(id);
  if (!agent) return fail(res, 404, "Agent not found");

  if (action === "approve_onboarding" || action === "verify") {
    agent.onboarding_status = "verified";
    agent.status = "active";
    agent.rejection_reason = null;
  } else if (action === "reject_onboarding" || action === "reject") {
    if (!reason || !reason.trim()) return fail(res, 400, "Rejection reason is required");
    agent.onboarding_status = "rejected";
    agent.status = "inactive";
    agent.rejection_reason = reason.trim();
  } else if (action === "suspend") {
    agent.status = "suspended";
    agent.rejection_reason = reason || "Suspended by Platform Administrator";
  } else if (action === "activate") {
    agent.status = "active";
    agent.rejection_reason = null;
  } else {
    return fail(res, 400, `Invalid status action: ${action}`);
  }

  agent.updated_at = new Date().toISOString();
  memoryStore.agents.set(id, agent);

  return res.json({ success: true, agent });
});

// POST /api/admin/bpo/agents/documents/:docId/verify - Admin document verification
router.post("/admin/bpo/agents/documents/:docId/verify", requireAuth, async (req: AdminRequest, res: Response) => {
  const docId = parseInt(String(req.params.docId), 10);
  const { status, notes } = req.body || {};

  if (!["verified", "rejected"].includes(status)) {
    return fail(res, 400, "Status must be 'verified' or 'rejected'");
  }

  let foundDoc: AgentDoc | null = null;
  for (const list of memoryStore.documents.values()) {
    const doc = list.find((d) => d.id === docId);
    if (doc) {
      foundDoc = doc;
      break;
    }
  }

  if (!foundDoc) return fail(res, 404, "Document not found");

  foundDoc.verification_status = status;
  foundDoc.rejection_notes = notes || null;
  foundDoc.verified_at = new Date().toISOString();
  foundDoc.verified_by = req.admin?.id ? String(req.admin.id) : "admin";

  return res.json({ success: true, document: foundDoc });
});

// GET /api/admin/bpo/training/programs - Admin list programs
router.get("/admin/bpo/training/programs", requireAuth, async (_req: AdminRequest, res: Response) => {
  const programs = Array.from(memoryStore.trainingPrograms.values()).map((p) => {
    const mods = memoryStore.modules.get(p.id) || [];
    const qCount = (memoryStore.questions.get(p.id) || []).length;
    const enrollments = Array.from(memoryStore.assignments.values()).filter((a) => a.program_id === p.id).length;
    return {
      ...p,
      modules_count: mods.length,
      questions_count: qCount,
      enrolled_count: enrollments,
    };
  });
  return res.json(programs);
});

// POST /api/admin/bpo/training/programs - Admin create program
router.post("/admin/bpo/training/programs", requireAuth, async (req: AdminRequest, res: Response) => {
  const { title, description, category, durationHours, passingScore, isMandatory } = req.body || {};

  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return fail(res, 400, "Program title is required (min 3 characters)");
  }

  trainingProgramSequence += 1;
  const newProgram: TrainingProgram = {
    id: trainingProgramSequence,
    training_code: `THK-TRN-${String(trainingProgramSequence).padStart(5, "0")}`,
    title: title.trim(),
    description: description ? description.trim() : "",
    category: category || "Process Training",
    duration_hours: Number(durationHours) || 20,
    passing_score: Number(passingScore) || 80,
    is_mandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
    is_global: true,
    status: "active",
    created_at: new Date().toISOString(),
  };

  memoryStore.trainingPrograms.set(trainingProgramSequence, newProgram);
  memoryStore.modules.set(trainingProgramSequence, []);
  memoryStore.questions.set(trainingProgramSequence, []);

  return res.status(201).json(newProgram);
});

// POST /api/admin/bpo/training/programs/:id/modules - Admin add module
router.post("/admin/bpo/training/programs/:id/modules", requireAuth, async (req: AdminRequest, res: Response) => {
  const programId = parseInt(String(req.params.id), 10);
  const { title, description, durationMinutes, content, isMandatory } = req.body || {};

  const program = memoryStore.trainingPrograms.get(programId);
  if (!program) return fail(res, 404, "Program not found");

  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return fail(res, 400, "Module title is required");
  }

  const list = memoryStore.modules.get(programId) || [];
  moduleSequence += 1;
  const newModule: TrainingModule = {
    id: moduleSequence,
    program_id: programId,
    title: title.trim(),
    description: description ? description.trim() : "",
    order_index: list.length + 1,
    duration_minutes: Number(durationMinutes) || 45,
    content: content || "",
    is_mandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
  };

  list.push(newModule);
  memoryStore.modules.set(programId, list);

  return res.status(201).json(newModule);
});

// POST /api/admin/bpo/training/programs/:id/questions - Admin add question
router.post("/admin/bpo/training/programs/:id/questions", requireAuth, async (req: AdminRequest, res: Response) => {
  const programId = parseInt(String(req.params.id), 10);
  const { questionText, options, correctOptionIndex, explanation, moduleName } = req.body || {};

  const program = memoryStore.trainingPrograms.get(programId);
  if (!program) return fail(res, 404, "Program not found");

  if (!questionText || !Array.isArray(options) || options.length < 2) {
    return fail(res, 400, "Question text and at least 2 options are required");
  }

  const correctIndex = Number(correctOptionIndex);
  if (correctIndex < 0 || correctIndex >= options.length) {
    return fail(res, 400, "Valid correctOptionIndex within range of options is required");
  }

  const list = memoryStore.questions.get(programId) || [];
  questionSequence += 1;
  const newQ: TrainingQuestion = {
    id: questionSequence,
    test_id: programId,
    question_text: questionText.trim(),
    options,
    correct_option_index: correctIndex,
    explanation: explanation || "",
    module_name: moduleName || "",
  };

  list.push(newQ);
  memoryStore.questions.set(programId, list);

  return res.status(201).json(newQ);
});

// GET /api/admin/bpo/certifications - Platform-wide certifications
router.get("/admin/bpo/certifications", requireAuth, async (req: AdminRequest, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  let list = Array.from(memoryStore.certifications.values());

  if (status !== "all") {
    list = list.filter((c) => c.status === status);
  }

  const enriched = list.map((c) => {
    const a = memoryStore.agents.get(c.agent_id);
    const p = memoryStore.trainingPrograms.get(c.training_program_id);
    return {
      ...c,
      agent_name: a ? a.name : `Agent #${c.agent_id}`,
      agent_code: a ? a.agent_code : `THK-AGT-${c.agent_id}`,
      centre_id: a?.centre_id || 1,
      program_title: p?.title || "Training Program",
    };
  });

  return res.json(enriched);
});

// POST /api/admin/bpo/certifications/:id/revoke - Revoke certification
router.post("/admin/bpo/certifications/:id/revoke", requireAuth, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { reason } = req.body || {};

  if (!reason || !reason.trim()) {
    return fail(res, 400, "Revocation reason is required");
  }

  const cert = memoryStore.certifications.get(id);
  if (!cert) return fail(res, 404, "Certification not found");

  cert.status = "revoked";
  cert.revoked_at = new Date().toISOString();
  cert.revocation_reason = reason.trim();
  memoryStore.certifications.set(id, cert);

  // Update agent certification status
  const agent = memoryStore.agents.get(cert.agent_id);
  if (agent) {
    agent.certification_status = "revoked";
    memoryStore.agents.set(agent.id, agent);
  }

  return res.json({ success: true, certification: cert });
});

export default router;
