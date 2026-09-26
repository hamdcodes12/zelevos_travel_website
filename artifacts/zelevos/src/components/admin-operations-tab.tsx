import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  RefreshCw,
  ArrowRight,
  Check,
  Plane,
  X,
  Send,
} from "lucide-react";

export function AdminOperationsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);

  // Flight Fulfillment Desk Modal State (PRD Section 13)
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [flightBookingRef, setFlightBookingRef] = useState("");
  const [flightTaskId, setFlightTaskId] = useState("");
  const [airline, setAirline] = useState("IndiGo 6E-2144");
  const [pnr, setPnr] = useState("");
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [flightNotes, setFlightNotes] = useState("");
  const [flightLoading, setFlightLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, tasksRes, ticketsRes] = await Promise.all([
        fetch("/api/operations/dashboard", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/operations/tasks", { credentials: "include" }).then((r) => (r.ok ? r.json() : { tasks: [] })),
        fetch("/api/support/tickets", { credentials: "include" }).then((r) => (r.ok ? r.json() : { tickets: [] })),
      ]);
      setDashboard(dashRes);
      setTasks(Array.isArray(tasksRes.tasks) ? tasksRes.tasks : []);
      setTickets(Array.isArray(ticketsRes.tickets) ? ticketsRes.tickets : []);
    } catch (err) {
      onToast("Failed to load operations dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    setResolvingTicketId(ticketId);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: "Resolved by Operations Executive." }),
      });
      if (!res.ok) throw new Error("Failed to resolve ticket");
      onToast("Support ticket marked as resolved.");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to resolve ticket.");
    } finally {
      setResolvingTicketId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyTask = async (taskId: string) => {
    setVerifyingId(taskId);
    try {
      const res = await fetch(`/api/operations/tasks/${taskId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: "Operations confirmed supplier voucher and verified details." }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to verify supplier task.");
      }

      onToast("Supplier confirmation verified! Customer status updated.");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Verification failed.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleIssueFlightPnr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightBookingRef) return;
    setFlightLoading(true);

    try {
      if (!ticketFile) throw new Error("Select a PDF or image ticket file.");
      const uploadBody = new FormData();
      uploadBody.append("bookingId", flightBookingRef);
      uploadBody.append("ticket", ticketFile);
      const uploadRes = await fetch("/api/documents/tickets/upload", {
        method: "POST",
        credentials: "include",
        body: uploadBody,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.objectPath) throw new Error(uploadData.message || "Ticket upload failed.");

      const res = await fetch(`/api/operations/bookings/${flightBookingRef}/flight-pnr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          airline,
          pnr: pnr.trim().toUpperCase(),
          ticketPath: uploadData.objectPath,
          notes: flightNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to issue flight PNR.");
      }

      onToast(`Flight ticket & PNR issued successfully for booking ${flightBookingRef}.`);
      setFlightModalOpen(false);
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Flight fulfillment failed.");
    } finally {
      setFlightLoading(false);
    }
  };

  const widgets = dashboard?.widgets || {};
  const financialOverview = dashboard?.financialOverview || {};

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Operations & Fulfillment Dashboard (Section 11 & 12)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Live supplier task allocation, deadline tracking, and two-step verification gate.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* KPI WIDGETS (Section 11: Real non-zero numbers) */}
      <div
        id="operations-widgets-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Today's New Bookings
          </span>
          <div id="widget-today-bookings" style={{ fontSize: "28px", fontWeight: 800, color: "#2563eb", marginTop: "4px" }}>
            {widgets.todaysNewBookings ?? 0}
          </div>
          <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>Active today</span>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Awaiting Confirmation
          </span>
          <div id="widget-awaiting-confirmation" style={{ fontSize: "28px", fontWeight: 800, color: "#d97706", marginTop: "4px" }}>
            {widgets.awaitingSupplierConfirmation ?? 0}
          </div>
          <span style={{ fontSize: "11px", color: "#d97706", fontWeight: 600 }}>Supplier requests sent</span>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Approaching Deadlines
          </span>
          <div id="widget-approaching-deadlines" style={{ fontSize: "28px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>
            {widgets.approachingDeadlines ?? 0}
          </div>
          <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>Due within 60 mins</span>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Partially Confirmed
          </span>
          <div id="widget-partially-confirmed" style={{ fontSize: "28px", fontWeight: 800, color: "#7c3aed", marginTop: "4px" }}>
            {widgets.partiallyConfirmedTrips ?? 0}
          </div>
          <span style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 600 }}>Some services verified</span>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Realized Margin
          </span>
          <div id="widget-total-margin" style={{ fontSize: "28px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
            ₹{Number(financialOverview.margin || 0).toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
            Revenue: ₹{Number(financialOverview.revenue || 0).toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* OPERATIONS VERIFICATION QUEUE (Section 12 Gate) */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              Supplier Fulfillment & Verification Gate
            </h3>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Customer status only updates to CONFIRMED after operations explicitly verifies supplier confirmations.
            </span>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Task / Booking ID</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Service Title</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Assigned Vendor</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>SLA Deadline</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Supplier Ref</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  Loading fulfillment tasks...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  No active fulfillment tasks. Book a holiday from the home page to create real supplier tasks.
                </td>
              </tr>
            ) : (
              tasks.map((t) => {
                const task = t.task || t;
                const isVerified = task.customerFacingVerified || task.status === "VERIFIED";
                const isAccepted = task.status === "ACCEPTED";
                const isFlightTask = task.serviceType === "flight_partner";

                return (
                  <tr key={task.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ display: "block", color: "#2563eb", fontFamily: "monospace" }}>
                        {t.bookingRef || task.bookingId?.slice(0, 8) || "ZL-BOOKING"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>{task.serviceType?.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a" }}>
                      {task.title}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155" }}>
                      {t.vendorName || task.assignedOwner || (isFlightTask ? "Zelevos Flight Desk" : "Pending Vendor")}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "12px", color: "#64748b" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} className="text-amber-600" />
                        {task.deadline ? new Date(task.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "120m SLA"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: "12px" }}>
                      {task.supplierConfirmationRef ? (
                        <span style={{ color: "#059669", fontWeight: 700 }}>{task.supplierConfirmationRef}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Awaiting</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: isVerified ? "#ecfdf5" : isAccepted ? "#eff6ff" : "#fef3c7",
                          color: isVerified ? "#047857" : isAccepted ? "#1d4ed8" : "#b45309",
                          fontWeight: 700,
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      {isVerified ? (
                        <span style={{ color: "#059669", fontWeight: 700, fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={14} /> {isFlightTask ? `Ticketed (${task.supplierConfirmationRef})` : "Verified"}
                        </span>
                      ) : isFlightTask ? (
                        <button
                          type="button"
                          id={`ops-flight-pnr-btn-${task.id}`}
                          onClick={() => {
                            setFlightBookingRef(t.bookingRef || "ZL260920001");
                            setFlightTaskId(task.id);
                            setFlightModalOpen(true);
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "#2563eb",
                            border: "none",
                            borderRadius: "6px",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Plane size={13} />
                          <span>Issue PNR & E-Ticket</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          id={`ops-verify-task-btn-${task.id}`}
                          onClick={() => handleVerifyTask(task.id)}
                          disabled={verifyingId === task.id}
                          style={{
                            padding: "6px 12px",
                            background: "#059669",
                            border: "none",
                            borderRadius: "6px",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: verifyingId === task.id ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {verifyingId === task.id ? <RefreshCw size={12} className="animate-spin" /> : <Check size={14} />}
                          <span>Verify Confirmation</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Support & Concierge Tickets Queue (Section 14) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Customer Support & Concierge Queue (Section 14)
            </h3>
            <span className="text-xs text-slate-500">
              Live inquiries, on-ground assistance, and itinerary change requests from travellers.
            </span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {tickets.filter((t) => t.status === "OPEN").length} Open Tickets
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
              <th className="py-3 px-4">Ticket / Booking</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Subject & Inquiry</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No support tickets submitted yet. Travellers can submit tickets via My Trips or Concierge.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-medium">
                    <span className="font-mono font-bold text-blue-700 block">{t.ticketNumber}</span>
                    <span className="text-[10px] text-slate-400">ID: {t.id.slice(0, 8)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <strong className="text-slate-800 block">{t.name}</strong>
                    <span className="text-[11px] text-slate-500">{t.email}</span>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <strong className="text-slate-800 block truncate">{t.subject}</strong>
                    <p className="text-[11px] text-slate-600 line-clamp-1 m-0">{t.description}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === "URGENT"
                          ? "bg-rose-100 text-rose-700"
                          : t.priority === "HIGH"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === "OPEN"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {t.status === "OPEN" ? (
                      <button
                        type="button"
                        id={`resolve-ticket-btn-${t.id}`}
                        disabled={resolvingTicketId === t.id}
                        onClick={() => handleResolveTicket(t.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1 transition"
                      >
                        {resolvingTicketId === t.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>Resolve</span>
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-bold text-xs inline-flex items-center gap-1">
                        <CheckCircle2 size={13} /> Resolved
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Flight Fulfillment Desk Modal (PRD Section 13) */}
      {flightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-blue-200">
                  Operations Flight Desk
                </span>
                <h3 className="text-lg font-bold">Issue Airline PNR & Ticket</h3>
                <span className="text-xs text-blue-200 block mt-0.5">Booking: {flightBookingRef}</span>
              </div>
              <button
                type="button"
                onClick={() => setFlightModalOpen(false)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleIssueFlightPnr} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Airline & Flight Number
                </label>
                <input
                  type="text"
                  required
                  id="ops-flight-airline-input"
                  value={airline}
                  onChange={(e) => setAirline(e.target.value)}
                  placeholder="e.g. IndiGo 6E-2144 / Air India AI-401"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Airline PNR (6 Characters)
                </label>
                <input
                  type="text"
                  required
                  id="ops-flight-pnr-input"
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value.toUpperCase())}
                  placeholder="e.g. 6E-RAJ789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Private E-Ticket File
                </label>
                <input
                  type="file"
                  required
                  id="ops-flight-ticket-file-input"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setTicketFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="block mt-1 text-[10px] text-slate-500">PDF, JPG, PNG, or WEBP up to 10 MB. Stored privately.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operations Notes
                </label>
                <textarea
                  rows={2}
                  id="ops-flight-notes-input"
                  value={flightNotes}
                  onChange={(e) => setFlightNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setFlightModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="ops-submit-flight-pnr-btn"
                  disabled={flightLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center gap-1.5 transition"
                >
                  {flightLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Issue PNR & Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
