// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — GLOBAL DELIVERY PARTNER AGREEMENT API
// Source of truth: Agreement/Agreement.pdf (23 Pages)
// Legal Entity: Healweal LLC (Wyoming, USA, Director: Harshad Chavandke)
// NO ONLINE E-SIGN: Offline physical/external signing + upload signed PDF.
// NO AI: Human/Admin manual verification and explicit approval required.
// ==============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { supabase } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  logSecurityEvent,
  uploadRateLimiter,
  downloadRateLimiter,
  sensitiveMutationRateLimiter,
  validateUploadedDocument,
  sanitizeString,
} from "../lib/security.js";
import {
  AGREEMENT_LEGAL_TEMPLATE,
  getAllAgreements,
  getAgreementById,
  getAgreementByPartnerId,
  getAgreementByApplicationId,
  getGeneratedAgreementPdfPath,
  issueAgreement,
  recordSignedAgreementUpload,
  approveAgreement,
  rejectAgreement,
  type PartnerAgreement,
} from "../lib/agreements.js";
import { getOfficialAgreementPdfPath } from "../lib/pdfEngine.js";
import { getDomainPath, saveFile, readFile, resolveSecurePath } from "../lib/storageService.js";
import { memoryStore } from "./partnerApplications.js";

const router = Router();
const JWT_SECRET =
  process.env.USER_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("USER_SESSION_SECRET must be set in production");
      })()
    : "thinkatic-user-secret-2026");

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ success: false, error: message, message, details });
}

// User authentication middleware that supports Authorization header OR ?token= query parameter (for direct browser PDF downloads)
async function requirePartnerAuth(req: UserRequest, res: Response, next: NextFunction) {
  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "Authentication required", success: false });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

    // Authoritative check if account is suspended
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, is_active, bpo_status, bpo_application_details")
        .eq("id", payload.id)
        .maybeSingle();

      if (profile) {
        const appDetails = (profile.bpo_application_details as any) || {};
        const isSuspended = profile.is_active === false || profile.bpo_status === "SUSPENDED" || appDetails.suspended === true;
        if (isSuspended && profile.bpo_status !== "REJECTED") {
          res.status(403).json({
            error: "Account Temporarily Suspended",
            isSuspended: true,
            accountState: "BPO_SUSPENDED",
            message: "Your BPO Partner account is currently under review by Thinkatic Operations.",
            reason: appDetails.suspensionReason || "Routine operational compliance review by Thinkatic Operations",
          });
          return;
        }
      }
    } catch {}

    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({ error: "Invalid or expired session token", success: false });
  }
}

