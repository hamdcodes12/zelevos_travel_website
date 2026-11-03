// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — ONBOARDING PROGRESS RESOLVER SERVICE
// Single authoritative backend progress resolver. Calculates live onboarding state,
// dynamic stage statuses, dependency gating, correction priority, and next step URL
// from real persisted Supabase records.
// ==============================================================================

import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import { getApplicationForUser } from "../routes/partnerApplications.js";
import { getOrCreateVerification } from "./centreVerificationService.js";
import { getAgreementByPartnerId, getAgreementByApplicationId } from "./agreements.js";

export type OnboardingStageKey =
  | "account"
  | "company"
  | "centre"
  | "infrastructure"
  | "experience"
  | "documents"
  | "verification"
  | "agreement"
  | "approval";

export type OnboardingStageStatus =
  | "Complete"
  | "In Progress"
  | "Required"
  | "Pending"
  | "Needs Correction"
  | "Locked";

export interface OnboardingStage {
  key: OnboardingStageKey;
  label: string;
  status: OnboardingStageStatus;
  completed: boolean;
  isRequired: boolean;
  isLocked: boolean;
  actionUrl: string | null;
  correctionReason?: string | null;
  description?: string;
}

export interface OnboardingProgressResult {
  completedStages: number;
  totalStages: number;
  currentStage: OnboardingStageKey;
  nextActionStage: OnboardingStageKey;
  progressPercentage: number;
  stages: OnboardingStage[];
  milestones: OnboardingStage[]; // Backwards compatibility alias
  nextStepUrl: string;
  isUnder24HourReview: boolean;
  reviewNotice?: string;
  missingItems: string[];
  canEnterPortal: boolean;
  primaryCorrection?: {
    stage: OnboardingStageKey;
    label: string;
    reason: string;
    actionUrl: string;
  } | null;
}

/**
 * Calculates authoritative BPO onboarding progress for a given user.
 * Reads directly from Supabase profiles, applications, documents, centre verification, and agreements.
 */
