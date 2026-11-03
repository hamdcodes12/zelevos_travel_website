import { useState, useEffect } from "react";
import {
  Sparkles,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Briefcase,
  Layers,
  RefreshCw,
  Search,
  Filter,
  Download,
  Check,
  X,
  Plus,
  ShieldCheck,
  Headphones,
  FileSpreadsheet,
  AlertTriangle,
  FolderKanban,
  Send,
  Calendar,
  Lock,
  Unlock,
  Eye,
  ChevronRight,
} from "lucide-react";

interface MarketplaceMetrics {
  totalVerifiedCentres: number;
  totalOperationalSeats: number;
  totalOccupiedSeats: number;
  totalReservedSeats: number;
  totalAvailableSeats: number;
  overallUtilization: number;
  openRequirementsCount: number;
  matchedRequirementsCount: number;
  allocatedRequirementsCount: number;
  proposedMatchesCount: number;
  acceptedMatchesCount: number;
  activeReservationsCount: number;
}

interface CentreCapacity {
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
  supported_processes: string[];
  supported_channels: string[];
  supported_languages: string[];
  supported_timezones: string[];
  supported_shifts: string[];
  capacity_status: string;
}

interface CapacityRequirement {
  id: number;
  requirement_code: string;
  client_id: string;
  client_name: string;
  title: string;
  required_seats: number;
  process_type: string;
  channels: string[];
  languages: string[];
  timezone: string;
  shift: string;
  location_requirement: string;
  start_date: string;
  status: string;
  created_at: string;
}

interface MatchingResult {
  centreId: number;
  centreName: string;
  partnerName: string;
  isEligible: boolean;
  availableSeats: number;
  requiredSeats: number;
  passedCount: number;
  totalCriteria: number;
  compatibilityScore?: number;
  scoreType?: string;
  decisionAuthority?: string;
  automaticSelection?: boolean;
  explanation: string;
  analysisDisclaimer?: string;
  disqualificationReasons: string[];
  criteriaResults: Array<{
    criterion: string;
    passed: boolean;
    required: string | number | boolean;
    actual: string | number | boolean;
    detail: string;
  }>;
}

interface MatchRecord {
  id: number;
  match_code: string;
  requirement_id: number;
  requirement_code: string;
  centre_id: number;
  centre_name: string;
  partner_name: string;
  matched_capacity: number;
  match_status: string;
  matching_criteria: any;
  created_at: string;
}

interface ReservationRecord {
  id: number;
  reservation_code: string;
  requirement_id: number;
  requirement_code: string;
  match_id: number;
  centre_id: number;
  centre_name: string;
  partner_name: string;
  reserved_seats: number;
  status: string;
  reservation_start: string;
  reservation_expires_at: string;
}

interface Props {
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminCapacityMarketplacePanel({ apiCall }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "centres" | "requirements" | "matching" | "reservations">("overview");

  const [metrics, setMetrics] = useState<MarketplaceMetrics | null>(null);
  const [processBreakdown, setProcessBreakdown] = useState<Record<string, number>>({});
  const [timezoneBreakdown, setTimezoneBreakdown] = useState<Record<string, number>>({});

  const [centres, setCentres] = useState<CentreCapacity[]>([]);
  const [requirements, setRequirements] = useState<CapacityRequirement[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);

  // Deterministic matching state
  const [selectedReqForMatching, setSelectedReqForMatching] = useState<CapacityRequirement | null>(null);
  const [matchingResults, setMatchingResults] = useState<MatchingResult[]>([]);
  const [matchingRunning, setMatchingRunning] = useState(false);

  // Modals & Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModalMatch, setRejectModalMatch] = useState<MatchRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [manualSelectionModal, setManualSelectionModal] = useState<{
    centreId: number;
    centreName: string;
    requiredSeats: number;
  } | null>(null);
  const [selectionNotes, setSelectionNotes] = useState("");

  async function loadMarketplaceData() {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, centresRes, reqsRes] = await Promise.all([
        apiCall("/admin/capacity/overview"),
        apiCall("/admin/capacity/centres"),
        apiCall("/admin/capacity/requirements"),
      ]);