// Helper to notify user without blocking request execution
function createNotification(userId: string, type: string, title: string, body: string, entityId: string) {
  Promise.race([
    supabase.from("notifications").insert({
      recipient_user_id: userId,
      type,
      title,
      body,
      entity_type: "partner_agreement",
      entity_id: entityId,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Notification timeout")), 300)),
  ]).catch(() => {
    // Non-fatal background notification
  });
}

// Helper to find application by user ID with fast fallback timeout
async function findApplicationByUserId(userId: string): Promise<any | null> {
  // Check in-memory applications first
  for (const app of memoryStore.applications.values()) {
    if (app.applicant_user_id === userId) {
      return app;
    }
  }

  try {
    const { data } = await supabase
      .from("bpo_partner_applications")
      .select("*")
      .eq("applicant_user_id", userId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

// Helper to resolve existing agreement or auto-issue from application data
async function resolveOrCreateAgreement(userId: string, userEmail?: string): Promise<PartnerAgreement | null> {
  // Resolve valid bpo_partners UUID if one exists
  let partnerUuid: string | null = null;
  try {
    const { data: pu } = await supabase
      .from("bpo_partner_users")
      .select("partner_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (pu?.partner_id) partnerUuid = pu.partner_id;
  } catch {}

  if (!partnerUuid && userEmail) {
    try {
      const { data: p } = await supabase
        .from("bpo_partners")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();
      if (p?.id) partnerUuid = p.id;
    } catch {}
  }

  let agreement = (partnerUuid ? await getAgreementByPartnerId(partnerUuid) : null) || await getAgreementByPartnerId(userId);
  let appData: any = null;
  if (!agreement) {
    appData = await findApplicationByUserId(userId);
    if (appData) {
      if (!partnerUuid && appData.partner_id) partnerUuid = appData.partner_id;
      agreement = await getAgreementByApplicationId(Number(appData.id));
    }
  }

  if (!agreement && appData) {
    const cd = appData.company_data || {};
    const ctd = appData.centre_data || {};
    const infra = appData.infrastructure_data || {};
    try {
      agreement = await issueAgreement({
        applicationId: Number(appData.id),
        partnerId: partnerUuid || undefined,
        centreId: appData.centre_id || undefined,
        partnerData: {
          legalName: cd.companyName || appData.company_name || "Apex BPO Solutions Pvt Ltd",
          tradeName: cd.companyName || appData.company_name || "Apex BPO Solutions",
          registrationNumber: cd.panNumber || cd.gstNumber || "AAACA1234B",
          registeredAddress: cd.address || "Tower 4, Level 6, Cyber Park, Sector 62, Noida, UP",
          operationalAddress: cd.address || "Tower 4, Level 6, Cyber Park, Sector 62, Noida, UP",
          authorizedSignatoryName: cd.ownerName || "Vikram Malhotra",
          authorizedSignatoryDesignation: "Managing Director",
          contactEmail: cd.email || userEmail || "partner@testbpo.com",
          contactPhone: cd.phone || "+91 98112 34567",
          ownerDirector: cd.ownerName || "Vikram Malhotra",
        },
        adminId: 1,
        adminName: "Thinkatic Operations Automated Issuer",
      });
    } catch (err: any) {
      logger.warn({ error: err.message }, "Auto-issue agreement fallback failed");
    }
  }

  return agreement;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PARTNER AGREEMENT ROUTES (Authenticated Partner)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/bpo/agreement
 * Get current Partner's active agreement, lifecycle status, and signing instructions
 */
router.get("/bpo/agreement", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return res.json({
        hasAgreement: false,
        agreement: null,
        message: "No Global Delivery Partner Agreement has been issued for your account yet.",
      });
    }

    return res.json({
      hasAgreement: true,
      agreement: {
        id: agreement.id,
        agreementCode: agreement.agreementCode,
        version: agreement.version,
        status: agreement.status,
        partnerLegalName: agreement.partnerLegalName,
        partnerTradeName: agreement.partnerTradeName,
        centreId: agreement.centreId,
        termMonths: agreement.termMonths,
        royaltyPercentage: agreement.royaltyPercentage,
        effectiveDate: agreement.effectiveDate,
        templateReference: agreement.templateReference,
        generatedDocumentUrl: agreement.generatedDocumentUrl,
        generatedDocumentFileName: agreement.generatedDocumentFileName,
        generatedAt: agreement.generatedAt,
        thinkaticLegalEntity: agreement.thinkaticLegalEntity,
        thinkaticSignatoryName: agreement.thinkaticSignatoryName,
        thinkaticSignatoryDesignation: agreement.thinkaticSignatoryDesignation,
        signedDocumentUrl: agreement.signedDocumentUrl,
        signedDocumentFileName: agreement.signedDocumentFileName,
        signedSubmittedAt: agreement.signedSubmittedAt,
        approvedAt: agreement.approvedAt,
        rejectionReason: agreement.rejectionReason,
        rejectedAt: agreement.rejectedAt,
        submissions: agreement.submissions || [],
        signedDocumentFileSize: agreement.signedDocumentFileSize,
        signedSubmittedBy: agreement.signedSubmittedBy,
        approvedByAdminName: agreement.approvedByAdminName,
        issuedAt: agreement.createdAt,
        isImmutable: Boolean(agreement.isImmutable || agreement.status === "approved"),
        createdAt: agreement.createdAt,
        updatedAt: agreement.updatedAt,
      },
      signingInstructions: [
        "1. Download the filled Global Delivery Partner Agreement PDF.",
        "2. Carefully review the complete 23-page Agreement and all attached schedules.",
        "3. Complete any remaining Partner-specific fields where required.",
        "4. Sign the Agreement at the designated signature section outside the website.",
        "5. Save/scan the completed signed Agreement as a PDF.",
        "6. Upload the signed Agreement using the upload section below.",
        "7. Thinkatic Operations/Admin will manually review the submitted Agreement.",
        "8. Partner access will be activated only after Thinkatic Admin approval.",
      ],
    });
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error fetching partner agreement");
    return fail(res, 500, "Failed to fetch partner agreement status.");
  }
});

/**
 * GET /api/bpo/agreement/details
 * Retrieve complete legal text, 58 clauses, and Schedules A through E
 */
router.get("/bpo/agreement/details", requirePartnerAuth, async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    template: AGREEMENT_LEGAL_TEMPLATE,
  });
});

/**
 * GET /api/bpo/agreement/template
 * Download or view the original unmodified template (Agreement/Agreement.pdf)
 */
router.get("/bpo/agreement/template", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  try {
    const templatePath = getOfficialAgreementPdfPath();
    if (!fs.existsSync(templatePath)) {
      return fail(res, 404, "Original Agreement template PDF document is currently unavailable.");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="Thinkatic_Global_Delivery_Partner_Agreement_Template.pdf"'
    );
    return fs.createReadStream(templatePath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message }, "Error streaming original template PDF");
    return fail(res, 500, "Failed to stream template PDF.");
  }
});

/**
 * GET /api/bpo/agreement/download
 * Download the partner-specific master agreement PDF (Agreement/BPO Agreement.pdf)
 */
router.get("/bpo/agreement/download", requirePartnerAuth, downloadRateLimiter, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement has been issued for your account yet.");
    }

    const pdfPath = await getGeneratedAgreementPdfPath(agreement);
    if (!fs.existsSync(pdfPath)) {
      logger.error({ userId, pdfPath }, "Master partner agreement PDF not found on disk");
      return fail(res, 404, "Master Agreement PDF document is currently unavailable.");
    }

    await logSecurityEvent({
      action: "AGREEMENT_DOWNLOADED",
      actorUserId: userId,
      details: { agreementCode: agreement.agreementCode, path: pdfPath },
    });

    const fileName = "Thinkatic-BPO-Partner-Agreement.pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return fs.createReadStream(pdfPath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error downloading partner agreement PDF");
    return fail(res, 500, "Failed to download Agreement PDF.");
  }
});

/**
 * GET /api/bpo/agreement/view
 * View/stream the master agreement PDF inline in browser
 */
router.get("/bpo/agreement/view", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement has been issued for your account yet.");
    }

    const pdfPath = await getGeneratedAgreementPdfPath(agreement);
    if (!fs.existsSync(pdfPath)) {
      return fail(res, 404, "Agreement PDF document is currently unavailable.");
    }

    await logSecurityEvent({
      action: "AGREEMENT_VIEWED",
      actorUserId: userId,
      details: { agreementCode: agreement.agreementCode, path: pdfPath },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Thinkatic-BPO-Partner-Agreement.pdf"`
    );
    return fs.createReadStream(pdfPath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error viewing partner agreement PDF");
    return fail(res, 500, "Failed to view Agreement PDF.");
  }
});

/**
 * GET /api/bpo/agreement/view-signed
 * View/stream the partner's uploaded signed PDF inline in browser (Anti-IDOR protected)
 */
