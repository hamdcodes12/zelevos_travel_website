import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Clock,
  X,
  Send,
  Lock,
  Layers,
  FileCheck,
  FileText,
  AlertTriangle,
  Building,
  User,
  Calendar,
  Check,
  ChevronRight,
  TrendingUp,
  History,
  Eye,
} from "lucide-react";

interface Props {
  adminApi: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminOperationsCompliancePanel({ adminApi }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Core Datasets
  const [dashboardKpis, setDashboardKpis] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<
    "overview" | "pending_reviews" | "checks" | "exceptions" | "capa"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Partner Workspace Drawer
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerWorkspaceData, setPartnerWorkspaceData] = useState<any>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // Review Evidence Modal
  const [reviewCheckModalOpen, setReviewCheckModalOpen] = useState(false);
  const [checkToReview, setCheckToReview] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"verified" | "rejected" | "action_required">("verified");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Exception Review Modal
  const [reviewExceptionModalOpen, setReviewExceptionModalOpen] = useState(false);
  const [exceptionToReview, setExceptionToReview] = useState<any | null>(null);
  const [exceptionDecision, setExceptionDecision] = useState<"approved" | "rejected">("approved");
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [exceptionConditions, setExceptionConditions] = useState("");
  const [submittingExceptionReview, setSubmittingExceptionReview] = useState(false);

  // CAPA Review Modal
  const [reviewCapaModalOpen, setReviewCapaModalOpen] = useState(false);
  const [capaToReview, setCapaToReview] = useState<any | null>(null);
  const [capaDecision, setCapaDecision] = useState<"completed" | "rejected" | "reopened">("completed");
  const [capaReviewNotes, setCapaReviewNotes] = useState("");
  const [submittingCapaReview, setSubmittingCapaReview] = useState(false);

