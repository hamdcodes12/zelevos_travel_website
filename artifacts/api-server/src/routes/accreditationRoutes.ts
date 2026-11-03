// ==============================================================================
// THINKATIC GLOBAL BPO ACCREDITATION WORKFLOW ROUTER
// Authoritative, production-grade endpoints for the complete 8-stage
// BPO Partner Accreditation Lifecycle:
// 1. APPLICATION SUBMITTED
// 2. APPLICATION UNDER REVIEW
// 3. DOCUMENTS VERIFIED (PAN, GSTIN, Versioning, Private Storage)
// 4. INFRASTRUCTURE VERIFICATION (Dual ISP, Workstations, Photos, Video)
// 5. MANAGEMENT VERIFICATION (Signatory, BPO Experience, Escalations)
// 6. TRIAL / ASSESSMENT (Scheduling, Scoring, Benchmarks)
// 7. DECISION (Executive Board Clearance)
// 8. CENTRE ACTIVATED (Strict 7-Gate Validation, Centre ID Minting)
// ==============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth, verifyToken } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  saveFile,
  createSignedUrl,
  readFile,
} from "../lib/storageService.js";

const USER_JWT_SECRET = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";

async function requireUserOrAdminAuth(req: Request & { user?: any; admin?: any }, res: Response, next: NextFunction) {
  let tokenStr: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    tokenStr = auth.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token.trim()) {
    tokenStr = req.query.token.trim();
  }

  if (!tokenStr) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  // 1. Try verifying as Admin token
  try {
    const adminPayload = verifyToken(tokenStr);
    if (adminPayload && adminPayload.id) {
      req.admin = adminPayload;
      req.user = { id: String(adminPayload.id), email: adminPayload.username, role: "admin" };
      return next();
    }
  } catch {}

  // 2. Try verifying as User token
  try {
    const userPayload = jwt.verify(tokenStr, USER_JWT_SECRET) as { id: string; email: string; role?: string; bpoStatus?: string };
    if (userPayload && userPayload.id) {
      req.user = {
        id: userPayload.id,
        email: userPayload.email,
        role: userPayload.role || "user",
        bpoStatus: userPayload.bpoStatus,
      };
      return next();
    }
  } catch {}

  return res.status(401).json({ success: false, error: "Authentication required" });
}
import {
  computeAccreditationDossier,
  validatePAN,
  validateGST,
  saveManagementVerification,
  saveInfrastructureDetails,
  adminReviewStage,
  adminVerifyDocument,
  adminScheduleOrRecordAssessment,
  adminRecordDecision,
  adminActivateCentre,
  logAccreditationEvent,
  createAccreditationNotification,
  persistAccreditationApplicationUpdate,
  inMemoryAuditLogs,
  REQUIRED_DOCUMENT_TYPES,
  type AccreditationStageId,
  type AssessmentType,
} from "../lib/accreditationService.js";
import { getApplicationForUser, resolveApplicationRecord, memoryStore } from "./partnerApplications.js";
import { sanitizeString, uploadRateLimiter, validateUploadedDocument, MAX_DOCUMENT_SIZE_BYTES } from "../lib/security.js";

const router = Router();

type UserRequest = Request & { user?: { id: string; email: string; role?: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ success: false, error: message, message, details });
}

/**
 * Helper to fetch application and its related documents and events
 */
