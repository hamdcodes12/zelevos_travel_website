import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Ticket,
  AlertCircle,
  FileText,
  MessageSquare,
  Calendar,
  ShieldCheck,
  FolderKanban,
  Building2,
  UserCheck,
  FileCheck,
  Shield,
  Award,
  Layers,
  Sparkles,
  BarChart3,
  Cpu,
  Clock,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  Building,
  Users,
  GraduationCap,
  Files,
  Video,
  Briefcase,
  FileSpreadsheet,
  Store,
  Eye,
  Cable,
  Landmark,
  Receipt,
  CircleDollarSign,
  ArrowUpRight,
  Wallet,
  Users2,
  Search,
  X,
  RefreshCw,
  LayoutDashboard,
  Check,
  AlertTriangle,
  ChevronRight,
  Info,
  Copy,
  Lock,
  Sliders,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureRecord {
  key: string;
  name: string;
  category: "CORE PLATFORM" | "BPO OPERATIONS" | "FINANCE" | "GROWTH";
  description: string;
  icon: string;
  isCritical?: boolean;
  requiresConfig?: boolean;
  configStatus?: "ready" | "incomplete" | "configured" | "not_required";
  configDetails?: string;
  dependencies?: string[];
  dependents?: string[];
  endpointsGoverned: string[];
  enabled: boolean;
  status: "ACTIVE" | "DISABLED" | "CONFIGURATION_REQUIRED" | "RESTRICTED";
  updated_at: string | null;
  updated_by: number | null;
}

export interface FeatureSummary {
  totalFeatures: number;
  activeFeatures: number;
  disabledFeatures: number;
  requiresConfig: number;
  activePercent: number;
  disabledPercent: number;
  configPercent: number;
  categoryCounts: Record<string, { total: number; active: number }>;
}

export interface AuditRecord {
  id: number;
  timestamp: string;
  action: string;
  adminId: number;
  newState: string;
  previousState: string;
  adminUsername: string;
  reason: string;
}

interface AdminFeatureControlCentreProps {
  onNavigateToControlCentre?: () => void;
}

// Icon mapper helper
const ICON_MAP: Record<string, React.ElementType> = {
  CreditCard,
  Ticket,
  AlertCircle,
  FileText,
  MessageSquare,
  Calendar,
  ShieldCheck,
  FolderKanban,
  Building2,
  UserCheck,
  FileCheck,
  Shield,
  Award,
  Layers,
  Sparkles,
  BarChart3,
  Cpu,
  Clock,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  Building,
  Users,
  GraduationCap,
  Files,
  Video,
  Briefcase,
  FileSpreadsheet,
  Store,
  Eye,
  Cable,
  Landmark,
  Receipt,
  CircleDollarSign,
  ArrowUpRight,
  Wallet,
  Users2,
};

const CATEGORIES = ["ALL", "CORE PLATFORM", "BPO OPERATIONS", "FINANCE", "GROWTH"] as const;

