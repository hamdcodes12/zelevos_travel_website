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
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Home,
  Users,
  MapPin,
  Star,
  Plane,
  Briefcase,
  CalendarDays,
  TrendingUp,
  ChevronDown,
  Car,
  Hotel,
  Phone,
  Compass,
  Utensils,
  Bus,
  Radio,
  Play,
  Square,
} from "lucide-react";
import { useLocation } from "wouter";
import { PasswordInput } from "@/components/ui/password-input";

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
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English");
  const [showLangMenu, setShowLangMenu] = useState(false);

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

  // Driver Live GPS Tracking State (Requirement 7)
  const [driverTrackingState, setDriverTrackingState] = useState<Record<string, {
    sessionId: string;
    watchId: number | null;
    status: "ACTIVE" | "STOPPED" | "ERROR" | "CONNECTING";
    errorMsg?: string;
    lastLatitude?: number;
    lastLongitude?: number;
    lastAccuracy?: number;
    lastSentAt?: string;
    updatesCount: number;
  }>>({});

  const handleDriverStartTrip = async (taskId: string) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Please use a device/browser with GPS support.");
      return;
    }

    try {
      setDriverTrackingState((prev) => ({
        ...prev,
        [taskId]: {
          sessionId: "",
          watchId: null,
          status: "CONNECTING",
          updatesCount: 0,
        },
      }));

      // 1. Fetch or initialize tracking session for this task
      const res = await fetch(`/api/vendor/portal/fulfillment-tasks/${taskId}/tracking`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.session) {
        throw new Error(data.message || "Failed to initialize tracking session.");
      }

      const sessionId = data.session.id;

      // 2. Start driver tracking on backend
      const startRes = await fetch(`/api/tracking/${sessionId}/driver/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const startData = await startRes.json();
      if (!startRes.ok && startData.status !== "invalid_state") {
        throw new Error(startData.message || "Could not activate driver tracking.");
      }

      // 3. Request real GPS watchPosition
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const heading = position.coords.heading ?? undefined;
          const speed = position.coords.speed ?? undefined;

          setDriverTrackingState((prev) => ({
            ...prev,
            [taskId]: {
              sessionId,
              watchId,
              status: "ACTIVE",
              lastLatitude: lat,
              lastLongitude: lng,
              lastAccuracy: accuracy,
              lastSentAt: new Date().toLocaleTimeString(),
              updatesCount: (prev[taskId]?.updatesCount || 0) + 1,
            },
          }));

          // Send real GPS to backend
          try {
            await fetch(`/api/tracking/${sessionId}/location`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                accuracy,
                heading: heading !== null && !isNaN(heading as number) ? heading : undefined,
                speed: speed !== null && !isNaN(speed as number) ? speed : undefined,
                recordedAt: new Date(position.timestamp).toISOString(),
              }),
            });
          } catch (err) {
            console.error("Failed to transmit GPS update:", err);
          }
        },
        (error) => {
          let msg = "GPS unavailable.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. Please allow device location to start live chauffeur tracking.";
          } else if (error.code === error.TIMEOUT) {
            msg = "GPS signal timeout. Trying to acquire satellite lock...";
          }
          setDriverTrackingState((prev) => ({
            ...prev,
            [taskId]: {
              ...(prev[taskId] || { sessionId, watchId: null, updatesCount: 0 }),
              status: "ERROR",
              errorMsg: msg,
            },
          }));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        }
      );

      setDriverTrackingState((prev) => ({
        ...prev,
        [taskId]: {
          sessionId,
          watchId,
          status: "ACTIVE",
          updatesCount: 0,
        },
      }));
    } catch (err: any) {
      setDriverTrackingState((prev) => ({
        ...prev,
        [taskId]: {
          sessionId: "",
          watchId: null,
          status: "ERROR",
          errorMsg: err.message || "Failed to start trip.",
          updatesCount: 0,
        },
      }));
    }
  };

  const handleDriverEndTrip = async (taskId: string) => {
    const tracking = driverTrackingState[taskId];
    if (tracking?.watchId !== null && tracking?.watchId !== undefined) {
      navigator.geolocation.clearWatch(tracking.watchId);
    }

    if (tracking?.sessionId) {
      try {
        await fetch(`/api/tracking/${tracking.sessionId}/driver/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
      } catch (e) {
        console.error("Failed to end driver tracking session:", e);
      }
    }

    setDriverTrackingState((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || { sessionId: "", watchId: null, updatesCount: 0 }),
        status: "STOPPED",
        watchId: null,
      },
    }));
  };

  useEffect(() => {
    return () => {
      Object.values(driverTrackingState).forEach((trk) => {
        if (trk.watchId !== null) {
          navigator.geolocation.clearWatch(trk.watchId);
        }
      });
    };
  }, [driverTrackingState]);

  // Add Invoice Modal
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    amount: 5000,
    bookingId: "",
    notes: "Fulfillment completed according to voucher instructions.",
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Fulfillment Tasks State
  const [fulfillmentTasks, setFulfillmentTasks] = useState<any[]>([]);
  const [arrangingTask, setArrangingTask] = useState<any | null>(null);
  const [arrangementForm, setArrangementForm] = useState<Record<string, any>>({});
  const [arrangementErrors, setArrangementErrors] = useState<Record<string, string>>({});
  const [submittingArrangement, setSubmittingArrangement] = useState(false);
  const [acceptingFulfillmentId, setAcceptingFulfillmentId] = useState<string | null>(null);
  const [decliningFulfillmentId, setDecliningFulfillmentId] = useState<string | null>(null);

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

  // Modal Escape and scroll-lock management
  const isAnyModalOpen = Boolean(rejectingTask || changingTask || voucherTask || showAddService || showAddDoc || showAddInvoice || arrangingTask);
  useEffect(() => {
    if (!isAnyModalOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (rejectingTask) {
          if (!rejectReason.trim() || window.confirm("Discard changes?")) setRejectingTask(null);
        } else if (changingTask) {
          if (!changeNotes.trim() || window.confirm("Discard changes?")) setChangingTask(null);
        } else if (voucherTask) {
          if ((!voucherRef.trim() && !voucherFile) || window.confirm("Discard changes?")) setVoucherTask(null);
        } else if (showAddService) {
          if ((!newService.title.trim() && !newService.location.trim()) || window.confirm("Discard changes?")) setShowAddService(false);
        } else if (showAddDoc) {
          if ((!docTitle.trim() && !docFile) || window.confirm("Discard changes?")) setShowAddDoc(false);
        } else if (showAddInvoice) {
          if ((!newInvoice.invoiceNumber.trim() && !newInvoice.notes.trim()) || window.confirm("Discard changes?")) setShowAddInvoice(false);
        } else if (arrangingTask) {
          if (window.confirm("Discard arrangement changes?")) setArrangingTask(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [isAnyModalOpen, rejectingTask, changingTask, voucherTask, showAddService, showAddDoc, showAddInvoice, arrangingTask, rejectReason, changeNotes, voucherRef, voucherFile, newService, docTitle, docFile, newInvoice]);

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
      const [dashRes, reqsRes, svcsRes, docsRes, invsRes, fulfillRes] = await Promise.all([
        fetch("/api/vendor/portal/dashboard", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/vendor/portal/requests", { credentials: "include" }).then((r) => (r.ok ? r.json() : { requests: [] })),
        fetch("/api/vendor/portal/services", { credentials: "include" }).then((r) => (r.ok ? r.json() : { services: [] })),
        fetch("/api/vendor/portal/documents", { credentials: "include" }).then((r) => (r.ok ? r.json() : { documents: [] })),
        fetch("/api/vendor/portal/invoices", { credentials: "include" }).then((r) => (r.ok ? r.json() : { invoices: [] })),
        fetch("/api/vendor/portal/fulfillment-tasks", { credentials: "include" }).then((r) => (r.ok ? r.json() : { tasks: [] })),
      ]);

      if (dashRes) {
        setDashboard(dashRes);
        if (dashRes.vendor) setVendorData(dashRes.vendor);
      }
      setRequests(Array.isArray(reqsRes?.requests) ? reqsRes.requests : []);
      setServices(Array.isArray(svcsRes?.services) ? svcsRes.services : []);
      setDocuments(Array.isArray(docsRes?.documents) ? docsRes.documents : []);
      setInvoices(Array.isArray(invsRes?.invoices) ? invsRes.invoices : []);
      setFulfillmentTasks(Array.isArray(fulfillRes?.tasks) ? fulfillRes.tasks : []);
    } catch (err: any) {
      showToast(err.message || "Failed to load portal records.");
    } finally {
      setLoading(false);
    }
  };

  // Indian Phone and Vehicle Regex
  const INDIAN_PHONE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;
  const INDIAN_VEHICLE_REG_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i;

  // Accept Fulfillment Task
  const handleAcceptFulfillmentTask = async (taskId: string) => {
    if (isSuspended) {
      showToast("Your supplier account is suspended and cannot accept tasks.");
      return;
    }
    setAcceptingFulfillmentId(taskId);
    try {
      const res = await fetch(`/api/vendor/portal/fulfillment-tasks/${taskId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept task.");
      showToast("Task accepted! Please fill arrangement details.");
      const updated = fulfillmentTasks.find((t) => t.id === taskId);
      if (updated) {
        setArrangingTask(updated);
        setArrangementForm(updated.details || {});
        setArrangementErrors({});
      }
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Failed to accept task.");
    } finally {
      setAcceptingFulfillmentId(null);
    }
  };

  // Decline Fulfillment Task
  const handleDeclineFulfillmentTask = async (taskId: string) => {
    const reason = window.prompt("Please provide a reason for declining this fulfillment task:");
    if (reason === null) return;
    setDecliningFulfillmentId(taskId);
    try {
      const res = await fetch(`/api/vendor/portal/fulfillment-tasks/${taskId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to decline task.");
      showToast("Task declined. Operations Desk notified for reassignment.");
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Failed to decline task.");
    } finally {
      setDecliningFulfillmentId(null);
    }
  };

  // Submit Arrangement Form
  const handleSubmitArrangement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arrangingTask) return;
    const errors: Record<string, string> = {};
    const type = (arrangingTask.componentType || "").toUpperCase();

    if (type === "HOTEL") {
      if (!arrangementForm.hotelName?.trim()) {
        errors.hotelName = "Hotel name is required.";
      }
      if (!arrangementForm.fullAddress?.trim()) {
        errors.fullAddress = "Hotel full address is required.";
      }
      if (arrangementForm.hotelPhone && !INDIAN_PHONE_REGEX.test(arrangementForm.hotelPhone.replace(/\s+/g, ""))) {
        errors.hotelPhone = "Enter a valid 10-digit Indian mobile or landline number (e.g. 9876543210).";
      }
    } else if (type === "CAB") {
      if (!arrangementForm.driverName?.trim()) {
        errors.driverName = "Chauffeur / Driver name is required.";
      }
      if (!arrangementForm.driverPhone?.trim() || !INDIAN_PHONE_REGEX.test(arrangementForm.driverPhone.replace(/\s+/g, ""))) {
        errors.driverPhone = "Valid 10-digit Indian driver mobile number is required (e.g. 9876543210 or +919876543210).";
      }
      if (!arrangementForm.vehicleRegistrationNumber?.trim() || !INDIAN_VEHICLE_REG_REGEX.test(arrangementForm.vehicleRegistrationNumber.replace(/\s+/g, ""))) {
        errors.vehicleRegistrationNumber = "Valid Indian vehicle registration number is required (e.g. JK01AB1234 or DL1CAB1234).";
      }
    } else if (type === "BUS") {
      if (!arrangementForm.operatorName?.trim()) {
        errors.operatorName = "Bus operator name is required.";
      }
      if (arrangementForm.busRegistrationNumber && !INDIAN_VEHICLE_REG_REGEX.test(arrangementForm.busRegistrationNumber.replace(/\s+/g, ""))) {
        errors.busRegistrationNumber = "Valid Indian vehicle registration number is required.";
      }
    } else if (type === "GUIDE") {
      if (!arrangementForm.guideName?.trim()) {
        errors.guideName = "Tour guide name is required.";
      }
      if (arrangementForm.phone && !INDIAN_PHONE_REGEX.test(arrangementForm.phone.replace(/\s+/g, ""))) {
        errors.phone = "Valid Indian phone number is required.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setArrangementErrors(errors);
      return;
    }

    setSubmittingArrangement(true);
    try {
      const res = await fetch(`/api/vendor/portal/fulfillment-tasks/${arrangingTask.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ details: arrangementForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit arrangement details.");

      showToast("Arrangement details submitted to Operations Desk!");
      setArrangingTask(null);
      setArrangementForm({});
      setArrangementErrors({});
      loadPortalData();
    } catch (err: any) {
      showToast(err.message || "Failed to submit arrangement.");
    } finally {
      setSubmittingArrangement(false);
    }
  };

  // Accept Booking Request
  const handleAcceptRequest = async (taskId: string) => {
    if (isSuspended) {
      showToast("Your supplier account is suspended and cannot accept tasks. Contact support@zelevos.com.");
      return;
    }
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
      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          overflowX: "hidden",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#0F172A",
          backgroundColor: "#F8FAFC",
          backgroundImage: "url('/vendor-hero-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "right top",
          backgroundAttachment: "fixed",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Soft Background Overlays for readability and magazine aesthetic */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.92) 42%, rgba(255, 255, 255, 0.55) 68%, rgba(255, 255, 255, 0.15) 88%, rgba(255, 255, 255, 0) 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 12%, rgba(255, 255, 255, 0) 35%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Top Navbar */}
        <header
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 48px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Brand Logo & Tagline */}
          <div
            onClick={() => setLocation("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <img
              src="/vendor-logo-transparent.png"
              alt="Zelevos"
              style={{
                height: "46px",
                width: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 4px 10px rgba(37, 99, 235, 0.2))",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: "25px",
                  fontWeight: 900,
                  color: "#0F172A",
                  letterSpacing: "-0.6px",
                  lineHeight: 1,
                }}
              >
                Zelevos
              </div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  color: "#64748B",
                  letterSpacing: "1.8px",
                  textTransform: "uppercase",
                  marginTop: "3px",
                }}
              >
                TRAVEL BEYOND BORDERS
              </div>
            </div>
          </div>

          {/* Navigation Controls: Language & Back to Website */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", position: "relative" }}>
            {/* Language Selector */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(255, 255, 255, 0.92)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(226, 232, 240, 0.9)",
                  padding: "9px 16px",
                  borderRadius: "9999px",
                  boxShadow: "0 3px 10px rgba(0, 0, 0, 0.03)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <Globe size={15} color="#475569" />
                <span>{selectedLang}</span>
                <ChevronDown size={14} color="#64748B" />
              </button>

              {/* Language Dropdown Menu */}
              {showLangMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "8px",
                    background: "#ffffff",
                    borderRadius: "14px",
                    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
                    border: "1px solid #E2E8F0",
                    padding: "6px",
                    minWidth: "140px",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {["English", "Español", "Français", "Deutsch", "Hindi"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        setSelectedLang(lang);
                        setShowLangMenu(false);
                      }}
                      style={{
                        background: selectedLang === lang ? "#EFF6FF" : "transparent",
                        color: selectedLang === lang ? "#2563EB" : "#334155",
                        fontWeight: selectedLang === lang ? 700 : 500,
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        textAlign: "left",
                        fontSize: "13px",
                        cursor: "pointer",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{lang}</span>
                      {selectedLang === lang && <Check size={14} color="#2563EB" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Back to Website Button */}
            <button
              type="button"
              onClick={() => setLocation("/")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.9)",
                padding: "9px 20px",
                borderRadius: "9999px",
                boxShadow: "0 3px 10px rgba(0, 0, 0, 0.03)",
                fontSize: "13px",
                fontWeight: 700,
                color: "#1E293B",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 3px 10px rgba(0, 0, 0, 0.03)";
              }}
            >
              <Home size={15} color="#2563EB" />
              <span>Back to Website</span>
            </button>
          </div>
        </header>

        {/* Main Content Body */}
        <main
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            alignItems: "center",
            padding: "10px 48px 40px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1360px",
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "40px",
            }}
          >
            {/* Left Column: Brand Headline, Stats & Features */}
            <div
              style={{
                flex: "1 1 540px",
                maxWidth: "680px",
                paddingTop: "10px",
              }}
            >
              {/* Badge: —— VENDOR PORTAL —— */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "16px",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "2px",
                    background: "#3B82F6",
                    borderRadius: "2px",
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#3B82F6",
                    letterSpacing: "2.5px",
                    textTransform: "uppercase",
                  }}
                >
                  VENDOR PORTAL
                </span>
                <span
                  style={{
                    width: "28px",
                    height: "2px",
                    background: "#3B82F6",
                    borderRadius: "2px",
                  }}
                />
              </div>

              {/* Main Headline */}
              <h1
                style={{
                  fontSize: "clamp(36px, 4.4vw, 56px)",
                  fontWeight: 900,
                  lineHeight: 1.12,
                  color: "#0F172A",
                  letterSpacing: "-1.5px",
                  margin: "0 0 16px 0",
                }}
              >
                Let's Create <br />
                <span
                  style={{
                    background: "linear-gradient(135deg, #2563EB 0%, #8B5CF6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    display: "inline-block",
                  }}
                >
                  Unforgettable
                </span>{" "}
                <br />
                Travel Experiences
              </h1>

              {/* Description */}
              <p
                style={{
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: "#475569",
                  maxWidth: "520px",
                  margin: "0 0 28px 0",
                  fontWeight: 500,
                }}
              >
                Join Zelevos as an approved travel supplier and partner with us to serve travelers worldwide.
              </p>

              {/* Three Stat Badges Row */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "14px",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                {/* 500+ Travel Partners */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(12px)",
                    padding: "10px 18px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#EFF6FF",
                      display: "grid",
                      placeItems: "center",
                      color: "#2563EB",
                    }}
                  >
                    <Users size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>500+</div>
                    <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>Travel Partners</div>
                  </div>
                </div>

                {/* 50+ Destinations */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(12px)",
                    padding: "10px 18px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#E0F2FE",
                      display: "grid",
                      placeItems: "center",
                      color: "#0284C7",
                    }}
                  >
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>50+</div>
                    <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>Destinations</div>
                  </div>
                </div>

                {/* 10K+ Happy Travelers */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(12px)",
                    padding: "10px 18px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#FEF3C7",
                      display: "grid",
                      placeItems: "center",
                      color: "#D97706",
                    }}
                  >
                    <Star size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>10K+</div>
                    <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>Happy Travelers</div>
                  </div>
                </div>
              </div>

              {/* Handwritten signature with flourish & Trusted by Zelevos card */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "24px",
                  marginBottom: "28px",
                }}
              >
                {/* Cursive handwritten phrase */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    transform: "rotate(-3deg)",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Caveat', cursive, sans-serif",
                      fontSize: "28px",
                      fontWeight: 700,
                      color: "#1E293B",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Together We Explore More
                  </span>
                  <svg
                    width="44"
                    height="24"
                    viewBox="0 0 44 24"
                    fill="none"
                    style={{ color: "#2563EB", transform: "rotate(-4deg)" }}
                  >
                    <path
                      d="M3 14C14 20 30 17 40 7M40 7L31 7M40 7L37 15"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Floating "Trusted by Zelevos" Card */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "rgba(255, 255, 255, 0.92)",
                    backdropFilter: "blur(14px)",
                    padding: "10px 18px",
                    borderRadius: "18px",
                    border: "1px solid rgba(255, 255, 255, 0.95)",
                    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#EFF6FF",
                      display: "grid",
                      placeItems: "center",
                      color: "#2563EB",
                      flexShrink: 0,
                    }}
                  >
                    <Plane size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
                      Trusted by Zelevos
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
                      Hotels • Cabs • Activities • Transfers • More
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Bottom Feature Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "12px",
                  maxWidth: "640px",
                  width: "100%",
                }}
              >
                {/* 1. Manage Bookings */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(10px)",
                    padding: "16px 14px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 4px 15px rgba(15, 23, 42, 0.03)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: "#DCFCE7",
                      display: "grid",
                      placeItems: "center",
                      color: "#16A34A",
                      marginBottom: "10px",
                    }}
                  >
                    <CalendarDays size={18} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "3px" }}>
                    Manage Bookings
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.35 }}>
                    View & confirm assigned bookings
                  </div>
                </div>

                {/* 2. Provide Services */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(10px)",
                    padding: "16px 14px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 4px 15px rgba(15, 23, 42, 0.03)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: "#FEF3C7",
                      display: "grid",
                      placeItems: "center",
                      color: "#D97706",
                      marginBottom: "10px",
                    }}
                  >
                    <Briefcase size={18} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "3px" }}>
                    Provide Services
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.35 }}>
                    Update service status & details
                  </div>
                </div>

                {/* 3. Upload Vouchers */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(10px)",
                    padding: "16px 14px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 4px 15px rgba(15, 23, 42, 0.03)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: "#EFF6FF",
                      display: "grid",
                      placeItems: "center",
                      color: "#2563EB",
                      marginBottom: "10px",
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "3px" }}>
                    Upload Vouchers
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.35 }}>
                    Share tickets, vouchers & invoices
                  </div>
                </div>

                {/* 4. Grow Your Business */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(10px)",
                    padding: "16px 14px",
                    borderRadius: "18px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 4px 15px rgba(15, 23, 42, 0.03)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: "#F3E8FF",
                      display: "grid",
                      placeItems: "center",
                      color: "#9333EA",
                      marginBottom: "10px",
                    }}
                  >
                    <TrendingUp size={18} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "3px" }}>
                    Grow Your Business
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.35 }}>
                    Get more bookings and opportunities
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: High-End Floating Login Card */}
            <div
              style={{
                flex: "0 0 450px",
                maxWidth: "460px",
                width: "100%",
                boxSizing: "border-box",
                background: "#FFFFFF",
                borderRadius: "28px",
                boxShadow:
                  "0 25px 60px -15px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(226, 232, 240, 0.8)",
                padding: "36px 34px",
                position: "relative",
              }}
            >
              {/* Login Card Header with Gradient App Icon */}
              <div style={{ textAlign: "center", marginBottom: "26px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                    display: "grid",
                    placeItems: "center",
                    color: "#FFFFFF",
                    margin: "0 auto 16px",
                    boxShadow: "0 10px 22px rgba(99, 102, 241, 0.35)",
                  }}
                >
                  <Building2 size={28} />
                </div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    margin: "0 0 6px",
                    color: "#0F172A",
                    letterSpacing: "-0.5px",
                  }}
                >
                  Zelevos <span style={{ color: "#7C3AED" }}>Vendor Portal</span>
                </h2>
                <p style={{ fontSize: "13px", color: "#64748B", margin: 0, fontWeight: 500 }}>
                  Official access for approved travel suppliers & operators
                </p>
              </div>

              {/* Login Error Notification */}
              {loginError && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#B91C1C",
                    fontSize: "13px",
                    lineHeight: 1.4,
                  }}
                >
                  <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleVendorLogin} style={{ display: "grid", gap: "18px" }}>
                {/* Email Field with Icon */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "6px",
                    }}
                  >
                    Registered Supplier Email
                  </label>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94A3B8",
                        display: "flex",
                        alignItems: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="vendor@travelservice.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      style={{
                        width: "100%",
                        height: "46px",
                        paddingLeft: "42px",
                        paddingRight: "14px",
                        borderRadius: "12px",
                        border: "1px solid #CBD5E1",
                        fontSize: "14px",
                        color: "#0F172A",
                        background: "#FFFFFF",
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#2563EB";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#CBD5E1";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </div>

                {/* Password Field with Icon and Eye Toggle */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <label
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#334155",
                      }}
                    >
                      Password
                    </label>
                    <a
                      href="/forgot-password"
                      style={{
                        fontSize: "12px",
                        color: "#6366F1",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94A3B8",
                        display: "flex",
                        alignItems: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <Lock size={18} />
                    </div>
                    <PasswordInput
                      id="vendor-login-password"
                      required
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      style={{
                        width: "100%",
                        height: "46px",
                        paddingLeft: "42px",
                        paddingRight: "42px",
                        borderRadius: "12px",
                        border: "1px solid #CBD5E1",
                        fontSize: "14px",
                        color: "#0F172A",
                        background: "#FFFFFF",
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#2563EB";
                        e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#CBD5E1";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </div>

                {/* Sign in Button with Gradient */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    background: "linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    height: "48px",
                    borderRadius: "12px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: loginLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginTop: "4px",
                    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.3)",
                    transition: "all 0.2s ease",
                    opacity: loginLoading ? 0.75 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!loginLoading) {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 10px 25px rgba(37, 99, 235, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 8px 22px rgba(37, 99, 235, 0.3)";
                  }}
                >
                  <span>{loginLoading ? "Authenticating..." : "Sign in to Vendor Portal"}</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              {/* OR Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: "18px 0",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#94A3B8",
                    letterSpacing: "1px",
                  }}
                >
                  OR
                </span>
                <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
              </div>

              {/* Sign in with Google Button */}
              <button
                type="button"
                onClick={() => showToast("Google SSO will be available soon. Please use your supplier credentials.")}
                style={{
                  width: "100%",
                  height: "46px",
                  borderRadius: "12px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  color: "#1E293B",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.02)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#CBD5E1";
                  e.currentTarget.style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.background = "#FFFFFF";
                }}
              >
                {/* Official Google 4-Color Icon */}
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              {/* Secure & Protected Notice */}
              <div
                style={{
                  marginTop: "20px",
                  background: "#F0F7FF",
                  border: "1px solid #DBEAFE",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#DBEAFE",
                    display: "grid",
                    placeItems: "center",
                    color: "#2563EB",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3A8A" }}>
                    Secure & Protected
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.35 }}>
                    Your data and access are protected with industry-standard security measures.
                  </div>
                </div>
              </div>

              {/* Bottom Register Redirect Link */}
              <div
                style={{
                  marginTop: "22px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#64748B",
                }}
              >
                <span>Not yet a verified supplier? </span>
                <button
                  type="button"
                  onClick={() => setLocation("/become-a-supplier")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563EB",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  <span>Apply to become a supplier</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </main>
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
        {/* Suspended Warning Banner */}
        {isSuspended && (
          <div
            id="supplier-suspended-banner"
            style={{
              background: "#fef2f2",
              border: "2px solid #ef4444",
              borderRadius: "14px",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              color: "#991b1b",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.12)",
            }}
          >
            <AlertTriangle size={28} color="#dc2626" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: "16px", display: "block", color: "#991b1b" }}>
                {vendorData?.suspensionType === "PERMANENT"
                  ? "Your account has been permanently suspended."
                  : vendorData?.suspensionUntil
                  ? `Your account is suspended until ${new Date(vendorData.suspensionUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
                  : "Your account is temporarily suspended"}
              </strong>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#b91c1c", lineHeight: 1.5 }}>
                (Reason: {vendorData?.suspensionReason || "Administrative review"}). New booking task acceptance is paused while suspended. Contact support at <a href="mailto:support@zelevos.com" style={{ color: "#991b1b", fontWeight: 700, textDecoration: "underline" }}>support@zelevos.com</a> if you have questions.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", flexWrap: "wrap" }}>
          {[
            { id: "dashboard", label: "Overview & Metrics", icon: Layers },
            { id: "requests", label: `Booking Tasks (${requests.length + fulfillmentTasks.length})`, icon: Clock },
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
          <div style={{ display: "grid", gap: "24px" }}>
            {/* Trip Fulfillment Tasks (Workflow Engine) */}
            <div style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Trip Fulfillment Tasks</h2>
                    <span style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 700, border: "1px solid #bfdbfe" }}>
                      Direct Booking Dispatch ({fulfillmentTasks.length})
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
                    Fulfill confirmed customer bookings assigned by Zelevos Operations Desk. Accept tasks, enter confirmed details, and submit for verification.
                  </p>
                </div>
              </div>

              {fulfillmentTasks.length === 0 ? (
                <div style={{ background: "#ffffff", padding: "32px", borderRadius: "14px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                  <Clock size={32} style={{ margin: "0 auto 10px", color: "#cbd5e1" }} />
                  <strong style={{ fontSize: "14px", display: "block", color: "#0f172a" }}>No pending fulfillment tasks</strong>
                  <p style={{ fontSize: "12px", margin: "4px 0 0" }}>When Zelevos Operations assigns a hotel, cab, or tour task to your account, it will appear here.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {fulfillmentTasks.map((task) => {
                    const type = (task.componentType || "").toUpperCase();
                    const d = task.details || {};
                    const isApproved = task.status === "APPROVED";
                    const isSubmitted = task.status === "SUBMITTED";
                    const isPending = task.status === "PENDING";

                    return (
                      <div
                        key={task.id}
                        id={`vendor-fulfillment-task-${task.id}`}
                        style={{
                          background: "#ffffff",
                          borderRadius: "14px",
                          padding: "20px",
                          border: isApproved ? "1.5px solid #a7f3d0" : isSubmitted ? "1.5px solid #fde68a" : "1px solid #e2e8f0",
                          display: "grid",
                          gap: "14px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                        }}
                      >
                        {/* Task Top Row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: type === "HOTEL" ? "#eff6ff" : type === "CAB" ? "#fef3c7" : type === "GUIDE" ? "#f5f3ff" : "#f1f5f9",
                                color: type === "HOTEL" ? "#2563eb" : type === "CAB" ? "#d97706" : type === "GUIDE" ? "#7c3aed" : "#475569",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {type === "HOTEL" ? <Hotel size={18} /> : type === "CAB" ? <Car size={18} /> : type === "GUIDE" ? <Compass size={18} /> : type === "BUS" ? <Bus size={18} /> : <Briefcase size={18} />}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ background: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                  {type}
                                </span>
                                <strong style={{ fontSize: "15px", color: "#0f172a" }}>{task.title}</strong>
                              </div>
                              <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
                                Booking Ref: <strong>{task.bookingRef || "Direct Assignment"}</strong> • Destination: <strong>{task.destination || "Kashmir"}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span
                            style={{
                              background: isApproved ? "#ecfdf5" : isSubmitted ? "#fffbeb" : "#eff6ff",
                              color: isApproved ? "#059669" : isSubmitted ? "#d97706" : "#2563eb",
                              padding: "4px 12px",
                              borderRadius: "9999px",
                              fontSize: "12px",
                              fontWeight: 700,
                              border: `1px solid ${isApproved ? "#a7f3d0" : isSubmitted ? "#fde68a" : "#bfdbfe"}`,
                            }}
                          >
                            {isApproved ? "Approved by Admin" : isSubmitted ? "Submitted (Under Admin Review)" : "Pending Action"}
                          </span>
                        </div>

                        {/* Booking Context (NO customer email / phone) */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "12px", background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                          <div>
                            <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>TRAVEL DATE</span>
                            <strong style={{ color: "#1e293b" }}>{task.travelDate || "Flexible"}</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>PARTY SIZE</span>
                            <strong style={{ color: "#1e293b" }}>{task.totalTravellers} Guests ({task.adultsCount || 1} Adults, {task.childrenCount || 0} Children)</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>SPECIAL REQUIREMENTS</span>
                            <span style={{ color: "#334155" }}>{task.tripRequirements || "Standard tour package inclusions"}</span>
                          </div>
                        </div>

                        {/* Privacy Banner */}
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#166534", display: "flex", alignItems: "center", gap: "8px" }}>
                          <ShieldCheck size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                          <span><strong>Confidential Dispatch:</strong> Customer phone number and email are handled exclusively by Zelevos Operations Desk.</span>
                        </div>

                        {/* Current Arrangement Summary (if already filled) */}
                        {(d.hotelName || d.driverName || d.vehicleRegistrationNumber || d.guideName) && (
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", fontSize: "12px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>
                              CURRENT ARRANGEMENT DETAILS:
                            </span>
                            {type === "HOTEL" && (
                              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#1e293b" }}>
                                <span>Hotel: <strong>{d.hotelName}</strong></span>
                                {d.roomType && <span>Room: <strong>{d.roomType}</strong></span>}
                                {d.confirmationNumber && <span>Conf Ref: <strong>{d.confirmationNumber}</strong></span>}
                                {d.hotelPhone && <span>Phone: <strong>{d.hotelPhone}</strong></span>}
                              </div>
                            )}
                            {type === "CAB" && (
                              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#1e293b" }}>
                                <span>Driver: <strong>{d.driverName}</strong></span>
                                <span>Driver Phone: <strong>{d.driverPhone}</strong></span>
                                <span>Vehicle: <strong>{d.vehicleModel || "Sedan/SUV"}</strong></span>
                                <span>Reg No: <strong>{d.vehicleRegistrationNumber}</strong></span>
                              </div>
                            )}
                            {type === "GUIDE" && (
                              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#1e293b" }}>
                                <span>Guide: <strong>{d.guideName}</strong></span>
                                {d.phone && <span>Phone: <strong>{d.phone}</strong></span>}
                                {d.meetingPoint && <span>Meeting: <strong>{d.meetingPoint}</strong></span>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Chauffeur Live GPS Tracking (CAB Component Requirement 7) */}
                        {type === "CAB" && (
                          <div
                            id={`chauffeur-gps-box-${task.id}`}
                            style={{
                              background: driverTrackingState[task.id]?.status === "ACTIVE" ? "#f0fdf4" : "#f8fafc",
                              border: `1.5px solid ${driverTrackingState[task.id]?.status === "ACTIVE" ? "#86efac" : "#e2e8f0"}`,
                              borderRadius: "10px",
                              padding: "14px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Radio
                                  size={16}
                                  color={driverTrackingState[task.id]?.status === "ACTIVE" ? "#16a34a" : "#64748b"}
                                  style={{ animation: driverTrackingState[task.id]?.status === "ACTIVE" ? "pulse 1.5s infinite" : "none" }}
                                />
                                <div>
                                  <strong style={{ fontSize: "13px", color: driverTrackingState[task.id]?.status === "ACTIVE" ? "#166534" : "#1e293b" }}>
                                    CHAUFFEUR LIVE TRIP GPS TELEMETRY
                                  </strong>
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                                    Stream real vehicle coordinates to customer Live Trip view and Zelevos Ops Desk
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {driverTrackingState[task.id]?.status === "ACTIVE" ? (
                                  <button
                                    type="button"
                                    id={`end-driver-trip-btn-${task.id}`}
                                    onClick={() => handleDriverEndTrip(task.id)}
                                    style={{
                                      background: "#dc2626",
                                      color: "#ffffff",
                                      border: "none",
                                      padding: "8px 16px",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                                    }}
                                  >
                                    <Square size={13} fill="#ffffff" />
                                    <span>END TRIP</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    id={`start-driver-trip-btn-${task.id}`}
                                    onClick={() => handleDriverStartTrip(task.id)}
                                    disabled={driverTrackingState[task.id]?.status === "CONNECTING"}
                                    style={{
                                      background: "#16a34a",
                                      color: "#ffffff",
                                      border: "none",
                                      padding: "8px 16px",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
                                    }}
                                  >
                                    <Play size={13} fill="#ffffff" />
                                    <span>{driverTrackingState[task.id]?.status === "CONNECTING" ? "Acquiring GPS..." : "START TRIP"}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {driverTrackingState[task.id]?.status === "ACTIVE" && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  padding: "8px 12px",
                                  background: "#ffffff",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: "6px",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "14px",
                                  fontSize: "12px",
                                  color: "#166534",
                                }}
                              >
                                <span>Status: <strong style={{ color: "#16a34a" }}>● LIVE (Broadcasting)</strong></span>
                                <span>Real Coords: <strong>{driverTrackingState[task.id].lastLatitude?.toFixed(5)}, {driverTrackingState[task.id].lastLongitude?.toFixed(5)}</strong></span>
                                <span>Accuracy: <strong>±{Math.round(driverTrackingState[task.id].lastAccuracy || 0)}m</strong></span>
                                <span>Transmitted Updates: <strong>{driverTrackingState[task.id].updatesCount}</strong></span>
                                <span>Last Sent: <strong>{driverTrackingState[task.id].lastSentAt}</strong></span>
                              </div>
                            )}

                            {driverTrackingState[task.id]?.status === "ERROR" && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  padding: "8px 12px",
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  color: "#dc2626",
                                }}
                              >
                                ⚠ {driverTrackingState[task.id].errorMsg}
                              </div>
                            )}

                            {driverTrackingState[task.id]?.status === "STOPPED" && (
                              <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
                                ✓ Trip concluded. Real GPS transmission is stopped.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                id={`accept-fulfillment-task-btn-${task.id}`}
                                onClick={() => handleAcceptFulfillmentTask(task.id)}
                                disabled={isSuspended || acceptingFulfillmentId === task.id}
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
                                <span>{acceptingFulfillmentId === task.id ? "Accepting..." : "Accept Task"}</span>
                              </button>

                              <button
                                type="button"
                                id={`decline-fulfillment-task-btn-${task.id}`}
                                onClick={() => handleDeclineFulfillmentTask(task.id)}
                                disabled={isSuspended || decliningFulfillmentId === task.id}
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
                            </>
                          )}

                          {/* Fill / Edit Arrangement Details */}
                          <button
                            type="button"
                            id={`fill-arrangement-details-btn-${task.id}`}
                            onClick={() => {
                              setArrangingTask(task);
                              setArrangementForm(task.details || {});
                              setArrangementErrors({});
                            }}
                            style={{
                              background: isApproved ? "#f1f5f9" : "#0f172a",
                              color: isApproved ? "#334155" : "#ffffff",
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
                            <FileText size={14} />
                            <span>{isApproved ? "View Arrangement Details" : isSubmitted ? "Edit Arrangement Details" : "Fill Arrangement Details"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* General Service Allocation Requests (Existing) */}
            <div style={{ display: "grid", gap: "14px", marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 2px" }}>Other Service Requests</h3>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>General inventory allocations and ad-hoc supplier tasks.</p>
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
                            disabled={isSuspended || acceptingId === req.id}
                            title={isSuspended ? "Account suspended — cannot accept tasks" : ""}
                            style={{
                              background: isSuspended ? "#94a3b8" : "#059669",
                              color: "#ffffff",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: isSuspended ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              opacity: isSuspended ? 0.6 : 1,
                            }}
                          >
                            <Check size={14} />
                            <span>{acceptingId === req.id ? "Accepting..." : isSuspended ? "Accept Disabled (Suspended)" : "Accept & Confirm"}</span>
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (rejectReason.trim() && !window.confirm("Discard changes?")) return;
              setRejectingTask(null);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Decline Booking Request</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if (rejectReason.trim() && !window.confirm("Discard changes?")) return;
                  setRejectingTask(null);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
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
              <button
                type="button"
                onClick={() => {
                  if (rejectReason.trim() && !window.confirm("Discard changes?")) return;
                  setRejectingTask(null);
                }}
                style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
              >
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (changeNotes.trim() && !window.confirm("Discard changes?")) return;
              setChangingTask(null);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Request Adjustments to Booking</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if (changeNotes.trim() && !window.confirm("Discard changes?")) return;
                  setChangingTask(null);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
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
              <button
                type="button"
                onClick={() => {
                  if (changeNotes.trim() && !window.confirm("Discard changes?")) return;
                  setChangingTask(null);
                }}
                style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
              >
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if ((voucherRef.trim() || voucherFile) && !window.confirm("Discard changes?")) return;
              setVoucherTask(null);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Upload Service Voucher & Reference</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if ((voucherRef.trim() || voucherFile) && !window.confirm("Discard changes?")) return;
                  setVoucherTask(null);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
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
              <button
                type="button"
                onClick={() => {
                  if ((voucherRef.trim() || voucherFile) && !window.confirm("Discard changes?")) return;
                  setVoucherTask(null);
                }}
                style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
              >
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if ((newService.title.trim() || newService.location.trim()) && !window.confirm("Discard changes?")) return;
              setShowAddService(false);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "520px", width: "100%", padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Add New Bookable Service</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if ((newService.title.trim() || newService.location.trim()) && !window.confirm("Discard changes?")) return;
                  setShowAddService(false);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={() => {
                    if ((newService.title.trim() || newService.location.trim()) && !window.confirm("Discard changes?")) return;
                    setShowAddService(false);
                  }}
                  style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                >
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if ((docTitle.trim() || docFile) && !window.confirm("Discard changes?")) return;
              setShowAddDoc(false);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Upload Additional Document</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if ((docTitle.trim() || docFile) && !window.confirm("Discard changes?")) return;
                  setShowAddDoc(false);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={() => {
                    if ((docTitle.trim() || docFile) && !window.confirm("Discard changes?")) return;
                    setShowAddDoc(false);
                  }}
                  style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                >
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if ((newInvoice.invoiceNumber.trim() || newInvoice.notes.trim()) && !window.confirm("Discard changes?")) return;
              setShowAddInvoice(false);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100, padding: "20px" }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Submit Fulfillment Invoice</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if ((newInvoice.invoiceNumber.trim() || newInvoice.notes.trim()) && !window.confirm("Discard changes?")) return;
                  setShowAddInvoice(false);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={() => {
                    if ((newInvoice.invoiceNumber.trim() || newInvoice.notes.trim()) && !window.confirm("Discard changes?")) return;
                    setShowAddInvoice(false);
                  }}
                  style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                >
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

      {/* 7. Trip Fulfillment Arrangement Modal */}
      {arrangingTask && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (window.confirm("Discard changes to arrangement details?")) setArrangingTask(null);
            }
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 110, padding: "20px" }}
        >
          <div
            id="vendor-arrangement-modal"
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              position: "relative",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#0f172a", color: "#ffffff", display: "grid", placeItems: "center" }}>
                  {(arrangingTask.componentType || "").toUpperCase() === "HOTEL" ? <Hotel size={18} /> : (arrangingTask.componentType || "").toUpperCase() === "CAB" ? <Car size={18} /> : <FileText size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>
                    Fill Arrangement Details — {arrangingTask.componentType}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Booking Ref: {arrangingTask.bookingRef || "—"} • {arrangingTask.destination || "Kashmir"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  if (window.confirm("Discard changes to arrangement details?")) setArrangingTask(null);
                }}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "6px", borderRadius: "50%", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Confidential Dispatch Context Banner */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px", fontSize: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <div><span style={{ color: "#64748b" }}>Travel Date:</span> <strong>{arrangingTask.travelDate || "Scheduled Date"}</strong></div>
                <div><span style={{ color: "#64748b" }}>Guests:</span> <strong>{arrangingTask.totalTravellers} Travellers ({arrangingTask.adultsCount || 1} Adults, {arrangingTask.childrenCount || 0} Children)</strong></div>
              </div>
              {arrangingTask.tripRequirements && (
                <div style={{ color: "#475569", marginBottom: "6px" }}>
                  <strong>Trip Requirements:</strong> {arrangingTask.tripRequirements}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", background: "#f0fdf4", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                <ShieldCheck size={14} color="#16a34a" />
                <span>Confidential Dispatch: Customer contact details are handled exclusively by Zelevos Operations.</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitArrangement} style={{ display: "grid", gap: "14px" }}>
              {/* 1. HOTEL FORM */}
              {(arrangingTask.componentType || "").toUpperCase() === "HOTEL" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Hotel / Resort Name *
                    </label>
                    <input
                      type="text"
                      id="vendor-hotel-name-input"
                      required
                      placeholder="e.g. The Grand Dragon Hotel & Suites"
                      value={arrangementForm.hotelName || ""}
                      onChange={(e) => {
                        setArrangementForm({ ...arrangementForm, hotelName: e.target.value });
                        if (arrangementErrors.hotelName) setArrangementErrors({ ...arrangementErrors, hotelName: "" });
                      }}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${arrangementErrors.hotelName ? "#dc2626" : "#cbd5e1"}`, fontSize: "13px" }}
                    />
                    {arrangementErrors.hotelName && <span style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px", display: "block" }}>{arrangementErrors.hotelName}</span>}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Full Property Address * (Used for Google Maps & Voucher)
                    </label>
                    <input
                      type="text"
                      id="vendor-hotel-address-input"
                      required
                      placeholder="e.g. Boulevard Road, Opposite Ghat No. 7, Dal Lake, Srinagar, Kashmir 190001"
                      value={arrangementForm.fullAddress || ""}
                      onChange={(e) => {
                        setArrangementForm({ ...arrangementForm, fullAddress: e.target.value });
                        if (arrangementErrors.fullAddress) setArrangementErrors({ ...arrangementErrors, fullAddress: "" });
                      }}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${arrangementErrors.fullAddress ? "#dc2626" : "#cbd5e1"}`, fontSize: "13px" }}
                    />
                    {arrangementErrors.fullAddress && <span style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px", display: "block" }}>{arrangementErrors.fullAddress}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Hotel Front Desk Phone
                      </label>
                      <input
                        type="text"
                        id="vendor-hotel-phone-input"
                        placeholder="e.g. +91 98765 43210 or 01942456789"
                        value={arrangementForm.hotelPhone || ""}
                        onChange={(e) => {
                          setArrangementForm({ ...arrangementForm, hotelPhone: e.target.value });
                          if (arrangementErrors.hotelPhone) setArrangementErrors({ ...arrangementErrors, hotelPhone: "" });
                        }}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${arrangementErrors.hotelPhone ? "#dc2626" : "#cbd5e1"}`, fontSize: "13px" }}
                      />
                      {arrangementErrors.hotelPhone && <span style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px", display: "block" }}>{arrangementErrors.hotelPhone}</span>}
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Room Category / Type
                      </label>
                      <input
                        type="text"
                        id="vendor-hotel-room-type-input"
                        placeholder="e.g. Deluxe Valley View Room"
                        value={arrangementForm.roomType || ""}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, roomType: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Number of Rooms
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={arrangementForm.numberOfRooms || 1}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, numberOfRooms: Number(e.target.value) })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Check-in Time
                      </label>
                      <input
                        type="text"
                        placeholder="14:00"
                        value={arrangementForm.checkInTime || "14:00"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, checkInTime: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Check-out Time
                      </label>
                      <input
                        type="text"
                        placeholder="11:00"
                        value={arrangementForm.checkOutTime || "11:00"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, checkOutTime: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Meal Plan
                      </label>
                      <select
                        value={arrangementForm.mealPlan || "CP (Breakfast Included)"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, mealPlan: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                      >
                        <option value="CP (Breakfast Included)">CP (Breakfast Included)</option>
                        <option value="MAP (Breakfast + Dinner)">MAP (Breakfast + Dinner)</option>
                        <option value="AP (All Meals Included)">AP (All Meals Included)</option>
                        <option value="EP (Room Only)">EP (Room Only)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Hotel Confirmation / Booking Ref
                      </label>
                      <input
                        type="text"
                        id="vendor-hotel-conf-input"
                        placeholder="e.g. HTL-KSH-8821"
                        value={arrangementForm.confirmationNumber || ""}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, confirmationNumber: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 2. CAB / TRANSFER FORM */}
              {(arrangingTask.componentType || "").toUpperCase() === "CAB" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Assigned Chauffeur / Driver Name *
                      </label>
                      <input
                        type="text"
                        id="vendor-driver-name-input"
                        required
                        placeholder="e.g. Tariq Ahmad Bhat"
                        value={arrangementForm.driverName || ""}
                        onChange={(e) => {
                          setArrangementForm({ ...arrangementForm, driverName: e.target.value });
                          if (arrangementErrors.driverName) setArrangementErrors({ ...arrangementErrors, driverName: "" });
                        }}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${arrangementErrors.driverName ? "#dc2626" : "#cbd5e1"}`, fontSize: "13px" }}
                      />
                      {arrangementErrors.driverName && <span style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px", display: "block" }}>{arrangementErrors.driverName}</span>}
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Driver Mobile Phone Number * (10-digit Indian Number)
                      </label>
                      <input
                        type="text"
                        id="vendor-driver-phone-input"
                        required
                        placeholder="e.g. 9876543210 or +919876543210"
                        value={arrangementForm.driverPhone || ""}
                        onChange={(e) => {
                          setArrangementForm({ ...arrangementForm, driverPhone: e.target.value });
                          if (arrangementErrors.driverPhone) setArrangementErrors({ ...arrangementErrors, driverPhone: "" });
                        }}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${arrangementErrors.driverPhone ? "#dc2626" : "#cbd5e1"}`, fontSize: "13px" }}
                      />
                      {arrangementErrors.driverPhone && <span style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px", display: "block" }}>{arrangementErrors.driverPhone}</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Vehicle Model / Make
                      </label>
                      <input
                        type="text"
                        id="vendor-vehicle-model-input"
                        placeholder="e.g. Toyota Innova Crysta / Ertiga"
                        value={arrangementForm.vehicleModel || "Toyota Innova Crysta"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, vehicleModel: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Vehicle Registration Number * (e.g. JK01AB1234)
                      </label>
                      <input
                        type="text"
                        id="vendor-vehicle-reg-input"
                        required
                        placeholder="e.g. JK01AB1234"
                        value={arrangementForm.vehicleRegistrationNumber || ""}
                        onChange={(e) => {
                          setArrangementForm({ ...arrangementForm, vehicleRegistrationNumber: e.target.value.toUpperCase() });
                          if (arrangementErrors.vehicleRegistrationNumber) setArrangementErrors({ ...arrangementErrors, vehicleRegistrationNumber: "" });
                        }}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${arrangementErrors.vehicleRegistrationNumber ? "#dc2626" : "#cbd5e1"}`, fontSize: "13px", fontFamily: "monospace", fontWeight: 700 }}
                      />
                      {arrangementErrors.vehicleRegistrationNumber && <span style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px", display: "block" }}>{arrangementErrors.vehicleRegistrationNumber}</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Pickup Point
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Srinagar Airport (SXR)"
                        value={arrangementForm.pickupPoint || "Srinagar Airport (SXR)"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, pickupPoint: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Pickup Date & Time
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Arrival Day 10:00 AM"
                        value={arrangementForm.pickupDateTime || ""}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, pickupDateTime: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Drop Point / Tour Circuit Covered
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Full Circuit (Srinagar - Gulmarg - Pahalgam - Airport Drop)"
                      value={arrangementForm.dropPoint || "Full Circuit (Srinagar - Gulmarg - Pahalgam - Airport Drop)"}
                      onChange={(e) => setArrangementForm({ ...arrangementForm, dropPoint: e.target.value })}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </div>
                </>
              )}

              {/* 3. GUIDE / TOUR FORM */}
              {(arrangingTask.componentType || "").toUpperCase() === "GUIDE" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Tour Guide Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bilal Ahmad Lone"
                        value={arrangementForm.guideName || ""}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, guideName: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Guide Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={arrangementForm.phone || ""}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, phone: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Languages Spoken
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. English, Hindi, Kashmiri"
                        value={arrangementForm.languages || "English, Hindi"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, languages: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                        Meeting Point & Time
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hotel Lobby 09:30 AM"
                        value={arrangementForm.meetingPoint || "Hotel Lobby 09:30 AM"}
                        onChange={(e) => setArrangementForm({ ...arrangementForm, meetingPoint: e.target.value })}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 4. GENERIC / OTHER FORMS */}
              {["HOTEL", "CAB", "GUIDE"].indexOf((arrangingTask.componentType || "").toUpperCase()) === -1 && (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Arrangement Details & Confirmation Notes
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter confirmed supplier details, contacts, locations..."
                    value={JSON.stringify(arrangementForm, null, 2)}
                    onChange={(e) => {
                      try {
                        setArrangementForm(JSON.parse(e.target.value));
                      } catch {
                        // ignore parse err while typing
                      }
                    }}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "monospace" }}
                  />
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Discard changes to arrangement details?")) setArrangingTask(null);
                  }}
                  style={{ background: "#f1f5f9", border: "none", padding: "9px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#475569" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="vendor-submit-arrangement-btn"
                  disabled={submittingArrangement}
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    padding: "9px 22px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: submittingArrangement ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {submittingArrangement ? "Submitting to Admin..." : "Submit Arrangement to Operations"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