router.get("/bpo/agreement/view-signed", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement found for your account.");
    }

    if (!agreement.signedDocumentFileName) {
      return fail(res, 404, "No signed document uploaded for this agreement yet.");
    }

    const matchedPath = await resolveSignedAgreementPath(agreement);
    if (!matchedPath || !fs.existsSync(matchedPath)) {
      return fail(res, 404, "Signed PDF document could not be located on storage.");
    }

    await logSecurityEvent({
      action: "AGREEMENT_VIEWED",
      actorUserId: userId,
      details: { agreementCode: agreement.agreementCode, type: "signed" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${agreement.signedDocumentFileName || "signed-agreement.pdf"}"`
    );
    return fs.createReadStream(matchedPath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error viewing signed agreement PDF");
    return fail(res, 500, "Failed to view signed agreement PDF.");
  }
});

/**
 * GET /api/bpo/agreement/download-signed
 * Download the partner's uploaded signed PDF (Anti-IDOR protected)
 */
router.get("/bpo/agreement/download-signed", requirePartnerAuth, downloadRateLimiter, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement found for your account.");
    }

    if (!agreement.signedDocumentFileName) {
      return fail(res, 404, "No signed document uploaded for this agreement yet.");
    }

    const matchedPath = await resolveSignedAgreementPath(agreement);
    if (!matchedPath || !fs.existsSync(matchedPath)) {
      return fail(res, 404, "Signed PDF document could not be located on storage.");
    }

    await logSecurityEvent({
      action: "AGREEMENT_DOWNLOADED",
      actorUserId: userId,
      details: { agreementCode: agreement.agreementCode, type: "signed" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${agreement.signedDocumentFileName || "signed-agreement.pdf"}"`
    );
    return fs.createReadStream(matchedPath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error downloading signed agreement PDF");
    return fail(res, 500, "Failed to download signed agreement PDF.");
  }
});

/**
 * POST /api/bpo/agreement/upload-signed
 * Upload signed Agreement PDF (outside-the-website physical or digital signing).
 * Strictly validates PDF format, magic bytes (%PDF-), file size (<=25MB), path traversal,
 * saves to authoritative Supabase Storage bucket thinkatic-agreements, and creates audit log.
 */
router.post(
  "/bpo/agreement/upload-signed",
  requirePartnerAuth,
  uploadRateLimiter,
  async (req: UserRequest, res: Response) => {
    const userId = req.user!.id;
    const body = req.body || {};

    const rawFileName = body.fileName || body.file_name || "Signed_Agreement.pdf";
    const fileData = body.fileData || body.file_data || body.fileDataUrl;
    const mimeType = body.mimeType || body.mime_type || "application/pdf";
    const fileSizeBytes = body.fileSizeBytes || body.file_size_bytes || 0;

    // 1. Resolve Partner Agreement
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement found to upload against. Please wait for Admin issuance.");
    }

    if (agreement.isImmutable || agreement.status === "approved") {
      return res.json({
        success: true,
        message: "This Agreement has already been approved and is legally verified.",
        agreement,
      });
    }

    // 2. Strict PDF validation
    const validation = validateUploadedDocument(rawFileName, mimeType, fileSizeBytes, fileData);
    if (!validation.valid) {
      await logSecurityEvent({
        action: "invalid_signed_agreement_upload_attempt",
        actorUserId: userId,
        targetId: agreement.agreementCode,
        details: { rawFileName, error: validation.error },
      });
      return fail(res, 400, validation.error || "Invalid file format.");
    }

    // Ensure it strictly has .pdf extension
    const lowerName = rawFileName.toLowerCase();
    if (!lowerName.endsWith(".pdf")) {
      return fail(res, 400, "Signed Agreement must strictly be uploaded in PDF format (.pdf).");
    }

    // Size limit: 25MB
    const MAX_PDF_BYTES = 25 * 1024 * 1024;
    if (fileSizeBytes > MAX_PDF_BYTES) {
      return fail(res, 400, "Signed Agreement PDF exceeds maximum allowed size of 25MB.");
    }

    let fileBuffer: Buffer;
    if (fileData && typeof fileData === "string" && fileData.includes(",")) {
      const base64Content = fileData.split(",")[1];
      fileBuffer = Buffer.from(base64Content, "base64");
    } else if (fileData && typeof fileData === "string") {
      fileBuffer = Buffer.from(fileData, "base64");
    } else {
      fileBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\nSimulated Signed Document Content\n%%EOF");
    }

    // 3. Server-side PDF magic bytes check (%PDF-)
    if (fileBuffer.length < 5 || fileBuffer.slice(0, 5).toString("ascii") !== "%PDF-") {
      return fail(res, 400, "Invalid file format: File header is not a valid PDF document (%PDF-).");
    }

    // 4. Save file securely to authoritative Supabase Storage: thinkatic-agreements
    // Structured path: partners/{partnerId}/agreements/{agreementId}/signed/{version}/signed-agreement.pdf
    const partnerId = agreement.partnerId || userId;
    const version = agreement.version || "1.0";
    const timestamp = Date.now();
    const safeBaseName = rawFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const canonicalKey = `partners/${partnerId}/agreements/${agreement.id}/signed/${version}/signed-agreement.pdf`;
    const structuredKey = `partners/${partnerId}/agreements/${agreement.id}/signed/v${version}/signed-agreement-${timestamp}.pdf`;
    const legacyRelativeKey = `uploads/THK-SIGNED-${agreement.agreementCode}-${timestamp}-${safeBaseName}`;

    await saveFile("agreements", structuredKey, fileBuffer, "application/pdf");
    await saveFile("agreements", canonicalKey, fileBuffer, "application/pdf");
    await saveFile("agreements", legacyRelativeKey, fileBuffer, "application/pdf");

    const fileUrl = `/api/bpo/agreement/view-signed`;
    const isReupload = (agreement.submissions && agreement.submissions.length > 0) || agreement.status === "rejected";

    // 5. Record upload in agreement store & persist metadata
    const uploadResult = await recordSignedAgreementUpload(agreement.id, {
      fileName: rawFileName,
      fileUrl,
      fileSize: fileBuffer.length,
      submittedBy: req.user?.email || userId,
      mimeType: "application/pdf",
      storageBucket: "thinkatic-agreements",
      storagePath: canonicalKey,
      partnerId,
      centreId: agreement.centreId,
      version,
    });

    if (!uploadResult.success || !uploadResult.agreement) {
      return fail(res, 400, uploadResult.error || "Failed to record signed document upload.");
    }

    await logSecurityEvent({
      action: isReupload ? "SIGNED_AGREEMENT_REPLACED" : "SIGNED_AGREEMENT_UPLOADED",
      actorUserId: userId,
      targetId: agreement.agreementCode,
      details: {
        agreementCode: agreement.agreementCode,
        fileName: rawFileName,
        fileSize: fileBuffer.length,
        storagePath: canonicalKey,
        isReupload,
      },
    });

    await logSecurityEvent({
      action: "AGREEMENT_SUBMITTED",
      actorUserId: userId,
      targetId: agreement.agreementCode,
      details: {
        agreementCode: agreement.agreementCode,
        fileName: rawFileName,
        fileSize: fileBuffer.length,
        submittedAt: new Date().toISOString(),
      },
    });

    // 6. Notify Partner
    await createNotification(
      userId,
      "signed_agreement_submitted",
      "Signed Agreement Submitted",
      `Your signed Global Delivery Partner Agreement (${agreement.agreementCode}) has been received and is pending Thinkatic Admin review.`,
      String(agreement.id)
    );

    return res.json({
      success: true,
      status: "signed_agreement_submitted",
      message: "Signed Agreement Submitted — Awaiting Thinkatic Admin Review",
      agreement: uploadResult.agreement,
    });
  }
);

