import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Send, Trash2, FileText, CheckCircle2, User, MapPin, Calendar, Clock, CreditCard, ExternalLink, ShieldCheck, Archive, RotateCcw } from "lucide-react";

export type ItineraryDay = {
  day: number;
  date?: string;
  location: string;
  activity: string;
  meal?: string;
  description: string;
};

export type Lead = {
  id: string;
  leadNumber: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  userId?: string | null;
  destinations: string[];
  startDate?: string | null;
  durationDays: number | null;
  travellersCount?: number | null;
  budgetPerPerson?: number | null;
  totalBudget?: number | null;
  hotelPreference?: string | null;
  transportPreference?: string | null;
  activitiesInterests?: string[] | null;
  specialRequests?: string | null;
  proposalTitle: string | null;
  proposalAmount: number | null;
  proposalItinerary: ItineraryDay[];
  proposalNotes: string | null;
  status: string;
  masterBookingId?: string | null;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  paymentId?: string | null;
  paymentOrderId?: string | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const blankDay = (day: number): ItineraryDay => ({
  day,
  date: "",
  location: "",
  activity: "",
  meal: "",
  description: "",
});

export function AdminCustomTripsTab({ onToast }: { onToast: (message: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = async (includeArchived = showArchived) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/admin/custom-trips${includeArchived ? "?includeArchived=true" : ""}`;
      const response = await fetch(url, { credentials: "include" });
      const payload = (await response.json()) as { leads?: Lead[]; message?: string };
      if (!response.ok) throw new Error(payload.message || "Custom trip leads could not be loaded.");
      const list = payload.leads || [];
      setLeads(list);
      setSelected((current) => (current ? list.find((lead) => lead.id === current.id) || current : list[0] || null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Custom trip leads could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const archiveLead = async (id: string) => {
    const reason = window.prompt("Reason for archiving this custom trip lead:", "Archived by admin") || "Archived by admin";
    try {
      const response = await fetch(`/api/admin/custom-trips/${id}/archive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to archive custom trip");
      onToast("Custom trip archived successfully.");
      await load(showArchived);
    } catch (e: any) {
      setError(e.message || "Failed to archive custom trip");
    }
  };

  const restoreLead = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/custom-trips/${id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to restore custom trip");
      onToast("Custom trip restored successfully.");
      await load(showArchived);
    } catch (e: any) {
      setError(e.message || "Failed to restore custom trip");
    }
  };

  const deleteLead = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this custom trip lead? This action cannot be undone.")) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/custom-trips/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete custom trip");
      onToast("Custom trip permanently deleted.");
      await load(showArchived);
    } catch (e: any) {
      setError(e.message || "Failed to delete custom trip");
    }
  };

  const updateSelected = (changes: Partial<Lead>) =>
    setSelected((current) => (current ? { ...current, ...changes } : current));

  const save = async (send: boolean) => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/custom-trips/${selected.id}/proposal`, {
        method: send ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalTitle: selected.proposalTitle || "",
          proposalAmount: Number(selected.proposalAmount || 0),
          proposalItinerary: selected.proposalItinerary || [],
          notes: selected.proposalNotes || "",
        }),
      });
      const payload = (await response.json()) as { lead?: Lead; message?: string };
      if (!response.ok || !payload.lead) throw new Error(payload.message || "Proposal could not be saved.");
      setSelected(payload.lead);
      setLeads((current) => current.map((lead) => (lead.id === payload.lead!.id ? payload.lead! : lead)));
      onToast(send ? "Proposal sent to the customer." : "Proposal draft saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Proposal could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (index: number, changes: Partial<ItineraryDay>) => {
    if (!selected) return;
    const proposalItinerary = selected.proposalItinerary.map((day, currentIndex) =>
      currentIndex === index ? { ...day, ...changes } : day
    );
    updateSelected({ proposalItinerary });
  };

  const removeDay = (index: number) => {
    if (!selected) return;
    updateSelected({
      proposalItinerary: selected.proposalItinerary
        .filter((_, currentIndex) => currentIndex !== index)
        .map((day, currentIndex) => ({ ...day, day: currentIndex + 1 })),
    });
  };

  const moveDay = (index: number, direction: -1 | 1) => {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.proposalItinerary.length) return;
    const proposalItinerary = [...selected.proposalItinerary];
    [proposalItinerary[index], proposalItinerary[target]] = [proposalItinerary[target], proposalItinerary[index]];
    updateSelected({
      proposalItinerary: proposalItinerary.map((day, currentIndex) => ({ ...day, day: currentIndex + 1 })),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW":
        return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      case "PROPOSAL_SENT":
        return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
      case "ACCEPTED":
      case "ACCEPTED_PENDING_PAYMENT":
        return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
      case "PAID":
      case "CONFIRMED":
        return { bg: "#dcfce7", text: "#15803d", border: "#86efac" };
      case "DECLINED":
        return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    }
  };

  return (
    <section className="admin-custom-trips-container" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) minmax(0, 1fr)", gap: "20px" }}>
      {/* Sidebar: Leads List */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", height: "fit-content" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>Custom Trip Leads</h2>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              id="admin-toggle-archived-leads-btn"
              onClick={() => {
                const next = !showArchived;
                setShowArchived(next);
                void load(next);
              }}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: showArchived ? "#eff6ff" : "#f8fafc",
                color: showArchived ? "#1d4ed8" : "#64748b",
                cursor: "pointer",
              }}
            >
              {showArchived ? "Archived (ON)" : "Show Archived"}
            </button>
            <span style={{ fontSize: "11px", fontWeight: 700, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: "999px" }}>
              {leads.length} Leads
            </span>
          </div>
        </div>

        {loading && <p style={{ fontSize: "13px", color: "#64748b" }}>Loading leads...</p>}
        {error && <p style={{ color: "#b42318", fontSize: "12px" }}>{error}</p>}
        {!loading && !leads.length && <p style={{ color: "#64748b", fontSize: "13px" }}>No custom trip requests yet.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
          {leads.map((lead) => {
            const isSel = selected?.id === lead.id;
            const badge = getStatusColor(lead.status);
            return (
              <button
                key={lead.id}
                type="button"
                id={`lead-item-${lead.leadNumber}`}
                onClick={() => setSelected(lead)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: isSel ? "2px solid #2563eb" : "1px solid #e2e8f0",
                  background: isSel ? "#f8faff" : "#fff",
                  borderRadius: "10px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSel ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                  <strong style={{ fontSize: "12px", color: "#1e3a8a", fontFamily: "monospace" }}>{lead.leadNumber}</strong>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {lead.isArchived && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "999px",
                          background: "#fee2e2",
                          color: "#b91c1c",
                          border: "1px solid #fca5a5",
                        }}
                      >
                        ARCHIVED
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: "999px",
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {lead.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", marginTop: "4px" }}>{lead.customerName}</div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  {lead.destinations?.join(", ") || "Custom Destination"} · {lead.durationDays || "?"} Days
                </div>
                {lead.proposalAmount && (
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#059669", marginTop: "4px" }}>
                    ₹{Number(lead.proposalAmount).toLocaleString("en-IN")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Complete A-Z Lead View + Proposal Builder */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px" }}>
        {!selected ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
            <FileText size={40} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#334155" }}>Select a lead</h3>
            <p style={{ fontSize: "13px" }}>Choose any custom trip lead on the left to inspect the complete request and build a proposal.</p>
          </div>
        ) : (
          <>
            {/* Lead Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#2563eb", fontFamily: "monospace" }}>{selected.leadNumber}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      ...getStatusColor(selected.status),
                    }}
                  >
                    {selected.status}
                  </span>
                  {selected.isArchived && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        border: "1px solid #fca5a5",
                      }}
                    >
                      ARCHIVED
                    </span>
                  )}
                </div>
                <h1 style={{ margin: "6px 0 2px", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>{selected.customerName}</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: "12px" }}>
                  Submitted on {selected.createdAt ? new Date(selected.createdAt).toLocaleString("en-IN") : "Recent"}
                </p>
              </div>

              {/* Status Action / Archive / Delete / Receipt buttons */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                {selected.isArchived ? (
                  <button
                    type="button"
                    id={`restore-lead-${selected.id}`}
                    onClick={() => void restoreLead(selected.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      background: "#f0fdf4",
                      color: "#15803d",
                      border: "1px solid #bbf7d0",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <RotateCcw size={14} /> Restore Lead
                  </button>
                ) : (
                  <button
                    type="button"
                    id={`archive-lead-${selected.id}`}
                    onClick={() => void archiveLead(selected.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      background: "#fff7ed",
                      color: "#c2410c",
                      border: "1px solid #fed7aa",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Archive size={14} /> Archive Lead
                  </button>
                )}
                <button
                  type="button"
                  id={`delete-lead-${selected.id}`}
                  onClick={() => void deleteLead(selected.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} /> Delete Lead
                </button>
                {selected.status === "PAID" && (
                  <>
                    <a
                      href={`/api/bookings/${selected.masterBookingId || selected.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        background: "#ecfdf5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                        fontSize: "12px",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      <ShieldCheck size={14} /> View Receipt
                    </a>
                    <a
                      href={`/api/bookings/${selected.masterBookingId || selected.id}/receipt/download?download=true`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Download Receipt
                    </a>
                  </>
                )}
              </div>
            </div>

            {selected.isArchived && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginTop: "12px", color: "#991b1b", fontSize: "12px" }}>
                <strong>Archived:</strong> This custom trip lead was archived on {selected.archivedAt ? new Date(selected.archivedAt).toLocaleString() : "recently"}{selected.archivedBy ? ` by ${selected.archivedBy}` : ""}. Reason: {selected.archiveReason || "None provided"}.
              </div>
            )}

            {/* A-Z COMPLETE CUSTOMER REQUEST SECTION */}
            <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Customer Information Card */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                  <User size={15} style={{ color: "#2563eb" }} />
                  <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569" }}>
                    Customer Information
                  </span>
                </div>
                <div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Customer ID:</span>
                    <strong style={{ fontFamily: "monospace", color: "#2563eb" }}>{selected.customerId || "ZLV-CUS-000001"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Full Name:</span>
                    <strong>{selected.customerName}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Email:</span>
                    <a href={`mailto:${selected.customerEmail}`} style={{ color: "#2563eb", textDecoration: "none" }}>{selected.customerEmail}</a>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Phone:</span>
                    <strong>{selected.customerPhone || "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Request Information Card */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                  <Clock size={15} style={{ color: "#2563eb" }} />
                  <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569" }}>
                    Request Meta
                  </span>
                </div>
                <div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Lead ID:</span>
                    <strong style={{ fontFamily: "monospace" }}>{selected.leadNumber}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Created At:</span>
                    <span>{selected.createdAt ? new Date(selected.createdAt).toLocaleString("en-IN") : "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Account Ref:</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{selected.userId ? selected.userId.slice(0, 12) + "..." : "Guest"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Booking Ref:</span>
                    <strong style={{ color: selected.masterBookingId ? "#059669" : "#64748b" }}>{selected.masterBookingId || "Pending Acceptance"}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Travel Requirements Grid */}
            <div style={{ marginTop: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                <MapPin size={15} style={{ color: "#2563eb" }} />
                <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569" }}>
                  Travel Requirements
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Destination(s)</span>
                  <strong style={{ color: "#0f172a" }}>{selected.destinations?.join(", ") || "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Travel Date</span>
                  <strong style={{ color: "#0f172a" }}>{selected.startDate || "Flexible"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Duration</span>
                  <strong style={{ color: "#0f172a" }}>{selected.durationDays ? `${selected.durationDays} Days` : "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Travellers</span>
                  <strong style={{ color: "#0f172a" }}>{selected.travellersCount ? `${selected.travellersCount} Guests` : "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Budget / Person</span>
                  <strong style={{ color: "#059669" }}>{selected.budgetPerPerson ? `₹${Number(selected.budgetPerPerson).toLocaleString("en-IN")}` : "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Stay Preference</span>
                  <strong style={{ color: "#0f172a" }}>{selected.hotelPreference || "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Transport</span>
                  <strong style={{ color: "#0f172a" }}>{selected.transportPreference || "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Interests</span>
                  <strong style={{ color: "#0f172a" }}>{selected.activitiesInterests?.join(", ") || "General Sightseeing"}</strong>
                </div>
              </div>
            </div>

            {/* Special Requests — FULL UNTRUNCATED TEXT */}
            <div style={{ marginTop: "16px", background: "#fff", border: "1px solid #fed7aa", borderRadius: "10px", padding: "16px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#c2410c", display: "block", marginBottom: "6px" }}>
                Special Requests & Customer Instructions (Full Text)
              </span>
              <p
                id="admin-lead-special-requests"
                style={{
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: "1.6",
                  color: "#334155",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#fff7ed",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #ffedd5",
                }}
              >
                {selected.specialRequests || "No special requests mentioned by customer."}
              </p>
            </div>

            {/* PAYMENT VERIFICATION STATUS IF PAID */}
            {selected.status === "PAID" && (
              <div style={{ marginTop: "16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#15803d", fontWeight: 800, fontSize: "13px", marginBottom: "8px" }}>
                  <CheckCircle2 size={18} /> Verified Payment & Confirmed Booking
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: "#166534", fontSize: "11px", display: "block" }}>Master Booking ID</span>
                    <strong style={{ fontFamily: "monospace", color: "#14532d" }}>{selected.masterBookingId}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#166534", fontSize: "11px", display: "block" }}>Payment Status</span>
                    <strong style={{ color: "#15803d" }}>PAID / VERIFIED</strong>
                  </div>
                  <div>
                    <span style={{ color: "#166534", fontSize: "11px", display: "block" }}>Razorpay Payment ID</span>
                    <strong style={{ fontFamily: "monospace", fontSize: "11px" }}>{selected.paymentId || "pay_verified"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#166534", fontSize: "11px", display: "block" }}>Razorpay Order ID</span>
                    <strong style={{ fontFamily: "monospace", fontSize: "11px" }}>{selected.paymentOrderId || "order_verified"}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* PROPOSAL BUILDER / SENDER SECTION */}
            <div style={{ marginTop: "28px", borderTop: "2px solid #e2e8f0", paddingTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    {selected.status === "PROPOSAL_SENT" || selected.status === "ACCEPTED" || selected.status === "PAID"
                      ? "Official Trip Proposal"
                      : "Create / Edit Proposal"}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Configure itinerary, pricing, and personal travel notes.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Proposal Title
                  </label>
                  <input
                    id="admin-proposal-title-input"
                    value={selected.proposalTitle || ""}
                    onChange={(event) => updateSelected({ proposalTitle: event.target.value })}
                    placeholder="e.g. 6D5N Kashmir Paradise: Srinagar, Gulmarg & Pahalgam"
                    style={{ display: "block", width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Final Payable Amount (INR)
                  </label>
                  <input
                    id="admin-proposal-amount-input"
                    type="number"
                    min="1"
                    value={selected.proposalAmount || ""}
                    onChange={(event) => updateSelected({ proposalAmount: Number(event.target.value) })}
                    placeholder="45000"
                    style={{ display: "block", width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "#059669" }}
                  />
                </div>
              </div>

              {/* Note from Zelevos (Admin Note) */}
              <div style={{ marginTop: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Note from Zelevos (Customer will read this in full)
                </label>
                <textarea
                  id="admin-proposal-notes-input"
                  rows={3}
                  value={selected.proposalNotes || ""}
                  onChange={(event) => updateSelected({ proposalNotes: event.target.value })}
                  placeholder="e.g. We have tailored this itinerary according to your requested 4-star stay, private cab, and snow activities."
                  style={{ display: "block", width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", lineHeight: "1.5" }}
                />
              </div>

              {/* Day-Wise Itinerary */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "22px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Day-Wise Itinerary Plan</h4>
                <button
                  type="button"
                  id="admin-add-day-btn"
                  onClick={() =>
                    updateSelected({
                      proposalItinerary: [
                        ...(selected.proposalItinerary || []),
                        blankDay((selected.proposalItinerary?.length || 0) + 1),
                      ],
                    })
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    borderRadius: "6px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} /> Add Day
                </button>
              </div>

              <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                {(selected.proposalItinerary || []).map((day, index) => (
                  <div key={`${day.day}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "13px", color: "#1e293b" }}>Day {day.day}</strong>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          aria-label="Move day up"
                          onClick={() => moveDay(index, -1)}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: "6px", color: "#64748b", cursor: "pointer" }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move day down"
                          onClick={() => moveDay(index, 1)}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: "6px", color: "#64748b", cursor: "pointer" }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete day"
                          onClick={() => removeDay(index)}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid #fecaca", background: "#fef2f2", borderRadius: "6px", color: "#dc2626", cursor: "pointer" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
                      {(["date", "location", "activity", "meal"] as const).map((field) => (
                        <input
                          key={field}
                          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                          value={day[field] || ""}
                          onChange={(event) => updateDay(index, { [field]: event.target.value })}
                          style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", background: "#ffffff" }}
                        />
                      ))}
                      <textarea
                        placeholder="Day description / itinerary details"
                        value={day.description}
                        onChange={(event) => updateDay(index, { description: event.target.value })}
                        style={{ gridColumn: "1 / -1", padding: "8px 10px", minHeight: "55px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", background: "#ffffff" }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  marginTop: "24px",
                  paddingTop: "16px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  type="button"
                  id="admin-save-draft-btn"
                  disabled={saving}
                  onClick={() => void save(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  <Save size={15} style={{ color: "#64748b" }} />
                  <span>{saving ? "Saving..." : "Save Draft"}</span>
                </button>
                <button
                  type="button"
                  id="admin-send-proposal-btn"
                  disabled={saving || !selected.proposalAmount || selected.proposalAmount <= 0}
                  onClick={() => void save(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                  }}
                >
                  <Send size={15} style={{ color: "#ffffff" }} />
                  <span>{saving ? "Sending..." : "Send Proposal"}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