async function fetchApplicationFull(applicationId: number) {
  let rawApp: any = await resolveApplicationRecord(applicationId);
  if (!rawApp) {
    const { data, error: appErr } = await supabase
      .from("bpo_partner_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr || !data) return null;
    rawApp = data;
  }

  let docs: any[] = [];
  try {
    const { data: dbDocs } = await supabase
      .from("bpo_application_documents")
      .select("*")
      .eq("application_id", applicationId);
    if (dbDocs && Array.isArray(dbDocs)) {
      docs = dbDocs.map((d: any) => ({
        id: d.id,
        application_id: d.application_id,
        document_type: d.document_type,
        document_name: d.file_name,
        file_name: d.file_name,
        file_url: d.file_url,
        file_size_bytes: d.file_size_bytes,
        status: d.status || "pending",
        reviewer_notes: d.reviewer_notes,
        rejection_reason: d.rejection_reason,
        verified_at: d.verified_at,
        verified_by: d.verified_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, applicationId }, "Notice querying bpo_application_documents");
  }

  if (rawApp.verification_checks?.documents && Array.isArray(rawApp.verification_checks.documents)) {
    for (const d of rawApp.verification_checks.documents) {
      const type = (d as any).document_type || (d as any).documentType || (d as any).type;
      if (type && !docs.some((existing: any) => existing.document_type === type)) {
        docs.push(d);
      }
    }
  }

  // Merge in-memory documents
  const memDocs = (memoryStore.documents?.get(applicationId) || []).map((md: any) => ({
    id: md.id,
    application_id: applicationId,
    document_type: md.document_type || md.documentType || md.type,
    document_name: md.document_name || md.name,
    file_name: md.file_name || md.fileName || md.name,
    file_url: md.file_url || md.fileUrl || md.url,
    storage_key: md.storage_key || md.storageKey,
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
        if (m.storage_key) existing.storage_key = m.storage_key;
        if (m.file_url) existing.file_url = m.file_url;
        if (m.file_name) existing.file_name = m.file_name;
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

  let events: any[] = [];
  try {
    const { data: dbEvents } = await supabase
      .from("bpo_application_events")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });
    if (dbEvents) events = dbEvents;
  } catch {}

  return {
    rawApp,
    docs,
    events,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BPO PARTNER ACCREDITATION ROUTES (Guard: requireUserAuth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/partner/applications/me/accreditation
 * Returns full authoritative 8-stage accreditation dossier for caller
 */
router.get("/partner/applications/me/accreditation", requireUserAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const userApp = await getApplicationForUser(userId);
    if (!userApp?.application) {
      return fail(res, 404, "No BPO partner application found for this account.");
    }

    const appId = Number(userApp.application.id);
    const full = await fetchApplicationFull(appId);
    if (!full) {
      return fail(res, 404, "Application data record not found.");
    }

    const dossier = await computeAccreditationDossier(full.rawApp, full.docs, full.events);
    return res.json({ success: true, dossier, ...dossier });
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error computing partner accreditation dossier");
    return fail(res, 500, "Failed to load accreditation workflow.", err.message);
  }
});

/**
 * GET /api/partner/applications/:id/accreditation
 * IDOR-protected fetch of specific application accreditation dossier
 */
router.get("/partner/applications/:id/accreditation", requireUserAuth, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  const isGlobalAdmin = req.user?.role === "admin";

  if (!appId || isNaN(appId)) {
    return fail(res, 400, "Invalid application ID.");
  }

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) {
      return fail(res, 404, "Application not found.");
    }

    if (!isGlobalAdmin && String(full.rawApp.applicant_user_id) !== String(userId)) {
      return fail(res, 403, "Access denied: You can only view your own application accreditation.");
    }

    const dossier = await computeAccreditationDossier(full.rawApp, full.docs, full.events);
    return res.json({ success: true, dossier, ...dossier });
  } catch (err: any) {
    logger.error({ error: err.message, appId }, "Error loading application accreditation");
    return fail(res, 500, "Failed to load application accreditation.", err.message);
  }
});

async function handleSaveManagement(req: UserRequest, res: Response) {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  const body = req.body || {};

  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

  const authorizedSignatory = sanitizeString(body.authorizedSignatory || body.ownerName || "");
  const designation = sanitizeString(body.designation || "Director");
  const operationalExperience = sanitizeString(body.operationalExperience || body.relevantBpoExperience || "");
  const managementContactPhone = sanitizeString(body.managementContactPhone || body.managementContact || body.phone || "+91 9999999999");
  const managementContactEmail = sanitizeString(body.managementContactEmail || body.email || req.user?.email || "mgmt@thinkatic.com");
  const escalationContact = sanitizeString(body.escalationContact || body.managementContactEmail || "");

  if (!authorizedSignatory || !designation) {
    return fail(res, 400, "Authorized signatory name and designation are mandatory.");
  }

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) return fail(res, 404, "Application not found.");

    if (String(full.rawApp.applicant_user_id) !== String(userId) && req.user?.role !== "admin") {
      return fail(res, 403, "Unauthorized access.");
    }

    const result = await saveManagementVerification(
      appId,
      {
        authorizedSignatory,
        directorName: sanitizeString(body.directorName || authorizedSignatory),
        designation,
        totalExperienceYears: Math.max(0, parseInt(String(body.totalExperienceYears || body.experienceYears || "5"), 10)),
        bpoExperienceYears: Math.max(0, parseInt(String(body.bpoExperienceYears || "3"), 10)),
        operationalExperience,
        managementContactPhone,
        managementContactEmail,
        companyBackground: sanitizeString(body.companyBackground || ""),
        workforceCapability: sanitizeString(body.workforceCapability || ""),
        escalationContact,
      },
      userId,
      req.user?.email
    );

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to update management information.");
    }

    return res.json({ success: true, message: "Management verification details saved." });
  } catch (err: any) {
    return fail(res, 500, "Failed to save management profile.", err.message);
  }
}

router.post("/partner/applications/:id/management", requireUserAuth, handleSaveManagement);
router.put("/partner/applications/:id/management", requireUserAuth, handleSaveManagement);

async function handleSaveInfrastructure(req: UserRequest, res: Response) {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  const body = req.body || {};

  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

  const primaryIsp = sanitizeString(body.primaryIsp || "");
  const backupIsp = sanitizeString(body.backupIsp || body.secondaryIsp || "");
  const bandwidthMbps = Math.max(1, parseInt(String(body.bandwidthMbps || (body.bandwidth ? String(body.bandwidth).replace(/[^0-9]/g, "") : "100") || "100"), 10));
  const powerBackup = sanitizeString(body.powerBackup || "");
  const computers = Math.max(1, parseInt(String(body.computers || body.workstationsCount || "20"), 10));
  const headsets = Math.max(1, parseInt(String(body.headsets || body.workstationsCount || "20"), 10));

  if (!primaryIsp || !backupIsp || !powerBackup) {
    return fail(res, 400, "Primary ISP, Secondary/Backup ISP, and Power Backup specifications are mandatory.");
  }

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) return fail(res, 404, "Application not found.");

    if (String(full.rawApp.applicant_user_id) !== String(userId) && req.user?.role !== "admin") {
      return fail(res, 403, "Unauthorized access.");
    }

    const result = await saveInfrastructureDetails(
      appId,
      {
        primaryIsp,
        backupIsp,
        bandwidthMbps,
        powerBackup,
        computers,
        headsets,
        cctv: body.cctv !== undefined ? Boolean(body.cctv) : true,
        accessControl: body.accessControl !== undefined ? Boolean(body.accessControl) : true,
        dialerPlatform: sanitizeString(body.dialerPlatform || "Vicidial"),
        crmSoftware: sanitizeString(body.crmSoftware || "Custom CRM"),
        serverInfrastructure: sanitizeString(body.serverInfrastructure || "On-premise Rack & Hybrid Cloud"),
      },
      userId,
      req.user?.email
    );

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to update infrastructure specifications.");
    }

    return res.json({ success: true, message: "Infrastructure specifications saved." });
  } catch (err: any) {
    return fail(res, 500, "Failed to save infrastructure specifications.", err.message);
  }
}

