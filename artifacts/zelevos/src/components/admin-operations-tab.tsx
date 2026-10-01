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
  MessageSquare,
  User,
  Mail,
  Phone,
  Calendar,
  Eye,
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

  // View Inquiry Modal & Conversation State (PRD Section 11, 12, 13, 14, 15, 16)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyStatus, setReplyStatus] = useState<string>("IN_PROGRESS");
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    if (!flightModalOpen && !selectedTicketId) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (flightModalOpen) setFlightModalOpen(false);
        if (selectedTicketId) setSelectedTicketId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [flightModalOpen, selectedTicketId]);

  const loadData = async () => {
    setLoading(true);
    let anyLoaded = false;
    try {
      const [dashRes, tasksRes, ticketsRes] = await Promise.all([
        fetch("/api/operations/dashboard", { credentials: "include" })
          .then(async (r) => {
            if (!r.ok) return null;
            return await r.json().catch(() => null);
          })
          .catch(() => null),
        fetch("/api/operations/tasks", { credentials: "include" })
          .then(async (r) => {
            if (!r.ok) return { tasks: [] };
            return await r.json().catch(() => ({ tasks: [] }));
          })
          .catch(() => ({ tasks: [] })),
        fetch("/api/support/tickets", { credentials: "include" })
          .then(async (r) => {
            if (!r.ok) return { tickets: [] };
            return await r.json().catch(() => ({ tickets: [] }));
          })
          .catch(() => ({ tickets: [] })),
      ]);

      if (dashRes) {
        setDashboard(dashRes);
        anyLoaded = true;
      }
      if (tasksRes) {
        setTasks(Array.isArray(tasksRes.tasks) ? tasksRes.tasks : []);
        anyLoaded = true;
      }
      if (ticketsRes) {
        setTickets(Array.isArray(ticketsRes.tickets) ? ticketsRes.tickets : []);
        anyLoaded = true;
      }

      if (!anyLoaded) {
        onToast("Failed to load operations dashboard.");
      }
    } catch (err) {
      if (!anyLoaded) {
        onToast("Failed to load operations dashboard.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInquiry = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTicketDetailLoading(true);
    setReplyMessage("");
    // Optimistically mark as seen for this Admin in local state (turns BOLD to normal immediately)
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, isUnread: false, unread: false } : t))
    );
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inquiry details");
      const data = await res.json();
      setTicketDetail(data);
      if (data.ticket?.status) setReplyStatus(data.ticket.status);
    } catch (err: any) {
      onToast(err.message || "Failed to load support inquiry.");
    } finally {
      setTicketDetailLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyMessage.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: replyMessage.trim(),
          status: replyStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send reply");

      onToast("Reply sent to customer successfully.");
      setReplyMessage("");

      // Append new message to conversation thread immediately
      if (data.newMessage && ticketDetail) {
        setTicketDetail((prev: any) => ({
          ...prev,
          ticket: {
            ...prev.ticket,
            status: replyStatus,
            lastMessageAt: data.newMessage.createdAt,
            lastMessageBy: "ADMIN",
          },
          messages: [...(prev.messages || []), data.newMessage],
        }));
      }

      // Update in local ticket list
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicketId
            ? { ...t, status: replyStatus, isUnread: false, lastMessageBy: "ADMIN" }
            : t
        )
      );
    } catch (err: any) {
      onToast(err.message || "Failed to send reply.");
    } finally {
      setReplySending(false);
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
            ₹{Number(financialOverview.margin ?? financialOverview.estimatedMargin ?? 0).toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
            Revenue: ₹{Number(financialOverview.revenue ?? widgets.revenue ?? 0).toLocaleString("en-IN")}
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
          <div className="flex items-center gap-2">
            {tickets.filter((t) => t.isUnread || t.unread).length > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                {tickets.filter((t) => t.isUnread || t.unread).length} Unread
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {tickets.filter((t) => t.status === "OPEN").length} Open Tickets
            </span>
          </div>
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
              tickets.map((t) => {
                const isUnread = Boolean(t.isUnread || t.unread);
                return (
                  <tr
                    key={t.id}
                    style={{
                      background: isUnread ? "#f0f7ff" : "transparent",
                      transition: "background 0.15s ease",
                    }}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {isUnread && (
                          <span
                            title="Unread message for you"
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#2563eb",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span className={`font-mono ${isUnread ? "font-extrabold text-blue-800" : "font-bold text-blue-700"} block`}>
                          {t.ticketNumber}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {t.bookingRef ? `Booking: ${t.bookingRef}` : `ID: ${t.id.slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <strong className={`block ${isUnread ? "font-extrabold text-slate-950 text-[13px]" : "font-semibold text-slate-800"}`}>
                        {t.name}
                      </strong>
                      <span className={`text-[11px] ${isUnread ? "text-slate-700 font-semibold" : "text-slate-500"}`}>
                        {t.email}
                      </span>
                      {t.customerId && (
                        <span className="block text-[10px] text-blue-600 font-mono">
                          {t.customerId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        {isUnread && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-600 text-white tracking-wider">
                            NEW
                          </span>
                        )}
                        <strong className={`block truncate ${isUnread ? "font-extrabold text-slate-950" : "font-semibold text-slate-800"}`}>
                          {t.subject}
                        </strong>
                      </div>
                      <p className={`text-[11px] line-clamp-1 m-0 ${isUnread ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                        {t.description}
                      </p>
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
                            : t.status === "IN_PROGRESS"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          id={`ops-view-ticket-btn-${t.id}`}
                          onClick={() => handleOpenInquiry(t.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition ${
                            isUnread
                              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                          }`}
                        >
                          <Eye size={12} />
                          <span>View Inquiry</span>
                        </button>

                        {t.status === "OPEN" || t.status === "IN_PROGRESS" ? (
                          <button
                            type="button"
                            id={`resolve-ticket-btn-${t.id}`}
                            disabled={resolvingTicketId === t.id}
                            onClick={() => handleResolveTicket(t.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1 transition"
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
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Flight Fulfillment Desk Modal (PRD Section 13) */}
      {flightModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setFlightModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
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
                aria-label="Close modal"
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition focus:outline-none focus:ring-2 focus:ring-white"
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

      {/* VIEW INQUIRY & CONVERSATION MODAL (Section 11, 12, 13, 14, 15, 16) */}
      {selectedTicketId && (
        <div
          id="ops-view-inquiry-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTicketId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <MessageSquare size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-200">
                      {ticketDetail?.ticket?.ticketNumber || "Support Inquiry"}
                    </span>
                    {ticketDetail?.ticket?.status && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/40">
                        {ticketDetail.ticket.status}
                      </span>
                    )}
                    {ticketDetail?.ticket?.priority && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40">
                        {ticketDetail.ticket.priority}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-300">
                    Live Operations & Concierge Desk
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="close-inquiry-modal-btn"
                onClick={() => {
                  setSelectedTicketId(null);
                  setTicketDetail(null);
                }}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            {ticketDetailLoading ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="animate-spin text-blue-600" />
                <span className="text-sm font-semibold">Loading inquiry and conversation...</span>
              </div>
            ) : !ticketDetail?.ticket ? (
              <div className="p-8 text-center text-slate-500">
                Inquiry details could not be found.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* 1. Customer Dossier Card (Section 12, 40) */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Customer</span>
                    <strong className="text-slate-900 text-[13px] block mt-0.5">
                      {ticketDetail.ticket.name}
                    </strong>
                    <span className="text-slate-500 text-[11px] block">{ticketDetail.ticket.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Customer ID</span>
                    <span className="font-mono font-bold text-blue-700 block mt-0.5">
                      {ticketDetail.customer?.customerId || (ticketDetail.ticket.userId ? `CUS-${ticketDetail.ticket.userId.slice(0, 6).toUpperCase()}` : "GUEST")}
                    </span>
                    <span className="text-slate-500 text-[11px] block">
                      {ticketDetail.customer?.phone || "No phone listed"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Booking ID</span>
                    <span className="font-mono font-bold text-indigo-700 block mt-0.5">
                      {ticketDetail.booking?.bookingId || (ticketDetail.ticket.bookingId ? `ZLV-${ticketDetail.ticket.bookingId.slice(0, 8).toUpperCase()}` : "Not linked")}
                    </span>
                    {ticketDetail.booking?.status && (
                      <span className="text-[10px] font-semibold text-emerald-600">
                        {ticketDetail.booking.status}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Submitted</span>
                    <span className="text-slate-700 font-semibold block mt-0.5">
                      {ticketDetail.ticket.createdAt ? new Date(ticketDetail.ticket.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                    </span>
                    <span className="text-slate-400 text-[10px] block">
                      Updated: {ticketDetail.ticket.updatedAt ? new Date(ticketDetail.ticket.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                    </span>
                  </div>
                </div>

                {/* 2. Full Subject (Section 11, 12) */}
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-blue-700 block mb-1">
                    Full Subject
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 m-0">
                    {ticketDetail.ticket.subject}
                  </h4>
                </div>

                {/* 3. Full Customer Inquiry (Section 11, 12) */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1.5">
                    Original Customer Inquiry
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap m-0 font-medium select-text">
                    {ticketDetail.ticket.description}
                  </p>
                </div>

                {/* 4. Complete Conversation Thread (Section 13) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
                      Conversation Thread ({Array.isArray(ticketDetail.messages) ? ticketDetail.messages.length : 0})
                    </span>
                    <span className="text-[10px] text-slate-400">Chronological database records</span>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {(!ticketDetail.messages || ticketDetail.messages.length === 0) ? (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                        No additional messages in thread. Use the reply box below to respond.
                      </div>
                    ) : (
                      ticketDetail.messages.map((msg: any) => {
                        const isAdmin = msg.senderType === "ADMIN";
                        return (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-xl border text-xs ${
                              isAdmin
                                ? "bg-blue-50/70 border-blue-200 text-slate-800 ml-4"
                                : "bg-slate-50 border-slate-200 text-slate-800 mr-4"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                    isAdmin
                                      ? "bg-blue-700 text-white"
                                      : "bg-slate-700 text-white"
                                  }`}
                                >
                                  {isAdmin ? "Admin / Support" : "Customer"}
                                </span>
                                <strong className="text-slate-900 text-[11px]">
                                  {msg.senderName || (isAdmin ? "Zelevos Support" : "Customer")}
                                </strong>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap m-0 leading-relaxed text-slate-800 select-text">
                              {msg.message}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 5. Reply Box (Section 16: Admin Reply directly from Operations) */}
                <form onSubmit={handleSendReply} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Send size={13} className="text-blue-600" />
                      Reply to Customer
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-500 font-semibold">Status after reply:</label>
                      <select
                        value={replyStatus}
                        onChange={(e) => setReplyStatus(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="OPEN">KEEP OPEN</option>
                        <option value="WAITING_FOR_CUSTOMER">WAITING FOR CUSTOMER</option>
                        <option value="RESOLVED">RESOLVE TICKET</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    id="admin-reply-textarea"
                    rows={3}
                    required
                    placeholder="Type your reply here to send real-time notification & message to customer..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[11px] text-slate-500">
                      Customer receives real notification & can view full conversation.
                    </span>
                    <button
                      type="submit"
                      id="admin-send-reply-btn"
                      disabled={replySending || !replyMessage.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {replySending ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>Send Reply</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
