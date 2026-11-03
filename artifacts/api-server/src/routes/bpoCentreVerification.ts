// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — OFFICE / CENTRE VERIFICATION API
// Authenticated endpoints for Partner office verification submission and Admin review.
// RBAC + Anti-IDOR + Secure Media Streaming + Range-request support for video.
// ==============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  uploadRateLimiter,
  downloadRateLimiter,
  sensitiveMutationRateLimiter,
} from "../lib/security.js";
import { supabase } from "@workspace/db";
import {
  resolvePartnerAndCentreForUser,
  getOrCreateVerification,
  getVerificationById,
  getVerificationByUserId,
  getAllVerifications,
  updateOfficeDetails,
  uploadMediaEvidence,
  deleteMediaEvidence,
  replaceMediaEvidence,
  reviewMediaEvidence,
  calculateEvidenceCompletion,
  submitCentreVerification,
  approveCentreVerification,
  rejectCentreVerification,
  resolveMediaForStream,
  PHOTO_CATEGORIES,
  VIDEO_CATEGORY,
} from "../lib/centreVerificationService.js";
import { getApplicationForUser, resolveApplicationRecord, isValidPhone } from "./partnerApplications.js";
import { getOnboardingProgress } from "../lib/onboardingProgressService.js";
import { invalidateAdminBpoCache } from "./admin.js";
import { invalidateUserPartnerCache } from "./bpoAgents.js";

const router = Router();
const JWT_SECRET =
  process.env.USER_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("USER_SESSION_SECRET must be set in production");
      })()
    : "thinkatic-user-secret-2026");

const ADMIN_JWT_SECRET =
  process.env.SESSION_SECRET ||
  process.env.USER_SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("SESSION_SECRET must be set in production");
      })()
    : "thinkatic-super-secret-key-change-in-production-2026");

type UserRequest = Request & { user?: { id: string; email: string; role?: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ success: false, error: message, message, details });
}

/**
 * Partner Auth Middleware supporting Authorization header or ?token= query parameter (for media streaming)
 */
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
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role?: string };

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

/**
 * Admin Stream Auth Middleware supporting Authorization header or ?admin_token= query parameter
 */
function requireAdminStreamAuth(req: AdminRequest, res: Response, next: NextFunction) {
  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
  } else if (typeof req.query.admin_token === "string" && req.query.admin_token) {
    token = req.query.admin_token;
  }

  if (!token) {
    res.status(401).json({ error: "Admin authentication required", success: false });
    return;
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as { id: number; username: string };
    req.admin = payload;
    next();
  } catch (err: any) {
    res.status(401).json({ error: "Invalid or expired admin session token", success: false });
  }
}

/**
 * Helper to stream private media with HTTP 206 Partial Content (Range) support
 */
function streamMediaResponse(
  req: Request,
  res: Response,
  mediaResult: { filePath?: string; signedUrl?: string; mimeType?: string; fileSize?: number; fileName?: string }
) {
  const { filePath, signedUrl, mimeType, fileSize, fileName } = mediaResult;

  // If signed URL is available and not a partial range request, redirect to CDN signed URL
  if (signedUrl && !req.headers.range) {
    return res.redirect(302, signedUrl);
  }

  // If file does not exist on disk, redirect to signed URL
  if (!filePath || !fs.existsSync(filePath)) {
    if (signedUrl) {
      return res.redirect(302, signedUrl);
    }
    return fail(res, 404, "File not available on server.");
  }

  if (fileSize === undefined || !mimeType) {
    if (signedUrl) {
      return res.redirect(302, signedUrl);
    }
    return fail(res, 404, "File not available on server.");
  }

  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
    });

    const fileStream = fs.createReadStream(filePath, { start, end });
    return fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${fileName || "media"}"`,
      "Cache-Control": "private, max-age=3600",
    });
    return fs.createReadStream(filePath).pipe(res);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PARTNER ENDPOINTS (Guarded by requirePartnerAuth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/bpo/centre-verification/me
 * Fetch current user's office verification record, media, and photo categories config
 */
router.get("/bpo/centre-verification/me", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  try {
    const { partnerId, centreId, centreName, partnerCode } = await resolvePartnerAndCentreForUser(userId, userEmail);
    const verif = await getOrCreateVerification({
      applicantUserId: userId,
      partnerId,
      centreId: partnerCode || centreId,
      partnerCode,
      officeName: centreName || undefined,
    });
    const completion = calculateEvidenceCompletion(verif);
    return res.json({
      success: true,
      verification: verif,
      photoCategories: PHOTO_CATEGORIES,
      videoCategory: VIDEO_CATEGORY,
      completion,
    });
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error fetching partner centre verification");
    return fail(res, 500, "Failed to load centre verification.");
  }
});

