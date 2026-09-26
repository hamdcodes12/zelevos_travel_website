import React, { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileUp,
  ShieldCheck,
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
  RefreshCw,
  LogOut,
  Calendar,
  AlertTriangle,
  Upload,
  Info,
} from "lucide-react";
import { useLocation } from "wouter";

export function VendorPortalPage() {
  const [, setLocation] = useLocation();

  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [vendorData, setVendorData] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Portal View State
  const [activeTab, setActiveTab] = useState<"dashboard" | "requests" | "services" | "documents" | "invoices">("dashboard");
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Action states for booking requests
  const [confirmRefs, setConfirmRefs] = useState<Record<string, string>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Reject Request Modal
  const [rejectingTask, setRejectingTask] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingLoading, setRejectingLoading] = useState(false);

  // Request Change Modal
  const [changingTask, setChangingTask] = useState<any | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [changingLoading, setChangingLoading] = useState(false);

  // Upload Voucher / Confirmation Modal
  const [voucherTask, setVoucherTask] = useState<any | null>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherRef, setVoucherRef] = useState("");
  const [uploadingVoucher, setUploadingVoucher] = useState(false);

  // Add Service Form Modal
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

  // Add Document Modal
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("business_registration");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Add Invoice Modal
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    amount: 5000,
    bookingId: "",
    notes: "Fulfillment completed according to voucher instructions.",
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Initial Auth Check
  useEffect(() => {
    checkVendorSession();
  }, []);

  const checkVendorSession = async () => {
    setAuthLoading(true);
    try {
      // Check current session from /api/auth/me or /api/vendor/portal/dashboard
      const res = await fetch("/api/vendor/portal/dashboard", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setVendorData(data.vendor);
        setDashboard(data);
        loadPortalData();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Real Vendor Login
  const handleVendorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/vendor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid vendor credentials.");
      }

      setIsAuthenticated(true);
      setVendorData(data.vendor);
      showToast(`Welcome back, ${data.vendor?.businessName || "Partner"}!`);
      loadPortalData();
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  // 3. Real Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setVendorData(null);
    setDashboard(null);
  };

  // 4. Load Portal Data
  const loadPortalData = async () => {
    setLoading(true);
    try {
      const [dashRes, reqsRes, svcsRes, docsRes, invsRes] = await Promise.all([
        fetch("/api/vendor/portal/dashboard", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/vendor/portal/requests", { credentials: "include" }).then((r) => (r.ok ? r.json() : { requests: [] })),
        fetch("/api/vendor/portal/services", { credentials: "include" }).then((r) => (r.ok ? r.json() : { services: [] })),
        fetch("/api/vendor/portal/documents", { credentials: "include" }).then((r) => (r.ok ? r.json() : { documents: [] })),
        fetch("/api/vendor/portal/invoices", { credentials: "include" }).then((r) => (r.ok ? r.json() : { invoices: [] })),
      ]);

      if (dashRes) {
        setDashboard(dashRes);
        if (dashRes.vendor) setVendorData(dashRes.vendor);
      }
      setRequests(Array.isArray(reqsRes?.requests) ? reqsRes.requests : []);
      setServices(Array.isArray(svcsRes?.services) ? svcsRes.services : []);
      setDocuments(Array.isArray(docsRes?.documents) ? docsRes.documents : []);
      setInvoices(Array.isArray(invsRes?.invoices) ? invsRes.invoices : []);
    } catch (err: any) {
      showToast(err.message || "Failed to load portal records.");
    } finally {
      setLoading(false);
    }
  };

  // Accept Booking Request
  const handleAcceptRequest = async (taskId: string) => {
    const ref = confirmRefs[taskId] || `CONF-${Date.now().toString().slice(-6)}`;
    setAcceptingId(taskId);
    try {
      const res = await fetch(`/api/vendor/portal/requests/${taskId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmationReference: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept booking.");

      showToast(`Request accepted with Confirmation Ref: ${ref}`);
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Accept failed.");
    } finally {
      setAcceptingId(null);
    }
  };

  // Reject Booking Request
  const handleRejectRequest = async () => {
    if (!rejectingTask || !rejectReason.trim()) {
      showToast("Please provide a rejection reason.");
      return;
    }
    setRejectingLoading(true);
    try {
      const res = await fetch(`/api/vendor/portal/requests/${rejectingTask.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject booking.");

      showToast("Booking request declined.");
      setRejectingTask(null);
      setRejectReason("");
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Rejection failed.");
    } finally {
      setRejectingLoading(false);
    }
  };

  // Request Changes on Booking
  const handleChangeRequest = async () => {
    if (!changingTask || !changeNotes.trim()) {
      showToast("Please specify requested adjustments.");
      return;
    }
    setChangingLoading(true);
    try {
      const res = await fetch(`/api/vendor/portal/requests/${changingTask.id}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: changeNotes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to request changes.");

      showToast("Adjustment request submitted to Operations Desk.");
      setChangingTask(null);
      setChangeNotes("");
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Change request failed.");
    } finally {
      setChangingLoading(false);
    }
  };

  // Upload Real Voucher & Confirmation
  const handleUploadVoucher = async () => {
    if (!voucherTask || !voucherFile) {
      showToast("Please select a voucher file (PDF or Image).");
      return;
    }

    setUploadingVoucher(true);
    try {
      // 1. Upload document file to secure storage
      const formData = new FormData();
      formData.append("document", voucherFile);
      formData.append("documentType", "voucher");
      formData.append("title", `Booking Voucher - ${voucherTask.id}`);

      const uploadRes = await fetch("/api/suppliers/upload-document", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || "Failed to upload file.");

      // 2. Attach voucher and confirmation to the booking service
      const attachRes = await fetch(`/api/vendor/portal/requests/${voucherTask.id}/voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          voucherUrl: uploadData.fileUrl,
          supplierConfirmationRef: voucherRef.trim() || undefined,
        }),
      });
      const attachData = await attachRes.json();
      if (!attachRes.ok) throw new Error(attachData.message || "Failed to attach voucher.");

      showToast("Voucher and confirmation reference saved! Operations notified.");
      setVoucherTask(null);
      setVoucherFile(null);
      setVoucherRef("");
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Voucher upload failed.");
    } finally {
      setUploadingVoucher(false);
    }
  };

  // Add Service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.title.trim() || !newService.location.trim()) {
      showToast("Title and Location are required.");
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

      showToast(`Service "${data.service.title}" created successfully!`);
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
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Failed to add service.");
    } finally {
      setSavingService(false);
    }
  };

  // Add Document
  const handleUploadNewDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !docTitle.trim()) {
      showToast("Please provide a title and select a file.");
      return;
    }

    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append("document", docFile);
      fd.append("documentType", docType);
      fd.append("title", docTitle.trim());

      const res = await fetch("/api/suppliers/upload-document", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Document upload failed.");

      showToast("Document uploaded and attached to your supplier account!");
      setShowAddDoc(false);
      setDocFile(null);
      setDocTitle("");
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Create Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInvoice(true);
    try {
      const res = await fetch("/api/vendor/portal/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoiceNumber: newInvoice.invoiceNumber.trim(),
          amount: Number(newInvoice.amount),
          notes: newInvoice.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit invoice.");

      showToast(`Invoice ${data.invoice.invoiceNumber} submitted for payment processing!`);
      setShowAddInvoice(false);
      setNewInvoice({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        amount: 5000,
        bookingId: "",
        notes: "Fulfillment completed according to voucher instructions.",
      });
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Failed to create invoice.");
    } finally {
      setSavingInvoice(false);
    }
  };

  // Render Loading Spinner while checking session
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#64748b" }}>
        <div style={{ textAlign: "center" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px", color: "#6366f1" }} />
          <p style={{ fontSize: "14px", fontWeight: 600 }}>Connecting to Zelevos Vendor Gateway...</p>
        </div>
      </div>
    );
  }

  // Render Login Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
            width: "100%",
            maxWidth: "440px",
            padding: "36px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#0f172a",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
              }}
            >
              <Building2 size={24} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 6px", color: "#0f172a" }}>
              Zelevos Vendor Portal
            </h1>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              Official access for approved travel suppliers & operators
            </p>
          </div>

          {loginError && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "18px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#b91c1c",
                fontSize: "13px",
              }}
            >
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleVendorLogin} style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Registered Supplier Email
              </label>
              <input
                type="email"
                required
                placeholder="vendor@travelservice.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                  Password
                </label>
                <a href="/forgot-password" style={{ fontSize: "11px", color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                height: "44px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loginLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "6px",
                opacity: loginLoading ? 0.7 : 1,
              }}
            >
              <span>{loginLoading ? "Authenticating..." : "Sign in to Vendor Portal"}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>Not yet a verified supplier? </span>
            <button
              type="button"
              onClick={() => setLocation("/become-a-supplier")}
              style={{ background: "none", border: "none", color: "#4f46e5", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
            >
              Apply to become a supplier
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Suspended Banner
  const isSuspended = vendorData?.status === "SUSPENDED" || vendorData?.approvalStatus === "suspended";

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", color: "#0f172a", paddingBottom: "60px" }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 100,
          }}
        >
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#0f172a", color: "#ffffff", display: "grid", placeItems: "center" }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "16px", fontWeight: 800 }}>{vendorData?.businessName || "Vendor Portal"}</strong>
                <span
                  style={{
                    background: isSuspended ? "#fef2f2" : "#ecfdf5",
                    color: isSuspended ? "#dc2626" : "#059669",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {vendorData?.status || "APPROVED"}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "#4f46e5", fontFamily: "monospace", fontWeight: 700, background: "#eef2ff", padding: "2px 8px", borderRadius: "4px", border: "1px solid #c7d2fe" }}>
                Vendor ID: {vendorData?.vendorId || "ZLV-VND-000001"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={loadPortalData}
              title="Refresh Data"
              style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "8px", borderRadius: "8px", cursor: "pointer", color: "#475569" }}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1280px", margin: "28px auto 0", padding: "0 24px", display: "grid", gap: "24px" }}>
        {/* Suspended Warning */}
        {isSuspended && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "14px",
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              color: "#991b1b",
            }}
          >
            <AlertTriangle size={24} color="#dc2626" />
            <div>
              <strong style={{ fontSize: "15px", display: "block" }}>Account Temporarily Suspended</strong>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#b91c1c" }}>
                Your supplier account has been placed under suspension ({vendorData?.suspensionReason || "Administrative hold"}).
                New booking assignments are paused. Please contact Zelevos Operations for review.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", flexWrap: "wrap" }}>
          {[
            { id: "dashboard", label: "Overview & Metrics", icon: Layers },
            { id: "requests", label: `Booking Tasks (${requests.length})`, icon: Clock },
            { id: "services", label: `My Services (${services.length})`, icon: Building2 },
            { id: "documents", label: `KYC & Documents (${documents.length})`, icon: FileText },
            { id: "invoices", label: `Invoices & Payables (${invoices.length})`, icon: DollarSign },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: isActive ? "#0f172a" : "#ffffff",
                  color: isActive ? "#ffffff" : "#475569",
                  border: isActive ? "none" : "1px solid #cbd5e1",
                  padding: "9px 18px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. TAB: DASHBOARD OVERVIEW */}
        {activeTab === "dashboard" && (
          <div style={{ display: "grid", gap: "24px" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Active Services</span>
                <div style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 0", color: "#0f172a" }}>
                  {dashboard?.stats?.activeServicesCount ?? services.filter((s) => s.isActive).length}
                </div>
                <span style={{ fontSize: "11px", color: "#059669" }}>Available for dynamic booking</span>
              </div>

              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Pending Tasks</span>
                <div style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 0", color: "#d97706" }}>
                  {dashboard?.stats?.pendingTasksCount ?? requests.filter((r) => r.status === "REQUESTED" || r.status === "PENDING").length}
                </div>
                <span style={{ fontSize: "11px", color: "#d97706" }}>Requires accept or confirmation</span>
              </div>

              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Accepted / Fulfilled</span>
                <div style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 0", color: "#059669" }}>
                  {dashboard?.stats?.acceptedTasksCount ?? requests.filter((r) => r.status === "ACCEPTED" || r.status === "VERIFIED").length}
                </div>
                <span style={{ fontSize: "11px", color: "#059669" }}>Successfully confirmed</span>
              </div>

              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Total Invoiced</span>
                <div style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 0", color: "#2563eb" }}>
                  ₹{(dashboard?.stats?.totalInvoicedAmount ?? 0).toLocaleString()}
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Settlement processing</span>
              </div>
            </div>

            {/* Profile Overview Card */}
            <div style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 16px" }}>Supplier Business Profile</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>BUSINESS NAME</span>
                  <strong>{vendorData?.businessName}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>PRIMARY CONTACT</span>
                  <strong>{vendorData?.contactName}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>EMAIL ADDRESS</span>
                  <strong>{vendorData?.email}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>PHONE NUMBER</span>
                  <strong>{vendorData?.phone}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>LOCATION</span>
                  <strong>{vendorData?.city ? `${vendorData.city}, ${vendorData.state || ""}` : "Not set"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>GSTIN / TAX ID</span>
                  <strong>{vendorData?.taxId || "Not registered"}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TAB: BOOKING REQUESTS & FULFILLMENT */}
        {activeTab === "requests" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px" }}>Assigned Booking Tasks</h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Real service requests assigned by Zelevos Operations Desk. Accept to confirm inventory, or upload vouchers.
                </p>
              </div>
            </div>

            {requests.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "48px", borderRadius: "16px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                <Clock size={36} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
                <strong style={{ fontSize: "15px", display: "block", color: "#0f172a" }}>No pending service requests</strong>
                <p style={{ fontSize: "13px", margin: "4px 0 0" }}>When Operations assigns customer bookings for your services, they will appear here in real-time.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {requests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      padding: "20px",
                      border: "1px solid #e2e8f0",
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                            {req.serviceType || "SERVICE"}
                          </span>
                          <strong style={{ fontSize: "15px" }}>{req.serviceName || `Booking Service #${req.id.slice(0, 8)}`}</strong>
                        </div>
                        <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
                          Booking ID: {req.bookingId || "—"} • Cost: ₹{req.actualCost || req.estimatedCost || 0}
                        </span>
                      </div>

                      {/* Status */}
                      <span
                        style={{
                          background: req.status === "ACCEPTED" || req.status === "VERIFIED" ? "#ecfdf5" : req.status === "REJECTED" ? "#fef2f2" : "#fffbeb",
                          color: req.status === "ACCEPTED" || req.status === "VERIFIED" ? "#059669" : req.status === "REJECTED" ? "#dc2626" : "#d97706",
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {req.status}
                      </span>
                    </div>

                    {/* Operational Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                      {req.status === "REQUESTED" || req.status === "PENDING" ? (
                        <>
                          <input
                            type="text"
                            placeholder="Enter confirmation / booking ref"
                            value={confirmRefs[req.id] || ""}
                            onChange={(e) => setConfirmRefs({ ...confirmRefs, [req.id]: e.target.value })}
                            style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", minWidth: "220px" }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req.id)}
                            disabled={acceptingId === req.id}
                            style={{
                              background: "#059669",
                              color: "#ffffff",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Check size={14} />
                            <span>{acceptingId === req.id ? "Accepting..." : "Accept & Confirm"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingTask(req)}
                            style={{
                              background: "#ffffff",
                              color: "#dc2626",
                              border: "1px solid #fecaca",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => setChangingTask(req)}
                            style={{
                              background: "#ffffff",
                              color: "#d97706",
                              border: "1px solid #fde68a",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Request Change
                          </button>
                        </>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            Ref: <strong>{req.supplierConfirmationRef || "Confirmed"}</strong>
                            {req.voucherUrl && " • Voucher Attached"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setVoucherTask(req)}
                            style={{
                              background: "#4f46e5",
                              color: "#ffffff",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <FileUp size={13} />
                            <span>{req.voucherUrl ? "Update Voucher" : "Upload Voucher"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. TAB: SERVICES CATALOG */}
        {activeTab === "services" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px" }}>My Services Catalog</h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Manage your bookable hotel rooms, cabs, activities, or guide tours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddService(true)}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={15} />
                <span>Add New Service</span>
              </button>
            </div>

            {services.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "48px", borderRadius: "16px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                <Building2 size={36} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
                <strong style={{ fontSize: "15px", display: "block", color: "#0f172a" }}>No services listed yet</strong>
                <p style={{ fontSize: "13px", margin: "4px 0 16px" }}>Add your rooms, vehicles, or activities so Zelevos can assign them to incoming bookings.</p>
                <button
                  type="button"
                  onClick={() => setShowAddService(true)}
                  style={{ background: "#4f46e5", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  Create First Service
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      padding: "20px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                          {svc.serviceType}
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: svc.isActive ? "#059669" : "#64748b" }}>
                          {svc.isActive ? "● Active" : "○ Inactive"}
                        </span>
                      </div>
                      <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px" }}>{svc.title}</h3>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px" }}>Location: {svc.location}</p>
                      {svc.description && <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 12px" }}>{svc.description}</p>}
                    </div>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>Rate</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>₹{svc.rate}</div>
                      </div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Cap: {svc.capacity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. TAB: DOCUMENTS & KYC */}
        {activeTab === "documents" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px" }}>Compliance & Verification Documents</h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Stored securely in Zelevos private document vault. Reviewed by Admin for compliance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDoc(true)}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Upload size={15} />
                <span>Upload New Document</span>
              </button>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    padding: "16px 20px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <FileText size={20} color="#4f46e5" />
                    <div>
                      <strong style={{ fontSize: "14px", display: "block" }}>{doc.title || doc.fileName}</strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Type: {doc.documentType} • File: {doc.fileName}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      background: doc.status === "verified" ? "#ecfdf5" : doc.status === "rejected" ? "#fef2f2" : "#fffbeb",
                      color: doc.status === "verified" ? "#059669" : doc.status === "rejected" ? "#dc2626" : "#d97706",
                      padding: "4px 12px",
                      borderRadius: "9999px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {doc.status || "pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. TAB: INVOICES & PAYABLES */}
        {activeTab === "invoices" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px" }}>Supplier Invoices & Settlements</h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Track your payable balances and submit fulfillment invoices directly to Zelevos Finance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInvoice(true)}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={15} />
                <span>Submit New Invoice</span>
              </button>
            </div>

            {invoices.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "48px", borderRadius: "16px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                <DollarSign size={36} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
                <strong style={{ fontSize: "15px", display: "block", color: "#0f172a" }}>No invoices submitted yet</strong>
                <p style={{ fontSize: "13px", margin: "4px 0 0" }}>Submit an invoice for completed bookings to initiate bank disbursement.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      padding: "16px 20px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", display: "block" }}>{inv.invoiceNumber}</strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Submitted on {new Date(inv.createdAt).toLocaleDateString()} • {inv.notes || "Fulfillment"}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>₹{inv.amount}</div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: inv.status === "PAID" ? "#059669" : inv.status === "APPROVED" ? "#2563eb" : "#d97706",
                        }}
                      >
                        {inv.status || "SUBMITTED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      {/* 1. Reject Task Modal */}
      {rejectingTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>Decline Booking Request</h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
              Please explain why your team is unable to fulfill this task:
            </p>
            <textarea
              rows={3}
              placeholder="e.g. No rooms/cabs available on requested dates..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", marginBottom: "16px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setRejectingTask(null)} style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectRequest}
                disabled={rejectingLoading}
                style={{ background: "#dc2626", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                {rejectingLoading ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Change Request Modal */}
      {changingTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>Request Adjustments to Booking</h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
              Specify date, time, vehicle, or room adjustments required:
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Can accommodate if check-in is shifted by 2 hours..."
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", marginBottom: "16px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setChangingTask(null)} style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeRequest}
                disabled={changingLoading}
                style={{ background: "#d97706", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                {changingLoading ? "Submitting..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Upload Voucher Modal */}
      {voucherTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>Upload Service Voucher & Reference</h3>
            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Confirmation Reference</label>
                <input
                  type="text"
                  placeholder="e.g. HTL-MNL-9921"
                  value={voucherRef}
                  onChange={(e) => setVoucherRef(e.target.value)}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Select Voucher File (PDF / PNG / JPG)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setVoucherFile(e.target.files ? e.target.files[0] : null)}
                  style={{ width: "100%", fontSize: "12px" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setVoucherTask(null)} style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadVoucher}
                disabled={uploadingVoucher}
                style={{ background: "#4f46e5", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                {uploadingVoucher ? "Uploading..." : "Save Voucher"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Service Modal */}
      {showAddService && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "520px", width: "100%", padding: "24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "17px" }}>Add New Bookable Service</h3>
            <form onSubmit={handleCreateService} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Service Category</label>
                  <select
                    value={newService.serviceType}
                    onChange={(e) => setNewService({ ...newService, serviceType: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                  >
                    <option value="Hotel">Hotel / Accommodation</option>
                    <option value="Cab">Cab / Transfer</option>
                    <option value="Transport">Bus / Transport</option>
                    <option value="Activity">Activity</option>
                    <option value="Sightseeing">Sightseeing</option>
                    <option value="Guide">Guide</option>
                    <option value="Meals">Meals / Food</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Rate / Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newService.rate}
                    onChange={(e) => setNewService({ ...newService, rate: Number(e.target.value) })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Service Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deluxe Pine View Room with Breakfast"
                  value={newService.title}
                  onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Old Manali, Himachal Pradesh"
                    value={newService.location}
                    onChange={(e) => setNewService({ ...newService, location: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Capacity (Persons/Vehicles)</label>
                  <input
                    type="number"
                    min={1}
                    value={newService.capacity}
                    onChange={(e) => setNewService({ ...newService, capacity: Number(e.target.value) })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Features, inclusions, pickup instructions..."
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddService(false)} style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingService} style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {savingService ? "Saving..." : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Document Modal */}
      {showAddDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "17px" }}>Upload Additional Document</h3>
            <form onSubmit={handleUploadNewDoc} style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="business_registration">Business Registration</option>
                  <option value="gst_certificate">GST Certificate</option>
                  <option value="tourism_license">Tourism License / Permit</option>
                  <option value="id_proof">Owner / Director ID Proof</option>
                  <option value="service_contract">Rate Sheet / Service Contract</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Updated GST Certificate 2026"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Select File (PDF, PNG, JPG)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                  style={{ width: "100%", fontSize: "12px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddDoc(false)} style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={uploadingDoc} style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {uploadingDoc ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Invoice Modal */}
      {showAddInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "17px" }}>Submit Fulfillment Invoice</h3>
            <form onSubmit={handleCreateInvoice} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={newInvoice.invoiceNumber}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Invoice Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Fulfillment Notes</label>
                <textarea
                  rows={2}
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddInvoice(false)} style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingInvoice} style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {savingInvoice ? "Submitting..." : "Submit Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