router.post("/partner/applications/:id/infrastructure", requireUserAuth, handleSaveInfrastructure);
router.put("/partner/applications/:id/infrastructure", requireUserAuth, handleSaveInfrastructure);

/**
 * POST /api/partner/applications/:id/documents
 * Partner uploads compliance document to private Supabase Storage
 */
router.post("/partner/applications/:id/documents", requireUserAuth, uploadRateLimiter, async (req: UserRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  const body = req.body || {};

  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

  const { documentType, fileName, fileData, mimeType, panNumber, gstNumber, gstApplicable, gstExemptionReason, fileSizeBytes, file_size_bytes } = body;

  if (!documentType || !fileName || !fileData) {
    return fail(res, 400, "documentType, fileName, and fileData (base64) are required.");
  }

  // Normalize aliases to canonical document types
  let rawDocType = String(documentType || "").trim();
  if (rawDocType === "centre_photos") rawDocType = "centre_floor_plan";
  if (rawDocType === "infrastructure_sla") rawDocType = "isp_sla";
  if (rawDocType === "company_deck") rawDocType = "company_profile";

  // Validate documentType against known checklist
  const docConfig = REQUIRED_DOCUMENT_TYPES.find((c) => c.id === rawDocType);
  if (!docConfig) {
    return fail(res, 400, `Invalid documentType: ${documentType}`);
  }

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) return fail(res, 404, "Application not found.");

    if (String(full.rawApp.applicant_user_id) !== String(userId) && req.user?.role !== "admin") {
      return fail(res, 403, "You are not authorized to upload this document.");
    }

    // Convert base64 data to buffer
    let buffer: Buffer;
    if (fileData.includes(",")) {
      buffer = Buffer.from(fileData.split(",")[1], "base64");
    } else {
      buffer = Buffer.from(fileData, "base64");
    }

    const declaredSize = typeof fileSizeBytes === "number" ? fileSizeBytes : (typeof file_size_bytes === "number" ? file_size_bytes : 0);
    const effectiveSize = Math.max(declaredSize, buffer.length);

    // Validate size and format: INDEPENDENT 25 MB (25 * 1024 * 1024 bytes) LIMIT PER SLOT
    const validation = validateUploadedDocument(fileName, mimeType, effectiveSize, buffer);
    if (!validation.valid) {
      return fail(res, 400, validation.error || "This document exceeds the 25 MB limit.");
    }

    // PAN Validation ONLY IF non-empty panNumber was explicitly supplied
    if (panNumber && typeof panNumber === "string" && panNumber.trim().length > 0) {
      const cleanPan = panNumber.trim().toUpperCase();
      const panRes = validatePAN(cleanPan);
      if (!panRes.valid) {
        return fail(res, 400, panRes.error || "Invalid PAN Card format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F).");
      }

      // Update PAN in company data
      const updatedCd = { ...full.rawApp.company_data, panNumber: cleanPan, pan: cleanPan };
      await supabase
        .from("bpo_partner_applications")
        .update({ company_data: updatedCd })
        .eq("id", appId);
    }

    // GST Validation ONLY IF non-empty gstNumber was explicitly supplied
    if (gstNumber && typeof gstNumber === "string" && gstNumber.trim().length > 0) {
      const isApplicable = gstApplicable !== undefined ? Boolean(gstApplicable) : Boolean(full.rawApp.company_data?.gstApplicable);
      const cleanGst = gstNumber.trim().toUpperCase();
      const gstRes = validateGST(cleanGst, isApplicable, gstExemptionReason || full.rawApp.company_data?.gstExemptionReason);
      if (!gstRes.valid) {
        return fail(res, 400, gstRes.error || "Invalid GSTIN format.");
      }

      const updatedCd = {
        ...full.rawApp.company_data,
        gstApplicable: isApplicable,
        gstNumber: cleanGst,
        gst: cleanGst,
        gstExemptionReason: isApplicable ? null : (gstExemptionReason || full.rawApp.company_data?.gstExemptionReason || "Turnover below statutory threshold"),
      };
      await supabase
        .from("bpo_partner_applications")
        .update({ company_data: updatedCd })
        .eq("id", appId);
    }

    // Safe sanitized file name and relative key
    const sanitizedFileName = (validation.sanitizedFileName || sanitizeString(fileName)).replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}_${sanitizedFileName}`;
    const relativeKey = `app_${appId}/${rawDocType}/${uniqueFileName}`;

    // Upload to Supabase private storage via storageService
    const mime = mimeType || "application/pdf";
    let saveRes: any;
    try {
      saveRes = await saveFile("documents", relativeKey, buffer, mime);
    } catch (storageErr: any) {
      logger.error({ error: storageErr.message, appId, rawDocType }, "Storage error saving document to Supabase Storage");
      return fail(res, 503, "Document storage is temporarily unavailable. Please try again.");
    }

    // Calculate version number: increment previous highest version for this rawDocType
    const existingDocsForType = full.docs.filter((d: any) => d.document_type === rawDocType);
    const maxVersion = existingDocsForType.reduce((max: number, d: any) => Math.max(max, Number(d.version || 1)), 0);
    const nextVersion = maxVersion + 1;

    // Supersede older active documents of this type
    for (const d of existingDocsForType) {
      if (d.status === "pending" || d.status === "rejected" || d.status === "resubmission_required") {
        d.status = "superseded";
      }
    }

    const now = new Date().toISOString();
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullDocRecord: any = {
      id: docId,
      application_id: appId,
      document_type: rawDocType,
      document_name: docConfig.name,
      file_name: sanitizedFileName,
      file_url: `/api/partner/applications/${appId}/documents/${docId}/download`,
      storage_key: saveRes.storageKey,
      file_size: buffer.length,
      file_size_bytes: buffer.length,
      mime_type: mime,
      version: nextVersion,
      status: "pending",
      uploaded_by: userId,
      created_at: now,
      updated_at: now,
    };

    // Keep memoryStore documents updated
    let currentAppDocs = memoryStore.documents.get(appId) || [];
    const existingIndex = currentAppDocs.findIndex((d: any) => (d.document_type || d.documentType) === rawDocType);
    if (existingIndex >= 0) {
      currentAppDocs[existingIndex] = fullDocRecord;
    } else {
      currentAppDocs.push(fullDocRecord);
    }
    memoryStore.documents.set(appId, currentAppDocs);

    // Persist to bpo_application_documents table
    try {
      await supabase.from("bpo_application_documents").insert({
        application_id: appId,
        document_type: rawDocType,
        file_name: sanitizedFileName,
        file_url: fullDocRecord.file_url,
        status: "pending",
        created_at: now,
      });
    } catch (dbErr: any) {
      logger.warn({ error: dbErr.message }, "Notice inserting into bpo_application_documents");
    }

    // Persist to bpo_partner_applications.verification_checks.documents
    try {
      const checks = full.rawApp.verification_checks || {};
      checks.documents = currentAppDocs;
      await persistAccreditationApplicationUpdate(appId, {
        verification_checks: checks,
        updated_at: now,
      });
    } catch {}

    const insertedDoc: any = fullDocRecord;

    await logAccreditationEvent({
      applicationId: appId,
      action: "DOCUMENT_UPLOADED",
      stage: "documents_verified",
      note: `Uploaded ${docConfig.name} (v${nextVersion}, ${Math.round(buffer.length / 1024)} KB)`,
      actorUserId: userId,
      actorName: req.user?.email,
      details: {
        docId: insertedDoc.id,
        documentType: rawDocType,
        version: nextVersion,
        fileName: sanitizedFileName,
      },
    });

    return res.json({
      success: true,
      message: `${docConfig.name} uploaded successfully.`,
      document: insertedDoc,
    });
  } catch (err: any) {
    logger.error({ error: err.message, appId }, "Exception uploading document");
    return fail(res, 500, "Upload failed. Please try again.", err.message);
  }
});

/**
 * Helper to resolve an application document by:
 * 1. String UUID/docId
 * 2. Database numerical id (bpo_application_documents.id)
 * 3. Document type (e.g. pan_card, gst_certificate)
 * 4. File name
 * 5. Storage key suffix
 */
async function resolveApplicationDocument(appId: number, docParam: string, full: any): Promise<any> {
  const cleanParam = String(docParam || "").trim();
  if (!cleanParam) return null;

  const fullList = [
    ...(full?.docs || []),
    ...(memoryStore.documents?.get(appId) || []),
  ];

  // 1. Direct match by id, document_type, file_name, or storage_key
  let doc = fullList.find((d: any) =>
    String(d.id) === cleanParam ||
    d.document_type === cleanParam ||
    d.documentType === cleanParam ||
    d.file_name === cleanParam ||
    (d.storage_key && d.storage_key.endsWith(cleanParam))
  );

  // 2. If cleanParam is numeric (e.g. bpo_application_documents.id), check database
  if (!doc && /^\d+$/.test(cleanParam)) {
    try {
      const { data: dbDoc } = await supabase
        .from("bpo_application_documents")
        .select("*")
        .eq("application_id", appId)
        .eq("id", parseInt(cleanParam, 10))
        .maybeSingle();

      if (dbDoc) {
        doc = fullList.find((d: any) =>
          d.document_type === dbDoc.document_type ||
          d.file_name === dbDoc.file_name
        );
        if (!doc) {
          doc = {
            id: dbDoc.id,
            application_id: appId,
            document_type: dbDoc.document_type,
            file_name: dbDoc.file_name,
            file_url: dbDoc.file_url,
            status: dbDoc.status,
            storage_key: `app_${appId}/${dbDoc.document_type}/${dbDoc.file_name}`,
          };
        }
      }
    } catch {}
  }

  // 3. Fallback search by document_type in bpo_application_documents
  if (!doc) {
    try {
      const { data: dbDoc } = await supabase
        .from("bpo_application_documents")
        .select("*")
        .eq("application_id", appId)
        .eq("document_type", cleanParam)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbDoc) {
        doc = {
          id: dbDoc.id,
          application_id: appId,
          document_type: dbDoc.document_type,
          file_name: dbDoc.file_name,
          file_url: dbDoc.file_url,
          status: dbDoc.status,
          storage_key: `app_${appId}/${dbDoc.document_type}/${dbDoc.file_name}`,
        };
      }
    } catch {}
  }

  return doc;
}

async function handleDocumentDownload(appId: number, docParam: string, full: any, res: Response) {
  const doc = await resolveApplicationDocument(appId, docParam, full);
  if (!doc) return fail(res, 404, "Document not found.");

  if (doc.file_url && doc.file_url.startsWith("data:")) {
    const matches = doc.file_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const type = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      res.setHeader("Content-Type", type);
      res.setHeader("Content-Disposition", `inline; filename="${doc.file_name}"`);
      return res.send(buffer);
    }
  }

  let cleanKey = (doc.storage_key || "").replace(/^(thinkatic-)?documents\//, "");
  if (!cleanKey) {
    cleanKey = `app_${appId}/${doc.document_type}/${doc.file_name}`;
  }

  try {
    const signedUrl = await createSignedUrl("documents", cleanKey, 3600);
    return res.redirect(signedUrl);
  } catch (signErr) {
    // If exact storage key wasn't found, try searching the storage folder for matching file in Supabase
    try {
      const folder = `app_${appId}/${doc.document_type}`;
      const { data: listData } = await supabase.storage.from("thinkatic-documents").list(folder);
      if (listData && listData.length > 0) {
        const matched = listData.find((f: any) => f.name.endsWith(doc.file_name) || f.name === doc.file_name) || listData[listData.length - 1];
        if (matched) {
          const fallbackKey = `${folder}/${matched.name}`;
          const fallbackUrl = await createSignedUrl("documents", fallbackKey, 3600);
          return res.redirect(fallbackUrl);
        }
      }
    } catch {}

    // Check disk / local cache fallback
    try {
      const fileBuf = await readFile("documents", cleanKey);
      if (fileBuf && fileBuf.length > 0) {
        const ext = (doc.file_name || "").split(".").pop()?.toLowerCase();
        const contentType = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : (ext === "jpg" || ext === "jpeg") ? "image/jpeg" : "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename="${doc.file_name}"`);
        return res.send(fileBuf);
      }
    } catch {}

    if (doc.file_url && doc.file_url.startsWith("http")) {
      return res.redirect(doc.file_url);
    }
    return fail(res, 404, "Document storage file not found.");
  }
}