/**
 * POST /api/bpo/centre-verification
 * Save or update office / centre details
 */
router.post("/bpo/centre-verification", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const body = req.body || {};

  // Check suspension status: suspended partners cannot modify centre verification details
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_type, is_active, bpo_status, bpo_application_details")
    .eq("id", userId)
    .maybeSingle();

  if (profile && (profile.is_active === false || profile.bpo_application_details?.suspended === true) && profile.bpo_status !== "REJECTED") {
    return fail(res, 403, "Account is currently under administrative suspension. Office verification edits are blocked.");
  }

  // Validate contactNumber if supplied
  const rawContact = body.contactNumber || body.contact_number || body.phone;
  if (rawContact !== undefined && rawContact !== null && String(rawContact).trim() !== "") {
    if (!isValidPhone(String(rawContact).trim())) {
      return res.status(400).json({ success: false, error: "Invalid contact phone number format. Please provide a valid 7 to 15 digit number." });
    }
  }

  try {
    let { partnerId, centreId, centreName, partnerCode, applicationId } = await resolvePartnerAndCentreForUser(userId, userEmail);
    if (body.applicationId) applicationId = Number(body.applicationId);

    const verif = await getOrCreateVerification({
      applicantUserId: userId,
      partnerId,
      applicationId,
      centreId: partnerCode || centreId,
      partnerCode,
      officeName: centreName || undefined,
    });

    let targetVerifId = verif.id;
    if (body.verificationId && Number(body.verificationId) !== verif.id) {
      const target = await getVerificationById(Number(body.verificationId));
      if (!target) {
        return fail(res, 404, "Verification record not found.");
      }
      const isOwner =
        target.applicantUserId === userId ||
        (partnerId && target.partnerId === partnerId) ||
        (centreId && (target.centreId === centreId || (partnerCode && target.centreId === partnerCode))) ||
        (applicationId && Number(target.applicationId) === applicationId);
      if (!isOwner && req.user?.role !== "admin") {
        return fail(res, 403, "You are not authorized to update details for this centre.");
      }
      targetVerifId = target.id;
    }

    const result = await updateOfficeDetails(
      targetVerifId,
      userId,
      {
        officeName: body.officeName || body.office_name,
        addressLine1: body.addressLine1 || body.address_line_1,
        addressLine2: body.addressLine2 || body.address_line_2,
        city: body.city,
        state: body.state,
        country: body.country,
        postalCode: body.postalCode || body.postal_code || body.zipCode,
        landmark: body.landmark,
        contactNumber: body.contactNumber || body.contact_number || body.phone,
        centreType: body.centreType || body.centre_type,
        ownershipType: body.ownershipType || body.ownership_type,
        operatingSince: body.operatingSince || body.operating_since,
        totalAreaSqft: body.totalAreaSqft || body.total_area_sqft ? Number(body.totalAreaSqft || body.total_area_sqft) : undefined,
        numberOfFloors: body.numberOfFloors || body.number_of_floors ? Number(body.numberOfFloors || body.number_of_floors) : undefined,
        workingHours: body.workingHours || body.operatingShift || body.working_hours || body.operating_shift,
        operatingShift: body.operatingShift || body.workingHours || body.operating_shift || body.working_hours,
      },
      { partnerId, centreId: partnerCode || centreId, partnerCode, applicationId, isAdmin: req.user?.role === "admin" }
    );

    if (!result.success) {
      logger.warn({ error: result.error, targetVerifId }, "updateOfficeDetails failed");
      return fail(res, (result as any).status || 400, result.error || "Failed to update office details.");
    }

    // Invalidate caches immediately for real-time synchronization
    invalidateAdminBpoCache(userId);
    invalidateUserPartnerCache(userId);

    let onboardingProgress: any = null;
    try {
      onboardingProgress = await getOnboardingProgress(userId, profile);
    } catch {}

    return res.json({
      success: true,
      message: "Office details saved successfully.",
      verification: result.verification,
      onboardingProgress,
    });
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error updating office details");
    return fail(res, 500, "Failed to save office details.");
  }
});

