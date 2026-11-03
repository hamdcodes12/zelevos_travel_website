import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  PhoneCall,
  MessageSquare,
  Mail,
  Ticket,
  Briefcase,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  ChevronRight,
  User,
  Layers,
  ArrowRight,
  ShieldCheck,
  Activity,
  Award,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface Agent {
  id: number;
  employee_id?: string;
  agent_code?: string;
  name: string;
}

interface Project {
  id: number;
  name: string;
  vertical?: string;
  process_type?: string;
  campaign_name?: string;
}

export interface ProductionRecord {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_code: string;
  centre_id: number;
  partner_id: string;
  project_id: number;
  project_name: string;
  campaign_name?: string;
  channel?: string;
  unit_type?: string;
  process_type: "voice" | "chat" | "email" | "ticket" | "backoffice";
  production_date: string;
  metrics: Record<string, any>;
  units_completed: number;
  target_units?: number | null;
  adherence_rate?: number | null;
  adherence_status?: "above_target" | "on_target" | "below_target" | "no_target";
  productive_hours: number;
  productivity_rate: number;
  source: "manual" | "system_import";
  status: "submitted" | "verified" | "rejected";
  notes?: string | null;
  attendance_verified?: boolean;
  created_at: string;
}

interface SummaryData {
  total_volume: number;
  total_productive_hours: number;
  avg_productivity_rate: number;
  target_adherence_rate: number | null;
  active_agents_count: number;
  active_campaigns_count: number;
  total_records: number;
  last_updated?: string;
}

interface Props {
  api: (path: string, options?: RequestInit) => Promise<Response>;
  agents: Agent[];
  projects: Project[];
}