      if (overviewRes.ok) {
        const d = await overviewRes.json();
        setMetrics(d.metrics);
        setProcessBreakdown(d.processBreakdown || {});
        setTimezoneBreakdown(d.timezoneBreakdown || {});
      }
      if (centresRes.ok) {
        const d = await centresRes.json();
        setCentres(d.centres || []);
      }
      if (reqsRes.ok) {
        const d = await reqsRes.json();
        setRequirements(d.requirements || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load marketplace data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMarketplaceData();
  }, []);

  async function runMatchingForRequirement(req: CapacityRequirement) {
    setSelectedReqForMatching(req);
    setActiveTab("matching");
    setMatchingRunning(true);
    setMatchingResults([]);
    setError(null);

    try {
      const res = await apiCall("/admin/capacity/match", {
        method: "POST",
        body: JSON.stringify({ requirement_id: req.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to execute deterministic matching engine.");
      setMatchingResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatchingRunning(false);
    }
  }

  async function handleConfirmManualSelection() {
    if (!manualSelectionModal || !selectedReqForMatching) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await apiCall("/admin/capacity/matches", {
        method: "POST",
        body: JSON.stringify({
          requirement_id: selectedReqForMatching.id,
          centre_id: manualSelectionModal.centreId,
          matched_capacity: manualSelectionModal.requiredSeats,
          notes: selectionNotes || "Manually selected by Thinkatic Operations",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to select centre.");

      setSuccessMsg(`Centre ${manualSelectionModal.centreName} manually selected for ${selectedReqForMatching.requirement_code}. Proposed match: ${data.match?.match_code}`);
      setTimeout(() => setSuccessMsg(null), 5000);
      setManualSelectionModal(null);
      setSelectionNotes("");
      await loadMarketplaceData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveMatch(matchId: number) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall(`/admin/capacity/matches/${matchId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to approve match.");

      setSuccessMsg("Match approved by Operations.");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadMarketplaceData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectMatch() {
    if (!rejectModalMatch) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall(`/admin/capacity/matches/${rejectModalMatch.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject match.");

      setSuccessMsg("Match rejected.");
      setTimeout(() => setSuccessMsg(null), 4000);
      setRejectModalMatch(null);
      setRejectionReason("");
      await loadMarketplaceData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReserveCapacity(matchId: number) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall(`/admin/capacity/matches/${matchId}/reserve`, {
        method: "POST",
        body: JSON.stringify({ expires_in_days: 14 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reserve capacity.");

      setSuccessMsg("Capacity reserved transactionally. Over-allocation protected.");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadMarketplaceData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReleaseReservation(reservationId: number) {
    if (!confirm("Release this capacity reservation and restore seats to the centre?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall(`/admin/capacity/reservations/${reservationId}/release`, {
        method: "POST",
        body: JSON.stringify({ release_reason: "Manual release by Operations Administrator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to release reservation.");

      setSuccessMsg("Reservation released and seats restored.");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadMarketplaceData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAllocateToProject(matchId: number) {
    if (!confirm("Convert this capacity reservation into a Phase 2 active project allocation?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall(`/admin/capacity/matches/${matchId}/allocate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to allocate project.");

      setSuccessMsg(`Project #${data.projectId} successfully allocated through marketplace.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      await loadMarketplaceData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function exportCsv() {
    try {
      const res = await apiCall("/admin/capacity/reports/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thinkatic-capacity-marketplace-report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setError(err.message || "CSV Export error");
    }
  }

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "AVAILABLE" || s === "ACCEPTED" || s === "ACTIVE" || s === "ALLOCATED")
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (s === "LIMITED" || s === "PROPOSED" || s === "MATCHING" || s === "SUBMITTED")
      return "bg-blue-100 text-blue-800 border-blue-300";
    if (s === "MATCHED")
      return "bg-purple-100 text-purple-800 border-purple-300";
    if (s === "FULL" || s === "REJECTED" || s === "CANCELLED")
      return "bg-rose-100 text-rose-800 border-rose-300";
    return "bg-slate-100 text-slate-800 border-slate-300";
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Thinkatic Operations
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">Capacity Marketplace Command Centre</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Deterministic matching engine between client capacity requirements and verified BPO centre inventory. Transactional reservation locks prevent over-allocation. Phase 2 controlled allocation bridge.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadMarketplaceData()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => void exportCsv()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-3 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-700 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Level KPI Strip */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Verified Centres</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{metrics.totalVerifiedCentres}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Operational Seats</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{metrics.totalOperationalSeats}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Occupied Seats</p>
            <p className="text-2xl font-black text-slate-700 mt-1">{metrics.totalOccupiedSeats}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Reserved Seats</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{metrics.totalReservedSeats}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Available Seats</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.totalAvailableSeats}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Network Utilization</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{metrics.overallUtilization}%</p>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Marketplace Overview
        </button>
        <button
          onClick={() => setActiveTab("centres")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "centres"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          Centre Inventory ({centres.length})
        </button>
        <button
          onClick={() => setActiveTab("requirements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "requirements"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Client Requirements ({requirements.length})
        </button>
        <button
          onClick={() => setActiveTab("matching")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "matching"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Eligibility Analysis
        </button>
      </div>

      {/* TAB 1: MARKETPLACE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold uppercase text-slate-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              Available Capacity by Process Domain
            </h3>
            <div className="space-y-3">
              {Object.entries(processBreakdown).map(([proc, seats]) => (
                <div key={proc} className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="font-medium text-slate-700">{proc}</span>
                  <span className="font-bold text-slate-900">{seats} Available Seats</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold uppercase text-slate-900 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              Available Capacity by Timezone / Region
            </h3>
            <div className="space-y-3">
              {Object.entries(timezoneBreakdown).map(([tz, seats]) => (
                <div key={tz} className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="font-medium text-slate-700">{tz}</span>
                  <span className="font-bold text-slate-900">{seats} Available Seats</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CENTRES INVENTORY */}
      {activeTab === "centres" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-black text-slate-900 mb-4">Verified BPO Centre Inventory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Centre</th>
                  <th className="py-3 px-3">Partner</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3 text-center">Operational</th>
                  <th className="py-3 px-3 text-center">Occupied</th>
                  <th className="py-3 px-3 text-center">Reserved</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-3 text-center">Utilization</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centres.map((c) => (
                  <tr key={c.centre_id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-slate-900">{c.centre_name}</td>
                    <td className="py-3 px-3 text-slate-600">{c.partner_name}</td>
                    <td className="py-3 px-3 text-slate-500">{c.location}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-blue-600">{c.operational_seats}</td>
                    <td className="py-3 px-3 text-center font-mono">{c.occupied_seats}</td>
                    <td className="py-3 px-3 text-center font-mono text-amber-600 font-bold">{c.reserved_seats}</td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-600 font-black">{c.available_seats}</td>
                    <td className="py-3 px-3 text-center font-semibold">{c.utilization_percentage}%</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(c.capacity_status)}`}>
                        {c.capacity_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CLIENT REQUIREMENTS */}
      {activeTab === "requirements" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-black text-slate-900 mb-4">Enterprise Client Capacity Requirements</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Title / Scope</th>
                  <th className="py-3 px-3 text-center">Required Seats</th>
                  <th className="py-3 px-3">Process</th>
                  <th className="py-3 px-3">Shift</th>
                  <th className="py-3 px-3">Start Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requirements.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-600">{r.requirement_code}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{r.client_name}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{r.title}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">{r.required_seats} Seats</td>
                    <td className="py-3 px-3 text-slate-600">{r.process_type}</td>
                    <td className="py-3 px-3 text-slate-600">{r.shift}</td>
                    <td className="py-3 px-3 text-slate-500">{r.start_date}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => void runMatchingForRequirement(r)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer transition shadow-xs flex items-center gap-1.5 ml-auto"
                      >
                        <Sparkles className="w-3 h-3" />
                        Run Matching
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CAPACITY ELIGIBILITY & COMPATIBILITY ANALYSIS */}
      {activeTab === "matching" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-black text-slate-900 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Capacity Eligibility & Compatibility Analysis
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Informational decision-support evaluation against 11 operational parameters. AI and automated algorithms NEVER select centres, reserve seats, or allocate projects.
            </p>

            {/* Human-in-the-Loop Operations Policy Banner */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 text-xs mb-6">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Human-in-the-Loop Operations Policy</p>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  The compatibility analysis below is strictly informational decision-support data. Final centre selection, match creation, and capacity allocation MUST ALWAYS be performed manually by an authorized Thinkatic Operations / Superadmin user.
                </p>
              </div>
            </div>

            {selectedReqForMatching ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-indigo-600">{selectedReqForMatching.requirement_code}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(selectedReqForMatching.status)}`}>
                    {selectedReqForMatching.status}
                  </span>
                </div>
                <h4 className="font-black text-slate-900 text-sm">{selectedReqForMatching.title}</h4>
                <p className="text-slate-600 mt-1">
                  Client: <strong className="text-slate-900">{selectedReqForMatching.client_name}</strong> • Required Seats: <strong className="text-slate-900">{selectedReqForMatching.required_seats} Seats</strong> • Process: <strong className="text-slate-900">{selectedReqForMatching.process_type}</strong> • Shift: <strong className="text-slate-900">{selectedReqForMatching.shift}</strong>
                </p>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Select a client requirement from the Requirements tab or choose one below to execute compatibility analysis.
              </div>
            )}

            {matchingRunning && (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
                Evaluating candidate centres across 11 deterministic criteria...
              </div>
            )}

            {/* Candidate Evaluation Results */}
            <div className="space-y-4">
              {matchingResults.map((result) => {
                const compatibilityPercent = result.compatibilityScore ?? (result.totalCriteria > 0 ? Math.round((result.passedCount / result.totalCriteria) * 100) : 0);
                return (
                  <div
                    key={result.centreId}
                    className={`border rounded-xl p-5 transition ${
                      result.isEligible
                        ? "bg-emerald-50/40 border-emerald-200"
                        : "bg-slate-50 border-slate-200 opacity-80"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-slate-700">Centre #{result.centreId}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Compatibility: {compatibilityPercent}% (Informational Only)
                          </span>
                          {result.isEligible ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase flex items-center gap-1">
                              <Check className="w-3 h-3" /> Fully Eligible ({result.passedCount}/{result.totalCriteria})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 uppercase flex items-center gap-1">
                              <X className="w-3 h-3" /> Ineligible ({result.passedCount}/{result.totalCriteria})
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-slate-900">{result.centreName}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Partner: {result.partnerName} • Available Capacity: <strong>{result.availableSeats} Seats</strong> • Decision Authority: <strong>Human Operations</strong>
                        </p>
                      </div>

                      <div>
                        {result.isEligible && (
                          <button
                            onClick={() => setManualSelectionModal({
                              centreId: result.centreId,
                              centreName: result.centreName,
                              requiredSeats: result.requiredSeats,
                            })}
                            disabled={actionLoading}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-xs transition flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Select Centre
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Explanation text */}
                    <p className="text-xs font-medium text-slate-700 my-3">
                      {result.explanation}
                    </p>

                    {/* Criteria Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                      {result.criteriaResults.map((c, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg text-[11px] border ${
                            c.passed
                              ? "bg-white text-emerald-800 border-emerald-200"
                              : "bg-white text-rose-800 border-rose-200"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-0.5">
                            {c.passed ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-rose-600" />}
                            <span>{c.criterion}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">{c.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Centre Selection Confirmation Modal */}
      {manualSelectionModal && selectedReqForMatching && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Confirm Manual Centre Selection
              </h4>
              <button
                onClick={() => {
                  setManualSelectionModal(null);
                  setSelectionNotes("");
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
              <p className="font-bold mb-1">Human Decision Confirmation Required</p>
              <p>
                You are manually selecting Centre <strong className="text-slate-900">{manualSelectionModal.centreName}</strong> (ID: #{manualSelectionModal.centreId}) for capacity requirement <strong className="text-slate-900">{selectedReqForMatching.requirement_code}</strong> ({manualSelectionModal.requiredSeats} seats).
              </p>
              <p className="mt-2 text-amber-800 font-medium">
                This action will create a proposed capacity match. It requires authorized administrative approval before capacity can be reserved.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Operations Decision Notes (Optional)</label>
              <textarea
                rows={3}
                value={selectionNotes}
                onChange={(e) => setSelectionNotes(e.target.value)}
                placeholder="Document justification, client-centre alignment details, or operations notes..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setManualSelectionModal(null);
                  setSelectionNotes("");
                }}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmManualSelection()}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {actionLoading ? "Recording Selection..." : "Confirm Manual Selection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