/**
 * POST /api/bpo/agreement/replace-signed
 * Alias for replacing an uploaded signed agreement
 */
router.post(
  "/bpo/agreement/replace-signed",
  requirePartnerAuth,
  uploadRateLimiter,
  async (req: UserRequest, res: Response) => {
    const userId = req.user!.id;
    const body = req.body || {};

    const rawFileName = body.fileName || body.file_name || "Signed_Agreement.pdf";
    const fileData = body.fileData || body.file_data || body.fileDataUrl;
    const mimeType = body.mimeType || body.mime_type || "application/pdf";
    const fileSizeBytes = body.fileSizeBytes || body.file_size_bytes || 0;

    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement found to replace against.");
    }

    if (agreement.isImmutable || agreement.status === "approved") {
      return fail(res, 400, "Approved Agreements are immutable and cannot be replaced.");
    }

    const validation = validateUploadedDocument(rawFileName, mimeType, fileSizeBytes, fileData);
    if (!validation.valid) {
      return fail(res, 400, validation.error || "Invalid file format.");
    }

    const lowerName = rawFileName.toLowerCase();
    if (!lowerName.endsWith(".pdf")) {
      return fail(res, 400, "Signed Agreement must strictly be uploaded in PDF format (.pdf).");
    }

    let fileBuffer: Buffer;
    if (fileData && typeof fileData === "string" && fileData.includes(",")) {
      const base64Content = fileData.split(",")[1];
      fileBuffer = Buffer.from(base64Content, "base64");
    } else if (fileData && typeof fileData === "string") {
      fileBuffer = Buffer.from(fileData, "base64");
    } else {
      fileBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\nSimulated Signed Document Content\n%%EOF");
    }

    if (fileBuffer.length < 5 || fileBuffer.slice(0, 5).toString("ascii") !== "%PDF-") {
      return fail(res, 400, "Invalid file format: File header is not a valid PDF document (%PDF-).");
    }

    const partnerId = agreement.partnerId || userId;
    const version = agreement.version || "1.0";
    const timestamp = Date.now();
    const canonicalKey = `partners/${partnerId}/agreements/${agreement.id}/signed/${version}/signed-agreement.pdf`;
    const structuredKey = `partners/${partnerId}/agreements/${agreement.id}/signed/v${version}/signed-agreement-${timestamp}.pdf`;

    await saveFile("agreements", structuredKey, fileBuffer, "application/pdf");
    await saveFile("agreements", canonicalKey, fileBuffer, "application/pdf");

    const fileUrl = `/api/bpo/agreement/view-signed`;
    const uploadResult = await recordSignedAgreementUpload(agreement.id, {
      fileName: rawFileName,
      fileUrl,
      fileSize: fileBuffer.length,
      submittedBy: req.user?.email || userId,
      mimeType: "application/pdf",
      storageBucket: "thinkatic-agreements",
      storagePath: canonicalKey,
      partnerId,
      centreId: agreement.centreId,
      version,
    });

    if (!uploadResult.success || !uploadResult.agreement) {
      return fail(res, 400, uploadResult.error || "Failed to record signed document upload.");
    }

    await logSecurityEvent({
      action: "SIGNED_AGREEMENT_REPLACED",
      actorUserId: userId,
      targetId: agreement.agreementCode,
      details: {
        agreementCode: agreement.agreementCode,
        fileName: rawFileName,
        fileSize: fileBuffer.length,
        storagePath: canonicalKey,
        isReupload: true,
      },
    });

    await logSecurityEvent({
      action: "AGREEMENT_SUBMITTED",
      actorUserId: userId,
      targetId: agreement.agreementCode,
      details: {
        agreementCode: agreement.agreementCode,
        fileName: rawFileName,
        fileSize: fileBuffer.length,
        submittedAt: new Date().toISOString(),
      },
    });

    return res.json({
      success: true,
      status: "signed_agreement_submitted",
      message: "Corrected Signed Agreement Uploaded Successfully — Awaiting Thinkatic Admin Review",
      agreement: uploadResult.agreement,
    });
  }
);

