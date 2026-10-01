import React, { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileUp,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  FileText,
  Plus,
  Trash2,
  DollarSign,
  Layers,
  FileCheck,
  XCircle,
  ExternalLink,
  MessageSquare,
  X,
  Check,
  ShieldAlert,
  AlertTriangle,
  Ban,
  Pause,
  Play,
  Calendar,
  ChevronDown,
  Info,
  CheckCircle,
} from "lucide-react";

export function AdminVendorTab({ onToast }: { onToast: (msg: string) => void }) {
  const [subTab, setSubTab] = useState<"requests" | "services" | "documents" | "invoices">("requests");
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Vendor selection state (for Admin to inspect any vendor)
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");

  // Disciplinary Actions & Modals state
  const [showTempModal, setShowTempModal] = useState(false);
  const [tempDays, setTempDays] = useState(7);
  const [tempCustomDate, setTempCustomDate] = useState("");
  const [tempReason, setTempReason] = useState("Late response SLA violations on multiple bookings");
  const [tempNotes, setTempNotes] = useState("");
  const [tempLoading, setTempLoading] = useState(false);

  const [showPermModal, setShowPermModal] = useState(false);
  const [permReason, setPermReason] = useState("Unethical customer extortion and repeated misconduct");
  const [permNotes, setPermNotes] = useState("");
  const [permLoading, setPermLoading] = useState(false);

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeReason, setRemoveReason] = useState("Contract termination and supplier offboarding");
  const [forceRemove, setForceRemove] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentType, setIncidentType] = useState("GUEST_MISBEHAVIOR");
  const [incidentReason, setIncidentReason] = useState("");
  const [incidentBookingRef, setIncidentBookingRef] = useState("");
  const [incidentLoading, setIncidentLoading] = useState(false);

  const [reactivateLoading, setReactivateLoading] = useState(false);

  // Per-task accept states
  const [confirmRefs, setConfirmRefs] = useState<Record<string, string>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Reject / Change request modal state
  const [rejectingTask, setRejectingTask] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingLoading, setRejectingLoading] = useState(false);

  const [changingTask, setChangingTask] = useState<any | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [changingLoading, setChangingLoading] = useState(false);

  // New Service Form
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({
    serviceType: "Hotel",
    title: "",
    location: "",
    rate: 2500,
    capacity: 2,
    availability: "Available Year-Round",
    description: "",
  });
  const [savingService, setSavingService] = useState(false);

  // New Document Form
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDoc, setNewDoc] = useState({
    documentType: "license",
    title: "",
    fileUrl: "/documents/supplier-license.pdf",
  });
  const [savingDoc, setSavingDoc] = useState(false);

  // New Invoice Form
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-5)}`,
    amount: 5000,
    notes: "Fulfillment completed according to voucher instructions.",
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

  const loadData = async (targetVendorId?: string) => {
    setLoading(true);
    try {
      // 1. Fetch all vendors so admin can switch between them
      const vListRes = await fetch("/api/admin/vendors", { credentials: "include" }).catch(() => null);
      if (vListRes && vListRes.ok) {
        const vListData = await vListRes.json();
        const list = Array.isArray(vListData.vendors) ? vListData.vendors : [];
        setVendorsList(list);
      }

      const activeId = targetVendorId || selectedVendorId;
      const q = activeId ? `?vendorId=${encodeURIComponent(activeId)}` : "";

      const [dashRes, reqsRes, svcsRes, docsRes, invsRes] = await Promise.all([
        fetch(`/api/vendor/portal/dashboard${q}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/vendor/portal/requests${q}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : { requests: [] })),
        fetch(`/api/vendor/portal/services${q}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : { services: [] })),
        fetch(`/api/vendor/portal/documents${q}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : { documents: [] })),
        fetch(`/api/vendor/portal/invoices${q}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : { invoices: [] })),
      ]);

      setDashboard(dashRes);
      if (dashRes?.vendor?.id && !selectedVendorId) {
        setSelectedVendorId(dashRes.vendor.id);
      }
      const reqList = Array.isArray(reqsRes.requests) ? reqsRes.requests : [];
      setRequests(reqList);
      setServices(Array.isArray(svcsRes.services) ? svcsRes.services : []);
      setDocuments(Array.isArray(docsRes.documents) ? docsRes.documents : []);
      setInvoices(Array.isArray(invsRes.invoices) ? invsRes.invoices : []);

      // Initialize default refs
      const initialRefs: Record<string, string> = {};
      reqList.forEach((r: any) => {
        const id = r.task?.id || r.id;
        initialRefs[id] = r.task?.supplierConfirmationRef || `CONF-VND-${Date.now().toString().slice(-5)}`;
      });
      setConfirmRefs(initialRefs);
    } catch {
      onToast("Failed to load vendor portal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVendorSelect = (id: string) => {
    setSelectedVendorId(id);
    loadData(id);
  };

  // Disciplinary action handlers
  const handleTemporarySuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor?.id) return;
    setTempLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "temporary_suspend",
          durationDays: tempDays,
          suspensionUntil: tempCustomDate || undefined,
          reason: tempReason,
          notes: tempNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to suspend vendor.");
      onToast(`Vendor ${vendor.businessName} temporarily suspended for ${tempDays} days.`);
      setShowTempModal(false);
      loadData(vendor.id);
    } catch (err: any) {
      onToast(err.message || "Temporary suspension failed.");
    } finally {
      setTempLoading(false);
    }
  };

  const handlePermanentSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor?.id) return;
    setPermLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "permanent_suspend",
          reason: permReason,
          notes: permNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to blacklist vendor.");
      onToast(`Vendor ${vendor.businessName} PERMANENTLY blacklisted.`);
      setShowPermModal(false);
      loadData(vendor.id);
    } catch (err: any) {
      onToast(err.message || "Permanent suspension failed.");
    } finally {
      setPermLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!vendor?.id) return;
    setReactivateLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reactivate vendor.");
      onToast(`Vendor ${vendor.businessName} reactivated and reinstated to APPROVED.`);
      loadData(vendor.id);
    } catch (err: any) {
      onToast(err.message || "Reactivation failed.");
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleRemoveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor?.id) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}?force=${forceRemove}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to remove vendor.");
      onToast(`Vendor ${vendor.businessName} removed from active operations.`);
      setShowRemoveModal(false);
      loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to remove vendor.");
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleRecordIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor?.id) return;
    if (!incidentReason.trim()) {
      onToast("Please describe the incident / misbehavior reason.");
      return;
    }
    setIncidentLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "record_incident",
          incidentType,
          reason: incidentReason,
          notes: incidentBookingRef ? `Related to Booking: ${incidentBookingRef}` : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to log incident.");
      onToast(`Incident recorded: +1 strike added to ${vendor.businessName}.`);
      setShowIncidentModal(false);
      setIncidentReason("");
      setIncidentBookingRef("");
      loadData(vendor.id);
    } catch (err: any) {
      onToast(err.message || "Failed to record incident.");
    } finally {
      setIncidentLoading(false);
    }
  };

  const handleAcceptRequest = async (taskId: string) => {
    setAcceptingId(taskId);
    const confirmationRef = confirmRefs[taskId] || `CONF-${Date.now().toString().slice(-6)}`;

    try {
      const res = await fetch(`/api/vendor/portal/requests/${taskId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirmationRef,
          notes: "Vendor confirmed availability and locked net inventory.",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to accept vendor request.");
      }

      onToast(`Request accepted with supplier reference ${confirmationRef}!`);
      loadData();
    } catch (err: any) {
      onToast(err.message || "Acceptance failed.");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectingTask) return;
    setRejectingLoading(true);

    try {
      const res = await fetch(`/api/vendor/portal/requests/${rejectingTask.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectionReason || "Unavailable for requested dates" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject request.");

      onToast("Booking request rejected. Operations desk will reassign.");
      setRejectingTask(null);
      setRejectionReason("");
      loadData();
    } catch (err: any) {
      onToast(err.message || "Rejection failed.");
    } finally {
      setRejectingLoading(false);
    }
  };

  const handleRequestChange = async () => {
    if (!changingTask) return;
    setChangingLoading(true);

    try {
      const res = await fetch(`/api/vendor/portal/requests/${changingTask.id}/request-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: changeNotes || "Vendor requested date modification" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit change request.");

      onToast("Change request submitted to Operations team!");
      setChangingTask(null);
      setChangeNotes("");
      loadData();
    } catch (err: any) {
      onToast(err.message || "Request failed.");
    } finally {
      setChangingLoading(false);
    }
  };

  const handleUploadDocument = async (taskId: string) => {
    setUploadingId(taskId);
    try {
      const res = await fetch(`/api/vendor/portal/requests/${taskId}/upload-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentUrl: `/vouchers/signed-supplier-voucher-${Date.now().toString().slice(-4)}.pdf`,
          documentType: "confirmation_voucher",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to upload confirmation document.");
      }

      onToast("Confirmation document uploaded successfully!");
      loadData();
    } catch (err: any) {
      onToast(err.message || "Document upload failed.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.title.trim() || !newService.location.trim()) {
      onToast("Title and location are required.");
      return;
    }

    setSavingService(true);
    try {
      const res = await fetch("/api/vendor/portal/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newService),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create service.");

      onToast("New service added to your catalog!");
      setShowAddService(false);
      setNewService({
        serviceType: "Hotel",
        title: "",
        location: "",
        rate: 2500,
        capacity: 2,
        availability: "Available Year-Round",
        description: "",
      });
      loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to create service.");
    } finally {
      setSavingService(false);
    }
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title.trim()) {
      onToast("Document title is required.");
      return;
    }

    setSavingDoc(true);
    try {
      const res = await fetch("/api/vendor/portal/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentType: newDoc.documentType,
          title: newDoc.title.trim(),
          fileUrl: newDoc.fileUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload document.");

      onToast("Document uploaded! Awaiting Admin verification.");
      setShowAddDoc(false);
      setNewDoc({
        documentType: "license",
        title: "",
        fileUrl: "/documents/supplier-license.pdf",
      });
      loadData();
    } catch (err: any) {
      onToast(err.message || "Document upload failed.");
    } finally {
      setSavingDoc(false);
    }
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInvoice(true);
    try {
      const res = await fetch("/api/vendor/portal/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newInvoice),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit invoice.");

      onToast("Invoice submitted for finance approval!");
      setShowAddInvoice(false);
      setNewInvoice({
        invoiceNumber: `INV-${Date.now().toString().slice(-5)}`,
        amount: 5000,
        notes: "Fulfillment completed according to voucher instructions.",
      });
      loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to submit invoice.");
    } finally {
      setSavingInvoice(false);
    }
  };

  const vendor = dashboard?.vendor || {};
  const stats = dashboard?.stats || {};
  const metrics = stats.performanceMetrics || {};

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Vendor Portal & Partner Desk (Section 9)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Direct supplier fulfillment desk for contracted hotel, transfer & activity partners.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Supplier Switcher Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "4px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            <Building2 size={15} style={{ color: "#2563eb" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Select Vendor:</span>
            <select
              value={selectedVendorId}
              onChange={(e) => handleVendorSelect(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 700,
                color: "#0f172a",
                cursor: "pointer",
                outline: "none",
                maxWidth: "260px",
              }}
            >
              {vendorsList.length === 0 ? (
                <option value={vendor.id || ""}>{vendor.businessName || "Contracted Vendor"}</option>
              ) : (
                vendorsList.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.businessName} ({v.vendorId}) — {v.status}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            type="button"
            onClick={() => loadData(selectedVendorId)}
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
      </div>

      {/* DISCIPLINARY STATUS ALERT BANNERS */}
      {vendor.status === "SUSPENDED" && vendor.suspensionType === "TEMPORARY" && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            boxShadow: "0 1px 3px rgba(217, 119, 6, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "14px", color: "#92400e" }}>
                  ⚠️ TEMPORARY SUSPENSION ACTIVE
                </strong>
                {vendor.suspensionUntil && (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#fef3c7", color: "#b45309" }}>
                    Expires: {new Date(vendor.suspensionUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#b45309" }}>
                <strong>Reason:</strong> {vendor.suspensionReason || "Administrative disciplinary action."}
              </p>
              {vendor.disciplinaryNotes && (
                <span style={{ fontSize: "11px", color: "#78350f", display: "block", marginTop: "2px", fontFamily: "monospace" }}>
                  Internal Log: {vendor.disciplinaryNotes.split("\n").slice(-1)[0]}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={reactivateLoading}
            onClick={handleReactivate}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#059669",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CheckCircle2 size={15} />
            <span>{reactivateLoading ? "Reactivating..." : "Reactivate Supplier Now"}</span>
          </button>
        </div>
      )}

      {vendor.status === "SUSPENDED" && vendor.suspensionType === "PERMANENT" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            boxShadow: "0 1px 3px rgba(220, 38, 38, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fee2e2", color: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <strong style={{ fontSize: "14px", color: "#991b1b" }}>
                🛑 VENDOR PERMANENTLY BLACKLISTED — ACCESS REVOKED
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#b91c1c" }}>
                <strong>Reason:</strong> {vendor.suspensionReason || "Severe misconduct, fraud, or irreversible contract termination."}
              </p>
              {vendor.disciplinaryNotes && (
                <span style={{ fontSize: "11px", color: "#7f1d1d", display: "block", marginTop: "2px", fontFamily: "monospace" }}>
                  Record: {vendor.disciplinaryNotes.split("\n").slice(-1)[0]}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={reactivateLoading}
            onClick={handleReactivate}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CheckCircle2 size={15} />
            <span>{reactivateLoading ? "Reinstating..." : "Reinstate Vendor"}</span>
          </button>
        </div>
      )}

      {vendor.status === "REMOVED" && (
        <div
          style={{
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Ban size={20} style={{ color: "#64748b" }} />
          <div>
            <strong style={{ fontSize: "14px", color: "#334155" }}>
              🔒 VENDOR REMOVED FROM ACTIVE DISPATCH
            </strong>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
              This supplier account has been archived and removed from customer booking dispatch.
            </p>
          </div>
        </div>
      )}

      {vendor.status !== "SUSPENDED" && vendor.status !== "REMOVED" && (vendor.misbehaviorStrikes || 0) > 0 && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fef08a",
            borderRadius: "10px",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={16} style={{ color: "#d97706" }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400e" }}>
              Disciplinary Warning: This supplier has {vendor.misbehaviorStrikes} incident strike(s) on record.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTempModal(true)}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              background: "#d97706",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Review Disciplinary Action
          </button>
        </div>
      )}

      {/* Vendor Profile & Disciplinary Control Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          padding: "20px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "12px",
              background: vendor.status === "SUSPENDED" ? "#dc2626" : "#2563eb",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 10px rgba(37,99,235,0.2)",
            }}
          >
            <Building2 size={26} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                {vendor.businessName || "Himalayan Stays & Luxury Resorts"}
              </h3>
              {vendor.status === "SUSPENDED" ? (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "10px",
                    background: vendor.suspensionType === "PERMANENT" ? "#fef2f2" : "#fffbeb",
                    color: vendor.suspensionType === "PERMANENT" ? "#dc2626" : "#d97706",
                    border: `1px solid ${vendor.suspensionType === "PERMANENT" ? "#fecaca" : "#fde68a"}`,
                  }}
                >
                  {vendor.suspensionType === "PERMANENT" ? "🛑 Permanently Blacklisted" : "⚠️ Temporarily Suspended"}
                </span>
              ) : vendor.status === "REMOVED" ? (
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", background: "#f1f5f9", color: "#64748b" }}>
                  Removed
                </span>
              ) : (
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", background: "#ecfdf5", color: "#059669" }}>
                  Verified Partner ({vendor.vendorId || "VND-HIMALAYAN"})
                </span>
              )}

              {/* Strikes Counter Badge */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "8px",
                  background: (vendor.misbehaviorStrikes || 0) > 0 ? "#fef3c7" : "#f1f5f9",
                  color: (vendor.misbehaviorStrikes || 0) > 0 ? "#b45309" : "#475569",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <AlertTriangle size={12} />
                {vendor.misbehaviorStrikes || 0} Incident Strikes
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
              Contact: {vendor.contactName || "Tariq Ahmad"} · {vendor.email || "vendor.himalayan@zelevos.partner"} · {vendor.phone || "+91 98765 43210"}
            </span>
          </div>
        </div>

        {/* VENDOR DISCIPLINARY ACTIONS BAR */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {vendor.status === "SUSPENDED" ? (
            <button
              type="button"
              disabled={reactivateLoading}
              onClick={handleReactivate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#059669",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(5,150,105,0.2)",
              }}
            >
              <CheckCircle2 size={15} />
              <span>{reactivateLoading ? "Reactivating..." : "Reactivate Vendor"}</span>
            </button>
          ) : (
            <>
              {/* Temporary Suspend Button */}
              <button
                type="button"
                onClick={() => setShowTempModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#d97706",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(217,119,6,0.2)",
                  transition: "all 0.15s ease",
                }}
                title="Temporarily suspend vendor for SLA breach or pending review"
              >
                <Clock size={14} />
                <span>Temporary Suspend</span>
              </button>

              {/* Permanent Suspend / Blacklist Button */}
              <button
                type="button"
                onClick={() => setShowPermModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(220,38,38,0.2)",
                  transition: "all 0.15s ease",
                }}
                title="Permanently ban and blacklist vendor from all operations"
              >
                <ShieldAlert size={14} />
                <span>Permanent Suspend</span>
              </button>
            </>
          )}

          {/* Report Incident / Add Strike */}
          <button
            type="button"
            onClick={() => setShowIncidentModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Log customer misbehavior incident or warning strike"
          >
            <AlertTriangle size={14} style={{ color: "#d97706" }} />
            <span>Report Incident</span>
          </button>

          {/* Remove Vendor Button */}
          <button
            type="button"
            onClick={() => setShowRemoveModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Offboard and remove vendor from platform"
          >
            <Trash2 size={14} />
            <span>Remove</span>
          </button>
        </div>
      </div>

      {/* LIVE PERFORMANCE & QUALITY METRICS GRID (4 CARDS) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {/* Card 1: Acceptance Rate */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Acceptance Rate
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px", background: "#ecfdf5", color: "#059669" }}>
              Optimal SLA
            </span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong style={{ fontSize: "24px", fontWeight: 800, color: "#059669" }}>
              {metrics.acceptanceRate ?? 98}%
            </strong>
          </div>
          <div style={{ marginTop: "8px", height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{ width: `${metrics.acceptanceRate ?? 98}%`, height: "100%", background: "#059669", borderRadius: "3px" }} />
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "block" }}>
            Quality threshold &gt; 90% (Auto-dispatch qualified)
          </span>
        </div>

        {/* Card 2: Avg Response SLA */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Avg Response SLA
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px", background: "#eff6ff", color: "#2563eb" }}>
              Fast SLA
            </span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong style={{ fontSize: "24px", fontWeight: 800, color: "#2563eb" }}>
              {metrics.avgResponseMinutes ?? 25}m
            </strong>
          </div>
          <div style={{ marginTop: "8px", height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.round(((metrics.avgResponseMinutes ?? 25) / 120) * 100))}%`, height: "100%", background: "#2563eb", borderRadius: "3px" }} />
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "block" }}>
            Standard PRD limit: &lt; 120m response
          </span>
        </div>

        {/* Card 3: Cancellation Rate */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Cancellation Rate
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px", background: "#ecfdf5", color: "#059669" }}>
              Low Risk
            </span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong style={{ fontSize: "24px", fontWeight: 800, color: (metrics.cancellationRate ?? 0) > 3 ? "#dc2626" : "#059669" }}>
              {metrics.cancellationRate ?? 1}%
            </strong>
          </div>
          <div style={{ marginTop: "8px", height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (metrics.cancellationRate ?? 1) * 10)}%`, height: "100%", background: (metrics.cancellationRate ?? 0) > 3 ? "#dc2626" : "#059669", borderRadius: "3px" }} />
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "block" }}>
            Supplier fault threshold &lt; 3% limit
          </span>
        </div>

        {/* Card 4: Disciplinary & Misbehavior Flags */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Disciplinary & Strikes
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "6px",
                background: (vendor.misbehaviorStrikes || 0) === 0 ? "#ecfdf5" : "#fef3c7",
                color: (vendor.misbehaviorStrikes || 0) === 0 ? "#059669" : "#b45309",
              }}
            >
              {(vendor.misbehaviorStrikes || 0) === 0 ? "Clean Record" : "Warning Active"}
            </span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong style={{ fontSize: "24px", fontWeight: 800, color: (vendor.misbehaviorStrikes || 0) > 0 ? "#d97706" : "#0f172a" }}>
              {vendor.misbehaviorStrikes ?? 0} Strike(s)
            </strong>
          </div>
          <div style={{ marginTop: "8px", height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, ((vendor.misbehaviorStrikes || 0) / 3) * 100)}%`, height: "100%", background: (vendor.misbehaviorStrikes || 0) >= 3 ? "#dc2626" : "#d97706", borderRadius: "3px" }} />
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "block" }}>
            Customer complaints: {vendor.customerIssuesCount ?? 0} · 3 strikes trigger suspension
          </span>
        </div>
      </div>

      {/* WORK PROCESS & FULFILLMENT PIPELINE TRACKER */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              Vendor Work Process & Fulfillment Pipeline
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Real-time lifecycle tracking: Monitor supplier responsiveness from task dispatch to voucher release.
            </span>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 8px", borderRadius: "6px", background: "#eff6ff", color: "#2563eb" }}>
              Total Assigned: {requests.length}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 8px", borderRadius: "6px", background: "#ecfdf5", color: "#059669" }}>
              Verified: {requests.filter((r) => (r.task?.status || r.status) === "VERIFIED").length}
            </span>
          </div>
        </div>

        {/* 4 Pipeline Stages */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {/* Step 1: Request Dispatched */}
          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#2563eb" }}>
                1. Request Received
              </span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#eff6ff", color: "#2563eb" }}>
                {requests.filter((r) => (r.task?.status || r.status) === "REQUESTED").length} Pending
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
              Ops assigns customer booking. Supplier SLA clock starts (2hr response window).
            </p>
          </div>

          {/* Step 2: Vendor Confirmation */}
          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#0891b2" }}>
                2. Supplier Confirm
              </span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#ecfeff", color: "#0891b2" }}>
                {requests.filter((r) => (r.task?.status || r.status) === "ACCEPTED").length} Confirmed
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
              Supplier locks net inventory & inputs hotel/cab reservation reference code.
            </p>
          </div>

          {/* Step 3: Voucher Uploaded */}
          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#7c3aed" }}>
                3. Voucher Uploaded
              </span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#f5f3ff", color: "#7c3aed" }}>
                {requests.filter((r) => r.task?.voucherUrl || r.voucherUrl).length} In Vault
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
              Official stay/cab voucher PDF uploaded and net invoice submitted for billing.
            </p>
          </div>

          {/* Step 4: Operations QA Verified */}
          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#059669" }}>
                4. Operations QA
              </span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#ecfdf5", color: "#059669" }}>
                {requests.filter((r) => (r.task?.status || r.status) === "VERIFIED").length} Verified
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
              Ops desk checks voucher validity & unlocks customer digital trip pass.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>
        {[
          { id: "requests", label: `Assigned Requests (${requests.length})` },
          { id: "services", label: `My Services Catalog (${services.length})` },
          { id: "documents", label: `My Documents (${documents.length})` },
          { id: "invoices", label: `Invoices & Ledger (${invoices.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as any)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: subTab === tab.id ? "#0f172a" : "#f1f5f9",
              color: subTab === tab.id ? "#ffffff" : "#475569",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: ASSIGNED REQUESTS QUEUE */}
      {subTab === "requests" && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              Assigned Booking Fulfillment Tasks
            </h3>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Review customer bookings, enter supplier reservation reference, accept the booking, and upload voucher.
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 700 }}>
                <th style={{ padding: "12px 16px" }}>Booking / Travel Date</th>
                <th style={{ padding: "12px 16px" }}>Required Service</th>
                <th style={{ padding: "12px 16px" }}>Party Size</th>
                <th style={{ padding: "12px 16px" }}>Confirmation Reference</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                    Loading supplier requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                    No requests assigned to this vendor currently.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const task = r.task || r;
                  const taskId = task.id;
                  const isAccepted = task.status === "ACCEPTED" || task.status === "VERIFIED";

                  return (
                    <tr key={taskId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <strong style={{ display: "block", color: "#2563eb", fontFamily: "monospace" }}>
                          {r.bookingRef || "ZL-BOOKING"}
                        </strong>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>Date: {r.travelDate || "2026-10-15"}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <strong style={{ display: "block", color: "#0f172a" }}>{task.title}</strong>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{task.serviceType?.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#334155" }}>
                        {r.adults || 2} Adults, {r.children || 0} Children
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {isAccepted ? (
                          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>
                            {task.supplierConfirmationRef}
                          </span>
                        ) : (
                          <input
                            type="text"
                            id={`vendor-ref-input-${taskId}`}
                            value={confirmRefs[taskId] || ""}
                            onChange={(e) => setConfirmRefs({ ...confirmRefs, [taskId]: e.target.value })}
                            placeholder="e.g. HTL-CONF-882"
                            style={{
                              height: "32px",
                              padding: "0 8px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                              width: "140px",
                              fontFamily: "monospace",
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: isAccepted ? "#ecfdf5" : task.status === "REJECTED" ? "#fef2f2" : "#fef3c7",
                            color: isAccepted ? "#047857" : task.status === "REJECTED" ? "#dc2626" : "#b45309",
                            fontWeight: 700,
                            fontSize: "11px",
                            textTransform: "uppercase",
                          }}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          {!isAccepted && task.status !== "REJECTED" ? (
                            <>
                              <button
                                type="button"
                                id={`vendor-accept-btn-${taskId}`}
                                onClick={() => handleAcceptRequest(taskId)}
                                disabled={acceptingId === taskId}
                                style={{
                                  padding: "6px 12px",
                                  background: "#2563eb",
                                  border: "none",
                                  borderRadius: "6px",
                                  color: "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: acceptingId === taskId ? "not-allowed" : "pointer",
                                }}
                              >
                                {acceptingId === taskId ? "Accepting..." : "Accept"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setRejectingTask(task)}
                                style={{
                                  padding: "6px 10px",
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  color: "#dc2626",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Reject
                              </button>

                              <button
                                type="button"
                                onClick={() => setChangingTask(task)}
                                style={{
                                  padding: "6px 10px",
                                  background: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  color: "#475569",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Change Request
                              </button>
                            </>
                          ) : isAccepted ? (
                            <button
                              type="button"
                              id={`vendor-upload-btn-${taskId}`}
                              onClick={() => handleUploadDocument(taskId)}
                              disabled={uploadingId === taskId}
                              style={{
                                padding: "6px 12px",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                color: "#334155",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: uploadingId === taskId ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <FileUp size={13} />
                              <span>{uploadingId === taskId ? "Uploading..." : "Upload Voucher"}</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB 2: MY SERVICES CATALOG */}
      {subTab === "services" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                My Registered Services Catalog
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Manage rates, room/vehicle types, and availability for package inclusion.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddService(!showAddService)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Plus size={14} />
              <span>Add New Service</span>
            </button>
          </div>

          {showAddService && (
            <form onSubmit={handleSaveService} style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "16px", display: "grid", gap: "10px" }}>
              <strong style={{ fontSize: "13px" }}>Register Service Offer</strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "10px" }}>
                <select
                  value={newService.serviceType}
                  onChange={(e) => setNewService({ ...newService, serviceType: e.target.value })}
                  style={{ height: "36px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="Hotel">Hotel</option>
                  <option value="Cab">Cab / Transfer</option>
                  <option value="Activity">Activity / Tour</option>
                  <option value="Guide">Guide</option>
                  <option value="Meals">Meals</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Service Title (e.g. Deluxe Room, Private AC Sedan)"
                  value={newService.title}
                  onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  required
                  placeholder="Location (e.g. Srinagar, Manali)"
                  value={newService.location}
                  onChange={(e) => setNewService({ ...newService, location: e.target.value })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "10px" }}>
                <input
                  type="number"
                  required
                  placeholder="Net Rate ₹"
                  value={newService.rate}
                  onChange={(e) => setNewService({ ...newService, rate: Number(e.target.value) })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="number"
                  required
                  placeholder="Max Pax"
                  value={newService.capacity}
                  onChange={(e) => setNewService({ ...newService, capacity: Number(e.target.value) })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  placeholder="Availability details"
                  value={newService.availability}
                  onChange={(e) => setNewService({ ...newService, availability: e.target.value })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={() => setShowAddService(false)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingService} style={{ padding: "6px 16px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>
                  {savingService ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          )}

          {services.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "8px" }}>
              No services registered yet. Click "Add New Service" above.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {services.map((s) => (
                <div key={s.id} style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#0f172a" }}>{s.title}</strong>
                    <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                      {s.serviceType} · {s.location} · Capacity: {s.capacity}
                    </span>
                  </div>
                  <strong style={{ fontSize: "15px", color: "#059669" }}>₹{Number(s.rate).toLocaleString("en-IN")}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: MY DOCUMENTS */}
      {subTab === "documents" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                My Compliance & Legal Documents
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                View verification status of your trade licenses, GST certificates, and insurance.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDoc(!showAddDoc)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Plus size={14} />
              <span>Upload Document</span>
            </button>
          </div>

          {showAddDoc && (
            <form onSubmit={handleSaveDoc} style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "16px", display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: "10px" }}>
                <select
                  value={newDoc.documentType}
                  onChange={(e) => setNewDoc({ ...newDoc, documentType: e.target.value })}
                  style={{ height: "36px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="license">Trade License</option>
                  <option value="gst_certificate">GST Certificate</option>
                  <option value="pan_card">PAN Card</option>
                  <option value="insurance">Insurance Policy</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Document Title"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  required
                  value={newDoc.fileUrl}
                  onChange={(e) => setNewDoc({ ...newDoc, fileUrl: e.target.value })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={() => setShowAddDoc(false)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingDoc} style={{ padding: "6px 16px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>
                  {savingDoc ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: "grid", gap: "8px" }}>
            {documents.map((d) => (
              <div key={d.id} style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileText size={18} color="#2563eb" />
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>{d.title}</strong>
                    <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                      Type: {d.documentType} · File: {d.fileName}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background: d.status === "verified" ? "#ecfdf5" : d.status === "rejected" ? "#fef2f2" : "#fef3c7",
                    color: d.status === "verified" ? "#047857" : d.status === "rejected" ? "#dc2626" : "#b45309",
                  }}
                >
                  {d.status || "pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: INVOICES & LEDGER */}
      {subTab === "invoices" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                Submitted Invoices & Settlement Ledger
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Track payout approvals and submit tax invoices for completed bookings.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddInvoice(!showAddInvoice)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#059669",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Plus size={14} />
              <span>Submit Invoice</span>
            </button>
          </div>

          {showAddInvoice && (
            <form onSubmit={handleSaveInvoice} style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "16px", display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input
                  type="text"
                  required
                  placeholder="Invoice Number"
                  value={newInvoice.invoiceNumber}
                  onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="number"
                  required
                  placeholder="Amount ₹"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <input
                type="text"
                placeholder="Notes / Remarks"
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={() => setShowAddInvoice(false)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingInvoice} style={{ padding: "6px 16px", borderRadius: "6px", border: "none", background: "#059669", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>
                  {savingInvoice ? "Submitting..." : "Submit Invoice"}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: "grid", gap: "8px" }}>
            {invoices.map((inv) => (
              <div key={inv.id} style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>Invoice #{inv.invoiceNumber}</strong>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                    Submitted: {new Date(inv.createdAt).toLocaleDateString("en-IN")} · {inv.notes || "No notes"}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                    ₹{Number(inv.amount).toLocaleString("en-IN")}
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: inv.status === "paid" ? "#059669" : "#2563eb",
                    }}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Request Dialog */}
      {rejectingTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "grid", placeItems: "center", zIndex: 10000 }}>
          <div style={{ width: "min(100%, 420px)", background: "#ffffff", borderRadius: "14px", padding: "20px" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 800 }}>Reject Booking Request</h4>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              Provide a reason so Operations can reassign this traveler's booking to an alternate supplier.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Fully booked on selected dates."
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", marginBottom: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setRejectingTask(null)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}>
                Cancel
              </button>
              <button type="button" disabled={rejectingLoading} onClick={handleRejectRequest} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#dc2626", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>
                {rejectingLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Request Dialog */}
      {changingTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "grid", placeItems: "center", zIndex: 10000 }}>
          <div style={{ width: "min(100%, 420px)", background: "#ffffff", borderRadius: "14px", padding: "20px" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 800 }}>Request Modification</h4>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              Specify the modification required (e.g. shift check-in by 1 day or room category upgrade).
            </p>
            <textarea
              rows={3}
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="e.g. Standard room not available; offering Suite at same net rate."
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", marginBottom: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setChangingTask(null)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}>
                Cancel
              </button>
              <button type="button" disabled={changingLoading} onClick={handleRequestChange} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>
                {changingLoading ? "Submitting..." : "Submit to Operations"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: TEMPORARY SUSPEND MODAL */}
      {showTempModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "grid", placeItems: "center", zIndex: 10001, padding: "16px" }}>
          <div style={{ width: "min(100%, 480px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center" }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>Temporary Suspend Vendor</h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Vendor: {vendor.businessName} ({vendor.vendorId})</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowTempModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTemporarySuspend} style={{ display: "grid", gap: "14px" }}>
              {/* Duration selection */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Suspension Duration
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "8px" }}>
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setTempDays(d); setTempCustomDate(""); }}
                      style={{
                        padding: "8px",
                        borderRadius: "8px",
                        border: tempDays === d && !tempCustomDate ? "2px solid #d97706" : "1px solid #cbd5e1",
                        background: tempDays === d && !tempCustomDate ? "#fffbeb" : "#ffffff",
                        color: tempDays === d && !tempCustomDate ? "#b45309" : "#475569",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Or Custom Date:</span>
                  <input
                    type="date"
                    value={tempCustomDate}
                    onChange={(e) => { setTempCustomDate(e.target.value); setTempDays(0); }}
                    style={{ flex: 1, height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>
              </div>

              {/* Suspension Reason */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Reason for Suspension
                </label>
                <select
                  value={tempReason}
                  onChange={(e) => setTempReason(e.target.value)}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", background: "#ffffff" }}
                >
                  <option value="Late response SLA violations on multiple bookings">Late response SLA violations on multiple bookings</option>
                  <option value="Customer complaint: Rude staff or unprofessional conduct">Customer complaint: Rude staff or unprofessional conduct</option>
                  <option value="Unauthorized cash fee / surcharge demanded from guest">Unauthorized cash fee / surcharge demanded from guest</option>
                  <option value="Refusal to honor confirmed room or vehicle reservation">Refusal to honor confirmed room or vehicle reservation</option>
                  <option value="Substandard amenities or vehicle condition vs contracted grade">Substandard amenities or vehicle condition vs contracted grade</option>
                  <option value="Under administrative quality review">Under administrative quality review</option>
                  <option value="Other non-compliance">Other non-compliance</option>
                </select>
              </div>

              {/* Disciplinary Notes */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Administrative Log / Notes (Internal)
                </label>
                <textarea
                  rows={3}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="e.g. Second warning issued. Vendor contacted via phone. Re-inspection required before reinstatement."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                />
              </div>

              <div style={{ background: "#fef3c7", padding: "10px 12px", borderRadius: "8px", fontSize: "11px", color: "#92400e" }}>
                ℹ️ While temporarily suspended, the vendor cannot receive new automated dispatches, and will be prompted with this duration upon login.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setShowTempModal(false)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tempLoading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#d97706",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Clock size={14} />
                  <span>{tempLoading ? "Applying..." : "Confirm Temporary Suspension"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PERMANENT SUSPEND / BLACKLIST MODAL */}
      {showPermModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", display: "grid", placeItems: "center", zIndex: 10001, padding: "16px" }}>
          <div style={{ width: "min(100%, 480px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fee2e2", color: "#dc2626", display: "grid", placeItems: "center" }}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#991b1b" }}>Permanent Suspend & Blacklist</h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Vendor: {vendor.businessName} ({vendor.vendorId})</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowPermModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePermanentSuspend} style={{ display: "grid", gap: "14px" }}>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px", fontSize: "12px", color: "#991b1b" }}>
                <strong>CRITICAL ACTION:</strong> This will permanently revoke this vendor's portal login, terminate supplier contracts, and blacklist their inventory from all customer package builds.
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Grounds for Permanent Blacklist
                </label>
                <select
                  value={permReason}
                  onChange={(e) => setPermReason(e.target.value)}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", background: "#ffffff" }}
                >
                  <option value="Unethical customer extortion and repeated misconduct">Unethical customer extortion and repeated misconduct</option>
                  <option value="Fraudulent billing, fake confirmation vouchers, or phantom inventory">Fraudulent billing, fake confirmation vouchers, or phantom inventory</option>
                  <option value="Severe breach of contracted supplier service agreement">Severe breach of contracted supplier service agreement</option>
                  <option value="Passenger safety violation or gross negligence">Passenger safety violation or gross negligence</option>
                  <option value="Multiple unresolved disciplinary strikes without remediation">Multiple unresolved disciplinary strikes without remediation</option>
                  <option value="Legal or regulatory disqualification">Legal or regulatory disqualification</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Permanent Record / Committee Authorization Note
                </label>
                <textarea
                  rows={3}
                  value={permNotes}
                  onChange={(e) => setPermNotes(e.target.value)}
                  placeholder="e.g. Authorized by Operations Director following severe customer complaint on Kashmir tour."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setShowPermModal(false)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={permLoading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ShieldAlert size={14} />
                  <span>{permLoading ? "Blacklisting..." : "Confirm Permanent Blacklist"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REMOVE VENDOR MODAL */}
      {showRemoveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "grid", placeItems: "center", zIndex: 10001, padding: "16px" }}>
          <div style={{ width: "min(100%, 460px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fee2e2", color: "#dc2626", display: "grid", placeItems: "center" }}>
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>Remove Vendor from Platform</h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Vendor: {vendor.businessName}</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowRemoveModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRemoveVendor} style={{ display: "grid", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                Removing a vendor safely offboards them from the supplier directory and hides their inventory from package dispatch.
              </p>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Reason for Removal
                </label>
                <input
                  type="text"
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="e.g. Mutual contract termination"
                  style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#334155", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={forceRemove}
                  onChange={(e) => setForceRemove(e.target.checked)}
                />
                <span>Force removal (unassign any pending fulfillment tasks)</span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setShowRemoveModal(false)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={removeLoading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={14} />
                  <span>{removeLoading ? "Removing..." : "Confirm Removal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REPORT MISBEHAVIOR / INCIDENT STRIKE MODAL */}
      {showIncidentModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "grid", placeItems: "center", zIndex: 10001, padding: "16px" }}>
          <div style={{ width: "min(100%, 480px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center" }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>Report Misbehavior & Strike</h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Current Strikes: {vendor.misbehaviorStrikes || 0}</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowIncidentModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordIncident} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Incident Category
                </label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", background: "#ffffff" }}
                >
                  <option value="GUEST_MISBEHAVIOR">Rude or Unprofessional Staff Conduct</option>
                  <option value="DENIED_CHECKIN">Denied Check-in / Refused Confirmed Booking</option>
                  <option value="UNAUTHORIZED_CASH">Demanded Direct Cash Surcharge from Traveler</option>
                  <option value="NO_SHOW">Driver / Chauffeur / Guide No-Show</option>
                  <option value="SUBSTANDARD_AMENITIES">Substandard Room / Amenities vs Contract</option>
                  <option value="DELAYED_RESPONSE">Extreme Delayed Response / Guest Left Stranded</option>
                  <option value="OTHER_MISBEHAVIOR">Other Operational Violation</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Associated Booking ID / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={incidentBookingRef}
                  onChange={(e) => setIncidentBookingRef(e.target.value)}
                  placeholder="e.g. ZL260925001"
                  style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Incident Summary & Traveler Feedback *
                </label>
                <textarea
                  required
                  rows={3}
                  value={incidentReason}
                  onChange={(e) => setIncidentReason(e.target.value)}
                  placeholder="Describe exactly what occurred (e.g. Hotel receptionist insisted on additional ₹1,500 heater fee despite all-inclusive voucher)."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                />
              </div>

              <div style={{ background: "#fffbeb", padding: "10px 12px", borderRadius: "8px", fontSize: "11px", color: "#92400e" }}>
                ⚠️ Submitting will increment this vendor's strikes counter by 1 and record a permanent entry in their compliance audit trail.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentLoading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#d97706",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>{incidentLoading ? "Logging..." : "Log Incident (+1 Strike)"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminVendorTab;
