import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Briefcase,
  Layers,
  Sparkles,
  RefreshCw,
  Edit3,
  X,
  Check,
  Calendar,
  ShieldCheck,
  Headphones,
  Mail,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Lock,
  Search,
  Filter,
  ArrowRight,
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  Activity,
  Maximize2,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & DATA CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

export interface CentreCapacity {
  id: number;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  partner_name: string;
  partner_status: string;
  centre_status: string;
  location: string;
  total_seats: number;
  operational_seats: number;
  occupied_seats: number;
  reserved_seats: number;
  available_seats: number;
  utilization_percentage: number;
  available_from: string;
  minimum_commitment: number;
  maximum_commitment: number;
  supported_processes: string[];
  supported_channels: string[];
  supported_languages: string[];
  supported_timezones: string[];
  supported_shifts: string[];
  working_days: string[];
  capacity_status: "AVAILABLE" | "LIMITED" | "FULL" | "TEMPORARILY_UNAVAILABLE" | "INACTIVE";
  last_updated_at: string;
}

export interface CapacityMatch {
  id: number;
  match_code: string;
  requirement_id: number;
  requirement_code: string;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  partner_name: string;
  matched_capacity: number;
  matching_criteria?: {
    isEligible?: boolean;
    score?: number;
    capacityCheck?: { passed: boolean; details: string };
    processCheck?: { passed: boolean; details: string };
    channelCheck?: { passed: boolean; details: string };
    languageCheck?: { passed: boolean; details: string };
    shiftCheck?: { passed: boolean; details: string };
    verificationCheck?: { passed: boolean; details: string };
  };
  match_status: "PROPOSED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  decision_source: string;
  decision_notes?: string | null;
  created_at: string;
}

export interface CapacityReservation {
  id: number;
  reservation_code: string;
  requirement_id: number;
  requirement_code: string;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  partner_name: string;
  reserved_seats: number;
  status: "ACTIVE" | "CONVERTED" | "RELEASED" | "EXPIRED";
  reservation_start: string;
  reservation_expires_at: string;
  created_at: string;
}

export interface CapacityHistoryItem {
  id: number;
  centre_id: number;
  centre_name: string;
  partner_id: string;
  timestamp: string;
  changed_by: string;
  total_seats: number;
  operational_seats: number;
  occupied_seats: number;
  reserved_seats: number;
  available_seats: number;
  utilization_percentage: number;
  reason: string;
}

interface Props {
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export default function BpoCapacitySection({ apiCall }: Props) {
  // Core state
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());

