import { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck,
  RefreshCw,
  Search,
  Filter,
  Plus,
  X,
  Send,
  ExternalLink,
  Lock,
  Layers,
  FileText,
  AlertTriangle,
  Upload,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  Building,
  GraduationCap,
  Sparkles,
  ChevronRight,
  History,
  Info,
  Check,
  SlidersHorizontal,
} from "lucide-react";

interface EvidenceVersion {
  version: number;
  url: string;
  notes: string;
  uploaded_at: string;
  uploaded_by: string;
  review_status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

interface ComplianceCheck {
  id: number;
  check_code: string;
  title: string;
  check_type: string;
  category?: string;
  scope: "centre" | "project" | "agent";
  partner_id: string;
  centre_id: number;
  project_id?: number | null;
  agent_id?: number | null;
  requirement_description: string;
  priority?: "critical" | "high" | "medium" | "low";
  status:
    | "verified"
    | "submitted"
    | "under_review"
    | "pending_evidence"
    | "action_required"
    | "not_started"
    | "exception_active"
    | "rejected"
    | "expired"
    | "compliant"
    | "non_compliant";
  is_mandatory?: boolean;
  due_date?: string | null;
  completed_at?: string | null;
  last_verified_at?: string | null;
  verified_by?: string | null;
  evidence_notes?: string | null;
  evidence_url?: string | null;
  evidence_versions?: EvidenceVersion[];
  linked_module?: string | null;
  linked_entity_id?: string | number | null;
  linked_entity_status?: string | null;
  created_at: string;
  updated_at: string;
}

interface ComplianceException {
  id: number;
  check_id?: number;
  check_code: string;
  partner_id: string;
  centre_id: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "requested" | "under_review" | "expired" | "revoked";
  start_date?: string | null;
  valid_until?: string | null;
  approved_by?: string | null;
  approval_date?: string | null;
  conditions?: string | null;
  notes?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

interface CapaHistory {
  date: string;
  action: string;
  note: string;
  actor: string;
}

interface CorrectiveAction {
  id: number;
  action_code?: string;
  capa_code?: string;
  check_code?: string;
  related_entity_type?: string;
  related_entity_id?: number;
  partner_id: string;
  centre_id: number;
  title?: string;
  issue_summary: string;
  root_cause?: string;
  corrective_action?: string;
  action_required?: string;
  preventive_action?: string;
  owner_name: string;
  priority?: "critical" | "high" | "medium" | "low";
  due_date?: string;
  target_date?: string;
  status:
    | "open"
    | "in_progress"
    | "evidence_submitted"
    | "under_review"
    | "completed"
    | "rejected"
    | "overdue"
    | "cancelled";
  evidence_url?: string | null;
  evidence_notes?: string | null;
  completion_date?: string | null;
  completion_notes?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
  history?: CapaHistory[];
}

interface ComplianceHealthData {
  percentage: number | null;
  status:
    | "COMPLIANT"
    | "PARTIALLY COMPLIANT"
    | "ACTION REQUIRED"
    | "UNDER REVIEW"
    | "EXCEPTION ACTIVE"
    | "NON-COMPLIANT"
    | "N/A";
  badge_message: string;
  verified_count: number;
  total_applicable: number;
  active_exceptions_count: number;
  open_capas_count: number;
  overdue_count: number;
  pending_reviews_count: number;
}

interface CategoryHealthItem {
  category: string;
  total: number;
  verified: number;
  pending: number;
  action_required: number;
  health_percent: number;
}

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  timestamp: string;
  title: string;
  description: string;
  badge: string;
  badge_color: "green" | "blue" | "amber" | "red" | "purple";
}

interface Props {
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function BpoComplianceSection({ api }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data Stores
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [exceptions, setExceptions] = useState<ComplianceException[]>([]);
  const [capas, setCapas] = useState<CorrectiveAction[]>([]);
  const [health, setHealth] = useState<ComplianceHealthData | null>(null);
  const [categories, setCategories] = useState<CategoryHealthItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [trendPoints, setTrendPoints] = useState<any[]>([]);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<
    "checkpoints" | "exceptions" | "capa" | "risk" | "timeline" | "flow"
  >("checkpoints");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [trendPeriod, setTrendPeriod] = useState<"7D" | "30D" | "90D" | "6M">("30D");

  // Drawer & Modal States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<ComplianceCheck | null>(null);
  const [relatedCapaForCheck, setRelatedCapaForCheck] = useState<CorrectiveAction | null>(null);
  const [relatedExceptionForCheck, setRelatedExceptionForCheck] = useState<ComplianceException | null>(null);

  // Evidence Upload Form
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exception Request Modal
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionCheckCode, setExceptionCheckCode] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionValidUntil, setExceptionValidUntil] = useState("");
  const [exceptionConditions, setExceptionConditions] = useState("");
  const [submittingException, setSubmittingException] = useState(false);

  // CAPA Evidence Modal
  const [capaModalOpen, setCapaModalOpen] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState<CorrectiveAction | null>(null);
  const [capaNotes, setCapaNotes] = useState("");
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [submittingCapaEvidence, setSubmittingCapaEvidence] = useState(false);