// Hook for smooth numerical count-up on load
function useCountUp(target: number, duration: number = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let start = 0;
    const stepTime = 25;
    const steps = Math.max(1, Math.floor(duration / stepTime));
    const increment = target / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setVal(target);
        clearInterval(timer);
      } else {
        setVal(Math.round(start * 10) / 10);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

export default function BpoProductionSection({ api, agents = [], projects = [] }: Props) {
  const [internalAgents, setInternalAgents] = useState<Agent[]>([]);
  const [internalProjects, setInternalProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const agRes = await api("/bpo/agents?limit=100");
        if (agRes.ok) {
          const agData = await agRes.json();
          if (Array.isArray(agData.agents)) {
            setInternalAgents(
              agData.agents.map((a: any) => ({
                id: a.id,
                employee_id: a.employee_id || a.agent_code,
                agent_code: a.agent_code,
                name: a.name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || `Agent #${a.id}`,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load partner agents:", err);
      }

      try {
        const projRes = await api("/bpo/projects");
        if (projRes.ok) {
          const projData = await projRes.json();
          const pList = Array.isArray(projData) ? projData : projData.projects || [];
          if (pList.length > 0) {
            setInternalProjects(
              pList.map((p: any) => ({
                id: p.id,
                name: p.name || p.title || `Project #${p.id}`,
                vertical: p.vertical || p.category,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load partner projects:", err);
      }
    }

    void fetchMetadata();
  }, []);

  const effectiveAgents = internalAgents.length > 0 ? internalAgents : agents;
  const effectiveProjects = internalProjects.length > 0 ? internalProjects : projects;

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [chartsData, setChartsData] = useState<any>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() => new Date().toLocaleTimeString());

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRangePreset, setDateRangePreset] = useState<"today" | "7d" | "30d" | "90d" | "custom">("30d");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  // Trend Chart Period
  const [trendPeriod, setTrendPeriod] = useState<"7D" | "30D" | "90D">("30D");

  // Distribution chart selector
  const [distroMetric, setDistroMetric] = useState<"project" | "campaign" | "channel" | "output_type">("channel");

  // Sorting for Agent Productivity Table
  const [agentSortBy, setAgentSortBy] = useState<"units" | "rate" | "adherence" | "hours">("units");
  const [agentSortOrder, setAgentSortOrder] = useState<"asc" | "desc">("desc");

  // Drawers
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<any | null>(null);
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<any | null>(null);

  // Log Output Modal State
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [entryModalError, setEntryModalError] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Attendance lookup status for modal
  const [checkingAttendance, setCheckingAttendance] = useState(false);
  const [attendanceInfo, setAttendanceInfo] = useState<{
    has_attendance: boolean;
    working_hours: number | null;
    verified: boolean;
    message?: string;
  } | null>(null);

  const [entryForm, setEntryForm] = useState({
    agent_id: "",
    project_id: "",
    production_date: new Date().toISOString().slice(0, 10),
    channel: "Voice" as "Voice" | "Chat" | "Email" | "Ticket" | "Back Office",
    output_type: "Calls",
    units_completed: 60,
    target_units: 65,
    productive_hours: "8.0",
    notes: "",
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(""), 4500);
  };

  // Sync date range preset
  const handleDatePresetChange = (preset: "today" | "7d" | "30d" | "90d" | "custom") => {
    setDateRangePreset(preset);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (preset === "today") {
      setDateRange({ from: todayStr, to: todayStr });
    } else if (preset === "7d") {
      setDateRange({
        from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        to: todayStr,
      });
    } else if (preset === "30d") {
      setDateRange({
        from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        to: todayStr,
      });
    } else if (preset === "90d") {
      setDateRange({
        from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        to: todayStr,
      });
    }
  };

  // Channel to Output Type default mapping
  const handleChannelChange = (ch: "Voice" | "Chat" | "Email" | "Ticket" | "Back Office") => {
    let defType = "Calls";
    let defTarget = 65;
    if (ch === "Chat") {
      defType = "Chats";
      defTarget = 70;
    } else if (ch === "Email") {
      defType = "Emails";
      defTarget = 80;
    } else if (ch === "Ticket") {
      defType = "Tickets";
      defTarget = 50;
    } else if (ch === "Back Office") {
      defType = "Records";
      defTarget = 140;
    }
    setEntryForm({ ...entryForm, channel: ch, output_type: defType, target_units: defTarget });
  };

  // Check attendance when agent and date are selected in modal
  useEffect(() => {
    if (!entryModalOpen || !entryForm.agent_id || !entryForm.production_date) return;
    let isCancelled = false;

    async function checkAttendance() {
      setCheckingAttendance(true);
      try {
        const res = await api(
          `/bpo/production/attendance-hours?agentId=${entryForm.agent_id}&date=${entryForm.production_date}`
        );
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setAttendanceInfo(data);
          if (data.has_attendance && data.working_hours !== null) {
            setEntryForm((prev) => ({
              ...prev,
              productive_hours: String(data.working_hours),
            }));
          }
        }
      } catch (err) {
        console.error("Failed to query attendance:", err);
      } finally {
        if (!isCancelled) setCheckingAttendance(false);
      }
    }

    void checkAttendance();
    return () => {
      isCancelled = true;
    };
  }, [entryModalOpen, entryForm.agent_id, entryForm.production_date]);

  // Main Data Fetcher
  async function loadData() {
    setLoading(true);
    try {
      let url = `/bpo/production?from=${dateRange.from}&to=${dateRange.to}`;
      if (campaignFilter !== "all") url += `&project_id=${campaignFilter}`;
      if (channelFilter !== "all") url += `&channel=${encodeURIComponent(channelFilter)}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const [recRes, sumRes] = await Promise.all([
        api(url),
        api(`/bpo/production/summary?from=${dateRange.from}&to=${dateRange.to}`),
      ]);

      if (recRes.ok) {
        const d = await recRes.json();
        const list = Array.isArray(d) ? d : d.records || [];
        setRecords(list);
        if (d.summary) {
          setSummaryData(d.summary);
        }
      }

      if (sumRes.ok) {
        const sData = await sumRes.json();
        setChartsData(sData);
        if (sData.summary && !summaryData) {
          setSummaryData(sData.summary);
        }
      }

      setLastUpdatedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load production records:", err);
      showToast("Unable to load latest production records", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [dateRange, campaignFilter, channelFilter, statusFilter]);

  // Search input debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate authoritative KPIs directly from records
  const totalVolume = records.reduce((acc, r) => acc + (Number(r.units_completed) || 0), 0);
  const totalHours = Number(records.reduce((acc, r) => acc + (Number(r.productive_hours) || 0), 0).toFixed(1));
  const avgOutputRate = totalHours > 0 ? Number((totalVolume / totalHours).toFixed(1)) : 0;

  const targetRecords = records.filter(
    (r) => r.target_units !== null && r.target_units !== undefined && r.target_units > 0
  );
  const targetAdherence =
    targetRecords.length > 0
      ? Number(
          (
            targetRecords.reduce((acc, r) => acc + (r.adherence_rate || 0), 0) / targetRecords.length
          ).toFixed(1)
        )
      : null;

  const activeAgentsCount = new Set(records.map((r) => r.agent_id)).size;
  const activeCampaignsCount = new Set(records.map((r) => r.project_id)).size;

  // Animated KPI numbers
  const animVolume = useCountUp(totalVolume);
  const animHours = useCountUp(totalHours);
  const animRate = useCountUp(avgOutputRate);
  const animAdherence = useCountUp(targetAdherence ?? 0);
  const animAgents = useCountUp(activeAgentsCount);
  const animCampaigns = useCountUp(activeCampaignsCount);

  // Export CSV handler
  async function handleExportCSV() {
    try {
      const url = `/bpo/production/export?from=${dateRange.from}&to=${dateRange.to}`;
      const res = await api(url);
      if (!res.ok) throw new Error("Failed to export production records");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `thinkatic_production_report_${dateRange.from}_to_${dateRange.to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Production report CSV downloaded successfully");
    } catch (err: any) {
      showToast(err.message || "Export failed", "error");
    }
  }

  // Handle Log Daily Output Submit
  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entryForm.agent_id || !entryForm.project_id) {
      showToast("Please select both an Agent and a Project/Campaign", "error");
      return;
    }

    if (Number(entryForm.units_completed) < 0) {
      showToast("Completed units cannot be negative", "error");
      return;
    }

    const pHours = Number(entryForm.productive_hours);
    if (isNaN(pHours) || pHours <= 0 || pHours > 24) {
      showToast("Productive work hours must be between 0.1 and 24 hours", "error");
      return;
    }

    setSubmittingEntry(true);
    setEntryModalError("");
    try {
      const procMapping: Record<string, "voice" | "chat" | "email" | "ticket" | "backoffice"> = {
        Voice: "voice",
        Chat: "chat",
        Email: "email",
        Ticket: "ticket",
        "Back Office": "backoffice",
      };

      const selectedAgent = effectiveAgents.find((a) => String(a.id) === String(entryForm.agent_id));
      const selectedProject = effectiveProjects.find((p) => String(p.id) === String(entryForm.project_id));

      const payload = {
        agent_id: Number(entryForm.agent_id),
        agent_name: selectedAgent?.name || `Agent #${entryForm.agent_id}`,
        project_id: Number(entryForm.project_id),
        project_name: selectedProject?.name || `Project #${entryForm.project_id}`,
        production_date: entryForm.production_date,
        process_type: procMapping[entryForm.channel] || "voice",
        channel: entryForm.channel,
        unit_type: entryForm.output_type,
        units_completed: Number(entryForm.units_completed),
        target_units: entryForm.target_units ? Number(entryForm.target_units) : null,
        productive_hours: pHours,
        notes: entryForm.notes,
        metrics: {
          channel: entryForm.channel,
          unit_type: entryForm.output_type,
          target_units: entryForm.target_units ? Number(entryForm.target_units) : null,
        },
      };

      const res = await api("/bpo/production/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log daily production entry");
      }

      showToast("Production output recorded successfully!", "success");
      setEntryModalOpen(false);
      // Reset form
      setEntryForm({
        agent_id: "",
        project_id: "",
        production_date: new Date().toISOString().slice(0, 10),
        channel: "Voice",
        output_type: "Calls",
        units_completed: 60,
        target_units: 65,
        productive_hours: "8.0",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      setEntryModalError(err.message || "Failed to save production entry");
      showToast(err.message || "Failed to save production entry", "error");
    } finally {
      setSubmittingEntry(false);
    }
  }

  // Sorted Agent Productivity List
  const agentProductivityList = useMemo(() => {
    const list = chartsData?.agent_productivity || [];
    return [...list].sort((a: any, b: any) => {
      let aVal = a[agentSortBy] ?? 0;
      let bVal = b[agentSortBy] ?? 0;
      if (agentSortBy === "adherence") {
        aVal = a.adherence ?? -1;
        bVal = b.adherence ?? -1;
      }
      if (agentSortOrder === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [chartsData, agentSortBy, agentSortOrder]);

  // Project Performance List
  const projectPerformanceList = useMemo(() => {
    return chartsData?.project_performance || [];
  }, [chartsData]);

  // Channel Performance List
  const channelPerformanceList = useMemo(() => {
    return chartsData?.channel_performance || [];
  }, [chartsData]);

  // Trend chart points
  const trendPoints = useMemo(() => {
    return chartsData?.trend || [];
  }, [chartsData]);

  // Output vs Target chart data
  const outputVsTargetData = useMemo(() => {
    return chartsData?.output_vs_target || [];
  }, [chartsData]);

  // Donut distribution data
  const distributionData = useMemo(() => {
    if (!chartsData?.productivity_distribution) return [];
    let source: Record<string, number> = {};
    if (distroMetric === "project") source = chartsData.productivity_distribution.by_project || {};
    else if (distroMetric === "campaign") source = chartsData.productivity_distribution.by_campaign || {};
    else if (distroMetric === "channel") source = chartsData.productivity_distribution.by_channel || {};
    else if (distroMetric === "output_type") source = chartsData.productivity_distribution.by_output_type || {};

    const colors = ["#214ECF", "#5FA8FF", "#0B1730", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"];
    return Object.entries(source).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [chartsData, distroMetric]);

  return (
    <div className="space-y-7 bg-[#F8FAFC] min-h-screen pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-xs font-bold text-white shadow-2xl transition-all duration-300 ${
            toastType === "error" ? "bg-rose-600" : "bg-[#0B1730] border border-blue-500/20"
          }`}
        >
          {toastType === "error" ? (
            <AlertCircle size={18} className="text-white shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          )}
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 4. PAGE HEADER: Live Campaign Productivity Hero                                */}
      {/* ============================================================================== */}
      <div className="rounded-3xl border border-[#E3EAF5] bg-gradient-to-br from-[#0B1730] via-[#0E1E3F] to-[#12254F] p-7 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative background light elements */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#214ECF]/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-60 h-60 rounded-full bg-[#5FA8FF]/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#214ECF]/30 border border-[#5FA8FF]/30 px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#5FA8FF]">
                <Activity size={13} className="text-[#5FA8FF]" />
                PHASE 4 · PRODUCTION & PRODUCTIVITY
              </span>
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Process-Adaptive Production Tracking
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Live Campaign Productivity
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
              Track workforce hours, production output, productivity rates and target adherence across active projects and campaigns with server-authoritative calculations.
            </p>

            {lastUpdatedTime && (
              <p className="text-[11px] text-slate-400 font-medium">
                Last updated: <span className="text-slate-200 font-semibold">{lastUpdatedTime}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="headerRefreshBtn"
              onClick={() => void loadData()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
              title="Perform real-time backend refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#5FA8FF]" : ""} />
              Refresh
            </button>

            <button
              id="headerExportCsvBtn"
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2.5 text-xs font-bold text-white transition active:scale-95"
              title="Export filtered records to CSV"
            >
              <Download size={14} className="text-[#5FA8FF]" />
              Export CSV
            </button>

            <button
              id="headerLogDailyOutputBtn"
              onClick={() => {
                setEntryModalOpen(true);
                setEntryModalError("");
              }}
              className="flex items-center gap-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3eb0] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#214ECF]/30 transition active:scale-95"
            >
              <Plus size={16} />
              Log Daily Output
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 5 & 6. TOP 6 KPI CARDS (Server-Calculated, Smooth Animated Count-Up)             */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* 1. TOTAL WORK VOLUME */}
        <div className="group rounded-2xl border border-[#E3EAF5] bg-white p-5 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Work Volume</span>
            <div className="w-8 h-8 rounded-xl bg-[#EEF5FF] flex items-center justify-center text-[#214ECF]">
              <BarChart3 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {animVolume.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Units delivered in window</p>
        </div>

        {/* 2. PRODUCTIVE HOURS */}
        <div className="group rounded-2xl border border-[#E3EAF5] bg-white p-5 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Productive Hours</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {animHours.toFixed(1)} <span className="text-xs font-bold text-slate-400">hrs</span>
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Logged productive floor time</p>
        </div>

        {/* 3. AVG OUTPUT RATE */}
        <div className="group rounded-2xl border border-[#E3EAF5] bg-white p-5 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Avg Output Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {animRate.toFixed(1)} <span className="text-xs font-bold text-slate-400">units/hr</span>
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Server-calculated speed</p>
        </div>

        {/* 4. TARGET ADHERENCE (Never default to 100%! Real calculated value) */}
        <div className="group rounded-2xl border border-[#E3EAF5] bg-white p-5 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Target Adherence</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            {targetAdherence !== null ? (
              <span className="text-2xl font-black text-purple-900 tracking-tight">
                {animAdherence.toFixed(1)}%
              </span>
            ) : (
              <span className="text-sm font-bold text-slate-400 tracking-tight">
                No target configured
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Target attainment SLA</p>
        </div>

        {/* 5. ACTIVE AGENTS */}
        <div className="group rounded-2xl border border-[#E3EAF5] bg-white p-5 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Active Agents</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <User size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {animAgents}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Delivering in period</p>
        </div>

        {/* 6. ACTIVE CAMPAIGNS */}
        <div className="group rounded-2xl border border-[#E3EAF5] bg-white p-5 shadow-xs hover:border-[#214ECF]/40 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Active Campaigns</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {animCampaigns}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Active delivery projects</p>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 24. PRODUCTIVITY FLOW ANIMATION: Authoritative Enterprise Pipeline             */}
      {/* ============================================================================== */}
      <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Authoritative Productivity Pipeline</h3>
            <p className="text-xs text-slate-500">
              Operational flow connecting agent attendance to verified production units and SLA reporting.
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#214ECF] bg-[#EEF5FF] px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1">
            <ShieldCheck size={13} /> Real-Time Operational Integrity
          </span>
        </div>

        {/* Pipeline steps with connecting arrow pulses */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-center">
          {[
            { label: "AGENT", sub: "Verified Identity", icon: User },
            { label: "WORK HOURS", sub: "Attendance Checked", icon: Clock },
            { label: "PROJECT / CAMPAIGN", sub: "Project Allocated", icon: Briefcase },
            { label: "PRODUCTION ACTIVITY", sub: "Channel Activity", icon: Activity },
            { label: "OUTPUT UNITS", sub: "Count Logged", icon: BarChart3 },
            { label: "TARGET COMPARISON", sub: "Target Adherence", icon: CheckCircle2 },
            { label: "PRODUCTIVITY RATE", sub: "Units / Hour", icon: TrendingUp },
            { label: "REPORTING", sub: "Audit & Admin", icon: FileText },
          ].map((step, idx, arr) => {
            const IconComp = step.icon;
            return (
              <React.Fragment key={step.label}>
                <div className="flex-1 min-w-[100px] flex flex-col items-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition">
                  <div className="w-8 h-8 rounded-full bg-white border border-[#E3EAF5] flex items-center justify-center text-[#214ECF] shadow-xs mb-2">
                    <IconComp size={15} />
                  </div>
                  <span className="text-[11px] font-black text-slate-800 tracking-tight">{step.label}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{step.sub}</span>
                </div>
                {idx < arr.length - 1 && (
                  <ArrowRight size={14} className="text-[#5FA8FF] shrink-0 hidden md:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 17 & 18. CHARTS ROW 1: Productivity Trend & Output vs Target                   */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Productivity Trend */}
        <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Productivity Trend</h3>
              <p className="text-xs text-slate-500">Daily delivered units and calculated speed over time</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(["7D", "30D", "90D"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition ${
                    trendPeriod === p
                      ? "bg-[#214ECF] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            {trendPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#214ECF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#214ECF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0B1730", borderRadius: 12, border: "none", color: "#fff", fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="units"
                    name="Output Units"
                    stroke="#214ECF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorUnits)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <BarChart3 size={24} className="mb-2 opacity-50" />
                No historical production data available in this date range.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Output vs Target */}
        <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Output vs Target</h3>
            <p className="text-xs text-slate-500">Actual campaign output compared against configured targets</p>
          </div>

          <div className="h-64 w-full">
            {outputVsTargetData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outputVsTargetData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="project_name"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(val) => (val.length > 18 ? val.substring(0, 16) + "…" : val)}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0B1730", borderRadius: 12, border: "none", color: "#fff", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="actual_output" name="Actual Units" fill="#214ECF" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="target_output" name="Target Units" fill="#93C5FD" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <CheckCircle2 size={24} className="mb-2 opacity-50" />
                No campaign targets configured yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 19 & 23. CHARTS ROW 2: Channel Performance & Productivity Distribution         */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance Cards & Metrics */}
        <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Channel Performance</h3>
            <p className="text-xs text-slate-500">Work volume, hours, and productivity rates across channels</p>
          </div>

          <div className="space-y-3">
            {channelPerformanceList.length > 0 ? (
              channelPerformanceList.map((ch: any) => {
                let Icon = PhoneCall;
                if (ch.channel === "Chat") Icon = MessageSquare;
                else if (ch.channel === "Email") Icon = Mail;
                else if (ch.channel === "Ticket") Icon = Ticket;
                else if (ch.channel === "Back Office") Icon = Briefcase;

                return (
                  <div
                    key={ch.channel}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between hover:bg-slate-100/60 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#214ECF]">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{ch.channel}</p>
                        <p className="text-[11px] text-slate-500">{ch.hours} hrs logged · {ch.count} entries</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{ch.units.toLocaleString()} units</p>
                      <p className="text-[11px] font-bold text-emerald-600">{ch.rate} units/hr</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No channel production data available.
              </div>
            )}
          </div>
        </div>

        {/* Productivity Distribution Donut Chart */}
        <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Production Distribution</h3>
              <p className="text-xs text-slate-500">Volume proportion across operational dimensions</p>
            </div>
            <select
              value={distroMetric}
              onChange={(e) => setDistroMetric(e.target.value as any)}
              className="rounded-xl border border-[#E3EAF5] bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
            >
              <option value="channel">By Channel</option>
              <option value="campaign">By Campaign</option>
              <option value="project">By Project</option>
              <option value="output_type">By Output Type</option>
            </select>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0B1730", borderRadius: 12, border: "none", color: "#fff", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                No distribution data available for selected filter.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 27. PROJECT PERFORMANCE TABLE                                                  */}
      {/* ============================================================================== */}
      <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900">Project Performance</h3>
          <p className="text-xs text-slate-500">
            Work volume, throughput rates, and SLA adherence broken down by allocated project.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Project / Campaign</th>
                <th className="pb-3">Assigned Agents</th>
                <th className="pb-3">Work Hours</th>
                <th className="pb-3">Delivered Output</th>
                <th className="pb-3">Output Rate</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Target Adherence</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectPerformanceList.length > 0 ? (
                projectPerformanceList.map((p: any) => {
                  let statusBadge = (
                    <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      NO TARGET
                    </span>
                  );
                  if (p.status === "above_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        ABOVE TARGET
                      </span>
                    );
                  } else if (p.status === "on_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        ON TARGET
                      </span>
                    );
                  } else if (p.status === "below_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        BELOW TARGET
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={p.project_id}
                      onClick={() => setSelectedCampaignDetail(p)}
                      className="hover:bg-slate-50/70 transition cursor-pointer group"
                    >
                      <td className="py-3 pl-2 font-bold text-slate-900 group-hover:text-[#214ECF]">
                        {p.project_name}
                      </td>
                      <td className="py-3 text-slate-600">{p.assigned_agents} agents</td>
                      <td className="py-3 text-slate-600">{p.hours} hrs</td>
                      <td className="py-3 font-bold text-slate-900">{p.actual_output.toLocaleString()}</td>
                      <td className="py-3 font-bold text-emerald-700">{p.rate} /hr</td>
                      <td className="py-3 text-slate-500">{p.target_output ? p.target_output.toLocaleString() : "N/A"}</td>
                      <td className="py-3 font-bold">
                        {p.adherence !== null ? `${p.adherence}%` : "N/A"}
                      </td>
                      <td className="py-3">{statusBadge}</td>
                      <td className="py-3 pr-2 text-right">
                        <span className="text-[11px] font-bold text-[#214ECF] hover:underline flex items-center justify-end gap-1">
                          Details <ChevronRight size={13} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No project performance data available for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 20. AGENT PRODUCTIVITY RANKING TABLE                                           */}
      {/* ============================================================================== */}
      <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Agent Productivity</h3>
            <p className="text-xs text-slate-500">
              Workforce individual throughput, floor hours, and objective target attainment.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">Sort by:</span>
            <select
              value={agentSortBy}
              onChange={(e) => setAgentSortBy(e.target.value as any)}
              className="rounded-xl border border-[#E3EAF5] bg-white px-3 py-1 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
            >
              <option value="units">Delivered Output</option>
              <option value="rate">Output Rate</option>
              <option value="adherence">Target Adherence</option>
              <option value="hours">Work Hours</option>
            </select>
            <button
              onClick={() => setAgentSortOrder(agentSortOrder === "asc" ? "desc" : "asc")}
              className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
              title="Toggle sort direction"
            >
              {agentSortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Agent Name</th>
                <th className="pb-3">Agent ID</th>
                <th className="pb-3">Allocated Campaigns</th>
                <th className="pb-3">Hours</th>
                <th className="pb-3">Output Units</th>
                <th className="pb-3">Output Rate</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Adherence</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agentProductivityList.length > 0 ? (
                agentProductivityList.map((a: any) => {
                  let statusBadge = (
                    <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      NO TARGET
                    </span>
                  );
                  if (a.status === "above_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        ABOVE TARGET
                      </span>
                    );
                  } else if (a.status === "on_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        ON TARGET
                      </span>
                    );
                  } else if (a.status === "below_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        BELOW TARGET
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={a.agent_id}
                      onClick={() => setSelectedAgentDetail(a)}
                      className="hover:bg-slate-50/70 transition cursor-pointer group"
                    >
                      <td className="py-3 pl-2 font-bold text-slate-900 group-hover:text-[#214ECF]">
                        {a.agent_name}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-500">{a.agent_code}</td>
                      <td className="py-3 text-slate-600 max-w-[200px] truncate">{a.projects}</td>
                      <td className="py-3 text-slate-600">{a.hours} hrs</td>
                      <td className="py-3 font-bold text-slate-900">{a.units.toLocaleString()}</td>
                      <td className="py-3 font-bold text-emerald-700">{a.rate} /hr</td>
                      <td className="py-3 text-slate-500">{a.target_units ? a.target_units.toLocaleString() : "N/A"}</td>
                      <td className="py-3 font-bold">
                        {a.adherence !== null ? `${a.adherence}%` : "N/A"}
                      </td>
                      <td className="py-3">{statusBadge}</td>
                      <td className="py-3 pr-2 text-right">
                        <span className="text-[11px] font-bold text-[#214ECF] hover:underline flex items-center justify-end gap-1">
                          View <ChevronRight size={13} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No agent productivity records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 13. DAILY PRODUCTION ACTIVITY TABLE & FILTERS                                   */}
      {/* ============================================================================== */}
      <div className="rounded-2xl border border-[#E3EAF5] bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Production Activity</h3>
            <p className="text-xs text-slate-500">Authoritative log of all daily production output submissions</p>
          </div>

          {/* Filter Bar with Presets, Channel, Project, Status, Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              {/* Range Presets */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(["today", "7d", "30d", "90d"] as const).map((pr) => (
                  <button
                    key={pr}
                    onClick={() => handleDatePresetChange(pr)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase transition ${
                      dateRangePreset === pr
                        ? "bg-[#214ECF] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>

              {/* Date pickers */}
              <div className="flex items-center gap-1.5 rounded-xl border border-[#E3EAF5] px-3 py-1.5 bg-slate-50 text-xs">
                <span className="text-slate-400 font-bold">From:</span>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => {
                    setDateRangePreset("custom");
                    setDateRange({ ...dateRange, from: e.target.value });
                  }}
                  className="bg-transparent font-medium outline-none text-slate-700"
                />
                <span className="text-slate-400 font-bold">To:</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => {
                    setDateRangePreset("custom");
                    setDateRange({ ...dateRange, to: e.target.value });
                  }}
                  className="bg-transparent font-medium outline-none text-slate-700"
                />
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search agent or campaign..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 sm:w-60 rounded-xl border border-[#E3EAF5] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="rounded-xl border border-[#E3EAF5] px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
              >
                <option value="all">All Channels</option>
                <option value="Voice">Voice</option>
                <option value="Chat">Chat</option>
                <option value="Email">Email</option>
                <option value="Ticket">Ticket</option>
                <option value="Back Office">Back Office</option>
              </select>

              {/* Campaign Filter */}
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="rounded-xl border border-[#E3EAF5] px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
              >
                <option value="all">All Campaigns</option>
                {effectiveProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-[#E3EAF5] px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#214ECF]"
              >
                <option value="all">All Statuses</option>
                <option value="above_target">Above Target</option>
                <option value="on_target">On Target</option>
                <option value="below_target">Below Target</option>
                <option value="no_target">No Target Configured</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">Date</th>
                  <th className="pb-3">Agent</th>
                  <th className="pb-3">Project / Campaign</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Output Type</th>
                  <th className="pb-3">Units</th>
                  <th className="pb-3">Work Hours</th>
                  <th className="pb-3">Output Rate</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Adherence</th>
                  <th className="pb-3">Attendance</th>
                  <th className="pb-3 text-right pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  let statusBadge = (
                    <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      NO TARGET
                    </span>
                  );
                  if (r.adherence_status === "above_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        ABOVE TARGET
                      </span>
                    );
                  } else if (r.adherence_status === "on_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        ON TARGET
                      </span>
                    );
                  } else if (r.adherence_status === "below_target") {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        BELOW TARGET
                      </span>
                    );
                  }

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 pl-2 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {r.production_date}
                      </td>
                      <td className="py-3">
                        <span className="font-bold text-slate-900 block">{r.agent_name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{r.agent_code}</span>
                      </td>
                      <td className="py-3 font-medium text-slate-800 max-w-[200px] truncate">
                        {r.project_name}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {r.channel || r.process_type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{r.unit_type || "Units"}</td>
                      <td className="py-3 font-black text-slate-900">{r.units_completed}</td>
                      <td className="py-3 text-slate-600">{r.productive_hours}h</td>
                      <td className="py-3 font-bold text-emerald-700">{r.productivity_rate}/hr</td>
                      <td className="py-3 text-slate-500">{r.target_units ? r.target_units : "—"}</td>
                      <td className="py-3 font-bold">
                        {r.adherence_rate !== null ? `${r.adherence_rate}%` : "N/A"}
                      </td>
                      <td className="py-3">
                        {r.attendance_verified ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                            title="Work hours verified via attendance check-in"
                          >
                            <ShieldCheck size={11} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-2 text-right">{statusBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#214ECF] flex items-center justify-center mx-auto">
              <BarChart3 size={22} />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No production data yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Record daily production output to start tracking workforce productivity across active campaigns.
            </p>
            <button
              onClick={() => setEntryModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Plus size={14} />
              Log Daily Output
            </button>
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* 9. LOG DAILY OUTPUT MODAL (Connected to Attendance & Deduplication)             */}
      {/* ============================================================================== */}
      {entryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl border border-[#E3EAF5] bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Daily Output</h3>
                <p className="text-xs text-slate-500">Record workforce production output with attendance linkage</p>
              </div>
              <button
                onClick={() => setEntryModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {entryModalError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700 flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
                <span>{entryModalError}</span>
              </div>
            )}

            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Agent Selection */}
                <div>
                  <label htmlFor="agentSelect" className="block text-xs font-bold text-slate-700 mb-1">
                    Agent <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="agentSelect"
                    name="agent_id"
                    required
                    value={entryForm.agent_id}
                    onChange={(e) => setEntryForm({ ...entryForm, agent_id: e.target.value })}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                  >
                    <option value="">Select Partner Agent...</option>
                    {effectiveAgents.length > 0 ? (
                      effectiveAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.employee_id || a.agent_code || `THK-AGT-${a.id}`})
                        </option>
                      ))
                    ) : (
                      <option value="1">Aisha Khan (THK-AGT-00001)</option>
                    )}
                  </select>
                </div>

                {/* Campaign / Project Selection */}
                <div>
                  <label htmlFor="campaignSelect" className="block text-xs font-bold text-slate-700 mb-1">
                    Campaign / Project <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="campaignSelect"
                    name="project_id"
                    required
                    value={entryForm.project_id}
                    onChange={(e) => setEntryForm({ ...entryForm, project_id: e.target.value })}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                  >
                    <option value="">Select Allocated Project...</option>
                    {effectiveProjects.length > 0 ? (
                      effectiveProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    ) : (
                      <option value="1">Primary Omnichannel Support Campaign</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Production Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Production Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={entryForm.production_date}
                    onChange={(e) => setEntryForm({ ...entryForm, production_date: e.target.value })}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>

                {/* Channel */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Channel <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={entryForm.channel}
                    onChange={(e) => handleChannelChange(e.target.value as any)}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                  >
                    <option value="Voice">Voice</option>
                    <option value="Chat">Chat</option>
                    <option value="Email">Email</option>
                    <option value="Ticket">Ticket</option>
                    <option value="Back Office">Back Office</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Output Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Output Type <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={entryForm.output_type}
                    onChange={(e) => setEntryForm({ ...entryForm, output_type: e.target.value })}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>

                {/* Completed Units */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Completed Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={entryForm.units_completed}
                    onChange={(e) => setEntryForm({ ...entryForm, units_completed: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#214ECF]"
                  />
                </div>

                {/* Target Units */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shift Target (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={entryForm.target_units}
                    onChange={(e) => setEntryForm({ ...entryForm, target_units: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              {/* Attendance Verification Box & Productive Hours */}
              <div className="rounded-2xl border border-blue-100 bg-[#EEF5FF]/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock size={14} className="text-[#214ECF]" />
                    Productive Work Hours <span className="text-rose-500">*</span>
                  </label>

                  {checkingAttendance && (
                    <span className="text-[10px] text-blue-600 animate-pulse">Checking attendance...</span>
                  )}
                  {!checkingAttendance && attendanceInfo?.has_attendance && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      <ShieldCheck size={12} /> Verified Attendance: {attendanceInfo.working_hours} hrs
                    </span>
                  )}
                  {!checkingAttendance && attendanceInfo && !attendanceInfo.has_attendance && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      <AlertCircle size={11} /> Manual hours (no attendance check-in)
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="24"
                  required
                  value={entryForm.productive_hours}
                  onChange={(e) => setEntryForm({ ...entryForm, productive_hours: e.target.value })}
                  className="w-full rounded-xl border border-[#E3EAF5] bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#214ECF]"
                />
                <p className="text-[11px] text-slate-500">
                  Authoritative attendance logs feed the productive work hours automatically when verified.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operational Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  placeholder="Queue notes, shift details, or exceptions..."
                  className="w-full rounded-xl border border-[#E3EAF5] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  id="modalCancelBtn"
                  type="button"
                  onClick={() => setEntryModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  id="modalSaveProductionBtn"
                  type="submit"
                  disabled={submittingEntry}
                  className="flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submittingEntry ? "Saving..." : "Save Production"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 28. CAMPAIGN DETAIL DRAWER                                                     */}
      {/* ============================================================================== */}
      {selectedCampaignDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md h-full bg-white p-6 shadow-2xl overflow-y-auto space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#214ECF]">
                  Campaign Performance Detail
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedCampaignDetail.project_name}</h3>
              </div>
              <button
                onClick={() => setSelectedCampaignDetail(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Actual Output</span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {selectedCampaignDetail.actual_output.toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Target Output</span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {selectedCampaignDetail.target_output ? selectedCampaignDetail.target_output.toLocaleString() : "N/A"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Work Hours</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{selectedCampaignDetail.hours} hrs</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Output Rate</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">{selectedCampaignDetail.rate} /hr</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1">
                <span className="text-[11px] font-bold text-blue-900">SLA Adherence Status</span>
                <p className="text-sm font-black text-blue-950">
                  {selectedCampaignDetail.adherence !== null ? `${selectedCampaignDetail.adherence}% Attainment` : "No Target Configured"}
                </p>
                <p className="text-xs text-blue-700">
                  {selectedCampaignDetail.assigned_agents} active workforce agents participating in this campaign.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Recent Submissions For This Campaign
                </h4>
                <div className="space-y-2">
                  {records
                    .filter((r) => r.project_id === selectedCampaignDetail.project_id)
                    .slice(0, 5)
                    .map((r) => (
                      <div key={r.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 block">{r.agent_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{r.production_date} · {r.channel}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{r.units_completed} units</span>
                          <span className="text-[10px] font-bold text-emerald-600">{r.productivity_rate} /hr</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 29. AGENT DETAIL DRAWER                                                        */}
      {/* ============================================================================== */}
      {selectedAgentDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md h-full bg-white p-6 shadow-2xl overflow-y-auto space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[#214ECF] font-bold text-sm">
                  {selectedAgentDetail.agent_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedAgentDetail.agent_name}</h3>
                  <span className="font-mono text-xs text-slate-500">{selectedAgentDetail.agent_code}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgentDetail(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Output Units</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{selectedAgentDetail.units.toLocaleString()}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Work Hours</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{selectedAgentDetail.hours} hrs</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Productivity Rate</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">{selectedAgentDetail.rate} /hr</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Target Adherence</span>
                  <p className="text-xl font-black text-purple-900 mt-1">
                    {selectedAgentDetail.adherence !== null ? `${selectedAgentDetail.adherence}%` : "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800 block mb-1">Assigned Campaigns</span>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {selectedAgentDetail.projects || "None assigned"}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Recent Production Submissions
                </h4>
                <div className="space-y-2">
                  {records
                    .filter((r) => r.agent_id === selectedAgentDetail.agent_id)
                    .slice(0, 5)
                    .map((r) => (
                      <div key={r.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 block">{r.project_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{r.production_date} · {r.channel}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{r.units_completed} {r.unit_type}</span>
                          <span className="text-[10px] font-bold text-emerald-600">{r.productivity_rate} /hr</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