/**
 * GET /api/partner/applications/:id/documents/:docId/download
 * Dual-auth endpoint (Admin or Applicant): generates short-lived signed URL for private Supabase Storage document
 */
router.get("/partner/applications/:id/documents/:docId/download", requireUserOrAdminAuth, async (req: any, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const docId = String(req.params.docId || "");
  const userId = req.user?.id;
  const isGlobalAdmin = req.admin || req.user?.role === "admin";

  if (!appId || !docId) return fail(res, 400, "Invalid application or document ID.");

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) return fail(res, 404, "Application not found.");

    if (!isGlobalAdmin && String(full.rawApp.applicant_user_id) !== String(userId)) {
      return fail(res, 403, "Access denied: Unauthorized to download this document.");
    }

    return await handleDocumentDownload(appId, docId, full, res);
  } catch (err: any) {
    return fail(res, 500, "Failed to generate download URL.", err.message);
  }
});

/**
 * GET /api/partner/applications/:id/documents/download/:fileName
 * Dual-auth alternate download route matching legacy file_url pattern
 */
router.get("/partner/applications/:id/documents/download/:fileName", requireUserOrAdminAuth, async (req: any, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  const fileName = String(req.params.fileName || "");
  const userId = req.user?.id;
  const isGlobalAdmin = req.admin || req.user?.role === "admin";

  if (!appId || !fileName) return fail(res, 400, "Invalid application or document filename.");

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) return fail(res, 404, "Application not found.");

    if (!isGlobalAdmin && String(full.rawApp.applicant_user_id) !== String(userId)) {
      return fail(res, 403, "Access denied: Unauthorized to download this document.");
    }

    return await handleDocumentDownload(appId, fileName, full, res);
  } catch (err: any) {
    return fail(res, 500, "Failed to generate download URL.", err.message);
  }
});

