import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Send,
  Building2,
  Users,
} from "lucide-react";

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  grace_period_minutes: number;
  is_active: boolean;
}

interface Agent {
  id: number;
  employee_id: string;
  name: string;
  status: string;
  bpo_centres?: { name: string } | null;
}

interface AttendanceRecord {
  id: number;
  agent_id: number;
  agent_name?: string;
  employee_id?: string;
  centre_name?: string;
  shift_name?: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "half_day" | "on_leave";
  check_in_time?: string | null;
  check_out_time?: string | null;
  working_duration_minutes?: number | null;
  break_duration_minutes?: number | null;
  late_minutes?: number | null;
  overtime_minutes?: number | null;
  correction_requested?: boolean;
}

interface CorrectionRequest {
  id: number;
  attendance_id: number;
  agent_name?: string;
  attendance_date?: string;
  original_check_in?: string | null;
  original_check_out?: string | null;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  created_at: string;
}

interface Props {
  api: (path: string, options?: RequestInit) => Promise<Response>;
  agents: Agent[];
  centres: any[];
}

export default function BpoAttendanceSection({ api, agents, centres }: Props) {
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"roster" | "corrections">("roster");

  // Check-In Modal State
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInAgentId, setCheckInAgentId] = useState<number | "">("");
  const [checkInShiftId, setCheckInShiftId] = useState<number | "">("");
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // Check-Out Action State
  const [checkingOutId, setCheckingOutId] = useState<number | null>(null);

  // Correction Request Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    requested_check_in: "",
    requested_check_out: "",
    reason: "forgot_punch",
    notes: "",
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  async function loadData() {
    setLoading(true);
    try {
      const [shiftsRes, attRes, corrRes] = await Promise.all([
        api("/bpo/shifts"),
        api(`/bpo/attendance?date=${selectedDate}`),
        api("/bpo/attendance/corrections"),
      ]);

      if (shiftsRes.ok) {
        const d = await shiftsRes.json();
        setShifts(d.shifts || []);
      }
      if (attRes.ok) {
        const d = await attRes.json();
        setAttendance(d.attendance || []);
      }
      if (corrRes.ok) {
        const d = await corrRes.json();
        setCorrections(d.corrections || []);
      }
    } catch (err) {
      console.error("Failed to load attendance data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedDate]);

  // Calculations for KPI Cards
  const totalRecords = attendance.length;
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const leaveCount = attendance.filter((a) => a.status === "on_leave").length;
  const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0;
  const pendingCorrections = corrections.filter((c) => c.status === "pending").length;

  // Filtered attendance list
  const filteredAttendance = attendance.filter((item) => {
    const matchesSearch =
      (item.agent_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (item.employee_id?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleCheckInSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkInAgentId) return;
    setSubmittingCheckIn(true);
    try {
      const res = await api("/bpo/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          agent_id: Number(checkInAgentId),
          shift_id: checkInShiftId ? Number(checkInShiftId) : undefined,
          date: selectedDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record check-in");
      showToast(`Check-in recorded successfully! Status: ${data.status.toUpperCase()}`);
      setCheckInModalOpen(false);
      setCheckInAgentId("");
      setCheckInShiftId("");
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingCheckIn(false);
    }
  }

  async function handleCheckOut(recordId: number) {
    setCheckingOutId(recordId);
    try {
      const res = await api("/bpo/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({
          attendance_id: recordId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record check-out");
      showToast(`Check-out recorded! Total duration: ${data.working_duration_minutes} mins`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCheckingOutId(null);
    }
  }

  function openCorrectionModal(rec: AttendanceRecord) {
    setSelectedRecord(rec);
    setCorrectionForm({
      requested_check_in: rec.check_in_time ? rec.check_in_time.slice(0, 16) : "",
      requested_check_out: rec.check_out_time ? rec.check_out_time.slice(0, 16) : "",
      reason: "forgot_punch",
      notes: "",
    });
    setCorrectionModalOpen(true);
  }

  async function handleCorrectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmittingCorrection(true);
    try {
      const res = await api("/bpo/attendance/corrections", {
        method: "POST",
        body: JSON.stringify({
          attendance_id: selectedRecord.id,
          requested_check_in: correctionForm.requested_check_in ? new Date(correctionForm.requested_check_in).toISOString() : null,
          requested_check_out: correctionForm.requested_check_out ? new Date(correctionForm.requested_check_out).toISOString() : null,
          reason: `${correctionForm.reason}: ${correctionForm.notes}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit correction request");
      showToast("Correction request submitted for Admin review.");
      setCorrectionModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingCorrection(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-2xl transition-all animate-bounce">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Header & Quick Action Bar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              Phase 4 Operational Attendance
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Clock size={12} /> Server-Authoritative Timestamping
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Agent Shift & Attendance Tracker</h2>
          <p className="mt-1 text-xs text-slate-500">
            Real-time biometric & digital check-in logging, shift adherence monitoring, and official punch correction workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setCheckInModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
          >
            <Plus size={16} />
            Check-in Agent
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalRecords}</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Scheduled Today</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Present On-Time</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{presentCount}</p>
          <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Adherent
          </span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Late Arrivals</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{lateCount}</p>
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            Exceeded Grace
          </span>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Unexcused Absent</p>
          <p className="mt-2 text-2xl font-black text-rose-900">{absentCount}</p>
          <span className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
            No Punch
          </span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Adherence Rate</p>
          <p className="mt-2 text-2xl font-black text-blue-900">{attendanceRate}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${attendanceRate}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Correction Queue</p>
          <p className="mt-2 text-2xl font-black text-purple-900">{pendingCorrections}</p>
          <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
            Awaiting Admin
          </span>
        </div>
      </div>

      {/* Sub-Tabs: Daily Roster vs Corrections History */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition rounded-xl ${
            activeTab === "roster" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CalendarDays size={14} />
          Daily Roll Call & Roster ({filteredAttendance.length})
        </button>
        <button
          onClick={() => setActiveTab("corrections")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition rounded-xl ${
            activeTab === "corrections" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock size={14} />
          Correction Requests ({corrections.length})
        </button>
      </div>

      {activeTab === "roster" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-primary"
                />
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search agent or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 sm:w-64 rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Roster Table */}
          {filteredAttendance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Agent Details</th>
                    <th className="pb-3">Shift Window</th>
                    <th className="pb-3">Check-In</th>
                    <th className="pb-3">Check-Out</th>
                    <th className="pb-3">Logged Duration</th>
                    <th className="pb-3">Late Mins</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendance.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-medium">
                        <div className="font-bold text-slate-900">{rec.agent_name || `Agent #${rec.agent_id}`}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{rec.employee_id || "EMP-N/A"}</div>
                      </td>
                      <td className="py-3.5">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {rec.shift_name || "Standard Day Shift"}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {rec.check_in_time ? (
                          <span className="font-mono text-slate-800 font-medium">
                            {new Date(rec.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        {rec.check_out_time ? (
                          <span className="font-mono text-slate-800 font-medium">
                            {new Date(rec.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : rec.check_in_time ? (
                          <button
                            onClick={() => handleCheckOut(rec.id)}
                            disabled={checkingOutId === rec.id}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            {checkingOutId === rec.id ? "Punched..." : "Check Out Now"}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 font-medium text-slate-700">
                        {rec.working_duration_minutes != null ? (
                          <span>
                            {Math.floor(rec.working_duration_minutes / 60)}h {rec.working_duration_minutes % 60}m
                          </span>
                        ) : (
                          <span className="text-slate-400">In Progress</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        {rec.late_minutes && rec.late_minutes > 0 ? (
                          <span className="font-bold text-amber-700">+{rec.late_minutes}m</span>
                        ) : (
                          <span className="text-slate-400">0m</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            rec.status === "present"
                              ? "bg-emerald-100 text-emerald-800"
                              : rec.status === "late"
                              ? "bg-amber-100 text-amber-800"
                              : rec.status === "on_leave"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <button
                          onClick={() => openCorrectionModal(rec)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition"
                        >
                          Correction
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No attendance records found for {selectedDate}. Use "Check-in Agent" above to log operational punches.
            </div>
          )}
        </div>
      )}

      {activeTab === "corrections" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Submitted Punch Correction Requests</h3>
            <span className="text-xs text-slate-500">Requires Head of Operations / Admin sign-off</span>
          </div>

          {corrections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Agent / Shift Date</th>
                    <th className="pb-3">Original Punch</th>
                    <th className="pb-3">Requested Correction</th>
                    <th className="pb-3">Operational Reason</th>
                    <th className="pb-3">Review Status</th>
                    <th className="pb-3 text-right pr-2">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {corrections.map((corr) => (
                    <tr key={corr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-medium">
                        <div className="font-bold text-slate-900">{corr.agent_name || `Record #${corr.attendance_id}`}</div>
                        <div className="text-[11px] text-slate-500">{corr.attendance_date || "—"}</div>
                      </td>
                      <td className="py-3.5 font-mono text-slate-500 text-[11px]">
                        In: {corr.original_check_in ? new Date(corr.original_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "None"}
                        <br />
                        Out: {corr.original_check_out ? new Date(corr.original_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "None"}
                      </td>
                      <td className="py-3.5 font-mono text-slate-900 font-bold text-[11px]">
                        In: {corr.requested_check_in ? new Date(corr.requested_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No change"}
                        <br />
                        Out: {corr.requested_check_out ? new Date(corr.requested_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No change"}
                      </td>
                      <td className="py-3.5 text-slate-600 max-w-xs truncate">{corr.reason}</td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            corr.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : corr.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {corr.status}
                        </span>
                        {corr.reviewer_notes && (
                          <p className="mt-1 text-[10px] text-slate-400 italic">Notes: {corr.reviewer_notes}</p>
                        )}
                      </td>
                      <td className="py-3.5 text-right pr-2 text-slate-400 font-mono text-[11px]">
                        {new Date(corr.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No correction requests have been filed. Use the "Correction" action in the Daily Roster to submit.
            </div>
          )}
        </div>
      )}

      {/* Check-In Modal */}
      {checkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Record Agent Check-In</h3>
              <button
                onClick={() => setCheckInModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCheckInSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Select Agent *</label>
                <select
                  required
                  value={checkInAgentId}
                  onChange={(e) => setCheckInAgentId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="">Choose an active agent...</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Assigned Shift *</label>
                <select
                  value={checkInShiftId}
                  onChange={(e) => setCheckInShiftId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="">Auto-Detect Default Shift</option>
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.start_time} - {sh.end_time}, grace {sh.grace_period_minutes}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Attendance Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  System server timestamp will be authoritatively stamped at submission.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckInModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckIn}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send size={14} />
                  {submittingCheckIn ? "Stamping Punch..." : "Confirm Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction Request Modal */}
      {correctionModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Request Punch Correction</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedRecord.agent_name} · {selectedRecord.attendance_date}
                </p>
              </div>
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Corrected Check-In (Optional)</label>
                <input
                  type="datetime-local"
                  value={correctionForm.requested_check_in}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_in: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Corrected Check-Out (Optional)</label>
                <input
                  type="datetime-local"
                  value={correctionForm.requested_check_out}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_out: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Reason Code *</label>
                <select
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  <option value="forgot_punch">Forgot to punch in/out</option>
                  <option value="biometric_glitch">Biometric / hardware terminal offline</option>
                  <option value="power_outage">Facility power / network interruption</option>
                  <option value="manager_override">Approved client meeting / floor override</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Operational Notes *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide brief context for Admin audit compliance..."
                  value={correctionForm.notes}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, notes: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCorrectionModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send size={14} />
                  {submittingCorrection ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
