import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Save,
  Send,
  Trash2,
  FileText,
  CheckCircle2,
  User,
  Users,
  MapPin,
  Calendar,
  Clock,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Archive,
  RotateCcw,
  XCircle,
  Building,
  Car,
  Plane,
  Bus,
  Utensils,
  Shield,
  HeartHandshake,
  Paperclip,
  Download,
  Eye,
  Check,
  Tag,
  AlertCircle,
  MessageSquare,
  UserCheck,
} from "lucide-react";

export type ItineraryDay = {
  day: number;
  date?: string;
  location: string;
  activity: string;
  meal?: string;
  description: string;
};

export interface UploadedDoc {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

export type Lead = {
  id: string;
  leadNumber: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  userId?: string | null;
  startingLocation?: string | null;
  destination?: string | null;
  destinations: string[];
  datesFlexible?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  returnDate?: string | null;
  durationDays: number | null;
  travellersCount?: number | null;
  adultsCount?: number | null;
  childrenCount?: number | null;
  infantsCount?: number | null;
  budget?: number | null;
  budgetRange?: string | null;
  budgetPerPerson?: number | null;
  totalBudget?: number | null;
  stayPreference?: string | null;
  hotelPreference?: string | null;
  hotelCategory?: string | null;
  roomType?: string | null;
  roomsCount?: number | null;
  transportPreference?: string | null;
  transportTypes?: string[] | null;
  flightPreference?: {
    required?: boolean;
    class?: string;
    preferredAirline?: string;
    departureAirport?: string;
    arrivalAirport?: string;
    notes?: string;
  } | null;
  cabPreference?: {
    required?: boolean;
    vehicleType?: string;
    airportPickup?: boolean;
    airportDrop?: boolean;
    localSightseeing?: boolean;
    daysNeeded?: number;
    notes?: string;
  } | null;
  busPreference?: {
    required?: boolean;
    seatingType?: string;
    notes?: string;
  } | null;
  mealPreferences?: {
    plans?: string[];
    dietType?: string;
    dietaryRestrictions?: string;
    foodAllergies?: string;
    breakfast?: boolean;
    lunch?: boolean;
    dinner?: boolean;
    allMeals?: boolean;
  } | null;
  activitiesInterests?: string[] | null;
  accessibility?: {
    required?: boolean;
    wheelchairAssistance?: boolean;
    details?: string;
  } | null;
  travelInsurancePreference?: boolean | null;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  } | null;
  specialRequests?: string | null;
  documents?: UploadedDoc[] | null;
  isTemplate?: boolean | null;
  templateName?: string | null;
  internalNotes?: string | null;
  assignedTo?: string | null;
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
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
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

