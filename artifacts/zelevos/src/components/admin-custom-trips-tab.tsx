import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Send, Trash2 } from "lucide-react";

type ItineraryDay = {
  day: number;
  date?: string;
  location: string;
  activity: string;
  meal?: string;
  description: string;
};

type Lead = {
  id: string;
  leadNumber: string;
  customerName: string;
  customerEmail: string;
  destinations: string[];
  durationDays: number | null;
  proposalTitle: string | null;
  proposalAmount: number | null;
  proposalItinerary: ItineraryDay[];
  proposalNotes: string | null;
  status: string;
};

const blankDay = (day: number): ItineraryDay => ({ day, date: "", location: "", activity: "", meal: "", description: "" });

export function AdminCustomTripsTab({ onToast }: { onToast: (message: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/custom-trips", { credentials: "include" });
      const payload = await response.json() as { leads?: Lead[]; message?: string };
      if (!response.ok) throw new Error(payload.message || "Custom trip leads could not be loaded.");
      setLeads(payload.leads || []);
      setSelected((current) => current ? (payload.leads || []).find((lead) => lead.id === current.id) || current : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Custom trip leads could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateSelected = (changes: Partial<Lead>) => setSelected((current) => current ? { ...current, ...changes } : current);

  const save = async (send: boolean) => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/custom-trips/${selected.id}/proposal${send ? "" : ""}`, {
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
      const payload = await response.json() as { lead?: Lead; message?: string };
      if (!response.ok || !payload.lead) throw new Error(payload.message || "Proposal could not be saved.");
      setSelected(payload.lead);
      setLeads((current) => current.map((lead) => lead.id === payload.lead!.id ? payload.lead! : lead));
      onToast(send ? "Proposal sent to the customer." : "Proposal draft saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Proposal could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (index: number, changes: Partial<ItineraryDay>) => {
    if (!selected) return;
    const proposalItinerary = selected.proposalItinerary.map((day, currentIndex) => currentIndex === index ? { ...day, ...changes } : day);
    updateSelected({ proposalItinerary });
  };

  const removeDay = (index: number) => {
    if (!selected) return;
    updateSelected({ proposalItinerary: selected.proposalItinerary.filter((_, currentIndex) => currentIndex !== index).map((day, currentIndex) => ({ ...day, day: currentIndex + 1 })) });
  };

  const moveDay = (index: number, direction: -1 | 1) => {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.proposalItinerary.length) return;
    const proposalItinerary = [...selected.proposalItinerary];
    [proposalItinerary[index], proposalItinerary[target]] = [proposalItinerary[target], proposalItinerary[index]];
    updateSelected({ proposalItinerary: proposalItinerary.map((day, currentIndex) => ({ ...day, day: currentIndex + 1 })) });
  };

  return (
    <section style={{ display: "grid", gridTemplateColumns: "minmax(250px, .7fr) minmax(0, 1.3fr)", gap: "18px" }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "18px" }}>Custom Trip Leads</h2>
        {loading && <p>Loading leads...</p>}
        {error && <p style={{ color: "#b42318", fontSize: "12px" }}>{error}</p>}
        {!loading && !leads.length && <p style={{ color: "#64748b", fontSize: "13px" }}>No custom trip requests yet.</p>}
        {leads.map((lead) => (
          <button key={lead.id} type="button" onClick={() => setSelected(lead)} style={{ display: "block", width: "100%", textAlign: "left", border: selected?.id === lead.id ? "2px solid #2563eb" : "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", padding: "10px", marginBottom: "8px", cursor: "pointer" }}>
            <strong style={{ display: "block", fontSize: "12px" }}>{lead.leadNumber}</strong>
            <span style={{ display: "block", fontSize: "12px" }}>{lead.customerName}</span>
            <small style={{ color: "#64748b" }}>{lead.status} · {lead.destinations?.join(", ")}</small>
          </button>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
        {!selected ? <p style={{ color: "#64748b" }}>Select a lead to create or edit its proposal.</p> : <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>{selected.leadNumber}</span>
              <h2 style={{ margin: "3px 0", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{selected.customerName}</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "12px" }}>{selected.customerEmail}</p>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                background: selected.status === "NEW" ? "#eff6ff" : selected.status === "PROPOSAL_SENT" ? "#ecfdf5" : "#f1f5f9",
                color: selected.status === "NEW" ? "#1d4ed8" : selected.status === "PROPOSAL_SENT" ? "#047857" : "#475569",
                border: selected.status === "NEW" ? "1px solid #bfdbfe" : selected.status === "PROPOSAL_SENT" ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
              }}
            >
              {selected.status}
            </span>
          </div>
          {error && <p style={{ color: "#b42318", fontSize: "12px" }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "10px", marginTop: "18px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>Proposal title<input value={selected.proposalTitle || ""} onChange={(event) => updateSelected({ proposalTitle: event.target.value })} style={{ display: "block", width: "100%", marginTop: "5px", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }} /></label>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>Amount (INR)<input type="number" min="1" value={selected.proposalAmount || ""} onChange={(event) => updateSelected({ proposalAmount: Number(event.target.value) })} style={{ display: "block", width: "100%", marginTop: "5px", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }} /></label>
          </div>
          <label style={{ display: "block", marginTop: "12px", fontSize: "11px", fontWeight: 700, color: "#334155" }}>Proposal notes<textarea value={selected.proposalNotes || ""} onChange={(event) => updateSelected({ proposalNotes: event.target.value })} style={{ display: "block", width: "100%", minHeight: "65px", marginTop: "5px", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }} /></label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "22px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Structured itinerary</h3>
            <button
              type="button"
              onClick={() => updateSelected({ proposalItinerary: [...(selected.proposalItinerary || []), blankDay((selected.proposalItinerary?.length || 0) + 1)] })}
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
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add day
            </button>
          </div>
          <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
            {(selected.proposalItinerary || []).map((day, index) => (
              <div key={`${day.day}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "13px", color: "#1e293b" }}>Day {day.day}</strong>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      aria-label="Move day up"
                      title="Move day up"
                      onClick={() => moveDay(index, -1)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        borderRadius: "6px",
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move day down"
                      title="Move day down"
                      onClick={() => moveDay(index, 1)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        borderRadius: "6px",
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete day"
                      title="Delete day"
                      onClick={() => removeDay(index)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        borderRadius: "6px",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
                  {(["date", "location", "activity", "meal"] as const).map((field) => (
                    <input
                      key={field}
                      aria-label={field}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={day[field] || ""}
                      onChange={(event) => updateDay(index, { [field]: event.target.value })}
                      style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", background: "#ffffff" }}
                    />
                  ))}
                  <textarea
                    aria-label="description"
                    placeholder="Day description / itinerary details"
                    value={day.description}
                    onChange={(event) => updateDay(index, { description: event.target.value })}
                    style={{ gridColumn: "1 / -1", padding: "8px 10px", minHeight: "55px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", background: "#ffffff" }}
                  />
                </div>
              </div>
            ))}
          </div>
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
              disabled={saving}
              onClick={() => void save(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = "#ffffff";
              }}
            >
              <Save size={15} style={{ color: "#64748b" }} />
              <span>{saving ? "Saving draft..." : "Save Draft"}</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 22px",
                borderRadius: "8px",
                border: "1px solid #1d4ed8",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.boxShadow = "0 4px 14px rgba(37, 99, 235, 0.4)";
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.boxShadow = "0 2px 8px rgba(37, 99, 235, 0.3)";
              }}
            >
              <Send size={15} style={{ color: "#ffffff" }} />
              <span>{saving ? "Sending proposal..." : "Send Proposal"}</span>
            </button>
          </div>
        </>}
      </div>
    </section>
  );
}
