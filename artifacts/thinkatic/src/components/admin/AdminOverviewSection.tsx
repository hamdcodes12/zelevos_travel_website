import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  TrendingUp,
  Clock,
  Sparkles,
  Calendar,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  Building2,
  Send,
  PieChart as PieChartIcon,
  BarChart2,
  ArrowUpRight,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import AnimatedCounter from "./AnimatedCounter";
import AdminLeadDetailDrawer, { SubmissionItem } from "./AdminLeadDetailDrawer";

interface LeadAnalyticsData {
  kpis: {
    totalLeads: number;
    newToday: number;
    thisWeek: number;
    newLeads: number;
  };
  timeline: Array<{
    date: string;
    dateLabel: string;
    count: number;
    newCount: number;
    contactedCount: number;
    qualifiedCount: number;
    proposalCount: number;
    convertedCount: number;
    lostCount: number;
    leads: any[];
  }>;
  pipeline: Array<{
    key: string;
    name: string;
    count: number;
    color: string;
  }>;
  recentInquiries: SubmissionItem[];
}

export interface NavigateToLeadsOptions {
  status?: string;
  statusFilter?: string;
  date?: string;
  dateFilter?: string;
  search?: string;
}

interface AdminOverviewSectionProps {
  onNavigateToLeads?: (options?: NavigateToLeadsOptions) => void;
  onRefreshParent?: () => void;
  refreshTrigger?: number;
}

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

