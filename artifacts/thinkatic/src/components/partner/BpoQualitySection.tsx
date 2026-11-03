import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  RefreshCw,
  Search,
  Filter,
  MessageSquare,
  HelpCircle,
  X,
  Send,
  Award,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronDown,
  Layers,
  Check,
  Calendar,
  PhoneCall,
  Mail,
  Ticket,
  Briefcase,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Sliders,
  Plus,
  BarChart3,
  ExternalLink,
  History as HistoryIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

// ── TYPES ───────────────────────────────────────────────────────────────────

interface QACriterion {
  id: string;
  name: string;
  category: string;
  weight: number;
  max_score: number;
  description: string;
}

interface Scorecard {
  id: number;
  name: string;
  project_id?: number | null;
  process_type: string;
  passing_threshold: number;
  criteria: QACriterion[];
  is_active: boolean;
}

interface Defect {
  category: string;
  severity: "critical" | "major" | "minor";
  description: string;
  rule?: string;
}

interface Evaluation {
  id: number;
  scorecard_id: number;
  scorecard_name: string;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  centre_id: number;
  partner_id: string;
  project_id: number;
  project_name: string;
  campaign_name?: string;
  channel?: string;
  interaction_reference: string;
  evaluation_date: string;
  criteria_scores: Record<string, number>;
  total_score: number;
  passed: boolean;
  failure_reason?: string;
  defects: Defect[];
  evaluator_feedback: string;
  internal_notes?: string | null;
  status: "completed" | "dispute_requested" | "revised";
  evaluated_by: string;
  calibrations?: Array<{
    id: number;
    original_score: number;
    calibration_score: number;
    variance: number;
    calibrator: string;
    notes?: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface Dispute {
  id: number;
  evaluation_id: number;
  agent_id: number;
  agent_name?: string;
  agent_code?: string;
  interaction_reference?: string;
  scorecard_name?: string;
  original_score?: number;
  partner_id: string;
  centre_id: number;
  dispute_reason: string;
  status: "pending" | "under_review" | "calibration" | "upheld" | "modified" | "rejected" | "open" | "resolved";
  resolution_notes?: string | null;
  adjusted_score?: number | null;
  resolved_at?: string | null;
  created_at: string;
}

interface Calibration {
  id: number;
  evaluation_id: number;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  partner_id: string;
  interaction_reference: string;
  original_score: number;
  calibration_score: number;
  variance: number;
  evaluator_name: string;
  calibrator_name: string;
  status: "completed" | "flagged";
  notes: string;
  created_at: string;
}

interface AgentCard {
  agent_id: number;
  agent_name: string;
  agent_code: string;
  designation: string;
  department: string;
  centre_id: number;
  centre_name: string;
  project_name: string;
  campaign_name: string;
  quality_score: number | null;
  pass_rate: number | null;
  audits_count: number;
  critical_defects_count: number;
  open_disputes_count: number;
  trend: "up" | "down" | "neutral" | null;
  trend_delta: number;
  historical_scores: Array<{ date: string; score: number; passed?: boolean }>;
  last_audit_date: string | null;
}

interface QualitySummary {
  total_audits: number;
  mean_quality_score: number | null;
  pass_rate_percent: number | null;
  pass_count: number;
  fail_count: number;
  active_disputes: number;
  agents_audited: number;
  critical_defects: number;
  trend_direction: "up" | "down" | "neutral" | null;
  defect_breakdown: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
}

interface AgentDetailPayload {
  agent: {
    id: number;
    name: string;
    agent_code: string;
    designation: string;
    department: string;
    centre_id: number;
    centre_name: string;
    project_name: string;
    campaign_name: string;
  };
  metrics: {
    current_quality_score: number | null;
    avg_30d: number | null;
    avg_90d: number | null;
    overall_avg: number | null;
    pass_rate: number | null;
    total_audits: number;
    critical_defects: number;
    major_defects: number;
    minor_defects: number;
    open_disputes: number;
    resolved_disputes: number;
    total_calibrations: number;
    last_audit_date: string | null;
  };
  evaluations: Evaluation[];
  scorecards_performance: Array<{
    criterion_id: string;
    name: string;
    category: string;
    weight: number;
    performance_percent: number;
    evaluations_counted: number;
  }>;
  defects: Array<{
    audit_id: number;
    interaction_reference: string;
    date: string;
    category: string;
    severity: string;
    description: string;
    rule?: string;
  }>;
  disputes: Dispute[];
  calibrations: Calibration[];
  history: Array<{
    id: string;
    type: string;
    date: string;
    title: string;
    description: string;
    badge: string;
    badge_color: string;
    timestamp: string;
  }>;
  trend_series: Array<{
    date: string;
    score: number;
    passed: boolean;
    reference: string;
  }>;
  pass_fail_distribution: {
    passed: number;
    failed: number;
  };
  defect_distribution: {
    critical: number;
    major: number;
    minor: number;
    categories: Record<string, number>;
  };
}

interface Props {
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

// ── COMPONENT ───────────────────────────────────────────────────────────────

export default function BpoQualitySection({ api }: Props) {
  // Main states
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<QualitySummary>({
    total_audits: 0,
    mean_quality_score: null,
    pass_rate_percent: null,
    pass_count: 0,
    fail_count: 0,
    active_disputes: 0,
    agents_audited: 0,
    critical_defects: 0,
    trend_direction: null,
    defect_breakdown: { critical: 0, major: 0, minor: 0, total: 0 },
  });
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);

  // Navigation tabs in main section
  const [activeMainTab, setActiveMainTab] = useState<"agents" | "evaluations" | "disputes" | "calibration" | "flow">("agents");

  // Trend chart time filter
  const [trendRange, setTrendRange] = useState<"7d" | "30d" | "90d" | "6m">("30d");

  // Search & Filter for Evaluations Feed
  const [evalSearchQuery, setEvalSearchQuery] = useState("");
  const [evalStatusFilter, setEvalStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [evalChannelFilter, setEvalChannelFilter] = useState<string>("all");
  const [evalCriticalOnly, setEvalCriticalOnly] = useState<boolean>(false);
  const [evalPaginationPage, setEvalPaginationPage] = useState(1);
  const evalPageSize = 8;

  // Search for Agents
  const [agentSearchQuery, setAgentSearchQuery] = useState("");

  // Agent Detail Drawer State
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [agentDetail, setAgentDetail] = useState<AgentDetailPayload | null>(null);
  const [loadingAgentDetail, setLoadingAgentDetail] = useState(false);
  const [agentDrawerTab, setAgentDrawerTab] = useState<"overview" | "evaluations" | "scorecard" | "defects" | "disputes" | "calibration" | "history">("overview");

  // New Quality Audit Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [newAuditForm, setNewAuditForm] = useState<{
    agentId: string;
    scorecardId: string;
    channel: string;
    interactionReference: string;
    evaluationDate: string;
    campaignName: string;
    criteriaScores: Record<string, number>;
    criticalDefects: string[];
    evaluatorFeedback: string;
  }>({
    agentId: "",
    scorecardId: "",
    channel: "Voice",
    interactionReference: "",
    evaluationDate: new Date().toISOString().slice(0, 10),
    campaignName: "North American Telehealth Patient Support",
    criteriaScores: {},
    criticalDefects: [],
    evaluatorFeedback: "",
  });
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Single Evaluation Detail Modal
  const [selectedEvalDetail, setSelectedEvalDetail] = useState<Evaluation | null>(null);

  // Dispute Modal State
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTargetEval, setDisputeTargetEval] = useState<Evaluation | null>(null);
  const [disputeReason, setDisputeReason] = useState("Scoring discrepancy on compliance verification");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Calibrate Modal State
  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false);
  const [calibrateTargetEval, setCalibrateTargetEval] = useState<Evaluation | null>(null);
  const [calibrateScoreInput, setCalibrateScoreInput] = useState<string>("88");
  const [calibrateNotes, setCalibrateNotes] = useState("");
  const [submittingCalibration, setSubmittingCalibration] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState("");
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4500);
  };

  // ── DATA LOADING ──────────────────────────────────────────────────────────

  async function loadAllData() {
    setLoading(true);
    try {
      const [sumRes, agentsRes, evalRes, dispRes, calibRes, scRes] = await Promise.all([
        api("/bpo/qa/summary"),
        api("/bpo/qa/agents"),
        api("/bpo/qa/evaluations"),
        api("/bpo/qa/disputes"),
        api("/bpo/qa/calibrations"),
        api("/bpo/qa/scorecards"),
      ]);

      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d);
      }
      if (agentsRes.ok) {
        const d = await agentsRes.json();
        setAgents(d.agents || []);
      }
      if (evalRes.ok) {
        const d = await evalRes.json();
        setEvaluations(d.evaluations || []);
      }
      if (dispRes.ok) {
        const d = await dispRes.json();
        setDisputes(d.disputes || []);
      }
      if (calibRes.ok) {
        const d = await calibRes.json();
        setCalibrations(d.calibrations || []);
      }
      if (scRes.ok) {
        const d = await scRes.json();
        setScorecards(d || []);
        if (d && d.length > 0 && !newAuditForm.scorecardId) {
          setNewAuditForm((prev) => ({ ...prev, scorecardId: String(d[0].id) }));
        }
      }
    } catch (err) {
      console.error("Failed to load QA data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  // Load single agent details when drawer opens
  async function loadAgentQualityDetail(agentId: number) {
    setSelectedAgentId(agentId);
    setLoadingAgentDetail(true);
    setAgentDrawerTab("overview");
    try {
      const res = await api(`/bpo/qa/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgentDetail(data);
      }
    } catch (err) {
      console.error("Failed to load agent detail:", err);
    } finally {
      setLoadingAgentDetail(false);
    }
  }

  // Active selected scorecard in modal
  const selectedModalScorecard = useMemo(() => {
    return scorecards.find((s) => String(s.id) === String(newAuditForm.scorecardId)) || scorecards[0];
  }, [scorecards, newAuditForm.scorecardId]);

  // Client-side provisional score calculation preview for New Audit modal
  const provisionalCalculatedScore = useMemo(() => {
    if (!selectedModalScorecard || !selectedModalScorecard.criteria) return 0;
    let weightedSum = 0;
    let totalWeight = 0;
    for (const crit of selectedModalScorecard.criteria) {
      const raw = newAuditForm.criteriaScores[crit.id] !== undefined ? Number(newAuditForm.criteriaScores[crit.id]) : 0;
      const clamped = Math.min(crit.max_score, Math.max(0, raw));
      weightedSum += (clamped / crit.max_score) * crit.weight;
      totalWeight += crit.weight;
    }
    return totalWeight > 0 ? Number(((weightedSum / totalWeight) * 100).toFixed(1)) : 0;
  }, [selectedModalScorecard, newAuditForm.criteriaScores]);

  // ── AUDIT SUBMISSION ──────────────────────────────────────────────────────

  async function handleAuditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newAuditForm.agentId) {
      alert("Please select a frontline agent to evaluate.");
      return;
    }
    if (!newAuditForm.interactionReference.trim()) {
      alert("Please provide an Interaction Reference (Call ID, Ticket ID, or Chat ID).");
      return;
    }

    setSubmittingAudit(true);
    try {
      const res = await api("/bpo/qa/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: Number(newAuditForm.agentId),
          scorecardId: Number(newAuditForm.scorecardId),
          channel: newAuditForm.channel,
          campaignName: newAuditForm.campaignName,
          interactionReference: newAuditForm.interactionReference.trim(),
          evaluationDate: newAuditForm.evaluationDate,
          criteriaScores: newAuditForm.criteriaScores,
          criticalDefectFlags: newAuditForm.criticalDefects,
          evaluatorFeedback: newAuditForm.evaluatorFeedback.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit evaluation");

      showToast(`Audit completed! Final verified score: ${data.evaluation.total_score}% (${data.evaluation.passed ? "PASS" : "FAIL"}).`);
      setAuditModalOpen(false);

      // Reset form
      setNewAuditForm({
        agentId: "",
        scorecardId: scorecards[0] ? String(scorecards[0].id) : "",
        channel: "Voice",
        interactionReference: "",
        evaluationDate: new Date().toISOString().slice(0, 10),
        campaignName: "North American Telehealth Patient Support",
        criteriaScores: {},
        criticalDefects: [],
        evaluatorFeedback: "",
      });

      // Reload
      await loadAllData();
      if (selectedAgentId) {
        await loadAgentQualityDetail(selectedAgentId);
      }
    } catch (err: any) {
      alert(err.message || "Failed to create audit.");
    } finally {
      setSubmittingAudit(false);
    }
  }

  // ── DISPUTE SUBMISSION ────────────────────────────────────────────────────

  async function handleDisputeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!disputeTargetEval) return;
    if (disputeDescription.trim().length < 10) {
      alert("Please enter a detailed dispute reason with at least 10 characters.");
      return;
    }

    setSubmittingDispute(true);
    try {
      const res = await api(`/bpo/qa/evaluations/${disputeTargetEval.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: `${disputeReason}: ${disputeDescription.trim()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register dispute");

      showToast("Quality dispute registered. Escalated to Master QA lead for re-audit.");
      setDisputeModalOpen(false);
      setDisputeDescription("");
      await loadAllData();
      if (selectedAgentId) await loadAgentQualityDetail(selectedAgentId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingDispute(false);
    }
  }

  // ── CALIBRATION SUBMISSION ────────────────────────────────────────────────

  async function handleCalibrationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!calibrateTargetEval) return;
    const scoreVal = Number(calibrateScoreInput);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      alert("Please enter a valid calibration score between 0 and 100.");
      return;
    }

    setSubmittingCalibration(true);
    try {
      const res = await api(`/bpo/qa/evaluations/${calibrateTargetEval.id}/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calibrationScore: scoreVal,
          notes: calibrateNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record calibration");

      showToast(`Calibration review recorded. Variance: ${data.calibration.variance > 0 ? "+" : ""}${data.calibration.variance}%.`);
      setCalibrateModalOpen(false);
      setCalibrateNotes("");
      await loadAllData();
      if (selectedAgentId) await loadAgentQualityDetail(selectedAgentId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingCalibration(false);
    }
  }

  // ── FILTERED DATA ─────────────────────────────────────────────────────────

  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery.trim()) return agents;
    const q = agentSearchQuery.toLowerCase().trim();
    return agents.filter(
      (a) =>
        a.agent_name.toLowerCase().includes(q) ||
        a.agent_code.toLowerCase().includes(q) ||
        a.designation.toLowerCase().includes(q) ||
        a.campaign_name.toLowerCase().includes(q)
    );
  }, [agents, agentSearchQuery]);

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((ev) => {
      const matchesSearch =
        !evalSearchQuery.trim() ||
        ev.agent_name.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
        ev.agent_code.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
        ev.interaction_reference.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
        ev.scorecard_name.toLowerCase().includes(evalSearchQuery.toLowerCase());

      const matchesStatus =
        evalStatusFilter === "all" ||
        (evalStatusFilter === "passed" && ev.passed) ||
        (evalStatusFilter === "failed" && !ev.passed);

      const matchesChannel =
        evalChannelFilter === "all" ||
        (ev.channel || "voice").toLowerCase() === evalChannelFilter.toLowerCase();

      const matchesCritical =
        !evalCriticalOnly || (Array.isArray(ev.defects) && ev.defects.some((d) => d.severity === "critical"));

      return matchesSearch && matchesStatus && matchesChannel && matchesCritical;
    });
  }, [evaluations, evalSearchQuery, evalStatusFilter, evalChannelFilter, evalCriticalOnly]);

  const paginatedEvaluations = useMemo(() => {
    const start = (evalPaginationPage - 1) * evalPageSize;
    return filteredEvaluations.slice(start, start + evalPageSize);
  }, [filteredEvaluations, evalPaginationPage]);

  const totalPages = Math.ceil(filteredEvaluations.length / evalPageSize) || 1;

  // Chart data: overall quality trend over time
  const overallTrendChartData = useMemo(() => {
    if (evaluations.length === 0) return [];
    const sorted = [...evaluations].sort((a, b) => new Date(a.evaluation_date).getTime() - new Date(b.evaluation_date).getTime());
    // Group by date
    const dateMap: Record<string, { total: number; count: number }> = {};
    for (const ev of sorted) {
      if (!dateMap[ev.evaluation_date]) {
        dateMap[ev.evaluation_date] = { total: 0, count: 0 };
      }
      dateMap[ev.evaluation_date].total += Number(ev.total_score);
      dateMap[ev.evaluation_date].count += 1;
    }
    return Object.entries(dateMap).map(([date, d]) => ({
      date: date.slice(5), // MM-DD
      avgScore: Number((d.total / d.count).toFixed(1)),
      audits: d.count,
    }));
  }, [evaluations]);

  // Donut chart data for Pass / Fail distribution
  const passFailChartData = useMemo(() => {
    if (summary.total_audits === 0) return [];
    return [
      { name: "Passed", value: summary.pass_count, color: "#16A34A" },
      { name: "Failed", value: summary.fail_count, color: "#DC2626" },
    ];
  }, [summary]);

  return (
    <div className="space-y-7 pb-12 font-sans text-slate-800">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-xs font-bold text-white shadow-2xl transition-all border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white p-7 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-bold text-[#214ECF]">
              <ShieldCheck size={13} className="text-[#214ECF]" />
              Enterprise QA & Calibration Control
            </span>
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-400">• Standardized Scorecards</span>
          </div>
          <h1 className="mt-2.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Agent Quality Assurance
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl font-normal leading-relaxed">
            Review agent interactions, score quality using standardized scorecards, track defects, manage disputes and monitor quality trends.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => void loadAllData()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50"
            title="Refresh quality metrics from Supabase database"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#214ECF]" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              if (agents.length > 0 && !newAuditForm.agentId) {
                setNewAuditForm((prev) => ({ ...prev, agentId: String(agents[0].agent_id) }));
              }
              setAuditModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#214ECF] px-4.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1b40ab] active:scale-98 transition"
          >
            <Plus size={15} />
            <span>New Quality Audit</span>
          </button>
        </div>
      </div>

      {/* Top 6 KPI Cards (100% Real Database Connected - No fake 100%) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* KPI 1: Mean Quality Score */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-[#214ECF]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mean Quality Score</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#214ECF]">
              <Award size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl sm:text-3xl font-black text-slate-900">
              {summary.mean_quality_score !== null ? `${summary.mean_quality_score}%` : "N/A"}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 truncate">
              {summary.total_audits > 0 ? "Across all completed audits" : "No evaluations yet"}
            </p>
          </div>
        </div>

        {/* KPI 2: Pass Rate */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-xs transition hover:border-emerald-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Pass Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl sm:text-3xl font-black text-emerald-950">
              {summary.pass_rate_percent !== null ? `${summary.pass_rate_percent}%` : "N/A"}
            </p>
            <p className="mt-1 text-[11px] font-medium text-emerald-700 truncate">
              {summary.total_audits > 0 ? `${summary.pass_count} of ${summary.total_audits} passed` : "Zero audits logged"}
            </p>
          </div>
        </div>

        {/* KPI 3: Total Audits */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-blue-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Audits</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{summary.total_audits}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 truncate">Completed evaluations</p>
          </div>
        </div>

        {/* KPI 4: Active Disputes */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 shadow-xs transition hover:border-amber-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Active Disputes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl sm:text-3xl font-black text-amber-950">{summary.active_disputes}</p>
            <p className="mt-1 text-[11px] font-medium text-amber-700 truncate">In review or calibration</p>
          </div>
        </div>

        {/* KPI 5: Agents Audited */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-indigo-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Agents Audited</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{summary.agents_audited}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 truncate">Frontline staff evaluated</p>
          </div>
        </div>

        {/* KPI 6: Critical Defects */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-5 shadow-xs transition hover:border-rose-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Critical Defects</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl sm:text-3xl font-black text-rose-950">{summary.critical_defects}</p>
            <p className="mt-1 text-[11px] font-medium text-rose-700 truncate">Auto-fail infractions</p>
          </div>
        </div>
      </div>

      {/* Analytics: Quality Trend & Pass/Fail Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trend Area Chart (2/3 width) */}
        <div className="lg:col-span-2 rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-[#214ECF]" />
                Quality Performance Trend
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Chronological score trajectory across all audited interactions</p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              {(["7d", "30d", "90d", "6m"] as const).map((rng) => (
                <button
                  key={rng}
                  onClick={() => setTrendRange(rng)}
                  className={`px-3 py-1 rounded-lg transition ${
                    trendRange === rng ? "bg-white text-slate-900 shadow-2xs" : "hover:text-slate-900"
                  }`}
                >
                  {rng === "7d" ? "7 Days" : rng === "30d" ? "30 Days" : rng === "90d" ? "90 Days" : "6 Months"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 h-64 w-full">
            {overallTrendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overallTrendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qaTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#214ECF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#214ECF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={{ stroke: "#E2E8F0" }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={{ stroke: "#E2E8F0" }} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                            <p className="font-bold text-slate-900">Date: {data.date}</p>
                            <p className="text-[#214ECF] font-bold mt-1">Average Score: {data.avgScore}%</p>
                            <p className="text-slate-500 font-medium">{data.audits} audits on this day</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#214ECF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#qaTrendGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileText size={32} className="text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-500">No historical quality data available.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Complete quality audits to view the trendline.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pass / Fail Donut & Defects (1/3 width) */}
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Audit Outcomes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Pass/fail adherence & defect classifications</p>
            </div>

            <div className="mt-4 flex items-center justify-center h-44">
              {summary.total_audits > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passFailChartData}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {passFailChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-slate-400">No audits to display</div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Passed Audits
              </span>
              <span className="font-extrabold text-slate-900">{summary.pass_count} ({summary.pass_rate_percent || 0}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Failed Audits
              </span>
              <span className="font-extrabold text-slate-900">{summary.fail_count}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-2 font-bold text-rose-700">
                <AlertTriangle size={12} className="text-rose-600" /> Critical Infractions
              </span>
              <span className="font-extrabold text-rose-700">{summary.critical_defects}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveMainTab("agents")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeMainTab === "agents"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Users size={14} />
          Agent Quality Profiles ({agents.length})
        </button>

        <button
          onClick={() => setActiveMainTab("evaluations")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeMainTab === "evaluations"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <FileText size={14} />
          Evaluations Feed ({evaluations.length})
        </button>

        <button
          onClick={() => setActiveMainTab("disputes")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeMainTab === "disputes"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <MessageSquare size={14} />
          Dispute Resolution ({disputes.length})
        </button>

        <button
          onClick={() => setActiveMainTab("calibration")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeMainTab === "calibration"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Sliders size={14} />
          Calibration & Variance ({calibrations.length})
        </button>

        <button
          onClick={() => setActiveMainTab("flow")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeMainTab === "flow"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Layers size={14} />
          QA Pipeline Flow
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: AGENT QUALITY CARDS (Dedicated Individual Agent Profiles)    */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeMainTab === "agents" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-[#214ECF]" />
                Agent Quality Profiles
              </h2>
              <p className="text-xs text-slate-500">
                Individual agent quality history, pass rates, defect counts, and longitudinal trends.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search agent name, ID (e.g. THK-AGT-00104)..."
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs font-medium outline-none focus:border-[#214ECF] shadow-2xs"
              />
            </div>
          </div>

          {filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.agent_id}
                  className="flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-mono font-bold text-[#214ECF]">
                            {agent.agent_code}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
                            {agent.designation}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-base font-black text-slate-900 group-hover:text-[#214ECF] transition">
                          {agent.agent_name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate max-w-[240px]">
                          {agent.campaign_name}
                        </p>
                      </div>

                      {/* Score Badge */}
                      <div className="text-right">
                        <span
                          className={`inline-block text-2xl font-black ${
                            agent.quality_score !== null
                              ? agent.quality_score >= 85
                                ? "text-emerald-600"
                                : agent.quality_score >= 75
                                ? "text-amber-600"
                                : "text-rose-600"
                              : "text-slate-400"
                          }`}
                        >
                          {agent.quality_score !== null ? `${agent.quality_score}%` : "N/A"}
                        </span>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Score</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 py-4 text-center">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs font-black text-slate-900">
                          {agent.pass_rate !== null ? `${agent.pass_rate}%` : "N/A"}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">Pass Rate</p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs font-black text-slate-900">{agent.audits_count}</p>
                        <p className="text-[10px] font-semibold text-slate-400">Audits</p>
                      </div>

                      <div className={`rounded-xl p-2.5 ${agent.critical_defects_count > 0 ? "bg-rose-50 text-rose-900" : "bg-slate-50"}`}>
                        <p className={`text-xs font-black ${agent.critical_defects_count > 0 ? "text-rose-700" : "text-slate-900"}`}>
                          {agent.critical_defects_count}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">Critical</p>
                      </div>
                    </div>

                    {/* Mini Sparkline Curve representing real trend */}
                    <div className="pt-2 pb-4">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                        <span>Quality Trend</span>
                        {agent.trend === "up" && (
                          <span className="flex items-center gap-1 text-emerald-600 font-extrabold text-[10px]">
                            <TrendingUp size={12} /> ↑ +{agent.trend_delta}%
                          </span>
                        )}
                        {agent.trend === "down" && (
                          <span className="flex items-center gap-1 text-rose-600 font-extrabold text-[10px]">
                            <TrendingDown size={12} /> ↓ {agent.trend_delta}%
                          </span>
                        )}
                        {agent.trend === "neutral" && (
                          <span className="flex items-center gap-1 text-slate-500 font-bold text-[10px]">
                            <Minus size={12} /> Steady
                          </span>
                        )}
                        {agent.trend === null && <span className="text-[10px] text-slate-400">No data</span>}
                      </div>

                      {agent.historical_scores.length > 0 ? (
                        <div className="h-10 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={agent.historical_scores} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                              <Area
                                type="monotone"
                                dataKey="score"
                                stroke={agent.trend === "down" ? "#DC2626" : "#214ECF"}
                                strokeWidth={2}
                                fillOpacity={0.15}
                                fill={agent.trend === "down" ? "#DC2626" : "#214ECF"}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-10 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 rounded-lg">
                          No historical audits yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {agent.last_audit_date ? `Last: ${agent.last_audit_date}` : "Not audited"}
                    </span>
                    <button
                      onClick={() => void loadAgentQualityDetail(agent.agent_id)}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-[#214ECF] transition active:scale-98"
                    >
                      <span>View Agent Quality</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
              <Users size={36} className="text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No agents matched your search</h3>
              <p className="text-xs text-slate-500 mt-1">Try searching by a different name or agent code.</p>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: EVALUATIONS FEED TABLE                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeMainTab === "evaluations" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
              <div className="relative w-full lg:w-96">
                <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search agent, scorecard, or call reference..."
                  value={evalSearchQuery}
                  onChange={(e) => {
                    setEvalSearchQuery(e.target.value);
                    setEvalPaginationPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs font-medium outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold">Result:</span>
                  <select
                    value={evalStatusFilter}
                    onChange={(e) => {
                      setEvalStatusFilter(e.target.value as any);
                      setEvalPaginationPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
                  >
                    <option value="all">All Results</option>
                    <option value="passed">Passed Only</option>
                    <option value="failed">Failed Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold">Channel:</span>
                  <select
                    value={evalChannelFilter}
                    onChange={(e) => {
                      setEvalChannelFilter(e.target.value);
                      setEvalPaginationPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
                  >
                    <option value="all">All Channels</option>
                    <option value="voice">Voice</option>
                    <option value="chat">Chat</option>
                    <option value="email">Email</option>
                    <option value="ticket">Ticket</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-rose-700 font-bold select-none">
                  <input
                    type="checkbox"
                    checked={evalCriticalOnly}
                    onChange={(e) => {
                      setEvalCriticalOnly(e.target.checked);
                      setEvalPaginationPage(1);
                    }}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Critical Only</span>
                </label>
              </div>
            </div>

            {/* Table */}
            {paginatedEvaluations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Audit ID</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Agent</th>
                      <th className="py-3 px-3">Interaction Ref</th>
                      <th className="py-3 px-3">Channel</th>
                      <th className="py-3 px-3">Scorecard</th>
                      <th className="py-3 px-3 text-center">Score</th>
                      <th className="py-3 px-3 text-center">Result</th>
                      <th className="py-3 px-3 text-center">Defect</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEvaluations.map((ev) => {
                      const hasCritical = Array.isArray(ev.defects) && ev.defects.some((d) => d.severity === "critical");
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50/80 transition group">
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                            QA-{String(ev.id).padStart(6, "0")}
                          </td>
                          <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                            {ev.evaluation_date}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">{ev.agent_name}</span>
                            <span className="font-mono text-[10px] text-slate-400">{ev.agent_code}</span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {ev.interaction_reference}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                              {ev.channel || "Voice"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 max-w-[160px] truncate" title={ev.scorecard_name}>
                            {ev.scorecard_name}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`font-black text-sm ${
                                ev.total_score >= 85
                                  ? "text-emerald-700"
                                  : ev.total_score >= 70
                                  ? "text-amber-700"
                                  : "text-rose-700"
                              }`}
                            >
                              {ev.total_score}%
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                ev.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {ev.passed ? "PASS" : "FAIL"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {hasCritical ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                <AlertTriangle size={11} className="text-rose-600" />
                                Critical
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setSelectedEvalDetail(ev)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setDisputeTargetEval(ev);
                                setDisputeDescription("");
                                setDisputeModalOpen(true);
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 transition"
                            >
                              Dispute
                            </button>
                            <button
                              onClick={() => {
                                setCalibrateTargetEval(ev);
                                setCalibrateScoreInput(String(ev.total_score));
                                setCalibrateNotes("");
                                setCalibrateModalOpen(true);
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 transition"
                            >
                              Calibrate
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">No evaluations found</p>
                <p className="text-xs text-slate-400 mt-1">Try changing your search or result filters.</p>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredEvaluations.length > evalPageSize && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                <span>
                  Showing {(evalPaginationPage - 1) * evalPageSize + 1} to{" "}
                  {Math.min(evalPaginationPage * evalPageSize, filteredEvaluations.length)} of {filteredEvaluations.length} evaluations
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={evalPaginationPage === 1}
                    onClick={() => setEvalPaginationPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-bold text-slate-900">
                    {evalPaginationPage} / {totalPages}
                  </span>
                  <button
                    disabled={evalPaginationPage >= totalPages}
                    onClick={() => setEvalPaginationPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: DISPUTE RESOLUTION                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeMainTab === "disputes" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <MessageSquare size={20} className="text-amber-600" />
                Quality Dispute Resolution
              </h2>
              <p className="text-xs text-slate-500">
                Review and track frontline appeals against QA scoring. Original evaluation records are preserved.
              </p>
            </div>

            {disputes.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {disputes.map((disp) => (
                  <div key={disp.id} className="py-4.5 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          DISP-{String(disp.id).padStart(5, "0")}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">• Ref: {disp.interaction_reference || `Audit #${disp.evaluation_id}`}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            disp.status === "upheld" || disp.status === "resolved"
                              ? "bg-purple-100 text-purple-800"
                              : disp.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {disp.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        {disp.agent_name ? `${disp.agent_name} (${disp.agent_code})` : `Agent #${disp.agent_id}`}
                      </p>
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        "{disp.dispute_reason}"
                      </p>
                      {disp.resolution_notes && (
                        <div className="text-xs text-purple-900 bg-purple-50/70 p-3 rounded-xl border border-purple-200">
                          <span className="font-bold">Resolution Note:</span> {disp.resolution_notes}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Raised: {disp.created_at.slice(0, 10)}
                      </span>
                      {disp.original_score !== undefined && (
                        <span className="text-xs font-bold text-slate-600 block mt-1">
                          Original Score: {disp.original_score}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">No active disputes</p>
                <p className="text-xs text-slate-400 mt-1">All quality evaluations are currently uncontested.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: CALIBRATION & VARIANCE                                      */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeMainTab === "calibration" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Variance Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Average Variance</span>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-blue-950">
                {calibrations.length > 0
                  ? `±${(calibrations.reduce((a, b) => a + Math.abs(b.variance), 0) / calibrations.length).toFixed(1)}%`
                  : "0.0%"}
              </p>
              <p className="mt-1 text-xs text-blue-700 font-medium">Evaluator scoring consistency</p>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Calibrated Audits</span>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">{calibrations.length}</p>
              <p className="mt-1 text-xs text-slate-500 font-medium">Multi-evaluator blind reviews</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Consistency Tolerance</span>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-950">100%</p>
              <p className="mt-1 text-xs text-emerald-700 font-medium">Within target ±5% threshold</p>
            </div>
          </div>

          {/* Calibrations Table */}
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sliders size={18} className="text-[#214ECF]" />
                Auditor Calibration Records
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ensures QA analysts score interactions objectively and aligned with brand guidelines.
              </p>
            </div>

            {calibrations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Interaction Ref</th>
                      <th className="py-3 px-3">Agent</th>
                      <th className="py-3 px-3 text-center">Original</th>
                      <th className="py-3 px-3 text-center">Calibrated</th>
                      <th className="py-3 px-3 text-center">Variance</th>
                      <th className="py-3 px-3">Calibrator</th>
                      <th className="py-3 px-3">Review Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calibrations.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">{c.created_at.slice(0, 10)}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">{c.interaction_reference}</td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{c.agent_name}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-700">{c.original_score}%</td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#214ECF]">{c.calibration_score}%</td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block font-extrabold px-2 py-0.5 rounded text-[11px] ${
                              c.variance > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : c.variance < 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {c.variance > 0 ? `+${c.variance}%` : `${c.variance}%`}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">{c.calibrator_name}</td>
                        <td className="py-3.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title={c.notes}>
                          {c.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">No calibrations recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5: QUALITY FLOW VISUALIZATION                                  */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeMainTab === "flow" && (
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-7 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div>
            <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-bold text-[#214ECF]">
              Deterministic QA Process
            </span>
            <h2 className="mt-2 text-xl font-black text-slate-900">End-to-End Quality Assurance Lifecycle</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Every quality score is grounded in authoritative database records. Quality decisions remain human-controlled, backed by server-calculated weighted scoring, multi-tier appeals, and calibration audits.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            {[
              {
                step: "01",
                title: "Customer Interaction",
                desc: "Voice call, live chat, or support ticket conducted on project campaign.",
                icon: PhoneCall,
                color: "text-blue-600 bg-blue-50 border-blue-200",
              },
              {
                step: "02",
                title: "Sampling & Audit",
                desc: "Quality evaluator selects interaction reference and loads standardized scorecard.",
                icon: FileText,
                color: "text-indigo-600 bg-indigo-50 border-indigo-200",
              },
              {
                step: "03",
                title: "Weighted Scoring",
                desc: "Evaluator scores criteria; server calculates deterministic percentage with auto-fail rules.",
                icon: Sliders,
                color: "text-[#214ECF] bg-[#EEF4FF] border-[#214ECF]/30",
              },
              {
                step: "04",
                title: "Agent Profile",
                desc: "Score and critical defects instantly update agent's quality history and pass rate.",
                icon: Users,
                color: "text-emerald-600 bg-emerald-50 border-emerald-200",
              },
              {
                step: "05",
                title: "Dispute Escalation",
                desc: "Frontline agent or BPO partner raises dispute if scoring discrepancy occurs.",
                icon: MessageSquare,
                color: "text-amber-600 bg-amber-50 border-amber-200",
              },
              {
                step: "06",
                title: "Calibration Re-Review",
                desc: "Senior auditor reviews interaction, measures variance, and records calibration outcome.",
                icon: Award,
                color: "text-purple-600 bg-purple-50 border-purple-200",
              },
              {
                step: "07",
                title: "Immutable Final Score",
                desc: "Historical scores preserved without silent overwriting; changes tracked in audit trail.",
                icon: ShieldCheck,
                color: "text-teal-600 bg-teal-50 border-teal-200",
              },
              {
                step: "08",
                title: "Executive Reports",
                desc: "Aggregates feed client SLA dashboards, payouts compliance, and QA certifications.",
                icon: BarChart3,
                color: "text-slate-800 bg-slate-100 border-slate-300",
              },
            ].map((st, i) => (
              <div
                key={st.step}
                className={`relative flex flex-col justify-between rounded-2xl border p-4.5 transition hover:shadow-sm ${st.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-black opacity-60">STEP {st.step}</span>
                    <st.icon size={18} />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">{st.title}</h4>
                  <p className="mt-1 text-[11px] text-slate-600 leading-normal">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* AGENT QUALITY DETAIL DRAWER / WORKSPACE                                */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {selectedAgentId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="border-b border-slate-200 bg-white p-6 shrink-0 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-[#EEF4FF] text-[#214ECF] px-2.5 py-0.5 rounded-md">
                    {agentDetail?.agent.agent_code || `THK-AGT-${selectedAgentId}`}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Thinkatic Premier BPO Hub</span>
                </div>
                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  {agentDetail?.agent.name || "Agent Profile"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {agentDetail?.agent.campaign_name || "North American Telehealth Patient Support"}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Large Circular / Ring Score Display */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Quality Score</p>
                    <p
                      className={`text-2xl font-black ${
                        (agentDetail?.metrics.current_quality_score || 0) >= 85
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {agentDetail?.metrics.current_quality_score !== null && agentDetail?.metrics.current_quality_score !== undefined
                        ? `${agentDetail.metrics.current_quality_score}%`
                        : "N/A"}
                    </p>
                  </div>
                  <Award
                    size={28}
                    className={
                      (agentDetail?.metrics.current_quality_score || 0) >= 85 ? "text-emerald-500" : "text-amber-500"
                    }
                  />
                </div>

                <button
                  onClick={() => setSelectedAgentId(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50 text-center py-2.5 text-xs shrink-0">
              <div>
                <span className="text-slate-400 text-[10px] font-bold block">TOTAL AUDITS</span>
                <span className="font-extrabold text-slate-900">{agentDetail?.metrics.total_audits || 0}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold block">PASS RATE</span>
                <span className="font-extrabold text-emerald-700">
                  {agentDetail?.metrics.pass_rate !== null ? `${agentDetail?.metrics.pass_rate}%` : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold block">CRITICAL DEFECTS</span>
                <span className={`font-extrabold ${agentDetail?.metrics.critical_defects ? "text-rose-600" : "text-slate-900"}`}>
                  {agentDetail?.metrics.critical_defects || 0}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold block">OPEN DISPUTES</span>
                <span className="font-extrabold text-amber-700">{agentDetail?.metrics.open_disputes || 0}</span>
              </div>
            </div>

            {/* Drawer 7 Tabs Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200 px-6 pt-2 bg-white shrink-0 overflow-x-auto">
              {[
                { key: "overview", label: "Overview" },
                { key: "evaluations", label: `Evaluations (${agentDetail?.evaluations.length || 0})` },
                { key: "scorecard", label: "Scorecard Criteria" },
                { key: "defects", label: `Defects (${agentDetail?.defects.length || 0})` },
                { key: "disputes", label: `Disputes (${agentDetail?.disputes.length || 0})` },
                { key: "calibration", label: `Calibration (${agentDetail?.calibrations.length || 0})` },
                { key: "history", label: "History Timeline" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAgentDrawerTab(tab.key as any)}
                  className={`border-b-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition ${
                    agentDrawerTab === tab.key
                      ? "border-[#214ECF] text-[#214ECF]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingAgentDetail ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading agent profile...</div>
              ) : agentDetail ? (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {agentDrawerTab === "overview" && (
                    <div className="space-y-6">
                      {/* Metric cards */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">30-Day Average</p>
                          <p className="text-xl font-black text-slate-900 mt-1">{agentDetail.metrics.avg_30d}%</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">90-Day Average</p>
                          <p className="text-xl font-black text-slate-900 mt-1">{agentDetail.metrics.avg_90d}%</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Pass Rate</p>
                          <p className="text-xl font-black text-emerald-700 mt-1">{agentDetail.metrics.pass_rate}%</p>
                        </div>
                      </div>

                      {/* Agent Quality Trend Chart */}
                      <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-2xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                          Individual Quality Trend
                        </h4>
                        <div className="h-52 w-full">
                          {agentDetail.trend_series.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={agentDetail.trend_series}>
                                <defs>
                                  <linearGradient id="agentTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#214ECF" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#214ECF" stopOpacity={0.0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                                <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                                <RechartsTooltip />
                                <Area type="monotone" dataKey="score" stroke="#214ECF" strokeWidth={2} fill="url(#agentTrendGradient)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                              No trend data available
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: EVALUATIONS */}
                  {agentDrawerTab === "evaluations" && (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                              <th className="py-2.5 px-2">Ref</th>
                              <th className="py-2.5 px-2">Date</th>
                              <th className="py-2.5 px-2">Channel</th>
                              <th className="py-2.5 px-2 text-center">Score</th>
                              <th className="py-2.5 px-2 text-center">Result</th>
                              <th className="py-2.5 px-2 text-center">Critical</th>
                              <th className="py-2.5 px-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {agentDetail.evaluations.map((ev) => (
                              <tr key={ev.id} className="hover:bg-slate-50 transition">
                                <td className="py-3 px-2 font-mono font-bold text-slate-900">{ev.interaction_reference}</td>
                                <td className="py-3 px-2 text-slate-500 whitespace-nowrap">{ev.evaluation_date}</td>
                                <td className="py-3 px-2">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                                    {ev.channel || "Voice"}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center font-black text-slate-900">{ev.total_score}%</td>
                                <td className="py-3 px-2 text-center whitespace-nowrap">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      ev.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                    }`}
                                  >
                                    {ev.passed ? "PASS" : "FAIL"}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center">
                                  {Array.isArray(ev.defects) && ev.defects.some((d) => d.severity === "critical") ? (
                                    <span className="text-rose-600 font-bold text-[10px]">CRITICAL</span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-right whitespace-nowrap space-x-1">
                                  <button
                                    onClick={() => setSelectedEvalDetail(ev)}
                                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                                  >
                                    Details
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDisputeTargetEval(ev);
                                      setDisputeDescription("");
                                      setDisputeModalOpen(true);
                                    }}
                                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                                  >
                                    Dispute
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SCORECARD CRITERIA */}
                  {agentDrawerTab === "scorecard" && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500">
                        Historical criterion performance across all audited interactions for this agent.
                      </p>
                      <div className="space-y-3">
                        {agentDetail.scorecards_performance.map((crit) => (
                          <div key={crit.criterion_id} className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <div>
                                <span className="font-bold text-slate-900">{crit.name}</span>
                                <span className="text-[10px] text-slate-400 ml-2 font-medium">({crit.category}) • Weight: {crit.weight}%</span>
                              </div>
                              <span className="font-black text-slate-900">{crit.performance_percent}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  crit.performance_percent >= 90
                                    ? "bg-emerald-500"
                                    : crit.performance_percent >= 80
                                    ? "bg-blue-500"
                                    : "bg-amber-500"
                                }`}
                                style={{ width: `${Math.min(100, crit.performance_percent)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: DEFECTS */}
                  {agentDrawerTab === "defects" && (
                    <div className="space-y-3">
                      {agentDetail.defects.length > 0 ? (
                        agentDetail.defects.map((d, i) => (
                          <div
                            key={i}
                            className={`rounded-2xl border p-4 shadow-2xs space-y-1.5 ${
                              d.severity === "critical"
                                ? "border-rose-200 bg-rose-50/20"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  d.severity === "critical"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {d.severity} Defect
                              </span>
                              <span className="font-mono text-slate-400 text-[11px]">{d.interaction_reference} • {d.date}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-900">{d.description}</p>
                            {d.rule && (
                              <p className="text-[11px] text-rose-700 font-medium">Configured rule: {d.rule}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-xs text-slate-400">Zero defects logged for this agent.</div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: DISPUTES */}
                  {agentDrawerTab === "disputes" && (
                    <div className="space-y-3">
                      {agentDetail.disputes.length > 0 ? (
                        agentDetail.disputes.map((disp) => (
                          <div key={disp.id} className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-slate-900">DISP-{disp.id}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  disp.status === "upheld" || disp.status === "resolved"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {disp.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl">"{disp.dispute_reason}"</p>
                            {disp.resolution_notes && (
                              <p className="text-xs text-purple-900 font-medium">Resolution: {disp.resolution_notes}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-xs text-slate-400">Zero disputes registered.</div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: CALIBRATION */}
                  {agentDrawerTab === "calibration" && (
                    <div className="space-y-3">
                      {agentDetail.calibrations.length > 0 ? (
                        agentDetail.calibrations.map((c) => (
                          <div key={c.id} className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-slate-900">Ref: {c.interaction_reference}</span>
                              <span className="rounded bg-blue-100 text-blue-800 font-bold px-2 py-0.5 text-[10px]">
                                Variance: {c.variance > 0 ? `+${c.variance}%` : `${c.variance}%`}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600">
                              Original: <span className="font-bold">{c.original_score}%</span> ➔ Calibrated: <span className="font-bold text-[#214ECF]">{c.calibration_score}%</span>
                            </div>
                            <p className="text-[11px] text-slate-500">{c.notes}</p>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-xs text-slate-400">Zero calibrations recorded.</div>
                      )}
                    </div>
                  )}

                  {/* TAB 7: HISTORY TIMELINE */}
                  {agentDrawerTab === "history" && (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {agentDetail.history.map((ev) => (
                        <div key={ev.id} className="relative">
                          <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-[#214ECF] ring-4 ring-white" />
                          <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900">{ev.title}</span>
                              <span className="text-[10px] text-slate-400">{ev.date}</span>
                            </div>
                            <p className="text-xs text-slate-600">{ev.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: NEW QUALITY AUDIT                                               */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <span className="rounded-md bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#214ECF]">
                  Standardized QA Evaluation
                </span>
                <h3 className="mt-1 text-lg font-black text-slate-900">Conduct New Quality Audit</h3>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAuditSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              {/* Row 1: Agent & Scorecard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Frontline Agent *
                  </label>
                  <select
                    value={newAuditForm.agentId}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, agentId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:border-[#214ECF]"
                  >
                    <option value="">Select an Agent...</option>
                    {agents.map((a) => (
                      <option key={a.agent_id} value={a.agent_id}>
                        {a.agent_name} ({a.agent_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Scorecard *
                  </label>
                  <select
                    value={newAuditForm.scorecardId}
                    onChange={(e) => {
                      const scId = e.target.value;
                      setNewAuditForm({ ...newAuditForm, scorecardId: scId, criteriaScores: {} });
                    }}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:border-[#214ECF]"
                  >
                    {scorecards.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.passing_threshold}% threshold)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Interaction Ref, Channel, Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Interaction Ref (Call/Ticket ID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CALL-00104"
                    value={newAuditForm.interactionReference}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, interactionReference: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Channel *</label>
                  <select
                    value={newAuditForm.channel}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, channel: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:border-[#214ECF]"
                  >
                    <option value="Voice">Voice Call</option>
                    <option value="Chat">Live Chat</option>
                    <option value="Email">Email</option>
                    <option value="Ticket">Support Ticket</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Evaluation Date *</label>
                  <input
                    type="date"
                    required
                    value={newAuditForm.evaluationDate}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, evaluationDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              {/* Dynamic Criteria Scoring */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-slate-400">Scorecard Criteria</span>
                  <span className="text-xs font-bold text-[#214ECF]">
                    Provisional Score: {provisionalCalculatedScore}%
                  </span>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {selectedModalScorecard?.criteria?.map((crit) => {
                    const currentVal = newAuditForm.criteriaScores[crit.id] !== undefined ? newAuditForm.criteriaScores[crit.id] : crit.max_score;
                    return (
                      <div key={crit.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="max-w-xs">
                          <p className="font-bold text-slate-900">{crit.name}</p>
                          <p className="text-[10px] text-slate-400">{crit.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={crit.max_score}
                            value={currentVal}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setNewAuditForm({
                                ...newAuditForm,
                                criteriaScores: { ...newAuditForm.criteriaScores, [crit.id]: val },
                              });
                            }}
                            className="w-16 rounded-lg border border-slate-200 bg-white p-1 text-center font-bold text-xs outline-none focus:border-[#214ECF]"
                          />
                          <span className="text-[11px] text-slate-400 font-bold">/ {crit.max_score}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Critical Defects Checkboxes */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase text-rose-800 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-rose-600" />
                  Critical Defect Trigger (Auto-Fail Rule)
                </span>
                <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/30 p-3.5 text-xs">
                  {[
                    "Data privacy / HIPAA disclosure violation",
                    "Incorrect mandatory customer verification process",
                    "Serious regulatory compliance failure",
                    "Unprofessional / abusive customer handling",
                  ].map((def) => {
                    const isChecked = newAuditForm.criticalDefects.includes(def);
                    return (
                      <label key={def} className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAuditForm({ ...newAuditForm, criticalDefects: [...newAuditForm.criticalDefects, def] });
                            } else {
                              setNewAuditForm({
                                ...newAuditForm,
                                criticalDefects: newAuditForm.criticalDefects.filter((d) => d !== def),
                              });
                            }
                          }}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span className={isChecked ? "font-bold text-rose-800" : ""}>{def}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Textarea */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Evaluator Coaching Feedback & Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide constructive feedback for the frontline agent..."
                  value={newAuditForm.evaluatorFeedback}
                  onChange={(e) => setNewAuditForm({ ...newAuditForm, evaluatorFeedback: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAuditModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAudit}
                  className="rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1b40ab] disabled:opacity-50 transition"
                >
                  {submittingAudit ? "Calculating & Saving..." : "Submit Verified Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EVALUATION DETAIL                                               */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {selectedEvalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-[10px] font-bold text-[#214ECF] bg-[#EEF4FF] px-2 py-0.5 rounded">
                  QA-{String(selectedEvalDetail.id).padStart(6, "0")}
                </span>
                <h3 className="mt-1 text-base font-black text-slate-900">{selectedEvalDetail.agent_name}</h3>
                <p className="text-xs text-slate-500">Ref: {selectedEvalDetail.interaction_reference}</p>
              </div>
              <div className="text-right">
                <span
                  className={`text-2xl font-black ${
                    selectedEvalDetail.total_score >= 85 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {selectedEvalDetail.total_score}%
                </span>
                <span
                  className={`block text-[10px] font-bold uppercase rounded-full px-2 py-0.5 mt-0.5 ${
                    selectedEvalDetail.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {selectedEvalDetail.passed ? "PASS" : "FAIL"}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-3 rounded-xl">
                <div><span className="text-slate-400 font-bold">Channel:</span> {selectedEvalDetail.channel || "Voice"}</div>
                <div><span className="text-slate-400 font-bold">Date:</span> {selectedEvalDetail.evaluation_date}</div>
                <div><span className="text-slate-400 font-bold">Evaluator:</span> {selectedEvalDetail.evaluated_by}</div>
                <div><span className="text-slate-400 font-bold">Scorecard:</span> {selectedEvalDetail.scorecard_name}</div>
              </div>

              {selectedEvalDetail.failure_reason && (
                <div className="text-xs p-3 rounded-xl bg-rose-50 text-rose-900 border border-rose-200">
                  <span className="font-bold">Scoring Reason:</span> {selectedEvalDetail.failure_reason}
                </div>
              )}

              <div>
                <p className="font-bold text-slate-900 mb-1">Evaluator Feedback</p>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedEvalDetail.evaluator_feedback}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedEvalDetail(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: RAISE DISPUTE                                                   */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {disputeModalOpen && disputeTargetEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                  Quality Dispute
                </span>
                <h3 className="mt-1 text-base font-black text-slate-900">
                  Appeal QA Evaluation #{disputeTargetEval.id}
                </h3>
              </div>
              <button onClick={() => setDisputeModalOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDisputeSubmit} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Dispute Reason Category *</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:border-[#214ECF]"
                >
                  <option value="Scoring discrepancy on compliance verification">Scoring discrepancy on compliance verification</option>
                  <option value="Customer identity verified via alternate protocol">Customer identity verified via alternate protocol</option>
                  <option value="System latency or dialer degradation affected interaction">System latency or dialer degradation affected interaction</option>
                  <option value="Dispute regarding call wrap-up disposition">Dispute regarding call wrap-up disposition</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Detailed Explanation (min 10 chars) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail why the audit score should be re-calibrated..."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {submittingDispute ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CALIBRATE AUDIT                                                 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {calibrateModalOpen && calibrateTargetEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                  QA Calibration
                </span>
                <h3 className="mt-1 text-base font-black text-slate-900">
                  Calibrate Audit #{calibrateTargetEval.id}
                </h3>
              </div>
              <button onClick={() => setCalibrateModalOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCalibrationSubmit} className="space-y-3 text-xs font-semibold">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block font-bold">Original Score</span>
                  <span className="font-black text-slate-900 text-sm">{calibrateTargetEval.total_score}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Variance</span>
                  <span className="font-black text-[#214ECF] text-sm">
                    {Number(calibrateScoreInput) - calibrateTargetEval.total_score > 0 ? "+" : ""}
                    {(Number(calibrateScoreInput) - calibrateTargetEval.total_score).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Calibrated / Re-audit Score (0-100) *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  required
                  value={calibrateScoreInput}
                  onChange={(e) => setCalibrateScoreInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Calibration Notes *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain variance findings or alignment with QA standards..."
                  value={calibrateNotes}
                  onChange={(e) => setCalibrateNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCalibrateModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCalibration}
                  className="rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1b40ab] disabled:opacity-50"
                >
                  {submittingCalibration ? "Saving..." : "Record Calibration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