export async function getOnboardingProgress(
  userId: string,
  cachedProfile?: any
): Promise<OnboardingProgressResult> {
  // 1. Fetch Profile if not provided
  let profile = cachedProfile;
  if (!profile) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, role, account_type, bpo_status, is_active, full_name, company_name")
        .eq("id", userId)
        .maybeSingle();
      if (data) profile = data;
    } catch (err: any) {
      logger.warn({ error: err.message, userId }, "Notice fetching profile in getOnboardingProgress");
    }
  }

  // 2. Fetch Application, Documents, Verification & Agreement in Parallel
  let appData: any = null;
  let documents: any[] = [];
  let verif: any = null;
  let agreement: any = null;

  try {
    const [appResult, verifResult, agreementResult] = await Promise.all([
      getApplicationForUser(userId),
      getOrCreateVerification({ applicantUserId: userId }),
      getAgreementByPartnerId(userId),
    ]);

    appData = appResult?.application || null;
    documents = appResult?.documents || [];
    verif = verifResult || null;
    agreement = agreementResult || null;

    if (!agreement && appData?.partner_id) {
      agreement = await getAgreementByPartnerId(appData.partner_id);
    }
    if (!agreement && appData?.id) {
      agreement = await getAgreementByApplicationId(Number(appData.id));
    }
  } catch (err: any) {
    logger.warn({ error: err.message, userId }, "Notice fetching onboarding records in getOnboardingProgress");
  }

  // 3. Stage 1: Account Created
  const isAccountComplete = true; // Authenticated user with profile record

  // 4. Stage 2: Company Information
  const cd = appData?.company_data || {};
  const hasCompanyName = Boolean(cd.companyName && String(cd.companyName).trim());
  const hasOwnerName = Boolean(cd.ownerName && String(cd.ownerName).trim());
  const hasEmail = Boolean(cd.email && String(cd.email).trim());
  const hasPhoneOrAddress = Boolean(
    (cd.phone && String(cd.phone).trim()) || (cd.address && String(cd.address).trim())
  );
  const isCompanyComplete = Boolean(hasCompanyName && hasOwnerName && hasEmail && hasPhoneOrAddress);
  const isCompanyPartial = !isCompanyComplete && Boolean(hasCompanyName || hasOwnerName || hasEmail);
  const isCompanyNeedsCorrection = Boolean(appData?.verification_checks?.company === false);
  const companyCorrectionReason = isCompanyNeedsCorrection
    ? (appData?.rejection_reason || "Company information requires correction and re-submission")
    : null;

  const companyStatus: OnboardingStageStatus = isCompanyNeedsCorrection
    ? "Needs Correction"
    : isCompanyComplete
    ? "Complete"
    : isCompanyPartial
    ? "In Progress"
    : "Required";

  // 5. Stage 3: Centre / Office Information
  const ctd = appData?.centre_data || {};
  const hasCentreName = Boolean(ctd.centreName && String(ctd.centreName).trim());
  const hasCentreAddress = Boolean(ctd.centreAddress && String(ctd.centreAddress).trim());
  const hasSeats = Boolean(ctd.totalSeats && Number(ctd.totalSeats) > 0);
  const isCentreComplete = Boolean(hasCentreName && hasCentreAddress && hasSeats);
  const isCentrePartial = !isCentreComplete && Boolean(hasCentreName || hasCentreAddress || ctd.totalSeats);
  const isCentreNeedsCorrection = Boolean(appData?.verification_checks?.centre === false);
  const centreCorrectionReason = isCentreNeedsCorrection
    ? (appData?.rejection_reason || "Centre details require correction and re-submission")
    : null;
  const isCentreLocked = !isCompanyComplete;

  const centreStatus: OnboardingStageStatus = isCentreNeedsCorrection
    ? "Needs Correction"
    : isCentreLocked
    ? "Locked"
    : isCentreComplete
    ? "Complete"
    : isCentrePartial
    ? "In Progress"
    : "Required";

  // 6. Stage 4: Infrastructure
  const inf = appData?.infrastructure_data || {};
  const hasBandwidth = Boolean(inf.internetBandwidth && String(inf.internetBandwidth).trim());
  const hasSecondaryInfra = Boolean(
    (inf.powerBackup && String(inf.powerBackup).trim()) ||
    (inf.backupInternet && String(inf.backupInternet).trim()) ||
    (inf.computers && String(inf.computers).trim()) ||
    (inf.primaryIsp && String(inf.primaryIsp).trim())
  );
  const isInfraComplete = Boolean(hasBandwidth && hasSecondaryInfra);
  const isInfraPartial = !isInfraComplete && Boolean(hasBandwidth || hasSecondaryInfra || inf.powerBackup || inf.computers);
  const isInfraNeedsCorrection = Boolean(appData?.verification_checks?.infrastructure === false);
  const infraCorrectionReason = isInfraNeedsCorrection
    ? (appData?.rejection_reason || "Infrastructure specifications require correction")
    : null;
  const isInfraLocked = !isCentreComplete;

  const infraStatus: OnboardingStageStatus = isInfraNeedsCorrection
    ? "Needs Correction"
    : isInfraLocked
    ? "Locked"
    : isInfraComplete
    ? "Complete"
    : isInfraPartial
    ? "In Progress"
    : "Required";

  // 7. Stage 5: Experience / Capacity
  const expList = appData?.process_experience || [];
  const hasExp = Boolean(
    (Array.isArray(expList) && expList.length > 0) ||
    (ctd.activeAgents && Number(ctd.activeAgents) > 0) ||
    appData?.status === "submitted" ||
    appData?.status === "approved"
  );
  const isExpNeedsCorrection = Boolean(appData?.verification_checks?.experience === false);
  const expCorrectionReason = isExpNeedsCorrection
    ? (appData?.rejection_reason || "Process capability experience requires correction")
    : null;
  const isExpLocked = !isInfraComplete;

  const expStatus: OnboardingStageStatus = isExpNeedsCorrection
    ? "Needs Correction"
    : isExpLocked
    ? "Locked"
    : hasExp
    ? "Complete"
    : "Required";

  // 8. Stage 6: Documents / KYC
  const docsList = documents || [];
  const hasRejectedDoc = docsList.some((d: any) => d.status === "rejected" || d.status === "resubmission_required") ||
    appData?.verification_checks?.documents === false;
  const rejectedDoc = docsList.find((d: any) => d.status === "rejected" || d.status === "resubmission_required");
  const docCorrectionReason = hasRejectedDoc
    ? (rejectedDoc?.rejection_reason || appData?.rejection_reason || "One or more uploaded compliance documents require re-submission")
    : null;

  const validDocs = docsList.filter((d: any) => d.status !== "rejected" && d.status !== "error");
  const isDocsComplete = (validDocs.length >= 3) ||
    appData?.status === "submitted" ||
    appData?.status === "approved" ||
    appData?.status === "under_review";
  const isDocsPartial = !isDocsComplete && validDocs.length > 0;
  const isDocsLocked = !isCentreComplete;

  const docsStatus: OnboardingStageStatus = hasRejectedDoc
    ? "Needs Correction"
    : isDocsLocked
    ? "Locked"
    : isDocsComplete
    ? "Complete"
    : isDocsPartial
    ? "In Progress"
    : "Required";

  // 9. Stage 7: Office / Centre Verification
  const verifStatusRaw = verif?.status || "NOT_STARTED";
  const isVerifApproved = verifStatusRaw === "APPROVED";
  const isVerifNeedsCorrection = verifStatusRaw === "RESUBMISSION_REQUIRED" || verifStatusRaw === "REJECTED";
  const isVerifUnderReview = verifStatusRaw === "SUBMITTED" || verifStatusRaw === "UNDER_REVIEW";
  const verifCorrectionReason = isVerifNeedsCorrection
    ? (verif?.rejectionReason || "Office verification requires correction and re-upload of media evidence")
    : null;

  const activeMedia = (verif?.media || []).filter((m: any) => m.status === "active");
  const hasPhotosOrVideo = activeMedia.length > 0;
  const isVerifPartial = !isVerifApproved && !isVerifNeedsCorrection && !isVerifUnderReview && (hasPhotosOrVideo || Boolean(verif?.officeName));
  const isVerifLocked = !isDocsComplete || !isCentreComplete;

  const verifStatus: OnboardingStageStatus = isVerifNeedsCorrection
    ? "Needs Correction"
    : isVerifLocked
    ? "Locked"
    : isVerifApproved
    ? "Complete"
    : isVerifUnderReview
    ? "In Progress"
    : isVerifPartial
    ? "In Progress"
    : "Required";

  // 10. Stage 8: Signed Agreement
  // Pre-requisites: Physical verification approved AND experience/capacity confirmed
  const isAgreementPrereqMet = isVerifApproved && hasExp && isInfraComplete;
  const isAgreementSigned = Boolean(
    agreement?.status === "approved" ||
    agreement?.status === "countersigned" ||
    agreement?.status === "executed" ||
    agreement?.status === "signed_submitted" ||
    agreement?.status === "signed_agreement_submitted" ||
    agreement?.signedDocumentUrl ||
    agreement?.signedDocumentFileName ||
    agreement?.signedSubmittedAt
  );
  const isAgreementNeedsCorrection = agreement?.status === "rejected";
  const agreementCorrectionReason = isAgreementNeedsCorrection
    ? (agreement?.rejectionReason || "Signed agreement was rejected and requires re-upload")
    : null;
  const isAgreementLocked = !isAgreementPrereqMet;

  const agreementStatus: OnboardingStageStatus = isAgreementNeedsCorrection
    ? "Needs Correction"
    : isAgreementLocked
    ? "Locked"
    : isAgreementSigned
    ? "Complete"
    : "Required";

  // 11. Stage 9: Final Thinkatic Approval
  const canEnterPortal = Boolean(
    (profile?.bpo_status === "APPROVED" && (profile?.role === "bpo_partner" || profile?.role === "partner")) &&
    isVerifApproved
  );
  const isFinalApproved = Boolean(canEnterPortal);
  const isFinalPending = !isFinalApproved && isAgreementSigned;
  const isApprovalLocked = !isAgreementSigned;

  const approvalStatus: OnboardingStageStatus = isFinalApproved
    ? "Complete"
    : isApprovalLocked
    ? "Locked"
    : isFinalPending
    ? "Pending"
    : "Locked";

  // 12. Assemble 9 Authoritative Stages
  const stages: OnboardingStage[] = [
    {
      key: "account",
      label: "Account Created",
      status: "Complete",
      completed: true,
      isRequired: true,
      isLocked: false,
      actionUrl: null,
      description: "Thinkatic BPO Partner account authenticated",
    },
    {
      key: "company",
      label: "Company Information",
      status: companyStatus,
      completed: companyStatus === "Complete",
      isRequired: true,
      isLocked: false,
      actionUrl: "/partner/apply?step=0",
      correctionReason: companyCorrectionReason,
      description: "Corporate legal entity & authorized contact details",
    },
    {
      key: "centre",
      label: "Centre / Office Information",
      status: centreStatus,
      completed: centreStatus === "Complete",
      isRequired: true,
      isLocked: centreStatus === "Locked",
      actionUrl: "/partner/apply?step=1",
      correctionReason: centreCorrectionReason,
      description: "Operational facility location & seat capacity",
    },
    {
      key: "infrastructure",
      label: "Infrastructure",
      status: infraStatus,
      completed: infraStatus === "Complete",
      isRequired: true,
      isLocked: infraStatus === "Locked",
      actionUrl: "/partner/apply?step=3",
      correctionReason: infraCorrectionReason,
      description: "Dual-ISP leased lines, power UPS & workstation hardware",
    },
    {
      key: "experience",
      label: "Experience / Capacity",
      status: expStatus,
      completed: expStatus === "Complete",
      isRequired: true,
      isLocked: expStatus === "Locked",
      actionUrl: "/partner/apply?step=4",
      correctionReason: expCorrectionReason,
      description: "Campaign delivery domain expertise & agent strength",
    },
    {
      key: "documents",
      label: "Documents / KYC",
      status: docsStatus,
      completed: docsStatus === "Complete",
      isRequired: true,
      isLocked: docsStatus === "Locked",
      actionUrl: "/partner/apply?step=2",
      correctionReason: docCorrectionReason,
      description: "Certificate of Incorporation, PAN, GST & ISP SLAs",
    },
    {
      key: "verification",
      label: "Office / Centre Verification",
      status: verifStatus,
      completed: verifStatus === "Complete",
      isRequired: true,
      isLocked: verifStatus === "Locked",
      actionUrl: "/partner?tab=verification",
      correctionReason: verifCorrectionReason,
      description: "Physical audit with 6 geotagged photos & video walkthrough",
    },
    {
      key: "agreement",
      label: "Signed Agreement",
      status: agreementStatus,
      completed: agreementStatus === "Complete",
      isRequired: true,
      isLocked: agreementStatus === "Locked",
      actionUrl: "/partner?tab=agreement",
      correctionReason: agreementCorrectionReason,
      description: "Master Global Delivery Partner SLA Agreement PDF",
    },
    {
      key: "approval",
      label: "Final Thinkatic Approval",
      status: approvalStatus,
      completed: approvalStatus === "Complete",
      isRequired: true,
      isLocked: approvalStatus === "Locked",
      actionUrl: "/partner",
      description: "Operations team final accreditation & portal unlock",
    },
  ];

  // 13. Exact Dynamic Completion Calculation
  const totalStages = 9;
  const completedStages = stages.filter((s) => s.completed).length;
  // Progress formula: Math.round((completedStages / totalStages) * 100)
  // Account only (1/9) = 11%
  // Account + Company (2/9) = 22%
  // 6/9 = 67%
  // 8/9 = 89%
  // 9/9 = 100%
  const progressPercentage = Math.round((completedStages / totalStages) * 100);

  // 14. Missing Items List
  const missingItems: string[] = [];
  if (!isCompanyComplete) missingItems.push("Company Information");
  if (!isCentreComplete) missingItems.push("Centre / Office Information");
  if (!isInfraComplete) missingItems.push("Infrastructure Specifications");
  if (!hasExp) missingItems.push("Experience & Capacity Details");
  if (!isDocsComplete) missingItems.push(`Compliance Documents (${validDocs.length}/3 uploaded)`);
  if (!isVerifApproved) {
    if (isVerifNeedsCorrection) missingItems.push("Office Verification (Correction Required)");
    else if (isVerifUnderReview) missingItems.push("Office Verification (Under Operations Review)");
    else missingItems.push("Office / Centre Verification");
  }
  if (!isAgreementSigned) {
    if (isAgreementNeedsCorrection) missingItems.push("Signed Agreement (Correction Required)");
    else missingItems.push("Signed Partner Agreement");
  }
  if (!canEnterPortal && isAgreementSigned) {
    missingItems.push("Final Operations Accreditation Review");
  }

  // 15. Intelligent Resolution of Next Action Stage & Next Step URL
  // Priority 1: NEEDS CORRECTION HAS ABSOLUTE PRIORITY
  const correctionStage = stages.find((s) => s.status === "Needs Correction");

  let nextActionStage: OnboardingStageKey = "company";
  let nextStepUrl = "/partner/apply?step=0";
  let primaryCorrection: OnboardingProgressResult["primaryCorrection"] = null;

  if (correctionStage) {
    nextActionStage = correctionStage.key;
    nextStepUrl = correctionStage.actionUrl || "/partner";
    primaryCorrection = {
      stage: correctionStage.key,
      label: correctionStage.label,
      reason: correctionStage.correctionReason || "Action required: please review and correct this stage.",
      actionUrl: nextStepUrl,
    };
  } else {
    // Priority 2: Sequential Onboarding Flow Order
    // Account -> Company -> Office -> Documents -> Verification -> Capacity (Infra + Exp) -> Agreement -> Review -> Final Approval
    if (!isCompanyComplete) {
      nextActionStage = "company";
      nextStepUrl = "/partner/apply?step=0";
    } else if (!isCentreComplete) {
      nextActionStage = "centre";
      nextStepUrl = "/partner/apply?step=1";
    } else if (!isDocsComplete) {
      nextActionStage = "documents";
      nextStepUrl = "/partner/apply?step=2";
    } else if (!isVerifApproved) {
      nextActionStage = "verification";
      nextStepUrl = "/partner?tab=verification";
    } else if (!isInfraComplete) {
      nextActionStage = "infrastructure";
      nextStepUrl = "/partner/apply?step=3";
    } else if (!hasExp) {
      nextActionStage = "experience";
      nextStepUrl = "/partner/apply?step=4";
    } else if (!isAgreementSigned) {
      nextActionStage = "agreement";
      nextStepUrl = "/partner?tab=agreement";
    } else if (
      appData?.status !== "submitted" &&
      appData?.status !== "under_review" &&
      appData?.status !== "approved"
    ) {
      // Step 6: Review & Final Submit in wizard
      nextActionStage = "agreement";
      nextStepUrl = "/partner/apply?step=6";
    } else {
      // Final Approval Pending (Under 24-Hour Operations Review)
      nextActionStage = "approval";
      nextStepUrl = "/partner";
    }
  }

  // 16. Determine Current Active Stage
  const currentStage: OnboardingStageKey = nextActionStage;

  // 17. 24-Hour Operations Review State
  const isUnder24HourReview = Boolean(
    isAgreementSigned &&
    (appData?.status === "submitted" || appData?.status === "under_review") &&
    !canEnterPortal
  );

  return {
    completedStages,
    totalStages,
    currentStage,
    nextActionStage,
    progressPercentage,
    stages,
    milestones: stages, // Alias for component compatibility
    nextStepUrl,
    isUnder24HourReview,
    reviewNotice: isUnder24HourReview
      ? "Your signed agreement and application have been submitted to Thinkatic Operations. Please allow up to 24 hours for review."
      : undefined,
    missingItems,
    canEnterPortal,
    primaryCorrection,
  };
}
