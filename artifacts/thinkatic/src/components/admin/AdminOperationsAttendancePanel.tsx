import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Send,
  Building2,
  Users,
} from "lucide-react";

interface Props {
  adminApi: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminOperationsAttendancePanel({ adminApi }: Props) {
  const [loading, setLoading] = useState(false);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"corrections" | "attendance">("corrections");

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  async function loadData() {
    setLoading(true);
    try {
      const [corrRes, attRes] = await Promise.all([
        adminApi("/admin/bpo/attendance/corrections"),
        adminApi(`/admin/bpo/attendance?date=${selectedDate}`),
      ]);

      if (corrRes.ok) {
        const d = await corrRes.json();
        setCorrections(d.corrections || []);
      }
      if (attRes.ok) {
        const d = await attRes.json();
        setAttendance(d.attendance || []);
      }
    } catch (err) {
      console.error("Failed to load admin attendance:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedDate]);

  function openReviewModal(corr: any, decision: "approved" | "rejected") {
    setSelectedCorrection(corr);
    setReviewDecision(decision);
    setReviewerNotes(decision === "approved" ? "Verified against biometric logs and supervisor approval" : "Insufficient justification or duplicate punch");
    setReviewModalOpen(true);
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCorrection) return;
    setSubmittingReview(true);
    try {
      const res = await adminApi(`/admin/bpo/attendance/corrections/${selectedCorrection.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          status: reviewDecision,
          notes: reviewerNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to review correction");
      showToast(`Correction #${selectedCorrection.id} marked as ${reviewDecision.toUpperCase()}`);
      setReviewModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  const pendingCount = corrections.filter((c) => c.status === "pending").length;
  const approvedCount = corrections.filter((c) => c.status === "approved").length;

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm transition">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Network Punches</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{attendance.length}</p>
          <span className="text-[11px] text-slate-500 font-medium">Recorded on {selectedDate}</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
          <p className="mt-2 text-2xl font-black text-amber-900">{pendingCount}</p>
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            Awaiting Admin Action
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Approved Corrections</span>
          <p className="mt-2 text-2xl font-black text-emerald-900">{approvedCount}</p>
          <span className="text-[11px] text-emerald-700 font-medium">Authoritatively recalculated</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Requests Filed</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{corrections.length}</p>
          <span className="text-[11px] text-slate-500 font-medium">All partner centres</span>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("corrections")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "corrections" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pending Corrections Queue ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "attendance" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Network Roster ({attendance.length})
          </button>
        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {activeTab === "corrections" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Partner Punch Correction Audit Queue</h3>
          {corrections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Partner Centre / Agent</th>
                    <th className="pb-3">Shift Date</th>
                    <th className="pb-3">Original Punches</th>
                    <th className="pb-3">Requested Correction</th>
                    <th className="pb-3">Reason Code & Context</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Decision Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {corrections.map((corr) => (
                    <tr key={corr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-medium">
                        <div className="font-bold text-slate-900">{corr.agent_name || `Agent #${corr.attendance_id}`}</div>
                        <div className="text-[11px] text-slate-400">{corr.centre_name || "Primary Centre"}</div>
                      </td>
                      <td className="py-3.5 font-mono text-slate-700">{corr.attendance_date || "—"}</td>
                      <td className="py-3.5 font-mono text-[11px] text-slate-500">
                        In: {corr.original_check_in ? new Date(corr.original_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "None"}
                        <br />
                        Out: {corr.original_check_out ? new Date(corr.original_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "None"}
                      </td>
                      <td className="py-3.5 font-mono text-[11px] font-bold text-slate-900">
                        In: {corr.requested_check_in ? new Date(corr.requested_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No change"}
                        <br />
                        Out: {corr.requested_check_out ? new Date(corr.requested_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No change"}
                      </td>
                      <td className="py-3.5 text-slate-600 max-w-xs">{corr.reason}</td>
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
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        {corr.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openReviewModal(corr, "approved")}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openReviewModal(corr, "rejected")}
                              className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700 transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Zero pending punch correction requests across all delivery partners.
            </div>
          )}
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Target Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-primary"
              />
            </div>
          </div>

          {attendance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Agent Details</th>
                    <th className="pb-3">Centre</th>
                    <th className="pb-3">Shift</th>
                    <th className="pb-3">Check-In</th>
                    <th className="pb-3">Check-Out</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3">Late Mins</th>
                    <th className="pb-3 text-right pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-medium">
                        <div className="font-bold text-slate-900">{rec.agent_name || `Agent #${rec.agent_id}`}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{rec.employee_id || "EMP-N/A"}</div>
                      </td>
                      <td className="py-3.5 text-slate-600">{rec.centre_name || "Main Centre"}</td>
                      <td className="py-3.5 font-medium text-slate-800">{rec.shift_name || "Day Shift"}</td>
                      <td className="py-3.5 font-mono text-slate-700">
                        {rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-3.5 font-mono text-slate-700">
                        {rec.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-3.5 font-mono font-medium text-slate-900">
                        {rec.working_duration_minutes != null ? `${Math.floor(rec.working_duration_minutes / 60)}h ${rec.working_duration_minutes % 60}m` : "Active"}
                      </td>
                      <td className="py-3.5">
                        {rec.late_minutes && rec.late_minutes > 0 ? (
                          <span className="font-bold text-amber-700">+{rec.late_minutes}m</span>
                        ) : (
                          <span className="text-slate-400">0m</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            rec.status === "present"
                              ? "bg-emerald-100 text-emerald-800"
                              : rec.status === "late"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No attendance records recorded on {selectedDate}.
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && selectedCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {reviewDecision === "approved" ? "Approve Punch Correction" : "Reject Punch Correction"}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedCorrection.agent_name} · {selectedCorrection.attendance_date}
                </p>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Partner Reason:</span>
                  <span className="font-bold text-slate-800">{selectedCorrection.reason}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Requested In:</span>
                  <span className="text-slate-900 font-bold">
                    {selectedCorrection.requested_check_in ? new Date(selectedCorrection.requested_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Unchanged"}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Requested Out:</span>
                  <span className="text-slate-900 font-bold">
                    {selectedCorrection.requested_check_out ? new Date(selectedCorrection.requested_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Unchanged"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Admin Audit Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition ${
                    reviewDecision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  } disabled:opacity-50`}
                >
                  <Send size={14} />
                  {submittingReview ? "Processing..." : `Confirm ${reviewDecision === "approved" ? "Approval" : "Rejection"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