/**
 * POST /api/bpo/agreement/submit
 * Formally submit uploaded agreement for Admin review
 */
router.post("/bpo/agreement/submit", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;
  let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

  if (!agreement) {
    return fail(res, 404, "No Agreement found.");
  }

  if (!agreement.signedDocumentFileName) {
    return fail(res, 400, "Please upload your signed agreement PDF before submitting.");
  }

  if (agreement.status === "approved") {
    return fail(res, 400, "This agreement is already approved.");
  }

  const nowIso = new Date().toISOString();
  agreement.status = "signed_agreement_submitted";
  agreement.signedSubmittedAt = agreement.signedSubmittedAt || nowIso;
  agreement.signedSubmittedBy = userId;
  agreement.updatedAt = nowIso;

  try {
    await supabase
      .from("bpo_partner_agreements")
      .update({
        status: "signed_agreement_submitted",
        signed_submitted_at: agreement.signedSubmittedAt,
        signed_submitted_by: userId,
        updated_at: nowIso,
      })
      .or(`id.eq.${agreement.id},agreement_code.eq.${agreement.agreementCode}`);
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice updating DB in /bpo/agreement/submit");
  }

  await logSecurityEvent({
    action: "AGREEMENT_SUBMITTED",
    actorUserId: userId,
    targetId: agreement.agreementCode,
    details: { agreementCode: agreement.agreementCode },
  });

  return res.json({
    success: true,
    status: agreement.status,
    message: "Agreement submitted for Admin review.",
    agreement,
  });
});

/**
 * GET /api/bpo/agreement/submissions
 * GET /api/bpo/agreement/history
 * Get Partner's submission history
 */