/**
 * POST /api/bpo/centre-verification/photo
 * Upload a categorized office photograph
 */
router.post(
  "/bpo/centre-verification/photo",
  requirePartnerAuth,
  uploadRateLimiter,
  async (req: UserRequest, res: Response) => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const body = req.body || {};

    let category = body.category;
    if (category === "operations_floor") category = "operations_area";
    if (category === "workstation" || category === "workstations") category = "workstation_area";
    if (category === "reception") category = "reception_entrance";
    const originalFileName = body.fileName || body.file_name || `photo_${Date.now()}.jpg`;
    const mimeType = body.mimeType || body.mime_type || "image/jpeg";
    const fileData = body.fileData || body.file_data || body.fileDataUrl || body.photoDataUrl;

    if (!category) {
      return fail(res, 400, "Photo category is required.");
    }
    if (!fileData || typeof fileData !== "string") {
      return fail(res, 400, "Photo binary data is required.");
    }

    try {
      let { partnerId, centreId, centreName, partnerCode, applicationId } = await resolvePartnerAndCentreForUser(userId, userEmail);

      // Ensure active application from partnerApplications store is checked
      if (!applicationId) {
        try {
          const userAppResult = await getApplicationForUser(userId);
          if (userAppResult?.application) {
            applicationId = Number(userAppResult.application.id);
            if (!centreId && userAppResult.application.centre_id) {
              centreId = String(userAppResult.application.centre_id);
            }
            if (!centreName && (userAppResult.application.company_data?.companyName || userAppResult.application.company_name)) {
              centreName = String(userAppResult.application.company_data?.companyName || userAppResult.application.company_name);
            }
          }
        } catch {}
      }

      // Multi-tenant & IDOR protection:
      // If client supplied an applicationId, verify it belongs to this authenticated user
      if (body.applicationId && req.user?.role !== "admin") {
        const requestedAppId = Number(body.applicationId);
        if (applicationId && requestedAppId !== applicationId) {
          return fail(res, 403, "Unauthorized access: You can only upload evidence to your own application.");
        }
        if (!applicationId) {
          const appRec = await resolveApplicationRecord(requestedAppId);
          if (!appRec || String(appRec.applicant_user_id) !== String(userId)) {
            return fail(res, 403, "Unauthorized access: You can only upload evidence to your own application.");
          }
          applicationId = requestedAppId;
        }
      }

      const targetAppId = applicationId || (body.applicationId ? Number(body.applicationId) : null);
      const verif = await getOrCreateVerification({
        applicantUserId: userId,
        partnerId,
        applicationId: targetAppId,
        centreId: partnerCode || centreId,
        partnerCode,
        officeName: centreName || undefined,
      });

      // IDOR Protection: if request supplies a verificationId targeting another centre, reject 403
      let targetVerifId = verif.id;
      if (body.verificationId && Number(body.verificationId) !== verif.id) {
        const target = await getVerificationById(Number(body.verificationId));
        if (!target) {
          return fail(res, 404, "Verification record not found.");
        }
        const isOwner =
          String(target.applicantUserId) === String(userId) ||
          (partnerId && String(target.partnerId) === String(partnerId)) ||
          (centreId && (String(target.centreId) === String(centreId) || (partnerCode && String(target.centreId) === String(partnerCode)))) ||
          (applicationId && Number(target.applicationId) === applicationId);
        if (!isOwner && req.user?.role !== "admin") {
          return fail(res, 403, "You are not authorized to upload evidence for this centre.");
        }
        targetVerifId = target.id;
      }

      // Convert base64 data to buffer
      let buffer: Buffer;
      if (fileData.includes(",")) {
        const base64Part = fileData.split(",")[1];
        buffer = Buffer.from(base64Part, "base64");
      } else {
        buffer = Buffer.from(fileData, "base64");
      }

      const result = await uploadMediaEvidence({
        verificationId: targetVerifId,
        userId,
        partnerId,
        centreId: partnerCode || centreId,
        partnerCode,
        applicationId: targetAppId,
        isAdmin: req.user?.role === "admin",
        mediaType: "photo",
        category,
        originalFileName,
        mimeType,
        fileBuffer: buffer,
      });

      if (!result.success) {
        const statusCode = (result as any).status || (result.error?.includes("authorized") || result.error?.includes("Unauthorized") ? 403 : 400);
        return fail(res, statusCode, result.error || "Failed to upload photo.");
      }

      const updatedVerif = await getVerificationById(targetVerifId);
      return res.status(201).json({
        success: true,
        message: "Office photo uploaded successfully.",
        media: result.media,
        verification: updatedVerif,
        completion: updatedVerif ? calculateEvidenceCompletion(updatedVerif) : undefined,
      });
    } catch (err: any) {
      logger.error({ error: err.message, userId }, "Error uploading office photo");
      return fail(res, 500, "Failed to upload office photo.");
    }
  }
);