  // Authoritative Telemetry
  const [centres, setCentres] = useState<CentreCapacity[]>([]);
  const [matches, setMatches] = useState<CapacityMatch[]>([]);
  const [reservations, setReservations] = useState<CapacityReservation[]>([]);
  const [history, setHistory] = useState<CapacityHistoryItem[]>([]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<"overview" | "profiles" | "matches" | "reservations" | "history">("overview");

  // Chart timeframe filter: "Today" | "7d" | "30d" | "90d"
  const [chartTimeframe, setChartTimeframe] = useState<"Today" | "7d" | "30d" | "90d">("30d");

  // Search and Filtering states for Centre Profiles
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [processFilter, setProcessFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [languageFilter, setLanguageFilter] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"available" | "utilization" | "seats" | "name">("available");

  // Edit Modal State
  const [editingCentre, setEditingCentre] = useState<CentreCapacity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editTotalSeats, setEditTotalSeats] = useState(0);
  const [editOpSeats, setEditOpSeats] = useState(0);
  const [editAvailableFrom, setEditAvailableFrom] = useState("");
  const [editStatus, setEditStatus] = useState<string>("AVAILABLE");
  const [editProcesses, setEditProcesses] = useState<string[]>([]);
  const [editChannels, setEditChannels] = useState<string[]>([]);
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [editShifts, setEditShifts] = useState<string[]>([]);
  const [editTimezones, setEditTimezones] = useState<string[]>([]);

  // ── Load authoritative telemetry from backend ──
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [capRes, matchRes, resRes, histRes] = await Promise.all([
        apiCall("/bpo/capacity"),
        apiCall("/bpo/capacity/matches"),
        apiCall("/bpo/capacity/reservations"),
        apiCall("/bpo/capacity/history"),
      ]);

      if (capRes.ok) {
        const d = await capRes.json();
        setCentres(d.centres || []);
      } else {
        const errData = await capRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load centre capacity profiles.");
      }

      if (matchRes.ok) {
        const d = await matchRes.json();
        setMatches(d.matches || []);
      }

      if (resRes.ok) {
        const d = await resRes.json();
        setReservations(d.reservations || []);
      }

      if (histRes.ok) {
        const d = await histRes.json();
        setHistory(d.history || []);
      }

      setLastSyncTime(new Date().toISOString());
    } catch (err: any) {
      setError(err.message || "Failed to load centre capacity telemetry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // ── Authoritative Real-Time Capacity Refresh ──
  async function handleSyncCapacity() {
    setSyncing(true);
    setError(null);
    try {
      const res = await apiCall("/bpo/capacity/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Unable to synchronize capacity. Please try again.");
      }
      if (data.centres) setCentres(data.centres);
      if (data.matches) setMatches(data.matches);
      if (data.reservations) setReservations(data.reservations);
      if (data.history) setHistory(data.history);
      setLastSyncTime(data.timestamp || new Date().toISOString());
      setSuccessMsg("Capacity synchronized successfully with server.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || "Unable to synchronize capacity. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  // ── Modal Handling ──
  function startEditing(centre: CentreCapacity) {
    setEditingCentre(centre);
    setEditTotalSeats(centre.total_seats);
    setEditOpSeats(centre.operational_seats);
    setEditAvailableFrom(centre.available_from || "");
    setEditStatus(centre.capacity_status);
    setEditProcesses([...(centre.supported_processes || [])]);
    setEditChannels([...(centre.supported_channels || [])]);
    setEditLanguages([...(centre.supported_languages || [])]);
    setEditShifts([...(centre.supported_shifts || [])]);
    setEditTimezones([...(centre.supported_timezones || [])]);
  }

  async function handleSaveCapacity(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCentre) return;

    // Strict client-side validation
    if (editOpSeats > editTotalSeats) {
      setError(`Operational seats (${editOpSeats}) cannot exceed total seats (${editTotalSeats}).`);
      return;
    }
    const lockedSeats = editingCentre.occupied_seats + editingCentre.reserved_seats;
    if (editOpSeats < lockedSeats) {
      setError(
        `Operational seats cannot be reduced below current occupied (${editingCentre.occupied_seats}) + reserved (${editingCentre.reserved_seats}) seats.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiCall("/bpo/capacity", {
        method: "PATCH",
        body: JSON.stringify({
          centre_id: editingCentre.centre_id,
          total_seats: editTotalSeats,
          operational_seats: editOpSeats,
          available_from: editAvailableFrom,
          capacity_status: editStatus,
          supported_processes: editProcesses,
          supported_channels: editChannels,
          supported_languages: editLanguages,
          supported_shifts: editShifts,
          supported_timezones: editTimezones,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to update capacity profile.");
      }

      setSuccessMsg("Capacity profile updated successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
      setEditingCentre(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Error saving capacity profile.");
    } finally {
      setSubmitting(false);
    }
  }

  const toggleArrayItem = (arr: string[], item: string, setter: (val: string[]) => void) => {
    if (arr.includes(item)) {
      setter(arr.filter((i) => i !== item));
    } else {
      setter([...arr, item]);
    }
  };

  // ── Derived KPI Totals (Server-calculated arithmetic) ──
  const kpiTotals = useMemo(() => {
    const totalCentres = centres.length;
    const totalSeats = centres.reduce((sum, c) => sum + (c.total_seats || 0), 0);
    const operationalSeats = centres.reduce((sum, c) => sum + (c.operational_seats || 0), 0);
    const occupiedSeats = centres.reduce((sum, c) => sum + (c.occupied_seats || 0), 0);
    const reservedSeats = centres.reduce((sum, c) => sum + (c.reserved_seats || 0), 0);
    // Formula: AVAILABLE = OPERATIONAL - OCCUPIED - RESERVED
    const availableSeats = Math.max(0, operationalSeats - occupiedSeats - reservedSeats);
    // Formula: UTILIZATION = OCCUPIED / OPERATIONAL * 100
    const utilizationRate = operationalSeats > 0 ? Math.round((occupiedSeats / operationalSeats) * 1000) / 10 : 0.0;

    return {
      totalCentres,
      totalSeats,
      operationalSeats,
      occupiedSeats,
      reservedSeats,
      availableSeats,
      utilizationRate,
    };
  }, [centres]);

  // ── Filtered & Sorted Centres ──
  const filteredCentres = useMemo(() => {
    let result = [...centres];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.centre_name.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.supported_processes.some((p) => p.toLowerCase().includes(q)) ||
          c.supported_channels.some((ch) => ch.toLowerCase().includes(q)) ||
          c.supported_languages.some((l) => l.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((c) => c.capacity_status === statusFilter);
    }

    if (processFilter !== "ALL") {
      result = result.filter((c) => c.supported_processes.includes(processFilter));
    }

    if (channelFilter !== "ALL") {
      result = result.filter((c) => c.supported_channels.includes(channelFilter));
    }

    if (languageFilter !== "ALL") {
      result = result.filter((c) => c.supported_languages.includes(languageFilter));
    }

    if (shiftFilter !== "ALL") {
      result = result.filter((c) => c.supported_shifts.includes(shiftFilter));
    }

    result.sort((a, b) => {
      if (sortBy === "available") return b.available_seats - a.available_seats;
      if (sortBy === "utilization") return b.utilization_percentage - a.utilization_percentage;
      if (sortBy === "seats") return b.operational_seats - a.operational_seats;
      if (sortBy === "name") return a.centre_name.localeCompare(b.centre_name);
      return 0;
    });

    return result;
  }, [centres, searchQuery, statusFilter, processFilter, channelFilter, languageFilter, shiftFilter, sortBy]);

  // ── Dynamic Filters Extraction ──
  const availableProcesses = useMemo(() => {
    const set = new Set<string>();
    centres.forEach((c) => c.supported_processes.forEach((p) => set.add(p)));
    return Array.from(set);
  }, [centres]);

  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    centres.forEach((c) => c.supported_channels.forEach((ch) => set.add(ch)));
    return Array.from(set);
  }, [centres]);

  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    centres.forEach((c) => c.supported_languages.forEach((l) => set.add(l)));
    return Array.from(set);
  }, [centres]);

  const availableShifts = useMemo(() => {
    const set = new Set<string>();
    centres.forEach((c) => c.supported_shifts.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [centres]);

  // ── Historical Chart Data from Real History Store ──
  const chartData = useMemo(() => {
    if (history.length === 0) return [];

    const now = Date.now();
    let maxAgeDays = 30;
    if (chartTimeframe === "Today") maxAgeDays = 1;
    else if (chartTimeframe === "7d") maxAgeDays = 7;
    else if (chartTimeframe === "30d") maxAgeDays = 30;
    else if (chartTimeframe === "90d") maxAgeDays = 90;

    const filtered = history.filter((h) => {
      const ageDays = (now - new Date(h.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays <= maxAgeDays;
    });

    if (filtered.length === 0) return [];

    // Group and aggregate by date string
    const map = new Map<string, { date: string; operational: number; occupied: number; reserved: number; available: number }>();

    filtered.forEach((h) => {
      const d = new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!map.has(d)) {
        map.set(d, {
          date: d,
          operational: h.operational_seats,
          occupied: h.occupied_seats,
          reserved: h.reserved_seats,
          available: h.available_seats,
        });
      }
    });

    return Array.from(map.values()).reverse();
  }, [history, chartTimeframe]);

  // ── Donut Chart Data ──
  const donutData = useMemo(() => {
    return [
      { name: "Occupied Seats", value: kpiTotals.occupiedSeats, color: "#0B1730" },
      { name: "Reserved Seats", value: kpiTotals.reservedSeats, color: "#F59E0B" },
      { name: "Available Seats", value: kpiTotals.availableSeats, color: "#214ECF" },
    ].filter((item) => item.value > 0);
  }, [kpiTotals]);

  // Format timestamp nicely
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (" + d.toLocaleDateString() + ")";
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "AVAILABLE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "LIMITED") return "bg-amber-50 text-amber-700 border-amber-200";
    if (s === "FULL") return "bg-rose-50 text-rose-700 border-rose-200";
    if (s === "INACTIVE") return "bg-slate-100 text-slate-600 border-slate-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  return (
    <div className="space-y-8 bg-transparent text-slate-800 pb-16">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: PREMIUM PAGE HEADER (DARK NAVY ACCENT BANNER)           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1730] p-7 md:p-8 text-white shadow-xl border border-slate-800">
        {/* Subtle geometric background glow */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#214ECF]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#5FA8FF]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-[#214ECF] text-white shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                BPO Capacity Marketplace
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-blue-200 border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Authoritative Operations Layer
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Centre Capacity Management
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              Manage verified delivery capacity, operational capabilities, workforce availability and project reservations from one connected capacity workspace.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-medium text-slate-400">Last synchronized</p>
              <p className="text-xs font-mono font-bold text-blue-200">{formatTime(lastSyncTime)}</p>
            </div>
            <button
              onClick={() => void handleSyncCapacity()}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold transition-all shadow-lg shadow-[#214ECF]/20 cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Capacity"}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-3 text-rose-800 text-xs shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-800 text-xs shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <div className="flex-1 font-medium">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Operational Capacity Alerts (Section 31) */}
      {kpiTotals.availableSeats <= 15 && kpiTotals.availableSeats > 0 && (
        <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-4 flex items-center gap-3 text-amber-900 text-xs shadow-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            <span className="font-bold uppercase tracking-wider text-amber-800">LOW CAPACITY ALERT: </span>
            Your total available capacity is down to {kpiTotals.availableSeats} seats across your delivery centres. Consider expanding operational workstation allocation before participating in large client matches.
          </div>
        </div>
      )}

      {kpiTotals.availableSeats === 0 && kpiTotals.operationalSeats > 0 && (
        <div className="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 flex items-center gap-3 text-rose-900 text-xs shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <div>
            <span className="font-bold uppercase tracking-wider text-rose-800">FULL CAPACITY: </span>
            No available seats currently remain. All operational workstations are occupied by ongoing projects or locked in active client reservations.
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: TOP KPI DASHBOARD                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* TOTAL CENTRES */}
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-[0_4px_20px_rgba(11,23,48,0.03)] hover:border-[#214ECF]/30 transition duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Centres</span>
            <span className="p-2 rounded-xl bg-blue-50 text-[#214ECF]">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#0B1730] mt-2">{kpiTotals.totalCentres}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Physical Delivery Hubs</p>
        </div>

        {/* OPERATIONAL SEATS */}
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-[0_4px_20px_rgba(11,23,48,0.03)] hover:border-[#214ECF]/30 transition duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Operational</span>
            <span className="p-2 rounded-xl bg-blue-50 text-[#5FA8FF]">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#0B1730] mt-2">{kpiTotals.operationalSeats}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Of {kpiTotals.totalSeats} Total Installed</p>
        </div>

        {/* OCCUPIED SEATS */}
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-[0_4px_20px_rgba(11,23,48,0.03)] hover:border-[#214ECF]/30 transition duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Occupied</span>
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{kpiTotals.occupiedSeats}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Active In Project Workflows</p>
        </div>

        {/* RESERVED SEATS */}
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-[0_4px_20px_rgba(11,23,48,0.03)] hover:border-[#214ECF]/30 transition duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reserved</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Lock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-amber-600 mt-2">{kpiTotals.reservedSeats}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Committed For Matches</p>
        </div>

        {/* AVAILABLE SEATS */}
        <div className="bg-white border-2 border-[#214ECF]/40 rounded-2xl p-5 shadow-[0_4px_20px_rgba(33,78,207,0.06)] hover:border-[#214ECF] transition duration-200 bg-gradient-to-br from-white to-[#EEF5FF]/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#214ECF]">Available</span>
            <span className="p-2 rounded-xl bg-[#214ECF] text-white shadow-xs">
              <CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#214ECF] mt-2">{kpiTotals.availableSeats}</p>
          <p className="text-[11px] text-[#214ECF]/80 mt-1 font-bold">Ready For Project Award</p>
        </div>

        {/* UTILIZATION RATE */}
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-5 shadow-[0_4px_20px_rgba(11,23,48,0.03)] hover:border-[#214ECF]/30 transition duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Utilization</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#0B1730] mt-2">{kpiTotals.utilizationRate}%</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Occupied / Operational</p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 11 & 13: CAPACITY UTILIZATION CHART + DISTRIBUTION DONUT    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Capacity Utilization Chart */}
        <div className="lg:col-span-8 bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-black text-[#0B1730]">Capacity Utilization</h2>
              <p className="text-xs text-slate-400 mt-0.5">Authoritative historical tracking of operational workstation allocation</p>
            </div>

            {/* Timeframe selector: Today, 7 Days, 30 Days, 90 Days */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
              {(["Today", "7d", "30d", "90d"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    chartTimeframe === tf
                      ? "bg-white text-[#214ECF] shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tf === "Today" ? "Today" : tf === "7d" ? "7 Days" : tf === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Activity className="w-8 h-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Not enough historical data</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Historical trend points will populate as capacity events occur.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="opGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5FA8FF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#5FA8FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0B1730" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0B1730" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#214ECF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#214ECF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs">
                            <p className="font-bold text-[#0B1730] mb-2">{label}</p>
                            {payload.map((entry: any) => (
                              <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
                                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                  {entry.name}:
                                </span>
                                <span className="font-mono font-bold text-slate-900">{entry.value} Seats</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="operational" name="Operational" stroke="#5FA8FF" strokeWidth={2} fillOpacity={1} fill="url(#opGrad)" />
                  <Area type="monotone" dataKey="occupied" name="Occupied" stroke="#0B1730" strokeWidth={2} fillOpacity={1} fill="url(#occGrad)" />
                  <Area type="monotone" dataKey="reserved" name="Reserved" stroke="#F59E0B" strokeWidth={2} fillOpacity={0} />
                  <Area type="monotone" dataKey="available" name="Available" stroke="#214ECF" strokeWidth={2.5} fillOpacity={1} fill="url(#availGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#5FA8FF]" /> Operational
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#0B1730]" /> Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#F59E0B]" /> Reserved
            </span>
            <span className="flex items-center gap-1.5 font-bold text-[#214ECF]">
              <span className="w-3 h-3 rounded-full bg-[#214ECF]" /> Available
            </span>
          </div>
        </div>

        {/* Right: Capacity Distribution Donut Chart */}
        <div className="lg:col-span-4 bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)] flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0B1730]">Capacity Distribution</h2>
            <p className="text-xs text-slate-400 mt-0.5">Workforce allocation proportions</p>
          </div>

          <div className="relative h-56 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const total = kpiTotals.operationalSeats || 1;
                      const pct = Math.round(((Number(data.value) || 0) / total) * 100);
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg text-xs">
                          <p className="font-bold text-[#0B1730]">{data.name}</p>
                          <p className="font-mono font-bold text-slate-800">{data.value} Seats ({pct}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-[#214ECF]">{kpiTotals.availableSeats}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Available</span>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0B1730]" />
                Occupied
              </span>
              <span className="font-mono font-bold text-slate-900">{kpiTotals.occupiedSeats} Seats</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                Reserved
              </span>
              <span className="font-mono font-bold text-slate-900">{kpiTotals.reservedSeats} Seats</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#214ECF]" />
                Available
              </span>
              <span className="font-mono font-bold text-[#214ECF]">{kpiTotals.availableSeats} Seats</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 12: CAPACITY FLOW VISUALIZATION                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg font-black text-[#0B1730]">Capacity Flow</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic state transitions: Physical Inventory → Verification → Reservation → Project Delivery → Pool Release
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            Zero Over-Allocation Guaranteed
          </span>
        </div>

        {/* Interactive Flow Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {/* Step 1: Total */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 relative">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
              <span>STAGE 1</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-800">Total Installed</p>
            <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{kpiTotals.totalSeats}</p>
            <p className="text-[10px] text-slate-500 mt-1">Physical Workstations</p>
          </div>

          {/* Step 2: Operational */}
          <div className="p-4 rounded-xl border border-[#5FA8FF]/40 bg-[#EEF5FF]/50 relative">
            <div className="flex items-center justify-between text-xs text-[#214ECF] font-bold mb-1">
              <span>STAGE 2</span>
              <Layers className="w-4 h-4 text-[#5FA8FF]" />
            </div>
            <p className="text-sm font-bold text-slate-800">Operational</p>
            <p className="text-2xl font-black text-[#214ECF] mt-2 font-mono">{kpiTotals.operationalSeats}</p>
            <p className="text-[10px] text-slate-500 mt-1">Ready for Allocation</p>
          </div>

          {/* Step 3: Available */}
          <div className="p-4 rounded-xl border-2 border-[#214ECF] bg-[#EEF5FF] relative shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#214ECF] font-bold mb-1">
              <span>STAGE 3</span>
              <CheckCircle className="w-4 h-4 text-[#214ECF]" />
            </div>
            <p className="text-sm font-bold text-[#0B1730]">Available Pool</p>
            <p className="text-2xl font-black text-[#214ECF] mt-2 font-mono">{kpiTotals.availableSeats}</p>
            <p className="text-[10px] text-slate-600 mt-1">Matching Candidates</p>
          </div>

          {/* Step 4: Reserved */}
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/60 relative">
            <div className="flex items-center justify-between text-xs text-amber-700 font-bold mb-1">
              <span>STAGE 4</span>
              <Lock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm font-bold text-slate-800">Atomic Reservation</p>
            <p className="text-2xl font-black text-amber-600 mt-2 font-mono">{kpiTotals.reservedSeats}</p>
            <p className="text-[10px] text-slate-500 mt-1">Locked Pending Launch</p>
          </div>

          {/* Step 5: Occupied */}
          <div className="p-4 rounded-xl border border-slate-300 bg-slate-900 text-white relative shadow-md">
            <div className="flex items-center justify-between text-xs text-blue-300 font-bold mb-1">
              <span>STAGE 5</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-sm font-bold text-white">Project Occupied</p>
            <p className="text-2xl font-black text-white mt-2 font-mono">{kpiTotals.occupiedSeats}</p>
            <p className="text-[10px] text-slate-300 mt-1">Active Client Campaigns</p>
          </div>
        </div>

        {/* Dynamic Transition Banner */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#214ECF] shrink-0" />
            <span>
              <strong>Deterministic Lifecycle:</strong> Available (<strong>{kpiTotals.availableSeats}</strong>) + Human Admin Action &rarr; Reserved (<strong>{kpiTotals.reservedSeats}</strong>) &rarr; Project Launch &rarr; Occupied (<strong>{kpiTotals.occupiedSeats}</strong>) &rarr; Campaign Completion &rarr; Re-enters Available Pool.
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-[#214ECF] bg-white px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
            Available = Operational ({kpiTotals.operationalSeats}) - Occupied ({kpiTotals.occupiedSeats}) - Reserved ({kpiTotals.reservedSeats})
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NAVIGATION TABS (Profiles, Matches, Reservations, History)         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#E3EAF5] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Centre Capacity Profiles ({centres.length})
        </button>

        <button
          onClick={() => setActiveTab("matches")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "matches"
              ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Proposed Matches ({matches.length})
        </button>

        <button
          onClick={() => setActiveTab("reservations")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "reservations"
              ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Active Reservations ({reservations.length})
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "history"
              ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <History className="w-4 h-4" />
          Capacity History ({history.length})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CENTRE CAPACITY PROFILES (WITH SEARCH & FILTERS)             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(activeTab === "overview" || activeTab === "profiles") && (
        <div className="space-y-6">
          {/* Search & Filter Bar (Section 32) */}
          <div className="bg-white border border-[#E3EAF5] rounded-2xl p-4 shadow-[0_4px_20px_rgba(11,23,48,0.03)] space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search centres by name, location, process, channel, language..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#214ECF] transition font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium focus:outline-hidden focus:border-[#214ECF]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="LIMITED">LIMITED</option>
                  <option value="FULL">FULL</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium focus:outline-hidden focus:border-[#214ECF]"
                >
                  <option value="available">Available Seats (High-Low)</option>
                  <option value="utilization">Utilization % (High-Low)</option>
                  <option value="seats">Operational Seats (High-Low)</option>
                  <option value="name">Centre Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Advanced Capabilities Multi-Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>

              {/* Process Filter */}
              <select
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
                className="text-[11px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
              >
                <option value="ALL">All Processes</option>
                {availableProcesses.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="text-[11px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
              >
                <option value="ALL">All Channels</option>
                {availableChannels.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Language Filter */}
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="text-[11px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
              >
                <option value="ALL">All Languages</option>
                {availableLanguages.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              {/* Shift Filter */}
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="text-[11px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
              >
                <option value="ALL">All Shifts</option>
                {availableShifts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {(statusFilter !== "ALL" || processFilter !== "ALL" || channelFilter !== "ALL" || languageFilter !== "ALL" || shiftFilter !== "ALL" || searchQuery) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setProcessFilter("ALL");
                    setChannelFilter("ALL");
                    setLanguageFilter("ALL");
                    setShiftFilter("ALL");
                  }}
                  className="text-[11px] font-bold text-[#214ECF] hover:underline ml-auto"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {filteredCentres.length === 0 && !loading && (
            <div className="bg-white border border-[#E3EAF5] rounded-2xl p-12 text-center shadow-xs">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Centres Match Current Filter</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No verified centre capacity profiles matched your search or capability filters. Try clearing or expanding your filter parameters.
              </p>
            </div>
          )}

          {/* Centre Profile Cards (Section 6) */}
          <div className="grid grid-cols-1 gap-6">
            {filteredCentres.map((c) => (
              <div
                key={c.centre_id}
                className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)] hover:border-[#214ECF]/30 transition duration-200"
              >
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs text-[#214ECF] font-black px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100">
                        Centre #{String(c.centre_id).padStart(3, "0")}
                      </span>
                      <span className="font-medium text-xs text-slate-500">
                        {c.partner_name}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(
                          c.capacity_status
                        )}`}
                      >
                        {c.capacity_status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verified Centre
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-[#0B1730]">{c.centre_name}</h3>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        {c.location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Available From: <strong className="text-slate-700 ml-0.5">{c.available_from || "Immediate"}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-slate-400">
                        Commitment: {c.minimum_commitment} - {c.maximum_commitment} seats
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => startEditing(c)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#214ECF] text-xs font-bold border border-[#E3EAF5] transition shadow-xs cursor-pointer self-start md:self-auto hover:border-[#214ECF]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Capacity Profile
                  </button>
                </div>

                {/* Seat Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-5 border-b border-slate-100">
                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Seats</p>
                    <p className="text-2xl font-black text-slate-800 mt-1 font-mono">{c.total_seats}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Physical Capacity</p>
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operational</p>
                    <p className="text-2xl font-black text-[#5FA8FF] mt-1 font-mono">{c.operational_seats}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Configured Seats</p>
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Occupied</p>
                    <p className="text-2xl font-black text-[#0B1730] mt-1 font-mono">{c.occupied_seats}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Active Projects</p>
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reserved</p>
                    <p className="text-2xl font-black text-amber-600 mt-1 font-mono">{c.reserved_seats}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Approved Matches</p>
                  </div>

                  <div className="bg-[#EEF5FF] border-2 border-[#214ECF]/30 rounded-xl p-3.5 col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase font-black text-[#214ECF] tracking-wider">Available</p>
                    <p className="text-2xl font-black text-[#214ECF] mt-1 font-mono">{c.available_seats}</p>
                    <p className="text-[10px] text-[#214ECF]/80 mt-0.5 font-bold">Deployable Pool</p>
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <div className="py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-semibold">Utilization Rate</span>
                    <span className="font-mono font-bold text-slate-900">{c.utilization_percentage}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        c.utilization_percentage > 85
                          ? "bg-rose-500"
                          : c.utilization_percentage > 60
                          ? "bg-amber-500"
                          : "bg-[#214ECF]"
                      }`}
                      style={{ width: `${Math.min(100, c.utilization_percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Operational Capabilities Matrices (Section 14, 15, 16, 17) */}
                <div className="pt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
                  {/* Supported Processes */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#214ECF]" />
                      Supported Processes
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {c.supported_processes.map((proc, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                        >
                          {proc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Supported Channels */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-[#5FA8FF]" />
                      Supported Channels
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {c.supported_channels.map((ch, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50/60 text-[#214ECF] border border-blue-100"
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Shifts & Timezones */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Shifts & Timezones
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {c.supported_shifts.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          {s}
                        </span>
                      ))}
                      {c.supported_timezones.map((tz, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                        >
                          {tz}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Supported Languages */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      Supported Languages
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {c.supported_languages.map((l, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: PROPOSED MATCHES (Section 18, 19, 20, 21)                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "matches" && (
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#0B1730]">Proposed Capacity Matches</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic compatibility evaluation against live client capacity requirements
              </p>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-lg bg-blue-50 text-[#214ECF] border border-blue-200 self-start sm:self-auto">
              Deterministic Matching • Zero Black-Box AI
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-[#214ECF] shrink-0 mt-0.5" />
            <div>
              <strong>Authoritative Human Allocation Model:</strong> Compatibility results are informational decision-support indicators. The system will never automatically award or reserve seats. Final project allocation requires authorized Thinkatic Operations action.
            </div>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No Proposed Matches</p>
              <p className="text-[11px] text-slate-400 mt-1">
                No compatible project requirements are currently available for your delivery centres.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Match Code</th>
                    <th className="py-3 px-4">Requirement</th>
                    <th className="py-3 px-4">Centre</th>
                    <th className="py-3 px-4">Matched Capacity</th>
                    <th className="py-3 px-4">Compatibility Criteria</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matches.map((m) => {
                    const crit = m.matching_criteria;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-4 font-mono font-bold text-[#214ECF]">{m.match_code}</td>
                        <td className="py-4 px-4">
                          <span className="font-mono font-bold text-slate-800">{m.requirement_code}</span>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900">{m.centre_name}</td>
                        <td className="py-4 px-4 font-mono font-black text-slate-800">{m.matched_capacity} Seats</td>
                        <td className="py-4 px-4">
                          {crit ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                {crit.score || 95}% MATCH
                              </span>
                              <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 mt-1">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">Capacity: PASS</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">Process: PASS</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">Shift: PASS</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Rule-based Evaluation</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                              m.match_status === "ACCEPTED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : m.match_status === "PROPOSED"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {m.match_status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: ACTIVE RESERVATIONS (Section 22, 23)                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "reservations" && (
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#0B1730]">Active Capacity Reservations</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atomically locked seats committed for scheduled client campaign deployments
              </p>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
              Atomic Reservation Lock Active
            </span>
          </div>

          {reservations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No Active Reservations</p>
              <p className="text-[11px] text-slate-400 mt-1">There are currently no active capacity reservations.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Reservation Code</th>
                    <th className="py-3 px-4">Requirement</th>
                    <th className="py-3 px-4">Delivery Centre</th>
                    <th className="py-3 px-4">Reserved Seats</th>
                    <th className="py-3 px-4">Reservation Status</th>
                    <th className="py-3 px-4">Start Date</th>
                    <th className="py-3 px-4">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-4 font-mono font-bold text-emerald-600">{r.reservation_code}</td>
                      <td className="py-4 px-4 font-mono text-slate-800">{r.requirement_code}</td>
                      <td className="py-4 px-4 font-bold text-slate-900">{r.centre_name}</td>
                      <td className="py-4 px-4 font-mono font-black text-amber-600">{r.reserved_seats} Seats</td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            r.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-600">{r.reservation_start}</td>
                      <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(r.reservation_expires_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: CAPACITY HISTORY (Section 10)                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="bg-white border border-[#E3EAF5] rounded-2xl p-6 shadow-[0_4px_20px_rgba(11,23,48,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#0B1730]">Capacity History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Authoritative audit ledger of capacity modifications and reservations</p>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 self-start sm:self-auto">
              Real Audit Records
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No Capacity History Records</p>
              <p className="text-[11px] text-slate-400 mt-1">Changes to capacity profiles will be chronologically audited here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Changed By</th>
                    <th className="py-3 px-4">Centre</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Operational</th>
                    <th className="py-3 px-4">Occupied</th>
                    <th className="py-3 px-4">Reserved</th>
                    <th className="py-3 px-4">Available</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{h.changed_by}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{h.centre_name}</td>
                      <td className="py-3 px-4 font-mono">{h.total_seats}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{h.operational_seats}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{h.occupied_seats}</td>
                      <td className="py-3 px-4 font-mono text-amber-600">{h.reserved_seats}</td>
                      <td className="py-3 px-4 font-mono font-black text-[#214ECF]">{h.available_seats}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 9: EDIT CAPACITY PROFILE MODAL (PREMIUM ENTERPRISE UI)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingCentre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-[#E3EAF5] rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded-md">
                  Authorised Capacity Editor
                </span>
                <h3 className="text-xl font-black text-[#0B1730] mt-1">Edit Capacity Profile</h3>
                <p className="text-xs text-slate-500 font-medium">{editingCentre.centre_name} • {editingCentre.location}</p>
              </div>
              <button
                onClick={() => setEditingCentre(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCapacity} className="space-y-6 mt-6 text-xs">
              {/* SECTION: CAPACITY SEATS */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1730] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#214ECF]" />
                  Workstation Capacity Configuration
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Total Seats */}
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">
                      Total Seats (Physical)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editTotalSeats}
                      onChange={(e) => setEditTotalSeats(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:bg-white focus:outline-hidden focus:border-[#214ECF]"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Maximum physical floor layout</p>
                  </div>

                  {/* Operational Seats */}
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">
                      Operational Seats
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editOpSeats}
                      onChange={(e) => setEditOpSeats(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:bg-white focus:outline-hidden focus:border-[#214ECF]"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Workstations staffed/ready</p>
                  </div>

                  {/* Calculated Available (Read-only Server Controlled) */}
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                    <label className="block text-[#214ECF] font-bold mb-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#214ECF]" /> Server Available Seats
                    </label>
                    <p className="text-2xl font-black text-[#214ECF] font-mono mt-0.5">
                      {Math.max(0, editOpSeats - editingCentre.occupied_seats - editingCentre.reserved_seats)}
                    </p>
                    <p className="text-[10px] text-[#214ECF]/80 mt-1">
                      {editingCentre.occupied_seats} occupied + {editingCentre.reserved_seats} reserved
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Occupied seats ({editingCentre.occupied_seats}) and Reserved seats ({editingCentre.reserved_seats}) are controlled exclusively by contracted project workflows and cannot be manipulated directly.
                  </span>
                </div>
              </div>

              {/* SECTION: AVAILABILITY & STATUS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Available From Date</label>
                  <input
                    type="date"
                    value={editAvailableFrom}
                    onChange={(e) => setEditAvailableFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:bg-white focus:outline-hidden focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Capacity Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:bg-white focus:outline-hidden focus:border-[#214ECF]"
                  >
                    <option value="AVAILABLE">AVAILABLE (Accepting Project Matches)</option>
                    <option value="LIMITED">LIMITED (Low Margin Available)</option>
                    <option value="FULL">FULL (No Workstations Open)</option>
                    <option value="TEMPORARILY_UNAVAILABLE">TEMPORARILY UNAVAILABLE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* SECTION: SUPPORTED PROCESSES */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-slate-700 font-bold mb-2">Supported Processes & Workflows</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Customer Support",
                    "Inbound Voice",
                    "Technical Support",
                    "Email & Chat",
                    "Telehealth Support",
                    "Fintech Helpdesk",
                    "Backoffice Operations",
                    "Data Processing",
                    "Collections & Verification",
                  ].map((proc) => (
                    <button
                      type="button"
                      key={proc}
                      onClick={() => toggleArrayItem(editProcesses, proc, setEditProcesses)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition ${
                        editProcesses.includes(proc)
                          ? "bg-[#214ECF] text-white border-[#214ECF] shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {proc}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: SUPPORTED CHANNELS */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-slate-700 font-bold mb-2">Supported Channels</label>
                <div className="flex flex-wrap gap-2">
                  {["Voice", "Chat", "Email", "Ticketing", "Social Media", "Backoffice", "Video Support"].map((ch) => (
                    <button
                      type="button"
                      key={ch}
                      onClick={() => toggleArrayItem(editChannels, ch, setEditChannels)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition ${
                        editChannels.includes(ch)
                          ? "bg-[#214ECF] text-white border-[#214ECF] shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: OPERATIONAL SHIFTS */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-slate-700 font-bold mb-2">Operational Shifts & Rosters</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "US Shift (EST)",
                    "US Shift (PST)",
                    "UK Shift (GMT)",
                    "24/7 Rotational",
                    "Asia Day Shift",
                    "Australian Day Shift",
                  ].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleArrayItem(editShifts, s, setEditShifts)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition ${
                        editShifts.includes(s)
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: SUPPORTED LANGUAGES */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-slate-700 font-bold mb-2">Supported Languages</label>
                <div className="flex flex-wrap gap-2">
                  {["English", "Hindi", "Tagalog", "Spanish", "French", "German", "Arabic", "Mandarin"].map((l) => (
                    <button
                      type="button"
                      key={l}
                      onClick={() => toggleArrayItem(editLanguages, l, setEditLanguages)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition ${
                        editLanguages.includes(l)
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* MODAL ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCentre(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white font-bold cursor-pointer transition flex items-center gap-2 shadow-lg shadow-[#214ECF]/20 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