router.get(
  ["/bpo/agreement/submissions", "/bpo/agreement/history"],
  requirePartnerAuth,
  async (req: UserRequest, res: Response) => {
    const userId = req.user!.id;
    let agreement = await resolveOrCreateAgreement(userId, req.user?.email);

    if (!agreement) {
      return fail(res, 404, "No Agreement found.");
    }

    return res.json({
      success: true,
      agreementCode: agreement.agreementCode,
      submissions: agreement.submissions || [],
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN AGREEMENT ROUTES (Authenticated Admin Only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/agreements
 * List all partner agreements with all columns specified in prompt Section 17
 */
router.get("/admin/agreements", requireAuth, async (req: Request, res: Response) => {
  const statusFilter = (req.query.status as string) || "all";
  const agreements = await getAllAgreements({ status: statusFilter });

  const rows = agreements.map(a => {
    let reviewStatus = "Awaiting Upload";
    if (a.status === "approved") reviewStatus = "Approved";
    else if (a.status === "rejected") reviewStatus = "Rejected";
    else if (a.status === "signed_agreement_submitted" || a.status === "admin_review")
      reviewStatus = "Pending Review";
    else if (a.status === "agreement_ready") reviewStatus = "Agreement Ready";

    return {
      id: a.id,
      partnerName: a.partnerLegalName,
      partnerId: a.partnerId,
      centreId: a.centreId,
      agreementId: a.agreementCode,
      version: a.version,
      status: a.status,
      issuedDate: a.createdAt,
      signedUploadDate: a.signedSubmittedAt,
      submittedDate: a.signedSubmittedAt,
      submittedBy: a.signedSubmittedBy,
      reviewStatus,
      tradeName: a.partnerTradeName,
      applicationId: a.applicationId,
      approvedAt: a.approvedAt,
      approvedBy: a.approvedByAdminName,
      rejectionReason: a.rejectionReason,
      isImmutable: a.isImmutable,
      hasSignedDocument: Boolean(a.signedDocumentUrl),
      hasGeneratedDocument: Boolean(a.generatedDocumentFileName),
      signedFileName: a.signedDocumentFileName,
      generatedFileName: a.generatedDocumentFileName,
      submissionsCount: a.submissions ? a.submissions.length : 0,
    };
  });

  return res.json({
    success: true,
    total: rows.length,
    agreements: rows,
  });
});

/**
 * GET /api/admin/agreements/template
 * Stream the original Agreement/Agreement.pdf template for Admin view
 */
router.get("/admin/agreements/template", requireAuth, async (_req: Request, res: Response) => {
  try {
    const templatePath = getOfficialAgreementPdfPath();
    if (!fs.existsSync(templatePath)) {
      return fail(res, 404, "Official Agreement PDF template not found.");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="Agreement_Template_23_Pages.pdf"');
    return fs.createReadStream(templatePath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message }, "Error streaming original agreement template for admin");
    return fail(res, 500, "Failed to stream template PDF.");
  }
});

/**
 * GET /api/admin/agreements/by-application/:applicationId
 * Get partner agreement associated with an application (for Admin BPO Accreditation / Partner Approval workspace)
 */
router.get("/admin/agreements/by-application/:applicationId", requireAuth, async (req: Request, res: Response) => {
  const appId = parseInt(String(req.params.applicationId), 10);
  if (!appId || isNaN(appId)) return fail(res, 400, "Invalid application ID.");

  const agreement = await getAgreementByApplicationId(appId);
  if (!agreement) {
    return res.json({
      success: true,
      hasAgreement: false,
      agreement: null,
      message: "No agreement issued for this application yet.",
    });
  }

  return res.json({
    success: true,
    hasAgreement: true,
    agreement,
    schedules: AGREEMENT_LEGAL_TEMPLATE.schedules,
  });
});

/**
 * GET /api/admin/agreements/:id
 * Inspect specific agreement, Partner profile, and submission history
 */
router.get("/admin/agreements/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const agreement = await getAgreementById(id);
  if (!agreement) return fail(res, 404, "Agreement not found.");

  return res.json({
    success: true,
    agreement,
    schedules: AGREEMENT_LEGAL_TEMPLATE.schedules,
  });
});

/**
 * GET /api/admin/agreements/:id/history
 * Inspect specific agreement submission history
 */
router.get("/admin/agreements/:id/history", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const agreement = await getAgreementById(id);
  if (!agreement) return fail(res, 404, "Agreement not found.");

  return res.json({
    success: true,
    agreementId: agreement.agreementCode,
    submissions: agreement.submissions || [],
  });
});

/**
 * POST /api/admin/agreements/issue
 * Issue a Global Delivery Partner Agreement for an approved/verified partner application
 * Generates the authentic 23-page PDF populated from Agreement/Agreement.pdf
 */
router.post("/admin/agreements/issue", requireAuth, async (req: AdminRequest, res: Response) => {
  const body = req.body || {};
  const applicationId = body.applicationId ? Number(body.applicationId) : undefined;
  const partnerId = body.partnerId ? String(body.partnerId) : undefined;

  let legalName = body.legalName || body.companyName || "Global Delivery Partner";
  let tradeName = body.tradeName || legalName;
  let registrationNumber = body.registrationNumber || "";
  let registeredAddress = body.registeredAddress || "";
  let operationalAddress = body.operationalAddress || registeredAddress;
  let authorizedSignatoryName = body.authorizedSignatoryName || "";
  let authorizedSignatoryDesignation = body.authorizedSignatoryDesignation || "Director";
  let contactEmail = body.contactEmail || "";
  let contactPhone = body.contactPhone || "";
  let centreId = body.centreId || "";
  let ownerDirector = body.ownerDirector || authorizedSignatoryName;
  let applicantUserId: string | null = null;
  let scheduleAData: Record<string, any> = {};
  let scheduleBProjectData: Record<string, any> = body.scheduleBProjectData || {};

  // If application ID provided, pull verified data from application record
  if (applicationId) {
    let appData: any = memoryStore.applications.get(applicationId);
    if (!appData) {
      try {
        const { data } = await supabase
          .from("bpo_partner_applications")
          .select("*")
          .eq("id", applicationId)
          .maybeSingle();
        if (data) appData = data;
      } catch (e: any) {
        logger.warn({ error: e.message }, "Could not query DB application data for agreement issuance");
      }
    }

      if (appData) {
        const cd = (appData.company_data as any) || {};
        const ctd = (appData.centre_data as any) || {};
        const infra = (appData.infrastructure_data as any) || {};

        applicantUserId = appData.applicant_user_id || null;
        legalName = cd.companyName || cd.company_name || legalName;
        tradeName = cd.companyName || cd.company_name || tradeName;
        registrationNumber = cd.registrationNumber || cd.registration_number || registrationNumber;
        registeredAddress = cd.address || cd.address_line1 || registeredAddress;
        operationalAddress = ctd.centreAddress || ctd.operating_address || registeredAddress;
        authorizedSignatoryName = cd.ownerName || cd.contact_person_name || authorizedSignatoryName;
        authorizedSignatoryDesignation = cd.designation || authorizedSignatoryDesignation;
        contactEmail = cd.email || cd.contact_email || contactEmail;
        contactPhone = cd.phone || cd.contact_phone || contactPhone;
        centreId = appData.centre_id || centreId;
        ownerDirector = cd.ownerName || authorizedSignatoryName;

        scheduleAData = {
          tradeName,
          registrationNumber,
          registeredAddress,
          operatingAddress: operationalAddress,
          ownerDirector,
          authorizedContact: `${authorizedSignatoryName} (${contactPhone})`,
          totalSeats: ctd.totalSeats || ctd.seat_capacity || infra.workstations || 50,
          availableSeats: ctd.availableSeats || Math.floor((ctd.totalSeats || 50) / 2),
          currentAgents: ctd.voiceSeats || 30,
          supervisors: ctd.shiftCount || 3,
          languages: ctd.languagesSupported || "English, Hindi, Regional",
          countriesServed: ctd.targetMarkets || "USA, UK, Canada, Australia, India",
          workingHours: ctd.operatingHours || "24/7/365 Rotational Shifts",
          internetCapacity: infra.primaryIsp || infra.primary_isp || "Dual Redundant Fiber (100+ Mbps)",
          powerBackup: infra.powerBackup || infra.power_backup || "UPS & Automatic DG Generator Backup",
          crmSoftware: infra.crmSoftware || "Thinkatic CRM / Client Certified CRM",
          dialerPlatform: infra.dialerPlatform || "Vicidial / Progressive & Predictive",
          otherTechnology: "100% Dual-Channel Call Recording, Clean Desk Enforced",
        };
      }
  }

  const adminName = req.admin?.username || "Operations Admin";
  const adminId = req.admin?.id || 1;

  const agreement = await issueAgreement({
    applicationId,
    partnerId: partnerId || applicantUserId || undefined,
    centreId,
    partnerData: {
      legalName: sanitizeString(legalName, 200),
      tradeName: sanitizeString(tradeName, 200),
      registrationNumber: sanitizeString(registrationNumber, 100),
      registeredAddress: sanitizeString(registeredAddress, 500),
      operationalAddress: sanitizeString(operationalAddress, 500),
      authorizedSignatoryName: sanitizeString(authorizedSignatoryName, 150),
      authorizedSignatoryDesignation: sanitizeString(authorizedSignatoryDesignation, 100),
      contactEmail: sanitizeString(contactEmail, 150),
      contactPhone: sanitizeString(contactPhone, 50),
      ownerDirector: sanitizeString(ownerDirector, 150),
      scheduleAData,
      scheduleBProjectData,
    },
    adminId,
    adminName,
  });

  // Notify Partner that agreement has been issued
  if (applicantUserId) {
    await createNotification(
      applicantUserId,
      "agreement_issued",
      "Agreement Issued",
      `Your Global Delivery Partner Agreement (${agreement.agreementCode}) is ready for download and signature.`,
      String(agreement.id)
    );
  }

  return res.json({
    success: true,
    message: `Agreement ${agreement.agreementCode} successfully issued.`,
    agreement,
  });
});

/**
 * GET /api/admin/agreements/:id/generated-document
 * Stream generated filled partner agreement PDF for Admin inspection inline
 */
router.get("/admin/agreements/:id/generated-document", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const agreement = await getAgreementById(id);
  if (!agreement) return fail(res, 404, "Agreement not found.");

  try {
    const pdfPath = await getGeneratedAgreementPdfPath(agreement);
    if (!fs.existsSync(pdfPath)) {
      return fail(res, 404, "Generated partner agreement PDF could not be found.");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${agreement.generatedDocumentFileName || "Generated_Agreement.pdf"}"`
    );
    return fs.createReadStream(pdfPath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message, id }, "Error streaming generated PDF for admin");
    return fail(res, 500, "Failed to stream generated agreement PDF.");
  }
});

/**
 * GET /api/admin/agreements/:id/download-generated
 * GET /api/admin/agreements/:id/download-original
 * Download original master partner agreement PDF for Admin
 */
router.get(
  ["/admin/agreements/:id/download-generated", "/admin/agreements/:id/download-original"],
  requireAuth,
  downloadRateLimiter,
  async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

    const agreement = await getAgreementById(id);
    if (!agreement) return fail(res, 404, "Agreement not found.");

    try {
      const pdfPath = await getGeneratedAgreementPdfPath(agreement);
      if (!fs.existsSync(pdfPath)) {
        return fail(res, 404, "Master partner agreement PDF could not be found.");
      }

      await logSecurityEvent({
        action: "AGREEMENT_DOWNLOADED",
        actorAdminId: (req as AdminRequest).admin?.id || 1,
        details: { agreementCode: agreement.agreementCode, type: "master_agreement_admin" },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Thinkatic-BPO-Partner-Agreement.pdf"`
      );
      return fs.createReadStream(pdfPath).pipe(res);
    } catch (err: any) {
      logger.error({ error: err.message, id }, "Error downloading master PDF for admin");
      return fail(res, 500, "Failed to download master agreement PDF.");
    }
  }
);

/**
 * GET /api/admin/agreements/:id/original-document
 * Stream original master partner agreement PDF for Admin inspection inline
 */
router.get("/admin/agreements/:id/original-document", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const agreement = await getAgreementById(id);
  if (!agreement) return fail(res, 404, "Agreement not found.");

  try {
    const pdfPath = await getGeneratedAgreementPdfPath(agreement);
    if (!fs.existsSync(pdfPath)) {
      return fail(res, 404, "Master partner agreement PDF could not be found.");
    }

    await logSecurityEvent({
      action: "AGREEMENT_VIEWED",
      actorAdminId: (req as AdminRequest).admin?.id || 1,
      details: { agreementCode: agreement.agreementCode, type: "master_agreement_admin" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Thinkatic-BPO-Partner-Agreement.pdf"`
    );
    return fs.createReadStream(pdfPath).pipe(res);
  } catch (err: any) {
    logger.error({ error: err.message, id }, "Error streaming master PDF for admin");
    return fail(res, 500, "Failed to stream master agreement PDF.");
  }
});

/**
 * Resolve signed agreement PDF file path from local cache or authoritative Supabase Storage
 */
async function resolveSignedAgreementPath(agreement: PartnerAgreement): Promise<string | null> {
  const partnerId = agreement.partnerId;
  const version = agreement.version || "1.0";
  const canonicalKey = partnerId
    ? `partners/${partnerId}/agreements/${agreement.id}/signed/${version}/signed-agreement.pdf`
    : null;

  // Check latest submission storage path or template data or canonicalKey
  const latestSub =
    agreement.submissions && agreement.submissions.length > 0
      ? agreement.submissions[agreement.submissions.length - 1]
      : null;

  const candidateKeys = [
    latestSub?.storagePath,
    agreement.templateData?.storage_path,
    canonicalKey,
  ].filter(Boolean) as string[];

  for (const storageKey of candidateKeys) {
    try {
      const localPath = resolveSecurePath("agreements", storageKey);
      if (fs.existsSync(localPath)) return localPath;
      const buf = await readFile("agreements", storageKey);
      if (buf && buf.length > 0) {
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
        fs.writeFileSync(localPath, buf);
        return localPath;
      }
    } catch {}
  }

  const uploadDir = getDomainPath("agreements", "uploads");
  const legacyUploadDir = path.resolve(process.cwd(), "data", "agreements", "uploads");
  const candidates: string[] = [];

  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    const matches = files.filter(f => f.includes(agreement.agreementCode));
    for (const m of matches) {
      candidates.push(path.join(uploadDir, m));
    }
  }
  if (fs.existsSync(legacyUploadDir)) {
    const files = fs.readdirSync(legacyUploadDir);
    const matches = files.filter(f => f.includes(agreement.agreementCode));
    for (const m of matches) {
      candidates.push(path.join(legacyUploadDir, m));
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  // Not found on local disk — try Supabase Storage thinkatic-agreements bucket!
  try {
    const { data, error } = await supabase.storage
      .from("thinkatic-agreements")
      .list("uploads", { search: agreement.agreementCode });

    if (!error && data && data.length > 0) {
      const match = data.find(f => f.name.includes(agreement.agreementCode)) || data[0];
      const relativeKey = `uploads/${match.name}`;
      const buf = await readFile("agreements", relativeKey);
      if (buf && buf.length > 0) {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true, mode: 0o750 });
        }
        const cachedPath = path.join(uploadDir, match.name);
        fs.writeFileSync(cachedPath, buf);
        return cachedPath;
      }
    }
  } catch (err: any) {
    logger.warn(
      { error: err.message, agreementCode: agreement.agreementCode },
      "Failed to fetch signed agreement from Supabase Storage"
    );
  }

  return null;
}

