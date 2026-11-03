// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — AUTHORITATIVE BPO STATUS ROUTE
// Provides single source of truth for user authentication & BPO onboarding state.
// Never trusts frontend variables. Authoritative backend gating for portal access.
// ==============================================================================

import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "@workspace/db";
import { logger } from "../lib/logger.js";
import {
  getOrCreateVerification,
  PHOTO_CATEGORIES,
  VIDEO_CATEGORY,
} from "../lib/centreVerificationService.js";
import { getApplicationForUser } from "./partnerApplications.js";
import { getAgreementByPartnerId, getAgreementByApplicationId } from "../lib/agreements.js";
import { getOnboardingProgress } from "../lib/onboardingProgressService.js";
import { requireUserAuth } from "./user.js";

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

const REQUIRED_PHOTO_CATEGORY_IDS = PHOTO_CATEGORIES.filter((c) => c.required).map((c) => c.id);

/**
 * GET /api/bpo/status
 * Returns authoritative state for navigation, button CTAs, and portal access gating.
 */
router.get(["/bpo/status", "/bpo/status/me"], async (req: Request, res: Response) => {
  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }

  // Check for admin token
  const adminToken = typeof req.query.admin_token === "string" ? req.query.admin_token : undefined;
  if (adminToken) {
    try {
      jwt.verify(adminToken, ADMIN_JWT_SECRET);
      return res.json({
        authenticated: true,
        accountState: "ADMIN",
        isAdmin: true,
        navAction: {
          label: "Admin Portal",
          href: "/admin",
        },
      });
    } catch {}
  }

  // 1. Unauthenticated Caller
  if (!token) {
    return res.json({
      authenticated: false,
      accountState: "UNAUTHENTICATED",
      hasBpoApplication: false,
      application: null,
      centreVerification: null,
      canEnterPortal: false,
      navAction: {
        label: "Become a BPO Partner",
        href: "/signup?role=bpo",
      },
    });
  }

  // 2. Validate Session
  let payload: { id: string; email: string; role?: string; bpoStatus?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role?: string; bpoStatus?: string };
  } catch (err) {
    return res.json({
      authenticated: false,
      accountState: "UNAUTHENTICATED",
      hasBpoApplication: false,
      application: null,
      centreVerification: null,
      canEnterPortal: false,
      navAction: {
        label: "Become a BPO Partner",
        href: "/signup?role=bpo",
      },
    });
  }

  const userId = payload.id;

  // 3. Fetch User Profile
  let profile: any = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, account_type, bpo_status, is_active, full_name, bpo_application_details")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) profile = data;
  } catch {}

  if (!profile) {
    profile = {
      id: userId,
      role: payload.role || "user",
      account_type: payload.role === "bpo_partner" || payload.role === "partner" || payload.id.includes("partner") || payload.id.includes("bpo") ? "BPO" : "USER",
      bpo_status: payload.bpoStatus || "PENDING",
      is_active: true,
    };
  }

  // Suspended / Administratively Held account
  const appDetailsRaw = (profile.bpo_application_details || {}) as Record<string, any>;
  const isSuspended = profile.is_active === false || appDetailsRaw.suspended === true;
  if (isSuspended && profile.bpo_status !== "REJECTED") {
    const suspensionReason =
      appDetailsRaw.suspensionReason ||
      appDetailsRaw.reason ||
      appDetailsRaw.resubmissionReason ||
      "Routine compliance review by Thinkatic Operations";
    return res.json({
      authenticated: true,
      accountState: "BPO_SUSPENDED",
      status: "UNDER_REVIEW",
      isSuspended: true,
      isOperationalLocked: true,
      suspensionReason,
      message: "Your BPO Partner account is temporarily under review by Thinkatic Operations. Please review the information below and wait for further instructions.",
      hasBpoApplication: true,
      application: null,
      centreVerification: null,
      canEnterPortal: false,
      navAction: {
        label: "Account Under Review",
        href: "/partner",
      },
    });
  }

  // 4. Fetch BPO Application, Centre Verification & Legal Agreement in Parallel
  let appData: any = null;
  let verif: any = null;
  let agreement: any = null;

  try {
    const [appResult, verifResult, agreementResult] = await Promise.all([
      getApplicationForUser(userId),
      getOrCreateVerification({ applicantUserId: userId }),
      getAgreementByPartnerId(userId),
    ]);

    appData = appResult.application;
    verif = verifResult;
    agreement = agreementResult;

    if (!agreement && appData?.partner_id) {
      agreement = await getAgreementByPartnerId(appData.partner_id);
    }
    if (!agreement && appData?.id) {
      agreement = await getAgreementByApplicationId(Number(appData.id));
    }
  } catch (err: any) {
    logger.warn({ err: err.message, userId }, "Error fetching BPO application/verification/agreement state");
  }

  // 5. Calculate Centre Verification Completeness
  const hasOfficeName = Boolean(verif?.officeName && verif.officeName.trim());
  const hasAddress = Boolean(
    verif?.addressLine1 &&
    verif.addressLine1.trim() &&
    verif?.city &&
    verif.city.trim() &&
    verif?.state &&
    verif.state.trim() &&
    verif?.postalCode &&
    verif.postalCode.trim()
  );
  const hasContact = Boolean(verif?.contactNumber && verif.contactNumber.trim());
  const officeDetailsComplete = Boolean(hasOfficeName && hasAddress && hasContact);

  // Missing office details items
  const missingOfficeDetails: string[] = [];
  if (!hasOfficeName) missingOfficeDetails.push("Centre / Office Name");
  if (!verif?.addressLine1?.trim()) missingOfficeDetails.push("Address Line 1");
  if (!verif?.city?.trim()) missingOfficeDetails.push("City");
  if (!verif?.state?.trim()) missingOfficeDetails.push("State");
  if (!verif?.postalCode?.trim()) missingOfficeDetails.push("Postal / ZIP Code");
  if (!hasContact) missingOfficeDetails.push("Office Contact Number");

  const officeDetailsStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" =
    officeDetailsComplete
      ? "COMPLETED"
      : missingOfficeDetails.length < 6 && (hasOfficeName || hasAddress || hasContact)
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  // Active Photos calculation
  const activePhotos =
    verif?.media?.filter((m: any) => m.mediaType === "photo" && m.status === "active") || [];

  const uploadedRequiredCategories = new Set(
    activePhotos
      .map((m: any) => m.category)
      .filter((cat: string) => (REQUIRED_PHOTO_CATEGORY_IDS as readonly string[]).includes(cat))
  );

  const photosUploadedCount = uploadedRequiredCategories.size;
  const photosRequiredCount = REQUIRED_PHOTO_CATEGORY_IDS.length; // 6
  const photosComplete = photosUploadedCount >= photosRequiredCount;

  const missingPhotoCategories = PHOTO_CATEGORIES
    .filter((c) => c.required && !uploadedRequiredCategories.has(c.id))
    .map((c) => c.label);

  const photosStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" =
    photosComplete
      ? "COMPLETED"
      : photosUploadedCount > 0
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  // Video calculation
  const activeVideo = verif?.media?.find(
    (m: any) => m.mediaType === "video" && m.category === VIDEO_CATEGORY && m.status === "active"
  );
  const videoRecorded = Boolean(activeVideo);
  const videoComplete = Boolean(activeVideo);

  let videoStatus: "NOT_STARTED" | "RECORDING" | "UPLOADED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" = "NOT_STARTED";
  if (verif?.status === "APPROVED") {
    videoStatus = "APPROVED";
  } else if (verif?.status === "REJECTED" || verif?.status === "RESUBMISSION_REQUIRED") {
    videoStatus = "REJECTED";
  } else if (verif?.status === "SUBMITTED" || verif?.status === "UNDER_REVIEW") {
    videoStatus = "UNDER_REVIEW";
  } else if (activeVideo) {
    videoStatus = "UPLOADED";
  }

  const verifStatus = verif?.status || "NOT_STARTED";
  const isCentreApproved = verifStatus === "APPROVED";
  const isCentreUnderReview = verifStatus === "SUBMITTED" || verifStatus === "UNDER_REVIEW";
  const isCentreRejected = verifStatus === "REJECTED" || verifStatus === "RESUBMISSION_REQUIRED";

  // 6. Calculate Agreement Completeness
  const hasAgreement = Boolean(agreement);
  const isAgreementSubmitted = Boolean(
    agreement?.status === "signed_submitted" ||
    agreement?.signedDocumentUrl ||
    agreement?.signedSubmittedAt
  );
  const isAgreementApproved = agreement?.status === "approved";
  const isAgreementRejected = agreement?.status === "rejected";

  // Missing items summary
  const missingItems: string[] = [];
  if (!officeDetailsComplete) missingItems.push("Office Details Required");
  if (!photosComplete) missingItems.push(`Office Photos Required (${photosUploadedCount}/${photosRequiredCount} uploaded)`);
  if (!videoComplete) missingItems.push("Live Office Video Required");
  if (!isAgreementSubmitted && !isAgreementApproved) missingItems.push("Signed Agreement Required");

  // 7. Application State & Overall Status
  const appStatus = appData?.status || null;
  const hasApp = Boolean(appData);
  const isAppApproved = appStatus === "approved";
  const isAppPending = ["submitted", "under_review", "infrastructure_check", "management_check", "trial_assessment", "documents_required"].includes(appStatus);
  const isAppDraft = appStatus === "draft";
  const isAppRejected = appStatus === "rejected";

  // Detailed Section Validation
  const hasCompanyInfo = Boolean(
    appData?.company_data?.companyName &&
    appData?.company_data?.email &&
    (appData?.company_data?.phone || appData?.company_data?.address)
  );
  const hasCentreInfo = Boolean(
    appData?.centre_data?.centreName &&
    appData?.centre_data?.totalSeats
  );
  const hasInfraInfo = Boolean(
    appData?.infrastructure_data?.internetBandwidth ||
    appData?.infrastructure_data?.primaryIsp ||
    appData?.infrastructure_data?.powerBackup
  );
  const hasExpInfo = Boolean(
    Array.isArray(appData?.process_experience) &&
    appData.process_experience.length > 0
  );
  const hasDocsInfo = Boolean(
    (appData?.documents && appData.documents.length >= 1) ||
    appStatus === "submitted" ||
    isAppApproved
  );

  // Active Partner Gating:
  // Approved BPO application AND Approved Centre Verification AND Active role
  const isProfileApproved = (profile.bpo_status === "APPROVED" && (profile.role === "bpo_partner" || profile.role === "partner"));
  const canEnterPortal = Boolean(isProfileApproved && isCentreApproved);

  // 8. Compute Authoritative Dynamic Onboarding Progress
  const progress = await getOnboardingProgress(userId, profile);

  // 9. Determine Authoritative Account State
  let accountState:
    | "UNAUTHENTICATED"
    | "CLIENT"
    | "ACCOUNT_CREATED"
    | "BPO_ONBOARDING"
    | "BPO_PENDING"
    | "BPO_APPROVED"
    | "CENTRE_VERIFICATION_REQUIRED"
    | "CENTRE_VERIFICATION_SUBMITTED"
    | "AGREEMENT_REQUIRED"
    | "AGREEMENT_SUBMITTED"
    | "FINAL_REVIEW"
    | "BPO_ACTIVE"
    | "BPO_REJECTED"
    | "BPO_RESUBMISSION_REQUIRED"
    | "BPO_SUSPENDED"
    | "ADMIN";

  if (profile.bpo_status === "APPROVED" && profile.is_active && !isSuspended) {
    accountState = "BPO_ACTIVE";
  } else if (progress.canEnterPortal) {
    accountState = "BPO_ACTIVE";
  } else if (progress.primaryCorrection) {
    accountState = "BPO_RESUBMISSION_REQUIRED";
  } else if (isAppRejected || profile.bpo_status === "REJECTED" || isAgreementRejected) {
    accountState = "BPO_REJECTED";
  } else if (isAppDraft) {
    accountState = "BPO_ONBOARDING";
  } else if (progress.isUnder24HourReview || (isAgreementSubmitted && (isAppPending || isAppApproved))) {
    accountState = "FINAL_REVIEW";
  } else if (isCentreApproved) {
    accountState = "AGREEMENT_REQUIRED";
  } else if (isCentreUnderReview) {
    accountState = "CENTRE_VERIFICATION_SUBMITTED";
  } else if (isAppApproved) {
    accountState = "CENTRE_VERIFICATION_REQUIRED";
  } else if (isAppPending) {
    accountState = "BPO_PENDING";
  } else if (profile.account_type === "BPO" || profile.role === "bpo_partner") {
    accountState = hasApp ? "BPO_ONBOARDING" : "ACCOUNT_CREATED";
  } else {
    accountState = "CLIENT";
  }

  // 10. Context-Aware Navigation & CTA
  let navAction: { label: string; href: string; portalLabel?: string; portalHref?: string };

  switch (accountState) {
    case "BPO_ACTIVE":
      navAction = {
        label: "Open BPO Partner Portal",
        href: "/partner",
        portalLabel: "Portal",
        portalHref: "/partner",
      };
      break;

    case "BPO_RESUBMISSION_REQUIRED":
      navAction = {
        label: progress.primaryCorrection?.label ? `Fix ${progress.primaryCorrection.label}` : "Action Required",
        href: progress.nextStepUrl,
        portalLabel: "Portal",
        portalHref: "/partner",
      };
      break;

    case "FINAL_REVIEW":
      navAction = {
        label: "Application Under Review",
        href: "/partner",
        portalLabel: "Portal",
        portalHref: "/partner",
      };
      break;

    case "AGREEMENT_REQUIRED":
      navAction = {
        label: "Complete Agreement",
        href: progress.nextStepUrl || "/partner?tab=agreement",
        portalLabel: "Portal",
        portalHref: "/partner?tab=agreement",
      };
      break;

    case "CENTRE_VERIFICATION_SUBMITTED":
      navAction = {
        label: "Verification Under Review",
        href: "/partner?tab=verification",
        portalLabel: "Portal",
        portalHref: "/partner?tab=verification",
      };
      break;

    case "CENTRE_VERIFICATION_REQUIRED":
      navAction = {
        label: "Complete Centre Verification",
        href: progress.nextStepUrl || "/partner?tab=verification",
        portalLabel: "Portal",
        portalHref: "/partner?tab=verification",
      };
      break;

    case "BPO_PENDING":
      navAction = {
        label: "View Application Status",
        href: "/partner",
        portalLabel: "Portal",
        portalHref: "/partner",
      };
      break;

    case "BPO_ONBOARDING":
    case "ACCOUNT_CREATED":
      navAction = {
        label: "Continue Onboarding",
        href: progress.nextStepUrl || "/partner/apply",
        portalLabel: "Portal",
        portalHref: "/partner",
      };
      break;

    case "BPO_REJECTED":
      navAction = {
        label: "View Application Status",
        href: "/partner",
        portalLabel: "Portal",
        portalHref: "/partner",
      };
      break;

    case "CLIENT":
    default:
      navAction = {
        label: "Become a BPO Partner",
        href: "/signup?role=bpo",
        portalLabel: "Client Portal",
        portalHref: "/dashboard",
      };
      break;
  }

  return res.json({
    authenticated: true,
    accountState,
    status: isSuspended ? "UNDER_REVIEW" : profile.bpo_status,
    bpoStatus: isSuspended ? "UNDER_REVIEW" : profile.bpo_status,
    isSuspended: Boolean(isSuspended),
    suspensionReason: isSuspended ? (appDetailsRaw.suspensionReason || appDetailsRaw.reason || null) : null,
    hasBpoApplication: hasApp,
    canEnterPortal: Boolean((profile.bpo_status === "APPROVED" && profile.is_active && !isSuspended) || progress.canEnterPortal),
    isOperationalLocked: Boolean(isSuspended || (!progress.canEnterPortal && !(profile.bpo_status === "APPROVED" && profile.is_active))),
    onboardingProgress: progress,
    onboardingSummary: {
      progressPercent: progress.progressPercentage,
      progressPercentage: progress.progressPercentage,
      completedStages: progress.completedStages,
      totalStages: progress.totalStages,
      currentStage: progress.currentStage,
      nextActionStage: progress.nextActionStage,
      isComplete: progress.canEnterPortal,
      isUnder24HourReview: progress.isUnder24HourReview,
      reviewNotice: progress.reviewNotice || "Your signed agreement has been submitted to Thinkatic Operations. Please allow up to 24 hours for review.",
      milestones: progress.stages,
      stages: progress.stages,
      canEnterPortal: Boolean((profile.bpo_status === "APPROVED" && profile.is_active && !isSuspended) || progress.canEnterPortal),
      missingItems: progress.missingItems,
      nextStepUrl: progress.nextStepUrl,
      primaryCorrection: progress.primaryCorrection,
    },
    user: {
      id: userId,
      email: payload.email,
      role: profile.role,
      accountType: profile.account_type,
      bpoStatus: profile.bpo_status,
      fullName: profile.full_name,
      companyName: profile.company_name,
    },
    application: appData
      ? {
          id: appData.id,
          applicationNumber: appData.application_number,
          status: appData.status,
          currentStage: appData.current_stage,
          centreId: appData.centre_id,
          submittedAt: appData.submitted_at,
          createdAt: appData.created_at,
          rejectionReason: appData.rejection_reason || null,
        }
      : null,
    formalApplication: appData
      ? {
          id: appData.id,
          applicationNumber: appData.application_number,
          status: appData.status,
          currentStage: appData.current_stage,
          centreId: appData.centre_id,
          submittedAt: appData.submitted_at,
          createdAt: appData.created_at,
          rejectionReason: appData.rejection_reason || null,
        }
      : null,
    centreVerification: {
      id: verif?.id || null,
      status: verifStatus,
      officeDetailsStatus,
      officeDetailsComplete,
      missingOfficeDetails,
      photosStatus,
      photosUploadedCount,
      photosRequiredCount,
      photosComplete,
      missingPhotoCategories,
      totalPhotosCount: activePhotos.length,
      videoStatus,
      videoRecorded,
      videoComplete,
      videoFileName: activeVideo?.originalFileName || null,
      isApproved: isCentreApproved,
      isUnderReview: isCentreUnderReview,
      isRejected: isCentreRejected,
      rejectionReason: verif?.rejectionReason || null,
      missingItems,
    },
    agreement: agreement
      ? {
          id: agreement.id,
          agreementCode: agreement.agreementCode,
          version: agreement.version,
          status: agreement.status,
          isSubmitted: isAgreementSubmitted,
          isApproved: isAgreementApproved,
          isRejected: isAgreementRejected,
          rejectionReason: agreement.rejectionReason || null,
          signedSubmittedAt: agreement.signedSubmittedAt || null,
        }
      : null,
    navAction,
  });
});