  // Report Issue Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueSummary, setIssueSummary] = useState("");
  const [issueRootCause, setIssueRootCause] = useState("");
  const [issueActionRequired, setIssueActionRequired] = useState("");
  const [issueOwner, setIssueOwner] = useState("");
  const [issuePriority, setIssuePriority] = useState<"critical" | "high" | "medium" | "low">("high");
  const [issueTargetDate, setIssueTargetDate] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(""), 4500);
  };

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [sumRes, chkRes, expRes, capaRes, histRes] = await Promise.all([
        api("/bpo/compliance/summary"),
        api("/bpo/compliance/checks"),
        api("/bpo/compliance/exceptions"),
        api("/bpo/compliance/corrective-actions"),
        api("/bpo/compliance/history"),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setHealth(sumData.health);
        setCategories(sumData.category_breakdown || []);
        if (sumData.trend?.available) {
          setTrendPoints(sumData.trend.points || []);
        } else {
          setTrendPoints([]);
        }
      }

      if (chkRes.ok) {
        const chkData = await chkRes.json();
        setChecks(chkData.checks || []);
      }

      if (expRes.ok) {
        const expData = await expRes.json();
        setExceptions(expData.exceptions || []);
      }

      if (capaRes.ok) {
        const capaData = await capaRes.json();
        setCapas(capaData.actions || []);
      }

      if (histRes.ok) {
        const histData = await histRes.json();
        setTimeline(histData.events || []);
      }
    } catch (err) {
      console.error("Failed to load compliance records:", err);
      showToast("Unable to load latest compliance state", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function openCheckDetail(check: ComplianceCheck) {
    setSelectedCheck(check);
    setEvidenceNotes("");
    setEvidenceUrl("");
    setUploadFile(null);
    setDrawerOpen(true);

    // Fetch single check details with related CAPA & exception
    try {
      const res = await api(`/bpo/compliance/checks/${check.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.check) setSelectedCheck(data.check);
        setRelatedCapaForCheck(data.related_capa || null);
        setRelatedExceptionForCheck(data.related_exception || null);
      }
    } catch (err) {
      console.error("Failed to fetch checkpoint details:", err);
    }
  }

  async function handleEvidenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCheck) return;

    if (!uploadFile && !evidenceUrl.trim() && (!evidenceNotes || evidenceNotes.trim().length < 5)) {
      showToast("Please provide an evidence document or detailed verification notes", "error");
      return;
    }

    setSubmittingEvidence(true);

    let fileBase64: string | undefined = undefined;
    let fileName: string | undefined = undefined;

    if (uploadFile) {
      fileName = uploadFile.name;
      fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });
    }

    try {
      const res = await api(`/bpo/compliance/checks/${selectedCheck.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: evidenceNotes,
          evidenceUrl: evidenceUrl.trim() || undefined,
          fileName,
          fileBase64,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "Evidence submitted successfully for authorized review", "success");
        setSelectedCheck(data.check);
        setUploadFile(null);
        setEvidenceNotes("");
        setEvidenceUrl("");
        await loadData(true);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to submit evidence", "error");
      }
    } catch (err) {
      console.error("Evidence submission error:", err);
      showToast("Network error submitting compliance evidence", "error");
    } finally {
      setSubmittingEvidence(false);
    }
  }

  async function handleExceptionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exceptionCheckCode || !exceptionReason.trim() || !exceptionValidUntil) {
      showToast("All fields are required to request an exception", "error");
      return;
    }

    if (exceptionReason.trim().length < 10) {
      showToast("Justification reason must be at least 10 characters", "error");
      return;
    }

    setSubmittingException(true);
    try {
      const res = await api("/bpo/compliance/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkCode: exceptionCheckCode,
          reason: exceptionReason.trim(),
          validUntil: exceptionValidUntil,
          conditions: exceptionConditions.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast("Exception requested successfully. Awaiting compliance auditor review.", "success");
        setExceptionModalOpen(false);
        setExceptionCheckCode("");
        setExceptionReason("");
        setExceptionValidUntil("");
        setExceptionConditions("");
        await loadData(true);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to submit exception request", "error");
      }
    } catch (err) {
      console.error("Exception request error:", err);
      showToast("Network error requesting exception", "error");
    } finally {
      setSubmittingException(false);
    }
  }

  async function handleCapaEvidenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCapa) return;

    if (!capaFile && (!capaNotes || capaNotes.trim().length < 5)) {
      showToast("Please provide an evidence document or corrective notes", "error");
      return;
    }

    setSubmittingCapaEvidence(true);
    let fileBase64: string | undefined = undefined;
    let fileName: string | undefined = undefined;

    if (capaFile) {
      fileName = capaFile.name;
      fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(capaFile);
      });
    }

    try {
      const res = await api(`/bpo/compliance/corrective-actions/${selectedCapa.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: capaNotes,
          fileName,
          fileBase64,
        }),
      });

      if (res.ok) {
        showToast("CAPA corrective evidence submitted for compliance sign-off", "success");
        setCapaModalOpen(false);
        setSelectedCapa(null);
        setCapaNotes("");
        setCapaFile(null);
        await loadData(true);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to submit CAPA evidence", "error");
      }
    } catch (err) {
      console.error("CAPA evidence submission error:", err);
      showToast("Network error submitting CAPA evidence", "error");
    } finally {
      setSubmittingCapaEvidence(false);
    }
  }

  // Filtered checkpoints
  const filteredChecks = checks.filter((c) => {
    const matchesSearch =
      !searchQuery.trim() ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.check_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.requirement_description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || c.category?.toLowerCase() === categoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      c.status?.toLowerCase() === statusFilter.toLowerCase() ||
      (statusFilter === "verified" && (c.status === "verified" || c.status === "compliant")) ||
      (statusFilter === "pending" && (c.status === "under_review" || c.status === "submitted" || c.status === "pending_evidence"));

    const matchesPriority =
      priorityFilter === "all" || c.priority?.toLowerCase() === priorityFilter.toLowerCase();

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  // Extract unique categories for dropdown
  const uniqueCategories = Array.from(new Set(checks.map((c) => c.category).filter(Boolean))) as string[];

  // Helper badge renderers
  function renderStatusBadge(status: string) {
    const s = status?.toLowerCase();
    switch (s) {
      case "verified":
      case "compliant":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
        );
      case "under_review":
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
      case "exception_active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Exception Active
          </span>
        );
      case "action_required":
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" /> Action Required
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5" /> Expired
          </span>
        );
      case "pending_evidence":
      case "not_started":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            <Clock className="w-3.5 h-3.5" /> Pending Evidence
          </span>
        );
    }
  }

  function renderPriorityBadge(priority?: string) {
    const p = priority?.toLowerCase();
    switch (p) {
      case "critical":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 uppercase tracking-wide">
            Critical
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide">
            High
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
            Low
          </span>
        );
    }
  }

  // Linked module navigation helper
  function getLinkedModuleUrl(moduleKey?: string | null): string {
    switch (moduleKey) {
      case "documents":
        return "/partner?tab=documents";
      case "office_verification":
        return "/partner?tab=office_verification";
      case "legal":
        return "/partner?tab=legal";
      case "training":
        return "/partner?tab=training";
      case "quality":
        return "/partner?tab=quality";
      case "projects":
        return "/partner?tab=projects";
      case "agents":
        return "/partner?tab=agents";
      default:
        return "/partner?tab=documents";
    }
  }

  function getLinkedModuleLabel(moduleKey?: string | null): string {
    switch (moduleKey) {
      case "documents":
        return "Documents Module";
      case "office_verification":
        return "Office Verification";
      case "legal":
        return "Legal & Agreements";
      case "training":
        return "Workforce Training";
      case "quality":
        return "QA Module";
      case "projects":
        return "Campaign / Project";
      case "agents":
        return "Agents Roster";
      default:
        return "Linked System";
    }
  }

  return (
    <div className="w-full bg-[#FFFFFF] min-h-screen text-[#0B1730] pb-24">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium transition-all transform animate-in fade-in slide-in-from-bottom-5 ${
            toastType === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : toastType === "error"
              ? "bg-red-50 text-red-800 border-red-200"
              : "bg-blue-50 text-blue-800 border-blue-200"
          }`}
        >
          {toastType === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : toastType === "error" ? (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
          )}
          <span>{toastMsg}</span>
          <button
            onClick={() => setToastMsg("")}
            className="ml-2 text-slate-400 hover:text-slate-600 focus:outline-none"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MAIN ENTERPRISE HEADER */}
      {/* ============================================================================== */}
      <div className="border-b border-[#E3EAF5] bg-gradient-to-b from-[#F8FAFC] to-[#FFFFFF] px-6 py-8 sm:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EEF5FF] text-[#214ECF] border border-[#5FA8FF]/30 tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" /> PHASE 4 · COMPLIANCE & CAPA
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Operational Compliance Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1730] tracking-tight">
              Compliance & Risk Command Centre
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              Manage mandatory requirements, evidence verification, exceptions, corrective actions and compliance status across BPO operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void loadData(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-[#E3EAF5] rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm disabled:opacity-50"
              aria-label="Refresh compliance telemetry"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? "animate-spin text-[#214ECF]" : ""}`} />
              Refresh
            </button>

            <button
              onClick={() => {
                setExceptionCheckCode("");
                setExceptionReason("");
                setExceptionValidUntil("");
                setExceptionConditions("");
                setExceptionModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0B1730] bg-[#EEF5FF] border border-[#214ECF]/20 rounded-xl hover:bg-[#214ECF]/10 transition-colors shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 text-[#214ECF]" />
              Request Exception
            </button>

            <button
              onClick={() => {
                setIssueTitle("");
                setIssueSummary("");
                setIssueRootCause("");
                setIssueActionRequired("");
                setIssueOwner("");
                setIssuePriority("high");
                setIssueTargetDate("");
                setReportModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm shadow-[#214ECF]/20"
            >
              <Plus className="w-4 h-4" />
              Report Compliance Issue
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-8 space-y-8">
        {/* ============================================================================== */}
        {/* TOP 6 KPI CARDS */}
        {/* ============================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* 1. Compliance Health */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[#214ECF]/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compliance Health</span>
              <ShieldCheck className="w-4 h-4 text-[#214ECF]" />
            </div>
            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-black text-[#0B1730]">
                {health?.percentage !== null && health?.percentage !== undefined ? `${health.percentage}%` : "N/A"}
              </div>
              <div className="mt-1">
                {renderStatusBadge(health?.status || "NOT_STARTED")}
              </div>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {health?.badge_message || "Calculating baseline..."}
            </div>
          </div>

          {/* 2. Active Checkpoints */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[#214ECF]/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Checkpoints</span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-black text-[#0B1730]">
                {health?.total_applicable ?? checks.length}
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {health?.verified_count ?? checks.filter((c) => c.status === "verified").length} Verified
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Operational Standards
            </div>
          </div>

          {/* 3. Active Exceptions */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Exceptions</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-black text-amber-600">
                {health?.active_exceptions_count ?? exceptions.filter((e) => e.status === "approved").length}
              </div>
              <div className="text-xs text-slate-600 font-medium mt-1">
                Time-bound waivers
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Non-permanent extensions
            </div>
          </div>

          {/* 4. Open CAPA Plans */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[#214ECF]/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open CAPA Plans</span>
              <FileCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-black text-[#0B1730]">
                {health?.open_capas_count ?? capas.filter((c) => c.status !== "completed" && c.status !== "cancelled").length}
              </div>
              <div className="text-xs text-indigo-600 font-medium mt-1">
                Corrective actions
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Remediation in progress
            </div>
          </div>

          {/* 5. Overdue Items */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-red-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue Items</span>
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="my-3">
              <div className={`text-2xl sm:text-3xl font-black ${(health?.overdue_count || 0) > 0 ? "text-red-600" : "text-slate-800"}`}>
                {health?.overdue_count ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {(health?.overdue_count || 0) > 0 ? "Immediate action required" : "Zero overdue audits"}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              SLA deadline monitoring
            </div>
          </div>

          {/* 6. Pending Reviews */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Reviews</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-black text-blue-600">
                {health?.pending_reviews_count ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Submissions awaiting audit
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Human review queue
            </div>
          </div>
        </div>

        {/* ============================================================================== */}
        {/* COMPLIANCE HEALTH TREND + CATEGORY HEALTH */}
        {/* ============================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Panel */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0B1730]">Compliance Health Trend</h3>
                  <p className="text-xs text-slate-500">Audit trajectory based on verified checkpoints</p>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  {(["7D", "30D", "90D", "6M"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setTrendPeriod(period)}
                      className={`px-2 py-0.5 rounded ${
                        trendPeriod === period
                          ? "bg-white text-[#214ECF] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {trendPoints.length > 0 ? (
                <div className="mt-6 space-y-4">
                  <div className="h-40 flex items-end gap-3 px-2 pt-6 border-b border-slate-100">
                    {trendPoints.map((pt, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <span className="text-[11px] font-bold text-slate-700">{pt.score}%</span>
                        <div
                          style={{ height: `${Math.max(15, pt.score)}%` }}
                          className={`w-full max-w-[42px] rounded-t-lg transition-all duration-500 ${
                            idx === trendPoints.length - 1 ? "bg-[#214ECF]" : "bg-[#5FA8FF]/40"
                          }`}
                        />
                        <span className="text-[10px] text-slate-500 uppercase">{pt.period}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" /> Positive governance trajectory
                    </span>
                    <span>Verified by Thinkatic QA</span>
                  </div>
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl mt-4 border border-dashed border-slate-200">
                  <Clock className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Not enough historical compliance data.</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Trend telemetry unlocks automatically as subsequent compliance audit checkpoints are completed over time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown (2 Columns on Desktop) */}
          <div className="lg:col-span-2 bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0B1730]">Compliance by Operational Category</h3>
                <p className="text-xs text-slate-500">Live verification status mapped across core service requirements</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                {categories.length} Categories Configured
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-100 bg-[#F8FAFC] hover:bg-white hover:border-[#214ECF]/30 transition-all"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#0B1730]">
                    <span>{cat.category}</span>
                    <span className={cat.health_percent === 100 ? "text-emerald-600 font-bold" : "text-[#214ECF]"}>
                      {cat.health_percent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cat.health_percent === 100 ? "bg-emerald-500" : "bg-[#214ECF]"
                      }`}
                      style={{ width: `${cat.health_percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                    <span>
                      {cat.verified} of {cat.total} verified
                    </span>
                    {cat.pending > 0 && (
                      <span className="text-blue-600 font-medium">{cat.pending} review</span>
                    )}
                    {cat.action_required > 0 && (
                      <span className="text-red-600 font-medium">{cat.action_required} action req</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================================== */}
        {/* INTERACTIVE NAVIGATION TABS */}
        {/* ============================================================================== */}
        <div className="border-b border-[#E3EAF5]">
          <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-none py-1" aria-label="Compliance Tabs">
            {[
              { id: "checkpoints", label: "Mandatory Checkpoints", count: checks.length },
              { id: "exceptions", label: "Time-bound Exceptions", count: exceptions.length },
              { id: "capa", label: "Corrective Action Plans (CAPA)", count: capas.length },
              { id: "risk", label: "Risk Overview", count: (health?.overdue_count || 0) + (health?.active_exceptions_count || 0) },
              { id: "timeline", label: "Compliance Timeline", count: timeline.length },
              { id: "flow", label: "Compliance Process Flow" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-2 sm:px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-[#214ECF] text-[#214ECF]"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      activeTab === tab.id
                        ? "bg-[#EEF5FF] text-[#214ECF]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ============================================================================== */}
        {/* TAB 1: MANDATORY CHECKPOINTS */}
        {/* ============================================================================== */}
        {activeTab === "checkpoints" && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F8FAFC] p-4 rounded-2xl border border-[#E3EAF5]">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search checkpoint ID, title, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E3EAF5] rounded-xl text-sm focus:outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF] text-[#0B1730]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Category Dropdown */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E3EAF5] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#214ECF]"
                  aria-label="Filter by category"
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Status Dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E3EAF5] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#214ECF]"
                  aria-label="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending / Under Review</option>
                  <option value="action_required">Action Required</option>
                  <option value="exception_active">Exception Active</option>
                </select>

                {/* Priority Dropdown */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E3EAF5] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#214ECF]"
                  aria-label="Filter by priority"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {(searchQuery || categoryFilter !== "all" || statusFilter !== "all" || priorityFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setCategoryFilter("all");
                      setStatusFilter("all");
                      setPriorityFilter("all");
                    }}
                    className="text-xs text-[#214ECF] font-semibold hover:underline px-2 py-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Checkpoints Table */}
            {filteredChecks.length > 0 ? (
              <div className="bg-white border border-[#E3EAF5] rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F8FAFC] border-b border-[#E3EAF5] text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Checkpoint ID</th>
                        <th className="py-3.5 px-4">Requirement & Standard</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Priority</th>
                        <th className="py-3.5 px-4">Due Date</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Evidence</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3EAF5]">
                      {filteredChecks.map((check) => (
                        <tr
                          key={check.id}
                          onClick={() => void openCheckDetail(check)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4 font-mono text-xs font-bold text-[#214ECF]">
                            {check.check_code}
                          </td>
                          <td className="py-4 px-4 max-w-sm">
                            <div className="font-semibold text-[#0B1730]">{check.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {check.requirement_description}
                            </div>
                            {check.linked_module && (
                              <div className="mt-1">
                                <a
                                  href={getLinkedModuleUrl(check.linked_module)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[11px] text-[#214ECF] font-medium hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Linked: {getLinkedModuleLabel(check.linked_module)}
                                </a>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                            {check.category || "Standard"}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {renderPriorityBadge(check.priority)}
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                            {check.due_date || "Continuous"}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {renderStatusBadge(check.status)}
                          </td>
                          <td className="py-4 px-4 text-xs whitespace-nowrap">
                            {check.evidence_versions && check.evidence_versions.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                v{check.evidence_versions.length} on file
                              </span>
                            ) : (
                              <span className="text-slate-400">None uploaded</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => void openCheckDetail(check)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#214ECF] bg-[#EEF5FF] hover:bg-[#214ECF]/10 rounded-lg transition-colors"
                            >
                              View Dossier
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white border border-[#E3EAF5] rounded-2xl">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No compliance checkpoints found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {checks.length === 0
                    ? "No compliance checkpoints configured yet."
                    : "No checkpoints match your active search filters. Try adjusting your filter parameters."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 2: TIME-BOUND EXCEPTIONS */}
        {/* ============================================================================== */}
        {activeTab === "exceptions" && (
          <div className="space-y-6">
            <div className="bg-[#EEF5FF] border border-[#5FA8FF]/30 rounded-2xl p-5 flex items-start gap-4">
              <Info className="w-5 h-5 text-[#214ECF] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0B1730]">Time-Bound Exception Policy & Governance</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Exceptions grant temporary operational continuity for scheduled migrations or dependencies without silently marking requirements as compliant. When the expiry date passes, the checkpoint returns to pending action.
                </p>
              </div>
            </div>

            {exceptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {exceptions.map((exp) => (
                  <div
                    key={exp.id}
                    className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[#214ECF]/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">
                          EXP-{String(exp.id).padStart(5, "0")}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {exp.check_code}
                        </span>
                      </div>
                      {renderStatusBadge(exp.status)}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Justification Reason
                      </div>
                      <p className="text-sm text-[#0B1730] font-medium leading-relaxed">{exp.reason}</p>
                    </div>

                    {exp.conditions && (
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span className="font-bold">Conditions: </span>
                        {exp.conditions}
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Valid Until</span>
                        <span className="font-semibold text-slate-800">{exp.valid_until || "Permanent Review"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Approved By</span>
                        <span className="font-semibold text-slate-800">{exp.approved_by || "Pending Review"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white border border-[#E3EAF5] rounded-2xl">
                <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No active exceptions</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  All compliance requirements are currently operating under standard verification rules.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 3: CORRECTIVE ACTION PLANS (CAPA) */}
        {/* ============================================================================== */}
        {activeTab === "capa" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#0B1730]">Corrective & Preventive Actions (CAPA)</h3>
                <p className="text-xs text-slate-500">
                  Track root cause analysis and resolution progress for flagged operational non-conformances
                </p>
              </div>
              <button
                onClick={() => {
                  setIssueTitle("");
                  setIssueSummary("");
                  setIssueRootCause("");
                  setIssueActionRequired("");
                  setIssueOwner("");
                  setIssuePriority("high");
                  setIssueTargetDate("");
                  setReportModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#214ECF] rounded-xl hover:bg-[#1a3fa8] transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New CAPA Plan
              </button>
            </div>

            {capas.length > 0 ? (
              <div className="space-y-4">
                {capas.map((capa) => (
                  <div
                    key={capa.id}
                    className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-sm hover:border-[#214ECF]/30 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">
                          {capa.capa_code || `CAPA-${capa.id}`}
                        </span>
                        {capa.check_code && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {capa.check_code}
                          </span>
                        )}
                        <span className="font-bold text-[#0B1730]">{capa.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderPriorityBadge(capa.priority)}
                        {renderStatusBadge(capa.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Issue Summary</span>
                        <p className="text-slate-800 font-medium mt-0.5">{capa.issue_summary}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Root Cause</span>
                        <p className="text-slate-800 font-medium mt-0.5">{capa.root_cause || "Under Analysis"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Corrective Action</span>
                        <p className="text-slate-800 font-medium mt-0.5">{capa.corrective_action || capa.action_required}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-4">
                        <span>
                          <strong className="text-slate-700">Owner:</strong> {capa.owner_name}
                        </span>
                        <span>
                          <strong className="text-slate-700">Target Date:</strong> {capa.target_date || capa.due_date}
                        </span>
                        {capa.evidence_url && (
                          <a
                            href={capa.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#214ECF] font-semibold hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Evidence
                          </a>
                        )}
                      </div>

                      {capa.status !== "completed" && (
                        <button
                          onClick={() => {
                            setSelectedCapa(capa);
                            setCapaNotes("");
                            setCapaFile(null);
                            setCapaModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#214ECF] rounded-lg hover:bg-[#1a3fa8] transition-colors shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Submit Evidence
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white border border-[#E3EAF5] rounded-2xl">
                <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No corrective action plans</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Zero active CAPA plans on file. Operational controls are performing within normal parameters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 4: RISK OVERVIEW */}
        {/* ============================================================================== */}
        {activeTab === "risk" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* High Priority Unverified */}
              <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#0B1730] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    High Priority Open Items
                  </h4>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                    {checks.filter((c) => (c.priority === "critical" || c.priority === "high") && c.status !== "verified").length} Items
                  </span>
                </div>
                <div className="space-y-2.5">
                  {checks
                    .filter((c) => (c.priority === "critical" || c.priority === "high") && c.status !== "verified")
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => void openCheckDetail(c)}
                        className="p-3 rounded-xl border border-slate-100 hover:border-red-200 bg-[#F8FAFC] cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{c.title}</div>
                          <div className="text-[11px] text-slate-500">{c.check_code} · Due: {c.due_date || "Immediate"}</div>
                        </div>
                        {renderStatusBadge(c.status)}
                      </div>
                    ))}
                  {checks.filter((c) => (c.priority === "critical" || c.priority === "high") && c.status !== "verified").length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">All high priority standards are verified.</p>
                  )}
                </div>
              </div>

              {/* Overdue CAPAs */}
              <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#0B1730] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Pending CAPA & Audit Closures
                  </h4>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {capas.filter((c) => c.status !== "completed").length} Active
                  </span>
                </div>
                <div className="space-y-2.5">
                  {capas
                    .filter((c) => c.status !== "completed")
                    .map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl border border-slate-100 bg-[#F8FAFC] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{c.title}</div>
                          <div className="text-[11px] text-slate-500">
                            Target: {c.target_date || c.due_date} · Owner: {c.owner_name}
                          </div>
                        </div>
                        {renderStatusBadge(c.status)}
                      </div>
                    ))}
                  {capas.filter((c) => c.status !== "completed").length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">Zero outstanding CAPA plans.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 5: COMPLIANCE TIMELINE */}
        {/* ============================================================================== */}
        {activeTab === "timeline" && (
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#0B1730]">Compliance Activity Timeline</h3>
              <p className="text-xs text-slate-500">Immutable chronological audit trail of all compliance verification events</p>
            </div>

            {timeline.length > 0 ? (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative group">
                    {/* Bullet */}
                    <div
                      className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        event.badge_color === "green"
                          ? "bg-emerald-500 ring-4 ring-emerald-50"
                          : event.badge_color === "red"
                          ? "bg-red-500 ring-4 ring-red-50"
                          : "bg-[#214ECF] ring-4 ring-blue-50"
                      }`}
                    />
                    <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 hover:border-[#214ECF]/30 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#0B1730]">{event.title}</span>
                        <span className="text-[11px] font-semibold text-slate-500">{event.date}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">No compliance activity recorded yet</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Actions taken on checkpoints, exceptions, and CAPA plans will be logged here automatically.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 6: COMPLIANCE FLOW VISUALIZATION */}
        {/* ============================================================================== */}
        {activeTab === "flow" && (
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-8 shadow-sm space-y-8">
            <div>
              <h3 className="text-lg font-bold text-[#0B1730]">Compliance & CAPA Lifecycle Process</h3>
              <p className="text-xs text-slate-500">
                End-to-end operational flow ensuring human authorization and transparent risk management
              </p>
            </div>

            {/* Standard Flow */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#214ECF] uppercase tracking-wider">
                Standard Verification Pathway (Happy Path)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { step: "1. Requirement", desc: "Mandatory standard published with scope & criteria" },
                  { step: "2. Evidence Upload", desc: "BPO partner submits verified documentation" },
                  { step: "3. Admin Review", desc: "Authorized compliance officer conducts review" },
                  { step: "4. Verified", desc: "Official human sign-off recorded in audit log" },
                  { step: "5. Compliant", desc: "Health score recalculated server-side" },
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#EEF5FF] border border-[#5FA8FF]/30 space-y-1">
                    <div className="font-bold text-xs text-[#214ECF]">{s.step}</div>
                    <div className="text-[11px] text-slate-600 leading-snug">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Remediation Flow */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                Remediation Pathway (Exception & CAPA Workflow)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { step: "1. Issue Detected", desc: "Evidence rejected or non-conformance observed" },
                  { step: "2. CAPA / Exception", desc: "Corrective action plan assigned with owner & SLA" },
                  { step: "3. Remediation", desc: "Root cause addressed and corrective action executed" },
                  { step: "4. Re-Review", desc: "Auditor evaluates newly submitted resolution evidence" },
                  { step: "5. Resolved", desc: "CAPA closed and checkpoint restored to verified status" },
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                    <div className="font-bold text-xs text-amber-800">{s.step}</div>
                    <div className="text-[11px] text-amber-950 leading-snug">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* CHECKPOINT DETAIL DRAWER */}
      {/* ============================================================================== */}
      {drawerOpen && selectedCheck && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-[#0B1730]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-[#E3EAF5] flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#E3EAF5] bg-[#F8FAFC]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#214ECF]">
                      {selectedCheck.check_code}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {selectedCheck.category || "Standard"}
                    </span>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                    aria-label="Close drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="text-xl font-extrabold text-[#0B1730] mt-3">{selectedCheck.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  {renderPriorityBadge(selectedCheck.priority)}
                  {renderStatusBadge(selectedCheck.status)}
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Requirement Specification */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Requirement & Standard Specification
                  </h4>
                  <p className="text-sm text-slate-800 leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                    {selectedCheck.requirement_description}
                  </p>
                </div>

                {/* Linked Module Banner */}
                {selectedCheck.linked_module && (
                  <div className="p-4 rounded-xl bg-[#EEF5FF] border border-[#5FA8FF]/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#214ECF] block">Connected Thinkatic Module</span>
                      <span className="text-xs text-slate-700 font-medium">
                        {getLinkedModuleLabel(selectedCheck.linked_module)}
                      </span>
                    </div>
                    <a
                      href={getLinkedModuleUrl(selectedCheck.linked_module)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#214ECF] rounded-lg hover:bg-[#1a3fa8] transition-colors"
                    >
                      Open Module <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Related CAPA / Exception notice if active */}
                {relatedExceptionForCheck && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Active Temporary Exception
                    </div>
                    <p>{relatedExceptionForCheck.reason}</p>
                    <div className="text-[11px] text-amber-700 font-semibold pt-1">
                      Valid until: {relatedExceptionForCheck.valid_until}
                    </div>
                  </div>
                )}

                {/* Evidence Versions History */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Evidence Submission History
                  </h4>
                  {selectedCheck.evidence_versions && selectedCheck.evidence_versions.length > 0 ? (
                    <div className="space-y-3">
                      {selectedCheck.evidence_versions.map((ev) => (
                        <div key={ev.version} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#0B1730]">Version {ev.version}</span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                ev.review_status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ev.review_status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {ev.review_status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{ev.notes}</p>
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#214ECF] font-semibold hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" /> View Submitted Document
                            </a>
                          )}
                          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                            <span>Uploaded: {ev.uploaded_at?.slice(0, 10)}</span>
                            {ev.reviewed_by && <span>Reviewed by: {ev.reviewed_by}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 text-center">
                      No evidence files uploaded yet for this checkpoint.
                    </div>
                  )}
                </div>

                {/* Upload New Evidence Form */}
                <form onSubmit={handleEvidenceSubmit} className="space-y-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Submit New Evidence Document (v{(selectedCheck.evidence_versions?.length || 0) + 1})
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Evidence File (PDF, PNG, JPG, DOCX, XLSX, ZIP)
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-[#214ECF] rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-[#EEF5FF]/30 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs font-semibold text-[#214ECF]">
                        {uploadFile ? uploadFile.name : "Click to select file from device"}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">Maximum size: 25MB</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadFile(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verification Notes & Description
                    </label>
                    <textarea
                      rows={3}
                      value={evidenceNotes}
                      onChange={(e) => setEvidenceNotes(e.target.value)}
                      placeholder="Add detailed explanatory notes on how this requirement is satisfied..."
                      className="w-full p-3 bg-white border border-[#E3EAF5] rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingEvidence}
                    className="w-full py-3 bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  >
                    {submittingEvidence ? "Submitting for Review..." : "Submit Evidence for Admin Review"}
                  </button>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#E3EAF5] bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Human authorization controls final status</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* REQUEST EXCEPTION MODAL */}
      {/* ============================================================================== */}
      {exceptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Request Time-bound Exception
              </h3>
              <button onClick={() => setExceptionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Checkpoint</label>
                <select
                  value={exceptionCheckCode}
                  onChange={(e) => setExceptionCheckCode(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">Select a checkpoint...</option>
                  {checks.map((c) => (
                    <option key={c.id} value={c.check_code}>
                      {c.check_code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Justification Reason (Minimum 10 characters)
                </label>
                <textarea
                  rows={3}
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Explain why temporary operational dispensation is requested..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requested Expiration Date</label>
                <input
                  type="date"
                  value={exceptionValidUntil}
                  onChange={(e) => setExceptionValidUntil(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proposed Compensating Conditions</label>
                <input
                  type="text"
                  value={exceptionConditions}
                  onChange={(e) => setExceptionConditions(e.target.value)}
                  placeholder="e.g. Daily manual inspection logs maintained"
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExceptionModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingException}
                  className="px-5 py-2 font-bold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingException ? "Submitting..." : "Submit Exception Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* SUBMIT CAPA EVIDENCE MODAL */}
      {/* ============================================================================== */}
      {capaModalOpen && selectedCapa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#214ECF]" />
                Submit Corrective Evidence ({selectedCapa.capa_code})
              </h3>
              <button onClick={() => setCapaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCapaEvidenceSubmit} className="space-y-4 text-xs">
              <div>
                <span className="block font-bold text-slate-700">Issue: {selectedCapa.title}</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">{selectedCapa.issue_summary}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Resolution Document / Telemetry</label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCapaFile(e.target.files[0]);
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corrective Actions Executed</label>
                <textarea
                  rows={3}
                  value={capaNotes}
                  onChange={(e) => setCapaNotes(e.target.value)}
                  placeholder="Describe resolution implementation details and testing confirmation..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCapaModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCapaEvidence}
                  className="px-5 py-2 font-bold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingCapaEvidence ? "Submitting..." : "Submit Resolution for Sign-off"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* REPORT COMPLIANCE ISSUE / NEW CAPA MODAL */}
      {/* ============================================================================== */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Report Operational Compliance Issue
              </h3>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmittingReport(true);
                try {
                  const res = await api("/bpo/compliance/corrective-actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: issueTitle,
                      issueSummary,
                      rootCause: issueRootCause,
                      correctiveAction: issueActionRequired,
                      ownerName: issueOwner || "Frontline Team Lead",
                      priority: issuePriority,
                      targetDate: issueTargetDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
                    }),
                  });
                  if (res.ok) {
                    showToast("Compliance issue logged and CAPA created successfully", "success");
                    setReportModalOpen(false);
                    await loadData(true);
                  } else {
                    showToast("Failed to register compliance issue", "error");
                  }
                } catch (err) {
                  showToast("Network error submitting issue report", "error");
                } finally {
                  setSubmittingReport(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Title</label>
                <input
                  type="text"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="e.g. Temporary latency on backup CRM sync"
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Issue Summary</label>
                <textarea
                  rows={2}
                  value={issueSummary}
                  onChange={(e) => setIssueSummary(e.target.value)}
                  placeholder="Describe the operational standard affected..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proposed Corrective Action</label>
                <textarea
                  rows={2}
                  value={issueActionRequired}
                  onChange={(e) => setIssueActionRequired(e.target.value)}
                  placeholder="Steps to remediate and restore conformance..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsible Owner</label>
                  <input
                    type="text"
                    value={issueOwner}
                    onChange={(e) => setIssueOwner(e.target.value)}
                    placeholder="e.g. Operations Manager"
                    required
                    className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={issuePriority}
                    onChange={(e) => setIssuePriority(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingReport ? "Logging..." : "Log Issue & Create CAPA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
