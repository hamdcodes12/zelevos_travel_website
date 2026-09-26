import React, { useState, useEffect } from "react";
import {
  Building2,
  Users2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Eye,
  Edit2,
  Pause,
  Play,
  FileText,
  FileCheck,
  FileX,
  ExternalLink,
  ChevronRight,
  MapPin,
  Mail,
  Phone,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  Calendar,
  Check,
  X,
  Lock,
} from "lucide-react";

interface AdminSuppliersTabProps {
  onToast: (msg: string) => void;
}

export function AdminSuppliersTab({ onToast }: AdminSuppliersTabProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");

  // Detailed view modal state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierDossier, setSupplierDossier] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierTab, setDossierTab] = useState<"overview" | "services" | "documents" | "bookings" | "invoices" | "audit">("overview");

  // Create Supplier Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    registrationNumber: "",
    taxId: "",
    description: "",
    serviceCategories: ["Hotel"] as string[],
    temporaryPassword: "SupplierPass123!",
    docTitle: "GST Registration Certificate",
    docType: "gst_certificate",
    docFileUrl: "/documents/sample-supplier-registration.pdf",
  });

  // Edit Supplier Modal
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Status Action Modals (Approve, Reject, Suspend, Reactivate, Request Changes)
  const [actionTarget, setActionTarget] = useState<{
    supplier: any;
    action: "approve" | "reject" | "suspend" | "reactivate" | "request_changes";
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  // In-Dossier: Add Service State
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
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

  // In-Dossier: Add Document State
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [newDoc, setNewDoc] = useState({
    documentType: "license",
    title: "",
    fileName: "",
    fileUrl: "/documents/sample-license.pdf",
  });
  const [savingDoc, setSavingDoc] = useState(false);

  // In-Dossier: Reject Doc Modal
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [docRejectionReason, setDocRejectionReason] = useState("");

  // Load suppliers list
  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (serviceTypeFilter && serviceTypeFilter !== "all") params.append("serviceType", serviceTypeFilter);

      const res = await fetch(`/api/admin/suppliers?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSuppliers(data.suppliers || data.vendors || []);
      } else {
        onToast(data.message || "Failed to load suppliers.");
      }
    } catch {
      onToast("Network error loading suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [statusFilter, serviceTypeFilter]);

  // Load full dossier
  const loadDossier = async (supplierId: string) => {
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.supplier) {
        setSupplierDossier(data.supplier);
      } else {
        onToast(data.message || "Failed to load supplier details.");
      }
    } catch {
      onToast("Error fetching supplier dossier.");
    } finally {
      setDossierLoading(false);
    }
  };

  // Open Dossier
  const handleOpenDossier = (supplier: any) => {
    setSelectedSupplierId(supplier.id);
    setDossierTab("overview");
    loadDossier(supplier.id);
  };

  // Calculate Metrics from suppliers list
  const totalCount = suppliers.length;
  const pendingCount = suppliers.filter(
    (s) => (s.status || s.approvalStatus || "").toUpperCase() === "PENDING_APPROVAL" || (s.status || s.approvalStatus || "").toUpperCase() === "PENDING"
  ).length;
  const underReviewCount = suppliers.filter(
    (s) => (s.status || s.approvalStatus || "").toUpperCase() === "UNDER_REVIEW"
  ).length;
  const changesRequestedCount = suppliers.filter(
    (s) => (s.status || s.approvalStatus || "").toUpperCase() === "CHANGES_REQUESTED"
  ).length;
  const approvedCount = suppliers.filter(
    (s) => (s.status || s.approvalStatus || "").toUpperCase() === "APPROVED"
  ).length;
  const rejectedCount = suppliers.filter(
    (s) => (s.status || s.approvalStatus || "").toUpperCase() === "REJECTED"
  ).length;
  const suspendedCount = suppliers.filter(
    (s) => (s.status || s.approvalStatus || "").toUpperCase() === "SUSPENDED"
  ).length;

  // Handle Create Supplier Submit
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.businessName.trim() || !createForm.contactName.trim() || !createForm.email.trim() || !createForm.phone.trim()) {
      onToast("Please fill all required basic fields.");
      return;
    }
    if (createForm.serviceCategories.length === 0) {
      onToast("Please select at least one service category.");
      return;
    }

    setCreateLoading(true);
    try {
      const payload: any = {
        businessName: createForm.businessName.trim(),
        contactName: createForm.contactName.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim(),
        address: createForm.address.trim() || undefined,
        city: createForm.city.trim() || undefined,
        state: createForm.state.trim() || undefined,
        country: createForm.country.trim() || "India",
        registrationNumber: createForm.registrationNumber.trim() || undefined,
        taxId: createForm.taxId.trim() || undefined,
        description: createForm.description.trim() || undefined,
        serviceCategories: createForm.serviceCategories,
        temporaryPassword: createForm.temporaryPassword.trim() || "SupplierPass123!",
      };

      if (createForm.docTitle.trim() && createForm.docFileUrl.trim()) {
        payload.documents = [
          {
            title: createForm.docTitle.trim(),
            documentType: createForm.docType,
            fileUrl: createForm.docFileUrl.trim(),
            fileName: `${createForm.docTitle.trim().replace(/\s+/g, "_")}.pdf`,
          },
        ];
      }

      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (data.errors ? data.errors[0]?.message : "Failed to create supplier."));
      }

      onToast(`Supplier "${data.supplier.businessName}" created in PENDING_APPROVAL status!`);
      setShowCreateModal(false);
      setCreateForm({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "India",
        registrationNumber: "",
        taxId: "",
        description: "",
        serviceCategories: ["Hotel"],
        temporaryPassword: "SupplierPass123!",
        docTitle: "GST Registration Certificate",
        docType: "gst_certificate",
        docFileUrl: "/documents/sample-supplier-registration.pdf",
      });
      loadSuppliers();
    } catch (err: any) {
      onToast(err.message || "Failed to create supplier.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Edit Supplier Submit
  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${editingSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editingSupplier),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update supplier.");
      }

      onToast("Supplier details updated successfully!");
      setEditingSupplier(null);
      loadSuppliers();
      if (selectedSupplierId === editingSupplier.id) {
        loadDossier(editingSupplier.id);
      }
    } catch (err: any) {
      onToast(err.message || "Update failed.");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Approval Workflow Actions (approve, reject, suspend, reactivate)
  const handleExecuteStatusAction = async () => {
    if (!actionTarget) return;

    if ((actionTarget.action === "reject" || actionTarget.action === "request_changes") && !actionReason.trim()) {
      onToast(`Please provide a note or reason for ${actionTarget.action === "request_changes" ? "requesting changes" : "rejection"}.`);
      return;
    }

    setActionProcessing(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${actionTarget.supplier.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: actionTarget.action,
          reason: actionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to execute ${actionTarget.action}.`);
      }

      onToast(data.message || `Supplier status updated to ${data.supplier?.status}!`);
      setActionTarget(null);
      setActionReason("");
      loadSuppliers();
      if (selectedSupplierId === actionTarget.supplier.id) {
        loadDossier(actionTarget.supplier.id);
      }
    } catch (err: any) {
      onToast(err.message || "Status change failed.");
    } finally {
      setActionProcessing(false);
    }
  };

  // Document Verification Actions
  const handleVerifyDocument = async (docId: string) => {
    if (!selectedSupplierId) return;
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/documents/${docId}/verify`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to verify document.");

      onToast("Document verified successfully!");
      loadDossier(selectedSupplierId);
    } catch (err: any) {
      onToast(err.message || "Verification failed.");
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedSupplierId || !rejectingDocId) return;
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/documents/${rejectingDocId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: docRejectionReason || "Compliance rejection by admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject document.");

      onToast("Document marked as rejected.");
      setRejectingDocId(null);
      setDocRejectionReason("");
      loadDossier(selectedSupplierId);
    } catch (err: any) {
      onToast(err.message || "Rejection failed.");
    }
  };

  // Add Service Action
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !newService.title.trim() || !newService.location.trim()) {
      onToast("Service title and location are required.");
      return;
    }

    setSavingService(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newService),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add service.");

      onToast(`Service "${data.service.title}" added to supplier catalog!`);
      setShowAddServiceForm(false);
      setNewService({
        serviceType: "Hotel",
        title: "",
        location: "",
        rate: 2500,
        capacity: 2,
        availability: "Available Year-Round",
        description: "",
      });
      loadDossier(selectedSupplierId);
    } catch (err: any) {
      onToast(err.message || "Failed to add service.");
    } finally {
      setSavingService(false);
    }
  };

  // Add Document Action
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !newDoc.title.trim() || !newDoc.fileUrl.trim()) {
      onToast("Document title and file URL are required.");
      return;
    }

    setSavingDoc(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentType: newDoc.documentType,
          title: newDoc.title.trim(),
          fileName: newDoc.fileName.trim() || `${newDoc.title.trim().replace(/\s+/g, "_")}.pdf`,
          fileUrl: newDoc.fileUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload document.");

      onToast("Document added and verified successfully!");
      setShowAddDocForm(false);
      setNewDoc({
        documentType: "license",
        title: "",
        fileName: "",
        fileUrl: "/documents/sample-license.pdf",
      });
      loadDossier(selectedSupplierId);
    } catch (err: any) {
      onToast(err.message || "Failed to upload document.");
    } finally {
      setSavingDoc(false);
    }
  };

  // Helper badge renderers
  const renderStatusBadge = (statusStr: string) => {
    const s = (statusStr || "").toUpperCase();
    if (s === "APPROVED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#ecfdf5",
            color: "#059669",
            border: "1px solid #a7f3d0",
          }}
        >
          <CheckCircle2 size={13} />
          Approved
        </span>
      );
    }
    if (s === "PENDING_APPROVAL" || s === "PENDING") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#fffbeb",
            color: "#d97706",
            border: "1px solid #fde68a",
          }}
        >
          <Clock size={13} />
          Pending Approval
        </span>
      );
    }
    if (s === "UNDER_REVIEW") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#eff6ff",
            color: "#2563eb",
            border: "1px solid #bfdbfe",
          }}
        >
          <RefreshCw size={13} />
          Under Review
        </span>
      );
    }
    if (s === "CHANGES_REQUESTED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#fef3c7",
            color: "#b45309",
            border: "1px solid #fde68a",
          }}
        >
          <AlertCircle size={13} />
          Changes Requested
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
          }}
        >
          <XCircle size={13} />
          Rejected
        </span>
      );
    }
    if (s === "SUSPENDED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #cbd5e1",
          }}
        >
          <Pause size={13} />
          Suspended
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 10px",
          borderRadius: "9999px",
          fontSize: "11px",
          fontWeight: 700,
          background: "#f8fafc",
          color: "#64748b",
        }}
      >
        {statusStr}
      </span>
    );
  };

  const serviceCategoriesList = [
    "Hotel",
    "Cab / Transfer",
    "Bus / Transport",
    "Activity",
    "Sightseeing",
    "Guide",
    "Meals / Food",
    "Tour Operator",
    "Other",
  ];

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* -------------------------------------------------------------
          1. HEADER & TOP CONTROLS
         ------------------------------------------------------------- */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "24px 28px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span
              style={{
                background: "#eff6ff",
                color: "#2563eb",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Supplier & Vendor Hub
            </span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Document A Compliance Engine</span>
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Suppliers & Vendors Management
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Onboard new suppliers, verify compliance documents, manage service catalogs, and execute approvals.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={loadSuppliers}
            style={{
              height: "42px",
              padding: "0 16px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            id="admin-btn-add-supplier"
            onClick={() => setShowCreateModal(true)}
            style={{
              height: "42px",
              padding: "0 20px",
              borderRadius: "10px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.25)",
            }}
          >
            <Plus size={16} />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. METRICS CARDS
         ------------------------------------------------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Card: Total */}
        <div
          onClick={() => setStatusFilter("all")}
          style={{
            background: "#ffffff",
            padding: "20px 22px",
            borderRadius: "14px",
            border: statusFilter === "all" ? "2px solid #2563eb" : "1px solid #e2e8f0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Total Suppliers</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f1f5f9", display: "grid", placeItems: "center", color: "#0f172a" }}>
              <Building2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>{totalCount}</div>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Registered in platform</span>
        </div>

        {/* Card: Pending Approval */}
        <div
          onClick={() => setStatusFilter("PENDING_APPROVAL")}
          style={{
            background: "#fffbeb",
            padding: "20px 22px",
            borderRadius: "14px",
            border: statusFilter === "PENDING_APPROVAL" ? "2px solid #d97706" : "1px solid #fde68a",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#b45309" }}>Pending Approval</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", display: "grid", placeItems: "center", color: "#d97706" }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#b45309" }}>{pendingCount}</div>
          <span style={{ fontSize: "11px", color: "#d97706" }}>Requires Admin review</span>
        </div>

        {/* Card: Approved */}
        <div
          onClick={() => setStatusFilter("APPROVED")}
          style={{
            background: "#ecfdf5",
            padding: "20px 22px",
            borderRadius: "14px",
            border: statusFilter === "APPROVED" ? "2px solid #059669" : "1px solid #a7f3d0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#047857" }}>Approved & Active</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#d1fae5", display: "grid", placeItems: "center", color: "#059669" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#047857" }}>{approvedCount}</div>
          <span style={{ fontSize: "11px", color: "#059669" }}>Active for bookings</span>
        </div>

        {/* Card: Rejected */}
        <div
          onClick={() => setStatusFilter("REJECTED")}
          style={{
            background: "#fef2f2",
            padding: "20px 22px",
            borderRadius: "14px",
            border: statusFilter === "REJECTED" ? "2px solid #dc2626" : "1px solid #fecaca",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#b91c1c" }}>Rejected</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fee2e2", display: "grid", placeItems: "center", color: "#dc2626" }}>
              <XCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#b91c1c" }}>{rejectedCount}</div>
          <span style={{ fontSize: "11px", color: "#dc2626" }}>Verification failed</span>
        </div>

        {/* Card: Suspended */}
        <div
          onClick={() => setStatusFilter("SUSPENDED")}
          style={{
            background: "#f8fafc",
            padding: "20px 22px",
            borderRadius: "14px",
            border: statusFilter === "SUSPENDED" ? "2px solid #475569" : "1px solid #e2e8f0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Suspended</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#e2e8f0", display: "grid", placeItems: "center", color: "#475569" }}>
              <Pause size={16} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>{suspendedCount}</div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Temporarily locked</span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. FILTERS & SEARCH BAR
         ------------------------------------------------------------- */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "16px 20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        {/* Status Tab Pills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Suppliers" },
            { id: "PENDING_APPROVAL", label: `Pending (${pendingCount})` },
            { id: "UNDER_REVIEW", label: `Under Review (${underReviewCount})` },
            { id: "CHANGES_REQUESTED", label: `Changes Requested (${changesRequestedCount})` },
            { id: "APPROVED", label: `Approved (${approvedCount})` },
            { id: "REJECTED", label: `Rejected (${rejectedCount})` },
            { id: "SUSPENDED", label: `Suspended (${suspendedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                background: statusFilter === tab.id ? "#0f172a" : "#f1f5f9",
                color: statusFilter === tab.id ? "#ffffff" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Service Filter */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Service Category Dropdown */}
          <div style={{ position: "relative" }}>
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              style={{
                height: "38px",
                padding: "0 30px 0 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">All Service Types</option>
              <option value="hotel">Hotel / Accommodation</option>
              <option value="cab">Cab / Transfer</option>
              <option value="bus">Bus / Transport</option>
              <option value="activity">Activity / Experience</option>
              <option value="sightseeing">Sightseeing / Tour</option>
              <option value="guide">Guide</option>
              <option value="meals">Meals / Food</option>
              <option value="tour operator">Tour Operator</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "260px" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              placeholder="Search company, contact, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadSuppliers();
              }}
              style={{
                width: "100%",
                height: "38px",
                padding: "0 12px 0 34px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: "12px",
                color: "#0f172a",
                outline: "none",
              }}
            />
          </div>

          <button
            type="button"
            onClick={loadSuppliers}
            style={{
              height: "38px",
              padding: "0 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "12px",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            Filter
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. SUPPLIERS DIRECTORY TABLE
         ------------------------------------------------------------- */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              Supplier Directory ({suppliers.length})
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Comprehensive record of verified partners, onboarding requests, and compliance status.
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>Loading supplier network...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
            <Building2 size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <h4 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>No suppliers found</h4>
            <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
              No supplier matches the active filter or search criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setServiceTypeFilter("all");
                setSearchQuery("");
                loadSuppliers();
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "14px 20px" }}>Supplier / Company</th>
                  <th style={{ padding: "14px 16px" }}>Contact Person</th>
                  <th style={{ padding: "14px 16px" }}>Location</th>
                  <th style={{ padding: "14px 16px" }}>Services Offered</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                  <th style={{ padding: "14px 16px" }}>Onboarded</th>
                  <th style={{ padding: "14px 20px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const currentStatus = (s.status || s.approvalStatus || "PENDING_APPROVAL").toUpperCase();
                  const cats: string[] = Array.isArray(s.serviceCategories) ? s.serviceCategories : [];

                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Company Name & ID */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              background: "#eff6ff",
                              color: "#2563eb",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 800,
                              fontSize: "14px",
                              flexShrink: 0,
                            }}
                          >
                            {s.businessName?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <strong style={{ color: "#0f172a", fontSize: "14px" }}>{s.businessName}</strong>
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  fontWeight: 700,
                                  fontFamily: "monospace",
                                }}
                              >
                                {s.vendorId}
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                              Tax ID: {s.taxId || s.registrationNumber || "Unregistered"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td style={{ padding: "16px" }}>
                        <strong style={{ display: "block", color: "#0f172a" }}>{s.contactName}</strong>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Mail size={11} color="#94a3b8" /> {s.email}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Phone size={11} color="#94a3b8" /> {s.phone}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td style={{ padding: "16px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#334155", fontWeight: 600 }}>
                          <MapPin size={13} color="#94a3b8" />
                          {s.city ? `${s.city}, ${s.state || s.country || "IN"}` : s.country || "India"}
                        </span>
                      </td>

                      {/* Services Offered */}
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "240px" }}>
                          {cats.length === 0 ? (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>General</span>
                          ) : (
                            cats.map((cat, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  background: "#f1f5f9",
                                  color: "#334155",
                                }}
                              >
                                {cat}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px" }}>{renderStatusBadge(currentStatus)}</td>

                      {/* Onboarded Date */}
                      <td style={{ padding: "16px", color: "#64748b", fontSize: "12px" }}>
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          {/* View Dossier Button */}
                          <button
                            type="button"
                            title="View Full Profile / Dossier"
                            onClick={() => handleOpenDossier(s)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              background: "#eff6ff",
                              color: "#2563eb",
                              border: "1px solid #bfdbfe",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Eye size={13} />
                            <span>Dossier</span>
                          </button>

                          {/* Quick Edit */}
                          <button
                            type="button"
                            title="Edit Supplier Details"
                            onClick={() => setEditingSupplier({ ...s })}
                            style={{
                              padding: "6px",
                              borderRadius: "6px",
                              background: "#f8fafc",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                              cursor: "pointer",
                            }}
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Workflow Actions */}
                          {currentStatus === "PENDING_APPROVAL" ||
                          currentStatus === "PENDING" ||
                          currentStatus === "UNDER_REVIEW" ||
                          currentStatus === "CHANGES_REQUESTED" ? (
                            <>
                              <button
                                type="button"
                                title="Approve Supplier"
                                onClick={() => setActionTarget({ supplier: s, action: "approve" })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  background: "#ecfdf5",
                                  color: "#059669",
                                  border: "1px solid #a7f3d0",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Check size={13} />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                title="Request Changes / Additional Docs"
                                onClick={() => setActionTarget({ supplier: s, action: "request_changes" })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  background: "#fffbeb",
                                  color: "#d97706",
                                  border: "1px solid #fde68a",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <AlertCircle size={13} />
                                <span>Request Changes</span>
                              </button>

                              <button
                                type="button"
                                title="Reject Supplier"
                                onClick={() => setActionTarget({ supplier: s, action: "reject" })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <X size={13} />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : null}

                          {currentStatus === "APPROVED" ? (
                            <button
                              type="button"
                              title="Suspend Supplier"
                              onClick={() => setActionTarget({ supplier: s, action: "suspend" })}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "6px",
                                background: "#fffbeb",
                                color: "#d97706",
                                border: "1px solid #fde68a",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Pause size={13} />
                              <span>Suspend</span>
                            </button>
                          ) : null}

                          {currentStatus === "SUSPENDED" || currentStatus === "REJECTED" ? (
                            <button
                              type="button"
                              title="Reactivate Supplier"
                              onClick={() => setActionTarget({ supplier: s, action: "reactivate" })}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "6px",
                                background: "#eff6ff",
                                color: "#2563eb",
                                border: "1px solid #bfdbfe",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Play size={13} />
                              <span>Reactivate</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          5. MODAL: ADD NEW SUPPLIER
         ------------------------------------------------------------- */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              width: "min(100%, 780px)",
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>
                  Supplier Onboarding
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  Onboard New Supplier / Vendor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSupplier} style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "24px", display: "grid", gap: "20px", fontSize: "13px" }}>
                {/* Section A: Basic Company Information */}
                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Building2 size={16} color="#2563eb" />
                    <span>Basic Information</span>
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Company / Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Himalaya Heights Expeditions"
                        value={createForm.businessName}
                        onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Primary Contact Person *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rajesh Sharma"
                        value={createForm.contactName}
                        onChange={(e) => setCreateForm({ ...createForm, contactName: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Business Email (Login ID) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="supplier@zelevos-partner.com"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Phone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={createForm.phone}
                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Location & Legal */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <MapPin size={16} color="#2563eb" />
                    <span>Location & Legal Business Info</span>
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Head Office Address
                      </label>
                      <input
                        type="text"
                        placeholder="12, Mall Road, Manali"
                        value={createForm.address}
                        onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        City
                      </label>
                      <input
                        type="text"
                        placeholder="Manali"
                        value={createForm.city}
                        onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        State
                      </label>
                      <input
                        type="text"
                        placeholder="Himachal Pradesh"
                        value={createForm.state}
                        onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Business Registration / CIN / PAN
                      </label>
                      <input
                        type="text"
                        placeholder="REG-HP-2024-9988"
                        value={createForm.registrationNumber}
                        onChange={(e) => setCreateForm({ ...createForm, registrationNumber: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        GST / Tax ID
                      </label>
                      <input
                        type="text"
                        placeholder="02AAAAA0000A1Z5"
                        value={createForm.taxId}
                        onChange={(e) => setCreateForm({ ...createForm, taxId: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Multi-Service Categories */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Layers size={16} color="#2563eb" />
                    <span>Services Offered (Multi-Select) *</span>
                  </h4>
                  <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#64748b" }}>
                    Select all services this vendor supplies to Zelevos packages & travelers:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {serviceCategoriesList.map((cat) => {
                      const isSelected = createForm.serviceCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setCreateForm({
                                ...createForm,
                                serviceCategories: createForm.serviceCategories.filter((c) => c !== cat),
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                serviceCategories: [...createForm.serviceCategories, cat],
                              });
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: isSelected ? "1px solid #2563eb" : "1px solid #cbd5e1",
                            background: isSelected ? "#eff6ff" : "#ffffff",
                            color: isSelected ? "#2563eb" : "#475569",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {isSelected && <Check size={12} />}
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section D: Initial Compliance Document */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText size={16} color="#2563eb" />
                    <span>Initial Document Submission</span>
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Document Title
                      </label>
                      <input
                        type="text"
                        value={createForm.docTitle}
                        onChange={(e) => setCreateForm({ ...createForm, docTitle: e.target.value })}
                        style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Document Type
                      </label>
                      <select
                        value={createForm.docType}
                        onChange={(e) => setCreateForm({ ...createForm, docType: e.target.value })}
                        style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                      >
                        <option value="gst_certificate">GST Certificate</option>
                        <option value="business_license">Business License</option>
                        <option value="pan_card">PAN Card</option>
                        <option value="insurance">Liability Insurance</option>
                        <option value="cancelled_cheque">Bank Cancelled Cheque</option>
                        <option value="other">Other Official Document</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        File Path / Secure URL
                      </label>
                      <input
                        type="text"
                        value={createForm.docFileUrl}
                        onChange={(e) => setCreateForm({ ...createForm, docFileUrl: e.target.value })}
                        style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section E: Temporary Credentials */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Initial Temporary Password for Vendor Portal
                  </label>
                  <input
                    type="text"
                    value={createForm.temporaryPassword}
                    onChange={(e) => setCreateForm({ ...createForm, temporaryPassword: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontFamily: "monospace" }}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
                    When approved, login credentials will be created with role: "vendor".
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#ffffff",
                    cursor: createLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {createLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Create Supplier (Pending Approval)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          6. MODAL: EDIT SUPPLIER
         ------------------------------------------------------------- */}
      {editingSupplier && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingSupplier(null);
          }}
        >
          <div
            style={{
              width: "min(100%, 640px)",
              maxHeight: "90vh",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                Edit Supplier: {editingSupplier.businessName}
              </h3>
              <button type="button" onClick={() => setEditingSupplier(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSupplierSubmit} style={{ padding: "24px", display: "grid", gap: "14px", overflowY: "auto", fontSize: "13px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Company Name</label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.businessName || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, businessName: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Contact Person</label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.contactName || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contactName: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Email</label>
                  <input
                    type="email"
                    required
                    value={editingSupplier.email || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Phone</label>
                  <input
                    type="tel"
                    required
                    value={editingSupplier.phone || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>City</label>
                  <input
                    type="text"
                    value={editingSupplier.city || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, city: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Tax ID / GST</label>
                  <input
                    type="text"
                    value={editingSupplier.taxId || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, taxId: e.target.value })}
                    style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#0f172a", color: "#ffffff", fontWeight: 700 }}
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          7. MODAL: STATUS TRANSITION CONFIRMATION (Approve, Reject, Suspend, Reactivate)
         ------------------------------------------------------------- */}
      {actionTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActionTarget(null);
          }}
        >
          <div
            style={{
              width: "min(100%, 460px)",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background:
                    actionTarget.action === "approve"
                      ? "#ecfdf5"
                      : actionTarget.action === "reject"
                      ? "#fef2f2"
                      : actionTarget.action === "request_changes"
                      ? "#fffbeb"
                      : "#fffbeb",
                  color:
                    actionTarget.action === "approve"
                      ? "#059669"
                      : actionTarget.action === "reject"
                      ? "#dc2626"
                      : actionTarget.action === "request_changes"
                      ? "#b45309"
                      : "#d97706",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {actionTarget.action === "approve" ? (
                  <CheckCircle2 size={22} />
                ) : actionTarget.action === "reject" ? (
                  <XCircle size={22} />
                ) : actionTarget.action === "request_changes" ? (
                  <AlertCircle size={22} />
                ) : (
                  <Pause size={22} />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                  {actionTarget.action === "approve"
                    ? "Approve Supplier & Issue Access"
                    : actionTarget.action === "reject"
                    ? "Reject Supplier Onboarding"
                    : actionTarget.action === "request_changes"
                    ? "Request Changes / Additional Documents"
                    : actionTarget.action === "suspend"
                    ? "Suspend Supplier Account"
                    : "Reactivate Supplier Account"}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{actionTarget.supplier.businessName}</span>
              </div>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              {actionTarget.action === "approve"
                ? "Approving this supplier will allow their services to be linked in travel packages and will automatically provision Vendor Portal credentials for their team."
                : actionTarget.action === "reject"
                ? "Rejecting will prevent this supplier from accessing Zelevos and will notify their contact. You must provide a rejection reason."
                : actionTarget.action === "request_changes"
                ? "Requesting changes will notify the supplier to upload missing verification documents or correct registration details before re-evaluation."
                : actionTarget.action === "suspend"
                ? "Suspension halts fulfillment assignments and prevents new bookings from being allocated to this vendor."
                : "Reactivating restores the supplier to Approved status and permits active fulfillment."}
            </p>

            {(actionTarget.action === "reject" || actionTarget.action === "suspend" || actionTarget.action === "request_changes") && (
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  {actionTarget.action === "request_changes"
                    ? "Specify Required Changes / Missing Documents *"
                    : `Reason for ${actionTarget.action === "reject" ? "Rejection" : "Suspension"} *`}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={
                    actionTarget.action === "request_changes"
                      ? "e.g. Please upload clear GST registration certificate and signed tour operator agreement."
                      : actionTarget.action === "reject"
                      ? "e.g. Incomplete GST credentials or invalid business license."
                      : "e.g. Operational delays or temporary seasonal closure."
                  }
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setActionTarget(null);
                  setActionReason("");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionProcessing}
                onClick={handleExecuteStatusAction}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    actionTarget.action === "approve"
                      ? "#059669"
                      : actionTarget.action === "reject"
                      ? "#dc2626"
                      : actionTarget.action === "request_changes"
                      ? "#b45309"
                      : actionTarget.action === "suspend"
                      ? "#d97706"
                      : "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: actionProcessing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {actionProcessing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    Confirm{" "}
                    {actionTarget.action === "approve"
                      ? "Approval"
                      : actionTarget.action === "reject"
                      ? "Rejection"
                      : actionTarget.action === "request_changes"
                      ? "Change Request"
                      : actionTarget.action === "suspend"
                      ? "Suspension"
                      : "Reactivation"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          8. MODAL: FULL SUPPLIER DOSSIER (Complete 6-Tab View)
         ------------------------------------------------------------- */}
      {selectedSupplierId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSupplierId(null);
              setSupplierDossier(null);
            }
          }}
        >
          <div
            style={{
              width: "min(100%, 960px)",
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Dossier Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "#0f172a",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "18px",
                  }}
                >
                  {supplierDossier?.businessName?.charAt(0) || "S"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                      {supplierDossier?.businessName || "Supplier Profile"}
                    </h3>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: "#f1f5f9",
                        color: "#475569",
                        fontSize: "11px",
                        fontWeight: 700,
                        fontFamily: "monospace",
                      }}
                    >
                      {supplierDossier?.vendorId}
                    </span>
                    {supplierDossier && renderStatusBadge(supplierDossier.status || supplierDossier.approvalStatus)}
                  </div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Primary Contact: {supplierDossier?.contactName} · {supplierDossier?.email} · {supplierDossier?.phone}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {supplierDossier &&
                  ((supplierDossier.status || supplierDossier.approvalStatus || "").toUpperCase() === "PENDING_APPROVAL" ||
                    (supplierDossier.status || supplierDossier.approvalStatus || "").toUpperCase() === "PENDING" ||
                    (supplierDossier.status || supplierDossier.approvalStatus || "").toUpperCase() === "UNDER_REVIEW" ||
                    (supplierDossier.status || supplierDossier.approvalStatus || "").toUpperCase() === "CHANGES_REQUESTED") && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActionTarget({ supplier: supplierDossier, action: "approve" })}
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
                        <Check size={14} />
                        <span>Approve Supplier</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActionTarget({ supplier: supplierDossier, action: "request_changes" })}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#d97706",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <AlertCircle size={14} />
                        <span>Request Changes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActionTarget({ supplier: supplierDossier, action: "reject" })}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#dc2626",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSupplierId(null);
                    setSupplierDossier(null);
                  }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "4px" }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Dossier Tabs Navigation */}
            <div style={{ padding: "0 24px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", display: "flex", gap: "18px", overflowX: "auto" }}>
              {[
                { id: "overview", label: "Overview & Business" },
                { id: "services", label: `Services (${supplierDossier?.services?.length || 0})` },
                { id: "documents", label: `Documents (${supplierDossier?.documents?.length || 0})` },
                { id: "bookings", label: `Linked Bookings (${supplierDossier?.bookings?.length || 0})` },
                { id: "invoices", label: `Finance & Invoices (${supplierDossier?.invoices?.length || 0})` },
                { id: "audit", label: "Audit Trail" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDossierTab(t.id as any)}
                  style={{
                    padding: "14px 4px",
                    border: "none",
                    background: "transparent",
                    color: dossierTab === t.id ? "#2563eb" : "#64748b",
                    fontWeight: dossierTab === t.id ? 800 : 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    borderBottom: dossierTab === t.id ? "2px solid #2563eb" : "2px solid transparent",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Dossier Tab Content */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, fontSize: "13px" }}>
              {dossierLoading ? (
                <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                  <p style={{ margin: 0 }}>Fetching dossier records...</p>
                </div>
              ) : !supplierDossier ? (
                <p>Profile details unavailable.</p>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {dossierTab === "overview" && (
                    <div style={{ display: "grid", gap: "20px" }}>
                      {/* Grid cards */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        {/* Company Details */}
                        <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                          <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                            Company Information
                          </h4>
                          <div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "#64748b" }}>Address:</span>{" "}
                              <strong style={{ color: "#0f172a" }}>{supplierDossier.address || "Not recorded"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#64748b" }}>City / State / Country:</span>{" "}
                              <strong style={{ color: "#0f172a" }}>
                                {supplierDossier.city || "—"}, {supplierDossier.state || "—"}, {supplierDossier.country || "India"}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: "#64748b" }}>Registration Number:</span>{" "}
                              <strong style={{ color: "#0f172a" }}>{supplierDossier.registrationNumber || "—"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#64748b" }}>GST / Tax Identification:</span>{" "}
                              <strong style={{ color: "#0f172a" }}>{supplierDossier.taxId || "—"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#64748b" }}>Commercial Terms:</span>{" "}
                              <strong style={{ color: "#0f172a" }}>{supplierDossier.netRateTerms || "Net 30 / Standard"}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Performance & Quality Metrics */}
                        <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                          <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                            Performance & Reliability Metrics
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                              <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Acceptance Rate</span>
                              <strong style={{ fontSize: "16px", color: "#059669" }}>
                                {supplierDossier.acceptanceRate || 100}%
                              </strong>
                            </div>
                            <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                              <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Avg Response Time</span>
                              <strong style={{ fontSize: "16px", color: "#2563eb" }}>
                                {supplierDossier.avgResponseMinutes || 30} mins
                              </strong>
                            </div>
                            <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                              <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Cancellation Rate</span>
                              <strong style={{ fontSize: "16px", color: "#dc2626" }}>
                                {supplierDossier.cancellationRate || 0}%
                              </strong>
                            </div>
                            <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                              <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Customer Issues</span>
                              <strong style={{ fontSize: "16px", color: "#d97706" }}>
                                {supplierDossier.customerIssuesCount || 0}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Service Categories */}
                      <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                        <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                          Contracted Service Categories
                        </h4>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {Array.isArray(supplierDossier.serviceCategories) && supplierDossier.serviceCategories.length > 0 ? (
                            supplierDossier.serviceCategories.map((c: string, i: number) => (
                              <span
                                key={i}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  background: "#eff6ff",
                                  color: "#2563eb",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  border: "1px solid #bfdbfe",
                                }}
                              >
                                {c}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: "#94a3b8" }}>No categories specified.</span>
                          )}
                        </div>
                      </div>

                      {/* Financial Overview */}
                      {supplierDossier.finance && (
                        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                          <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                            Financial Balance & Settlement Status
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Expected Payables</span>
                              <strong style={{ display: "block", fontSize: "16px", color: "#0f172a" }}>
                                ₹{Number(supplierDossier.finance.expectedPayable || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Total Invoiced</span>
                              <strong style={{ display: "block", fontSize: "16px", color: "#0f172a" }}>
                                ₹{Number(supplierDossier.finance.totalInvoiced || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Approved for Payout</span>
                              <strong style={{ display: "block", fontSize: "16px", color: "#059669" }}>
                                ₹{Number(supplierDossier.finance.approvedPayables || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Net Outstanding</span>
                              <strong style={{ display: "block", fontSize: "16px", color: "#2563eb" }}>
                                ₹{Number(supplierDossier.finance.outstanding || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: SERVICES CATALOG */}
                  {dossierTab === "services" && (
                    <div style={{ display: "grid", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                            Offered Services & Commercial Inventory
                          </h4>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            These services can be linked to dynamic package creation when the supplier is approved.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddServiceForm(!showAddServiceForm)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#0f172a",
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
                          <span>Add Service</span>
                        </button>
                      </div>

                      {/* Add Service Inline Form */}
                      {showAddServiceForm && (
                        <form
                          onSubmit={handleAddService}
                          style={{
                            background: "#f8fafc",
                            padding: "16px",
                            borderRadius: "10px",
                            border: "1px solid #cbd5e1",
                            display: "grid",
                            gap: "12px",
                          }}
                        >
                          <strong style={{ fontSize: "13px", color: "#0f172a" }}>New Service Registration</strong>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "10px" }}>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Type</label>
                              <select
                                value={newService.serviceType}
                                onChange={(e) => setNewService({ ...newService, serviceType: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              >
                                {serviceCategoriesList.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Title / Property Name *</label>
                              <input
                                type="text"
                                required
                                placeholder="Deluxe Pine View Valley Room"
                                value={newService.title}
                                onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Location *</label>
                              <input
                                type="text"
                                required
                                placeholder="Manali, HP"
                                value={newService.location}
                                onChange={(e) => setNewService({ ...newService, location: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "10px" }}>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Net Rate (₹)</label>
                              <input
                                type="number"
                                required
                                value={newService.rate}
                                onChange={(e) => setNewService({ ...newService, rate: Number(e.target.value) })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Capacity / Units</label>
                              <input
                                type="number"
                                required
                                value={newService.capacity}
                                onChange={(e) => setNewService({ ...newService, capacity: Number(e.target.value) })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Availability Note</label>
                              <input
                                type="text"
                                value={newService.availability}
                                onChange={(e) => setNewService({ ...newService, availability: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => setShowAddServiceForm(false)}
                              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingService}
                              style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}
                            >
                              {savingService ? "Saving..." : "Save Service"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Services List */}
                      {Array.isArray(supplierDossier.services) && supplierDossier.services.length > 0 ? (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {supplierDossier.services.map((svc: any) => (
                            <div
                              key={svc.id}
                              style={{
                                padding: "14px 18px",
                                borderRadius: "10px",
                                border: "1px solid #e2e8f0",
                                background: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{svc.title}</strong>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      fontWeight: 700,
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {svc.serviceType}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>· {svc.location}</span>
                                </div>
                                <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
                                  Capacity: {svc.capacity} pax · {svc.availability || "Available"}
                                </span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <strong style={{ fontSize: "16px", color: "#059669", display: "block" }}>
                                  ₹{Number(svc.rate).toLocaleString("en-IN")}
                                </strong>
                                <span style={{ fontSize: "10px", color: "#94a3b8" }}>Net Supplier Rate</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "10px", color: "#64748b" }}>
                          <p style={{ margin: 0 }}>No services registered yet for this supplier.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: DOCUMENTS & COMPLIANCE */}
                  {dossierTab === "documents" && (
                    <div style={{ display: "grid", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                            Submitted Legal & Compliance Documents
                          </h4>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            Verify or reject compliance proofs before approving this vendor.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddDocForm(!showAddDocForm)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#0f172a",
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

                      {/* Add Doc Form */}
                      {showAddDocForm && (
                        <form
                          onSubmit={handleAddDocument}
                          style={{
                            background: "#f8fafc",
                            padding: "16px",
                            borderRadius: "10px",
                            border: "1px solid #cbd5e1",
                            display: "grid",
                            gap: "10px",
                          }}
                        >
                          <strong style={{ fontSize: "13px", color: "#0f172a" }}>Upload Additional Compliance File</strong>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "10px" }}>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Doc Type</label>
                              <select
                                value={newDoc.documentType}
                                onChange={(e) => setNewDoc({ ...newDoc, documentType: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              >
                                <option value="license">Trade License</option>
                                <option value="gst_certificate">GST Certificate</option>
                                <option value="pan_card">PAN Card</option>
                                <option value="insurance">Insurance Policy</option>
                                <option value="bank_mandate">Bank Mandate</option>
                                <option value="contract">Signed Contract</option>
                                <option value="other">Other Proof</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>Title *</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Valid Transport Permit"
                                value={newDoc.title}
                                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>File URL *</label>
                              <input
                                type="text"
                                required
                                value={newDoc.fileUrl}
                                onChange={(e) => setNewDoc({ ...newDoc, fileUrl: e.target.value })}
                                style={{ width: "100%", height: "34px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => setShowAddDocForm(false)}
                              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingDoc}
                              style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#059669", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}
                            >
                              {savingDoc ? "Uploading..." : "Save & Verify"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Documents List */}
                      {Array.isArray(supplierDossier.documents) && supplierDossier.documents.length > 0 ? (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {supplierDossier.documents.map((doc: any) => {
                            const docStatus = (doc.status || "pending").toLowerCase();
                            return (
                              <div
                                key={doc.id}
                                style={{
                                  padding: "14px 18px",
                                  borderRadius: "10px",
                                  border: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                  <div
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "8px",
                                      background:
                                        docStatus === "verified"
                                          ? "#ecfdf5"
                                          : docStatus === "rejected"
                                          ? "#fef2f2"
                                          : "#fffbeb",
                                      color:
                                        docStatus === "verified"
                                          ? "#059669"
                                          : docStatus === "rejected"
                                          ? "#dc2626"
                                          : "#d97706",
                                      display: "grid",
                                      placeItems: "center",
                                    }}
                                  >
                                    <FileText size={18} />
                                  </div>
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>{doc.title}</strong>
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          background:
                                            docStatus === "verified"
                                              ? "#ecfdf5"
                                              : docStatus === "rejected"
                                              ? "#fef2f2"
                                              : "#fffbeb",
                                          color:
                                            docStatus === "verified"
                                              ? "#059669"
                                              : docStatus === "rejected"
                                              ? "#dc2626"
                                              : "#d97706",
                                          fontWeight: 700,
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {docStatus}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px" }}>
                                      Type: {doc.documentType} · File: {doc.fileName} · Uploaded:{" "}
                                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-IN") : "—"}
                                    </span>
                                    {doc.rejectionReason && (
                                      <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600, display: "block", marginTop: "2px" }}>
                                        Rejection Reason: {doc.rejectionReason}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  {/* Secure View */}
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: "6px",
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      textDecoration: "none",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <ExternalLink size={12} />
                                    <span>Preview</span>
                                  </a>

                                  {/* Verify / Reject */}
                                  {docStatus !== "verified" && (
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyDocument(doc.id)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        background: "#ecfdf5",
                                        color: "#059669",
                                        border: "1px solid #a7f3d0",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Verify
                                    </button>
                                  )}

                                  {docStatus !== "rejected" && (
                                    <button
                                      type="button"
                                      onClick={() => setRejectingDocId(doc.id)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        border: "1px solid #fecaca",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "10px", color: "#64748b" }}>
                          <p style={{ margin: 0 }}>No documents uploaded by this supplier yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: BOOKINGS & FULFILLMENT TASKS */}
                  {dossierTab === "bookings" && (
                    <div style={{ display: "grid", gap: "14px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                        Linked Operations Fulfillment Tasks
                      </h4>
                      {Array.isArray(supplierDossier.bookings) && supplierDossier.bookings.length > 0 ? (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {supplierDossier.bookings.map((item: any, idx: number) => {
                            const task = item.task;
                            return (
                              <div
                                key={idx}
                                style={{
                                  padding: "14px 18px",
                                  borderRadius: "10px",
                                  border: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                                      Booking {item.bookingRef || "N/A"}
                                    </strong>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        background:
                                          task.status === "VERIFIED"
                                            ? "#ecfdf5"
                                            : task.status === "ACCEPTED"
                                            ? "#eff6ff"
                                            : "#fffbeb",
                                        color:
                                          task.status === "VERIFIED"
                                            ? "#059669"
                                            : task.status === "ACCEPTED"
                                            ? "#2563eb"
                                            : "#d97706",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {task.status}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
                                    Service: {task.serviceName || task.serviceType} · Travel Date:{" "}
                                    {item.travelDate ? new Date(item.travelDate).toLocaleDateString("en-IN") : "—"}
                                  </span>
                                  {task.supplierConfirmationRef && (
                                    <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600, display: "block" }}>
                                      Confirmation Ref: {task.supplierConfirmationRef}
                                    </span>
                                  )}
                                </div>

                                <div style={{ textAlign: "right" }}>
                                  <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                                    ₹{Number(task.supplierNetCost || 0).toLocaleString("en-IN")}
                                  </strong>
                                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>Net Supplier Cost</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "10px", color: "#64748b" }}>
                          <p style={{ margin: 0 }}>No bookings or tasks assigned to this supplier yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: INVOICES & FINANCE */}
                  {dossierTab === "invoices" && (
                    <div style={{ display: "grid", gap: "14px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                        Submitted Vendor Invoices & Ledgers
                      </h4>
                      {Array.isArray(supplierDossier.invoices) && supplierDossier.invoices.length > 0 ? (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {supplierDossier.invoices.map((inv: any) => (
                            <div
                              key={inv.id}
                              style={{
                                padding: "14px 18px",
                                borderRadius: "10px",
                                border: "1px solid #e2e8f0",
                                background: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                                    Invoice #{inv.invoiceNumber}
                                  </strong>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background:
                                        inv.status === "paid"
                                          ? "#ecfdf5"
                                          : inv.status === "approved"
                                          ? "#eff6ff"
                                          : "#fffbeb",
                                      color:
                                        inv.status === "paid"
                                          ? "#059669"
                                          : inv.status === "approved"
                                          ? "#2563eb"
                                          : "#d97706",
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {inv.status}
                                  </span>
                                </div>
                                <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
                                  Submitted: {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                                </span>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                                  ₹{Number(inv.amount || 0).toLocaleString("en-IN")}
                                </strong>
                                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{inv.currency || "INR"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "10px", color: "#64748b" }}>
                          <p style={{ margin: 0 }}>No invoices submitted by this supplier yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: AUDIT TRAIL */}
                  {dossierTab === "audit" && (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                        Compliance & Status Audit Trail
                      </h4>
                      {Array.isArray(supplierDossier.auditLogs) && supplierDossier.auditLogs.length > 0 ? (
                        supplierDossier.auditLogs.map((log: any) => (
                          <div
                            key={log.id}
                            style={{
                              padding: "12px 16px",
                              borderRadius: "8px",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                              <strong style={{ color: "#0f172a" }}>{log.action}</strong>
                              <span style={{ color: "#94a3b8" }}>
                                {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : "—"}
                              </span>
                            </div>
                            <span style={{ color: "#64748b" }}>
                              Actor: {log.actorRole || "Admin"} · Resource: {log.resourceType}
                            </span>
                            {log.newValue && (
                              <pre
                                style={{
                                  margin: "6px 0 0",
                                  padding: "6px 8px",
                                  background: "#ffffff",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  color: "#334155",
                                  overflowX: "auto",
                                }}
                              >
                                {JSON.stringify(log.newValue, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "10px", color: "#64748b" }}>
                          <p style={{ margin: 0 }}>No recorded audit events for this supplier.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Action Confirmation Modal (Approve, Request Changes, Reject, Suspend, Reactivate) */}
      {actionTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 10002,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionProcessing) setActionTarget(null);
          }}
        >
          <div style={{ width: "min(100%, 460px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
              {actionTarget.action === "approve"
                ? "Approve Supplier"
                : actionTarget.action === "request_changes"
                ? "Request Changes / Additional Documents"
                : actionTarget.action === "reject"
                ? "Reject Supplier Application"
                : actionTarget.action === "suspend"
                ? "Suspend Supplier"
                : "Reactivate Supplier"}
            </h4>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
              {actionTarget.action === "approve"
                ? `Are you sure you want to approve "${actionTarget.supplier.businessName}"? This will provision their official vendor account and enable them to accept booking fulfillment requests.`
                : actionTarget.action === "request_changes"
                ? `Enter instructions or specify additional verification documents needed from "${actionTarget.supplier.businessName}". They will be able to resubmit via their application tracker.`
                : `Specify reason for ${actionTarget.action} for "${actionTarget.supplier.businessName}".`}
            </p>

            {(actionTarget.action === "request_changes" || actionTarget.action === "reject" || actionTarget.action === "suspend") && (
              <textarea
                rows={3}
                required
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  actionTarget.action === "request_changes"
                    ? "e.g. Please provide Himachal Tourism Registration Certificate or updated GSTIN."
                    : "Enter reason..."
                }
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none", marginBottom: "16px" }}
              />
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={actionProcessing}
                onClick={() => setActionTarget(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProcessing}
                onClick={handleExecuteStatusAction}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    actionTarget.action === "approve"
                      ? "#059669"
                      : actionTarget.action === "request_changes"
                      ? "#d97706"
                      : "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: actionProcessing ? "not-allowed" : "pointer",
                }}
              >
                {actionProcessing
                  ? "Processing..."
                  : actionTarget.action === "approve"
                  ? "Confirm Approval"
                  : actionTarget.action === "request_changes"
                  ? "Confirm Request"
                  : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Prompt Modal for Single Document */}
      {rejectingDocId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 10001,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRejectingDocId(null);
          }}
        >
          <div style={{ width: "min(100%, 420px)", background: "#ffffff", borderRadius: "14px", padding: "20px" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              Reject Document
            </h4>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              Specify why this document is rejected so the supplier can resubmit valid compliance proof.
            </p>
            <textarea
              rows={3}
              value={docRejectionReason}
              onChange={(e) => setDocRejectionReason(e.target.value)}
              placeholder="e.g. Expired certificate or signature mismatch."
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none", marginBottom: "14px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setRejectingDocId(null)}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectDocument}
                style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#dc2626", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSuppliersTab;