/**
 * GET /admin/accreditation/applications/:id/documents/:docId/download
 * Admin document download using signed Supabase URL
 */
router.get(
  [
    "/admin/accreditation/applications/:id/documents/:docId/download",
    "/admin/partner-applications/:id/documents/:docId/download",
  ],
  requireUserOrAdminAuth,
  async (req: any, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const docId = String(req.params.docId || "");

    if (!appId || !docId) return fail(res, 400, "Invalid application or document ID.");

    try {
      const full = await fetchApplicationFull(appId);
      if (!full) return fail(res, 404, "Application not found.");

      return await handleDocumentDownload(appId, docId, full, res);
    } catch (err: any) {
      return fail(res, 500, "Failed to generate download URL.", err.message);
    }
  }
);

/**
 * POST /api/partner/applications/:id/submit-final (and /submit-accreditation)
 * Submits complete accreditation dossier for final Admin review and executive clearance
 */
router.post(
  ["/partner/applications/:id/submit-final", "/partner/applications/:id/submit-accreditation"],
  requireUserAuth,
  async (req: UserRequest, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const userId = req.user!.id;

    if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

    try {
      const full = await fetchApplicationFull(appId);
      if (!full) return fail(res, 404, "Application not found.");

      if (String(full.rawApp.applicant_user_id) !== String(userId) && req.user?.role !== "admin") {
        return fail(res, 403, "Access denied: You can only submit your own application.");
      }

      const dossier = await computeAccreditationDossier(full.rawApp, full.docs, full.events);

      if (!dossier.readiness?.isReadyForFinalSubmission) {
        const missingList = dossier.readiness?.missingRequirements || [];
        return fail(
          res,
          400,
          `Cannot submit for final review. The following requirements are still missing:\n- ${missingList.join("\n- ")}`,
          { missingRequirements: missingList }
        );
      }

      const now = new Date().toISOString();
      const checks = full.rawApp.verification_checks || {};
      checks.final_submission = {
        submittedAt: now,
        submittedBy: req.user?.email || userId,
        status: "FINAL_REVIEW_PENDING",
      };

      const persistRes = await persistAccreditationApplicationUpdate(appId, {
        status: "final_review_pending",
        current_stage: "decision",
        verification_checks: checks,
        updated_at: now,
      });

      if (!persistRes.success) {
        return fail(res, 400, persistRes.error || "Failed to submit accreditation.");
      }

      const memApp = await resolveApplicationRecord(appId);
      if (memApp) {
        memApp.status = "final_review_pending";
        memApp.current_stage = "decision";
        memApp.updated_at = now;
      }

      await logAccreditationEvent({
        applicationId: appId,
        action: "FINAL_ACCREDITATION_SUBMITTED",
        stage: "decision",
        fromStatus: full.rawApp.status,
        toStatus: "final_review_pending",
        note: "Partner completed all required evidence and submitted for final Thinkatic Operations executive review.",
        actorUserId: userId,
        actorName: req.user?.email,
        details: {
          submittedAt: now,
          documentsCount: dossier.documents.uploadedCount,
          photosCount: dossier.officeVerification.photosUploadedCount,
          videoComplete: dossier.officeVerification.videoComplete,
        },
      });

      await createAccreditationNotification(
        userId,
        "Submitted for Final Accreditation Review",
        "Your accreditation dossier has been submitted and is currently locked for Thinkatic Operations executive review.",
        String(appId)
      );

      return res.json({
        success: true,
        message: "Accreditation submitted for final review.",
        status: "final_review_pending",
      });
    } catch (err: any) {
      return fail(res, 500, "Failed to submit final accreditation.", err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ACCREDITATION CONTROL CENTRE ROUTES (Guard: requireAuth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/accreditation/summary
 * Returns KPI metrics across all 8 accreditation stages
 */
router.get("/admin/accreditation/summary", requireAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { data: apps, error } = await supabase
      .from("bpo_partner_applications")
      .select("id, status, current_stage, created_at, reviewed_at");

    if (error) throw error;

    const list = apps || [];
    const counts = {
      total: list.length,
      applicationsTotal: list.length,
      under_review: list.filter((a: any) => a.status === "under_review" || a.status === "submitted").length,
      underReview: list.filter((a: any) => a.status === "under_review" || a.status === "submitted").length,
      awaiting_documents: list.filter((a: any) => a.status === "documents_required").length,
      awaitingDocuments: list.filter((a: any) => a.status === "documents_required").length,
      infrastructure_pending: list.filter((a: any) => a.status !== "approved" && a.status !== "rejected").length,
      infrastructurePending: list.filter((a: any) => a.status !== "approved" && a.status !== "rejected").length,
      assessments_pending: list.filter((a: any) => a.status === "under_review").length,
      assessmentsPending: list.filter((a: any) => a.status === "under_review").length,
      decisions_pending: list.filter((a: any) => a.status === "under_review").length,
      decisionsPending: list.filter((a: any) => a.status === "under_review").length,
      activated_centres: list.filter((a: any) => a.status === "approved").length,
      activatedCentres: list.filter((a: any) => a.status === "approved").length,
      resubmissions: list.filter((a: any) => a.status === "documents_required" || a.status === "action_required").length,
    };

    return res.json({
      success: true,
      totalApplications: list.length,
      total: list.length,
      underReview: counts.underReview,
      under_review: counts.under_review,
      awaitingDocuments: counts.awaitingDocuments,
      awaiting_documents: counts.awaiting_documents,
      infrastructurePending: counts.infrastructurePending,
      infrastructure_pending: counts.infrastructure_pending,
      assessmentsPending: counts.assessmentsPending,
      assessments_pending: counts.assessments_pending,
      decisionsPending: counts.decisionsPending,
      decisions_pending: counts.decisions_pending,
      activatedCentres: counts.activatedCentres,
      activated_centres: counts.activated_centres,
      resubmissions: counts.resubmissions,
      counts,
    });
  } catch (err: any) {
    return fail(res, 500, "Failed to load accreditation summary.", err.message);
  }
});

/**
 * GET /api/admin/accreditation/applications/:id
 * Admin workspace dossier for any application ID
 */
router.get("/admin/accreditation/applications/:id", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

  try {
    const full = await fetchApplicationFull(appId);
    if (!full) return fail(res, 404, "Application not found.");

    const dossier = await computeAccreditationDossier(full.rawApp, full.docs, full.events);
    return res.json({ success: true, dossier });
  } catch (err: any) {
    return fail(res, 500, "Failed to load application accreditation.", err.message);
  }
});

/**
 * POST /api/admin/accreditation/applications/:id/stage/:stageId or /review-stage
 * Admin reviews a stage (APPROVE, REJECT, REQUEST_CHANGES)
 */
router.post(
  [
    "/admin/accreditation/applications/:id/stage/:stageId",
    "/admin/accreditation/applications/:id/stages/:stageId",
    "/admin/accreditation/applications/:id/stage/:stageId/verify",
    "/admin/accreditation/applications/:id/stages/:stageId/verify",
    "/admin/accreditation/applications/:id/review-stage",
  ],
  requireAuth,
  async (req: AdminRequest, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const rawStage = String(req.params.stageId || req.body?.stageKey || req.body?.stageId || "").trim();
    const stageId = rawStage.toLowerCase() as AccreditationStageId;
    const adminId = req.admin?.id;
    const adminName = req.admin?.username || `Admin #${adminId || 1}`;
    let action = ((req.body?.action || req.body?.status || "APPROVE") as string).toUpperCase();
    if (action === "VERIFY" || action === "VERIFIED") action = "APPROVE";
    const notes = sanitizeString(req.body?.notes || req.body?.reviewerNotes || "");
    const rejectionReason = sanitizeString(req.body?.rejectionReason || "");

    if (!appId || !stageId) return fail(res, 400, "Invalid parameters.");
    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
      return fail(res, 400, "Action must be APPROVE, REJECT, or REQUEST_CHANGES.");
    }

    const result = await adminReviewStage({
      applicationId: appId,
      stageId,
      action: action as "APPROVE" | "REJECT" | "REQUEST_CHANGES",
      notes,
      rejectionReason,
      adminId,
      adminName,
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to update stage review.");
    }

    return res.json({ success: true, message: `Stage ${stageId} marked as ${action}.` });
  }
);

/**
 * POST /api/admin/accreditation/applications/:id/documents/:docId/verify
 * Admin verifies or rejects a document
 */
router.post(
  [
    "/admin/accreditation/applications/:id/documents/:docId/verify",
    "/admin/partner-applications/:id/documents/:docId/verify",
  ],
  requireAuth,
  async (req: AdminRequest, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const docParam = String(req.params.docId || "");
    const adminId = req.admin?.id;
    const adminName = req.admin?.username;
    const bodyAction = req.body?.action;
    const bodyStatus = req.body?.status;
    const action = (bodyAction || (bodyStatus === "VERIFIED" ? "VERIFY" : bodyStatus === "REJECTED" ? "REJECT" : "VERIFY")).toUpperCase() as "VERIFY" | "REJECT";
    const notes = sanitizeString(req.body?.notes || "");
    const rejectionReason = sanitizeString(req.body?.rejectionReason || "");

    if (!appId || !docParam) return fail(res, 400, "Invalid application or document ID.");
    if (!["VERIFY", "REJECT"].includes(action)) {
      return fail(res, 400, "Action must be VERIFY or REJECT.");
    }

    const result = await adminVerifyDocument({
      applicationId: appId,
      docIdOrType: docParam,
      action,
      notes,
      rejectionReason,
      adminId,
      adminName,
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to verify document.");
    }

    return res.json({ success: true, message: `Document ${docParam} ${action === "VERIFY" ? "verified" : "rejected"}.` });
  }
);

/**
 * POST /api/admin/accreditation/applications/:id/assessments (and aliases)
 * Admin schedules or records frontline trial assessment
 */
router.post(
  [
    "/admin/accreditation/applications/:id/assessments",
    "/admin/accreditation/applications/:id/assessment",
    "/admin/accreditation/applications/:id/assessments/schedule",
    "/admin/accreditation/applications/:id/assessments/:assessmentId/result",
    "/admin/accreditation/applications/:id/assessments/:assessmentId",
  ],
  requireAuth,
  async (req: AdminRequest, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const assessmentId = req.params.assessmentId || req.body?.assessmentId;
    const adminId = req.admin?.id;
    const adminName = req.admin?.username;
    const body = req.body || {};

    if (!appId) return fail(res, 400, "Invalid application ID.");

    const assessmentType = (body.assessmentType || "Technical Test") as AssessmentType;
    const scheduledDate = sanitizeString(body.scheduledDate || new Date().toISOString().split("T")[0]);
    const status = body.status || "SCHEDULED";
    const score = body.score !== undefined ? Number(body.score) : body.actualScore !== undefined ? Number(body.actualScore) : undefined;
    const resultNotes = sanitizeString(body.resultNotes || body.assessorFeedback || body.notes || "");

    const result = await adminScheduleOrRecordAssessment({
      applicationId: appId,
      assessmentId,
      assessmentType,
      scheduledDate,
      startTime: sanitizeString(body.startTime || "10:00 AM"),
      endTime: sanitizeString(body.endTime || "12:00 PM"),
      assessorName: sanitizeString(body.assessorName || body.assessor || adminName || "Operations Lead"),
      requiredAgents: parseInt(String(body.requiredAgents || body.candidateCount || "5"), 10),
      testScope: sanitizeString(body.testScope || body.targetProcess || body.projectName || ""),
      technicalRequirements: sanitizeString(body.technicalRequirements || ""),
      notes: sanitizeString(body.notes || ""),
      status,
      score,
      resultNotes,
      resubmissionAllowed: body.resubmissionAllowed !== undefined ? Boolean(body.resubmissionAllowed) : true,
      adminId,
      adminName,
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to save assessment.");
    }

    return res.json({ success: true, message: "Assessment record saved.", assessment: result.assessment });
  }
);

/**
 * POST /api/admin/accreditation/applications/:id/decision
 * Admin executive board records final accreditation decision
 */
router.post(
  "/admin/accreditation/applications/:id/decision",
  requireAuth,
  async (req: AdminRequest, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const adminId = req.admin?.id;
    const adminName = req.admin?.username;
    const { decision } = req.body || {};
    const notesText = sanitizeString(req.body?.decisionNotes || req.body?.notes || "");

    if (!appId) return fail(res, 400, "Invalid application ID.");
    if (!["APPROVE", "REJECT", "REQUEST_REASSESSMENT", "REQUEST_CHANGES"].includes(decision)) {
      return fail(res, 400, "Decision must be APPROVE, REJECT, REQUEST_REASSESSMENT, or REQUEST_CHANGES.");
    }

    const result = await adminRecordDecision({
      applicationId: appId,
      decision,
      notes: notesText,
      adminId,
      adminName,
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to record executive decision.");
    }

    return res.json({
      success: true,
      message: `Executive decision recorded: ${decision}.`,
      decision: {
        decision,
        status: decision,
        notes: notesText,
        decisionMaker: adminName || `Admin #${adminId || 1}`,
        date: new Date().toISOString(),
      },
    });
  }
);

/**
 * POST /api/admin/accreditation/applications/:id/activate or /activate-centre
 * Server-side gate check of all 7 prior stages, mints Centre ID, and activates centre
 */
router.post(
  ["/admin/accreditation/applications/:id/activate", "/admin/accreditation/applications/:id/activate-centre"],
  requireAuth,
  async (req: AdminRequest, res: Response) => {
    const appId = parseInt(String(req.params.id), 10);
    const adminId = req.admin?.id;
    const adminName = req.admin?.username;
    const { activationReason } = req.body || {};

    if (!appId) return fail(res, 400, "Invalid application ID.");

    const result = await adminActivateCentre({
      applicationId: appId,
      adminId,
      adminName,
      activationReason: sanitizeString(activationReason || ""),
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to activate centre.");
    }

    return res.json({
      success: true,
      message: "Centre successfully activated. Portal and marketplace dispatch enabled.",
      centreId: result.centreId,
    });
  }
);

/**
 * GET /api/admin/accreditation/applications/:id/audit-logs
 * Retrieves full chronological audit history for application
 */
router.get("/admin/accreditation/applications/:id/audit-logs", requireAuth, async (req: AdminRequest, res: Response) => {
  const appId = parseInt(String(req.params.id), 10);
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

  try {
    const full = await fetchApplicationFull(appId);
    const dossier = full ? await computeAccreditationDossier(full.rawApp, full.docs, full.events) : null;

    let events: any[] = [];
    try {
      const { data: dbEvents } = await supabase
        .from("bpo_application_events")
        .select("*")
        .eq("application_id", appId)
        .order("created_at", { ascending: false });
      if (dbEvents) events = dbEvents;
    } catch {}

    let auditRows: any[] = [];
    try {
      const { data: dbAudit } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_id", String(appId))
        .order("created_at", { ascending: false });
      if (dbAudit) auditRows = dbAudit;
    } catch {}

    const memoryAuditEvents = inMemoryAuditLogs.get(appId) || [];
    const timelineEvents = ((memoryStore as any).timeline?.get(appId) || []).map((t: any, idx: number) => ({
      id: 2000 + idx,
      applicationId: appId,
      action: t.action || t.stage || "TIMELINE_EVENT",
      stage: t.stage || null,
      note: t.notes || t.note || "Event recorded",
      actorName: t.actorName || (t.actorId ? `User #${t.actorId}` : "System"),
      createdAt: t.createdAt || new Date().toISOString(),
    }));

    const combined: any[] = [];
    const seen = new Set<string>();

    for (const item of [
      ...memoryAuditEvents,
      ...(events || []).map((e: any) => ({
        id: e.id,
        applicationId: e.application_id,
        action: e.event_type,
        stage: e.stage,
        note: e.note,
        actorName: e.actor_admin_id ? `Admin #${e.actor_admin_id}` : e.actor_user_id ? `User #${e.actor_user_id}` : "System",
        createdAt: e.created_at,
      })),
      ...(auditRows || []).map((a: any) => ({
        id: a.id,
        applicationId: appId,
        action: a.action,
        stage: a.metadata?.stage,
        note: a.metadata?.note || a.action,
        actorName: a.metadata?.actorName || (a.actor_admin_id ? `Admin #${a.actor_admin_id}` : "Admin"),
        createdAt: a.created_at,
      })),
      ...timelineEvents,
      ...(dossier?.auditHistory || []).map((ah: any) => ({
        id: ah.id,
        applicationId: appId,
        action: ah.action,
        stage: null,
        note: ah.note,
        actorName: ah.actorName,
        createdAt: ah.createdAt,
      })),
    ]) {
      const key = `${item.action}_${item.note}_${item.createdAt?.slice(0, 19)}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    return res.json({
      success: true,
      auditLogs: combined,
      count: combined.length,
    });
  } catch (err: any) {
    return fail(res, 500, "Failed to load audit logs.", err.message);
  }
});

export default router;
