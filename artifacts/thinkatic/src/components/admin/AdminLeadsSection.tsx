import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  ChevronDown,
  X,
  Calendar,
  DollarSign,
  Building2,
  Mail,
  Send,
  Eye,
  CheckCircle2,
  TrendingUp,
  Tag,
  Clock,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import AdminLeadDetailDrawer, { SubmissionItem } from "./AdminLeadDetailDrawer";
import AnimatedCounter from "./AnimatedCounter";

interface AdminLeadsSectionProps {
  initialStatusFilter?: string;
  initialDateFilter?: string;
  onRefreshStats?: () => void;
  refreshTrigger?: number;
}

const STATUS_OPTIONS = [
  { key: "all", label: "All Statuses" },
  { key: "new", label: "New Inquiries" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal Sent" },
  { key: "closed_won", label: "Closed / Converted" },
  { key: "closed_lost", label: "Closed / Lost" },
];

const BUDGET_OPTIONS = [
  { key: "all", label: "All Budgets" },
  { key: "under_15k", label: "< $15,000", match: ["$5,000–$15,000", "$5,000-$15,000", "<$15k"] },
  { key: "15k_50k", label: "$15,000 – $50,000", match: ["$15,000–$50,000", "$15,000-$50,000"] },
  { key: "above_50k", label: "> $50,000", match: ["$50,000+", "$50,000–$100,000", ">$50k"] },
];

const STATUS_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: "#EFF4FF", text: "#214ECF", border: "#BFDBFE" },
  contacted: { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  qualified: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  proposal: { bg: "#F3E8FF", text: "#7E22CE", border: "#E9D5FF" },
  closed_won: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  closed_lost: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const conf = STATUS_BADGE_STYLES[normalized] || {
    bg: "#F8FAFC",
    text: "#475569",
    border: "#E2E8F0",
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize border shadow-2xs"
      style={{ background: conf.bg, color: conf.text, borderColor: conf.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: conf.text }} />
      {status === "closed_won" ? "Converted" : status === "closed_lost" ? "Lost" : status.replace("_", " ")}
    </span>
  );
}

