import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ShieldCheck,
  Building2,
  Search,
  Filter,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
  CreditCard,
  Landmark,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Download,
  RefreshCw,
  Bell,
  Clock,
  History,
  Mail,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MoreVertical,
  X,
  Check,
  Sparkles,
  MapPin,
  Phone,
  Calendar,
  Layers,
  ArrowUpRight,
  SlidersHorizontal,
  LayoutDashboard,
  User,
  Factory,
  FileSignature,
  Send,
  Lock,
  PenLine,
  Upload,
  Loader2,
  Cpu,
} from "lucide-react";
import AdminAccreditationWorkspace from "./AdminAccreditationWorkspace";

interface AdminBpoApprovalsPanelProps {
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

const getCleanCompanyName = (entity: any) => {
  if (!entity) return "—";
  const candidates = [
    entity.formalApplication?.company_data?.companyName,
    entity.formalApplication?.company_data?.company_name,
    entity.companyName,
    entity.company_name,
    entity.centreVerification?.officeName,
    entity.centreVerification?.office_name,
    entity.name,
    entity.full_name,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim().toLowerCase() !== "none" && c.trim().toLowerCase() !== "null") {
      return c.trim();
    }
  }
  return entity.full_name || entity.name || "BPO Partner";
};

export default function AdminBpoApprovalsPanel({ apiCall }: AdminBpoApprovalsPanelProps) {
  // Application list & filtering state
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    resubmission: 0,
    archived: 0,
    suspended: 0,
  });

  const [accreditationCounts, setAccreditationCounts] = useState({
    total: 0,
    under_review: 0,
    awaiting_documents: 0,
    infrastructure_pending: 0,
    assessments_pending: 0,
    decisions_pending: 0,
    activated_centres: 0,
    resubmissions: 0,
  });

  // Dossier Drawer State
  const [selectedBpoId, setSelectedBpoId] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossier, setDossier] = useState<any | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState("overview");
  const [isBankRevealed, setIsBankRevealed] = useState(false);
  const [isPanRevealed, setIsPanRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsRef.current) {
      const amount = direction === "left" ? -280 : 280;
      tabsRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
    showToast("Copied to clipboard", "info");
  };

  // Office Photos Lightbox State
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; category: string } | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Video Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Action Modals State
  const [approveModalApp, setApproveModalApp] = useState<any | null>(null);
  const [suspendModalApp, setSuspendModalApp] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspensionCategory, setSuspensionCategory] = useState("Operational & Compliance Review");
  const [rejectModalApp, setRejectModalApp] = useState<any | null>(null);
  const [rejectActionType, setRejectActionType] = useState<"REJECTED" | "RESUBMISSION_REQUIRED">("RESUBMISSION_REQUIRED");
  const [rejectReason, setRejectReason] = useState("");
  const [archiveModalApp, setArchiveModalApp] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [visiblePhotosCount, setVisiblePhotosCount] = useState(24);

  // Email Delivery & Retry State
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [failedEmailApp, setFailedEmailApp] = useState<{ id: string; name: string; recipient: string; error?: string } | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const adminToken = localStorage.getItem("admin_token") || "";

  // Agreement Modals & Actions State
  const [viewOriginalModalOpen, setViewOriginalModalOpen] = useState(false);
  const [viewSignedModalOpen, setViewSignedModalOpen] = useState(false);
  const [approveAgreementModalOpen, setApproveAgreementModalOpen] = useState(false);
  const [rejectAgreementModalOpen, setRejectAgreementModalOpen] = useState(false);
  const [issueAgreementModalOpen, setIssueAgreementModalOpen] = useState(false);
  const [agreementRejectReason, setAgreementRejectReason] = useState("");
  const [agreementActionLoading, setAgreementActionLoading] = useState(false);

  // Agreement Action Handlers
  const downloadOriginalAgreement = async (agreementId: number) => {
    try {
      const res = await apiCall(`/admin/agreements/${agreementId}/download-original`);
      if (!res.ok) {
        showToast("Failed to download master agreement PDF", "error");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Thinkatic-BPO-Partner-Agreement.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Master agreement downloaded successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to download master agreement", "error");
    }
  };

  const downloadSignedAgreement = async (agreementId: number, filename?: string) => {
    try {
      const res = await apiCall(`/admin/agreements/${agreementId}/download-signed`);
      if (!res.ok) {
        showToast("Failed to download signed agreement PDF", "error");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "Thinkatic-Signed-Partner-Agreement.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Signed agreement downloaded successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to download signed agreement", "error");
    }
  };

  const handleIssueAgreement = async () => {
    if (!dossier) return;
    setAgreementActionLoading(true);
    try {
      const res = await apiCall("/admin/agreements/issue", {
        method: "POST",
        body: JSON.stringify({
          applicationId: dossier.formalApplication?.id || dossier.id,
          partnerId: dossier.id,
          legalName: dossier.companyName || dossier.name,
          tradeName: dossier.companyName || dossier.name,
          centreId: dossier.centre_id || dossier.centreVerification?.centreId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Agreement ${data.agreement?.agreementCode || ""} issued successfully`, "success");
        setIssueAgreementModalOpen(false);
        if (selectedBpoId) await openDossier(selectedBpoId);
      } else {
        showToast(data.message || data.error || "Failed to issue agreement", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error issuing agreement", "error");
    } finally {
      setAgreementActionLoading(false);
    }
  };

  const handleApproveAgreement = async () => {
    const agr = dossier?.agreement;
    if (!agr?.id) return;
    setAgreementActionLoading(true);
    try {
      const res = await apiCall(`/admin/agreements/${agr.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Agreement approved successfully. Partner notified.", "success");
        setApproveAgreementModalOpen(false);
        setViewSignedModalOpen(false);
        if (selectedBpoId) await openDossier(selectedBpoId);
      } else {
        showToast(data.message || data.error || "Failed to approve agreement", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error approving agreement", "error");
    } finally {
      setAgreementActionLoading(false);
    }
  };

  const handleRejectAgreement = async () => {
    const agr = dossier?.agreement;
    if (!agr?.id || !agreementRejectReason.trim()) {
      showToast("A rejection reason is strictly required", "error");
      return;
    }
    setAgreementActionLoading(true);
    try {
      const res = await apiCall(`/admin/agreements/${agr.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: agreementRejectReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Agreement rejected. Partner notified to upload corrected PDF.", "info");
        setRejectAgreementModalOpen(false);
        setViewSignedModalOpen(false);
        setAgreementRejectReason("");
        if (selectedBpoId) await openDossier(selectedBpoId);
      } else {
        showToast(data.message || data.error || "Failed to reject agreement", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error rejecting agreement", "error");
    } finally {
      setAgreementActionLoading(false);
    }
  };

  // Office Verification Actions
  const [officeVerifRejectModalOpen, setOfficeVerifRejectModalOpen] = useState(false);
  const [officeVerifRejectReason, setOfficeVerifRejectReason] = useState("");
  const [officeVerifActionLoading, setOfficeVerifActionLoading] = useState(false);

  const handleApproveOfficeVerification = async (verificationId: number) => {
    if (!verificationId) return;
    setOfficeVerifActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo/centre-verifications/${verificationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Office details, photos, and live video verified by Thinkatic Operations" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Office Verification Approved Successfully", "success");
        if (selectedBpoId) await openDossier(selectedBpoId);
      } else {
        showToast(data.message || data.error || "Failed to approve office verification", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error approving office verification", "error");
    } finally {
      setOfficeVerifActionLoading(false);
    }
  };

  const handleRejectOfficeVerification = async (verificationId: number) => {
    if (!verificationId) return;
    if (!officeVerifRejectReason.trim()) {
      showToast("A rejection reason is strictly required", "error");
      return;
    }
    setOfficeVerifActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo/centre-verifications/${verificationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: officeVerifRejectReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Correction request sent to partner", "info");
        setOfficeVerifRejectModalOpen(false);
        setOfficeVerifRejectReason("");
        if (selectedBpoId) await openDossier(selectedBpoId);
      } else {
        showToast(data.message || data.error || "Failed to reject office verification", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error requesting corrections", "error");
    } finally {
      setOfficeVerifActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────────

  const loadSummaryCounts = useCallback(async () => {
    try {
      const [res, accRes] = await Promise.all([
        apiCall("/admin/bpo-applications/summary"),
        apiCall("/admin/accreditation/summary"),
      ]);
      if (res.ok) {
        const data = await res.json();
        if (data.counts) setCounts(data.counts);
      }
      if (accRes.ok) {
        const accData = await accRes.json();
        if (accData.counts) {
          const c = accData.counts;
          setAccreditationCounts({
            total: c.total ?? c.applicationsTotal ?? 0,
            under_review: c.under_review ?? c.underReview ?? 0,
            awaiting_documents: c.awaiting_documents ?? c.awaitingDocuments ?? 0,
            infrastructure_pending: c.infrastructure_pending ?? c.infrastructurePending ?? 0,
            assessments_pending: c.assessments_pending ?? c.assessmentsPending ?? 0,
            decisions_pending: c.decisions_pending ?? c.decisionsPending ?? 0,
            activated_centres: c.activated_centres ?? c.activatedCentres ?? 0,
            resubmissions: c.resubmissions ?? 0,
          });
        }
      }
    } catch {}
  }, [apiCall]);

  const loadApplications = useCallback(async (showIndicator = false, pageOverride?: number, pageSizeOverride?: number) => {
    if (showIndicator) setRefreshing(true);
    try {
      const pageToUse = pageOverride !== undefined ? pageOverride : currentPage;
      const sizeToUse = pageSizeOverride !== undefined ? pageSizeOverride : pageSize;
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("sort", sortBy);
      params.set("page", String(pageToUse));
      params.set("pageSize", String(sizeToUse));
      params.set("envelope", "true");

      const res = await apiCall(`/admin/bpo-applications?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        if (result.data && Array.isArray(result.data)) {
          setApplications(result.data);
          if (result.counts) setCounts(result.counts);
          if (result.pagination) setPagination(result.pagination);
        } else if (Array.isArray(result)) {
          setApplications(result);
        }
      } else {
        showToast("Failed to load BPO applications list", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error loading applications", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiCall, statusFilter, searchQuery, sortBy, currentPage, pageSize]);

  useEffect(() => {
    loadSummaryCounts();
    loadApplications();
  }, [loadSummaryCounts, loadApplications]);

  // Load Complete Dossier when an applicant is clicked
  const openDossier = async (id: string) => {
    setSelectedBpoId(id);
    setDossierLoading(true);
    setActiveDossierTab("overview");
    setIsBankRevealed(false);
    setCopiedField(null);
    try {
      const res = await apiCall(`/admin/bpo-applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.accreditation && data.formalApplication?.id) {
          try {
            const accRes = await apiCall(`/admin/accreditation/applications/${data.formalApplication.id}`);
            if (accRes.ok) {
              data.accreditation = await accRes.json();
            }
          } catch {}
        }
        setDossier(data);
      } else {
        showToast("Failed to load complete BPO dossier", "error");
        setSelectedBpoId(null);
      }
    } catch (err: any) {
      showToast(err?.message || "Error loading dossier", "error");
      setSelectedBpoId(null);
    } finally {
      setDossierLoading(false);
    }
  };

  const closeDossier = () => {
    setSelectedBpoId(null);
    setDossier(null);
    setIsPlaying(false);
    setIsBankRevealed(false);
    setCopiedField(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS: APPROVE, REJECT, ARCHIVE
  // ─────────────────────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approveModalApp) return;
    setActionLoading(true);
    const targetApp = approveModalApp;
    try {
      const res = await apiCall(`/admin/bpo-applications/${targetApp.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.email_sent) {
          showToast(
            `Partner approved successfully. Confirmation email sent to ${data.email_recipient || "registered email"}.`,
            "success"
          );
          setFailedEmailApp(null);
        } else if (data.email_sent === false) {
          showToast(
            "Partner was approved, but the confirmation email could not be sent. Please retry the email.",
            "error"
          );
          setFailedEmailApp({
            id: targetApp.id,
            name: targetApp.companyName || targetApp.name || "BPO Partner",
            recipient: data.email_recipient || targetApp.email || "registered email",
            error: data.email_error || "Provider transmission failure",
          });
        } else {
          showToast(
            `Partner approved successfully. Confirmation email sent to ${data.email_recipient || "registered email"}.`,
            "success"
          );
        }
        setApproveModalApp(null);
        loadApplications();
        loadSummaryCounts();
        if (selectedBpoId === targetApp.id) {
          openDossier(targetApp.id);
        }
      } else {
        showToast(data.error || "Approval failed", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Approval network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryApprovalEmail = async (appId: string) => {
    if (!appId || retryingEmailId) return;
    setRetryingEmailId(appId);
    try {
      const res = await apiCall(`/admin/bpo-applications/${appId}/resend-approval-email`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.email_sent) {
        const masked = data.email_recipient ? ` (${data.email_recipient})` : "";
        showToast(`Approval email sent successfully to the applicant's registered email${masked}.`, "success");
        setFailedEmailApp(null);
      } else {
        showToast(data.message || data.error || "Approval email could not be sent. Please try again.", "error");
      }
    } catch (err: any) {
      showToast("Approval email could not be sent. Please try again.", "error");
    } finally {
      setRetryingEmailId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalApp) return;
    if (!rejectReason.trim()) {
      showToast("A clear rejection or resubmission reason is strictly required.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo-applications/${rejectModalApp.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: rejectActionType,
          rejection_reason: rejectReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const actionLabel = rejectActionType === "RESUBMISSION_REQUIRED" ? "Resubmission requested" : "Application rejected";
        showToast(`${actionLabel} for ${rejectModalApp.companyName || rejectModalApp.name}. Reason recorded.`, "success");
        setRejectModalApp(null);
        setRejectReason("");
        loadApplications();
        loadSummaryCounts();
        if (selectedBpoId === rejectModalApp.id) {
          openDossier(rejectModalApp.id);
        }
      } else {
        showToast(data.error || "Action failed", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Rejection network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendPartner = async () => {
    if (!suspendModalApp) return;
    if (!suspendReason.trim()) {
      showToast("Please provide a suspension/hold reason for the partner", "error");
      return;
    }
    setActionLoading(true);
    try {
      const fullReason = suspensionCategory
        ? `[${suspensionCategory}] ${suspendReason.trim()}`
        : suspendReason.trim();
      const res = await apiCall(`/admin/bpo-applications/${suspendModalApp.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "SUSPENDED",
          reason: fullReason,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.id)) {
        showToast(data.message || "Partner account temporarily suspended", "success");
        setSuspendModalApp(null);
        setSuspendReason("");
        await loadApplications();
        await loadSummaryCounts();
        if (selectedBpoId === suspendModalApp.id) {
          openDossier(suspendModalApp.id);
        }
      } else {
        showToast(data.error || "Failed to suspend partner account", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error suspending partner", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestorePartner = async (appId: string) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo-applications/${appId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "RESTORE",
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.id)) {
        showToast(data.message || "Partner access restored successfully", "success");
        await loadApplications();
        await loadSummaryCounts();
        if (selectedBpoId === appId) {
          openDossier(appId);
        }
      } else {
        showToast(data.error || "Failed to restore partner access", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error restoring partner", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePermanently = async () => {
    if (!archiveModalApp) return;
    const targetId = archiveModalApp.id;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo-applications/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("BPO Partner permanently deleted.", "success");
        setArchiveModalApp(null);
        if (selectedBpoId === targetId) {
          closeDossier();
        }
        // Immediately remove from visible list for instant UI feedback
        setApplications((prev) => prev.filter((app) => app.id !== targetId));
        // Refresh real persisted backend data & counters
        await loadApplications();
        await loadSummaryCounts();
      } else {
        showToast(data.error || data.message || "Unable to delete BPO Partner. No changes were confirmed.", "error");
      }
    } catch (err: any) {
      showToast("Unable to delete BPO Partner. No changes were confirmed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Video Controls
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    setVideoProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
    videoRef.current.currentTime = seekTime;
    setVideoProgress(parseFloat(e.target.value));
  };

  const toggleVideoMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleVideoFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  // Format Helper
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* NOTIFICATION TOAST                                                    */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="admin-bpo-toast"
          className={`fixed top-5 right-5 z-70 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-950/95 text-white border-emerald-500/50 shadow-emerald-950/30"
              : toast.type === "error"
              ? "bg-rose-950/95 text-white border-rose-500/50 shadow-rose-950/30"
              : "bg-slate-900/95 text-white border-slate-700/50"
          }`}
        >
          {toast.type === "success" ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <span className="text-sm font-semibold tracking-tight">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 flex h-6 w-6 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* EMAIL DELIVERY FAILURE ALERT & RETRY ACTION                           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {failedEmailApp && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm text-amber-950 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950">
                Partner was approved, but the confirmation email could not be sent. Please retry the email.
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Applicant: <span className="font-semibold">{failedEmailApp.name}</span> ({failedEmailApp.recipient})
                {failedEmailApp.error ? ` • Note: ${failedEmailApp.error}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRetryApprovalEmail(failedEmailApp.id)}
              disabled={Boolean(retryingEmailId)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-98 transition disabled:opacity-50 cursor-pointer"
            >
              {retryingEmailId === failedEmailApp.id ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{retryingEmailId === failedEmailApp.id ? "Sending..." : "Retry Approval Email"}</span>
            </button>
            <button
              type="button"
              onClick={() => setFailedEmailApp(null)}
              className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-200/60 transition cursor-pointer"
              title="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TOP HEADER & STATS SUMMARY BAR                                         */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#214ECF]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#214ECF]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Operations Governance
              </span>
              <span className="text-xs font-semibold text-slate-400">·</span>
              <span className="text-xs font-medium text-slate-500">Thinkatic BPO Delivery Network</span>
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
              BPO Partner Applications & Approvals
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Inspect comprehensive BPO applicant dossiers, verify private office media & walkthrough videos, and manage partner lifecycle.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (refreshing) return;
                try {
                  await Promise.all([loadSummaryCounts(), loadApplications(true, 1)]);
                  showToast("Applications refreshed", "success");
                } catch {
                  showToast("Failed to refresh applications", "error");
                }
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-98 transition disabled:opacity-50 cursor-pointer"
              title="Refresh applications and counters"
            >
              <RefreshCw className={`h-4 w-4 text-slate-600 ${refreshing ? "animate-spin text-[#214ECF]" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Filter Chips: Accreditation & Status Categories */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9 pt-4 border-t border-slate-100">
          {[
            { id: "all", label: "Applications", count: accreditationCounts.total || counts.total, color: "text-slate-900" },
            { id: "UNDER_REVIEW", label: "Under Review", count: accreditationCounts.under_review || counts.under_review, color: "text-[#214ECF]" },
            { id: "PENDING", label: "Awaiting Docs", count: accreditationCounts.awaiting_documents || counts.pending, color: "text-amber-700" },
            { id: "SUSPENDED", label: "Suspended / Hold", count: counts.suspended || 0, color: "text-rose-700" },
            { id: "UNDER_REVIEW", label: "Infra Pending", count: accreditationCounts.infrastructure_pending || 0, color: "text-indigo-700" },
            { id: "UNDER_REVIEW", label: "Assessments", count: accreditationCounts.assessments_pending || 0, color: "text-purple-700" },
            { id: "UNDER_REVIEW", label: "Decisions", count: accreditationCounts.decisions_pending || 0, color: "text-cyan-700" },
            { id: "APPROVED", label: "Activated", count: accreditationCounts.activated_centres || counts.approved, color: "text-emerald-700" },
            { id: "RESUBMISSION_REQUIRED", label: "Resubmissions", count: accreditationCounts.resubmissions || counts.resubmission, color: "text-orange-700" },
          ].map((tab, idx) => (
            <button
              key={`${tab.id}-${idx}`}
              onClick={() => {
                setStatusFilter(tab.id);
                setCurrentPage(1);
              }}
              className={`flex flex-col rounded-xl p-2.5 text-left transition border ${
                statusFilter === tab.id
                  ? "border-[#214ECF] bg-[#214ECF]/5 shadow-xs ring-1 ring-[#214ECF]"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{tab.label}</span>
              <span className={`mt-0.5 text-lg font-black ${tab.color}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* SEARCH, FILTER & SORT CONTROLS BAR                                    */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search company, applicant, email, centre ID, app #..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#214ECF] focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#214ECF]"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="SUSPENDED">Suspended / On Hold</option>
              <option value="RESUBMISSION_REQUIRED">Action Required</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived / Soft-Deleted</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#214ECF]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* APPLICATION CARDS LIST                                                */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-48 rounded-md bg-slate-200" />
                  <div className="h-3 w-64 rounded-md bg-slate-100" />
                </div>
                <div className="h-8 w-24 rounded-md bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Building2 className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">No BPO Applications Found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No applicants match your search query "${searchQuery}".`
              : `There are currently no BPO applications matching the selected status filter.`}
          </p>
          {(searchQuery || statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const isSuspended = app.status === "SUSPENDED" || (app as any).isSuspended || (!app.isActive && app.status === "APPROVED");
            const isApproved = app.status === "APPROVED" && !isSuspended;
            const isRejected = app.status === "REJECTED";
            const isResubmission = app.status === "RESUBMISSION_REQUIRED";
            const isPending = (app.status === "PENDING" || app.status === "UNDER_REVIEW") && !isSuspended;

            return (
              <div
                key={app.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left Info Column */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-[#214ECF] transition">
                        {getCleanCompanyName(app)}
                      </h3>
                      {app.centreId && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold font-mono text-slate-700 border border-slate-200">
                          {app.centreId}
                        </span>
                      )}
                      {app.applicationNumber && (
                        <span className="text-xs font-medium text-slate-400">({app.applicationNumber})</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{app.name}</span>
                      <span>·</span>
                      <a href={`mailto:${app.email}`} className="text-slate-500 hover:text-[#214ECF] transition">
                        {app.email}
                      </a>
                      <span>·</span>
                      <span className="text-slate-400">Submitted {new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Status Badges Group */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                      {/* Account Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isSuspended
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : isApproved
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isRejected
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : isResubmission
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {isSuspended && <AlertTriangle className="h-3 w-3 text-rose-600" />}
                        {isApproved && <CheckCircle2 className="h-3 w-3" />}
                        {isRejected && <XCircle className="h-3 w-3" />}
                        {isResubmission && <RotateCcw className="h-3 w-3" />}
                        {isPending && <Clock className="h-3 w-3" />}
                        {isSuspended ? "Suspended / Hold" : app.status === "RESUBMISSION_REQUIRED" ? "Action Required" : app.status}
                      </span>

                      {/* Centre Verification Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          app.centreVerificationStatus === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : app.centreVerificationStatus === "SUBMITTED" || app.centreVerificationStatus === "UNDER_REVIEW"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        <Building2 className="h-3 w-3" />
                        Office: {app.centreVerificationStatus}
                      </span>

                      {/* Agreement Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          app.agreementStatus === "signed" || app.agreementStatus === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        <FileText className="h-3 w-3" />
                        Agreement: {app.agreementStatus || "Pending"}
                      </span>

                      {/* Active / Disabled Status */}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          app.isActive && !isSuspended ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {app.isActive && !isSuspended ? "Active Portal Access" : "Portal Locked"}
                      </span>
                    </div>

                    {/* Rejection / Resubmission Note Preview if present */}
                    {app.rejectionReason && (
                      <div className="mt-2 text-xs rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-rose-800">
                        <span className="font-bold">Admin Note / Reason:</span> {app.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Right Actions Column */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => openDossier(app.id)}
                      className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:border-[#214ECF] hover:text-[#214ECF] hover:bg-[#214ECF]/5 shadow-xs transition duration-150 cursor-pointer"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      <span>View Details</span>
                    </button>

                    {!isApproved && !isSuspended && (
                      <button
                        onClick={() => setApproveModalApp(app)}
                        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition duration-150 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Approve</span>
                      </button>
                    )}

                    {!isSuspended && (
                      <button
                        onClick={() => {
                          setSuspendModalApp(app);
                          setSuspendReason("");
                          setSuspensionCategory("Operational & Compliance Review");
                        }}
                        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-xs transition duration-150 cursor-pointer"
                        title="Put partner account on temporary hold / suspension"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>Suspend / Hold</span>
                      </button>
                    )}

                    {isSuspended && (
                      <button
                        onClick={() => handleRestorePartner(app.id)}
                        disabled={actionLoading}
                        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition duration-150 cursor-pointer disabled:opacity-50"
                        title="Restore partner's active operational access"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Restore Access</span>
                      </button>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleRetryApprovalEmail(app.id)}
                        disabled={Boolean(retryingEmailId)}
                        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:border-[#214ECF] hover:text-[#214ECF] hover:bg-[#214ECF]/5 shadow-xs transition duration-150 disabled:opacity-50 cursor-pointer"
                        title="Resend official Thinkatic approval email to registered applicant email"
                      >
                        {retryingEmailId === app.id ? (
                          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 shrink-0" />
                        )}
                        <span>{retryingEmailId === app.id ? "Sending..." : "Resend Email"}</span>
                      </button>
                    )}

                    {!isRejected && (
                      <button
                        onClick={() => {
                          setRejectModalApp(app);
                          setRejectActionType("RESUBMISSION_REQUIRED");
                          setRejectReason(app.rejectionReason || "");
                        }}
                        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 text-xs font-bold text-rose-700 hover:bg-rose-50 shadow-xs transition duration-150 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Reject / Action</span>
                      </button>
                    )}

                    <div className="relative group/menu">
                      <button
                        type="button"
                        onClick={() => setArchiveModalApp(app)}
                        className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500/20 shadow-xs transition duration-150 cursor-pointer shrink-0"
                        title="Delete BPO Partner"
                        aria-label={`Delete BPO partner ${app.companyName || app.name}`}
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar (High-concurrency & large dataset performance) */}
      {!loading && applications.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-xs">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              Showing{" "}
              <strong className="text-slate-900">
                {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total || applications.length)}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900">
                {Math.min(pagination.page * pagination.pageSize, pagination.total || applications.length)}
              </strong>{" "}
              of <strong className="text-slate-900">{pagination.total || applications.length}</strong> BPO applications
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                  loadApplications(true, 1, newSize);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-[#214ECF]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  const p = currentPage - 1;
                  setCurrentPage(p);
                  loadApplications(true, p);
                }
              }}
              disabled={currentPage <= 1 || refreshing}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="px-3 text-xs font-bold text-slate-700">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>

            <button
              onClick={() => {
                if (currentPage < pagination.totalPages) {
                  const p = currentPage + 1;
                  setCurrentPage(p);
                  loadApplications(true, p);
                }
              }}
              disabled={currentPage >= pagination.totalPages || refreshing}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* FULL-SCREEN BPO DOSSIER DRAWER                                        */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {selectedBpoId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative flex h-full w-full max-w-6xl 2xl:max-w-7xl flex-col bg-slate-50 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
            {/* ───────────────────────────────────────────────────────────── */}
            {/* DRAWER HEADER (STICKY, ENTERPRISE GRADE)                      */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 shadow-xs">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                      {getCleanCompanyName(dossier)}
                    </h2>
                    {(dossier?.bpo_status === "SUSPENDED" || dossier?.isSuspended || (!dossier?.is_active && dossier?.bpo_status === "APPROVED")) ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 bg-rose-50 text-rose-700 border border-rose-200">
                        Suspended / Under Review
                      </span>
                    ) : dossier?.bpo_status ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          dossier.bpo_status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : dossier.bpo_status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : dossier.bpo_status === "RESUBMISSION_REQUIRED"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {dossier.bpo_status === "RESUBMISSION_REQUIRED" ? "Action Required" : dossier.bpo_status}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5 flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold text-slate-700">{dossier?.full_name || "Partner"}</span>
                    <span>·</span>
                    <a href={`mailto:${dossier?.email}`} className="text-slate-500 hover:text-[#214ECF] transition">
                      {dossier?.email}
                    </a>
                    {dossier?.formalApplication?.centre_id && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {dossier.formalApplication.centre_id}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(dossier && (dossier.bpo_status === "SUSPENDED" || dossier.isSuspended || (!dossier.is_active && dossier.bpo_status === "APPROVED"))) ? (
                  <button
                    onClick={() => handleRestorePartner(dossier.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Restore Access</span>
                    <span className="sm:hidden">Restore</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSuspendModalApp(dossier);
                        setSuspendReason("");
                        setSuspensionCategory("Operational & Compliance Review");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-xs transition cursor-pointer"
                      title="Put partner account on temporary hold / suspension"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="hidden sm:inline">Suspend / Hold</span>
                      <span className="sm:hidden">Hold</span>
                    </button>

                    {dossier && (dossier.bpo_status === "APPROVED" || dossier.status === "APPROVED" || dossier.status === "approved") && (
                      <button
                        onClick={() => handleRetryApprovalEmail(dossier.id)}
                        disabled={Boolean(retryingEmailId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-[#214ECF] hover:text-[#214ECF] hover:bg-[#214ECF]/5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                        title="Resend official Thinkatic approval email to registered applicant email"
                      >
                        {retryingEmailId === dossier.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">{retryingEmailId === dossier.id ? "Sending..." : "Resend Approval Email"}</span>
                        <span className="sm:hidden">{retryingEmailId === dossier.id ? "Sending..." : "Resend Email"}</span>
                      </button>
                    )}

                    {dossier && dossier.bpo_status !== "APPROVED" && (
                      <button
                        onClick={() => setApproveModalApp(dossier)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Approve Application</span>
                        <span className="sm:hidden">Approve</span>
                      </button>
                    )}
                  </>
                )}
                {dossier && dossier.bpo_status !== "REJECTED" && (
                  <button
                    onClick={() => {
                      setRejectModalApp(dossier);
                      setRejectActionType("RESUBMISSION_REQUIRED");
                      setRejectReason(dossier.rejectionReason || "");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 shadow-xs active:scale-98 transition cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Action Required</span>
                    <span className="sm:hidden">Action</span>
                  </button>
                )}
                <button
                  onClick={closeDossier}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer ml-1"
                  title="Close Dossier (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* DRAWER TAB NAVIGATION (12 DEDICATED PILLS, HORIZONTAL SCROLL) */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="sticky top-[73px] z-20 border-b border-slate-200 bg-white px-6 py-2.5 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollTabs("left")}
                  className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-[#214ECF] hover:bg-blue-50/80 hover:border-blue-200 shrink-0 transition shadow-2xs cursor-pointer"
                  title="Scroll Tabs Left"
                  type="button"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div
                  ref={tabsRef}
                  className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-0.5 scrollbar-none"
                >
                  {[
                    { id: "overview", label: "Overview & Accreditation", icon: LayoutDashboard },
                    { id: "applicant", label: "Applicant", icon: User },
                    { id: "company", label: "Company", icon: Building2 },
                    { id: "centre", label: "Centre & Capacity", icon: Factory },
                    {
                      id: "documents",
                      label: "Documents",
                      icon: FileText,
                      badge: dossier?.accreditation?.documents?.length || dossier?.documents?.length || 0,
                    },
                    {
                      id: "photos",
                      label: "Office Photos",
                      icon: ImageIcon,
                      badge: dossier?.centreVerification?.media?.filter((m: any) => m.mediaType === "photo")?.length || 0,
                    },
                    { id: "video", label: "Live Walkthrough", icon: VideoIcon },
                    { id: "infrastructure", label: "Infrastructure", icon: SlidersHorizontal },
                    { id: "management", label: "Management", icon: Users },
                    // TEMPORARILY COMMENTED OUT PER USER REQUEST: Trial / Assessment
                    // {
                    //   id: "assessment",
                    //   label: "Trial / Assessment",
                    //   icon: Sparkles,
                    //   badge: dossier?.accreditation?.assessments?.length || 0,
                    // },
                    // TEMPORARILY COMMENTED OUT PER USER REQUEST: Decision & Activation
                    // { id: "decision", label: "Decision & Activation", icon: ShieldCheck },
                    // TEMPORARILY COMMENTED OUT PER USER REQUEST: Bank Details
                    // { id: "bank", label: "Bank Details", icon: Landmark },
                    { id: "agreement", label: "Agreement", icon: FileSignature },
                    // TEMPORARILY COMMENTED OUT PER USER REQUEST: Progression Log
                    // { id: "history", label: "Progression Log", icon: ShieldCheck },
                    // TEMPORARILY COMMENTED OUT PER USER REQUEST: Audit Log
                    // { id: "audit", label: "Audit Log", icon: History },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeDossierTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveDossierTab(tab.id)}
                        type="button"
                        className={`group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "bg-[#214ECF] text-white shadow-xs ring-2 ring-[#214ECF]/20 font-black"
                            : "bg-slate-50 text-slate-700 hover:text-[#214ECF] hover:bg-blue-50/80 border border-slate-200/80"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition duration-200 ${
                            isActive ? "text-white" : "text-[#214ECF] group-hover:scale-110"
                          }`}
                        />
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && tab.badge > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                              isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => scrollTabs("right")}
                  className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-[#214ECF] hover:bg-blue-50/80 hover:border-blue-200 shrink-0 transition shadow-2xs cursor-pointer"
                  title="Scroll Tabs Right"
                  type="button"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* DRAWER BODY (CONTENT PANELS)                                  */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {dossierLoading ? (
                <div className="flex h-96 items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-[#214ECF]" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading BPO Dossier...</p>
                  </div>
                </div>
              ) : !dossier ? (
                <div className="text-center py-16 text-sm text-slate-500">Failed to load dossier details.</div>
              ) : (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 1: OVERVIEW & EXECUTIVE SUMMARY               */}
                  {/* ───────────────────────────────────────────────── */}
                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 1: OVERVIEW & ACCREDITATION WORKSPACE         */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "overview" && (
                    <AdminAccreditationWorkspace
                      applicationId={dossier.formalApplication?.id || dossier.accreditation?.applicationId || Number(dossier.id)}
                      accreditation={dossier.accreditation}
                      apiCall={apiCall}
                      onRefresh={() => openDossier(selectedBpoId!)}
                      showToast={showToast}
                      section="timeline"
                    />
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 2: APPLICANT PROFILE                          */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "applicant" && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                Applicant Profile & Credentials
                              </h3>
                              <p className="text-xs text-slate-500">
                                Primary authorized operator and administrator.
                              </p>
                            </div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                            dossier.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {dossier.is_active ? "Active User" : "Deactivated"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">Full Name</span>
                            <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.full_name || "—"}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">Work Email Address</span>
                            <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.email}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">Contact Phone</span>
                            <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.contactPhone || (dossier.applicationDetails?.phone && dossier.applicationDetails?.phone.toLowerCase() !== "none" ? dossier.applicationDetails.phone : "") || dossier.formalApplication?.company_data?.phone || dossier.centreVerification?.contactNumber || "—"}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">Role & Account Type</span>
                            <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{dossier.role} · {dossier.account_type}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">BPO Approval Status</span>
                            <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.bpo_status}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">Portal Access Authorization</span>
                            <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.is_active ? "Unlocked (Full Access)" : "Locked (Approval Required)"}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-medium">Supabase User ID (UUID)</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(dossier.id, "userId")}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#214ECF] hover:underline cursor-pointer"
                              >
                                {copiedField === "userId" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                {copiedField === "userId" ? "Copied" : "Copy UUID"}
                              </button>
                            </div>
                            <p className="font-bold font-mono text-slate-900 mt-1 text-xs">{dossier.id}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <span className="text-slate-400 font-medium">Registered Date</span>
                            <p className="font-bold text-slate-900 mt-1 text-xs">{new Date(dossier.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 3: COMPANY & REGISTRATION                     */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "company" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Company & Legal Entity Details
                          </h3>
                          <p className="text-xs text-slate-500">
                            Registered corporate profile and tax information.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const cd = dossier.formalApplication?.company_data || dossier.applicationDetails || {};
                        const ag = dossier.agreement || {};
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Operating Brand Name</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{cd.companyName || dossier.company_name || dossier.companyName || getCleanCompanyName(dossier)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Legal Entity Name</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{cd.legalEntity || cd.legalName || cd.legal_entity || ag.companyLegalName || cd.companyName || dossier.company_name || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Business Entity Type</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{cd.businessType || cd.entity_type || cd.legalEntityType || "Private Limited Company"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Registration Number / CIN</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{cd.registrationNumber || cd.cin || cd.registration_number || ag.companyRegistrationCin || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">PAN (Tax Identification)</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{cd.panNumber || cd.pan || cd.pan_number || ag.companyPan || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">GSTIN / VAT Number</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{cd.gstNumber || cd.gst || cd.gst_number || ag.companyGst || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Authorized Signatory</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{cd.authorizedSignatory || cd.ownerName || ag.authorizedSignatoryName || dossier.full_name || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Corporate Website</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">
                                {cd.website ? (
                                  <a href={cd.website.startsWith("http") ? cd.website : `https://${cd.website}`} target="_blank" rel="noreferrer" className="text-[#214ECF] hover:underline flex items-center gap-1">
                                    {cd.website} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : "—"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Year Established</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{cd.yearEstablished || cd.year_established || "2021"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-3">
                              <span className="text-slate-400 font-medium">Registered Corporate Address</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{cd.address || cd.registered_address || ag.registeredAddress || (cd.city ? `${cd.city}, ${cd.state || ""}` : "—")}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 4: CENTRE & INFRASTRUCTURE                    */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "centre" && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                            <Factory className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                              Physical Centre & Floor Details
                            </h3>
                            <p className="text-xs text-slate-500">
                              Delivery facility address and workstation architecture.
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const cv = dossier.centreVerification || {};
                          const ctd = dossier.formalApplication?.centre_data || {};
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Centre Name</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{cv.office_name || ctd.centreName || "Primary Delivery Facility"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Facility Type</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{cv.centre_type || ctd.facilityType || "Dedicated BPO Centre"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Ownership Structure</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{cv.ownership_type || ctd.ownership || "Commercial Lease"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                                <span className="text-slate-400 font-medium">Full Physical Street Address</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">
                                  {cv.address_line_1 || ctd.centreAddress || "—"} {cv.address_line_2 ? `, ${cv.address_line_2}` : ""}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">City, State & Country</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{cv.city || ctd.city || "—"}, {cv.state || ctd.state || "—"} ({cv.country || "India"})</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">PIN / Postal Code</span>
                                <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{cv.postal_code || ctd.postalCode || ctd.pincode || "—"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Total Area (Sq. Ft.)</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{cv.total_area_sqft || ctd.carpetAreaSqFt || "—"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Operating Since</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{cv.operating_since || "2022"}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Workforce Capacity & Process Capabilities */}
                      {(() => {
                        const ctd = dossier.formalApplication?.centre_data || {};
                        const pe = dossier.formalApplication?.process_experience || [];
                        const expList = [
                          ctd.usExperience ? "US Campaigns" : null,
                          ctd.ukExperience ? "UK Campaigns" : null,
                          ctd.domesticExperience ? "Domestic Operations" : null,
                        ].filter(Boolean);
                        return (
                          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                                <Cpu className="h-5 w-5" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                  Workforce Capacity & Process Capabilities
                                </h3>
                                <p className="text-xs text-slate-500">
                                  Installed workstations, agent headcount, operating shifts, and domain specializations.
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 text-xs">
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Total Installed Seats</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{ctd.totalSeats ? `${ctd.totalSeats} Workstations` : "—"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Immediate Available Seats</span>
                                <p className="font-bold text-emerald-700 mt-1 text-sm">{ctd.availableSeats ? `${ctd.availableSeats} Ready` : "—"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Active Agents / Headcount</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{ctd.activeAgents || ctd.totalSeats || "—"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Operating Shifts</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{ctd.workingHours || "24/7 Rotational"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                                <span className="text-slate-400 font-medium">Market Experience</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{expList.length > 0 ? expList.join(" · ") : "Standard Domestic / Global"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                                <span className="text-slate-400 font-medium">Supported Languages</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{ctd.languages || "English, Hindi"}</p>
                              </div>
                            </div>
                            {pe && pe.length > 0 && (
                              <div className="pt-2">
                                <span className="text-slate-400 font-medium text-xs block mb-2">Process Domains & Specializations</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {pe.map((item: string) => (
                                    <span key={item} className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-800">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Technical Infrastructure */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                            <Layers className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                              Technical & Network Infrastructure
                            </h3>
                            <p className="text-xs text-slate-500">
                              Telecom redundancy, power backup, and security standards.
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const infra = dossier.formalApplication?.infrastructure_data || {};
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Primary Internet (Leased Line)</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{infra.internetBandwidth || infra.primaryIsp || "Dedicated 1 Gbps Fiber"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Secondary / Backup ISP</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{infra.backupInternet || infra.secondaryIsp || "Failover 500 Mbps Line"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Power Backup</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{infra.powerBackup || "Dual Online UPS + 100% DG Set"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Contact Center Dialer</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{infra.dialer || infra.dialerPlatform || "Vicidial / Cloud Hosted"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">CRM Platform</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{infra.crm || infra.crmSoftware || "Standard Web CRM"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                <span className="text-slate-400 font-medium">Recording Retention Policy</span>
                                <p className="font-bold text-slate-900 mt-1 text-sm">{infra.retentionDays || "90 Days Encrypted"}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 5: OFFICE PHOTOS (PRIVATE STORAGE & LIGHTBOX) */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "photos" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                              Office Evidence Photos ({dossier?.centreVerification?.media?.filter((m: any) => m.mediaType === "photo")?.length || 0})
                            </h3>
                            <p className="text-xs text-slate-500">
                              Loaded securely via authorized private storage. Click any image to open full inspection lightbox.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dedicated Office Verification Status & Action Bar */}
                      {(() => {
                        const cv = dossier?.centreVerification;
                        if (!cv?.id) return null;
                        const isCvApproved = cv.status === "APPROVED";
                        const isCvRejected = cv.status === "RESUBMISSION_REQUIRED" || cv.status === "REJECTED";
                        const isCvUnderReview = cv.status === "UNDER_REVIEW" || cv.status === "SUBMITTED";

                        return (
                          <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50/70 via-slate-50 to-blue-50/30 p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#214ECF] border border-blue-100 shadow-xs">
                                <ShieldCheck className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                                    Office Verification Status:
                                  </span>
                                  {isCvApproved && (
                                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Approved
                                    </span>
                                  )}
                                  {isCvUnderReview && (
                                    <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      Under Operations Review
                                    </span>
                                  )}
                                  {isCvRejected && (
                                    <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Correction Requested
                                    </span>
                                  )}
                                  {!isCvApproved && !isCvUnderReview && !isCvRejected && (
                                    <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[10px] font-black uppercase">
                                      {cv.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {isCvApproved
                                    ? `Approved by ${cv.reviewedByAdminName || "Operations Admin"}${cv.reviewedAt ? ` on ${new Date(cv.reviewedAt).toLocaleDateString()}` : ""}`
                                    : isCvRejected
                                    ? `Correction Reason: ${cv.rejectionReason || "Correction requested"}`
                                    : "Complete office details, photos, and video submitted for manual verification decision."}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {!isCvApproved && (
                                <button
                                  type="button"
                                  disabled={officeVerifActionLoading}
                                  onClick={() => handleApproveOfficeVerification(cv.id)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-2 text-xs font-black text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                  {officeVerifActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  APPROVE OFFICE VERIFICATION
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={officeVerifActionLoading}
                                onClick={() => {
                                  setOfficeVerifRejectReason("");
                                  setOfficeVerifRejectModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 px-4 py-2 text-xs font-black shadow-xs transition disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                REJECT / REQUEST CORRECTION
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const photos = (dossier?.centreVerification?.media || []).filter((m: any) => m.mediaType === "photo");
                        if (photos.length === 0) {
                          return (
                            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
                              No office evidence photos uploaded yet for this centre.
                            </div>
                          );
                        }

                        const displayedPhotos = photos.slice(0, visiblePhotosCount);

                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                              <span>Showing {displayedPhotos.length} of {photos.length} verified office photographs</span>
                              {photos.length > 24 && (
                                <span className="font-semibold text-slate-600">
                                  {visiblePhotosCount < photos.length ? `Paginated preview (${photos.length - visiblePhotosCount} remaining)` : "All photos displayed"}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {displayedPhotos.map((photo: any) => {
                                const photoUrl = photo.signedUrl || `${photo.streamUrl}?admin_token=${adminToken}`;
                                return (
                                  <div
                                    key={photo.id}
                                    onClick={() => {
                                      setLightboxImage({ url: photoUrl, title: photo.originalFileName, category: photo.category });
                                      setLightboxZoom(1);
                                    }}
                                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs hover:border-[#214ECF] hover:shadow-md transition"
                                  >
                                    <div className="aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                                      <img
                                        src={photoUrl}
                                        alt={photo.originalFileName}
                                        className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                                        loading="lazy"
                                        decoding="async"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = "none";
                                        }}
                                      />
                                    </div>
                                    <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between">
                                      <div className="min-w-0 pr-2">
                                        <span className="inline-block rounded-md bg-[#214ECF]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#214ECF]">
                                          {photo.category?.replace(/_/g, " ")}
                                        </span>
                                        <p className="mt-1 text-[11px] font-semibold text-slate-700 truncate" title={photo.originalFileName}>
                                          {photo.originalFileName}
                                        </p>
                                        <span className="text-[10px] text-slate-400">{formatBytes(photo.fileSize)}</span>
                                      </div>
                                      <a
                                        href={photoUrl}
                                        download={photo.originalFileName || "office_evidence.jpg"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-[#214ECF] hover:text-white transition shrink-0 border border-slate-200"
                                        title="Download Original Photo"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {photos.length > visiblePhotosCount && (
                              <div className="pt-4 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => setVisiblePhotosCount((prev) => prev + 24)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
                                >
                                  <span>Load More Photos ({photos.length - visiblePhotosCount} remaining)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 6: LIVE WALKTHROUGH VIDEO PLAYER              */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "video" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                          <VideoIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Office Live Walkthrough Video
                          </h3>
                          <p className="text-xs text-slate-500">
                            Continuous uninterrupted walkthrough video evidence for physical verification.
                          </p>
                        </div>
                      </div>

                      {/* Dedicated Office Verification Status & Action Bar */}
                      {(() => {
                        const cv = dossier?.centreVerification;
                        if (!cv?.id) return null;
                        const isCvApproved = cv.status === "APPROVED";
                        const isCvRejected = cv.status === "RESUBMISSION_REQUIRED" || cv.status === "REJECTED";
                        const isCvUnderReview = cv.status === "UNDER_REVIEW" || cv.status === "SUBMITTED";

                        return (
                          <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50/70 via-slate-50 to-blue-50/30 p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#214ECF] border border-blue-100 shadow-xs">
                                <ShieldCheck className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                                    Office Verification Status:
                                  </span>
                                  {isCvApproved && (
                                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Approved
                                    </span>
                                  )}
                                  {isCvUnderReview && (
                                    <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      Under Operations Review
                                    </span>
                                  )}
                                  {isCvRejected && (
                                    <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Correction Requested
                                    </span>
                                  )}
                                  {!isCvApproved && !isCvUnderReview && !isCvRejected && (
                                    <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[10px] font-black uppercase">
                                      {cv.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {isCvApproved
                                    ? `Approved by ${cv.reviewedByAdminName || "Operations Admin"}${cv.reviewedAt ? ` on ${new Date(cv.reviewedAt).toLocaleDateString()}` : ""}`
                                    : isCvRejected
                                    ? `Correction Reason: ${cv.rejectionReason || "Correction requested"}`
                                    : "Live walkthrough video inspection and verification."}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {!isCvApproved && (
                                <button
                                  type="button"
                                  disabled={officeVerifActionLoading}
                                  onClick={() => handleApproveOfficeVerification(cv.id)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-2 text-xs font-black text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                  {officeVerifActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  APPROVE OFFICE VERIFICATION
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={officeVerifActionLoading}
                                onClick={() => {
                                  setOfficeVerifRejectReason("");
                                  setOfficeVerifRejectModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 px-4 py-2 text-xs font-black shadow-xs transition disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                REJECT / REQUEST CORRECTION
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const video = (dossier?.centreVerification?.media || []).find((m: any) => m.mediaType === "video");
                        if (!video) {
                          return (
                            <div className="rounded-xl border border-dashed border-slate-200 p-16 text-center text-xs text-slate-400">
                              <VideoIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                              No live office walkthrough video uploaded yet.
                            </div>
                          );
                        }

                        const videoUrl = video.signedUrl || `${video.streamUrl}?admin_token=${adminToken}`;

                        return (
                          <div className="space-y-4">
                            {/* Video Container */}
                            <div className="relative overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center shadow-lg">
                              <video
                                ref={videoRef}
                                src={videoUrl}
                                onTimeUpdate={handleVideoTimeUpdate}
                                onLoadedMetadata={() => {
                                  if (videoRef.current) setVideoDuration(videoRef.current.duration);
                                }}
                                onEnded={() => setIsPlaying(false)}
                                className="h-full w-full object-contain"
                                playsInline
                                preload="none"
                              />

                              {/* Big Center Play Overlay Button */}
                              {!isPlaying && (
                                <button
                                  onClick={toggleVideoPlay}
                                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition cursor-pointer"
                                >
                                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#214ECF] text-white shadow-xl hover:scale-105 transition">
                                    <Play className="h-8 w-8 translate-x-0.5" />
                                  </div>
                                </button>
                              )}

                              {/* Custom Video Controls Bar */}
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={videoProgress || 0}
                                  onChange={handleVideoSeek}
                                  className="h-1.5 w-full appearance-none rounded-full bg-white/30 accent-[#214ECF] cursor-pointer"
                                />

                                <div className="flex items-center justify-between text-white text-xs">
                                  <div className="flex items-center gap-3">
                                    <button onClick={toggleVideoPlay} className="hover:text-[#214ECF] transition cursor-pointer">
                                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </button>
                                    <button onClick={toggleVideoMute} className="hover:text-[#214ECF] transition cursor-pointer">
                                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                    </button>
                                    <span className="font-mono text-[11px] text-white/80">
                                      {Math.floor((videoRef.current?.currentTime || 0) / 60)}:
                                      {String(Math.floor((videoRef.current?.currentTime || 0) % 60)).padStart(2, "0")} /{" "}
                                      {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, "0")}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <button onClick={handleVideoFullscreen} className="hover:text-[#214ECF] transition cursor-pointer">
                                      <Maximize className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Video Metadata info */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                  <span className="text-slate-400 font-medium">File Name:</span>
                                  <p className="font-bold text-slate-800 truncate">{video.originalFileName}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-medium">Duration:</span>
                                  <p className="font-bold text-slate-800">{video.durationSeconds ? `${video.durationSeconds}s` : "Walkthrough"}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-medium">File Size:</span>
                                  <p className="font-bold text-slate-800">{formatBytes(video.fileSize)}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-medium">Uploaded:</span>
                                  <p className="font-bold text-slate-800">{new Date(video.uploadedAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 7: DOCUMENTS & COMPLIANCE VERIFICATION        */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "documents" && (
                    <AdminAccreditationWorkspace
                      applicationId={dossier.formalApplication?.id || dossier.accreditation?.applicationId || Number(dossier.id)}
                      accreditation={dossier.accreditation}
                      apiCall={apiCall}
                      onRefresh={() => openDossier(selectedBpoId!)}
                      showToast={showToast}
                      section="documents"
                    />
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB: INFRASTRUCTURE VERIFICATION                  */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "infrastructure" && (
                    <AdminAccreditationWorkspace
                      applicationId={dossier.formalApplication?.id || dossier.accreditation?.applicationId || Number(dossier.id)}
                      accreditation={dossier.accreditation}
                      apiCall={apiCall}
                      onRefresh={() => openDossier(selectedBpoId!)}
                      showToast={showToast}
                      section="infrastructure"
                    />
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB: MANAGEMENT VERIFICATION                      */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "management" && (
                    <AdminAccreditationWorkspace
                      applicationId={dossier.formalApplication?.id || dossier.accreditation?.applicationId || Number(dossier.id)}
                      accreditation={dossier.accreditation}
                      apiCall={apiCall}
                      onRefresh={() => openDossier(selectedBpoId!)}
                      showToast={showToast}
                      section="management"
                    />
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB: TRIAL & ASSESSMENT (TEMPORARILY COMMENTED OUT PER USER REQUEST) */}
                  {/* ───────────────────────────────────────────────── */}
                  {/*
                  {activeDossierTab === "assessment" && (
                    <AdminAccreditationWorkspace
                      applicationId={dossier.formalApplication?.id || dossier.accreditation?.applicationId || Number(dossier.id)}
                      accreditation={dossier.accreditation}
                      apiCall={apiCall}
                      onRefresh={() => openDossier(selectedBpoId!)}
                      showToast={showToast}
                      section="assessment"
                    />
                  )}
                  */}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB: DECISION & CENTRE ACTIVATION (TEMPORARILY COMMENTED OUT PER USER REQUEST) */}
                  {/* ───────────────────────────────────────────────── */}
                  {/*
                  {activeDossierTab === "decision" && (
                    <AdminAccreditationWorkspace
                      applicationId={dossier.formalApplication?.id || dossier.accreditation?.applicationId || Number(dossier.id)}
                      accreditation={dossier.accreditation}
                      apiCall={apiCall}
                      onRefresh={() => openDossier(selectedBpoId!)}
                      showToast={showToast}
                      section="decision"
                    />
                  )}
                  */}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 8: BANK DETAILS (TEMPORARILY COMMENTED OUT PER USER REQUEST) */}
                  {/* ───────────────────────────────────────────────── */}
                  {/*
                  {activeDossierTab === "bank" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                            <Landmark className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                              Banking & Payout Credentials
                            </h3>
                            <p className="text-xs text-slate-500">
                              Direct settlement account for partner billing, escrow, and disbursements.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            RBAC Encrypted & Masked
                          </span>
                        </div>
                      </div>

                      {dossier.bankDetails ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Bank Name</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.bankDetails.bank_name || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Account Beneficiary / Legal Entity</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">{dossier.bankDetails.account_holder_name || dossier.full_name || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Account Type</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">Corporate Current / Business Checking</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-medium">Account Number</span>
                                <button
                                  type="button"
                                  onClick={() => setIsBankRevealed((prev) => !prev)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#214ECF] hover:underline cursor-pointer"
                                >
                                  {isBankRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  {isBankRevealed ? "Mask Account" : "Reveal (Authorized)"}
                                </button>
                              </div>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm tracking-wider">
                                {isBankRevealed
                                  ? (dossier.bankDetails.account_number_masked?.replace(new RegExp("\\*", "g"), "9") || "987456123012")
                                  : (dossier.bankDetails.account_number_masked || "•••• •••• •••• 1204")}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">Currency & Country</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">
                                {dossier.bankDetails.currency || "USD"} ({dossier.bankDetails.country || "US"})
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">IFSC / Routing ABA Code</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">
                                {dossier.bankDetails.ifsc_code || dossier.bankDetails.routing_aba || "—"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">SWIFT / BIC Code</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{dossier.bankDetails.swift || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <span className="text-slate-400 font-medium">IBAN (International)</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">{dossier.bankDetails.iban_masked || "—"}</p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-slate-600 flex items-start gap-3">
                            <ShieldCheck className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Security & Compliance Notice:</span> Bank payout records are stored with field-level encryption. Payout accounts must match the verified corporate business entity name before automated ACH/NEFT settlement can be initiated.
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Premium Empty State
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/60 to-white p-10 text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-xs mb-4">
                            <Landmark className="h-8 w-8" />
                          </div>
                          <h4 className="text-base font-black text-slate-900">Bank Account Not Configured</h4>
                          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                            This partner has not submitted a dedicated payout bank account yet. Payout accounts are required prior to project assignment and automated disbursement.
                          </p>

                          <div className="mt-6 max-w-lg mx-auto rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-left text-xs text-slate-600 space-y-2">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-[#214ECF]" />
                              Payout Account Requirements Checklist:
                            </div>
                            <ul className="space-y-1.5 pl-5 list-disc text-slate-600">
                              <li>Beneficiary name must strictly match the registered corporate company entity.</li>
                              <li>A voided cheque or recent official statement must be attached for verification.</li>
                              <li>Supports multi-currency SWIFT, IBAN, and domestic clearing systems (ACH, NEFT, RTGS).</li>
                            </ul>
                          </div>

                          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                            <Clock className="h-3.5 w-3.5" />
                            Pending Onboarding Step: Payout Setup
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  */}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 9: CAPACITY & WORKFORCE                       */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "capacity" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Operational Capacity & Shift Allocation
                          </h3>
                          <p className="text-xs text-slate-500">
                            Workstation scale, operational shifts, and domain competencies.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const ctd = dossier.formalApplication?.centre_data || {};
                        const exp = dossier.formalApplication?.process_experience || [];
                        return (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Workstations</span>
                                <p className="mt-1 text-2xl font-black text-slate-900">{ctd.totalSeats || ctd.seat_capacity || "50"}</p>
                              </div>
                              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available Seats</span>
                                <p className="mt-1 text-2xl font-black text-emerald-700">{ctd.availableSeats || "35"}</p>
                              </div>
                              <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Active Agents</span>
                                <p className="mt-1 text-2xl font-black text-blue-700">{ctd.activeAgents || "15"}</p>
                              </div>
                              <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Shifts</span>
                                <p className="mt-1 text-2xl font-black text-purple-700">{ctd.workingHours || ctd.shift_count || "24/7"}</p>
                              </div>
                            </div>

                            {/* Process Experience tags */}
                            {exp.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Domain & Process Competencies:</span>
                                <div className="flex flex-wrap gap-2">
                                  {exp.map((tag: string) => (
                                    <span key={tag} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-[#214ECF] border border-blue-100">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 10: LEGAL AGREEMENT                           */}
                  {/* ───────────────────────────────────────────────── */}
                  {activeDossierTab === "agreement" && (() => {
                    const agr = dossier.agreement;
                    const isIssued = Boolean(agr && agr.id);
                    const hasSignedDoc = Boolean(agr && (agr.signedDocumentFileName || agr.signed_at || agr.signedUrl));
                    const isApproved = agr?.status === "approved" || agr?.status === "APPROVED";
                    const isRejected = agr?.status === "rejected" || agr?.status === "REJECTED";
                    const isUnderReview = hasSignedDoc && !isApproved && !isRejected;

                    const submissionsList: any[] = Array.isArray(agr?.submissions) && agr.submissions.length > 0
                      ? agr.submissions
                      : hasSignedDoc
                      ? [{
                          version: agr.version || "1.0",
                          status: agr.status || "submitted",
                          fileName: agr.signedDocumentFileName || "signed-agreement.pdf",
                          fileSize: agr.signedFileSize || 0,
                          submittedAt: agr.signed_at || agr.signedSubmittedAt || agr.updated_at,
                          uploadedBy: agr.uploadedByName || dossier.name || "Signatory",
                          reviewedByAdminName: agr.approvedByAdminName || agr.reviewedByAdminName || (isApproved ? "Operations Admin" : isRejected ? "Operations Admin" : null),
                          reviewedAt: agr.approved_at || agr.reviewed_at || null,
                          rejectionReason: agr.rejectionReason || agr.rejection_reason || null,
                        }]
                      : [];

                    return (
                      <div className="space-y-6">
                        {/* Header & Main Badge */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                                <FileSignature className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-slate-900">
                                  Thinkatic 23-Page Master BPO Legal Agreement
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Sovereign master delivery partner legal contract, external physical signing governance, and immutable audit trail.
                                </p>
                              </div>
                            </div>
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-[#214ECF] border border-blue-200 px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
                                <ShieldCheck className="h-3.5 w-3.5 text-[#214ECF]" />
                                {agr?.status ? agr.status.replace(/_/g, " ").toUpperCase() : "PENDING ISSUANCE"}
                              </span>
                            </div>
                          </div>

                          {/* Top 5 Summary Cards (Item 15) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-5 text-xs">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                              <span className="text-slate-500 font-medium block">Agreement Status</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm uppercase tracking-wide">
                                {agr?.status ? agr.status.replace(/_/g, " ") : "Pending Issuance"}
                              </p>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">
                                {isApproved ? "Fully Verified & Active" : isRejected ? "Correction Requested" : isUnderReview ? "Ready for Admin Review" : isIssued ? "Awaiting Partner Signature" : "Requires Issuance"}
                              </span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                              <span className="text-slate-500 font-medium block">Agreement ID</span>
                              <p className="font-bold font-mono text-slate-900 mt-1 text-sm">
                                {agr?.agreementCode || agr?.agreement_code || "THK-AGR-PENDING"}
                              </p>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">Unique Sovereign Code</span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                              <span className="text-slate-500 font-medium block">Agreement Version</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">
                                {agr?.version ? `v${agr.version}` : "v1.0"} (23 Pages)
                              </p>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">Master Agreement PDF</span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                              <span className="text-slate-500 font-medium block">Signed Submission</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm truncate">
                                {agr?.signed_at || agr?.signedSubmittedAt
                                  ? new Date(agr.signed_at || agr.signedSubmittedAt).toLocaleDateString()
                                  : "Not Uploaded"}
                              </p>
                              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                                {agr?.signedDocumentFileName || "Awaiting Partner PDF"}
                              </span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                              <span className="text-slate-500 font-medium block">Review Status</span>
                              <p className="font-bold text-slate-900 mt-1 text-sm">
                                {isApproved
                                  ? "APPROVED"
                                  : isRejected
                                  ? "REJECTED"
                                  : isUnderReview
                                  ? "UNDER REVIEW"
                                  : isIssued
                                  ? "AWAITING SIGNATURE"
                                  : "PENDING ISSUANCE"}
                              </p>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">Human Operations Review</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Bar */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            {!isIssued ? (
                              <button
                                type="button"
                                onClick={() => setIssueAgreementModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition cursor-pointer"
                              >
                                <FileSignature className="h-4 w-4" />
                                <span>Issue Master Agreement</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setViewOriginalModalOpen(true)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 text-[#214ECF]" />
                                  <span>View Original</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => downloadOriginalAgreement(agr.id)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                                >
                                  <Download className="h-4 w-4 text-[#214ECF]" />
                                  <span>Download Original</span>
                                </button>
                              </>
                            )}

                            {hasSignedDoc && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setViewSignedModalOpen(true)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-bold text-[#214ECF] hover:bg-blue-100/70 transition shadow-2xs cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 text-[#214ECF]" />
                                  <span>View Signed</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => downloadSignedAgreement(agr.id, agr.signedDocumentFileName)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                                >
                                  <Download className="h-4 w-4 text-[#214ECF]" />
                                  <span>Download Signed</span>
                                </button>
                              </>
                            )}
                          </div>

                          {/* Approval / Rejection Actions */}
                          {hasSignedDoc && !isApproved && (
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAgreementRejectReason("");
                                  setRejectAgreementModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer"
                              >
                                <AlertCircle className="h-4 w-4 text-slate-600" />
                                <span>Reject</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setApproveAgreementModalOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Approve Agreement</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Original Master Agreement Specifications Card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF]">
                                <FileText className="h-4 w-4" />
                              </div>
                              <h4 className="text-sm font-bold text-slate-900">Original Master Legal Document</h4>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">23 Pages • PDF Master</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2 rounded-xl bg-slate-50/70 border border-slate-100 p-3.5">
                              <span className="font-bold text-slate-700 block">Master Source File</span>
                              <p className="font-mono text-slate-600 text-[11px]">Agreement/BPO Agreement.pdf</p>
                              <span className="text-[11px] text-slate-500 block">
                                Authoritative master contract served securely from the application backend.
                              </span>
                            </div>

                            <div className="space-y-2 rounded-xl bg-slate-50/70 border border-slate-100 p-3.5">
                              <span className="font-bold text-slate-700 block">Signatory Legal Entity</span>
                              <p className="text-slate-800 font-semibold">Healweal LLC (Wyoming, USA)</p>
                              <span className="text-[11px] text-slate-500 block">
                                Sovereign Director: Harshad Chavandke • Sovereign Operations Governance
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => isIssued ? setViewOriginalModalOpen(true) : window.open("/api/admin/agreements/template", "_blank")}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                            >
                              <Eye className="h-4 w-4 text-[#214ECF]" />
                              <span>View Master Template (PDF)</span>
                            </button>

                            {isIssued && (
                              <button
                                type="button"
                                onClick={() => downloadOriginalAgreement(agr.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                              >
                                <Download className="h-4 w-4 text-[#214ECF]" />
                                <span>Download Master Agreement PDF</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Signed Agreement Submission Card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF]">
                                <PenLine className="h-4 w-4" />
                              </div>
                              <h4 className="text-sm font-bold text-slate-900">Partner Signed Agreement Submission</h4>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {hasSignedDoc ? "PDF Uploaded" : "Awaiting Partner Execution"}
                            </span>
                          </div>

                          {hasSignedDoc ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                                  <span className="text-slate-400 font-medium block">File Name</span>
                                  <p className="font-bold text-slate-800 mt-1 truncate" title={agr.signedDocumentFileName || "signed-agreement.pdf"}>
                                    {agr.signedDocumentFileName || "signed-agreement.pdf"}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                                  <span className="text-slate-400 font-medium block">File Size</span>
                                  <p className="font-bold text-slate-800 mt-1">
                                    {agr.signedFileSize
                                      ? agr.signedFileSize > 1048576
                                        ? `${(agr.signedFileSize / 1048576).toFixed(2)} MB`
                                        : `${(agr.signedFileSize / 1024).toFixed(0)} KB`
                                      : "PDF Document"}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                                  <span className="text-slate-400 font-medium block">Submitted Date</span>
                                  <p className="font-bold text-slate-800 mt-1">
                                    {agr.signed_at || agr.signedSubmittedAt
                                      ? new Date(agr.signed_at || agr.signedSubmittedAt).toLocaleString()
                                      : "Recently submitted"}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                                  <span className="text-slate-400 font-medium block">Uploaded By</span>
                                  <p className="font-bold text-slate-800 mt-1 truncate">
                                    {agr.uploadedByName || dossier.name || "Signatory"}
                                  </p>
                                </div>
                              </div>

                              {/* Review remarks & banner */}
                              {isApproved && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
                                  <CheckCircle2 className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-bold text-sm">Agreement Formally Approved</p>
                                    <p className="text-blue-800 mt-0.5">
                                      Approved by <strong>{agr.approvedByAdminName || "Operations Administrator"}</strong> on{" "}
                                      {agr.approved_at ? new Date(agr.approved_at).toLocaleString() : "Confirmed"}. This signed document is now an immutable permanent record.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {isRejected && (
                                <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-xs text-slate-800 flex items-start gap-3">
                                  <AlertCircle className="h-5 w-5 text-slate-700 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-bold text-sm">Correction Requested / Resubmission Required</p>
                                    <p className="text-slate-700 mt-1">
                                      <strong>Reason for correction:</strong> {agr.rejectionReason || agr.rejection_reason || "Signature section incomplete or document unreadable."}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                      Partner has been notified to download, correct, and re-upload the completed PDF.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {isUnderReview && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900 flex items-start gap-3">
                                  <Clock className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-bold text-sm">Signed Document Awaiting Human Verification</p>
                                    <p className="text-blue-800 mt-0.5">
                                      Please click <strong>View Signed</strong> to inspect the uploaded PDF pages, verify legal entity and physical signatures, then Approve or Reject.
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setViewSignedModalOpen(true)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition cursor-pointer"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>View Signed Agreement (PDF Viewer)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => downloadSignedAgreement(agr.id, agr.signedDocumentFileName)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                                >
                                  <Download className="h-4 w-4 text-[#214ECF]" />
                                  <span>Download Signed PDF</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 text-center space-y-2">
                              <AlertCircle className="h-6 w-6 text-[#214ECF] mx-auto" />
                              <p className="text-xs font-bold text-slate-800">
                                {isIssued
                                  ? "Partner Has Not Yet Uploaded the Signed Agreement"
                                  : "Agreement Pending Issuance"}
                              </p>
                              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                                {isIssued
                                  ? "The agreement was issued and is available in the BPO Partner Portal for download and external physical signing. Once uploaded, it will appear here for review."
                                  : "Click 'Issue Master Agreement' above to issue the official 23-page agreement to this delivery partner."}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Agreement Version & Submission History (Item 11) */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF]">
                                <History className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">Agreement Version & Submission History</h4>
                                <p className="text-[11px] text-slate-500">Immutable permanent record of all agreement submissions and review decisions.</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-slate-600">
                              {submissionsList.length} {submissionsList.length === 1 ? "Record" : "Records"}
                            </span>
                          </div>

                          {submissionsList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                              No agreement submissions recorded yet.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                                    <th className="py-2.5 px-3">Version</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Uploaded Date</th>
                                    <th className="py-2.5 px-3">Submitted By</th>
                                    <th className="py-2.5 px-3">Reviewed By</th>
                                    <th className="py-2.5 px-3">Reviewed Date</th>
                                    <th className="py-2.5 px-3">Rejection Reason</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {submissionsList.map((sub: any, idx: number) => {
                                    const subStatus = String(sub.status || "submitted").toLowerCase();
                                    return (
                                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                                        <td className="py-3 px-3 font-bold font-mono text-slate-900">
                                          v{sub.version || `1.${idx}`}
                                        </td>
                                        <td className="py-3 px-3">
                                          <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-[#214ECF] uppercase">
                                            {subStatus}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-600">
                                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="py-3 px-3 text-slate-700 font-medium">
                                          {sub.uploadedBy || "Signatory"}
                                        </td>
                                        <td className="py-3 px-3 text-slate-600">
                                          {sub.reviewedByAdminName || "—"}
                                        </td>
                                        <td className="py-3 px-3 text-slate-600">
                                          {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={sub.rejectionReason || "—"}>
                                          {sub.rejectionReason || "—"}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setViewSignedModalOpen(true)}
                                              className="p-1 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-[#214ECF] transition cursor-pointer"
                                              title="View Submission"
                                            >
                                              <Eye className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => downloadSignedAgreement(agr.id, sub.fileName)}
                                              className="p-1 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-[#214ECF] transition cursor-pointer"
                                              title="Download File"
                                            >
                                              <Download className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 11: VERIFICATION HISTORY / PROGRESSION LOG (TEMPORARILY COMMENTED OUT PER USER REQUEST) */}
                  {/* ───────────────────────────────────────────────── */}
                  {/*
                  {activeDossierTab === "history" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Centre Verification Progression Timeline
                          </h3>
                          <p className="text-xs text-slate-500">
                            Sequential log of inspections, status updates, and reviewer remarks.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const history = dossier.centreVerification?.history || [];
                        if (history.length === 0) {
                          return (
                            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
                              No history records logged for this verification yet.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {history.map((h: any) => (
                              <div key={h.id} className="flex gap-3 text-xs border-l-2 border-[#214ECF] pl-4 py-1.5">
                                <div>
                                  <div className="font-bold text-slate-900">{h.action?.replace(/_/g, " ").toUpperCase()}</div>
                                  <div className="text-slate-600 mt-0.5">{h.notes || `Status transitioned to ${h.toStatus}`}</div>
                                  <div className="text-[10px] text-slate-400 mt-1">{new Date(h.createdAt).toLocaleString()} · Actor: {h.actorRole}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  */}

                  {/* ───────────────────────────────────────────────── */}
                  {/* TAB 12: AUDIT LOG (TEMPORARILY COMMENTED OUT PER USER REQUEST) */}
                  {/* ───────────────────────────────────────────────── */}
                  {/*
                  {activeDossierTab === "audit" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                          <History className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Authoritative Audit Logs
                          </h3>
                          <p className="text-xs text-slate-500">
                            Immutable, timestamped administrative events recorded in Supabase.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const logs = dossier.auditTrail || [];
                        if (logs.length === 0) {
                          return (
                            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
                              No admin audit logs recorded for this applicant.
                            </div>
                          );
                        }

                        return (
                          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
                            {logs.map((log: any) => (
                              <div key={log.id} className="p-3.5 bg-white flex items-center justify-between">
                                <div>
                                  <span className="font-bold font-mono text-[#214ECF]">{log.action}</span>
                                  <p className="text-slate-500 text-[11px] mt-0.5">
                                    {log.metadata?.rejection_reason ? `Reason: ${log.metadata.rejection_reason}` : JSON.stringify(log.metadata || {})}
                                  </p>
                                </div>
                                <span className="text-[11px] text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  */}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* PHOTO LIGHTBOX MODAL (ZOOM & INSPECT)                                 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {lightboxImage && (
        <div className="fixed inset-0 z-60 flex flex-col bg-black/95 text-white animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/10">
            <div>
              <span className="inline-block rounded-md bg-[#214ECF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {lightboxImage.category?.replace(/_/g, " ")}
              </span>
              <h4 className="text-sm font-bold text-white mt-1">{lightboxImage.title}</h4>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLightboxZoom((z) => Math.max(0.5, z - 0.25))}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-white/70">{Math.round(lightboxZoom * 100)}%</span>
              <button
                onClick={() => setLightboxZoom((z) => Math.min(3, z + 0.25))}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <a
                href={lightboxImage.url}
                download={lightboxImage.title || "office_evidence.jpg"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20 transition flex items-center gap-1.5 text-white"
                title="Download Photo"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </a>
              <button
                onClick={() => setLightboxImage(null)}
                className="ml-2 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition cursor-pointer"
                title="Close Lightbox"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              style={{ transform: `scale(${lightboxZoom})`, transition: "transform 0.2s ease" }}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* SUSPEND / HOLD CONFIRMATION MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {suspendModalApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Suspend Partner Account?</h3>
                <p className="text-xs text-slate-500">Temporarily place partner on hold / under review with immediate lock.</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs my-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">BPO / Company Name:</span>
                <span className="font-bold text-slate-900">{getCleanCompanyName(suspendModalApp)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Applicant:</span>
                <span className="font-bold text-slate-900">{suspendModalApp.name || suspendModalApp.full_name} ({suspendModalApp.email})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Centre ID:</span>
                <span className="font-bold font-mono text-slate-900">{suspendModalApp.centreId || suspendModalApp.formalApplication?.centre_id || "THK-CTR-001"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  {suspendModalApp.status || suspendModalApp.bpo_status || "PENDING"}
                </span>
              </div>
            </div>

            <div className="space-y-4 my-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Suspension Category:
                </label>
                <select
                  value={suspensionCategory}
                  onChange={(e) => setSuspensionCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 font-medium outline-none focus:border-amber-500"
                >
                  <option value="Operational & Compliance Review">Operational & Compliance Review</option>
                  <option value="Quality & SLA Performance Audit">Quality & SLA Performance Audit</option>
                  <option value="Centre & Infrastructure Re-Inspection">Centre & Infrastructure Re-Inspection</option>
                  <option value="Documentation & KYC Discrepancy">Documentation & KYC Discrepancy</option>
                  <option value="Administrative Operational Hold">Administrative Operational Hold</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reason for Suspension / Hold <span className="text-rose-500">* (Mandatory)</span>:
                </label>
                <textarea
                  rows={4}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Specify clear administrative reason (e.g. Quality audit discrepancy, compliance review pending, infrastructure re-inspection required)..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This reason will be securely recorded in audit logs and displayed on the partner's "Account Under Review" hold screen.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-3 text-xs text-amber-800 mb-6">
              <p className="font-semibold">⚠️ Operational Impact:</p>
              <ul className="mt-1 space-y-1 list-disc list-inside text-[11px] text-amber-700">
                <li>Partner login will display the dedicated <strong>ACCOUNT TEMPORARILY SUSPENDED / UNDER REVIEW</strong> screen.</li>
                <li>Normal operational modules (Marketplace, Capacity, Agents, etc.) will be locked.</li>
                <li>All onboarding data and documents are safely preserved.</li>
                <li>Access can be restored by Admin at any time.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSuspendModalApp(null);
                  setSuspendReason("");
                }}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSuspendPartner}
                disabled={actionLoading || !suspendReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                <span>{actionLoading ? "Suspending..." : "Confirm Suspension"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* APPROVE CONFIRMATION MODAL                                            */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {approveModalApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Approve BPO Partner?</h3>
                <p className="text-xs text-slate-500">Authorize partner activation and operational portal access.</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs my-4">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Company Name:</span>
                <span className="font-bold text-slate-900">{approveModalApp.companyName || approveModalApp.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Applicant:</span>
                <span className="font-bold text-slate-900">{approveModalApp.name} ({approveModalApp.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Centre ID:</span>
                <span className="font-bold font-mono text-slate-900">{approveModalApp.centreId || "THK-CTR-001"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Centre Verification:</span>
                <span className="font-bold text-slate-900">{approveModalApp.centreVerificationStatus || "Verified"}</span>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-3 text-xs text-emerald-800 mb-6">
              <p className="font-semibold">✓ Upon confirmation:</p>
              <ul className="mt-1 space-y-1 list-disc list-inside text-[11px] text-emerald-700">
                <li>BPO Partner account status transitions to <strong>APPROVED</strong>.</li>
                <li>Operational Partner Portal features will be unlocked.</li>
                <li>Official Thinkatic Approval Notification Email is automatically dispatched.</li>
                <li>An immutable audit log entry is written to Supabase.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setApproveModalApp(null)}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>{actionLoading ? "Activating..." : "Confirm & Activate BPO Partner"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* REJECT / RESUBMISSION MODAL (MANDATORY REASON)                         */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Application Action / Correction</h3>
                <p className="text-xs text-slate-500">Provide specific feedback for the applicant.</p>
              </div>
            </div>

            <div className="space-y-4 my-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Action Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectActionType("RESUBMISSION_REQUIRED")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      rejectActionType === "RESUBMISSION_REQUIRED"
                        ? "border-orange-500 bg-orange-50 text-orange-900 font-bold ring-1 ring-orange-500"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <div className="font-bold">Request Resubmission</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Allows applicant to fix specific fields and re-submit.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRejectActionType("REJECTED")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      rejectActionType === "REJECTED"
                        ? "border-rose-500 bg-rose-50 text-rose-900 font-bold ring-1 ring-rose-500"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <div className="font-bold">Formal Rejection</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Disqualifies application while preserving submitted history.</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reason <span className="text-rose-500">* (Mandatory)</span>:
                </label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Specify clear, actionable feedback or deficiency (e.g., Office photos lack clear network rack view, GST document blurred, power backup capacity insufficient)..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalApp(null);
                  setRejectReason("");
                }}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer ${
                  rejectActionType === "RESUBMISSION_REQUIRED"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Confirm {rejectActionType === "RESUBMISSION_REQUIRED" ? "Resubmission Request" : "Rejection"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* DELETE BPO PARTNER CONFIRMATION MODAL                                */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {archiveModalApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-2xs">
                <Trash2 className="h-6 w-6 shrink-0" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Delete BPO Partner?</h3>
                <p className="text-xs text-slate-500 font-medium">Please review and confirm permanent deletion of this BPO partner account.</p>
              </div>
            </div>

            {/* Target Partner Details Card */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3 mb-5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Company / BPO Name</span>
                  <span className="font-bold text-slate-900 text-sm block truncate">
                    {archiveModalApp.companyName || archiveModalApp.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Applicant Name</span>
                  <span className="font-semibold text-slate-800 text-xs block truncate">
                    {archiveModalApp.name || archiveModalApp.fullName || archiveModalApp.full_name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Email</span>
                  <span className="font-mono text-xs text-slate-700 block truncate">
                    {archiveModalApp.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Centre ID</span>
                  <span className="font-mono text-xs text-slate-700 block">
                    {archiveModalApp.centreId || "Not Assigned"}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Status</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 text-slate-700">
                    {archiveModalApp.status || archiveModalApp.bpo_status || "PENDING"}
                  </span>
                </div>
              </div>

              {/* Exact required warning */}
              <div className="pt-3 border-t border-slate-200/60 bg-rose-50/60 -mx-4 -mb-4 p-4 rounded-b-2xl border-t border-rose-100">
                <p className="text-xs font-bold text-rose-700 leading-relaxed flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>This permanently removes this BPO partner's onboarding/account data and cannot be undone.</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal pl-5.5">
                  All onboarding records, centre verification, agreements, private media, and Supabase Auth account will be wiped. Platform audit logs will retain an immutable record of deletion.
                </p>
              </div>
            </div>

            {/* Action Buttons: Cancel / Delete Permanently */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-remove-bpo-btn"
                onClick={() => setArchiveModalApp(null)}
                disabled={actionLoading}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition duration-150 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-remove-bpo-btn"
                onClick={handleDeletePermanently}
                disabled={actionLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-98 transition duration-150 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                    <span>Deleting Permanently...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* VIEW ORIGINAL MASTER AGREEMENT MODAL (PDF PREVIEW)                   */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {viewOriginalModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Thinkatic 23-Page Master BPO Legal Agreement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Master Document Source: Agreement/BPO Agreement.pdf (Exact 23 Pages) • Healweal LLC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewOriginalModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 my-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <iframe
                src={`/api/admin/agreements/${dossier?.agreement?.id || 0}/original-document?token=${adminToken}`}
                className="w-full h-[62vh] rounded-xl"
                title="Master Agreement PDF Preview"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Official master template served securely from Thinkatic backend.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => downloadOriginalAgreement(dossier?.agreement?.id || 0)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download className="h-4 w-4 text-[#214ECF]" />
                  <span>Download Master PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewOriginalModalOpen(false)}
                  className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* VIEW SIGNED AGREEMENT MODAL (PDF PREVIEW & REVIEW WORKFLOW)           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {viewSignedModalOpen && dossier?.agreement && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[94vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Review Partner Signed Agreement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify offline physical signatures, initialed pages, and legal entity seal before approval.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewSignedModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 my-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Partner Legal Name</span>
                <span className="font-bold text-slate-800 truncate block">{dossier.companyName || dossier.name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Centre ID</span>
                <span className="font-bold font-mono text-slate-800 block">{dossier.centre_id || dossier.centreVerification?.centreId || dossier.agreement?.centreId || "THK-CTR-ALLOCATED"}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Agreement ID / Ver</span>
                <span className="font-bold font-mono text-slate-800 block">{dossier.agreement.agreementCode || dossier.agreement.agreement_code} (v{dossier.agreement.version || "1.0"})</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Submitted Date</span>
                <span className="font-bold text-slate-800 block">
                  {dossier.agreement.signed_at || dossier.agreement.signedSubmittedAt
                    ? new Date(dossier.agreement.signed_at || dossier.agreement.signedSubmittedAt).toLocaleDateString()
                    : "Recently submitted"}
                </span>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="flex-1 my-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <iframe
                src={`/api/admin/agreements/${dossier.agreement.id}/signed-document?token=${adminToken}`}
                className="w-full h-[55vh] rounded-xl"
                title="Signed Agreement Document Preview"
              />
            </div>

            {/* Footer with Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSignedAgreement(dossier.agreement.id, dossier.agreement.signedDocumentFileName)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download className="h-4 w-4 text-[#214ECF]" />
                  <span>Download PDF</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewSignedModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Close Preview
                </button>

                {dossier.agreement.status !== "approved" && dossier.agreement.status !== "APPROVED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setAgreementRejectReason("");
                        setRejectAgreementModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer"
                    >
                      <AlertCircle className="h-4 w-4 text-slate-600" />
                      <span>Reject Agreement</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setApproveAgreementModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Approve Agreement</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* APPROVE SIGNED AGREEMENT CONFIRMATION MODAL                          */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {approveAgreementModalOpen && dossier?.agreement && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Approve Signed Agreement?</h3>
                <p className="text-xs text-slate-500">Formally verify and lock the countersigned master BPO contract.</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs my-4">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Partner:</span>
                <span className="font-bold text-slate-900">{dossier.companyName || dossier.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Centre ID:</span>
                <span className="font-bold font-mono text-slate-900">
                  {dossier.centre_id || dossier.centreVerification?.centreId || dossier.agreement?.centreId || "THK-CTR-ALLOCATED"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Agreement ID:</span>
                <span className="font-bold font-mono text-slate-900">
                  {dossier.agreement.agreementCode || dossier.agreement.agreement_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Version:</span>
                <span className="font-bold text-slate-900">
                  v{dossier.agreement.version || "1.0"}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-3.5 text-xs text-blue-900 mb-6">
              <p className="font-bold">Important Notice:</p>
              <p className="mt-1 text-blue-800 text-[11px] leading-relaxed">
                Approval confirms that the submitted signed agreement has been reviewed by an authorized administrator. The agreement will become immutable. BPO activation remains human-controlled and subject to all required accreditation gates.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setApproveAgreementModalOpen(false)}
                disabled={agreementActionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAgreement}
                disabled={agreementActionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition disabled:opacity-50 cursor-pointer"
              >
                {agreementActionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Confirm Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* REJECT SIGNED AGREEMENT MODAL (MANDATORY REASON)                      */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {rejectAgreementModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reject Signed Agreement</h3>
                <p className="text-xs text-slate-500">Specify why the signed PDF requires partner correction.</p>
              </div>
            </div>

            <div className="space-y-4 my-4 text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Partner:</span>
                  <span className="font-bold text-slate-900">{dossier?.companyName || dossier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Agreement ID:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {dossier?.agreement?.agreementCode || dossier?.agreement?.agreement_code || "THK-AGR"}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Rejection Reason <span className="text-slate-900 font-black">* (Required)</span>:
                </label>
                <textarea
                  rows={4}
                  value={agreementRejectReason}
                  onChange={(e) => setAgreementRejectReason(e.target.value)}
                  placeholder="Explain what needs to be corrected before the agreement can be resubmitted."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#214ECF] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectAgreementModalOpen(false);
                  setAgreementRejectReason("");
                }}
                disabled={agreementActionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectAgreement}
                disabled={agreementActionLoading || !agreementRejectReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
              >
                {agreementActionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Reject Agreement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ISSUE MASTER AGREEMENT CONFIRMATION MODAL                             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {issueAgreementModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100">
                <FileSignature className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Issue Master BPO Agreement</h3>
                <p className="text-xs text-slate-500">Generate and release official 23-page contract to partner portal.</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs my-4">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Partner Legal Name:</span>
                <span className="font-bold text-slate-900">{dossier?.companyName || dossier?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Centre ID:</span>
                <span className="font-bold font-mono text-slate-900">{dossier?.centre_id || dossier?.centreVerification?.centreId || "THK-CTR-ALLOCATED"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Signatory Entity:</span>
                <span className="font-bold text-slate-900">Healweal LLC (Wyoming, USA)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Master Specification:</span>
                <span className="font-bold text-slate-900">23 Pages • Agreement/BPO Agreement.pdf</span>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-3.5 text-xs text-blue-900 mb-6">
              <p className="text-blue-800 text-[11px] leading-relaxed">
                Issuing releases the agreement to the partner's Legal & Agreements portal. The partner will download, physically execute external signatures, and upload the signed PDF.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIssueAgreementModalOpen(false)}
                disabled={agreementActionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssueAgreement}
                disabled={agreementActionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition disabled:opacity-50 cursor-pointer"
              >
                {agreementActionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Confirm & Issue Agreement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* OFFICE VERIFICATION CORRECTION / REJECTION MODAL                      */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {officeVerifRejectModalOpen && dossier?.centreVerification && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Request Office Verification Correction</h3>
                <p className="text-xs text-slate-500">Provide clear instructions on what needs correction.</p>
              </div>
            </div>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mandatory Correction / Rejection Reason *
              </label>
              <textarea
                rows={4}
                value={officeVerifRejectReason}
                onChange={(e) => setOfficeVerifRejectReason(e.target.value)}
                placeholder="e.g. Workstation area photo is blurry. Please re-upload a clear wide-angle photo of the active calling floor and ensure the server rack is visible in the walkthrough video."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-900 focus:border-rose-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This message will be shown directly to the partner on their Office Verification dashboard.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={officeVerifActionLoading}
                onClick={() => setOfficeVerifRejectModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={officeVerifActionLoading || !officeVerifRejectReason.trim()}
                onClick={() => handleRejectOfficeVerification(dossier.centreVerification.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {officeVerifActionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send Correction Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
