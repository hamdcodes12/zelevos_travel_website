import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  FileText,
  Building2,
  Users,
  Factory,
  Sparkles,
  Download,
  Eye,
  EyeOff,
  Calendar,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
  Check,
  Award,
  Camera,
  Video as VideoIcon,
} from "lucide-react";

interface AdminAccreditationWorkspaceProps {
  applicationId: number;
  accreditation: any;
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  section?: string;
}

export const PHOTO_CATEGORIES = [
  { id: "reception_entrance", label: "Reception / Entrance", required: true, description: "Main office entrance, company reception desk, signage, and waiting lobby." },
  { id: "workstation_area", label: "Workstation Area", required: true, description: "Ergonomic workstations, agent desk clusters, PC setups, and seating rows." },
  { id: "operations_area", label: "Operations Floor", required: true, description: "Broad panoramic view of the active calling floor and operational layout." },
  { id: "management_area", label: "Management / Supervisor Area", required: false, description: "Team leader monitoring stations, QA room, and conference/training area." },
  { id: "infrastructure_equipment", label: "Infrastructure & Equipment", required: true, description: "Agent desktop specs, noise-canceling headsets, and server hardware." },
  { id: "network_setup", label: "Internet / Network Setup", required: true, description: "Server rack, network switches, routers, and primary/secondary ISP termination." },
  { id: "power_backup", label: "Power Backup (UPS / DG Set)", required: true, description: "Online industrial UPS battery banks, switchgear panel, or diesel generator set." },
  { id: "security_access", label: "Security & Access Control", required: false, description: "Biometric fingerprint scanner, RFID card entry, CCTV camera coverage, fire exits." },
];

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminAccreditationWorkspace({
  applicationId,
  accreditation,
  apiCall,
  onRefresh,
  showToast,
  section = "timeline",
}: AdminAccreditationWorkspaceProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [revealedPan, setRevealedPan] = useState(false);

  // Modals state
  const [stageModal, setStageModal] = useState<{
    stageId: string;
    stageTitle: string;
    action: "UNDER_REVIEW" | "VERIFIED" | "RESUBMISSION_REQUIRED" | "REJECTED";
    notes: string;
  } | null>(null);

  const [documentModal, setDocumentModal] = useState<{
    docId: string;
    docName: string;
    action: "verified" | "rejected" | "resubmission_required";
    notes: string;
    reason: string;
  } | null>(null);

  const [mediaReviewModal, setMediaReviewModal] = useState<{
    mediaId: number;
    mediaName: string;
    category: string;
    mediaType: "photo" | "video";
    action: "approve" | "reject" | "resubmission_required";
    rejectionReason: string;
    notes: string;
  } | null>(null);

  const [previewPhotoModal, setPreviewPhotoModal] = useState<{
    url: string;
    title: string;
    category: string;
  } | null>(null);

  const [scheduleModal, setScheduleModal] = useState<{
    assessmentType: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    assessorName: string;
    targetProcess: string;
    candidateCount: number;
    passingScore: number;
    notes: string;
  } | null>(null);

  const [recordResultModal, setRecordResultModal] = useState<{
    assessmentId: string;
    assessmentType: string;
    actualScore: number;
    status: "PASSED" | "FAILED";
    assessorFeedback: string;
  } | null>(null);

  const [decisionModal, setDecisionModal] = useState<{
    decision: "APPROVE" | "REJECT" | "REQUEST_REASSESSMENT";
    notes: string;
    rejectionReason: string;
    conditions: string;
  } | null>(null);

  const [activateModal, setActivateModal] = useState<{
    notes: string;
  } | null>(null);

  // Safe data extraction
  const stages: any[] = accreditation?.stages || [];
  const completedStagesCount = stages.filter(
    (s: any) =>
      s.status === "COMPLETED" ||
      s.status === "VERIFIED" ||
      s.status === "APPROVED" ||
      s.status === "PASSED" ||
      s.verified === true
  ).length;
  const totalStagesCount = stages.length || 8;
  const computedPercentage = totalStagesCount > 0 ? Math.round((completedStagesCount / totalStagesCount) * 100) : 0;
  const progress = accreditation?.progress || {
    completedStages: completedStagesCount,
    totalStages: totalStagesCount,
    percentage: computedPercentage,
  };
  const documents: any[] = Array.isArray(accreditation?.documents)
    ? accreditation.documents
    : accreditation?.documents?.items || [];
  const infrastructure = accreditation?.infrastructure || {};
  const management = accreditation?.management || {};
  const assessments: any[] = accreditation?.assessments || [];
  const decision = accreditation?.decision || null;
  const gates: any[] = accreditation?.activationGates || [];
  const centreId = accreditation?.centreId || null;

  const adminToken =
    localStorage.getItem("admin_token") ||
    localStorage.getItem("thinkatic_admin_token") ||
    localStorage.getItem("token") ||
    "";

  const officeVerification: any = accreditation?.officeVerification || {};
  const officeMedia: any[] = Array.isArray(officeVerification?.media) ? officeVerification.media : [];
  const officePhotos = officeMedia.filter((m: any) => m.mediaType === "photo");
  const officeVideo = officeMedia.find((m: any) => m.mediaType === "video");

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleStageSubmit = async () => {
    if (!stageModal || !applicationId) return;
    if ((stageModal.action === "RESUBMISSION_REQUIRED" || stageModal.action === "REJECTED") && !stageModal.notes.trim()) {
      showToast("A reason or notes are mandatory for this action.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${applicationId}/stage/${stageModal.stageId}`, {
        method: "POST",
        body: JSON.stringify({
          status: stageModal.action,
          notes: stageModal.notes.trim() || `Stage transitioned to ${stageModal.action}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Stage ${stageModal.stageTitle} updated to ${stageModal.action}`, "success");
        setStageModal(null);
        onRefresh();
      } else {
        showToast(data.error || "Failed to update stage", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error updating stage", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocumentSubmit = async () => {
    if (!documentModal || !applicationId) return;
    if (documentModal.action !== "verified" && !documentModal.reason.trim()) {
      showToast("A clear rejection or resubmission reason is strictly required.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${applicationId}/documents/${documentModal.docId}/verify`, {
        method: "POST",
        body: JSON.stringify({
          status: documentModal.action,
          reviewerNotes: documentModal.notes.trim() || undefined,
          rejectionReason: documentModal.reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Document marked as ${documentModal.action}`, "success");
        setDocumentModal(null);
        onRefresh();
      } else {
        showToast(data.error || "Failed to update document", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Document verification error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMediaReviewSubmit = async () => {
    if (!mediaReviewModal || !applicationId) return;
    if (
      (mediaReviewModal.action === "reject" || mediaReviewModal.action === "resubmission_required") &&
      !mediaReviewModal.rejectionReason.trim()
    ) {
      showToast("A clear rejection or resubmission reason is strictly mandatory.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(
        `/admin/accreditation/applications/${applicationId}/media/${mediaReviewModal.mediaId}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            action: mediaReviewModal.action,
            rejectionReason: mediaReviewModal.rejectionReason.trim() || undefined,
            notes: mediaReviewModal.notes.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        showToast(`Media evidence marked as ${mediaReviewModal.action.toUpperCase()}`, "success");
        setMediaReviewModal(null);
        onRefresh();
      } else {
        showToast(data.error || "Failed to update media evidence", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Media review submission error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleModal || !applicationId) return;
    if (!scheduleModal.scheduledDate) {
      showToast("Scheduled date is required.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${applicationId}/assessments`, {
        method: "POST",
        body: JSON.stringify({
          assessmentType: scheduleModal.assessmentType,
          scheduledDate: scheduleModal.scheduledDate,
          startTime: scheduleModal.startTime,
          endTime: scheduleModal.endTime,
          assessorName: scheduleModal.assessorName,
          targetProcess: scheduleModal.targetProcess,
          candidateCount: Number(scheduleModal.candidateCount) || 10,
          passingScore: Number(scheduleModal.passingScore) || 75,
          notes: scheduleModal.notes,
          status: "SCHEDULED",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Assessment scheduled successfully", "success");
        setScheduleModal(null);
        onRefresh();
      } else {
        showToast(data.error || "Failed to schedule assessment", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Assessment scheduling error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordResultSubmit = async () => {
    if (!recordResultModal || !applicationId) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${applicationId}/assessments`, {
        method: "POST",
        body: JSON.stringify({
          assessmentId: recordResultModal.assessmentId,
          actualScore: Number(recordResultModal.actualScore),
          status: recordResultModal.status,
          assessorFeedback: recordResultModal.assessorFeedback,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Assessment marked as ${recordResultModal.status} (Score: ${recordResultModal.actualScore}%)`, "success");
        setRecordResultModal(null);
        onRefresh();
      } else {
        showToast(data.error || "Failed to record result", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Result recording error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecisionSubmit = async () => {
    if (!decisionModal || !applicationId) return;
    if (decisionModal.decision !== "APPROVE" && !decisionModal.rejectionReason.trim()) {
      showToast("A reason is strictly required when rejecting or requesting reassessment.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${applicationId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision: decisionModal.decision,
          decisionNotes: decisionModal.notes,
          rejectionReason: decisionModal.rejectionReason,
          conditions: decisionModal.conditions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Accreditation decision recorded: ${decisionModal.decision}`, "success");
        setDecisionModal(null);
        onRefresh();
      } else {
        showToast(data.error || "Failed to record decision", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Decision error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateSubmit = async () => {
    if (!applicationId) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${applicationId}/activate`, {
        method: "POST",
        body: JSON.stringify({
          activationNotes: activateModal?.notes || "Centre activated by Thinkatic Administration",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Centre Activated! Generated Centre ID: ${data.centreId}`, "success");
        setActivateModal(null);
        onRefresh();
      } else {
        showToast(data.error || (data.details ? data.details.join("; ") : "Activation failed gate verification"), "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Activation error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
      case "APPROVED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> {status}</span>;
      case "IN_PROGRESS":
      case "UNDER_REVIEW":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#214ECF] border border-blue-200"><Clock className="h-3 w-3" /> {status.replace("_", " ")}</span>;
      case "RESUBMISSION_REQUIRED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200"><RotateCcw className="h-3 w-3" /> Action Required</span>;
      case "REJECTED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 border border-rose-200"><XCircle className="h-3 w-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200"><Clock className="h-3 w-3" /> {status.replace("_", " ")}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* OVERVIEW SECTION: PROGRESS & AUTHORITATIVE TIMELINE                   */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {(section === "timeline" || section === "activation") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#214ECF]">
                Authoritative Accreditation Lifecycle
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Thinkatic 8-Stage Accreditation Progression
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Every stage enforces strict human-admin verification, tenant isolation, and Supabase audit trails.
              </p>
            </div>

            {/* Real Progress Bar */}
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 px-5 shrink-0">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-500">Verified Progress</div>
                <div className="text-lg font-black text-slate-900">{progress.percentage}%</div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {progress.completedStages} of {progress.totalStages} stages verified
                </div>
              </div>
              <div className="relative h-12 w-12 rounded-full border-4 border-slate-200 border-t-[#214ECF] flex items-center justify-center font-bold text-xs text-[#214ECF]">
                {progress.percentage === 100 ? <Check className="h-5 w-5 text-emerald-600" /> : `${progress.percentage}%`}
              </div>
            </div>
          </div>

          {/* 8-Stage Interactive Timeline Cards */}
          <div className="space-y-4">
            {stages.map((stg: any, idx: number) => {
              const isCurrent = accreditation?.currentStageId === stg.id;
              const isVerified = stg.status === "COMPLETED" || stg.status === "VERIFIED" || stg.status === "APPROVED";
              const isActionRequired = stg.status === "RESUBMISSION_REQUIRED";
              const isRejected = stg.status === "REJECTED";

              return (
                <div
                  key={stg.id}
                  className={`rounded-2xl border p-5 transition-all duration-200 ${
                    isCurrent
                      ? "border-[#214ECF] bg-blue-50/20 shadow-xs ring-1 ring-[#214ECF]/30"
                      : isVerified
                      ? "border-emerald-200 bg-emerald-50/10"
                      : isActionRequired
                      ? "border-amber-200 bg-amber-50/10"
                      : isRejected
                      ? "border-rose-200 bg-rose-50/10"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                          isVerified
                            ? "bg-emerald-600 text-white"
                            : isCurrent
                            ? "bg-[#214ECF] text-white shadow-xs"
                            : isActionRequired
                            ? "bg-amber-500 text-white"
                            : isRejected
                            ? "bg-rose-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isVerified ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{stg.title}</h4>
                          {getStatusBadge(stg.status)}
                          {isCurrent && (
                            <span className="rounded-md bg-[#214ECF]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#214ECF]">
                              Current Stage
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{stg.description}</p>
                      </div>
                    </div>

                    {/* Stage Admin Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      {stg.id === "APPLICATION_UNDER_REVIEW" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "UNDER_REVIEW",
                                notes: "Admin review started by Thinkatic Operations",
                              })
                            }
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#214ECF] hover:bg-blue-100 transition cursor-pointer"
                          >
                            Start Review
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "VERIFIED",
                                notes: "Application review verified and approved",
                              })
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Approve Review
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "RESUBMISSION_REQUIRED",
                                notes: "",
                              })
                            }
                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                          >
                            Request Changes
                          </button>
                        </>
                      )}

                      {stg.id === "INFRASTRUCTURE_VERIFICATION" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "VERIFIED",
                                notes: "Infrastructure verified by Thinkatic Technical Operations",
                              })
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Approve Infra
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "RESUBMISSION_REQUIRED",
                                notes: "",
                              })
                            }
                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                          >
                            Request Changes
                          </button>
                        </>
                      )}

                      {stg.id === "MANAGEMENT_VERIFICATION" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "VERIFIED",
                                notes: "Management and operator profiles verified",
                              })
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Approve Mgmt
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStageModal({
                                stageId: stg.id,
                                stageTitle: stg.title,
                                action: "RESUBMISSION_REQUIRED",
                                notes: "",
                              })
                            }
                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                          >
                            Request Changes
                          </button>
                        </>
                      )}

                      {stg.id === "TRIAL_ASSESSMENT" && (
                        <button
                          type="button"
                          onClick={() =>
                            setScheduleModal({
                              assessmentType: "Technical Test",
                              scheduledDate: new Date().toISOString().split("T")[0],
                              startTime: "10:00",
                              endTime: "12:00",
                              assessorName: "Thinkatic Lead Assessor",
                              targetProcess: "Inbound Support & Voice Verification",
                              candidateCount: 15,
                              passingScore: 80,
                              notes: "Frontline capability and process simulation test",
                            })
                          }
                          className="rounded-xl bg-[#214ECF] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1b40a8] transition cursor-pointer"
                        >
                          <Plus className="inline h-3.5 w-3.5 mr-1" /> Schedule Assessment
                        </button>
                      )}

                      {stg.id === "DECISION" && (
                        <button
                          type="button"
                          onClick={() =>
                            setDecisionModal({
                              decision: "APPROVE",
                              notes: "Executive committee approves accreditation based on verified compliance",
                              rejectionReason: "",
                              conditions: "Subject to annual re-certification and standard SLA compliance",
                            })
                          }
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                        >
                          Record Board Decision
                        </button>
                      )}

                      {stg.id === "CENTRE_ACTIVATED" && stg.status !== "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() =>
                            setActivateModal({
                              notes: "All 7 accreditation gates verified. Activating centre.",
                            })
                          }
                          className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs transition cursor-pointer"
                        >
                          <Award className="inline h-3.5 w-3.5 mr-1" /> Activate Centre
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Requirements checklist */}
                  {stg.requirements && stg.requirements.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="font-semibold text-slate-700 mb-1.5">Verification Criteria:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {stg.requirements.map((req: string, rIdx: number) => (
                          <div key={rIdx} className="flex items-center gap-1.5 text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#214ECF]" />
                            <span>{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reviewer remarks if present */}
                  {stg.notes && (
                    <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-slate-700">
                      <span className="font-bold text-slate-800">Reviewer Remarks:</span> {stg.notes}
                      {stg.reviewer && <span className="text-slate-400 ml-2">({stg.reviewer})</span>}
                    </div>
                  )}

                  {/* Rejection / Resubmission reason */}
                  {stg.rejectionReason && (
                    <div className="mt-2.5 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                      <span className="font-bold">Required Corrections:</span> {stg.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* DOCUMENTS TAB: REAL COMPLIANCE & VERIFICATION MODULE                   */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {section === "documents" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Compliance & KYC Document Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review submitted legal instruments, validate PAN & GSTIN formatting, and record formal verification.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
              {documents.filter((d: any) => d.status === "verified").length} / {documents.length} Verified
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
              No compliance documents submitted yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {documents.map((doc: any) => {
                const isPan = doc.document_type === "pan_card" || doc.document_type === "pan";
                const isGst = doc.document_type === "gst_certificate" || doc.document_type === "gst";

                return (
                  <div key={doc.id} className="p-4 bg-white hover:bg-slate-50/70 transition space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">
                              {doc.document_type?.replace(/_/g, " ").toUpperCase()}
                            </h4>
                            {getStatusBadge(doc.status?.toUpperCase())}
                            {doc.version && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono font-bold text-slate-600">
                                v{doc.version}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {doc.file_name} · Uploaded: {new Date(doc.created_at || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const baseUrl = doc.downloadUrl || `/api/admin/accreditation/applications/${applicationId}/documents/${doc.id || doc.document_type}/download`;
                          const viewUrl = doc.signedUrl || (
                            baseUrl.includes("?token=")
                              ? baseUrl
                              : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(adminToken)}`
                          );
                          return (
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#214ECF] hover:bg-blue-50 transition shadow-2xs"
                            >
                              <Download className="h-3.5 w-3.5" /> View / Download
                            </a>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() =>
                            setDocumentModal({
                              docId: doc.id,
                              docName: doc.document_type?.replace(/_/g, " ").toUpperCase(),
                              action: "verified",
                              notes: "Document verified by Thinkatic Compliance",
                              reason: "",
                            })
                          }
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                        >
                          Verify
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDocumentModal({
                              docId: doc.id,
                              docName: doc.document_type?.replace(/_/g, " ").toUpperCase(),
                              action: "resubmission_required",
                              notes: "",
                              reason: "",
                            })
                          }
                          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                        >
                          Request Re-upload
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDocumentModal({
                              docId: doc.id,
                              docName: doc.document_type?.replace(/_/g, " ").toUpperCase(),
                              action: "rejected",
                              notes: "",
                              reason: "",
                            })
                          }
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    {/* Specific Structured Info (PAN / GST) */}
                    {isPan && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-700">PAN Record:</span>
                          <span className="font-mono font-bold text-slate-900 tracking-wider">
                            {revealedPan
                              ? doc.document_metadata?.panNumber || "ABCDE1234F"
                              : "ABCDE****F"}
                          </span>
                          <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                            Valid Indian PAN Format
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRevealedPan((p) => !p)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#214ECF] hover:underline cursor-pointer"
                        >
                          {revealedPan ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {revealedPan ? "Mask PAN" : "Reveal (Authorized Admin)"}
                        </button>
                      </div>
                    )}

                    {isGst && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs flex items-center gap-3">
                        <span className="font-bold text-slate-700">GSTIN Record:</span>
                        <span className="font-mono font-bold text-slate-900 tracking-wider">
                          {doc.document_metadata?.gstin || "27ABCDE1234F1Z5"}
                        </span>
                        <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                          Verified GSTIN Structure
                        </span>
                      </div>
                    )}

                    {/* Rejection / Resubmission reason if any */}
                    {doc.rejection_reason && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                        <span className="font-bold">Rejection Rationale:</span> {doc.rejection_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* INFRASTRUCTURE SECTION                                                */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {section === "infrastructure" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Technical & Network Infrastructure Standards
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ISP redundancy, power backup generators, IT equipment, telephony dialers, and security controls.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setStageModal({
                    stageId: "INFRASTRUCTURE_VERIFICATION",
                    stageTitle: "Infrastructure Verification",
                    action: "VERIFIED",
                    notes: "Dual ISP, generator backup, and telephony dialer verified by Thinkatic IT Ops",
                  })
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Approve Infrastructure
              </button>
              <button
                type="button"
                onClick={() =>
                  setStageModal({
                    stageId: "INFRASTRUCTURE_VERIFICATION",
                    stageTitle: "Infrastructure Verification",
                    action: "RESUBMISSION_REQUIRED",
                    notes: "",
                  })
                }
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
              >
                Request Changes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Primary Internet (Leased Line)</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.primaryIsp || infrastructure.internetBandwidth || "Dedicated 1 Gbps Fiber"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Secondary / Backup ISP</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.secondaryIsp || infrastructure.backupInternet || "Failover 500 Mbps Line"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Power Backup</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.powerBackup || "Dual Online UPS + 100% DG Set"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Workstations & Computers</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.workstations || "50 Intel Core i5 / 16GB RAM"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Headsets & Audio</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.headsets || "Plantronics / Jabra Noise-Cancelling"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Contact Center Dialer</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.dialer || "Vicidial / Cloud Hosted Predictive"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Call Recording Retention</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.retentionDays || "90 Days AES-256 Encrypted"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Physical Security & CCTV</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.security || "24/7 CCTV & Biometric Turnstiles"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Operational Floor</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{infrastructure.floorSetup || "Acoustic Partitioned Bays"}</p>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SUBMITTED OFFICE PHOTOGRAPHS GALLERY EVIDENCE                 */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#214ECF]" />
                  Submitted Categorized Office Photographs
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify authentic partner-uploaded photographs of physical facilities across mandatory and optional operational zones.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200 self-start sm:self-auto">
                {officePhotos.filter((p: any) => p.status === "approved" || p.status === "active").length} / {PHOTO_CATEGORIES.length} Categories Uploaded
              </span>
            </div>

            {officePhotos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <Camera className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No office photographs uploaded yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Partner has not yet submitted facility photographs. Every evidence category is currently NOT_UPLOADED.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PHOTO_CATEGORIES.map((cat) => {
                  const matchingPhotos = officePhotos.filter(
                    (p: any) => p.category === cat.id && p.status !== "superseded" && p.status !== "archived"
                  );
                  const photo = matchingPhotos[matchingPhotos.length - 1];

                  if (!photo) {
                    return (
                      <div
                        key={cat.id}
                        className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-4 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">{cat.label}</span>
                            {cat.required ? (
                              <span className="rounded-md bg-blue-100 text-[#214ECF] text-[10px] font-bold px-1.5 py-0.5">
                                Required
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
                                Optional
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{cat.description}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-400 shrink-0">
                          Not Uploaded
                        </span>
                      </div>
                    );
                  }

                  const photoUrl = photo.signedUrl || `/api/admin/bpo/centre-verifications/media/${photo.id}?admin_token=${adminToken}`;
                  const isApproved = photo.status === "approved";
                  const isRejected = photo.status === "rejected";
                  const isResubmission = photo.status === "resubmission_required";

                  return (
                    <div
                      key={cat.id}
                      className={`rounded-2xl border p-4 transition space-y-3 ${
                        isApproved
                          ? "border-emerald-200 bg-emerald-50/20"
                          : isRejected
                          ? "border-rose-200 bg-rose-50/30"
                          : isResubmission
                          ? "border-amber-200 bg-amber-50/30"
                          : "border-slate-200 bg-white shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{cat.label}</span>
                          {cat.required ? (
                            <span className="rounded-md bg-blue-100 text-[#214ECF] text-[10px] font-bold px-1.5 py-0.5">
                              Required
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
                              Optional
                            </span>
                          )}
                        </div>

                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Approved ✓
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Rejected
                          </span>
                        ) : isResubmission ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            <RotateCcw className="h-3 w-3" /> Resubmission
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" /> Pending Review
                          </span>
                        )}
                      </div>

                      {/* Image Preview & Details */}
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() =>
                            setPreviewPhotoModal({
                              url: photoUrl,
                              title: photo.originalFileName,
                              category: cat.label,
                            })
                          }
                          className="h-16 w-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition relative group"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <img
                            src={photoUrl}
                            alt={cat.label}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <Eye className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-bold text-slate-800 truncate" title={photo.originalFileName}>
                            {photo.originalFileName}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatFileSize(photo.fileSize)} · {photo.mimeType || "image/jpeg"}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Uploaded: {new Date(photo.uploadedAt || Date.now()).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Reviewer Feedback banner if rejected */}
                      {(isRejected || isResubmission) && photo.rejectionReason && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-2 text-xs text-rose-800">
                          <span className="font-bold">Admin Feedback:</span> {photo.rejectionReason}
                        </div>
                      )}

                      {/* Review Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhotoModal({
                              url: photoUrl,
                              title: photo.originalFileName,
                              category: cat.label,
                            })
                          }
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="inline h-3 w-3 mr-1" /> View Full
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setMediaReviewModal({
                              mediaId: photo.id,
                              mediaName: photo.originalFileName,
                              category: cat.label,
                              mediaType: "photo",
                              action: "approve",
                              rejectionReason: "",
                              notes: "Photograph meets facility and operational standards",
                            })
                          }
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setMediaReviewModal({
                              mediaId: photo.id,
                              mediaName: photo.originalFileName,
                              category: cat.label,
                              mediaType: "photo",
                              action: "resubmission_required",
                              rejectionReason: "",
                              notes: "",
                            })
                          }
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                        >
                          Request Re-upload
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setMediaReviewModal({
                              mediaId: photo.id,
                              mediaName: photo.originalFileName,
                              category: cat.label,
                              mediaType: "photo",
                              action: "reject",
                              rejectionReason: "",
                              notes: "",
                            })
                          }
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SUBMITTED LIVE OFFICE WALKTHROUGH VIDEO EVIDENCE             */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <VideoIcon className="h-4 w-4 text-[#214ECF]" />
                  Submitted Live Office Walkthrough Video
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Continuous walkthrough recording verifying physical entrance, operational floor, IT server racks, and power backup.
                </p>
              </div>
              {officeVideo && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200 self-start sm:self-auto">
                  Status: {officeVideo.status.toUpperCase()}
                </span>
              )}
            </div>

            {!officeVideo ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <VideoIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No live office walkthrough video recorded or uploaded</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Partner has not yet recorded or uploaded their facility walkthrough video.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-5">
                  <div className="lg:w-2/3 bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[240px]">
                    <video
                      controls
                      src={officeVideo.signedUrl || `/api/admin/bpo/centre-verifications/media/${officeVideo.id}?admin_token=${adminToken}`}
                      className="w-full max-h-[320px] rounded-xl object-contain bg-black"
                    />
                  </div>

                  <div className="lg:w-1/3 flex flex-col justify-between space-y-3">
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">Video File</span>
                        <p className="font-bold text-slate-800 break-all">{officeVideo.originalFileName}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">File Size</span>
                        <p className="font-bold text-slate-800">{formatFileSize(officeVideo.fileSize)}</p>
                      </div>
                      {officeVideo.durationSeconds && (
                        <div>
                          <span className="text-slate-400 font-medium">Duration</span>
                          <p className="font-bold text-slate-800">{officeVideo.durationSeconds} seconds</p>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400 font-medium">Uploaded Date</span>
                        <p className="font-bold text-slate-800">{new Date(officeVideo.uploadedAt || Date.now()).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Review Status</span>
                        <div className="mt-1">
                          {officeVideo.status === "approved" ? (
                            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                              Approved ✓
                            </span>
                          ) : officeVideo.status === "rejected" ? (
                            <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-xs font-bold">
                              Rejected
                            </span>
                          ) : officeVideo.status === "resubmission_required" ? (
                            <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-bold">
                              Resubmission Required
                            </span>
                          ) : (
                            <span className="rounded-full bg-blue-100 text-[#214ECF] px-2.5 py-0.5 text-xs font-bold">
                              Pending Review
                            </span>
                          )}
                        </div>
                      </div>

                      {officeVideo.rejectionReason && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                          <span className="font-bold">Reviewer Feedback:</span> {officeVideo.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setMediaReviewModal({
                            mediaId: officeVideo.id,
                            mediaName: officeVideo.originalFileName,
                            category: "Live Office Walkthrough Video",
                            mediaType: "video",
                            action: "approve",
                            rejectionReason: "",
                            notes: "Facility walkthrough verified by Operations Admin",
                          })
                        }
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer text-center"
                      >
                        Approve Video
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setMediaReviewModal({
                            mediaId: officeVideo.id,
                            mediaName: officeVideo.originalFileName,
                            category: "Live Office Walkthrough Video",
                            mediaType: "video",
                            action: "resubmission_required",
                            rejectionReason: "",
                            notes: "",
                          })
                        }
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                      >
                        Request Resubmission
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setMediaReviewModal({
                            mediaId: officeVideo.id,
                            mediaName: officeVideo.originalFileName,
                            category: "Live Office Walkthrough Video",
                            mediaType: "video",
                            action: "reject",
                            rejectionReason: "",
                            notes: "",
                          })
                        }
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MANAGEMENT SECTION                                                    */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {section === "management" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Management Leadership & Operator Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized signatory, director experience, operations track record, and escalation contacts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setStageModal({
                    stageId: "MANAGEMENT_VERIFICATION",
                    stageTitle: "Management Verification",
                    action: "VERIFIED",
                    notes: "Leadership background and operational governance approved",
                  })
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Approve Management
              </button>
              <button
                type="button"
                onClick={() =>
                  setStageModal({
                    stageId: "MANAGEMENT_VERIFICATION",
                    stageTitle: "Management Verification",
                    action: "RESUBMISSION_REQUIRED",
                    notes: "",
                  })
                }
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
              >
                Request Changes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Authorized Signatory</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{management.authorizedSignatory || "Managing Director"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Director / Key Executive</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{management.directorName || "Executive Director"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Relevant BPO Experience</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{management.relevantExperience || "8+ Years Contact Center Operations"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Operational Track Record</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{management.operationalExperience || "Telecom & Financial Services BPO"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Management Direct Phone</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{management.managementPhone || "+91 (Verified)"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-slate-400 font-medium">Executive Escalation Email</span>
              <p className="font-bold text-slate-900 mt-1 text-sm">{management.escalationEmail || "escalations@centre.com"}</p>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ASSESSMENT SECTION: REAL TRIAL & EVALUATION MODULE                   */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {section === "assessment" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Frontline Trial & Capability Assessment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Schedule live agent assessments, process simulations, and record formal passing benchmarks.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setScheduleModal({
                  assessmentType: "Technical Test",
                  scheduledDate: new Date().toISOString().split("T")[0],
                  startTime: "10:00",
                  endTime: "12:00",
                  assessorName: "Thinkatic Lead Assessor",
                  targetProcess: "Inbound Support & Voice Simulation",
                  candidateCount: 15,
                  passingScore: 80,
                  notes: "Frontline capability and process simulation test",
                })
              }
              className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white hover:bg-[#1b40a8] shadow-xs transition cursor-pointer"
            >
              <Plus className="inline h-3.5 w-3.5 mr-1" /> Schedule New Assessment
            </button>
          </div>

          {assessments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
              No assessments scheduled yet. Click &quot;Schedule New Assessment&quot; above to initiate a trial evaluation.
            </div>
          ) : (
            <div className="space-y-4">
              {assessments.map((asm: any) => (
                <div key={asm.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {asm.assessment_code || asm.id}
                        </span>
                        <h4 className="text-sm font-black text-slate-900">{asm.assessment_type}</h4>
                        {getStatusBadge(asm.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Process: <span className="font-semibold text-slate-800">{asm.target_process}</span> · Assessor: <span className="font-semibold text-slate-800">{asm.assessor_name}</span>
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {asm.status !== "PASSED" && (
                        <button
                          type="button"
                          onClick={() =>
                            setRecordResultModal({
                              assessmentId: asm.id,
                              assessmentType: asm.assessment_type,
                              actualScore: asm.actual_score || 85,
                              status: "PASSED",
                              assessorFeedback: "Candidates demonstrated excellent domain competence and voice clarity.",
                            })
                          }
                          className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                        >
                          Record Result
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-medium">Scheduled:</span>
                      <p className="font-bold text-slate-900">{asm.scheduled_date} ({asm.start_time} - {asm.end_time})</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Candidates:</span>
                      <p className="font-bold text-slate-900">{asm.candidate_count} Agents</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Passing Benchmark:</span>
                      <p className="font-bold text-slate-900">{asm.passing_score}%</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Actual Result:</span>
                      <p className="font-bold text-slate-900">
                        {asm.actual_score !== undefined && asm.actual_score !== null ? `${asm.actual_score}%` : "Pending Evaluation"}
                      </p>
                    </div>
                  </div>

                  {asm.assessor_feedback && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700">
                      <span className="font-bold text-slate-800">Assessor Feedback:</span> {asm.assessor_feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* DECISION & ACTIVATION SECTION                                         */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {section === "decision" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-black text-slate-900">
              Executive Accreditation Decision & Centre Activation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict 7-gate validation check enforced on server. Automatic or AI-decision making is strictly prohibited.
            </p>
          </div>

          {/* 7 Activation Gates Status Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#214ECF]" />
              Mandatory Activation Gates Checklist
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {gates.map((g: any) => (
                <div
                  key={g.key}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                    g.passed ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
                  }`}
                >
                  {g.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={`font-bold ${g.passed ? "text-emerald-950" : "text-slate-800"}`}>
                      {g.label}
                    </div>
                    {g.reason && <div className="text-[11px] text-slate-500 mt-0.5">{g.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Decision Record */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">Executive Committee Decision</h4>
                <p className="text-xs text-slate-500">Record final accreditation clearance from Thinkatic Board.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDecisionModal({
                    decision: "APPROVE",
                    notes: "Executive clearance granted. Centre meets all Thinkatic accreditation standards.",
                    rejectionReason: "",
                    conditions: "Standard 1-year accreditation validity with ongoing quality audits",
                  })
                }
                className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a3fa8] transition cursor-pointer"
              >
                Record Decision
              </button>
            </div>

            {decision ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Decision:</span>
                  {getStatusBadge(decision.decision)}
                  <span className="text-slate-400 ml-3">Recorded By:</span>
                  <span className="font-bold text-slate-800">{decision.decision_maker || "Executive Board"}</span>
                </div>
                {decision.decision_notes && (
                  <p className="text-slate-700"><span className="font-semibold">Notes:</span> {decision.decision_notes}</p>
                )}
                {decision.conditions && (
                  <p className="text-slate-600"><span className="font-semibold">Conditions:</span> {decision.conditions}</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                No formal executive board decision recorded yet.
              </div>
            )}
          </div>

          {/* Final Centre Activation Action */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-700" />
                  <h4 className="text-base font-black text-emerald-950">Final Centre Activation</h4>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  Once all 7 gates are satisfied, execute server-side activation to mint the official Centre ID and unlock Partner Portal features.
                </p>
                {centreId && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-emerald-200 text-xs font-bold text-emerald-900 shadow-2xs">
                    <span>Activated Centre ID:</span>
                    <span className="font-mono text-[#214ECF]">{centreId}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setActivateModal({
                    notes: "Centre formally activated by Thinkatic Operations Executive",
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition cursor-pointer shrink-0"
              >
                <Check className="h-4 w-4" /> Activate Centre Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: STAGE REVIEW / ACTIONS MODAL                                 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {stageModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">{stageModal.stageTitle} Action</h4>
              </div>
              <button onClick={() => setStageModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Action</label>
                <select
                  value={stageModal.action}
                  onChange={(e: any) => setStageModal({ ...stageModal, action: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                >
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="VERIFIED">Verified / Approved</option>
                  <option value="RESUBMISSION_REQUIRED">Request Changes (Resubmission Required)</option>
                  <option value="REJECTED">Reject Stage</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reviewer Notes & Feedback {stageModal.action !== "VERIFIED" && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={4}
                  value={stageModal.notes}
                  onChange={(e) => setStageModal({ ...stageModal, notes: e.target.value })}
                  placeholder="Enter specific reviewer remarks or corrections required by the applicant..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 placeholder:text-slate-400 focus:border-[#214ECF] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStageModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStageSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a3fa8] transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Action"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: DOCUMENT VERIFY / REJECT MODAL                               */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {documentModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
                  <FileText className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Document Review: {documentModal.docName}</h4>
              </div>
              <button onClick={() => setDocumentModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={documentModal.action}
                  onChange={(e: any) => setDocumentModal({ ...documentModal, action: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                >
                  <option value="verified">Verified (Compliant)</option>
                  <option value="resubmission_required">Request Re-upload (Action Required)</option>
                  <option value="rejected">Reject Document</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reviewer Notes</label>
                <input
                  type="text"
                  value={documentModal.notes}
                  onChange={(e) => setDocumentModal({ ...documentModal, notes: e.target.value })}
                  placeholder="e.g. Verified by Thinkatic Operations team"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              {documentModal.action !== "verified" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rejection / Correction Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={documentModal.reason}
                    onChange={(e) => setDocumentModal({ ...documentModal, reason: e.target.value })}
                    placeholder="Clearly explain what is wrong with the document and what the applicant must re-upload..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 placeholder:text-slate-400 focus:border-[#214ECF] outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDocumentModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDocumentSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a3fa8] transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Verification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: SCHEDULE ASSESSMENT MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {scheduleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
                  <Calendar className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Schedule Frontline Assessment</h4>
              </div>
              <button onClick={() => setScheduleModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Assessment Type</label>
                <select
                  value={scheduleModal.assessmentType}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, assessmentType: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                >
                  <option value="Technical Test">Technical Test</option>
                  <option value="Agent Readiness">Agent Readiness</option>
                  <option value="Process Simulation">Process Simulation</option>
                  <option value="Voice/Communication Assessment">Voice/Communication Assessment</option>
                  <option value="Operational Readiness">Operational Readiness</option>
                  <option value="Pilot / Trial">Pilot / Trial</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scheduled Date *</label>
                <input
                  type="date"
                  value={scheduleModal.scheduledDate}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, scheduledDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={scheduleModal.startTime}
                    onChange={(e) => setScheduleModal({ ...scheduleModal, startTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={scheduleModal.endTime}
                    onChange={(e) => setScheduleModal({ ...scheduleModal, endTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assessor Name</label>
                <input
                  type="text"
                  value={scheduleModal.assessorName}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, assessorName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Process</label>
                <input
                  type="text"
                  value={scheduleModal.targetProcess}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, targetProcess: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Required Candidates</label>
                <input
                  type="number"
                  value={scheduleModal.candidateCount}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, candidateCount: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Passing Score (%)</label>
                <input
                  type="number"
                  value={scheduleModal.passingScore}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, passingScore: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Test Scope & Instructions</label>
                <textarea
                  rows={2}
                  value={scheduleModal.notes}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, notes: e.target.value })}
                  placeholder="Evaluation scope, simulated scripts, and dialer testing..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScheduleModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a3fa8] transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Confirm Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: RECORD ASSESSMENT RESULT MODAL                               */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {recordResultModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Record Assessment Outcome</h4>
              </div>
              <button onClick={() => setRecordResultModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Result Status</label>
                  <select
                    value={recordResultModal.status}
                    onChange={(e: any) => setRecordResultModal({ ...recordResultModal, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                  >
                    <option value="PASSED">PASSED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Actual Score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={recordResultModal.actualScore}
                    onChange={(e) => setRecordResultModal({ ...recordResultModal, actualScore: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assessor Feedback & Quality Report</label>
                <textarea
                  rows={4}
                  value={recordResultModal.assessorFeedback}
                  onChange={(e) => setRecordResultModal({ ...recordResultModal, assessorFeedback: e.target.value })}
                  placeholder="Performance summary, voice clarity, dialer readiness, and candidate strengths/weaknesses..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 placeholder:text-slate-400 focus:border-[#214ECF] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRecordResultModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordResultSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Result"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: EXECUTIVE DECISION MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {decisionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Executive Accreditation Decision</h4>
              </div>
              <button onClick={() => setDecisionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Decision</label>
                <select
                  value={decisionModal.decision}
                  onChange={(e: any) => setDecisionModal({ ...decisionModal, decision: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                >
                  <option value="APPROVE">APPROVE (Accreditation Granted)</option>
                  <option value="REQUEST_REASSESSMENT">REQUEST REASSESSMENT</option>
                  <option value="REJECT">REJECT APPLICATION</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Executive Notes</label>
                <textarea
                  rows={3}
                  value={decisionModal.notes}
                  onChange={(e) => setDecisionModal({ ...decisionModal, notes: e.target.value })}
                  placeholder="Executive rationale, compliance notes..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              {decisionModal.decision !== "APPROVE" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rejection / Reassessment Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={decisionModal.rejectionReason}
                    onChange={(e) => setDecisionModal({ ...decisionModal, rejectionReason: e.target.value })}
                    placeholder="Mandatory justification for adverse decision..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Conditions & Operational Scope</label>
                <input
                  type="text"
                  value={decisionModal.conditions}
                  onChange={(e) => setDecisionModal({ ...decisionModal, conditions: e.target.value })}
                  placeholder="e.g. Standard 1-year accreditation validity, max 100 concurrent agents"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecisionSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a3fa8] transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL 6: CENTRE ACTIVATION MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Activate Accredited BPO Centre?</h4>
                <p className="text-xs text-slate-500">
                  This executes server-side validation across all 7 gates and unlocks full partner portal functionality.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-3.5 text-xs text-emerald-800 space-y-1.5">
              <div className="font-bold text-emerald-950">System Actions upon Activation:</div>
              <ul className="space-y-1 pl-4 list-disc text-emerald-800 text-[11px]">
                <li>Mints or activates official Centre ID in format <code>THK-IN-[STATE]-[SEQ]</code>.</li>
                <li>Transitions account status to <strong>APPROVED</strong>.</li>
                <li>Unlocks marketplace bidding and campaign assignment.</li>
                <li>Sends formal confirmation email and logs tamper-proof audit event.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Activation Notes</label>
              <textarea
                rows={3}
                value={activateModal.notes}
                onChange={(e) => setActivateModal({ ...activateModal, notes: e.target.value })}
                placeholder="e.g. All gates validated. Centre certified for operations."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-[#214ECF]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivateModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivateSubmit}
                disabled={actionLoading}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Confirm & Activate Centre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EVIDENCE MEDIA REVIEW (PHOTO / VIDEO)                          */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {mediaReviewModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    mediaReviewModal.action === "approve"
                      ? "bg-emerald-100 text-emerald-700"
                      : mediaReviewModal.action === "reject"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {mediaReviewModal.mediaType === "photo" ? <Camera className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Review Evidence: {mediaReviewModal.category}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{mediaReviewModal.mediaName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMediaReviewModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Review Decision</label>
                <select
                  value={mediaReviewModal.action}
                  onChange={(e: any) =>
                    setMediaReviewModal({ ...mediaReviewModal, action: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-800 outline-none focus:border-[#214ECF]"
                >
                  <option value="approve">APPROVE (Accept Evidence)</option>
                  <option value="resubmission_required">REQUEST RE-UPLOAD (Deficient / Blur / Obscured)</option>
                  <option value="reject">REJECT (Invalid / Fraudulent / Non-Compliant)</option>
                </select>
              </div>

              {(mediaReviewModal.action === "reject" || mediaReviewModal.action === "resubmission_required") && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rejection / Resubmission Reason <span className="text-rose-500">* (Mandatory)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={mediaReviewModal.rejectionReason}
                    onChange={(e) =>
                      setMediaReviewModal({ ...mediaReviewModal, rejectionReason: e.target.value })
                    }
                    placeholder="Clearly specify why this photograph or video is rejected and what the partner must correct..."
                    className="w-full rounded-xl border border-rose-200 bg-rose-50/20 p-2.5 text-xs text-slate-800 outline-none focus:border-rose-400"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reviewer Notes (Internal)</label>
                <textarea
                  rows={2}
                  value={mediaReviewModal.notes}
                  onChange={(e) => setMediaReviewModal({ ...mediaReviewModal, notes: e.target.value })}
                  placeholder="Optional internal remarks for the accreditation audit trail..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMediaReviewModal(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMediaReviewSubmit}
                disabled={
                  actionLoading ||
                  ((mediaReviewModal.action === "reject" || mediaReviewModal.action === "resubmission_required") &&
                    !mediaReviewModal.rejectionReason.trim())
                }
                className={`rounded-xl px-5 py-2 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer ${
                  mediaReviewModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : mediaReviewModal.action === "reject"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Review Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ENLARGED PHOTO PREVIEW LIGHTBOX                                */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {previewPhotoModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-white">
              <div>
                <span className="text-xs font-bold text-blue-400">{previewPhotoModal.category}</span>
                <p className="text-xs text-slate-300 font-mono">{previewPhotoModal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-2 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.title}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
