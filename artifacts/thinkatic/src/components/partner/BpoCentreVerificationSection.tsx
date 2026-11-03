// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — OFFICE / CENTRE VERIFICATION SECTION
// Main Partner Onboarding & Dashboard verification section.
// Strict Flow:
// Office Details -> Office Photos Upload -> Live Video Walkthrough -> VERIFY & SUBMIT
// -> UNDER OPERATIONS REVIEW (Waiting State, NO fake timer) -> Admin Manual Decision.
// ==============================================================================

import { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Camera,
  Video,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Send,
  Loader2,
  Phone,
  Layers,
  Calendar,
  Sparkles,
  RefreshCw,
  FileCheck,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Download,
  ExternalLink,
  Map,
  Navigation,
  Globe,
  Mail,
  Home,
  Ruler,
  SunMedium,
} from "lucide-react";
import LiveOfficeVideoRecorder from "./LiveOfficeVideoRecorder";
import OfficePhotosUploader from "./OfficePhotosUploader";
import { useAutosaveForm } from "../../hooks/useAutosaveForm";
import AutosaveStatusBadge from "../common/AutosaveStatusBadge";

interface BpoCentreVerificationSectionProps {
  onStatusChange?: () => void;
}

export default function BpoCentreVerificationSection({
  onStatusChange,
}: BpoCentreVerificationSectionProps) {
  const [verification, setVerification] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "photos" | "video">("details");
  const [evidenceCompletion, setEvidenceCompletion] = useState<{
    totalRequired: number;
    completedRequired: number;
    isComplete: boolean;
    percentage: number;
    missingRequired: string[];
  } | null>(null);

  // Collapsible evidence accordion in submitted/waiting state
  const [evidenceAccordionOpen, setEvidenceAccordionOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);

  // Form State
  const [officeForm, setOfficeForm] = useState({
    officeName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "India",
    postalCode: "",
    landmark: "",
    contactNumber: "",
    centreType: "Dedicated BPO Facility",
    ownershipType: "Commercial Lease",
    operatingSince: "2024",
    totalAreaSqft: "",
    numberOfFloors: "1",
    workingHours: "24/7 Operations",
    operatingShift: "US Shift (Night)",
  });

  const token =
    localStorage.getItem("user_token") ||
    localStorage.getItem("thinkatic_user_token") ||
    localStorage.getItem("bpo_applicant_token") ||
    localStorage.getItem("token") ||
    "";

  async function fetchVerification(silent: boolean = false) {
    const isSilent = typeof silent === "boolean" ? silent : false;
    if (!isSilent) setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/bpo/centre-verification/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.verification) {
          const v = data.verification;
          setVerification(v);
          setOfficeForm({
            officeName: v.officeName || "",
            addressLine1: v.addressLine1 || "",
            addressLine2: v.addressLine2 || "",
            city: v.city || "",
            state: v.state || "",
            country: v.country || "India",
            postalCode: v.postalCode || "",
            landmark: v.landmark || "",
            contactNumber: v.contactNumber || "",
            centreType: v.centreType || "Dedicated BPO Facility",
            ownershipType: v.ownershipType || "Commercial Lease",
            operatingSince: v.operatingSince || "2024",
            totalAreaSqft: v.totalAreaSqft ? String(v.totalAreaSqft) : "",
            numberOfFloors: v.numberOfFloors ? String(v.numberOfFloors) : "1",
            workingHours: v.workingHours || v.working_hours || "24/7 Operations",
            operatingShift: v.operatingShift || v.operating_shift || "US Shift (Night)",
          });
          if (data.completion) {
            setEvidenceCompletion(data.completion);
          }
        }
      } else {
        setErrorMsg("Failed to load centre verification details.");
      }
    } catch {
      setErrorMsg("Network error loading centre verification.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchVerification();
  }, [token]);

  const status = verification?.status || "NOT_STARTED";
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED" || status === "RESUBMISSION_REQUIRED";
  const isSubmitted = status === "SUBMITTED" || status === "UNDER_REVIEW";

  const {
    status: autosaveStatus,
    lastSavedAt,
    flush: flushAutosave,
    retry: retryAutosave,
  } = useAutosaveForm(officeForm, {
    debounceMs: 5000,
    isInitialLoading: loading || isSubmitted || isApproved,
    onSave: async (data: typeof officeForm) => {
      if (!token) return { success: false, error: "Not authenticated" };
      if (!data.officeName && !data.addressLine1) return { success: true };

      try {
        const res = await fetch("/api/bpo/centre-verification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        const resData = await res.json();
        if (!res.ok) {
          return { success: false, error: resData.message || resData.error || "Failed to autosave office details." };
        }

        if (resData.verification) {
          setVerification(resData.verification);
        }
        if (onStatusChange) onStatusChange();
        return { success: true, data: resData };
      } catch (err: any) {
        return { success: false, error: err.message || "Network error" };
      }
    },
  });

  async function switchTab(tab: "details" | "photos" | "video") {
    if (activeTab === "details" && tab !== "details" && !isSubmitted && !isApproved) {
      try {
        await flushAutosave();
      } catch (err) {
        console.warn("Failed to flush autosave before switching tab", err);
      }
    }
    setActiveTab(tab);
  }

  async function handleSaveOfficeDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await flushAutosave();
      setSuccessMsg("Office / centre details saved successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save details.");
    } finally {
      setSavingDetails(false);
    }
  }

  // Authoritative Validation Before Submission
  const activePhotos =
    verification?.media?.filter(
      (m: any) =>
        (m.mediaType === "photo" || m.media_type === "photo") &&
        (m.status === "active" || m.status === "approved" || !m.status)
    ) || [];
  const activeVideo = verification?.media?.find(
    (m: any) =>
      (m.mediaType === "video" || m.media_type === "video") &&
      (m.status === "active" || m.status === "approved" || !m.status)
  );

  const REQUIRED_CATEGORIES = [
    "reception_entrance",
    "workstation_area",
    "operations_area",
    "infrastructure_equipment",
    "network_setup",
    "power_backup",
  ];

  const uploadedRequiredCategories = REQUIRED_CATEGORIES.filter((catId) =>
    activePhotos.some((p: any) => p.category === catId)
  );
  const uploadedRequiredCount = uploadedRequiredCategories.length;
  const totalRequiredCount = 6;
  const photosComplete = uploadedRequiredCount >= totalRequiredCount;

  const officeDetailsComplete = Boolean(
    (verification?.officeName || officeForm.officeName).trim() &&
    (verification?.addressLine1 || officeForm.addressLine1).trim() &&
    (verification?.city || officeForm.city).trim() &&
    (verification?.state || officeForm.state).trim() &&
    (verification?.postalCode || officeForm.postalCode).trim() &&
    (verification?.contactNumber || officeForm.contactNumber).trim() &&
    (verification?.totalAreaSqft || officeForm.totalAreaSqft)
  );

  const videoComplete = Boolean(activeVideo && (activeVideo.status === "active" || activeVideo.status === "approved"));

  const totalRequiredEvidence = evidenceCompletion?.totalRequired ?? 7;
  const completedRequiredEvidence =
    evidenceCompletion?.completedRequired ?? (uploadedRequiredCount + (videoComplete ? 1 : 0));
  const isEvidenceComplete = officeDetailsComplete && photosComplete && videoComplete;
  const evidencePercentage = evidenceCompletion?.percentage ?? Math.round((completedRequiredEvidence / totalRequiredEvidence) * 100);

  async function handleSubmitVerification() {
    setErrorMsg("");
    setSuccessMsg("");

    // 1. Validation checks
    if (!officeDetailsComplete) {
      setErrorMsg("Please complete all required Office Details (Address, Total Area, Contact Number) before submitting.");
      setActiveTab("details");
      return;
    }

    if (!photosComplete) {
      const missingCount = totalRequiredCount - uploadedRequiredCount;
      setErrorMsg(`Please upload all 6 required office evidence photographs. (${missingCount} category photo${missingCount === 1 ? "" : "s"} still missing).`);
      setActiveTab("photos");
      return;
    }

    if (!videoComplete) {
      setErrorMsg("Please complete the live office walkthrough video recording or upload before submitting.");
      setActiveTab("video");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/bpo/centre-verification/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(officeForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to submit office verification.");
      }

      setVerification(data.verification);
      if (data.completion) {
        setEvidenceCompletion(data.completion);
      }
      setSuccessMsg("Office Verification submitted successfully. Your dossier is now under Operations Review.");
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit verification.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#E2E8F0] bg-white p-8 shadow-sm flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#214ECF]" />
          <p className="text-xs font-bold text-slate-500">Loading office verification module...</p>
        </div>
      </div>
    );
  }


  return (
    <div id="office-verification" className="space-y-6">
      {/* Top Banner & Status Header */}
      <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-black text-[#214ECF] bg-[#214ECF]/10 px-3 py-1 rounded-full uppercase">
                Office / Centre Verification
              </span>

              {/* Status Badges */}
              {status === "NOT_STARTED" && (
                <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold uppercase">
                  Not Started
                </span>
              )}
              {status === "IN_PROGRESS" && (
                <span className="rounded-full bg-blue-100 text-[#214ECF] px-3 py-1 text-xs font-bold uppercase">
                  In Progress
                </span>
              )}
              {isSubmitted && (
                <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 text-xs font-black uppercase flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Under Operations Review
                </span>
              )}
              {isApproved && (
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-black uppercase flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Office Verified & Approved
                </span>
              )}
              {isRejected && (
                <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 text-xs font-black uppercase flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Action Required
                </span>
              )}
            </div>

            <h2 className="mt-3 text-2xl font-black text-[#0B1F3A]">
              {verification?.officeName || "Primary BPO Delivery Facility"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {verification?.addressLine1
                ? `${verification.addressLine1}, ${verification.city}, ${verification.state} ${verification.postalCode}`
                : "Provide your operational facility address, upload photos, and complete browser video walkthrough."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchVerification()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Status
            </button>
          </div>
        </div>

        {/* REJECTION / CORRECTION REQUIRED BANNER */}
        {isRejected && (
          <div className="mt-6 rounded-2xl border-2 border-rose-300 bg-rose-50/90 p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-rose-900 uppercase tracking-wide">
                  OFFICE VERIFICATION ACTION REQUIRED
                </h4>
                <p className="text-xs text-rose-700 font-semibold">
                  Thinkatic Operations reviewed your centre evidence and requested the following corrections before accreditation:
                </p>
                <div className="mt-2 rounded-xl bg-white border border-rose-200 p-3 text-xs font-bold text-slate-900">
                  {verification?.rejectionReason || "Please review and update your office photographs and walkthrough video."}
                </div>
                <p className="text-[11px] text-slate-600 mt-2">
                  All your previously submitted evidence is preserved below. Update the requested details or replace the flagged photos/video, then click <strong>VERIFY & SUBMIT OFFICE VERIFICATION</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASE A: POST-SUBMISSION WAITING SCREEN (UNDER OPERATIONS REVIEW)     */}
      {/* Replaces recording/upload view. Strictly NO fake countdown timer!    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isSubmitted && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-blue-200 bg-linear-to-b from-blue-50/50 via-white to-white p-8 sm:p-10 shadow-sm text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#214ECF]/10 text-[#214ECF] border border-[#214ECF]/20 mb-5">
              <ShieldCheck className="h-10 w-10" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-4 py-1.5 text-xs font-black uppercase tracking-wider mb-3">
              <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
              ● UNDER OPERATIONS REVIEW
            </div>

            <h3 className="text-2xl font-black text-[#0B1F3A] tracking-tight">
              OFFICE VERIFICATION SUBMITTED
            </h3>

            <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Your office details, photos, and live walkthrough video have been successfully submitted to Thinkatic Operations.
            </p>

            {/* Estimated Review Time (Strictly NO fake timer) */}
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-6 py-3 text-xs">
              <Clock className="h-4 w-4 text-[#214ECF]" />
              <span className="font-bold text-slate-500">Estimated Review:</span>
              <span className="font-black text-[#0B1F3A]">Within 24 Hours</span>
            </div>

            {/* Operations message */}
            <div className="mt-6 rounded-2xl bg-blue-50/60 border border-blue-100 p-4 text-xs text-slate-700 max-w-2xl mx-auto text-left flex items-start gap-3">
              <HelpCircle className="h-4 w-4 text-[#214ECF] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Thinkatic Operations will manually review your office details, facility photos, and live walkthrough video. You do not need to submit anything else unless Operations requests a correction.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fetchVerification()}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Check Status Now
              </button>

              <button
                type="button"
                onClick={() => setEvidenceAccordionOpen(!evidenceAccordionOpen)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                {evidenceAccordionOpen ? "Hide Submitted Evidence" : "View Submitted Evidence (6 Photos, 1 Video)"}
                {evidenceAccordionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Submitted Evidence Accordion */}
          {evidenceAccordionOpen && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-[#0B1F3A]">
                    Submitted Office Verification Evidence
                  </h4>
                  <p className="text-xs text-slate-500">
                    Immutable record of evidence currently under review by Thinkatic Operations.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  Submission #{verification?.submissionCount || 1}
                </span>
              </div>

              {/* Office Details Summary */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#214ECF]" />
                  Facility & Operational Specs
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Centre Name:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{verification?.officeName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Facility Type:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{verification?.centreType || "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Total Area:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{verification?.totalAreaSqft ? `${verification.totalAreaSqft} Sq. Ft.` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Operational Floors:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{verification?.numberOfFloors || 1} Floor(s)</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Working Hours:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{officeForm.workingHours || "24/7 Operations"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Primary Shift:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{officeForm.operatingShift || "US Shift"}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-slate-400 font-medium">Full Physical Address:</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {verification?.addressLine1} {verification?.addressLine2 ? `, ${verification.addressLine2}` : ""} · {verification?.city}, {verification?.state} {verification?.postalCode} ({verification?.country})
                    </p>
                  </div>
                </div>
              </div>

              {/* Submitted Photos Grid */}
              <div>
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#214ECF]" />
                  Submitted Evidence Photos ({activePhotos.length})
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {activePhotos.map((photo: any) => (
                    <div
                      key={photo.id}
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 hover:border-[#214ECF] transition shadow-xs"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-slate-900 flex items-center justify-center">
                        <img
                          src={photo.signedUrl || `/api/admin/bpo/centre-verifications/media/${photo.id}?user_token=${token}`}
                          alt={photo.originalFileName}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                      <div className="p-2 bg-white">
                        <span className="inline-block rounded-md bg-[#214ECF]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#214ECF]">
                          {photo.category?.replace(/_/g, " ")}
                        </span>
                        <p className="text-[11px] font-semibold text-slate-700 truncate mt-1">
                          {photo.originalFileName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submitted Walkthrough Video */}
              {activeVideo && (
                <div>
                  <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Video className="h-4 w-4 text-[#214ECF]" />
                    Submitted Live Walkthrough Video
                  </h5>
                  <div className="rounded-2xl overflow-hidden bg-black aspect-video max-w-2xl mx-auto shadow-md">
                    <video
                      controls
                      src={activeVideo.signedUrl || `/api/admin/bpo/centre-verifications/media/${activeVideo.id}?user_token=${token}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASE B: APPROVED STATE                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isApproved && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-emerald-200 bg-linear-to-b from-emerald-50/50 via-white to-white p-8 sm:p-10 shadow-sm text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200 mb-5">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-4 py-1.5 text-xs font-black uppercase tracking-wider mb-3">
              <Check className="h-3.5 w-3.5" />
              ● OFFICE VERIFIED & ACCREDITED
            </div>

            <h3 className="text-2xl font-black text-[#0B1F3A] tracking-tight">
              OFFICE VERIFICATION APPROVED
            </h3>

            <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Your physical centre location, equipment setup, and live walkthrough video have been audited and officially approved by Thinkatic Operations.
            </p>

            <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
              {verification?.reviewedByAdminName && (
                <span>Reviewed by: <strong className="text-slate-800">{verification.reviewedByAdminName}</strong></span>
              )}
              {verification?.reviewedAt && (
                <span>Audit Date: <strong className="text-slate-800">{new Date(verification.reviewedAt).toLocaleDateString()}</strong></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASE C: ACTIVE EDITING (NOT_STARTED, IN_PROGRESS, or RESUBMISSION)   */}
      {/* 3 Executive Sections: Details, Photos, Live Video                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {!isSubmitted && !isApproved && (
        <div className="space-y-6">
          {/* Authoritative Evidence Completion Summary */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                  Required Evidence Progress:
                </span>
                <span className="font-mono text-xs font-black text-[#214ECF] bg-[#214ECF]/10 px-2.5 py-0.5 rounded-md">
                  {completedRequiredEvidence} / {totalRequiredEvidence} Required ({evidencePercentage}%)
                </span>
                {isEvidenceComplete ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready to Submit (100%)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    {totalRequiredEvidence - completedRequiredEvidence} Item{totalRequiredEvidence - completedRequiredEvidence === 1 ? "" : "s"} Missing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                <span className="font-bold text-slate-700">Required:</span> Complete Office Details + 6 Required Zone Photos + 1 Live Walkthrough Video
              </p>
            </div>

            <div className="w-full md:w-56 shrink-0">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                <span>Verification Progress</span>
                <span className="font-mono text-[#214ECF] font-black">{evidencePercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isEvidenceComplete ? "bg-emerald-500" : "bg-[#214ECF]"
                  }`}
                  style={{ width: `${evidencePercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3 Executive Status Cards (Details, Photos, Video) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Office Details */}
            <div
              onClick={() => switchTab("details")}
              className={`rounded-2xl border p-5 transition cursor-pointer flex flex-col justify-between ${
                activeTab === "details"
                  ? "border-[#214ECF] bg-blue-50/30 ring-2 ring-[#214ECF]/15"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <div className={`p-2 rounded-xl ${officeDetailsComplete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-[#214ECF]"}`}>
                      <Building2 size={16} />
                    </div>
                    <span>1. Office Details</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      officeDetailsComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {officeDetailsComplete ? "Complete" : "Incomplete"}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-slate-900 truncate">
                  {verification?.officeName || officeForm.officeName || "Facility Address"}
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {officeDetailsComplete
                    ? `${officeForm.city || "City"}, ${officeForm.totalAreaSqft || "—"} sq.ft (${officeForm.numberOfFloors || 1} Floors)`
                    : "Facility address, operational area in sq.ft, shifts, and contact."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#214ECF]">
                <span>{officeDetailsComplete ? "Edit Details" : "Fill Office Details"}</span>
                <span className="text-base leading-none">→</span>
              </div>
            </div>

            {/* Card 2: Office Photos */}
            <div
              onClick={() => switchTab("photos")}
              className={`rounded-2xl border p-5 transition cursor-pointer flex flex-col justify-between ${
                activeTab === "photos"
                  ? "border-[#214ECF] bg-blue-50/30 ring-2 ring-[#214ECF]/15"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <div className={`p-2 rounded-xl ${photosComplete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-[#214ECF]"}`}>
                      <Camera size={16} />
                    </div>
                    <span>2. Evidence Photos</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      photosComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {photosComplete ? "Complete" : `${uploadedRequiredCount} of ${totalRequiredCount}`}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Required Categories:</span>
                    <span className="font-mono text-[#214ECF]">{uploadedRequiredCount}/{totalRequiredCount}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        photosComplete ? "bg-emerald-500" : "bg-[#214ECF]"
                      }`}
                      style={{ width: `${Math.min(100, Math.round((uploadedRequiredCount / totalRequiredCount) * 100))}%` }}
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  {photosComplete
                    ? "All 6 required zone photographs uploaded and ready."
                    : `Missing ${totalRequiredCount - uploadedRequiredCount} required categories.`}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#214ECF]">
                <span>{photosComplete ? "Manage Photos" : "Upload Photos"}</span>
                <span className="text-base leading-none">→</span>
              </div>
            </div>

            {/* Card 3: Live Video Walkthrough */}
            <div
              onClick={() => switchTab("video")}
              className={`rounded-2xl border p-5 transition cursor-pointer flex flex-col justify-between ${
                activeTab === "video"
                  ? "border-[#214ECF] bg-blue-50/30 ring-2 ring-[#214ECF]/15"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <div className={`p-2 rounded-xl ${videoComplete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-[#214ECF]"}`}>
                      <Video size={16} />
                    </div>
                    <span>3. Live Office Video</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      videoComplete ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {videoComplete ? "Recorded" : "Required"}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-slate-900 truncate">
                  {activeVideo ? (activeVideo.originalFileName || "Walkthrough Video") : "Live Camera Walkthrough"}
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {videoComplete
                    ? "Continuous walkthrough video recorded and saved in private storage."
                    : "Continuous live recording of entrance, desks, server rack & power backup."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#214ECF]">
                <span>{videoComplete ? "Review Video" : "Record Live Video"}</span>
                <span className="text-base leading-none">→</span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs: Details / Photos / Video */}
          <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => switchTab("details")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition cursor-pointer ${
                activeTab === "details"
                  ? "bg-[#214ECF] text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              1. Office Details
              {officeDetailsComplete && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              type="button"
              data-testid="tab-office-photos"
              onClick={() => switchTab("photos")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition cursor-pointer ${
                activeTab === "photos"
                  ? "bg-[#214ECF] text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              2. Office Photos ({activePhotos.length})
              {photosComplete && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => switchTab("video")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition cursor-pointer ${
                activeTab === "video"
                  ? "bg-[#214ECF] text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              3. Live Office Video
              {videoComplete && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>
          </div>

          {/* Tab 1: Office Details Form */}
          {activeTab === "details" && (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm">
              <form onSubmit={handleSaveOfficeDetails} className="space-y-6">
                {/* Section Header with Blue Outline Icon and Autosave Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-5 w-5 text-[#214ECF] shrink-0" />
                    <div>
                      <h3 className="text-base font-black text-[#0B1F3A]">Office / Centre Information</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Physical address, floor specifications, operating shifts, and working hours.
                      </p>
                    </div>
                  </div>
                  <AutosaveStatusBadge
                    status={autosaveStatus}
                    onRetry={() => { void retryAutosave(); }}
                  />
                </div>

                {/* Logical Group 1: General Centre Details & Physical Address */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Centre / Office Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Centre / Office Name <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.officeName}
                          onChange={(e) => setOfficeForm({ ...officeForm, officeName: e.target.value })}
                          placeholder="e.g. Thinkatic Cyber Tower - Unit 4B"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Address Line 1 */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Address Line 1 (Street / Building) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.addressLine1}
                          onChange={(e) => setOfficeForm({ ...officeForm, addressLine1: e.target.value })}
                          placeholder="Floor number, Building name, Street"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Address Line 2 */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Address Line 2 (Area / Sector)
                      </label>
                      <div className="relative">
                        <Map className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          value={officeForm.addressLine2}
                          onChange={(e) => setOfficeForm({ ...officeForm, addressLine2: e.target.value })}
                          placeholder="Sector, Tech park, or locality"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Landmark */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Landmark
                      </label>
                      <div className="relative">
                        <Navigation className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          value={officeForm.landmark}
                          onChange={(e) => setOfficeForm({ ...officeForm, landmark: e.target.value })}
                          placeholder="Near Metro station, highway exit"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logical Group 2: Regional Location & Contact */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Regional Location &amp; Contact Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* City */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        City <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.city}
                          onChange={(e) => setOfficeForm({ ...officeForm, city: e.target.value })}
                          placeholder="City"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* State / Province */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        State / Province <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Map className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.state}
                          onChange={(e) => setOfficeForm({ ...officeForm, state: e.target.value })}
                          placeholder="State"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Country */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Country <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.country}
                          onChange={(e) => setOfficeForm({ ...officeForm, country: e.target.value })}
                          placeholder="Country"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Postal / ZIP Code */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Postal / ZIP Code <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.postalCode}
                          onChange={(e) => setOfficeForm({ ...officeForm, postalCode: e.target.value })}
                          placeholder="e.g. 560103"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Office Contact Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Office Contact Number <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={officeForm.contactNumber}
                          onChange={(e) => setOfficeForm({ ...officeForm, contactNumber: e.target.value })}
                          placeholder="+91 80 1234 5678"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Operating Since (Year) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Operating Since (Year) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={officeForm.operatingSince}
                          onChange={(e) => setOfficeForm({ ...officeForm, operatingSince: e.target.value })}
                          placeholder="e.g. 2022"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logical Group 3: Facility Specifications & Operating Shifts */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Facility Specifications &amp; Operational Shifts
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Centre Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Centre Type <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <select
                          value={officeForm.centreType}
                          onChange={(e) => setOfficeForm({ ...officeForm, centreType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 appearance-none focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150 cursor-pointer"
                        >
                          <option value="Dedicated BPO Facility">Dedicated BPO Facility</option>
                          <option value="Corporate Branch">Corporate Branch</option>
                          <option value="Technology Park Unit">Technology Park Unit</option>
                          <option value="Co-working Dedicated Floor">Co-working Dedicated Floor</option>
                          <option value="Global Delivery Centre">Global Delivery Centre</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Ownership Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Ownership Type <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <select
                          value={officeForm.ownershipType}
                          onChange={(e) => setOfficeForm({ ...officeForm, ownershipType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 appearance-none focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150 cursor-pointer"
                        >
                          <option value="Commercial Lease">Commercial Lease</option>
                          <option value="Owned Property">Owned Property</option>
                          <option value="Rented">Rented</option>
                          <option value="Operational Sub-contract">Operational Sub-contract</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Total Office Area */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Total Office Area (sq. ft.) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Ruler className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="number"
                          required
                          value={officeForm.totalAreaSqft}
                          onChange={(e) => setOfficeForm({ ...officeForm, totalAreaSqft: e.target.value })}
                          placeholder="e.g. 8500"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Operational Floors */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Operational Floors <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <input
                          type="number"
                          required
                          value={officeForm.numberOfFloors}
                          onChange={(e) => setOfficeForm({ ...officeForm, numberOfFloors: e.target.value })}
                          placeholder="e.g. 2"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150"
                        />
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Working Hours <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <select
                          value={officeForm.workingHours}
                          onChange={(e) => setOfficeForm({ ...officeForm, workingHours: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 appearance-none focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150 cursor-pointer"
                        >
                          <option value="24/7 Operations">24/7 Operations</option>
                          <option value="16 Hours Daily (Double Shift)">16 Hours Daily (Double Shift)</option>
                          <option value="Day Shift (9:00 AM - 6:00 PM)">Day Shift (9:00 AM - 6:00 PM)</option>
                          <option value="Night Shift (7:00 PM - 5:00 AM)">Night Shift (7:00 PM - 5:00 AM)</option>
                          <option value="Rotational Shifts">Rotational Shifts</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Primary Operating Shift */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Primary Operating Shift <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <SunMedium className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#214ECF] pointer-events-none" />
                        <select
                          value={officeForm.operatingShift}
                          onChange={(e) => setOfficeForm({ ...officeForm, operatingShift: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 appearance-none focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-hidden transition-all duration-150 cursor-pointer"
                        >
                          <option value="US Shift (Night)">US Shift (Night)</option>
                          <option value="UK / EMEA Shift (Afternoon)">UK / EMEA Shift (Afternoon)</option>
                          <option value="APAC Shift (Morning)">APAC Shift (Morning)</option>
                          <option value="Domestic Indian Shift">Domestic Indian Shift</option>
                          <option value="Multi-Geography 24/7">Multi-Geography 24/7</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Office Details Action Footer */}
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] text-slate-400">
                      Auto-saves 5s after editing stops.
                    </p>
                    <AutosaveStatusBadge
                      status={autosaveStatus}
                      onRetry={() => { void retryAutosave(); }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingDetails || autosaveStatus === "saving"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3eb3] active:bg-[#15328f] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:shadow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingDetails || autosaveStatus === "saving" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save Office Details</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Categorized Photos */}
          {activeTab === "photos" && (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm">
              <OfficePhotosUploader
                verificationId={verification?.id}
                applicationId={verification?.applicationId}
                media={verification?.media || []}
                onPhotoUploaded={() => fetchVerification(true)}
                readOnly={false}
              />
            </div>
          )}

          {/* Tab 3: Live Video Recorder */}
          {activeTab === "video" && (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm">
              <LiveOfficeVideoRecorder
                verificationId={verification?.id}
                applicationId={verification?.applicationId}
                existingVideo={activeVideo}
                onVideoSubmitted={(newMedia) => {
                  if (newMedia) {
                    setVerification((prev: any) => {
                      if (!prev) return prev;
                      const existingMedia = prev.media || [];
                      const filtered = existingMedia.filter(
                        (m: any) => m.mediaType !== "video" && m.media_type !== "video"
                      );
                      return {
                        ...prev,
                        media: [...filtered, newMedia],
                      };
                    });
                  }
                  fetchVerification(true);
                }}
                readOnly={false}
              />
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* PRIMARY SUBMISSION ACTION BAR (THINKATIC BLUE #214ECF)         */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="rounded-3xl border border-blue-200 bg-linear-to-r from-blue-50/50 via-white to-blue-50/30 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <ShieldCheck className="h-5 w-5 text-[#214ECF]" />
                <h4 className="text-base font-black text-[#0B1F3A]">
                  Ready to Submit Office Verification?
                </h4>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Requires completed Office Details, 6 Required Zone Photographs, and 1 Continuous Live Walkthrough Video. Submitting sends your complete dossier directly to Thinkatic Operations for manual verification.
              </p>
            </div>

            <button
              type="button"
              id="verify-submit-office-verification"
              data-testid="verify-submit-office-verification"
              disabled={submitting}
              onClick={handleSubmitVerification}
              className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3eb3] active:bg-[#15328f] px-8 py-3.5 text-xs font-black text-white shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Dossier to Operations...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>✓ VERIFY &amp; SUBMIT OFFICE VERIFICATION</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Submitted Photos Preview */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-60 flex flex-col bg-black/95 text-white animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/10">
            <div>
              <span className="inline-block rounded-md bg-[#214ECF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {lightboxPhoto.category?.replace(/_/g, " ")}
              </span>
              <h4 className="text-sm font-bold text-white mt-1">{lightboxPhoto.originalFileName}</h4>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={lightboxPhoto.signedUrl || `/api/admin/bpo/centre-verifications/media/${lightboxPhoto.id}?user_token=${token}`}
                download={lightboxPhoto.originalFileName || "office_evidence.jpg"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20 transition flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <img
              src={lightboxPhoto.signedUrl || `/api/admin/bpo/centre-verifications/media/${lightboxPhoto.id}?user_token=${token}`}
              alt={lightboxPhoto.originalFileName}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
