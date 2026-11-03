// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — ADMIN OFFICE / CENTRE VERIFICATION
// Comprehensive Admin dossier review panel.
// Office Details, Categorized Photos Lightbox, Live Video Player, Human Review Checklist,
// Approve / Reject with MANDATORY rejection reason. Zero AI decisioning.
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
  Search,
  Filter,
  Eye,
  Check,
  X,
  Send,
  Loader2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Phone,
  RefreshCw,
  FileCheck,
  Layers,
} from "lucide-react";
import { formatFileSize } from "../partner/OfficePhotosUploader";

interface VerificationItem {
  id: number;
  partnerId: string | null;
  applicationId: number | null;
  centreId: string | null;
  applicantUserId: string;
  officeName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  landmark: string | null;
  contactNumber: string;
  centreType: string;
  ownershipType: string;
  operatingSince: string;
  totalAreaSqft: number | null;
  numberOfFloors: number | null;
  status: string;
  submittedAt: string | null;
  submissionCount: number;
  reviewedAt: string | null;
  reviewedByAdminId: number | null;
  reviewedByAdminName: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  media: any[];
  history: any[];
}

export default function AdminCentreVerificationPanel() {
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVerification, setSelectedVerification] = useState<VerificationItem | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);

  // Informational Checklist state (purely human review)
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({
    office_name: true,
    address_complete: true,
    photos_readable: true,
    video_playable: true,
    video_shows_centre: true,
    infrastructure_verified: true,
    consistent: true,
  });

  const adminToken = localStorage.getItem("admin_token") || "";

  async function loadVerifications() {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const url = new URL("/api/admin/bpo/centre-verifications", window.location.origin);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      if (searchQuery.trim()) url.searchParams.set("search", searchQuery.trim());

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setVerifications(data.verifications || []);
      } else {
        setFeedbackMsg({ type: "error", text: "Failed to load centre verifications." });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error loading centre verifications." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVerifications();
  }, [statusFilter, adminToken]);

  async function handleOpenReview(verif: VerificationItem) {
    try {
      const res = await fetch(`/api/admin/bpo/centre-verifications/${verif.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedVerification(data.verification);
      } else {
        setSelectedVerification(verif);
      }
    } catch {
      setSelectedVerification(verif);
    }
    setReviewModalOpen(true);
  }

  async function handleApprove() {
    if (!selectedVerification) return;
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/admin/bpo/centre-verifications/${selectedVerification.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Approval failed");

      setFeedbackMsg({ type: "success", text: `Office verification for "${selectedVerification.officeName}" approved successfully!` });
      setReviewModalOpen(false);
      await loadVerifications();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to approve verification" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedVerification) return;
    if (!rejectionReasonText.trim()) {
      alert("A specific rejection reason is strictly required.");
      return;
    }

    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/admin/bpo/centre-verifications/${selectedVerification.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: rejectionReasonText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Rejection failed");

      setFeedbackMsg({ type: "success", text: `Office verification rejected with feedback recorded.` });
      setRejectModalOpen(false);
      setReviewModalOpen(false);
      setRejectionReasonText("");
      await loadVerifications();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to reject verification" });
    } finally {
      setActionLoading(false);
    }
  }

  const activePhotos = selectedVerification?.media?.filter((m) => m.mediaType === "photo" && m.status === "active") || [];
  const activeVideo = selectedVerification?.media?.find((m) => m.mediaType === "video" && m.status === "active");

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#214ECF]">
                Operations Accreditation
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                Phase: Centre Verification
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              BPO Partner Office / Centre Verification
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Manual inspection of partner physical centre details, categorized photos, and live walkthrough video before Global Delivery Agreement approval.
            </p>
          </div>

          <button
            type="button"
            onClick={loadVerifications}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters & Search */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
            {[
              { id: "all", label: "All" },
              { id: "SUBMITTED", label: "New / Submitted" },
              { id: "UNDER_REVIEW", label: "Under Review" },
              { id: "APPROVED", label: "Approved" },
              { id: "RESUBMISSION_REQUIRED", label: "Resubmission Req." },
              { id: "REJECTED", label: "Rejected" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                  statusFilter === f.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search office or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadVerifications()}
              className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs font-semibold focus:border-[#214ECF] focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Verifications Table */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Centre / Office</th>
                <th className="px-5 py-4">Centre ID</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Evidence</th>
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Reviewer</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-[#214ECF] mx-auto mb-2" />
                    Loading centre verification requests...
                  </td>
                </tr>
              ) : verifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No office verification submissions found matching filter criteria.
                  </td>
                </tr>
              ) : (
                verifications.map((v) => {
                  const photosCount = v.media.filter((m) => m.mediaType === "photo" && m.status === "active").length;
                  const hasVideo = v.media.some((m) => m.mediaType === "video" && m.status === "active");

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{v.officeName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              User: {v.applicantUserId.slice(0, 12)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-mono text-slate-600 font-bold">
                        {v.centreId || <span className="text-slate-300">Pending</span>}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{v.city || "—"}, {v.state || "—"}</p>
                        <p className="text-[10px] text-slate-400">{v.country}</p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="flex items-center gap-1 font-bold text-slate-600">
                            <Camera className="h-3 w-3 text-blue-600" />
                            {photosCount} photos
                          </span>
                          <span
                            className={`flex items-center gap-1 font-bold ${
                              hasVideo ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
                            <Video className="h-3 w-3" />
                            {hasVideo ? "Video OK" : "No Video"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : "Draft"}
                        {v.submissionCount > 1 && (
                          <span className="ml-1 rounded-full bg-blue-100 text-[#214ECF] px-1.5 py-0.2 text-[9px] font-bold">
                            R{v.submissionCount}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            v.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : v.status === "SUBMITTED"
                              ? "bg-blue-100 text-blue-800 animate-pulse"
                              : v.status === "RESUBMISSION_REQUIRED" || v.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {v.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {v.reviewedByAdminName || "—"}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(v)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                        >
                          <Eye className="h-3 w-3" />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVIEW DOSSIER MODAL */}
      {reviewModalOpen && selectedVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl rounded-3xl bg-white shadow-2xl p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-[#214ECF]/10 flex items-center justify-center text-[#214ECF]">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#0B1F3A]">
                    {selectedVerification.officeName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Centre Verification Dossier · Round {selectedVerification.submissionCount || 1}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Office Attributes Grid */}
            <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">
                Office & Infrastructure Metadata
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Full Address</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedVerification.addressLine1}
                    {selectedVerification.addressLine2 ? `, ${selectedVerification.addressLine2}` : ""}
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    {selectedVerification.city}, {selectedVerification.state} {selectedVerification.postalCode}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">Facility & Ownership</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedVerification.centreType}</p>
                  <p className="text-slate-600 text-[11px]">{selectedVerification.ownershipType}</p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">Operating Since & Scale</span>
                  <p className="font-bold text-slate-900 mt-0.5">Since {selectedVerification.operatingSince}</p>
                  <p className="text-slate-600 text-[11px]">
                    {selectedVerification.totalAreaSqft ? `${selectedVerification.totalAreaSqft} sqft` : "Area not specified"} · {selectedVerification.numberOfFloors || 1} Floors
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">Contact & Centre ID</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedVerification.contactNumber}</p>
                  <p className="text-slate-600 text-[11px] font-mono">
                    {selectedVerification.centreId || "Centre ID unassigned"}
                  </p>
                </div>
              </div>
            </div>

            {/* Live Office Walkthrough Video */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                  <Video className="h-4 w-4 text-[#214ECF]" />
                  Live Office Walkthrough Video
                </h4>
                {activeVideo && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatFileSize(activeVideo.fileSize)}
                  </span>
                )}
              </div>

              {activeVideo ? (
                <div className="rounded-2xl bg-black overflow-hidden aspect-video max-h-[380px] flex items-center justify-center">
                  <video
                    src={`/api/admin/bpo/centre-verifications/media/${activeVideo.id}?admin_token=${adminToken}`}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-xs">
                  No live office walkthrough video has been uploaded for this centre.
                </div>
              )}
            </div>

            {/* Categorized Photographs */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                <Camera className="h-4 w-4 text-[#214ECF]" />
                Categorized Photographs ({activePhotos.length})
              </h4>

              {activePhotos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-xs">
                  No office photographs uploaded.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {activePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-[#214ECF] transition aspect-video bg-slate-100"
                    >
                      <img
                        src={`/api/admin/bpo/centre-verifications/media/${photo.id}?admin_token=${adminToken}`}
                        alt={photo.category}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                        <p className="text-[10px] font-bold text-white truncate capitalize">
                          {photo.category.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Human Admin Review Checklist (Informational - Section 18) */}
            <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-700" />
                <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider">
                  Admin Verification Audit Checklist (Human Decision Only)
                </h4>
              </div>
              <p className="text-[11px] text-slate-600">
                Please manually verify the evidence points below before issuing accreditation:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { key: "office_name", label: "Office / centre name provided & matches application" },
                  { key: "address_complete", label: "Full physical address provided with PIN and contact" },
                  { key: "photos_readable", label: "Office photographs are clear, readable, and current" },
                  { key: "video_playable", label: "Live office walkthrough video is playable" },
                  { key: "video_shows_centre", label: "Video walkthrough clearly shows actual operating centre" },
                  { key: "infrastructure_verified", label: "Infrastructure evidence available (power backup / ISP rack)" },
                  { key: "consistent", label: "Submitted information is internally consistent" },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer text-slate-800">
                    <input
                      type="checkbox"
                      checked={checklistState[item.key] ?? false}
                      onChange={(e) =>
                        setChecklistState({ ...checklistState, [item.key]: e.target.checked })
                      }
                      className="rounded-sm border-slate-300 text-[#214ECF] focus:ring-[#214ECF]"
                    />
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <p className="text-[11px] text-slate-500">
                Approval unlocks the Partner for the Global Delivery Partner Agreement workflow. It does not auto-activate active partner status.
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={actionLoading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 px-5 py-2.5 text-xs font-black transition"
                >
                  <X className="h-3.5 w-3.5" />
                  REJECT / REQUEST CORRECTION
                </button>

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 text-xs font-black transition shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  APPROVE OFFICE VERIFICATION
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL (Section 9: Mandatory Rejection Reason) */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl text-slate-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-black">Specify Rejection / Correction Reason</h4>
                <p className="text-xs text-slate-500">Mandatory feedback for the BPO Partner</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please explain clearly what is missing or unsatisfactory. The Partner will see this reason on their dashboard and will be required to resubmit the corrected information or evidence.
            </p>

            <textarea
              required
              rows={4}
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              placeholder="e.g. Office walkthrough video does not clearly show the primary operations floor or workstation layout. Please record a continuous walkthrough including the DG power backup."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs font-semibold text-slate-900 focus:border-rose-500 focus:outline-hidden"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!rejectionReasonText.trim() || actionLoading}
                onClick={handleReject}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                Confirm Rejection & Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
              <span className="text-xs font-bold capitalize">
                {lightboxPhoto.category?.replace(/_/g, " ")} · {lightboxPhoto.originalFileName}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-4 flex items-center justify-center max-h-[75vh]">
              <img
                src={`/api/admin/bpo/centre-verifications/media/${lightboxPhoto.id}?admin_token=${adminToken}`}
                alt="Enlarged"
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