  // Issue New Checkpoint Modal
  const [issueCheckModalOpen, setIssueCheckModalOpen] = useState(false);
  const [newCheckForm, setNewCheckForm] = useState({
    partnerId: "",
    title: "",
    category: "Operational Standards",
    requirementDescription: "",
    priority: "high",
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });
  const [issuingCheck, setIssuingCheck] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(""), 4000);
  };

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, partRes, chkRes, expRes, capaRes] = await Promise.all([
        adminApi("/admin/bpo/compliance/dashboard"),
        adminApi("/admin/bpo/compliance/partners"),
        adminApi("/admin/bpo/compliance/checks"),
        adminApi("/admin/bpo/compliance/exceptions"),
        adminApi("/admin/bpo/compliance/corrective-actions"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setDashboardKpis(d.kpis);
      }
      if (partRes.ok) {
        const d = await partRes.json();
        setPartners(d.partners || []);
      }
      if (chkRes.ok) {
        const d = await chkRes.json();
        setChecks(d.checks || []);
      }
      if (expRes.ok) {
        const d = await expRes.json();
        setExceptions(d.exceptions || []);
      }
      if (capaRes.ok) {
        const d = await capaRes.json();
        setCapas(d.actions || []);
      }
    } catch (err) {
      console.error("Failed to load admin compliance data:", err);
      showToast("Failed to fetch compliance telemetry", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function openPartnerWorkspace(partnerId: string) {
    setSelectedPartnerId(partnerId);
    setWorkspaceLoading(true);
    try {
      const res = await adminApi(`/admin/bpo/compliance/partners/${partnerId}`);
      if (res.ok) {
        const d = await res.json();
        setPartnerWorkspaceData(d);
      }
    } catch (err) {
      console.error("Failed loading partner workspace:", err);
      showToast("Unable to load partner compliance dossier", "error");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleCheckReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkToReview) return;
    setSubmittingReview(true);
    try {
      const res = await adminApi(`/admin/bpo/compliance/checks/${checkToReview.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: reviewDecision,
          reviewNotes,
        }),
      });

      if (res.ok) {
        showToast(`Checkpoint ${checkToReview.check_code} successfully marked as ${reviewDecision}`, "success");
        setReviewCheckModalOpen(false);
        setCheckToReview(null);
        setReviewNotes("");
        await loadData(true);
        if (selectedPartnerId) await openPartnerWorkspace(selectedPartnerId);
      } else {
        const err = await res.json();
        showToast(err.error || "Review failed", "error");
      }
    } catch (err) {
      console.error("Check review error:", err);
      showToast("Network error submitting review decision", "error");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleExceptionReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exceptionToReview) return;
    setSubmittingExceptionReview(true);
    try {
      const res = await adminApi(`/admin/bpo/compliance/exceptions/${exceptionToReview.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: exceptionDecision,
          reviewNotes: exceptionNotes,
          conditions: exceptionConditions,
        }),
      });

      if (res.ok) {
        showToast(`Exception decision '${exceptionDecision}' recorded successfully`, "success");
        setReviewExceptionModalOpen(false);
        setExceptionToReview(null);
        setExceptionNotes("");
        setExceptionConditions("");
        await loadData(true);
        if (selectedPartnerId) await openPartnerWorkspace(selectedPartnerId);
      } else {
        const err = await res.json();
        showToast(err.error || "Exception review failed", "error");
      }
    } catch (err) {
      console.error("Exception review error:", err);
      showToast("Network error reviewing exception", "error");
    } finally {
      setSubmittingExceptionReview(false);
    }
  }

  async function handleCapaReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!capaToReview) return;
    setSubmittingCapaReview(true);
    try {
      const res = await adminApi(`/admin/bpo/compliance/corrective-actions/${capaToReview.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: capaDecision,
          notes: capaReviewNotes,
        }),
      });

      if (res.ok) {
        showToast(`CAPA resolution signed off as ${capaDecision}`, "success");
        setReviewCapaModalOpen(false);
        setCapaToReview(null);
        setCapaReviewNotes("");
        await loadData(true);
        if (selectedPartnerId) await openPartnerWorkspace(selectedPartnerId);
      } else {
        const err = await res.json();
        showToast(err.error || "CAPA sign-off failed", "error");
      }
    } catch (err) {
      console.error("CAPA review error:", err);
      showToast("Network error during CAPA review", "error");
    } finally {
      setSubmittingCapaReview(false);
    }
  }

  async function handleIssueCheckSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCheckForm.title || !newCheckForm.requirementDescription) {
      showToast("Title and requirement description are mandatory", "error");
      return;
    }
    setIssuingCheck(true);
    try {
      const res = await adminApi("/admin/bpo/compliance/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCheckForm),
      });

      if (res.ok) {
        showToast("New compliance requirement published and assigned", "success");
        setIssueCheckModalOpen(false);
        setNewCheckForm({
          partnerId: "",
          title: "",
          category: "Operational Standards",
          requirementDescription: "",
          priority: "high",
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        });
        await loadData(true);
      } else {
        showToast("Failed to issue compliance check", "error");
      }
    } catch (err) {
      console.error("Issue check error:", err);
      showToast("Network error publishing requirement", "error");
    } finally {
      setIssuingCheck(false);
    }
  }

  const pendingReviewsList = checks.filter(
    (c) => c.status === "under_review" || c.status === "submitted"
  );

  return (
    <div className="w-full bg-[#FFFFFF] min-h-screen text-[#0B1730] pb-24">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium ${
            toastType === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {toastType === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg("")} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#E3EAF5] bg-gradient-to-b from-[#F8FAFC] to-[#FFFFFF] px-6 py-8 sm:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0B1730] text-white tracking-wide uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5FA8FF]" /> ADMIN CONTROL CENTRE
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Risk Governance & Compliance Oversight
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1730] tracking-tight">
              Enterprise Compliance Control Centre
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              Global operational compliance management across all accredited BPO delivery partners. Authorize evidence, evaluate temporary exceptions, and oversee CAPA resolution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-[#E3EAF5] rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? "animate-spin text-[#214ECF]" : ""}`} />
              Refresh
            </button>

            <button
              onClick={() => setIssueCheckModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm shadow-[#214ECF]/20"
            >
              <Plus className="w-4 h-4" />
              Publish Requirement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-8 space-y-8">
        {/* ============================================================================== */}
        {/* GLOBAL KPIS */}
        {/* ============================================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Partners</span>
            <div className="text-2xl font-black text-[#0B1730] mt-1">{dashboardKpis?.total_partners ?? partners.length}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Compliant</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{dashboardKpis?.compliant_partners ?? 0}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-blue-600 uppercase">Partially Compliant</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{dashboardKpis?.partially_compliant_partners ?? 0}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-red-600 uppercase">Action Required</span>
            <div className="text-2xl font-black text-red-600 mt-1">{dashboardKpis?.action_required_partners ?? 0}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-blue-600 uppercase">Pending Reviews</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{dashboardKpis?.pending_reviews ?? pendingReviewsList.length}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-amber-600 uppercase">Active Exceptions</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{dashboardKpis?.active_exceptions ?? exceptions.filter((e) => e.status === "approved").length}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-indigo-600 uppercase">Open CAPA</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{dashboardKpis?.open_capas ?? capas.filter((c) => c.status !== "completed").length}</div>
          </div>
          <div className="bg-white border border-[#E3EAF5] rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-red-500 uppercase">Overdue Items</span>
            <div className="text-2xl font-black text-red-600 mt-1">{dashboardKpis?.overdue_items ?? 0}</div>
          </div>
        </div>

        {/* ============================================================================== */}
        {/* TABS */}
        {/* ============================================================================== */}
        <div className="border-b border-[#E3EAF5]">
          <nav className="flex space-x-6">
            {[
              { id: "overview", label: "Partner Compliance Overview", count: partners.length },
              { id: "pending_reviews", label: "Pending Evidence Reviews", count: pendingReviewsList.length },
              { id: "checks", label: "All Mandatory Checkpoints", count: checks.length },
              { id: "exceptions", label: "Exceptions Queue", count: exceptions.length },
              { id: "capa", label: "CAPA Remediation Oversight", count: capas.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-[#214ECF] text-[#214ECF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    activeTab === tab.id ? "bg-[#EEF5FF] text-[#214ECF]" : "bg-slate-100 text-slate-600"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ============================================================================== */}
        {/* TAB: PARTNER COMPLIANCE OVERVIEW */}
        {/* ============================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E3EAF5] rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-[#E3EAF5] text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">BPO Partner</th>
                      <th className="py-3.5 px-4">Centre ID</th>
                      <th className="py-3.5 px-4">Compliance Health</th>
                      <th className="py-3.5 px-4">Checkpoints</th>
                      <th className="py-3.5 px-4">Pending</th>
                      <th className="py-3.5 px-4">Exceptions</th>
                      <th className="py-3.5 px-4">Open CAPA</th>
                      <th className="py-3.5 px-4">Overdue</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3EAF5]">
                    {partners.map((p) => (
                      <tr key={p.partner_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-bold text-[#0B1730]">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-slate-400" />
                            {p.partner_name}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-600">
                          CTR-{String(p.centre_id).padStart(3, "0")}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-sm text-[#0B1730]">
                            {p.compliance_score_percent !== null ? `${p.compliance_score_percent}%` : "N/A"}
                          </div>
                          <div className="text-[11px] text-slate-500">{p.badge_message}</div>
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-slate-700">
                          {p.verified_count} / {p.checkpoints_count} Verified
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-blue-600">
                          {p.pending_count}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-amber-600">
                          {p.exceptions_count}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-indigo-600">
                          {p.open_capa_count}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-red-600">
                          {p.overdue_count}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === "COMPLIANT"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : p.status === "ACTION REQUIRED"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => void openPartnerWorkspace(p.partner_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#214ECF] bg-[#EEF5FF] hover:bg-[#214ECF]/10 rounded-lg transition-colors"
                          >
                            View Compliance
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB: PENDING REVIEWS QUEUE */}
        {/* ============================================================================== */}
        {activeTab === "pending_reviews" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0B1730]">Pending Evidence Review Queue</h3>
                <p className="text-xs text-slate-500">
                  Submissions requiring authorized human auditor sign-off before status certification
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                {pendingReviewsList.length} Pending
              </span>
            </div>

            {pendingReviewsList.length > 0 ? (
              <div className="space-y-4">
                {pendingReviewsList.map((check) => {
                  const latestVersion =
                    check.evidence_versions && check.evidence_versions.length > 0
                      ? check.evidence_versions[check.evidence_versions.length - 1]
                      : null;

                  return (
                    <div
                      key={check.id}
                      className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm hover:border-[#214ECF]/30 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#214ECF]">{check.check_code}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {check.category}
                          </span>
                          <span className="font-bold text-[#0B1730]">{check.title}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Partner ID: {check.partner_id?.slice(0, 8)}... (Centre #{check.centre_id})
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Requirement</span>
                          <p className="text-slate-800 font-medium mt-0.5">{check.requirement_description}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Latest Submission (v{latestVersion?.version || 1})</span>
                          <p className="text-slate-800 font-medium mt-0.5">{latestVersion?.notes || check.evidence_notes || "Document submitted"}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Evidence Document</span>
                          {check.evidence_url ? (
                            <a
                              href={check.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#214ECF] font-semibold hover:underline mt-1"
                            >
                              <FileText className="w-4 h-4" /> Open Verification Document
                            </a>
                          ) : (
                            <span className="text-slate-400">Notes provided only</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setCheckToReview(check);
                            setReviewDecision("rejected");
                            setReviewNotes("");
                            setReviewCheckModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                        >
                          Reject / Request Resubmission
                        </button>
                        <button
                          onClick={() => {
                            setCheckToReview(check);
                            setReviewDecision("verified");
                            setReviewNotes("Verified in accordance with Thinkatic compliance standards.");
                            setReviewCheckModalOpen(true);
                          }}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
                        >
                          Approve & Verify
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white border border-[#E3EAF5] rounded-2xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800">Review queue clear</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Zero pending compliance submissions awaiting review.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB: ALL MANDATORY CHECKPOINTS */}
        {/* ============================================================================== */}
        {activeTab === "checks" && (
          <div className="space-y-4">
            <div className="bg-white border border-[#E3EAF5] rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-[#E3EAF5] text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Requirement</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Priority</th>
                      <th className="py-3.5 px-4">Due Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3EAF5]">
                    {checks.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-mono text-xs font-bold text-[#214ECF]">{c.check_code}</td>
                        <td className="py-4 px-4 max-w-md">
                          <div className="font-bold text-[#0B1730]">{c.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{c.requirement_description}</div>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600">{c.category || "Standard"}</td>
                        <td className="py-4 px-4 text-xs font-bold uppercase">{c.priority}</td>
                        <td className="py-4 px-4 text-xs text-slate-600">{c.due_date || "Continuous"}</td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            c.status === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setCheckToReview(c);
                              setReviewDecision("verified");
                              setReviewNotes("");
                              setReviewCheckModalOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-[#214ECF] hover:bg-[#EEF5FF] rounded-lg transition-colors"
                          >
                            Review / Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB: EXCEPTIONS QUEUE */}
        {/* ============================================================================== */}
        {activeTab === "exceptions" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exceptions.map((exp) => (
                <div key={exp.id} className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#214ECF]">
                      EXP-{String(exp.id).padStart(5, "0")} · {exp.check_code}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      exp.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {exp.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{exp.reason}</p>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Valid until: {exp.valid_until || "Continuous"}</span>
                    {exp.status === "requested" || exp.status === "under_review" || exp.status === "pending" ? (
                      <button
                        onClick={() => {
                          setExceptionToReview(exp);
                          setExceptionDecision("approved");
                          setExceptionNotes("");
                          setExceptionConditions("");
                          setReviewExceptionModalOpen(true);
                        }}
                        className="px-3 py-1 text-xs font-bold text-white bg-[#214ECF] rounded-lg hover:bg-[#1a3fa8]"
                      >
                        Review Exception
                      </button>
                    ) : (
                      <span className="text-slate-400">Audited by: {exp.approved_by || "Admin"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB: CAPA REMEDIATION OVERSIGHT */}
        {/* ============================================================================== */}
        {activeTab === "capa" && (
          <div className="space-y-4">
            {capas.map((capa) => (
              <div key={capa.id} className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#214ECF]">{capa.capa_code}</span>
                    <span className="font-bold text-sm text-[#0B1730]">{capa.title}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    capa.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {capa.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Issue</span>
                    {capa.issue_summary}
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Corrective Action</span>
                    {capa.corrective_action}
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Owner & Target Date</span>
                    {capa.owner_name} · {capa.target_date || capa.due_date}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                  {capa.evidence_url && (
                    <a
                      href={capa.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#214ECF] font-semibold hover:underline"
                    >
                      View Resolution Evidence
                    </a>
                  )}
                  {capa.status !== "completed" && (
                    <button
                      onClick={() => {
                        setCapaToReview(capa);
                        setCapaDecision("completed");
                        setCapaReviewNotes("");
                        setReviewCapaModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      Sign-off & Complete CAPA
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* PARTNER COMPLIANCE WORKSPACE DRAWER */}
      {/* ============================================================================== */}
      {selectedPartnerId && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-[#0B1730]/40 backdrop-blur-xs"
            onClick={() => setSelectedPartnerId(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-3xl bg-white shadow-2xl border-l border-[#E3EAF5] flex flex-col justify-between">
              <div className="p-6 border-b border-[#E3EAF5] bg-[#F8FAFC] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#214ECF] uppercase tracking-wider">
                    Partner Compliance Workspace
                  </span>
                  <h2 className="text-xl font-extrabold text-[#0B1730] mt-1">
                    {partnerWorkspaceData?.partner?.partner_name || "Thinkatic Global BPO Services Ltd"}
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Centre ID: #{partnerWorkspaceData?.partner?.centre_id} · Partner ID: {selectedPartnerId}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPartnerId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Health banner */}
                <div className="p-4 rounded-xl bg-[#EEF5FF] border border-[#5FA8FF]/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Compliance Health</span>
                    <div className="text-2xl font-black text-[#0B1730]">
                      {partnerWorkspaceData?.health?.percentage ?? 85}%
                    </div>
                  </div>
                  <div className="text-xs text-right">
                    <span className="font-bold text-[#214ECF] block">
                      {partnerWorkspaceData?.health?.badge_message || "17 of 20 verified"}
                    </span>
                    <span className="text-slate-500">Status: {partnerWorkspaceData?.health?.status || "ACTION REQUIRED"}</span>
                  </div>
                </div>

                {/* Checkpoints in this partner */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Mandatory Checkpoints ({partnerWorkspaceData?.checks?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {(partnerWorkspaceData?.checks || []).map((c: any) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl border border-slate-100 bg-[#F8FAFC] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{c.check_code} — {c.title}</div>
                          <div className="text-[11px] text-slate-500">{c.category} · Priority: {c.priority}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            c.status === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                          <button
                            onClick={() => {
                              setCheckToReview(c);
                              setReviewDecision("verified");
                              setReviewNotes("");
                              setReviewCheckModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-[#214ECF] bg-white border border-[#E3EAF5] rounded-lg hover:bg-slate-50"
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#E3EAF5] bg-slate-50 flex justify-end">
                <button
                  onClick={() => setSelectedPartnerId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Close Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* REVIEW CHECKPOINT MODAL */}
      {/* ============================================================================== */}
      {reviewCheckModalOpen && checkToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#214ECF]" />
                Authorize Checkpoint Review ({checkToReview.check_code})
              </h3>
              <button onClick={() => setReviewCheckModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckReviewSubmit} className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 block">{checkToReview.title}</span>
                <span className="text-slate-500 block mt-0.5">{checkToReview.requirement_description}</span>
              </div>

              {checkToReview.evidence_url && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">Attached Evidence:</span>
                  <a
                    href={checkToReview.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#214ECF] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> View Evidence Artifact
                  </a>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Review Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision("verified")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                      reviewDecision === "verified"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Verify & Certify
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision("action_required")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                      reviewDecision === "action_required"
                        ? "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Action Required
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision("rejected")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                      reviewDecision === "rejected"
                        ? "bg-red-50 text-red-800 border-red-300 ring-2 ring-red-500/20"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Notes & Feedback</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide audit feedback or instructions for remediation..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewCheckModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 font-bold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingReview ? "Recording..." : "Record Official Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* REVIEW EXCEPTION MODAL */}
      {/* ============================================================================== */}
      {reviewExceptionModalOpen && exceptionToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Review Exception Request
              </h3>
              <button onClick={() => setReviewExceptionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExceptionReviewSubmit} className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 block">Target Checkpoint: {exceptionToReview.check_code}</span>
                <span className="text-slate-600 block mt-1">{exceptionToReview.reason}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExceptionDecision("approved")}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    exceptionDecision === "approved"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Approve Exception
                </button>
                <button
                  type="button"
                  onClick={() => setExceptionDecision("rejected")}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    exceptionDecision === "rejected"
                      ? "bg-red-50 text-red-800 border-red-300 ring-2 ring-red-500/20"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Reject Exception
                </button>
              </div>

              {exceptionDecision === "approved" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Approved Conditions</label>
                  <input
                    type="text"
                    value={exceptionConditions}
                    onChange={(e) => setExceptionConditions(e.target.value)}
                    placeholder="e.g. Daily manual inspection logs maintained"
                    className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reviewer Notes</label>
                <textarea
                  rows={2}
                  value={exceptionNotes}
                  onChange={(e) => setExceptionNotes(e.target.value)}
                  placeholder="Notes explaining approval or rejection basis..."
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewExceptionModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExceptionReview}
                  className="px-5 py-2 font-bold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingExceptionReview ? "Submitting..." : "Save Exception Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* REVIEW CAPA MODAL */}
      {/* ============================================================================== */}
      {reviewCapaModalOpen && capaToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                Sign-off CAPA Resolution ({capaToReview.capa_code})
              </h3>
              <button onClick={() => setReviewCapaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCapaReviewSubmit} className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 block">{capaToReview.title}</span>
                <span className="text-slate-500 block mt-0.5">{capaToReview.issue_summary}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sign-off Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCapaDecision("completed")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                      capaDecision === "completed"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Verify & Close CAPA
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapaDecision("reopened")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                      capaDecision === "reopened"
                        ? "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Reopen for Remediation
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Auditor Sign-off Notes</label>
                <textarea
                  rows={3}
                  value={capaReviewNotes}
                  onChange={(e) => setCapaReviewNotes(e.target.value)}
                  placeholder="Verification comments confirming resolution..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewCapaModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCapaReview}
                  className="px-5 py-2 font-bold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingCapaReview ? "Processing..." : "Complete Sign-off"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* PUBLISH REQUIREMENT MODAL */}
      {/* ============================================================================== */}
      {issueCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1730]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E3EAF5] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1730] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#214ECF]" />
                Publish Mandatory Compliance Checkpoint
              </h3>
              <button onClick={() => setIssueCheckModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueCheckSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target BPO Partner</label>
                <select
                  value={newCheckForm.partnerId}
                  onChange={(e) => setNewCheckForm({ ...newCheckForm, partnerId: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">All Accredited Partners (Global Standard)</option>
                  {partners.map((p) => (
                    <option key={p.partner_id} value={p.partner_id}>
                      {p.partner_name} (#{p.centre_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requirement Title</label>
                <input
                  type="text"
                  value={newCheckForm.title}
                  onChange={(e) => setNewCheckForm({ ...newCheckForm, title: e.target.value })}
                  placeholder="e.g. Bi-Annual ISO 27001 Surveillance Audit"
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCheckForm.category}
                    onChange={(e) => setNewCheckForm({ ...newCheckForm, category: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="Business Documentation">Business Documentation</option>
                    <option value="Centre Verification">Centre Verification</option>
                    <option value="Legal & Agreement">Legal & Agreement</option>
                    <option value="Security">Security</option>
                    <option value="Data/Privacy">Data/Privacy</option>
                    <option value="Training">Training</option>
                    <option value="Quality">Quality</option>
                    <option value="Operations">Operations</option>
                    <option value="Project Requirements">Project Requirements</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newCheckForm.priority}
                    onChange={(e) => setNewCheckForm({ ...newCheckForm, priority: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requirement Specification</label>
                <textarea
                  rows={3}
                  value={newCheckForm.requirementDescription}
                  onChange={(e) => setNewCheckForm({ ...newCheckForm, requirementDescription: e.target.value })}
                  placeholder="Specify exact documentation, process adherence, or technical proofs required..."
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newCheckForm.dueDate}
                  onChange={(e) => setNewCheckForm({ ...newCheckForm, dueDate: e.target.value })}
                  required
                  className="w-full p-2.5 bg-white border border-[#E3EAF5] rounded-xl text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIssueCheckModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuingCheck}
                  className="px-5 py-2 font-bold text-white bg-[#214ECF] hover:bg-[#1a3fa8] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {issuingCheck ? "Publishing..." : "Publish Requirement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