/**
 * POST /api/bpo/centre-verification/video
 * Upload live browser-recorded walkthrough video with explicit confirmation
 */
router.post(
  "/bpo/centre-verification/video",
  requirePartnerAuth,
  uploadRateLimiter,
  async (req: UserRequest, res: Response) => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const body = req.body || {};

    const originalFileName = body.fileName || body.file_name || `live_office_walkthrough_${Date.now()}.webm`;
    const mimeType = body.mimeType || body.mime_type || "video/webm";
    const fileData = body.fileData || body.file_data || body.fileDataUrl;
    const durationSeconds = body.durationSeconds || body.duration_seconds || null;
    const confirmed = body.confirmed !== undefined ? Boolean(body.confirmed) : true;

    if (!confirmed) {
      return fail(res, 400, "Explicit submission confirmation is required before uploading office video.");
    }

    if (!fileData || typeof fileData !== "string") {
      return fail(res, 400, "Video binary data is required.");
    }

    try {
      let { partnerId, centreId, centreName, partnerCode, applicationId } = await resolvePartnerAndCentreForUser(userId, userEmail);

      // Ensure active application from partnerApplications store is checked
      if (!applicationId) {
        try {
          const userAppResult = await getApplicationForUser(userId);
          if (userAppResult?.application) {
            applicationId = Number(userAppResult.application.id);
            if (!centreId && userAppResult.application.centre_id) {
              centreId = String(userAppResult.application.centre_id);
            }
            if (!centreName && (userAppResult.application.company_data?.companyName || userAppResult.application.company_name)) {
              centreName = String(userAppResult.application.company_data?.companyName || userAppResult.application.company_name);
            }
          }
        } catch {}
      }

      // Multi-tenant & IDOR protection:
      // If client supplied an applicationId, verify it belongs to this authenticated user
      if (body.applicationId && req.user?.role !== "admin") {
        const requestedAppId = Number(body.applicationId);
        if (applicationId && requestedAppId !== applicationId) {
          return fail(res, 403, "Unauthorized access: You can only upload evidence to your own application.");
        }
        if (!applicationId) {
          const appRec = await resolveApplicationRecord(requestedAppId);
          if (!appRec || String(appRec.applicant_user_id) !== String(userId)) {
            return fail(res, 403, "Unauthorized access: You can only upload evidence to your own application.");
          }
          applicationId = requestedAppId;
        }
      }

      const targetAppId = applicationId || (body.applicationId ? Number(body.applicationId) : null);
      const verif = await getOrCreateVerification({
        applicantUserId: userId,
        partnerId,
        applicationId: targetAppId,
        centreId: partnerCode || centreId,
        partnerCode,
        officeName: centreName || undefined,
      });

      let targetVerifId = verif.id;
      if (body.verificationId && Number(body.verificationId) !== verif.id) {
        const target = await getVerificationById(Number(body.verificationId));
        if (!target) {
          return fail(res, 404, "Verification record not found.");
        }
        const isOwner =
          String(target.applicantUserId) === String(userId) ||
          (partnerId && String(target.partnerId) === String(partnerId)) ||
          (centreId && (String(target.centreId) === String(centreId) || (partnerCode && String(target.centreId) === String(partnerCode)))) ||
          (applicationId && Number(target.applicationId) === applicationId);
        if (!isOwner && req.user?.role !== "admin") {
          return fail(res, 403, "You are not authorized to upload evidence for this centre.");
        }
        targetVerifId = target.id;
      }

      let buffer: Buffer;
      if (fileData.includes(",")) {
        const base64Part = fileData.split(",")[1];
        buffer = Buffer.from(base64Part, "base64");
      } else {
        buffer = Buffer.from(fileData, "base64");
      }

      const result = await uploadMediaEvidence({
        verificationId: targetVerifId,
        userId,
        partnerId,
        centreId: partnerCode || centreId,
        partnerCode,
        applicationId: targetAppId,
        isAdmin: req.user?.role === "admin",
        mediaType: "video",
        category: VIDEO_CATEGORY,
        originalFileName,
        mimeType,
        fileBuffer: buffer,
        durationSeconds: durationSeconds ? Number(durationSeconds) : null,
      });

      if (!result.success) {
        const statusCode = (result as any).status || (result.error?.includes("authorized") || result.error?.includes("Unauthorized") ? 403 : 400);
        return fail(res, statusCode, result.error || "Failed to upload office video.");
      }

      const updatedVerif = await getVerificationById(targetVerifId);
      return res.status(201).json({
        success: true,
        message: "Live office walkthrough video submitted successfully.",
        media: result.media,
        verification: updatedVerif,
        completion: updatedVerif ? calculateEvidenceCompletion(updatedVerif) : undefined,
      });
    } catch (err: any) {
      logger.error({ error: err.message, userId }, "Error uploading office video");
      return fail(res, 500, "Failed to upload office video.");
    }
  }
);