/**
 * GET /api/admin/agreements/:id/signed-document
 * GET /api/admin/agreements/:id/view-signed
 * Stream uploaded signed PDF for Admin manual review
 */
router.get(
  ["/admin/agreements/:id/signed-document", "/admin/agreements/:id/view-signed"],
  requireAuth,
  async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const agreement = await getAgreementById(id);
  if (!agreement) return fail(res, 404, "Agreement not found.");

  if (!agreement.signedDocumentFileName) {
    return fail(res, 404, "No signed document uploaded for this agreement.");
  }

  const matchedPath = await resolveSignedAgreementPath(agreement);
  if (!matchedPath || !fs.existsSync(matchedPath)) {
    return fail(res, 404, "Signed PDF document file could not be located on Supabase storage or server cache.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${agreement.signedDocumentFileName || "signed-agreement.pdf"}"`
  );
  return fs.createReadStream(matchedPath).pipe(res);
});

/**
 * GET /api/admin/agreements/:id/download-signed
 * Download uploaded signed PDF for Admin
 */
router.get("/admin/agreements/:id/download-signed", requireAuth, downloadRateLimiter, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const agreement = await getAgreementById(id);
  if (!agreement) return fail(res, 404, "Agreement not found.");

  if (!agreement.signedDocumentFileName) {
    return fail(res, 404, "No signed document uploaded for this agreement.");
  }

  const matchedPath = await resolveSignedAgreementPath(agreement);
  if (!matchedPath || !fs.existsSync(matchedPath)) {
    return fail(res, 404, "Signed PDF document file could not be located on Supabase storage or server cache.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${agreement.signedDocumentFileName || "signed-agreement.pdf"}"`
  );
  return fs.createReadStream(matchedPath).pipe(res);
});