  // New admin interaction states
  const [newInternalNote, setNewInternalNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [assignedStaffInput, setAssignedStaffInput] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);

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
      setSelected((current) => {
        const found = current ? list.find((lead) => lead.id === current.id) : null;
        const next = found || list[0] || null;
        if (next) {
          setAssignedStaffInput(next.assignedTo || "");
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Custom trip leads could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSelectLead = (lead: Lead) => {
    setSelected(lead);
    setAssignedStaffInput(lead.assignedTo || "");
    setNewInternalNote("");
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selected) return;
    try {
      const response = await fetch(`/api/admin/custom-trips/${selected.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update status");
      onToast(`Request status updated to ${newStatus}`);
      const updated = data.lead || { ...selected, status: newStatus };
      setSelected(updated);
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, ...updated } : l)));
    } catch (e: any) {
      setError(e.message || "Failed to update status");
    }
  };

  const handleAssignStaff = async () => {
    if (!selected || !assignedStaffInput.trim()) return;
    setSavingStaff(true);
    try {
      const response = await fetch(`/api/admin/custom-trips/${selected.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: assignedStaffInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to assign staff");
      onToast(`Assigned to ${assignedStaffInput.trim()}`);
      const updated = data.lead || { ...selected, assignedTo: assignedStaffInput.trim() };
      setSelected(updated);
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, ...updated } : l)));
    } catch (e: any) {
      setError(e.message || "Failed to assign staff");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleSaveInternalNote = async () => {
    if (!selected || !newInternalNote.trim()) return;
    setSavingNote(true);
    try {
      const response = await fetch(`/api/admin/custom-trips/${selected.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: newInternalNote.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save internal note");
      onToast("Internal note logged successfully.");
      setNewInternalNote("");
      if (data.lead) {
        setSelected(data.lead);
        setLeads((prev) => prev.map((l) => (l.id === selected.id ? data.lead : l)));
      }
    } catch (e: any) {
      setError(e.message || "Failed to save internal note");
    } finally {
      setSavingNote(false);
    }
  };

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

  const cancelLead = async (id: string) => {
    const reason = window.prompt("Reason for cancelling this custom trip proposal/lead:", "Customer requested cancellation") || "Cancelled by operations";
    try {
      const response = await fetch(`/api/admin/custom-trips/${id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to cancel custom trip");
      onToast("Custom trip request cancelled.");
      await load(showArchived);
    } catch (e: any) {
      setError(e.message || "Failed to cancel custom trip");
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
      case "REVIEWING":
        return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" };
      case "CONTACTED":
        return { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" };
      case "PLANNING":
        return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
      case "QUOTATION_SENT":
      case "PROPOSAL_SENT":
        return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
      case "ACCEPTED":
      case "CONFIRMED":
      case "PAID":
        return { bg: "#dcfce7", text: "#15803d", border: "#86efac" };
      case "IN_PROGRESS":
        return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
      case "COMPLETED":
        return { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" };
      case "CANCELLED":
      case "DECLINED":
        return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    }
  };

  const statusList = [
    "NEW",
    "REVIEWING",
    "CONTACTED",
    "PLANNING",
    "QUOTATION_SENT",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ];

  return (
    <section className="admin-custom-trips-container grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      {/* Sidebar: Leads List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 h-fit">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h2 className="text-base font-extrabold text-slate-900 m-0">Custom Trip Requests</h2>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              id="admin-toggle-archived-leads-btn"
              onClick={() => {
                const next = !showArchived;
                setShowArchived(next);
                void load(next);
              }}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition ${
                showArchived
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {showArchived ? "Archived (ON)" : "Show Archived"}
            </button>
            <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {leads.length}
            </span>
          </div>
        </div>

        {loading && <p className="text-xs text-slate-500 py-4 text-center">Loading customer requests...</p>}
        {error && <p className="text-xs text-rose-600 py-2">{error}</p>}
        {!loading && !leads.length && (
          <p className="text-xs text-slate-500 py-8 text-center">No custom trip requests yet.</p>
        )}

        <div className="flex flex-col gap-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
          {leads.map((lead) => {
            const isSel = selected?.id === lead.id;
            const badge = getStatusColor(lead.status);
            return (
              <button
                key={lead.id}
                type="button"
                id={`lead-item-${lead.leadNumber}`}
                onClick={() => handleSelectLead(lead)}
                className={`w-full text-left p-3 rounded-xl border transition text-xs ${
                  isSel
                    ? "border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600/30"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start gap-1 mb-1">
                  <strong className="text-blue-900 font-mono text-[11px]">{lead.leadNumber}</strong>
                  <div className="flex gap-1">
                    {lead.isArchived && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                        ARCHIVED
                      </span>
                    )}
                    <span
                      className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full"
                      style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
                    >
                      {lead.status}
                    </span>
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-sm truncate">{lead.customerName}</div>
                <div className="text-slate-500 text-[11px] truncate mt-0.5">
                  {lead.destination || lead.destinations?.join(", ") || "Custom Vacation"} · {lead.durationDays || "?"} Days
                </div>
                {lead.budget && (
                  <div className="text-emerald-700 font-bold text-[11px] mt-1">
                    Budget: ₹{Number(lead.budget).toLocaleString("en-IN")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Full Request Details + Proposal Builder */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm overflow-hidden">
        {!selected ? (
          <div className="text-center py-16 text-slate-400">
            <FileText size={44} className="mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">Select a Customer Request</h3>
            <p className="text-xs text-slate-500 mt-1">Choose any vacation request from the left list to review complete details.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header / Meta Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extrabold text-blue-700 font-mono">{selected.leadNumber}</span>
                  <span
                    className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full"
                    style={getStatusColor(selected.status)}
                  >
                    {selected.status}
                  </span>
                  {selected.isArchived && (
                    <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      ARCHIVED
                    </span>
                  )}
                  {selected.isTemplate && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                      <Tag size={12} /> Template: {selected.templateName || "Vacation Template"}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">{selected.customerName}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submitted: {selected.createdAt ? new Date(selected.createdAt).toLocaleString("en-IN") : "Recent"}
                  {selected.updatedAt && ` · Updated: ${new Date(selected.updatedAt).toLocaleString("en-IN")}`}
                </p>
              </div>

              {/* Status & Actions Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 pl-1">Status:</span>
                  <select
                    id="admin-update-status-dropdown"
                    value={selected.status}
                    onChange={(e) => void handleStatusChange(e.target.value)}
                    className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusList.map((st) => (
                      <option key={st} value={st}>
                        {st.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {selected.isArchived ? (
                  <button
                    type="button"
                    id={`restore-lead-${selected.id}`}
                    onClick={() => void restoreLead(selected.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100"
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    id={`archive-lead-${selected.id}`}
                    onClick={() => void archiveLead(selected.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100"
                  >
                    <Archive size={14} /> Archive
                  </button>
                )}

                <button
                  type="button"
                  id={`delete-lead-${selected.id}`}
                  onClick={() => void deleteLead(selected.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>

            {/* Assignment & Operations Header */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <UserCheck size={16} className="text-blue-600 flex-shrink-0" />
                <span className="font-bold text-slate-700 whitespace-nowrap">Assigned Operations Staff:</span>
                <input
                  type="text"
                  id="admin-assigned-staff-input"
                  placeholder="e.g. Rahul Sharma (Destinations Desk)"
                  value={assignedStaffInput}
                  onChange={(e) => setAssignedStaffInput(e.target.value)}
                  className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  id="admin-save-assigned-staff-btn"
                  onClick={handleAssignStaff}
                  disabled={savingStaff}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm whitespace-nowrap"
                >
                  {savingStaff ? "Saving..." : "Assign"}
                </button>
              </div>

              {selected.assignedTo && (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                  Currently assigned: {selected.assignedTo}
                </span>
              )}
            </div>

            {/* ALL 40 CUSTOMER REQUIREMENTS DISPLAY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Card 1: Customer Details */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <User size={15} /> Customer Details
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Customer ID</span>
                    <strong className="text-blue-900 font-mono">{selected.customerId || "ZLV-CUS-GUEST"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Account ID</span>
                    <span className="font-mono text-slate-700 truncate block">{selected.userId || "Guest"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Email</span>
                    <a href={`mailto:${selected.customerEmail}`} className="text-blue-600 font-semibold hover:underline truncate block">
                      {selected.customerEmail}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Phone</span>
                    <a href={`tel:${selected.customerPhone}`} className="text-slate-800 font-semibold hover:underline block">
                      {selected.customerPhone || "—"}
                    </a>
                  </div>
                </div>
              </div>

              {/* Card 2: Journey & Dates */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <MapPin size={15} /> Journey & Timing
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Starting Location</span>
                    <strong className="text-slate-900">{selected.startingLocation || "Not specified"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Destination(s)</span>
                    <strong className="text-slate-900">{selected.destination || selected.destinations?.join(", ") || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Travel Date</span>
                    <strong className="text-slate-900">{selected.startDate || "Flexible"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Return Date</span>
                    <strong className="text-slate-900">{selected.returnDate || selected.endDate || "Flexible"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Duration</span>
                    <strong className="text-blue-700">{selected.durationDays ? `${selected.durationDays} Days` : "Custom"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Dates Flexible</span>
                    <span className={`font-semibold ${selected.datesFlexible ? "text-emerald-700" : "text-slate-600"}`}>
                      {selected.datesFlexible ? "Yes (±3 days)" : "Fixed dates"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Travellers & Budget */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <Users size={15} /> Travellers & Budget
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Adults</span>
                    <strong className="text-slate-900">{selected.adultsCount ?? selected.travellersCount ?? 2}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Children</span>
                    <strong className="text-slate-900">{selected.childrenCount ?? 0}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Infants</span>
                    <strong className="text-slate-900">{selected.infantsCount ?? 0}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[11px]">Approx Total Budget</span>
                    <strong className="text-emerald-700 text-sm">
                      {selected.budget ? `₹${Number(selected.budget).toLocaleString("en-IN")}` : "Flexible"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Budget Range</span>
                    <span className="text-slate-700 font-medium">{selected.budgetRange || "Comfort"}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Stay & Accommodation */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <Building size={15} /> Stay Preferences
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Category</span>
                    <strong className="text-slate-900">{selected.stayPreference || "Hotels & Resorts"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Hotel Rating</span>
                    <strong className="text-slate-900">{selected.hotelCategory || selected.hotelPreference || "4 Star"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Room Type</span>
                    <strong className="text-slate-900">{selected.roomType || "Deluxe Room"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Number of Rooms</span>
                    <strong className="text-slate-900">{selected.roomsCount ?? 1} Room(s)</strong>
                  </div>
                </div>
              </div>

              {/* Card 5: Transport Preferences */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <Car size={15} /> Transport Requirements
                </div>
                <div className="space-y-2">
                  {selected.cabPreference && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <strong className="text-blue-800 block text-[11px] flex items-center gap-1">
                        <Car size={12} /> Cab: {selected.cabPreference.vehicleType || "Private Cab"}
                      </strong>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 mt-1">
                        {selected.cabPreference.airportPickup && <span>✓ Airport Pickup</span>}
                        {selected.cabPreference.airportDrop && <span>✓ Airport Drop</span>}
                        {selected.cabPreference.localSightseeing && <span>✓ Local Sightseeing</span>}
                      </div>
                    </div>
                  )}
                  {selected.flightPreference && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <strong className="text-blue-800 block text-[11px] flex items-center gap-1">
                        <Plane size={12} /> Flight: {selected.flightPreference.class || "Economy"}
                      </strong>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Route: {selected.flightPreference.departureAirport || "Origin"} → {selected.flightPreference.arrivalAirport || "Destination"}
                      </div>
                    </div>
                  )}
                  {selected.busPreference && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <strong className="text-blue-800 block text-[11px] flex items-center gap-1">
                        <Bus size={12} /> Bus: {selected.busPreference.seatingType || "Volvo AC"}
                      </strong>
                    </div>
                  )}
                  {!selected.cabPreference && !selected.flightPreference && !selected.busPreference && (
                    <div className="text-slate-600">{selected.transportPreference || "Private Cab"}</div>
                  )}
                </div>
              </div>

              {/* Card 6: Meals & Dietary */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <Utensils size={15} /> Meals & Dietary
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Diet Type</span>
                    <strong className="text-slate-900">{selected.mealPreferences?.dietType || "Standard"}</strong>
                  </div>
                  {selected.mealPreferences?.plans && selected.mealPreferences.plans.length > 0 && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Included Plans</span>
                      <span className="text-slate-800">{selected.mealPreferences.plans.join(", ")}</span>
                    </div>
                  )}
                  {selected.mealPreferences?.dietaryRestrictions && (
                    <div className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                      <strong>Restrictions:</strong> {selected.mealPreferences.dietaryRestrictions}
                    </div>
                  )}
                  {selected.mealPreferences?.foodAllergies && (
                    <div className="text-rose-800 bg-rose-50 p-1.5 rounded border border-rose-200">
                      <strong>Allergies:</strong> {selected.mealPreferences.foodAllergies}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 7: Activities & Accessibility */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <Shield size={15} /> Activities, Safety & Accessibility
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Interests / Activities</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selected.activitiesInterests || ["Scenic Drives", "Nature", "Local Dining"]).map((act) => (
                      <span key={act} className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200 text-[11px] font-medium">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
                {selected.accessibility?.required && (
                  <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 mt-2">
                    <strong>Accessibility Assistance:</strong> {selected.accessibility.wheelchairAssistance ? "Wheelchair assistance required. " : ""}
                    {selected.accessibility.details || "Ground floor / accessible rooms requested."}
                  </div>
                )}
                <div className="pt-1 text-[11px]">
                  <span className="text-slate-500">Travel Insurance: </span>
                  <strong className={selected.travelInsurancePreference ? "text-emerald-700" : "text-slate-600"}>
                    {selected.travelInsurancePreference ? "Included / Requested" : "Not requested"}
                  </strong>
                </div>
              </div>

              {/* Card 8: Emergency Contact */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-[11px] mb-2">
                  <HeartHandshake size={15} /> Emergency Contact
                </div>
                {selected.emergencyContact?.name ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Name</span>
                      <strong className="text-slate-900">{selected.emergencyContact.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Relationship</span>
                      <span className="text-slate-800">{selected.emergencyContact.relationship || "Family"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Phone</span>
                      <a href={`tel:${selected.emergencyContact.phone}`} className="text-blue-600 font-semibold hover:underline">
                        {selected.emergencyContact.phone}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-[11px]">No emergency contact provided.</p>
                )}
              </div>
            </div>

            {/* Special Requests — Full Unclipped Text */}
            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1">
                Special Requests & Customer Instructions
              </span>
              <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed m-0 font-medium">
                {selected.specialRequests || "No specific special requests noted by the customer."}
              </p>
            </div>

            {/* Document Attachments Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-xs">
                  <Paperclip size={16} /> Uploaded Documents ({selected.documents?.length || 0})
                </div>
                <span className="text-[11px] text-slate-500">Protected & Authorized</span>
              </div>

              {selected.documents && selected.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={18} className="text-blue-600 flex-shrink-0" />
                        <div className="truncate">
                          <strong className="block text-slate-900 truncate">{doc.fileName}</strong>
                          <span className="text-[11px] text-slate-500">
                            {Math.round(doc.fileSize / 1024)} KB · {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={`/api/custom-trips/documents/${doc.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
                          title="View Document"
                        >
                          <Eye size={15} />
                        </a>
                        <a
                          href={`/api/custom-trips/documents/${doc.id}/download?download=true`}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Download Document"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-1">No document attachments uploaded for this request.</p>
              )}
            </div>

            {/* Internal Notes History & Input */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-xs">
                <MessageSquare size={16} /> Operations Internal Notes
              </div>

              {selected.internalNotes ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed m-0">
                    {selected.internalNotes}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No internal notes logged yet.</p>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  id="admin-new-internal-note-input"
                  placeholder="Add an internal operations note (e.g. Spoke with customer on WhatsApp, prefers Taj Vivanta)..."
                  value={newInternalNote}
                  onChange={(e) => setNewInternalNote(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  id="admin-save-internal-note-btn"
                  onClick={handleSaveInternalNote}
                  disabled={savingNote || !newInternalNote.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-sm transition"
                >
                  {savingNote ? "Saving..." : "Log Note"}
                </button>
              </div>
            </div>

            {/* PROPOSAL BUILDER / SENDER SECTION */}
            <div className="pt-4 border-t-2 border-slate-200 space-y-4">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {selected.status === "PROPOSAL_SENT" || selected.status === "CONFIRMED" || selected.status === "PAID"
                    ? "Official Trip Proposal"
                    : "Create & Send Proposal"}
                </h3>
                <p className="text-xs text-slate-500">Configure itinerary, pricing, and personal travel notes.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Proposal Title</label>
                  <input
                    id="admin-proposal-title-input"
                    value={selected.proposalTitle || ""}
                    onChange={(event) => updateSelected({ proposalTitle: event.target.value })}
                    placeholder="e.g. 6D5N Kashmir Paradise: Srinagar, Gulmarg & Pahalgam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payable Amount (₹)</label>
                  <input
                    id="admin-proposal-amount-input"
                    type="number"
                    min="1"
                    value={selected.proposalAmount || ""}
                    onChange={(event) => updateSelected({ proposalAmount: Number(event.target.value) })}
                    placeholder="45000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note to Customer (Customer reads this in full)
                </label>
                <textarea
                  id="admin-proposal-notes-input"
                  rows={3}
                  value={selected.proposalNotes || ""}
                  onChange={(event) => updateSelected({ proposalNotes: event.target.value })}
                  placeholder="e.g. We have tailored this itinerary according to your requested 4-star stay, private cab, and snow activities."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Day-Wise Itinerary */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-extrabold text-slate-900">Day-Wise Itinerary Plan</h4>
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
                    className="inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg px-3 py-1.5 text-xs font-bold transition"
                  >
                    <Plus size={14} /> Add Day
                  </button>
                </div>

                <div className="space-y-3">
                  {(selected.proposalItinerary || []).map((day, index) => (
                    <div key={`${day.day}-${index}`} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
                      <div className="flex justify-between items-center">
                        <strong className="text-xs font-bold text-blue-900 uppercase">Day {day.day}</strong>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveDay(index, -1)}
                            className="w-7 h-7 flex items-center justify-center border border-slate-300 bg-white rounded-lg text-slate-600 hover:bg-slate-100"
                            title="Move up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveDay(index, 1)}
                            className="w-7 h-7 flex items-center justify-center border border-slate-300 bg-white rounded-lg text-slate-600 hover:bg-slate-100"
                            title="Move down"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDay(index)}
                            className="w-7 h-7 flex items-center justify-center border border-rose-200 bg-rose-50 rounded-lg text-rose-600 hover:bg-rose-100"
                            title="Delete day"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["date", "location", "activity", "meal"] as const).map((field) => (
                          <input
                            key={field}
                            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                            value={day[field] || ""}
                            onChange={(event) => updateDay(index, { [field]: event.target.value })}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        ))}
                        <textarea
                          placeholder="Day description / itinerary details"
                          value={day.description}
                          onChange={(event) => updateDay(index, { description: event.target.value })}
                          className="col-span-2 sm:col-span-4 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  id="admin-save-draft-btn"
                  disabled={saving}
                  onClick={() => void save(false)}
                  className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Save size={15} />
                  <span>{saving ? "Saving..." : "Save Draft"}</span>
                </button>
                <button
                  type="button"
                  id="admin-send-proposal-btn"
                  disabled={saving || !selected.proposalAmount || selected.proposalAmount <= 0}
                  onClick={() => void save(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition"
                >
                  <Send size={15} />
                  <span>{saving ? "Sending..." : "Send Proposal to Customer"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