/**
 * POST /api/bpo/centre-verification/submit
 * Formally submit centre verification dossier for Admin review
 */
router.post("/bpo/centre-verification/submit", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const body = req.body || {};

  try {
    let { partnerId, centreId, centreName, partnerCode, applicationId } = await resolvePartnerAndCentreForUser(userId, userEmail);
    if (body.applicationId) applicationId = Number(body.applicationId);

    const verif = await getOrCreateVerification({
      applicantUserId: userId,
      partnerId,
      applicationId,
      centreId: partnerCode || centreId,
      partnerCode,
      officeName: centreName || undefined,
    });

    let targetVerifId = verif.id;
    if (body.verificationId && Number(body.verificationId) !== verif.id) {
      const target = await getVerificationById(Number(body.verificationId));
      if (!target) {
        return fail(res, 404, "Verification record not found.");
      }
      const isOwner =
        target.applicantUserId === userId ||
        (partnerId && target.partnerId === partnerId) ||
        (centreId && (target.centreId === centreId || (partnerCode && target.centreId === partnerCode))) ||
        (applicationId && Number(target.applicationId) === applicationId);
      if (!isOwner && req.user?.role !== "admin") {
        return fail(res, 403, "You are not authorized to submit verification for this centre.");
      }
      targetVerifId = target.id;
    }

    if (body.officeName || body.addressLine1) {
      await updateOfficeDetails(targetVerifId, userId, body, {
        partnerId,
        centreId: partnerCode || centreId,
        partnerCode,
        applicationId,
        isAdmin: req.user?.role === "admin",
      });
    }

    const result = await submitCentreVerification(targetVerifId, userId, {
      partnerId,
      centreId: partnerCode || centreId,
      partnerCode,
      applicationId,
      isAdmin: req.user?.role === "admin",
    });

    if (!result.success) {
      logger.warn({ error: result.error, targetVerifId }, "submitCentreVerification failed");
      return fail(res, (result as any).status || 400, result.error || "Submission requirements incomplete.");
    }

    return res.json({
      success: true,
      message: "Office / Centre Verification dossier submitted for Thinkatic Admin manual review.",
      verification: result.verification,
      completion: result.verification ? calculateEvidenceCompletion(result.verification) : undefined,
    });
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error submitting centre verification");
    return fail(res, 500, "Failed to submit centre verification.");
  }
});

/**
 * GET /api/bpo/centre-verification/media/:mediaId
 * Secure authenticated streaming of photo or video for the Partner (Anti-IDOR protected)
 */