/**
 * GET /api/bpo/profile
 * Authoritative, isolated BPO Partner Profile endpoint.
 * Strictly scoped to authenticated session user (zero IDOR risk, no arbitrary partnerId).
 * Reads real profile, partner, centre, and verification data from Supabase.
 * Returns only genuine database values — zero dummy/mock placeholders.
 */
router.get("/bpo/profile", requireUserAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = user.id;
  const userEmail = user.email || "";

  try {
    // 1. Fetch user profile from Supabase
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, account_type, bpo_status, bpo_application_details")
      .eq("id", userId)
      .maybeSingle();

    // 2. Fetch linked partner organization via bpo_partner_users
    let partner: any = null;
    try {
      const { data: membership } = await supabase
        .from("bpo_partner_users")
        .select("id, partner_id, role, status, bpo_partners(*)")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (membership && (membership as any).bpo_partners) {
        partner = (membership as any).bpo_partners;
      }
    } catch {}

    // Fallback: direct check by email or id in bpo_partners
    if (!partner && userEmail) {
      try {
        const { data: directByEmail } = await supabase
          .from("bpo_partners")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();
        if (directByEmail) partner = directByEmail;
      } catch {}
    }
    if (!partner) {
      try {
        const { data: directById } = await supabase
          .from("bpo_partners")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (directById) partner = directById;
      } catch {}
    }

    // 3. Fetch linked delivery centre for this partner
    let centre: any = null;
    if (partner?.id) {
      try {
        const { data: centreData } = await supabase
          .from("bpo_centres")
          .select("id, name, location, capacity, status")
          .eq("partner_id", partner.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (centreData) centre = centreData;
      } catch {}
    }

    // 4. Fetch centre verification data for this applicant user
    let verif: any = null;
    try {
      const { data: verifData } = await supabase
        .from("bpo_centre_verification")
        .select("office_name, contact_number, address_line_1, address_line_2, city, state")
        .eq("applicant_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (verifData) verif = verifData;
    } catch {}

    // 5. Fetch partner application data for this user
    let appData: any = null;
    try {
      const appResult = await getApplicationForUser(userId);
      appData = appResult.application;
    } catch {}

    // Extract bpo_application_details if stored on profile
    const appDetails = (profile?.bpo_application_details || {}) as Record<string, any>;

    // 6. Synthesize the 4 authoritative fields strictly from real data
    const partnerName =
      partner?.contact_name ||
      profile?.full_name ||
      verif?.contact_person ||
      appData?.applicant_name ||
      "";

    const centreName =
      centre?.name ||
      verif?.office_name ||
      appData?.centre_data?.centreName ||
      partner?.name ||
      partner?.legal_name ||
      appData?.company_name ||
      (appDetails.companyName !== "None" ? appDetails.companyName : "") ||
      "";

    const mobileNumber =
      partner?.phone ||
      verif?.contact_number ||
      verif?.contact_phone ||
      appData?.phone ||
      appDetails.phone ||
      "";

    const email =
      partner?.email ||
      profile?.email ||
      userEmail ||
      verif?.contact_email ||
      appData?.email ||
      "";

    return res.json({
      partnerName,
      centreName,
      mobileNumber,
      email,
      // Common aliases for seamless component consumption
      name: partnerName,
      contact_name: partnerName,
      company_name: centreName,
      phone: mobileNumber,
      partner_code: partner?.partner_code || null,
      status: partner?.status || profile?.bpo_status || "active",
    });
  } catch (err: any) {
    logger.error({ err: err?.message, userId }, "Failed to fetch BPO partner profile");
    return res.status(500).json({ error: "Failed to load partner profile" });
  }
});

export default router;