export default function AdminFeatureControlCentre({
  onNavigateToControlCentre,
}: AdminFeatureControlCentreProps) {
  // ── States ─────────────────────────────────────────────────────────────────
  const [features, setFeatures] = useState<FeatureRecord[]>([]);
  const [summary, setSummary] = useState<FeatureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED" | "CONFIG">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORIES)[number]>("ALL");
  const [sortBy, setSortBy] = useState<"NAME" | "STATUS" | "CATEGORY" | "RECENT">("CATEGORY");

  // Drawer & Modals
  const [selectedFeature, setSelectedFeature] = useState<FeatureRecord | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<AuditRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Confirmation Modal
  const [pendingToggleFeature, setPendingToggleFeature] = useState<FeatureRecord | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const [toggling, setToggling] = useState(false);
  const [dependencyWarning, setDependencyWarning] = useState<string | null>(null);

  // ── Auth Helper ────────────────────────────────────────────────────────────
  const getAuthToken = () => {
    return typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
  };

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };
    const res = await fetch(`/api${path}`, { ...options, headers });
    return res;
  }, []);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [featRes, sumRes] = await Promise.all([
        apiFetch("/admin/features"),
        apiFetch("/admin/features/summary"),
      ]);

      if (!featRes.ok) {
        throw new Error("Unable to load platform feature catalog from database.");
      }

      const featData = await featRes.json();
      setFeatures(Array.isArray(featData) ? featData : []);

      if (sumRes.ok) {
        setSummary(await sumRes.json());
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load feature controls.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load audit history when drawer opens
  useEffect(() => {
    if (!selectedFeature) {
      setDrawerHistory([]);
      return;
    }
    let isMounted = true;
    setHistoryLoading(true);
    apiFetch(`/admin/features/${selectedFeature.key}/history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (isMounted) setDrawerHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (isMounted) setDrawerHistory([]);
      })
      .finally(() => {
        if (isMounted) setHistoryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFeature, apiFetch]);

  // ── Keyboard accessibility (Escape key closes drawer/modals) ───────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingToggleFeature) setPendingToggleFeature(null);
        else if (selectedFeature) setSelectedFeature(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingToggleFeature, selectedFeature]);

  // ── Safe Toggle Confirmation Flow ──────────────────────────────────────────
  const requestToggle = (feat: FeatureRecord) => {
    setDependencyWarning(null);
    setToggleReason("");

    // If disabling a feature with active dependents, warn immediately
    if (feat.enabled && feat.dependents && feat.dependents.length > 0) {
      setDependencyWarning(
        `Disabling this module will impact ${feat.dependents.length} active dependent module(s): ${feat.dependents.join(", ")}.`
      );
    }

    setPendingToggleFeature(feat);
  };

  const confirmToggle = async () => {
    if (!pendingToggleFeature) return;
    setToggling(true);
    setErrorMsg("");

    const targetEnabled = !pendingToggleFeature.enabled;
    const key = pendingToggleFeature.key;

    try {
      const res = await apiFetch(`/admin/features/${key}`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: targetEnabled,
          reason: toggleReason.trim() || (targetEnabled ? "Admin enabled module" : "Admin disabled module"),
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Failed to update module state.");
      }

      // Update local state deterministically from server response
      setFeatures((prev) =>
        prev.map((item) => (item.key === key ? { ...item, ...resData } : item))
      );

      // If drawer is open on this feature, update it too
      if (selectedFeature?.key === key) {
        setSelectedFeature((prev) => (prev ? { ...prev, ...resData } : null));
        // Refresh drawer history
        const histRes = await apiFetch(`/admin/features/${key}/history`);
        if (histRes.ok) setDrawerHistory(await histRes.json());
      }

      // Refresh dynamic summary
      const sumRes = await apiFetch("/admin/features/summary");
      if (sumRes.ok) setSummary(await sumRes.json());

      setSuccessToast(`Feature '${pendingToggleFeature.name}' is now ${targetEnabled ? "ACTIVE" : "DISABLED"}.`);
      setTimeout(() => setSuccessToast(""), 4000);
      setPendingToggleFeature(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to toggle feature");
    } finally {
      setToggling(false);
    }
  };

  // ── Manual Refresh ─────────────────────────────────────────────────────────
  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Filtered & Sorted Features ─────────────────────────────────────────────
  const filteredFeatures = useMemo(() => {
    return features.filter((feat) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = feat.name.toLowerCase().includes(query);
        const matchesKey = feat.key.toLowerCase().includes(query);
        const matchesDesc = feat.description.toLowerCase().includes(query);
        if (!matchesName && !matchesKey && !matchesDesc) return false;
      }

      // 2. Status Filter
      if (statusFilter === "ACTIVE" && !feat.enabled) return false;
      if (statusFilter === "DISABLED" && feat.enabled) return false;
      if (statusFilter === "CONFIG" && (!feat.requiresConfig || feat.configStatus !== "incomplete")) return false;

      // 3. Category Filter
      if (categoryFilter !== "ALL" && feat.category !== categoryFilter) return false;

      return true;
    });
  }, [features, searchQuery, statusFilter, categoryFilter]);

  // Group filtered features by Category
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, FeatureRecord[]> = {
      "CORE PLATFORM": [],
      "BPO OPERATIONS": [],
      "FINANCE": [],
      "GROWTH": [],
    };

    filteredFeatures.forEach((feat) => {
      if (groups[feat.category]) {
        groups[feat.category].push(feat);
      }
    });

    // Apply sorting within each group
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => {
        if (sortBy === "NAME") return a.name.localeCompare(b.name);
        if (sortBy === "STATUS") return (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1);
        if (sortBy === "RECENT") return (new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
        return 0;
      });
    });

    return groups;
  }, [filteredFeatures, sortBy]);

  // Copy Key to clipboard
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="feature-control-centre space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* ── 1. PREMIUM PAGE HEADER ── */}
      <div className="rounded-2xl border border-[#E5EAF3] bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[11px] font-bold tracking-wider text-[#214ECF] uppercase leading-none">
              <Sliders size={13} className="shrink-0" />
              <span>PLATFORM CONFIGURATION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1730] tracking-tight">
              Feature Control Centre
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Manage platform modules, operational capabilities and feature availability from one centralized control surface.
              All changes are backed by Supabase persistence and live backend authorization enforcement.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            {onNavigateToControlCentre && (
              <button
                type="button"
                onClick={onNavigateToControlCentre}
                className="h-10 px-4 rounded-xl border border-[#E5EAF3] bg-white text-xs font-bold text-slate-700 hover:text-[#214ECF] hover:bg-[#F8FAFC] hover:border-[#214ECF]/30 transition shadow-2xs cursor-pointer flex items-center justify-center gap-2 leading-none"
                title="Switch to Control Centre"
              >
                <LayoutDashboard size={15} className="text-[#214ECF] shrink-0" />
                <span>Control Centre</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="h-10 px-4 rounded-xl border border-[#E5EAF3] bg-white text-xs font-bold text-slate-700 hover:text-[#214ECF] hover:bg-[#F8FAFC] hover:border-[#214ECF]/30 transition shadow-2xs cursor-pointer flex items-center justify-center gap-2 leading-none disabled:opacity-50"
              title="Refresh feature states from Supabase database"
            >
              <RefreshCw size={14} className={`text-[#214ECF] shrink-0 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2"
            >
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg("")}
              className="text-rose-500 hover:text-rose-800 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── 2. FEATURE CONTROL OVERVIEW (SUMMARY KPIS) ── */}
      <div className="rounded-2xl border border-[#E5EAF3] bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-500">
              Platform Feature Status
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative module health and runtime enforcement across the platform</p>
          </div>
          {summary && (
            <div className="hidden sm:flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#214ECF]" />
                <span>Active ({summary.activePercent}%)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>Disabled ({summary.disabledPercent}%)</span>
              </div>
              {summary.requiresConfig > 0 && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Config Required ({summary.configPercent}%)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Distribution Progress Bar */}
        {summary && (
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-[#214ECF] transition-all duration-500"
              style={{ width: `${summary.activePercent}%` }}
              title={`Active: ${summary.activeFeatures} (${summary.activePercent}%)`}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${summary.configPercent}%` }}
              title={`Requires Configuration: ${summary.requiresConfig}`}
            />
            <div
              className="h-full bg-slate-300 transition-all duration-500"
              style={{ width: `${summary.disabledPercent}%` }}
              title={`Disabled: ${summary.disabledFeatures} (${summary.disabledPercent}%)`}
            />
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#E5EAF3] bg-[#F8FAFC] p-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Features</div>
            <div className="text-2xl font-black text-[#0B1730] mt-1">{summary?.totalFeatures ?? features.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Authoritative catalog modules</div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Active Features</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{summary?.activeFeatures ?? features.filter((f) => f.enabled).length}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Online &amp; accessible to users</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Disabled Features</div>
            <div className="text-2xl font-black text-slate-700 mt-1">{summary?.disabledFeatures ?? features.filter((f) => !f.enabled).length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Blocked by backend middleware</div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Requires Configuration</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{summary?.requiresConfig ?? features.filter((f) => f.requiresConfig && f.configStatus === "incomplete").length}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Missing API keys or credentials</div>
          </div>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTERS BAR ── */}
      <div className="rounded-2xl border border-[#E5EAF3] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="feature-search-input"
              data-testid="feature-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features by name, key, or description..."
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-[#E5EAF3] bg-[#F8FAFC] text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#214ECF] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "All" },
              { id: "ACTIVE", label: "Active" },
              { id: "DISABLED", label: "Disabled" },
              { id: "CONFIG", label: "Needs Config" },
            ].map(({ id, label }) => {
              const active = statusFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id as any)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shrink-0 leading-none ${
                    active
                      ? "bg-[#214ECF] text-white shadow-2xs"
                      : "bg-[#F8FAFC] text-slate-600 hover:bg-slate-100 border border-[#E5EAF3]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 rounded-xl border border-[#E5EAF3] bg-[#F8FAFC] text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:border-[#214ECF]"
            >
              <option value="CATEGORY">By Category</option>
              <option value="NAME">Name (A-Z)</option>
              <option value="STATUS">Status</option>
              <option value="RECENT">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#E5EAF3] overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Categories:</span>
          {CATEGORIES.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer flex items-center justify-center leading-none ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. CATEGORY GROUPED FEATURE CARDS ── */}
      {loading ? (
        <div className="space-y-8 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-48 rounded-lg bg-slate-200" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-40 rounded-2xl border border-slate-200 bg-white p-5 space-y-3" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredFeatures.length === 0 ? (
        <div className="rounded-2xl border border-[#E5EAF3] bg-white p-12 text-center space-y-3">
          <Sliders className="mx-auto text-slate-300" size={36} />
          <h3 className="text-base font-bold text-slate-800">No matching platform features found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your search query, status filters, or category selection to see features.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              setCategoryFilter("ALL");
            }}
            className="h-9 px-4 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-[#1A3DB3] transition inline-flex items-center justify-center gap-1.5 cursor-pointer leading-none"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {(Object.keys(groupedFeatures) as Array<keyof typeof groupedFeatures>).map((catName) => {
            const groupList = groupedFeatures[catName];
            if (groupList.length === 0) return null;

            const activeCount = groupList.filter((f) => f.enabled).length;

            return (
              <div key={catName} className="space-y-4">
                {/* Category Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#0B1730]">
                      {catName}
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400">
                      ({activeCount} of {groupList.length} active)
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-[#214ECF] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                    {Math.round((activeCount / groupList.length) * 100)}% Available
                  </div>
                </div>

                {/* Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupList.map((feat) => {
                    const IconComponent = ICON_MAP[feat.icon] || Sliders;
                    const isEnabled = feat.enabled;

                    return (
                      <div
                        key={feat.key}
                        id={`feature-card-${feat.key}`}
                        data-testid={`feature-card-${feat.key}`}
                        onClick={() => setSelectedFeature(feat)}
                        className={`feature-card group relative rounded-2xl border p-5 transition-all duration-200 cursor-pointer bg-white flex flex-col justify-between ${
                          isEnabled
                            ? "border-[#E5EAF3] hover:border-[#214ECF]/40 hover:shadow-md"
                            : "border-slate-200/80 bg-slate-50/40 opacity-80 hover:opacity-100 hover:border-slate-300"
                        }`}
                      >
                        {/* Top: Icon + Title + Switch */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            {/* Icon Box */}
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                                isEnabled
                                  ? "bg-blue-50 border-blue-100 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white"
                                  : "bg-slate-100 border-slate-200 text-slate-400"
                              }`}
                            >
                              <IconComponent size={20} className="shrink-0" />
                            </div>

                            {/* Centered Switch */}
                            <div className="flex items-center justify-center pt-0.5">
                              <button
                                type="button"
                                role="switch"
                                id={`switch-${feat.key}`}
                                data-testid={`toggle-${feat.key}`}
                                aria-checked={isEnabled}
                                aria-label={`Toggle ${feat.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestToggle(feat);
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#214ECF]/30 ${
                                  isEnabled
                                    ? "bg-[#214ECF] border-[#214ECF]"
                                    : "bg-slate-200 border-slate-200"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    isEnabled ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Titles & Description */}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-[#0B1730] group-hover:text-[#214ECF] transition-colors leading-snug">
                                {feat.name}
                              </h4>
                              {feat.isCritical && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                  <Lock size={10} />
                                  Critical
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate" title={feat.key}>
                              {feat.key}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                              {feat.description}
                            </p>
                          </div>
                        </div>

                        {/* Bottom: Status Badge + Detail Prompt */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            {isEnabled ? (
                              feat.requiresConfig && feat.configStatus === "incomplete" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertCircle size={11} className="shrink-0" />
                                  Config Required
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Disabled
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-[#214ECF] transition-colors">
                            <span>Details</span>
                            <ChevronRight size={13} className="shrink-0" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. FEATURE DETAILS DRAWER ── */}
      <AnimatePresence>
        {selectedFeature && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFeature(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 cursor-pointer"
            />

            {/* Right-Side Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#E5EAF3] bg-white flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#214ECF] border border-blue-100">
                      {selectedFeature.category}
                    </span>
                    {selectedFeature.isCritical && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        Critical Subsystem
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold text-[#0B1730]">
                    {selectedFeature.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {selectedFeature.key}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(selectedFeature.key)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="Copy Feature Key"
                    >
                      {copiedKey ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedFeature(null)}
                  className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Description Box */}
                <div className="rounded-xl border border-[#E5EAF3] bg-[#F8FAFC] p-4 text-xs text-slate-700 leading-relaxed">
                  <div className="font-bold text-slate-900 mb-1">Operational Purpose</div>
                  {selectedFeature.description}
                </div>

                {/* Status & Control Banner */}
                <div className="rounded-xl border border-[#E5EAF3] p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Module Status</div>
                    <div className="text-base font-extrabold text-[#0B1730] mt-0.5 flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          selectedFeature.enabled ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      <span>{selectedFeature.enabled ? "ACTIVE (ONLINE)" : "DISABLED (OFFLINE)"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestToggle(selectedFeature)}
                    className={`h-9 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer leading-none ${
                      selectedFeature.enabled
                        ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        : "bg-[#214ECF] text-white hover:bg-[#1A3DB3] shadow-xs"
                    }`}
                  >
                    {selectedFeature.enabled ? "Disable Module" : "Enable Module"}
                  </button>
                </div>

                {/* Feature Behavior Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Feature Behavior &amp; Enforcement
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-[#E5EAF3] p-3.5 bg-white space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">Frontend UI</div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${selectedFeature.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                        {selectedFeature.enabled ? "Rendered & Active" : "Hidden / Inactive"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E5EAF3] p-3.5 bg-white space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">Backend API Protection</div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-[#214ECF]" />
                        <span>Enforced (403 on off)</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E5EAF3] p-3.5 bg-white space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">Database Persistence</div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Check size={14} className="text-emerald-600" />
                        <span>Supabase Authoritative</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E5EAF3] p-3.5 bg-white space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">Configuration Status</div>
                      <div className="font-bold text-slate-900">
                        {selectedFeature.requiresConfig && selectedFeature.configStatus === "incomplete" ? (
                          <span className="text-amber-700 flex items-center gap-1">
                            <AlertCircle size={13} /> Incomplete
                          </span>
                        ) : (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={13} /> Configured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Requirements Note if incomplete */}
                {selectedFeature.requiresConfig && selectedFeature.configDetails && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs space-y-1">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Info size={14} />
                      Required Configuration
                    </div>
                    <p className="text-amber-800">{selectedFeature.configDetails}</p>
                  </div>
                )}

                {/* Dependencies & Dependents */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    System Dependencies
                  </h4>
                  <div className="rounded-xl border border-[#E5EAF3] p-4 bg-white space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold">Prerequisites:</span>{" "}
                      {selectedFeature.dependencies && selectedFeature.dependencies.length > 0 ? (
                        <span className="font-mono text-slate-800 font-bold">
                          {selectedFeature.dependencies.join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">None (Standalone Module)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Dependents:</span>{" "}
                      {selectedFeature.dependents && selectedFeature.dependents.length > 0 ? (
                        <span className="text-[#214ECF] font-bold">
                          {selectedFeature.dependents.join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No modules depend on this</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Governed Endpoints */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Governed API Endpoints
                  </h4>
                  <div className="rounded-xl border border-[#E5EAF3] p-3 bg-[#F8FAFC] space-y-1.5">
                    {selectedFeature.endpointsGoverned.map((ep) => (
                      <div key={ep} className="font-mono text-[11px] text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                        {ep}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit History / Recent Changes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Recent Audit History
                    </h4>
                    <span className="text-[10px] text-slate-400">From Supabase audit_logs</span>
                  </div>

                  {historyLoading ? (
                    <div className="text-xs text-slate-400 italic py-4 text-center">Loading audit history...</div>
                  ) : drawerHistory.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-400 text-center">
                      No changes recorded yet for this module.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#E5EAF3] divide-y divide-slate-100 bg-white overflow-hidden text-xs">
                      {drawerHistory.map((item) => (
                        <div key={item.id} className="p-3.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                item.newState === "ON"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              State: {item.newState}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-700 font-medium">
                            {item.reason}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            By Admin: <strong className="text-slate-600">{item.adminUsername || `Admin #${item.adminId}`}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#E5EAF3] bg-[#F8FAFC] flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Last updated: {selectedFeature.updated_at ? new Date(selectedFeature.updated_at).toLocaleDateString() : "System default"}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedFeature(null)}
                  className="h-9 px-4 rounded-xl border border-[#E5EAF3] bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center leading-none"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 6. SAFE CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {pendingToggleFeature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !toggling && setPendingToggleFeature(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl z-50 space-y-4 border border-[#E5EAF3]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    pendingToggleFeature.enabled ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-[#214ECF]"
                  }`}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0B1730]">
                    {pendingToggleFeature.enabled ? "Disable Feature?" : "Enable Feature?"}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    {pendingToggleFeature.name}
                  </p>
                </div>
              </div>

              {/* Warning Text */}
              <div className="text-xs text-slate-600 leading-relaxed bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E5EAF3]">
                {pendingToggleFeature.enabled ? (
                  <p>
                    Disabling this feature will reject incoming requests on governed API endpoints and hide related capabilities
                    from the frontend.
                  </p>
                ) : (
                  <p>
                    Enabling this feature will immediately restore live API routes and user interface capabilities.
                  </p>
                )}
              </div>

              {/* Dependency Warning */}
              {dependencyWarning && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{dependencyWarning}</span>
                </div>
              )}

              {/* Optional Reason */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Audit Reason (Optional)
                </label>
                <input
                  type="text"
                  value={toggleReason}
                  onChange={(e) => setToggleReason(e.target.value)}
                  placeholder="e.g. Scheduled maintenance, deployment change..."
                  className="w-full h-9 px-3 rounded-xl border border-[#E5EAF3] bg-white text-xs outline-none focus:border-[#214ECF]"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={toggling}
                  onClick={() => setPendingToggleFeature(null)}
                  className="h-9 px-4 rounded-xl border border-[#E5EAF3] bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center leading-none"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={toggling}
                  onClick={confirmToggle}
                  className={`h-9 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer leading-none ${
                    pendingToggleFeature.enabled
                      ? "bg-rose-600 text-white hover:bg-rose-700 shadow-2xs"
                      : "bg-[#214ECF] text-white hover:bg-[#1A3DB3] shadow-2xs"
                  }`}
                >
                  {toggling && <RefreshCw size={12} className="animate-spin" />}
                  <span>{pendingToggleFeature.enabled ? "Confirm & Disable" : "Confirm & Enable"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