router.get("/bpo/centre-verification/media/:mediaId", requirePartnerAuth, downloadRateLimiter, async (req: UserRequest, res: Response) => {
  const mediaId = parseInt(String(req.params.mediaId), 10);
  if (!mediaId || isNaN(mediaId)) return fail(res, 400, "Invalid media ID.");

  try {
    const streamResult = await resolveMediaForStream({
      mediaId,
      requestingUser: req.user,
    });

    if (!streamResult.allowed) {
      return fail(res, streamResult.status || 403, streamResult.error || "Access denied.");
    }

    return streamMediaResponse(req, res, streamResult);
  } catch (err: any) {
    logger.error({ error: err.message, mediaId }, "Error streaming partner verification media");
    return fail(res, 500, "Error streaming media file.");
  }
});

/**
 * GET /api/bpo/centre-verification/completion
 * Calculate real completion breakdown of required and optional evidence
 */
router.get("/bpo/centre-verification/completion", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  try {
    const { partnerId, centreId, partnerCode } = await resolvePartnerAndCentreForUser(userId, userEmail);
    const verif = await getVerificationByUserId(userId, { partnerId, centreId: partnerCode || centreId, partnerCode });
    if (!verif) {
      return res.json({
        success: true,
        completion: {
          totalRequired: 7,
          completedRequired: 0,
          isComplete: false,
          percentage: 0,
          missingRequired: ["All required evidence"],
        },
      });
    }

    const report = calculateEvidenceCompletion(verif);
    return res.json({ success: true, completion: report });
  } catch (err: any) {
    logger.error({ error: err.message, userId }, "Error computing evidence completion");
    return fail(res, 500, "Failed to calculate evidence completion.");
  }
});

/**
 * DELETE /api/bpo/centre-verification/media/:mediaId
 * Securely archive/remove uploaded media evidence with strict Anti-IDOR ownership protection
 */
router.delete("/bpo/centre-verification/media/:mediaId", requirePartnerAuth, async (req: UserRequest, res: Response) => {
  const mediaId = parseInt(String(req.params.mediaId), 10);
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  if (!mediaId || isNaN(mediaId)) return fail(res, 400, "Invalid media ID.");

  try {
    const { partnerId, centreId, partnerCode, applicationId } = await resolvePartnerAndCentreForUser(userId, userEmail);
    const result = await deleteMediaEvidence({
      mediaId,
      userId,
      partnerId,
      centreId: partnerCode || centreId,
      applicationId,
      isAdmin: req.user?.role === "admin",
    });

    if (!result.success) {
      return fail(res, result.status || 400, result.error || "Failed to delete media evidence.");
    }

    return res.json({
      success: true,
      message: "Media evidence archived successfully.",
    });
  } catch (err: any) {
    logger.error({ error: err.message, mediaId, userId }, "Error deleting media evidence");
    return fail(res, 500, "Failed to delete media evidence.");
  }
});

/**
 * POST /api/bpo/centre-verification/media/:mediaId/replace
 * Replace existing media evidence with strict Anti-IDOR ownership protection
 */