export function AdminLeadsSection({
  initialStatusFilter = "all",
  initialDateFilter = "",
  onRefreshStats,
  refreshTrigger,
}: AdminLeadsSectionProps) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [budgetFilter, setBudgetFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(initialDateFilter);
  const [selectedLead, setSelectedLead] = useState<SubmissionItem | null>(null);

  // Trend graph state inside Leads
  const [trendRange, setTrendRange] = useState<"7d" | "30d" | "90d">("7d");
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [showTrendGraph, setShowTrendGraph] = useState(true);

  const token = localStorage.getItem("admin_token");

  // Load all submissions and trend data
  const loadLeads = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) setRefreshing(true);
      else setLoading(true);

      const [subsRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/submissions?limit=500", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/leads/analytics?range=${trendRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (subsRes.ok) {
        const json = await subsRes.json();
        setSubmissions(json);
      }

      if (analyticsRes.ok) {
        const aJson = await analyticsRes.json();
        setTimelineData(aJson.timeline || []);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, trendRange]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (initialStatusFilter !== undefined && initialStatusFilter !== null) {
      setStatusFilter(initialStatusFilter || "all");
    } else {
      setStatusFilter("all");
    }
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialDateFilter !== undefined && initialDateFilter !== null) {
      setDateFilter(initialDateFilter);
    } else {
      setDateFilter("");
    }
  }, [initialDateFilter]);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadLeads(true);
    }
  }, [refreshTrigger, loadLeads]);

  // Lead actions
  const handleStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: updated.status } : s))
        );
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead({ ...selectedLead, status: updated.status });
        }
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleSaveNote = async (id: number, notes: string) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, notes: updated.notes } : s))
        );
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead({ ...selectedLead, notes: updated.notes });
        }
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    }
  };

  const handleAssign = async (id: number, assignee: string) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignedTo: assignee }),
      });
      if (res.ok) {
        const result = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? result.submission : s))
        );
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(result.submission);
        }
      }
    } catch (err) {
      console.error("Failed to assign:", err);
    }
  };

  const handleScheduleFollowUp = async (id: number, date: string, notes?: string) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/follow-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ followUpDate: date, notes }),
      });
      if (res.ok) {
        const result = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? result.submission : s))
        );
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(result.submission);
        }
      }
    } catch (err) {
      console.error("Failed to schedule follow-up:", err);
    }
  };

  const handleConvert = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const result = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? result.submission : s))
        );
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(result.submission);
        }
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error("Failed to convert lead:", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(null);
        }
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  };

  const exportCSV = () => {
    window.open(`/api/admin/submissions-export`, "_blank");
  };

  // Distinct sources for filter dropdown
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      if (s.source) set.add(s.source);
    });
    return Array.from(set);
  }, [submissions]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return submissions.filter((lead) => {
      // 1. Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          lead.name.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          (lead.company && lead.company.toLowerCase().includes(q)) ||
          lead.message.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Status filter
      if (statusFilter !== "all") {
        if (lead.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // 3. Source filter
      if (sourceFilter !== "all") {
        if (lead.source !== sourceFilter) return false;
      }

      // 4. Budget filter
      if (budgetFilter !== "all") {
        const bOpt = BUDGET_OPTIONS.find((b) => b.key === budgetFilter);
        if (bOpt && bOpt.match) {
          if (!lead.budget || !bOpt.match.some((m) => lead.budget?.includes(m))) return false;
        }
      }

      // 5. Date filter (from drilldown: YYYY-MM-DD)
      if (dateFilter) {
        const leadIso = new Date(lead.createdAt).toISOString().split("T")[0];
        if (leadIso !== dateFilter) return false;
      }

      return true;
    });
  }, [submissions, search, statusFilter, sourceFilter, budgetFilter, dateFilter]);

  return (
    <div className="space-y-6">
      {/* ── TOP ACTION BAR ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#214ECF] border border-blue-200/60 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF] animate-pulse" />
            Inbound Pipeline
          </span>
          <span className="text-xs text-slate-500">
            {filteredLeads.length} of {submissions.length} leads
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTrendGraph(!showTrendGraph)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border ${
              showTrendGraph
                ? "bg-blue-50 text-[#214ECF] border-blue-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <TrendingUp size={13} />
            <span>{showTrendGraph ? "Hide Trend" : "Show Trend"}</span>
          </button>

          <button
            type="button"
            onClick={() => loadLeads(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-[#214ECF]" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-[#214ECF] hover:bg-blue-50 border border-[#214ECF]/30 hover:border-[#214ECF] transition-all cursor-pointer shadow-2xs"
            title="Export CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── INTERACTIVE LEAD TREND GRAPH (EXPANDABLE) ─────────────────── */}
      <AnimatePresence>
        {showTrendGraph && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs overflow-hidden space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#214ECF]" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Lead Volume Trend
                </span>
                <span className="text-[11px] text-slate-400">
                  (Click any day to filter leads)
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                {(["7d", "30d", "90d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTrendRange(r)}
                    className={`px-2.5 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      trendRange === r
                        ? "bg-white text-[#214ECF] shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      setDateFilter(e.activePayload[0].payload.date);
                    }
                  }}
                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="leadTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#214ECF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#214ECF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tick={{ fontSize: 10, fill: "#64748B" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tick={{ fontSize: 10, fill: "#64748B" }}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => [`${val} Leads`, "Count"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#214ECF"
                    strokeWidth={2}
                    fill="url(#leadTrendGrad)"
                    activeDot={{ r: 5, fill: "#214ECF" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEARCH & MULTI-FILTER CONTROL BAR ─────────────────────────── */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#214ECF] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name, email, company, inquiry keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs text-slate-900 bg-slate-50 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="relative min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] cursor-pointer"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#214ECF] pointer-events-none"
            />
          </div>

          {/* Budget Range Dropdown */}
          <div className="relative min-w-[150px]">
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] cursor-pointer"
            >
              {BUDGET_OPTIONS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none"
            />
          </div>

          {/* Source Dropdown */}
          {availableSources.length > 0 && (
            <div className="relative min-w-[140px]">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] cursor-pointer capitalize"
              >
                <option value="all">All Sources</option>
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}
        </div>

        {/* Active Filters Pill Bar */}
        {(statusFilter !== "all" || budgetFilter !== "all" || sourceFilter !== "all" || dateFilter || search) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold text-[11px]">Active Filters:</span>

            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#214ECF] font-semibold text-[11px] border border-blue-200">
                <span>Status: {STATUS_OPTIONS.find((s) => s.key === statusFilter)?.label}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="hover:text-blue-900 cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {budgetFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                <span>Budget: {BUDGET_OPTIONS.find((b) => b.key === budgetFilter)?.label}</span>
                <button
                  type="button"
                  onClick={() => setBudgetFilter("all")}
                  className="hover:text-emerald-900 cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {sourceFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200 capitalize">
                <span>Source: {sourceFilter.replace(/_/g, " ")}</span>
                <button
                  type="button"
                  onClick={() => setSourceFilter("all")}
                  className="hover:text-slate-900 cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {dateFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200">
                <span>Date: {dateFilter}</span>
                <button
                  type="button"
                  onClick={() => setDateFilter("")}
                  className="hover:text-amber-900 cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setBudgetFilter("all");
                setSourceFilter("all");
                setDateFilter("");
              }}
              className="text-[#214ECF] hover:underline font-semibold text-[11px] ml-auto cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* ── LEADS LIST ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs">
            <RefreshCw size={24} className="animate-spin text-[#214ECF] mx-auto mb-2" />
            <div className="text-xs text-slate-500 font-medium">Loading authoritative leads...</div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#214ECF] flex items-center justify-center mx-auto border border-blue-100">
              <Search size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900">No leads match your criteria</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search terms, changing the status filter, or clearing date selections.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setBudgetFilter("all");
                setSourceFilter("all");
                setDateFilter("");
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-[#214ECF] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const isSelected = selectedLead?.id === lead.id;
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4.5 bg-white border border-slate-200/90 rounded-2xl cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:bg-blue-50/25 border-l-4 ${
                  isSelected
                    ? "border-l-[#214ECF] bg-blue-50/30 shadow-xs"
                    : "border-l-transparent hover:border-l-[#214ECF]"
                }`}
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm bg-blue-50 text-[#214ECF] border border-blue-100 flex-shrink-0 shadow-2xs group-hover:bg-[#214ECF] group-hover:text-white transition-all duration-200">
                    {lead.name ? lead.name.charAt(0).toUpperCase() : "L"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm group-hover:text-[#214ECF] transition-colors truncate">
                        {lead.name}
                      </span>
                      {lead.company && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 truncate max-w-[200px]">
                          <Building2 size={11} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{lead.company}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-2">
                      <span className="truncate">{lead.email}</span>
                      {lead.source && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 capitalize">
                            {lead.source.replace(/_/g, " ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Commercials, Status, Date, Actions */}
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {lead.budget && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                      <DollarSign size={12} className="text-emerald-600" />
                      <span>{lead.budget}</span>
                    </span>
                  )}

                  <StatusBadge status={lead.status} />

                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    <span>
                      {new Date(lead.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLead(lead);
                      }}
                      className="w-9 h-9 min-w-unset min-h-unset rounded-lg flex items-center justify-center text-[#214ECF] bg-blue-50/70 hover:bg-[#214ECF] hover:text-white border border-blue-100 transition-all duration-200 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#214ECF]/30"
                      style={{ minWidth: 36, minHeight: 36 }}
                      title="View Lead"
                      aria-label="View Lead"
                    >
                      <Eye size={16} />
                    </button>
                    <a
                      href={`mailto:${lead.email}?subject=${encodeURIComponent(
                        "Thinkatic Enterprise Consultation - Follow-up"
                      )}`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-9 h-9 min-w-unset min-h-unset rounded-lg flex items-center justify-center text-[#214ECF] bg-blue-50/70 hover:bg-[#214ECF] hover:text-white border border-blue-100 transition-all duration-200 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#214ECF]/30"
                      style={{ minWidth: 36, minHeight: 36 }}
                      title="Send Follow-up"
                      aria-label="Send Follow-up"
                    >
                      <Send size={15} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── LEAD DETAILS DRAWER MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {selectedLead && (
          <AdminLeadDetailDrawer
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onStatusChange={handleStatusChange}
            onSaveNote={handleSaveNote}
            onAssign={handleAssign}
            onScheduleFollowUp={handleScheduleFollowUp}
            onConvert={handleConvert}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminLeadsSection;
