import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  X,
  FileText,
  ShieldCheck,
  Send,
  Ban,
  Edit3,
  UserCheck,
  Check,
} from "lucide-react";

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
  expected_duration_months: number;
  minimum_experience_years: number;
  certification_requirements: string[];
  compliance_requirements: string[];
  working_days: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ClientMatch {
  id: number;
  match_code: string;
  match_status: string;
  matched_capacity: number;
  centre_name: string;
  location: string;
  supported_channels: string[];
  supported_languages: string[];
  supported_shifts: string[];
  created_at: string;
}

interface Props {
  clientApi: (path: string, options?: RequestInit) => Promise<Response>;
  userRole?: string;
}

export default function ClientCapacityRequirementsSection({ clientApi, userRole = "client_admin" }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [requirements, setRequirements] = useState<CapacityRequirement[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    required_seats: 25,
    process_type: "Customer Support",
    channels: ["Voice", "Email"],
    languages: ["English"],
    timezone: "UTC-5 (EST)",
    shift: "US Shift (EST)",
    location_requirement: "Any",
    start_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    expected_duration_months: 6,
    minimum_experience_years: 1,
    certification_requirements: [] as string[],
    compliance_requirements: ["SOC 2"] as string[],
    working_days: "Mon-Fri",
    notes: "",
    submit_immediately: true,
  });

  // Details Modal State
  const [selectedReq, setSelectedReq] = useState<CapacityRequirement | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [reqMatches, setReqMatches] = useState<ClientMatch[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const isViewer = userRole === "client_viewer";

  async function loadRequirements() {
    setLoading(true);
    setError(null);
    try {
      const res = await clientApi("/capacity-requirements");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Failed to load requirements.");
      }
      const data = await res.json();
      setRequirements(data.requirements || []);
    } catch (err: any) {
      setError(err.message || "Network error loading requirements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequirements();
  }, []);

  async function openDetailModal(req: CapacityRequirement) {
    setSelectedReq(req);
    setMatchesLoading(true);
    setReqMatches([]);
    try {
      const res = await clientApi(`/capacity-requirements/${req.id}/matches`);
      if (res.ok) {
        const data = await res.json();
        setReqMatches(data.matches || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setMatchesLoading(false);
    }
  }

  async function handleCreateRequirement(e: React.FormEvent) {
    e.preventDefault();
    if (isViewer) return;
    setCreateSubmitting(true);
    setError(null);

    try {
      const res = await clientApi("/capacity-requirements", {
        method: "POST",
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create requirement.");
      }

      setSuccessMsg(data.message || "Requirement created successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
      setShowCreateModal(false);
      await loadRequirements();
    } catch (err: any) {
      setError(err.message || "Error creating requirement.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleSubmitDraft(id: number) {
    if (isViewer) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await clientApi(`/capacity-requirements/${id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit requirement.");

      setSuccessMsg("Requirement submitted for operational matching.");
      setTimeout(() => setSuccessMsg(null), 4000);
      if (selectedReq && selectedReq.id === id) {
        setSelectedReq({ ...selectedReq, status: "SUBMITTED" });
      }
      await loadRequirements();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelRequirement(id: number) {
    if (isViewer) return;
    if (!confirm("Are you sure you want to cancel this capacity requirement?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await clientApi(`/capacity-requirements/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel requirement.");

      setSuccessMsg("Requirement cancelled.");
      setTimeout(() => setSuccessMsg(null), 4000);
      if (selectedReq && selectedReq.id === id) {
        setSelectedReq({ ...selectedReq, status: "CANCELLED" });
      }
      await loadRequirements();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const toggleCreateArray = (key: "channels" | "languages" | "compliance_requirements", val: string) => {
    setCreateForm((prev) => {
      const curr = prev[key];
      if (curr.includes(val)) {
        return { ...prev, [key]: curr.filter((x) => x !== val) };
      } else {
        return { ...prev, [key]: [...curr, val] };
      }
    });
  };

  const filteredRequirements = useMemo(() => {
    return requirements.filter((r) => {
      const matchQuery =
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.requirement_code.toLowerCase().includes(search.toLowerCase()) ||
        r.process_type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
      return matchQuery && matchStatus;
    });
  }, [requirements, search, statusFilter]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "SUBMITTED" || s === "MATCHING")
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (s === "MATCHED")
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (s === "ALLOCATED")
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "DRAFT")
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    if (s === "CANCELLED" || s === "CLOSED")
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              BPO Capacity Marketplace
            </span>
          </div>
          <h2 className="text-2xl font-black text-white">Capacity Requirements Studio</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Request dedicated BPO seats across verified global delivery centres. Specify volume, processes, channels, and shift requirements. Thinkatic's deterministic matching engine pairs requirements with verified capacity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadRequirements()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>

          {!isViewer && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Capacity Requirement
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search requirements by code, title, process..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses ({requirements.length})</option>
            <option value="draft">Drafts</option>
            <option value="submitted">Submitted</option>
            <option value="matching">Matching</option>
            <option value="matched">Matched</option>
            <option value="allocated">Allocated</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Requirements List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRequirements.length === 0 && !loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No capacity requirements match your filters. Create a new requirement to request BPO capacity.
          </div>
        )}

        {filteredRequirements.map((r) => (
          <div
            key={r.id}
            onClick={() => void openDetailModal(r)}
            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-blue-400">{r.requirement_code}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(
                    r.status
                  )}`}
                >
                  {r.status}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400 font-medium">Starts {r.start_date}</span>
              </div>
              <h3 className="text-base font-black text-white">{r.title}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1 font-semibold text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  {r.required_seats} Dedicated Seats
                </span>
                <span>•</span>
                <span>{r.process_type}</span>
                <span>•</span>
                <span>{r.shift}</span>
                <span>•</span>
                <span>{r.channels.join(", ")}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Duration</p>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">{r.expected_duration_months} Months</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 text-slate-400 group-hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE REQUIREMENT MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-white">Create Capacity Requirement</h3>
                  <p className="text-xs text-slate-400">Specify operational capacity requirements for your campaign</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRequirement} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Requirement Title / Campaign Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., North American Tier-1 Inbound Patient Support"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Required Seats (FTE) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={createForm.required_seats}
                      onChange={(e) => setCreateForm({ ...createForm, required_seats: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Process Domain *</label>
                    <select
                      value={createForm.process_type}
                      onChange={(e) => setCreateForm({ ...createForm, process_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold"
                    >
                      <option value="Customer Support">Customer Support</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Telehealth Support">Telehealth Support</option>
                      <option value="Fintech Helpdesk">Fintech Helpdesk</option>
                      <option value="Backoffice & Data">Backoffice & Data Processing</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Target Start Date *</label>
                    <input
                      type="date"
                      required
                      value={createForm.start_date}
                      onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Operational Shift *</label>
                    <select
                      value={createForm.shift}
                      onChange={(e) => setCreateForm({ ...createForm, shift: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold"
                    >
                      <option value="US Shift (EST)">US Shift (EST)</option>
                      <option value="US Shift (PST)">US Shift (PST)</option>
                      <option value="UK Shift (GMT)">UK Shift (GMT)</option>
                      <option value="24/7 Rotational">24/7 Rotational</option>
                    </select>
                  </div>
                </div>

                {/* Channels Checkboxes */}
                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Required Channels *</label>
                  <div className="flex flex-wrap gap-2">
                    {["Voice", "Chat", "Email", "Ticketing", "Social Media"].map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => toggleCreateArray("channels", ch)}
                        className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition ${
                          createForm.channels.includes(ch)
                            ? "bg-blue-600 text-white border-blue-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Languages Checkboxes */}
                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Required Languages *</label>
                  <div className="flex flex-wrap gap-2">
                    {["English", "Spanish", "French", "German", "Hindi", "Tagalog"].map((l) => (
                      <button
                        type="button"
                        key={l}
                        onClick={() => toggleCreateArray("languages", l)}
                        className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition ${
                          createForm.languages.includes(l)
                            ? "bg-blue-600 text-white border-blue-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Operational Notes & Special Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Specific security requirements, CRM tooling preferences, or agent tenure guidelines..."
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.submit_immediately}
                      onChange={(e) => setCreateForm({ ...createForm, submit_immediately: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    Submit for matching immediately (otherwise save as Draft)
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createSubmitting}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition flex items-center gap-2"
                    >
                      {createSubmitting ? "Saving..." : createForm.submit_immediately ? "Submit Requirement" : "Save Draft"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-400">{selectedReq.requirement_code}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(
                        selectedReq.status
                      )}`}
                    >
                      {selectedReq.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">{selectedReq.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedReq(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Requirement Summary Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-800 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Required Seats</p>
                  <p className="text-lg font-black text-white mt-1">{selectedReq.required_seats} Seats</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Process</p>
                  <p className="text-xs font-bold text-slate-300 mt-1">{selectedReq.process_type}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Shift</p>
                  <p className="text-xs font-bold text-slate-300 mt-1">{selectedReq.shift}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Start Date</p>
                  <p className="text-xs font-bold text-slate-300 mt-1">{selectedReq.start_date}</p>
                </div>
              </div>

              {/* Authorized Matches Section */}
              <div className="py-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    Delivery Centre Matches ({reqMatches.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">Deterministic Operational Pairings</span>
                </div>

                {matchesLoading ? (
                  <div className="p-6 text-center text-xs text-slate-500 animate-pulse">
                    Loading matching telemetry...
                  </div>
                ) : reqMatches.length === 0 ? (
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500">
                    No delivery centres matched or approved yet. Thinkatic Operations is evaluating verified capacity.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reqMatches.map((m) => (
                      <div
                        key={m.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-purple-400">{m.match_code}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                              {m.match_status}
                            </span>
                          </div>
                          <p className="font-bold text-white text-sm">{m.centre_name}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{m.location} • {m.matched_capacity} Seats Capacity</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {selectedReq.status !== "CANCELLED" && selectedReq.status !== "ALLOCATED" && !isViewer && (
                    <button
                      onClick={() => void handleCancelRequirement(selectedReq.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancel Requirement
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {selectedReq.status === "DRAFT" && !isViewer && (
                    <button
                      onClick={() => void handleSubmitDraft(selectedReq.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit for Matching
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedReq(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