export function AdminOverviewSection({
  onNavigateToLeads,
  onRefreshParent,
  refreshTrigger,
}: AdminOverviewSectionProps) {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "90d" | "custom">("7d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [data, setData] = useState<LeadAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SubmissionItem | null>(null);
  const [activeDataPoint, setActiveDataPoint] = useState<any | null>(null);
  const [chartViewMode, setChartViewMode] = useState<"all" | "new">("all");

  const token = localStorage.getItem("admin_token");

  const fetchAnalytics = useCallback(
    async (showRefreshSpinner = false) => {
      try {
        if (showRefreshSpinner) setRefreshing(true);
        else setLoading(true);

        const params = new URLSearchParams();
        params.set("range", range);
        if (range === "custom" && customStartDate && customEndDate) {
          params.set("startDate", customStartDate);
          params.set("endDate", customEndDate);
        }

        const res = await fetch(`/api/admin/leads/analytics?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load lead analytics:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, customStartDate, customEndDate, token]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchAnalytics(true);
    }
  }, [refreshTrigger, fetchAnalytics]);

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartDate && customEndDate) {
      fetchAnalytics();
    }
  };

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
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead({ ...selectedLead, status: updated.status });
        }
        await fetchAnalytics(true);
        if (onRefreshParent) onRefreshParent();
      }
    } catch (err) {
      console.error("Failed to update lead status:", err);
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
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead({ ...selectedLead, notes: updated.notes });
        }
        await fetchAnalytics(true);
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
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(result.submission);
        }
        await fetchAnalytics(true);
      }
    } catch (err) {
      console.error("Failed to assign lead:", err);
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
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(result.submission);
        }
        await fetchAnalytics(true);
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
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead(result.submission);
        }
        await fetchAnalytics(true);
        if (onRefreshParent) onRefreshParent();
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
        setSelectedLead(null);
        await fetchAnalytics(true);
        if (onRefreshParent) onRefreshParent();
      }
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  };

  // Safe defaults from real data
  const kpis = data?.kpis || {
    totalLeads: 0,
    newToday: 0,
    thisWeek: 0,
    newLeads: 0,
  };

  const timelineData = data?.timeline || [];
  const pipelineData = data?.pipeline || [];
  const recentInquiries = data?.recentInquiries || [];
  const totalPipelineCount = pipelineData.reduce((sum, item) => sum + item.count, 0);

  // Custom Chart Tooltip
  const CustomGraphTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl text-xs border border-slate-800 space-y-1.5 min-w-[190px]">
          <div className="font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-1">
            <span>{item.dateLabel}</span>
            <span className="text-[11px] text-[#47A3FF] font-mono">{item.date}</span>
          </div>
          <div className="flex justify-between items-center pt-0.5">
            <span className="text-slate-400">Total Inquiries:</span>
            <span className="font-bold text-white text-sm">{item.count}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-blue-400">New:</span>
              <span className="font-semibold text-slate-200">{item.newCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-indigo-400">Contacted:</span>
              <span className="font-semibold text-slate-200">{item.contactedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-400">Qualified:</span>
              <span className="font-semibold text-slate-200">{item.qualifiedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Converted:</span>
              <span className="font-semibold text-slate-200">{item.convertedCount}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 italic pt-1 text-center">
            Click data point to inspect leads
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* ── TOP KPI CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all group flex flex-col items-center justify-center text-center min-h-[145px]"
        >
          <div className="inline-flex items-center justify-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-100/70 group-hover:bg-[#214ECF] group-hover:text-white transition-all">
              <Users size={13} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-[#214ECF] transition-colors">
              Total Leads
            </span>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight my-1">
            <AnimatedCounter value={kpis.totalLeads} />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Authoritative database records
          </div>
        </motion.div>

        {/* New Today */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all group flex flex-col items-center justify-center text-center min-h-[145px]"
        >
          <div className="inline-flex items-center justify-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-100/70 group-hover:bg-[#214ECF] group-hover:text-white transition-all">
              <Clock size={13} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-[#214ECF] transition-colors">
              New Today
            </span>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight my-1">
            <AnimatedCounter value={kpis.newToday} />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Submitted during current day
          </div>
        </motion.div>

        {/* This Week */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all group flex flex-col items-center justify-center text-center min-h-[145px]"
        >
          <div className="inline-flex items-center justify-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-100/70 group-hover:bg-[#214ECF] group-hover:text-white transition-all">
              <TrendingUp size={13} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-[#214ECF] transition-colors">
              This Week
            </span>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight my-1">
            <AnimatedCounter value={kpis.thisWeek} />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Active 7-day rolling intake
          </div>
        </motion.div>

        {/* New Leads */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all group flex flex-col items-center justify-center text-center min-h-[145px]"
        >
          <div className="inline-flex items-center justify-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/80 group-hover:bg-amber-600 group-hover:text-white transition-all">
              <Sparkles size={13} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-[#214ECF] transition-colors">
              New Leads
            </span>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight my-1">
            <AnimatedCounter value={kpis.newLeads} />
          </div>
          <div className="text-xs text-amber-700 font-semibold flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Awaiting initial contact</span>
          </div>
        </motion.div>
      </div>

      {/* ── MIDDLE ROW: INTERACTIVE LEAD ACTIVITY GRAPH + PIPELINE DONUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Interactive Lead Activity Graph */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Lead Activity</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#214ECF] border border-blue-200/60">
                    Live Stream
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual intake volume reflecting real-time database submissions
                </p>
              </div>

              {/* Range Selector Controls */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
                {(["today", "7d", "30d", "90d", "custom"] as const).map((rKey) => (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => setRange(rKey)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      range === rKey
                        ? "bg-white text-[#214ECF] shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {rKey === "today"
                      ? "Today"
                      : rKey === "7d"
                      ? "7 Days"
                      : rKey === "30d"
                      ? "30 Days"
                      : rKey === "90d"
                      ? "90 Days"
                      : "Custom Range"}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range Sub-bar */}
            {range === "custom" && (
              <form
                onSubmit={handleApplyCustomRange}
                className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-wrap items-center gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-slate-700">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    required
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#214ECF]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-slate-700">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    required
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#214ECF]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#214ECF] text-white hover:bg-[#1a3db3] transition-colors cursor-pointer"
                >
                  Apply Range
                </button>
              </form>
            )}
          </div>

          {/* Interactive Recharts Chart */}
          <div className="h-64 mt-4 w-full relative">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                <RefreshCw size={16} className="animate-spin text-[#214ECF]" />
                <span>Loading activity stream...</span>
              </div>
            ) : timelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                <BarChart2 size={24} className="text-slate-300 mb-1" />
                <span>No historical data available for this range</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      setActiveDataPoint(e.activePayload[0].payload);
                    }
                  }}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="leadActivityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#214ECF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#214ECF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <RechartsTooltip content={<CustomGraphTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#214ECF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#leadActivityGradient)"
                    activeDot={{ r: 6, fill: "#214ECF", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Drill-down info card if a point was clicked */}
          <AnimatePresence>
            {activeDataPoint && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mt-3 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white text-[#214ECF] flex items-center justify-center font-bold border border-blue-200">
                    {activeDataPoint.count}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      {activeDataPoint.dateLabel} ({activeDataPoint.date})
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-3">
                      <span>New: <strong>{activeDataPoint.newCount}</strong></span>
                      <span>Contacted: <strong>{activeDataPoint.contactedCount}</strong></span>
                      <span>Qualified: <strong>{activeDataPoint.qualifiedCount}</strong></span>
                      <span>Won: <strong>{activeDataPoint.convertedCount}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToLeads?.({
                        date: activeDataPoint.date,
                        dateFilter: activeDataPoint.date,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#214ECF] text-white hover:bg-[#1a3db3] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Leads</span>
                    <ArrowUpRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDataPoint(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Lead Pipeline Donut Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Lead Pipeline</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage distribution from live intake
                </p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <PieChartIcon size={15} />
              </div>
            </div>

            {/* Donut Chart */}
            <div className="h-48 relative flex items-center justify-center mt-2">
              {totalPipelineCount === 0 ? (
                <div className="text-xs text-slate-400">No lead pipeline records</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        onClick={(entry) => {
                          if (entry && entry.key) {
                            onNavigateToLeads?.({
                              status: entry.key,
                              statusFilter: entry.key,
                            });
                          }
                        }}
                        cursor="pointer"
                      >
                        {pipelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any) => [`${val} Leads`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Donut Center Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900">
                      <AnimatedCounter value={totalPipelineCount} />
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Total
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend List */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
            {pipelineData.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigateToLeads?.({ status: item.key, statusFilter: item.key })}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-blue-50/50 transition-colors text-left group cursor-pointer border border-transparent hover:border-blue-100"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="font-semibold text-slate-700 group-hover:text-[#214ECF] truncate">
                    {item.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900 ml-2">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── RECENT INQUIRIES & SUBMISSIONS SECTION ────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Inquiries & Submissions
            </h2>
            <p className="text-xs text-slate-500">
              Newest incoming customer leads directly from website contact endpoints
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToLeads?.()}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#214ECF] bg-blue-50 hover:bg-[#214ECF] hover:text-white border border-blue-200/60 hover:border-[#214ECF] transition-all duration-200 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#214ECF]/30"
          >
            <span>View All Leads</span>
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-xs divide-y divide-slate-100">
          {recentInquiries.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No submissions yet. Share your contact form to start receiving leads.
            </div>
          ) : (
            recentInquiries.map((s) => (
              <div
                key={s.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 cursor-pointer transition-all duration-200 hover:bg-blue-50/30 border-l-4 border-l-transparent hover:border-l-[#214ECF]"
                onClick={() => setSelectedLead(s)}
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-blue-50 text-[#214ECF] border border-blue-100 group-hover:bg-[#214ECF] group-hover:text-white transition-colors flex-shrink-0">
                    {s.name ? s.name.charAt(0).toUpperCase() : "L"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-sm group-hover:text-[#214ECF] transition-colors truncate">
                      {s.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                      <span>{s.email}</span>
                      {s.company && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="font-medium text-slate-600">{s.company}</span>
                        </>
                      )}
                      {s.source && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 capitalize">
                            {s.source.replace(/_/g, " ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Budget, Status, Date, Action */}
                <div className="flex items-center gap-3.5 flex-shrink-0 justify-between sm:justify-end">
                  {s.budget && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/80 hidden sm:inline-block shadow-2xs">
                      {s.budget}
                    </span>
                  )}

                  <StatusBadge status={s.status} />

                  <span className="text-xs text-slate-400 font-medium hidden md:inline-block">
                    {new Date(s.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLead(s);
                    }}
                    className="w-9 h-9 min-w-unset min-h-unset rounded-lg flex items-center justify-center text-[#214ECF] bg-blue-50/70 hover:bg-[#214ECF] hover:text-white border border-blue-100 transition-all duration-200 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#214ECF]/30"
                    style={{ minWidth: 36, minHeight: 36 }}
                    title="View Lead"
                    aria-label="View Lead"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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

export default AdminOverviewSection;