router.post("/bpo/centre-verification/media/:mediaId/replace", requirePartnerAuth, uploadRateLimiter, async (req: UserRequest, res: Response) => {
  const mediaId = parseInt(String(req.params.mediaId), 10);
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const body = req.body || {};

  if (!mediaId || isNaN(mediaId)) return fail(res, 400, "Invalid media ID.");

  const originalFileName = body.fileName || body.file_name || `replacement_${Date.now()}.jpg`;
  const mimeType = body.mimeType || body.mime_type || "image/jpeg";
  const fileData = body.fileData || body.file_data || body.fileDataUrl || body.photoDataUrl;
  const durationSeconds = body.durationSeconds || body.duration_seconds || null;

  if (!fileData || typeof fileData !== "string") {
    return fail(res, 400, "Binary replacement file data is required.");
  }

  try {
    const { partnerId, centreId, partnerCode, applicationId } = await resolvePartnerAndCentreForUser(userId, userEmail);

    let buffer: Buffer;
    if (fileData.includes(",")) {
      buffer = Buffer.from(fileData.split(",")[1], "base64");
    } else {
      buffer = Buffer.from(fileData, "base64");
    }

    const result = await replaceMediaEvidence({
      mediaId,
      userId,
      partnerId,
      centreId: partnerCode || centreId,
      applicationId,
      isAdmin: req.user?.role === "admin",
      originalFileName,
      mimeType,
      fileBuffer: buffer,
      durationSeconds: durationSeconds ? Number(durationSeconds) : null,
    });

    if (!result.success) {
      return fail(res, result.status || 400, result.error || "Failed to replace media evidence.");
    }

    return res.json({
      success: true,
      message: "Media evidence replaced successfully.",
      media: result.media,
    });
  } catch (err: any) {
    logger.error({ error: err.message, mediaId, userId }, "Error replacing media evidence");
    return fail(res, 500, "Failed to replace media evidence.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN ENDPOINTS (Guarded by requireAuth / requireAdminStreamAuth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/bpo/centre-verifications
 * List all centre verifications with status filter and search
 */
router.get("/admin/bpo/centre-verifications", requireAuth, async (req: Request, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  try {
    const list = await getAllVerifications({ status, search });
    return res.json({
      success: true,
      count: list.length,
      verifications: list,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error fetching admin centre verifications");
    return fail(res, 500, "Failed to load verifications.");
  }
});

/**
 * GET /api/admin/bpo/centre-verifications/:id
 * Retrieve complete verification dossier (office details, photos, video, checklist, history)
 */
router.get("/admin/bpo/centre-verifications/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid verification ID.");

  try {
    const verif = await getVerificationById(id);
    if (!verif) return fail(res, 404, "Verification dossier not found.");

    // Informational human review checklist
    const checklist = [
      { key: "office_name_present", label: "Office / centre name provided", checked: Boolean(verif.officeName?.trim()) },
      { key: "full_address_present", label: "Full physical address provided", checked: Boolean(verif.addressLine1?.trim() && verif.city?.trim() && verif.state?.trim() && verif.postalCode?.trim()) },
      { key: "address_complete", label: "Address information is complete with contact number", checked: Boolean(verif.contactNumber?.trim() && verif.postalCode?.trim()) },
      { key: "photos_present", label: "Office photographs are present", checked: verif.media.filter((m) => m.mediaType === "photo" && m.status === "active").length > 0 },
      { key: "photos_readable", label: "Photographs cover core operational areas", checked: verif.media.filter((m) => m.mediaType === "photo" && m.status === "active").length >= 3 },
      { key: "video_present", label: "Live office walkthrough video is present", checked: verif.media.some((m) => m.mediaType === "video" && m.category === VIDEO_CATEGORY && m.status === "active") },
      { key: "video_playable", label: "Walkthrough video verified playable", checked: verif.media.some((m) => m.mediaType === "video" && m.status === "active" && m.fileSize > 0) },
      { key: "infrastructure_evidence", label: "Infrastructure evidence available (power backup / network)", checked: verif.media.some((m) => ["infrastructure_equipment", "network_setup", "power_backup"].includes(m.category)) },
      { key: "internally_consistent", label: "Submitted information internally consistent", checked: Boolean(verif.officeName && verif.operatingSince) },
    ];

    const completion = calculateEvidenceCompletion(verif);
    return res.json({
      success: true,
      verification: verif,
      checklist,
      photoCategories: PHOTO_CATEGORIES,
      completion,
    });
  } catch (err: any) {
    logger.error({ error: err.message, id }, "Error fetching admin centre verification dossier");
    return fail(res, 500, "Failed to load verification dossier.");
  }
});

/**
 * POST /api/admin/bpo/centre-verifications/:id/approve
 * Human Admin approval of Office / Centre verification
 * IMPORTANT: Does NOT activate partner; Agreement and other gates remain required.
 */
router.post(["/admin/bpo/centre-verifications/:id/approve", "/admin/bpo/centre-verification/:id/approve"], requireAuth, sensitiveMutationRateLimiter, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid verification ID.");

  const adminId = req.admin?.id || 1;
  const adminName = req.admin?.username || "Thinkatic Admin";

  try {
    const result = await approveCentreVerification({
      verificationId: id,
      adminId,
      adminName,
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to approve verification.");
    }

    return res.json({
      success: true,
      message: "Office / Centre Verification approved successfully.",
      verification: result.verification,
    });
  } catch (err: any) {
    logger.error({ error: err.message, id }, "Error approving centre verification");
    return fail(res, 500, "Failed to approve verification.");
  }
});

/**
 * POST /api/admin/bpo/centre-verifications/:id/reject
 * Reject verification with MANDATORY reason
 */
router.post(["/admin/bpo/centre-verifications/:id/reject", "/admin/bpo/centre-verification/:id/reject"], requireAuth, sensitiveMutationRateLimiter, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id || isNaN(id)) return fail(res, 400, "Invalid verification ID.");

  const { reason, rejectionReason } = req.body || {};
  const actualReason = reason || rejectionReason;

  if (!actualReason || typeof actualReason !== "string" || !actualReason.trim()) {
    return fail(res, 400, "Rejection reason is strictly mandatory. Please explain what corrections are required.");
  }

  const adminId = req.admin?.id || 1;
  const adminName = req.admin?.username || "Thinkatic Admin";

  try {
    const result = await rejectCentreVerification({
      verificationId: id,
      adminId,
      adminName,
      rejectionReason: actualReason.trim(),
    });

    if (!result.success) {
      return fail(res, 400, result.error || "Failed to reject verification.");
    }

    return res.json({
      success: true,
      message: "Office verification rejected. Reason recorded for partner correction.",
      verification: result.verification,
    });
  } catch (err: any) {
    logger.error({ error: err.message, id }, "Error rejecting centre verification");
    return fail(res, 500, "Failed to reject verification.");
  }
});

/**
 * GET /api/admin/bpo/centre-verifications/media/:mediaId
 * Secure streaming of photo or video for Admin reviewers
 */
router.get("/admin/bpo/centre-verifications/media/:mediaId", requireAdminStreamAuth, async (req: AdminRequest, res: Response) => {
  const mediaId = parseInt(String(req.params.mediaId), 10);
  if (!mediaId || isNaN(mediaId)) return fail(res, 400, "Invalid media ID.");

  try {
    const streamResult = await resolveMediaForStream({
      mediaId,
      requestingAdmin: req.admin,
    });

    if (!streamResult.allowed) {
      return fail(res, streamResult.status || 403, streamResult.error || "Access denied.");
    }

    return streamMediaResponse(req, res, streamResult);
  } catch (err: any) {
    logger.error({ error: err.message, mediaId }, "Error streaming admin verification media");
    return fail(res, 500, "Error streaming media file.");
  }
});
/**
 * POST /api/admin/bpo/centre-verifications/:id/media/:mediaId/review
 * Admin reviews individual evidence item (photo or video): approve, reject, or request resubmission
 */
router.post(
  [
    "/admin/bpo/centre-verifications/:id/media/:mediaId/review",
    "/admin/accreditation/applications/:id/media/:mediaId/review",
  ],
  requireAuth,
  async (req: AdminRequest, res: Response) => {
    const verificationId = parseInt(String(req.params.id), 10);
    const mediaId = parseInt(String(req.params.mediaId), 10);
    const body = req.body || {};

    if (!mediaId || isNaN(mediaId)) return fail(res, 400, "Invalid media ID.");

    const action = body.action as "approve" | "reject" | "resubmission_required";
    if (!action || !["approve", "reject", "resubmission_required"].includes(action)) {
      return fail(res, 400, "action must be 'approve', 'reject', or 'resubmission_required'.");
    }

    const rejectionReason = body.rejectionReason || body.reason || body.notes;
    if (action !== "approve" && (!rejectionReason || !String(rejectionReason).trim())) {
      return fail(res, 400, "A specific rejection reason is strictly mandatory when rejecting or requesting re-upload.");
    }

    const adminId = req.admin?.id || 1;
    const adminName = req.admin?.username || "Thinkatic Admin";

    try {
      const result = await reviewMediaEvidence({
        verificationId: !isNaN(verificationId) ? verificationId : undefined,
        mediaId,
        adminId,
        adminName,
        action,
        rejectionReason: rejectionReason ? String(rejectionReason).trim() : undefined,
        notes: body.notes ? String(body.notes).trim() : undefined,
      });

      if (!result.success) {
        return fail(res, result.status || 400, result.error || "Failed to review media evidence.");
      }

      return res.json({
        success: true,
        message: `Media evidence marked as ${action}.`,
        media: result.media,
      });
    } catch (err: any) {
      logger.error({ error: err.message, mediaId }, "Error in admin media review");
      return fail(res, 500, "Failed to record media review.");
    }
  }
);

export default router;