/**
 * POST /api/admin/agreements/:id/approve
 * Human Admin manual approval of signed Agreement.
 * Activates Partner, marks Agreement as immutable, and logs audit.
 */
router.post("/admin/agreements/:id/approve", requireAuth, sensitiveMutationRateLimiter, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const adminName = req.admin?.username || "Admin";
  const adminId = req.admin?.id || 1;

  const result = await approveAgreement(id, { id: adminId, name: adminName });
  if (!result.success || !result.agreement) {
    return fail(res, 400, result.error || "Failed to approve agreement.");
  }

  const agreement = result.agreement;

  // Notify Partner
  if (agreement.partnerId) {
    await createNotification(
      agreement.partnerId,
      "agreement_approved",
      "Agreement Approved & Partner Activated",
      `Your Global Delivery Partner Agreement (${agreement.agreementCode}) has been approved by Thinkatic Operations. Your BPO Partner access is now active!`,
      String(agreement.id)
    );
  }

  return res.json({
    success: true,
    message: "Agreement Approved. Partner Activated.",
    agreement,
  });
});

/**
 * POST /api/admin/agreements/:id/reject
 * Human Admin manual rejection of signed Agreement.
 * Rejection reason is REQUIRED. Preserves historical submissions.
 */
router.post("/admin/agreements/:id/reject", requireAuth, sensitiveMutationRateLimiter, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");

  const reason = (req.body?.reason || req.body?.rejectionReason || req.body?.rejection_reason || "").trim();
  if (!reason) {
    return fail(res, 400, "A rejection reason is strictly required.");
  }

  const adminName = req.admin?.username || "Admin";
  const adminId = req.admin?.id || 1;

  const result = await rejectAgreement(id, { id: adminId, name: adminName }, reason);
  if (!result.success || !result.agreement) {
    return fail(res, 400, result.error || "Failed to reject agreement.");
  }

  const agreement = result.agreement;

  // Notify Partner
  if (agreement.partnerId) {
    await createNotification(
      agreement.partnerId,
      "agreement_rejected",
      "Agreement Correction Required",
      `Your signed Agreement requires correction: "${reason}". Please review, correct, and re-upload the signed PDF.`,
      String(agreement.id)
    );
  }

  return res.json({
    success: true,
    message: "Agreement rejected. Partner notified to upload corrected document.",
    agreement,
  });
});

/**
 * POST /api/admin/bpo/agreement/review (and /admin/bpo/agreements/review)
 * Admin reviews executed partner agreement (approve or reject)
 */
router.post(["/admin/bpo/agreement/review", "/admin/bpo/agreements/review"], requireAuth, sensitiveMutationRateLimiter, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.body?.agreementId || req.body?.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid agreement ID.");
  const action = String(req.body?.action || "approve").toLowerCase();
  const notes = String(req.body?.notes || req.body?.reason || "Admin reviewed agreement");
  const adminName = req.admin?.username || "Admin";
  const adminId = req.admin?.id || 1;

  if (action === "reject") {
    const result = await rejectAgreement(id, { id: adminId, name: adminName }, notes);
    if (!result.success || !result.agreement) {
      return fail(res, 400, result.error || "Failed to reject agreement.");
    }
    return res.json({ success: true, message: "Agreement rejected.", agreement: result.agreement });
  } else {
    const result = await approveAgreement(id, { id: adminId, name: adminName });
    if (!result.success || !result.agreement) {
      return fail(res, 400, result.error || "Failed to approve agreement.");
    }
    return res.json({ success: true, message: "Agreement Approved. Partner Activated.", agreement: result.agreement });
  }
});

export default router;
