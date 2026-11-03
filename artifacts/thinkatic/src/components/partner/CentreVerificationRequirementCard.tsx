// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — CENTRE VERIFICATION REQUIREMENT CARD
// World-class enterprise validation component displayed when BPO partner access
// is gated by incomplete physical office / centre verification evidence.
// Brand: Thinkatic Blue (#214ECF), White Card, Dark Navy, 20px radius, Soft Shadow.
// ==============================================================================

import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Camera,
  Video,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import type { BpoCentreVerificationSummary } from "@/hooks/useBpoState";

interface CentreVerificationRequirementCardProps {
  centreVerification: BpoCentreVerificationSummary | null;
  applicationNumber?: string;
  onCompleteClick?: () => void;
  targetHref?: string;
  isDashboardModal?: boolean;
  targetElementId?: string;
  onAction?: () => void;
}

export default function CentreVerificationRequirementCard({
  centreVerification,
  applicationNumber,
  onCompleteClick,
  targetHref = "/partner/application-status#office-verification",
  isDashboardModal = false,
}: CentreVerificationRequirementCardProps) {
  const verif = centreVerification;
  const status = verif?.status || "NOT_STARTED";
  const isApproved = status === "APPROVED";
  const isSubmitted = status === "SUBMITTED" || status === "UNDER_REVIEW";
  const isRejected = status === "REJECTED" || status === "RESUBMISSION_REQUIRED";

  const photosCount = verif?.photosUploadedCount ?? 0;
  const photosRequired = verif?.photosRequiredCount ?? 6;
  const photosComplete = verif?.photosComplete ?? false;

  const officeComplete = verif?.officeDetailsComplete ?? false;
  const videoComplete = verif?.videoComplete ?? false;

  // Calculate overall completeness progress percentage (0 - 100)
  let stepsDone = 1; // Step 1: BPO Application is approved
  if (officeComplete) stepsDone += 1;
  if (photosComplete) stepsDone += 1;
  if (videoComplete) stepsDone += 1;
  if (isApproved) stepsDone += 1;
  const progressPercent = Math.round((stepsDone / 5) * 100);

  const handleAction = () => {
    if (onCompleteClick) {
      onCompleteClick();
    } else {
      const el = document.getElementById("office-verification");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      } else if (targetHref) {
        window.location.href = targetHref;
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-xs ${
        isDashboardModal ? "max-w-2xl mx-auto" : "w-full"
      }`}
    >
      {/* Header Accent & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] ring-8 ring-blue-50/50">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-black text-[#214ECF] bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Centre Verification
              </span>
              {applicationNumber && (
                <span className="font-mono text-[11px] font-bold text-slate-500">
                  {applicationNumber}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-xl font-black text-[#0B1F3A] tracking-tight">
              Complete Your Centre Verification
            </h3>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div>
          {status === "NOT_STARTED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              Not Started
            </span>
          )}
          {status === "IN_PROGRESS" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-[#214ECF]">
              <Clock className="h-3.5 w-3.5 text-[#214ECF]" />
              In Progress ({stepsDone}/5)
            </span>
          )}
          {isSubmitted && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-300 px-3 py-1 text-xs font-black text-amber-800 animate-pulse">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              Under Review
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-300 px-3 py-1 text-xs font-black text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              Resubmission Required
            </span>
          )}
          {isApproved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-black text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Approved & Activated
            </span>
          )}
        </div>
      </div>

      {/* Subtitle / Explanation */}
      <p className="mt-5 text-sm text-slate-600 leading-relaxed max-w-2xl">
        Your BPO account is approved, but Physical Facility & Centre Verification is still incomplete.
        Provide your office details, upload the required facility photographs, and submit a live browser video walkthrough to activate production allocation.
      </p>

      {/* Rejection Rationale Alert if resubmission is requested */}
      {isRejected && verif?.rejectionReason && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                Action Required — Auditor Feedback:
              </h4>
              <p className="text-xs font-bold text-rose-800">
                {verif.rejectionReason}
              </p>
              <p className="text-[11px] text-rose-600">
                Please update the required evidence below and resubmit for manual audit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-6 space-y-1.5">
        <div className="flex justify-between text-xs font-bold text-slate-600">
          <span>Verification Requirements</span>
          <span className="font-mono text-[#214ECF]">{progressPercent}% Completed</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#214ECF] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Structured Enterprise Checklist */}
      <div className="mt-6 space-y-2.5">
        {/* Step 1: BPO Application Approval */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-900">
              1. BPO Partner Application
            </span>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase">
            Approved
          </span>
        </div>

        {/* Step 2: Office Details */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                officeComplete
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {officeComplete ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-400" />
              )}
            </div>
            <span className="text-xs font-bold text-slate-900">
              2. Facility Address & Operating Details
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
              officeComplete
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {officeComplete ? "Completed" : "Office Details Required"}
          </span>
        </div>

        {/* Step 3: Office Photos */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                photosComplete
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {photosComplete ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Camera className="h-3 w-3 text-slate-600" />
              )}
            </div>
            <span className="text-xs font-bold text-slate-900">
              3. Categorized Office Photos ({photosCount} / {photosRequired} uploaded)
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
              photosComplete
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {photosComplete ? "Completed" : `${photosCount} / ${photosRequired} uploaded`}
          </span>
        </div>

        {/* Step 4: Live Video Walkthrough */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                videoComplete
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {videoComplete ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Video className="h-3 w-3 text-slate-600" />
              )}
            </div>
            <span className="text-xs font-bold text-slate-900">
              4. Live Browser Video Walkthrough
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
              videoComplete
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {videoComplete ? "Recorded & Uploaded" : "Live Office Video Required"}
          </span>
        </div>

        {/* Step 5: Final Human Audit */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                isApproved
                  ? "bg-emerald-100 text-emerald-700"
                  : isSubmitted
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {isApproved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isSubmitted ? (
                <Clock className="h-3 w-3 text-amber-700" />
              ) : (
                <ShieldCheck className="h-3 w-3 text-slate-500" />
              )}
            </div>
            <span className="text-xs font-bold text-slate-900">
              5. Final Operations Audit & Activation
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
              isApproved
                ? "bg-emerald-100 text-emerald-800"
                : isSubmitted
                ? "bg-amber-100 text-amber-900"
                : isRejected
                ? "bg-rose-100 text-rose-900"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {isApproved
              ? "Accredited"
              : isSubmitted
              ? "Under Review"
              : isRejected
              ? "Needs Resubmission"
              : "Pending Completion"}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {isSubmitted
            ? "Your dossier is currently in the Thinkatic Operations review queue (typically 24 business hours)."
            : "Complete all 3 items above to submit your facility dossier for final operational clearance."}
        </p>

        {isSubmitted ? (
          <button
            type="button"
            onClick={handleAction}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <FileCheck2 className="h-4 w-4 text-[#214ECF]" />
            Review Submitted Evidence
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAction}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-6 py-3.5 text-xs font-black text-white shadow-xs hover:bg-[#1A3DB3] transition active:scale-[0.99] cursor-pointer"
          >
            {isRejected ? "Resubmit Centre Evidence →" : "Complete Verification →"}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
