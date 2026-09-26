import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Plane,
  CreditCard,
  ShieldCheck,
  Settings,
  LogOut,
  Search,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  Clock,
  Eye,
  KeyRound,
  Lock,
  RefreshCw,
  TrendingUp,
  UserCheck,
  CheckCircle2,
  Phone,
  Mail,
  Calendar,
  Ticket,
  Package,
  Activity,
  Building2,
  Users2,
  DollarSign,
  Briefcase,
  PanelLeftClose,
  PanelLeft,
  Megaphone,
  Copy,
  Globe,
  ChevronDown,
  ArrowLeft,
  BarChart3,
  PlaneTakeoff,
  EyeOff,
  User,
  Bell,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { useLocation } from "wouter";
import { AdminPackagesTab } from "../components/admin-packages-tab";
import { AdminOperationsTab } from "../components/admin-operations-tab";
import { AdminSuppliersTab } from "../components/admin-suppliers-tab";
import { AdminVendorTab } from "../components/admin-vendor-tab";
import { AdminPartnerTab } from "../components/admin-partner-tab";
import { AdminFinanceTab } from "../components/admin-finance-tab";
import { AdminCustomTripsTab } from "../components/admin-custom-trips-tab";
import { AdminBroadcastsTab } from "../components/admin-broadcasts-tab";
import { AdminUserDossierModal } from "../components/admin-user-dossier-modal";

type AdminProfile = {
  id: string;
  adminId: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type OverviewMetrics = {
  totalCustomers: number;
  newCustomers: number;
  activeBookings?: number;
  pendingOperations?: number;
  approvedVendors?: number;
  revenue?: number;
  pendingPayments?: number;
  openSupportTickets?: number;
  unreadNotifications?: number;
  totalBookings?: number;
  totalFlightBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalPaymentAmount: number;
  refundAmount: number;
};

type CustomerItem = {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  authProvider: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  bookingCount: number;
  totalBookingValue: number;
};

type CustomerDetailBooking = {
  id: string;
  bookingReference: string;
  pnr: string;
  ticketNumber: string | null;
  flight: string;
  route: string;
  travelDate: string;
  amount: number;
  status: string;
  paymentStatus: string;
  paymentId: string | null;
  paymentOrderId: string | null;
  cancellationDetails: any;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerDetailData = {
  customer: CustomerItem;
  bookings: CustomerDetailBooking[];
};

type BookingItem = {
  id: string;
  bookingReference: string;
  pnr: string;
  ticketNumber: string | null;
  route: string;
  flight: string;
  airline: string;
  flightNumber: string;
  travelDate: string;
  amount: number;
  status: string;
  paymentStatus: string;
  paymentId: string | null;
  paymentOrderId: string | null;
  refundAmount: number | null;
  customer: {
    id: string;
    customerId: string | null;
    fullName: string;
    email: string;
    phone: string | null;
  };
  createdAt: string;
};

type PaymentItem = {
  id: string;
  provider: string;
  paymentOrderId: string | null;
  paymentId: string | null;
  bookingId: string;
  bookingReference: string;
  pnr: string;
  customer: {
    fullName: string;
    email: string;
    customerId: string | null;
  };
  amount: number;
  currency: string;
  capturedAmount: number | null;
  status: string;
  refundStatus: string;
  refundAmount: number;
  failureReason: string | null;
  webhookEventType: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminPage() {
  const [, setLocation] = useLocation();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login form state
  const [loginId, setLoginId] = useState("zelevos-travelai00");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [adminLanguage, setAdminLanguage] = useState("EN");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Dashboard active tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "broadcasts" | "customers" | "bookings" | "payments" | "audit" | "settings" | "packages" | "operations" | "suppliers" | "vendors" | "partners" | "finance" | "custom-trips"
  >("overview");

  // Selected User ID for Complete Dossier Modal
  const [selectedDossierUserId, setSelectedDossierUserId] = useState<string | null>(null);

  // Sidebar collapse / full-screen state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync tab from URL if provided (e.g. ?tab=operations or /admin/packages)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab") || window.location.pathname.replace(/^\/admin\/?/, "");
      if (
        ["packages", "operations", "suppliers", "vendors", "partners", "finance", "custom-trips", "overview", "broadcasts", "customers", "bookings", "payments", "audit", "settings"].includes(
          tabParam
        )
      ) {
        setActiveTab(tabParam as any);
      }
    } catch {}
  }, []);

  // Overview stats state
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Customers state
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("all");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetailData | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("ALL");
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<any | null>(null);

  // Payments state
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; actorUserId: string | null; actorAdminId: string | null; action: string; resourceType: string; resourceId: string | null; ipAddress: string | null; metadata: Record<string, unknown>; createdAt: string }>>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // Settings / Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Notification toast
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // 1. Initial auth check
  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Unauthenticated");
      })
      .then((data) => {
        setAdmin(data.admin);
      })
      .catch(() => {
        setAdmin(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  // 2. Load tab data when authenticated
  useEffect(() => {
    if (!admin) return;

    if (activeTab === "overview") {
      loadOverviewStats();
    } else if (activeTab === "customers") {
      loadCustomers();
    } else if (activeTab === "bookings") {
      loadBookings();
    } else if (activeTab === "payments") {
      loadPayments();
    } else if (activeTab === "audit") {
      loadAuditLogs();
    }
  }, [admin, activeTab]);

  const loadOverviewStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setRecentBookings(data.recentBookings || []);
        setRecentCustomers(data.recentCustomers || []);
      }
    } catch {
      showToast("Could not load stats.");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const query = new URLSearchParams();
      if (customerSearch) query.set("search", customerSearch);
      if (customerStatusFilter !== "all") query.set("status", customerStatusFilter);

      const res = await fetch(`/api/admin/customers?${query.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch {
      showToast("Could not load customers.");
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const query = new URLSearchParams();
      if (bookingSearch) query.set("search", bookingSearch);
      if (bookingStatusFilter !== "ALL") query.set("status", bookingStatusFilter);

      const res = await fetch(`/api/admin/bookings?${query.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch {
      showToast("Could not load bookings.");
    } finally {
      setBookingsLoading(false);
    }
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch("/api/admin/payments", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch {
      showToast("Could not load payments.");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      showToast("Could not load audit logs.");
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: loginId.trim(), password: loginPassword }),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!res.ok || !data.admin) {
        throw new Error(
          data.message ||
          (res.status === 401 ? "Invalid Admin ID or password." : "Admin login failed. Please try again.")
        );
      }

      setAdmin(data.admin);
      setLoginPassword("");
      showToast("Signed in as Administrator.");
    } catch (err: any) {
      setLoginError(err.message || "Admin login failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
      setAdmin(null);
      showToast("Logged out from admin console.");
    } catch {
      setAdmin(null);
    }
  };

  const viewCustomerDetail = async (customerIdOrId: string) => {
    setCustomerDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerIdOrId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedCustomer(data);
      } else {
        showToast("Unable to load customer details.");
      }
    } catch {
      showToast("Failed to fetch customer.");
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const viewBookingDetail = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedBookingDetail(data.booking);
      }
    } catch {
      showToast("Unable to load booking details.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update password.");
      }

      setPasswordSuccess("Admin password updated successfully. Secure scrypt hash active.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      showToast("Admin password updated.");
    } catch (err: any) {
      setPasswordError(err.message || "Password update failed.");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#64748b" }}>
          <RefreshCw className="animate-spin" size={18} />
          <span>Verifying admin authorization...</span>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // UNAUTHENTICATED: Admin Login Card
  // --------------------------------------------------------------------------
  if (!admin) {
    return (
      <div className="admin-login-wrapper">
        <div className="admin-login-backdrop-overlay" />

        <div className="admin-login-container">
          {/* ==============================================================
              LEFT SIDE: Zelevos Branding / Travel Ecosystem Hero
              ============================================================== */}
          <div className="admin-login-left">
            <div style={{ marginBottom: "36px" }}>
              <img
                src="/zelevos-full-logo.png"
                alt="Zelevos - Travel Beyond Borders"
                style={{ height: "46px", objectFit: "contain", filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.6))" }}
              />
            </div>

            <h1
              style={{
                fontSize: "clamp(32px, 4vw, 44px)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: "0 0 16px",
                color: "#ffffff",
              }}
            >
              Global Journeys.
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #00d2ff 0%, #0084ff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Smarter Management.
              </span>
            </h1>

            <p
              style={{
                fontSize: "15px",
                color: "#94a3b8",
                lineHeight: 1.6,
                maxWidth: "520px",
                margin: "0 0 36px",
              }}
            >
              A complete travel ecosystem for modern tourism businesses — customers, partners, suppliers and operations, all in one place.
            </p>

            {/* 4 Feature Cards (Glassmorphism Row) */}
            <div
              className="admin-feature-card-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px",
                maxWidth: "560px",
                marginBottom: "40px",
              }}
            >
              {/* 1. Bookings */}
              <div className="admin-feature-card">
                <PlaneTakeoff size={20} color="#00d2ff" style={{ marginBottom: "10px" }} />
                <strong style={{ display: "block", color: "#ffffff", fontSize: "13px", fontWeight: 700 }}>
                  Bookings
                </strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Manage Trips</span>
              </div>

              {/* 2. Customers */}
              <div className="admin-feature-card">
                <Users size={20} color="#00d2ff" style={{ marginBottom: "10px" }} />
                <strong style={{ display: "block", color: "#ffffff", fontSize: "13px", fontWeight: 700 }}>
                  Customers
                </strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Unified Data</span>
              </div>

              {/* 3. Operations */}
              <div className="admin-feature-card">
                <BarChart3 size={20} color="#00d2ff" style={{ marginBottom: "10px" }} />
                <strong style={{ display: "block", color: "#ffffff", fontSize: "13px", fontWeight: 700 }}>
                  Operations
                </strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Real-time Control</span>
              </div>

              {/* 4. Security */}
              <div className="admin-feature-card">
                <ShieldCheck size={20} color="#00d2ff" style={{ marginBottom: "10px" }} />
                <strong style={{ display: "block", color: "#ffffff", fontSize: "13px", fontWeight: 700 }}>
                  Security
                </strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Enterprise Grade</span>
              </div>
            </div>

            {/* Bottom Quote Pill */}
            <div className="admin-quote-card">
              <div className="admin-quote-globe">
                <Globe size={18} color="#00d2ff" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "12.5px", color: "#e2e8f0", fontWeight: 500, fontStyle: "italic", lineHeight: 1.4 }}>
                  “Empowering travel businesses for a brighter, borderless tomorrow.”
                </p>
                <span style={{ display: "block", fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", color: "#00d2ff", marginTop: "3px" }}>
                  ZELEVOS
                </span>
              </div>
            </div>
          </div>

          {/* ==============================================================
              RIGHT SIDE: Large Premium White/Glass Login Card
              ============================================================== */}
          <div className="admin-card-glass">
            {/* World Map Background Watermark Pattern */}
            <div className="admin-map-watermark" />

            {/* Top Right: Language Dropdown */}
            <div style={{ position: "absolute", top: "18px", right: "20px", zIndex: 5 }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 9px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                <Globe size={13} color="#64748b" />
                <span>{adminLanguage}</span>
                <ChevronDown size={11} color="#94a3b8" />
              </button>
            </div>

            {/* Top Logo & Title */}
            <div style={{ textAlign: "center", position: "relative", zIndex: 2, marginBottom: "18px" }}>
              <img
                src="/zelevos-full-logo.png"
                alt="Zelevos"
                style={{ height: "38px", objectFit: "contain", margin: "6px auto 14px", display: "block" }}
              />
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: "0 0 5px", letterSpacing: "-0.02em" }}>
                Welcome Back, <span style={{ color: "#2563eb" }}>Admin</span>
              </h2>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                Sign in to your Zelevos Control Panel
              </p>
            </div>

            {loginError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  background: "#fef2f2",
                  border: "1px solid #fee2e2",
                  borderRadius: "10px",
                  color: "#991b1b",
                  fontSize: "12px",
                  marginBottom: "16px",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "grid", gap: "14px", position: "relative", zIndex: 2 }}>
              {/* Admin ID */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  <User size={13} color="#64748b" />
                  <span>Admin ID</span>
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="zelevos-travelai00"
                  required
                  className="admin-input-field"
                />
              </div>

              {/* Admin Password */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  <Lock size={13} color="#64748b" />
                  <span>Admin Password</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="admin-input-field"
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2px",
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "-2px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#475569", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: "#2563eb", width: "15px", height: "15px", borderRadius: "4px", cursor: "pointer" }}
                  />
                  <span>Remember me</span>
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    showToast("Contact Zelevos Security Operations for admin credential reset.");
                  }}
                  style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loginLoading}
                className="admin-submit-btn"
                style={{ marginTop: "4px" }}
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as Admin</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Divider OR */}
            <div style={{ display: "flex", alignItems: "center", margin: "18px 0 14px", gap: "12px", position: "relative", zIndex: 2 }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "1px" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            {/* 3 ANIMATED SECURITY BADGES (PART 2) */}
            <div
              className="admin-security-badges-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginBottom: "18px",
                position: "relative",
                zIndex: 2,
              }}
            >
              {/* 1. Secure Access */}
              <div className="security-badge-card" title="End-to-end encrypted admin authentication">
                <div className="sec-icon-shield-wrap">
                  <img src="/security-access-shield.png" alt="Secure Access" className="sec-icon-shield-img" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                    Secure Access
                  </strong>
                  <span style={{ display: "block", fontSize: "9px", color: "#64748b", lineHeight: 1.2 }}>
                    Encrypted Login
                  </span>
                </div>
              </div>

              {/* 2. Protected Data */}
              <div className="security-badge-card" title="Relational database cryptographic integrity">
                <div className="sec-icon-db-wrap">
                  <img src="/security-protected-data.png" alt="Protected Data" className="sec-icon-db-img" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                    Protected Data
                  </strong>
                  <span style={{ display: "block", fontSize: "9px", color: "#64748b", lineHeight: 1.2 }}>
                    Server-side Validation
                  </span>
                </div>
              </div>

              {/* 3. Role-Based */}
              <div className="security-badge-card" title="Super Administrator privileged authorization">
                <div className="sec-icon-lock-wrap">
                  <img src="/security-role-based.png" alt="Role-Based" className="sec-icon-lock-img" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                    Role-Based
                  </strong>
                  <span style={{ display: "block", fontSize: "9px", color: "#64748b", lineHeight: 1.2 }}>
                    Admin Only Access
                  </span>
                </div>
              </div>
            </div>

            {/* Return to Home link */}
            <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
              <button
                type="button"
                onClick={() => setLocation("/")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
              >
                <ArrowLeft size={13} />
                <span>Return to Zelevos Home</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        color: "#0f172a",
      }}
    >
      {/* SIDEBAR NAVIGATION */}
      <aside
        style={{
          width: sidebarCollapsed ? "0px" : "260px",
          minWidth: sidebarCollapsed ? "0px" : "260px",
          background: "#ffffff",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRight: sidebarCollapsed ? "none" : "1px solid #e2e8f0",
          overflow: "hidden",
          transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease",
          boxShadow: sidebarCollapsed ? "none" : "1px 0 3px rgba(0, 0, 0, 0.02)",
          zIndex: 30,
        }}
      >
        <div style={{ width: "260px", minWidth: "260px", display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
          {/* Brand Header */}
          <div
            style={{
              padding: "18px 16px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src="/zelevos-icon-logo.png"
                alt="Zelevos Logo"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  objectFit: "contain",
                  boxShadow: "0 2px 8px rgba(0, 132, 255, 0.35)",
                }}
              />
              <div>
                <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Zelevos Admin</span>
                <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
                  Operations Console
                </span>
              </div>
            </div>

            <button
              type="button"
              id="admin-sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar to Full Screen"
              aria-label="Collapse sidebar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "30px",
                height: "30px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#64748b",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#eff6ff";
                e.currentTarget.style.borderColor = "#bfdbfe";
                e.currentTarget.style.color = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.color = "#64748b";
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: "3px", flex: 1, overflowY: "auto" }}>
            {[
              { id: "admin-nav-overview", tab: "overview" as const, label: "Overview", icon: LayoutDashboard },
              { id: "admin-nav-customers", tab: "customers" as const, label: "Customers", icon: Users },
              { id: "admin-nav-bookings", tab: "bookings" as const, label: "Bookings", icon: Plane },
              { id: "admin-nav-payments", tab: "payments" as const, label: "Payments", icon: CreditCard },
              { id: "admin-nav-suppliers", tab: "suppliers" as const, label: "Suppliers / Vendors", icon: Building2 },
              { id: "admin-nav-operations", tab: "operations" as const, label: "Operations", icon: Activity },
              { id: "admin-nav-packages", tab: "packages" as const, label: "Packages", icon: Package },
              { id: "admin-nav-destinations", tab: "packages" as const, label: "Destinations", icon: MapPin },
              { id: "admin-nav-support", tab: "operations" as const, label: "Support", icon: MessageSquare },
              { id: "admin-nav-broadcasts", tab: "broadcasts" as const, label: "Broadcasts & Offers", icon: Megaphone },
              { id: "admin-nav-custom-trips", tab: "custom-trips" as const, label: "Custom Trips", icon: Calendar },
              { id: "admin-nav-flights", tab: "bookings" as const, label: "Flights", icon: PlaneTakeoff },
              { id: "admin-nav-partners", tab: "partners" as const, label: "Partners", icon: Users2 },
              { id: "admin-nav-finance", tab: "finance" as const, label: "Finance", icon: DollarSign },
              { id: "admin-nav-reports", tab: "overview" as const, label: "Reports", icon: BarChart3 },
              { id: "admin-nav-audit", tab: "audit" as const, label: "Audit Logs", icon: Clock },
              { id: "admin-nav-settings", tab: "settings" as const, label: "Settings & Security", icon: Settings },
            ].map((item) => {
              const isActive = activeTab === item.tab;
              const Icon = item.icon;
              return (
                <button
                  key={item.tab}
                  id={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.tab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: isActive ? "1px solid #dbeafe" : "1px solid transparent",
                    background: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#1d4ed8" : "#475569",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.color = "#0f172a";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#475569";
                    }
                  }}
                >
                  <Icon size={17} color={isActive ? "#2563eb" : "#64748b"} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid #f1f5f9", background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "#ecfdf5",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <ShieldCheck size={15} color="#10b981" />
                </div>
                <div style={{ overflow: "hidden" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {admin.adminId}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>Admin Session</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fee2e2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fef2f2";
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowX: "hidden", minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: "64px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              id="admin-toggle-sidebar"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Show Sidebar Menu" : "Collapse Sidebar (Full Screen View)"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Full screen mode"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "7px 12px",
                borderRadius: "8px",
                border: sidebarCollapsed ? "1px solid #2563eb" : "1px solid #cbd5e1",
                background: sidebarCollapsed ? "#eff6ff" : "#ffffff",
                color: sidebarCollapsed ? "#1d4ed8" : "#334155",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
              }}
              onMouseEnter={(e) => {
                if (!sidebarCollapsed) {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#94a3b8";
                }
              }}
              onMouseLeave={(e) => {
                if (!sidebarCollapsed) {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }
              }}
            >
              {sidebarCollapsed ? (
                <>
                  <PanelLeft size={16} color="#2563eb" />
                  <span>Show Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose size={16} color="#64748b" />
                  <span>Full Screen</span>
                </>
              )}
            </button>

            <span style={{ color: "#cbd5e1" }}>/</span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>Zelevos Admin</span>
              <span style={{ color: "#cbd5e1" }}>/</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
                {activeTab}
              </span>
            </div>
          </div>

          {/* Center: Search */}
          <div style={{ position: "relative", width: "300px", maxWidth: "100%", display: "flex", alignItems: "center" }}>
            <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "12px" }} />
            <input
              type="text"
              placeholder="Search console, customers, bookings, PNR..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                if (activeTab !== "customers" && e.target.value.trim().length > 1) {
                  setActiveTab("customers");
                }
              }}
              style={{
                width: "100%",
                height: "36px",
                paddingLeft: "34px",
                paddingRight: "12px",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: "12px",
                outline: "none",
                color: "#1e293b",
                transition: "all 0.15s ease",
              }}
            />
          </div>

          {/* Right: Security Badge + Language + Notifications + Profile Dropdown + Site Link */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                background: "#ecfdf5",
                border: "1px solid #d1fae5",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#065f46",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              Live Secure Mode
            </span>

            {/* Language Selector */}
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                fontSize: "11px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <Globe size={13} color="#64748b" />
              <span>{adminLanguage}</span>
              <ChevronDown size={11} color="#94a3b8" />
            </button>

            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => setActiveTab("broadcasts")}
              title="Notifications & Broadcasts"
              style={{
                position: "relative",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Bell size={16} />
              {(metrics?.unreadNotifications ?? 0) > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#2563eb",
                    border: "2px solid #ffffff",
                  }}
                />
              )}
            </button>

            {/* Admin Profile Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                id="admin-profile-menu-btn"
                type="button"
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "4px 10px 4px 5px",
                  borderRadius: "24px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #00d2ff, #0084ff)",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "11px",
                    boxShadow: "0 2px 6px rgba(0, 132, 255, 0.3)",
                  }}
                >
                  AD
                </div>
                <div style={{ textAlign: "left", lineHeight: 1.1 }}>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                    {admin.adminId}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>Super Admin</span>
                </div>
                <ChevronDown size={12} color="#94a3b8" />
              </button>

              {adminMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: "210px",
                    background: "#ffffff",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                    border: "1px solid #e2e8f0",
                    padding: "6px",
                    zIndex: 100,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("settings");
                      setAdminMenuOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "transparent",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Settings size={14} color="#64748b" />
                    <span>Security & Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("audit");
                      setAdminMenuOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "transparent",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Clock size={14} color="#64748b" />
                    <span>Activity & Audit</span>
                  </button>

                  <div style={{ height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#fef2f2",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#dc2626",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <LogOut size={14} color="#dc2626" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setLocation("/")}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              View Site
            </button>
          </div>
        </header>

        {/* Content View */}
        <div style={{ padding: "28px", flex: 1 }}>
          {/* ================================================================
              TAB 1: OVERVIEW
             ================================================================ */}
          {activeTab === "overview" && (
            <div>
              <div style={{ marginBottom: "26px" }}>
                <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 6px", color: "#0f172a", letterSpacing: "-0.02em" }}>
                  {getGreeting()}, Admin
                </h1>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                  Here's what's happening across Zelevos today.
                </p>
              </div>

              {/* 8 World-Class Statistics Cards (Real Backend Data) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  marginBottom: "28px",
                }}
              >
                {/* 1. Total Customers */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Total Customers
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eff6ff", display: "grid", placeItems: "center" }}>
                      <Users size={17} color="#2563eb" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.totalCustomers ?? 0}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                    +{metrics?.newCustomers ?? 0} this month
                  </span>
                </div>

                {/* 2. Active Bookings */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Active Bookings
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdfa", display: "grid", placeItems: "center" }}>
                      <Plane size={17} color="#0d9488" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.activeBookings ?? (metrics?.confirmedBookings ?? 0)}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Confirmed & in progress</span>
                </div>

                {/* 3. Pending Operations */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Pending Operations
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fffbeb", display: "grid", placeItems: "center" }}>
                      <Activity size={17} color="#d97706" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.pendingOperations ?? 0}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#d97706", fontWeight: 600 }}>Action required</span>
                </div>

                {/* 4. Approved Vendors */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Approved Vendors
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#ecfdf5", display: "grid", placeItems: "center" }}>
                      <Building2 size={17} color="#10b981" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.approvedVendors ?? 0}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Verified supplier partners</span>
                </div>

                {/* 5. Revenue */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Revenue
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", display: "grid", placeItems: "center" }}>
                      <DollarSign size={17} color="#7c3aed" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "24px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics ? formatCurrency(metrics.revenue ?? metrics.totalPaymentAmount) : "₹0"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Gross captured volume</span>
                </div>

                {/* 6. Pending Payments */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Pending Payments
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eef2ff", display: "grid", placeItems: "center" }}>
                      <CreditCard size={17} color="#4f46e5" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.pendingPayments ?? 0}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Awaiting gateway settlement</span>
                </div>

                {/* 7. Open Support Tickets */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Open Support Tickets
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fff1f2", display: "grid", placeItems: "center" }}>
                      <MessageSquare size={17} color="#e11d48" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.openSupportTickets ?? 0}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Active customer inquiries</span>
                </div>

                {/* 8. Unread Notifications */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Unread Notifications
                    </span>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eff6ff", display: "grid", placeItems: "center" }}>
                      <Bell size={17} color="#2563eb" />
                    </div>
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px", color: "#0f172a" }}>
                    {metrics?.unreadNotifications ?? 0}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Broadcasts & system alerts</span>
                </div>
              </div>

              {/* Two Column Quick Views */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* Recent Bookings */}
                <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0 }}>Recent Bookings</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("bookings")}
                      style={{ background: "transparent", border: "none", color: "#2563eb", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      View all →
                    </button>
                  </div>

                  {recentBookings.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>
                      No recent bookings found.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {recentBookings.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            padding: "12px 14px",
                            borderRadius: "8px",
                            background: "#f8fafc",
                            border: "1px solid #f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                              <strong style={{ fontSize: "13px", color: "#0f172a" }}>{b.pnr}</strong>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>· {b.route}</span>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {b.customerName} ({b.customerEmail})
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong style={{ fontSize: "13px", display: "block", color: "#0f172a" }}>
                              {formatCurrency(b.amount)}
                            </strong>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: b.status === "CONFIRMED" ? "#ecfdf5" : "#fef2f2",
                                color: b.status === "CONFIRMED" ? "#065f46" : "#991b1b",
                              }}
                            >
                              {b.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Customers */}
                <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0 }}>Recent Customers</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("customers")}
                      style={{ background: "transparent", border: "none", color: "#2563eb", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      View all →
                    </button>
                  </div>

                  {recentCustomers.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>
                      No customers registered yet.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {recentCustomers.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            padding: "12px 14px",
                            borderRadius: "8px",
                            background: "#f8fafc",
                            border: "1px solid #f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                              <strong style={{ fontSize: "13px", color: "#0f172a" }}>{c.fullName}</strong>
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontWeight: 700,
                                }}
                              >
                                {c.customerId || "CUST-..."}
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{c.email}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => viewCustomerDetail(c.customerId || c.id)}
                            style={{
                              padding: "6px 10px",
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: BROADCASTS & OFFERS
             ================================================================ */}
          {activeTab === "broadcasts" && (
            <AdminBroadcastsTab onToast={showToast} />
          )}

          {/* ================================================================
              TAB 2: USER INFORMATION & COMPLETE CUSTOMER DOSSIER
             ================================================================ */}
          {activeTab === "customers" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                    User Information & Customer Dossiers
                  </h1>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Search by User ID (ZLV-CUS-XXXXXX), email, name, phone or booking reference to view complete profile dossiers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadCustomers}
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
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={14} className={customersLoading ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "14px 18px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "11px" }} />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadCustomers();
                    }}
                    placeholder="Search by User ID (ZLV-CUS-XXXXXX), name, email, phone or booking reference..."
                    style={{
                      width: "100%",
                      height: "38px",
                      paddingLeft: "36px",
                      paddingRight: "12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>

                <select
                  value={customerStatusFilter}
                  onChange={(e) => setCustomerStatusFilter(e.target.value)}
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#334155",
                    outline: "none",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>

                <button
                  type="button"
                  onClick={loadCustomers}
                  style={{
                    height: "38px",
                    padding: "0 16px",
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Search
                </button>
              </div>

              {/* Customers Table */}
              <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Customer ID</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Full Name</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Email Address</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Phone</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Registered</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Last Login</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Bookings</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Total Spend</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersLoading ? (
                      <tr>
                        <td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                          <RefreshCw size={18} className="animate-spin" style={{ display: "inline-block", marginRight: "8px", verticalAlign: "middle" }} />
                          Loading customer records...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                          No customers found matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }} className="hover:bg-slate-50 transition">
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "3px 8px", borderRadius: "6px", border: "1px solid #bfdbfe", fontSize: "11px" }}>
                              {c.customerId}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>{c.fullName}</span>
                              {new Date().getTime() - new Date(c.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 && (
                                <span style={{ padding: "1px 6px", borderRadius: "10px", fontSize: "9px", fontWeight: 800, background: "#10b981", color: "#ffffff", letterSpacing: "0.5px" }}>
                                  NEW
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#475569" }}>
                            {c.email}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>
                            {c.phone || "—"}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>
                            {formatDate(c.createdAt)}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>
                            {formatDateTime(c.lastLoginAt)}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                            {c.bookingCount}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#059669" }}>
                            {formatCurrency(c.totalBookingValue)}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: c.status === "active" ? "#ecfdf5" : "#fef3c7",
                                color: c.status === "active" ? "#065f46" : "#92400e",
                              }}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => setSelectedDossierUserId(c.id || c.customerId)}
                              style={{
                                padding: "6px 12px",
                                background: "#2563eb",
                                border: "none",
                                borderRadius: "6px",
                                color: "#ffffff",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                              }}
                            >
                              View Dossier
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 3: BOOKINGS
             ================================================================ */}
          {activeTab === "bookings" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                    All Bookings
                  </h1>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Flights, hotels, activities and transport — all booking kinds with full payment status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadBookings}
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
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={14} className={bookingsLoading ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "14px 18px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "11px" }} />
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadBookings();
                    }}
                    placeholder="Search by PNR, reference, customer or flight..."
                    style={{
                      width: "100%",
                      height: "38px",
                      paddingLeft: "36px",
                      paddingRight: "12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>

                <select
                  value={bookingStatusFilter}
                  onChange={(e) => setBookingStatusFilter(e.target.value)}
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#334155",
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="SUPPLIER_CONFIRMED">SUPPLIER_CONFIRMED</option>
                  <option value="SUPPLIER_BOOKING_PENDING">SUPPLIER_BOOKING_PENDING</option>
                  <option value="SUPPLIER_FAILED">SUPPLIER_FAILED</option>
                  <option value="RECONCILIATION_REQUIRED">RECONCILIATION_REQUIRED</option>
                  <option value="REFUND_PENDING">REFUND_PENDING</option>
                  <option value="REFUND_FAILED">REFUND_FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="SEARCHED">SEARCHED</option>
                  <option value="FAILED">FAILED</option>
                </select>

                <button
                  type="button"
                  onClick={loadBookings}
                  style={{
                    height: "38px",
                    padding: "0 16px",
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Search
                </button>
              </div>

              {/* Bookings Table */}
              <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Kind</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>PNR / Reference</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Customer</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Description</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Created / Updated</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Amount</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Payment</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                          No bookings found matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ padding: "2px 7px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: (b as any).kind === "FLIGHT" ? "#eff6ff" : "#f0fdf4", color: (b as any).kind === "FLIGHT" ? "#1d4ed8" : "#166534" }}>
                              {(b as any).kind || "FLIGHT"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <strong style={{ display: "block", color: "#0f172a", fontSize: "13px" }}>
                              {b.pnr}
                            </strong>
                            <span style={{ fontSize: "10px", color: "#64748b" }}>{b.bookingReference}</span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <strong style={{ display: "block", color: "#0f172a" }}>{b.customer.fullName}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{b.customer.email}</span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#334155", fontWeight: 600 }}>
                            {b.route || b.flight}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>
                            {formatDate(b.travelDate)}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 800, color: "#0f172a" }}>
                            {formatCurrency(b.amount)}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 700, background: b.paymentStatus === "CAPTURED" || b.paymentStatus === "PAID" || b.paymentStatus === "PAYMENT_CONFIRMED" ? "#ecfdf5" : "#fef2f2", color: b.paymentStatus === "CAPTURED" || b.paymentStatus === "PAID" || b.paymentStatus === "PAYMENT_CONFIRMED" ? "#065f46" : "#991b1b" }}>
                              {b.paymentStatus}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 700, background: b.status === "CONFIRMED" ? "#ecfdf5" : b.status === "CANCELLED" ? "#fef2f2" : "#f1f5f9", color: b.status === "CONFIRMED" ? "#065f46" : b.status === "CANCELLED" ? "#991b1b" : "#475569" }}>
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button type="button" onClick={() => viewBookingDetail(b.id)} style={{ padding: "5px 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", color: "#0f172a", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 4: PAYMENTS
             ================================================================ */}
          {activeTab === "payments" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                    Payments & Financial Audits
                  </h1>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Verified transactions, order identifiers and refund ledger records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadPayments}
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
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={14} className={paymentsLoading ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Payments Table */}
              <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Provider / Payment ID</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Customer</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Booking PNR</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Amount</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Refund Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                          No payment records found.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ display: "block", fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{p.provider}</span>
                            <strong style={{ display: "block", color: "#0f172a", fontFamily: "monospace", fontSize: "11px" }}>
                              {p.paymentId || p.paymentOrderId || p.id}
                            </strong>
                            {p.paymentOrderId && p.paymentId && (
                              <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>
                                Order: {p.paymentOrderId}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <strong style={{ display: "block", color: "#0f172a" }}>{p.customer.fullName}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{p.customer.email}</span>
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#2563eb" }}>
                            {p.pnr}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 800, color: "#0f172a" }}>
                            {formatCurrency(p.amount)} <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>{p.currency}</span>
                            {p.capturedAmount !== null && p.capturedAmount !== p.amount && (
                              <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: 500 }}>Captured: {formatCurrency(p.capturedAmount)}</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "10px",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: p.status === "PAID" || p.status === "CAPTURED" ? "#ecfdf5" : "#fef2f2",
                                color: p.status === "PAID" || p.status === "CAPTURED" ? "#065f46" : "#991b1b",
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {p.refundStatus === "REFUNDED" ? (
                              <div>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    display: "inline-block",
                                    marginBottom: "2px",
                                  }}
                                >
                                  REFUNDED
                                </span>
                                <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#b45309" }}>
                                  {formatCurrency(p.refundAmount)}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "11px" }}>None</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>
                            <span style={{ display: "block" }}>{formatDateTime(p.createdAt)}</span>
                            <span style={{ display: "block", fontSize: "10px", color: "#94a3b8" }}>
                              Updated {formatDateTime(p.updatedAt)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 5: AUDIT LOGS
             ================================================================ */}
          {activeTab === "audit" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>Audit Logs</h1>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>All admin and user actions tracked for security and compliance.</p>
                </div>
                <button type="button" onClick={loadAuditLogs} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                  <RefreshCw size={14} className={auditLogsLoading ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
              </div>
              <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Action</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Actor</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Resource</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>IP Address</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>{auditLogsLoading ? "Loading audit logs..." : "No audit events recorded yet."}</td></tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ padding: "2px 7px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: log.action.includes("CONFIRMED") ? "#ecfdf5" : log.action.includes("CANCELLED") || log.action.includes("FAILED") ? "#fef2f2" : "#eff6ff", color: log.action.includes("CONFIRMED") ? "#065f46" : log.action.includes("CANCELLED") || log.action.includes("FAILED") ? "#991b1b" : "#1d4ed8" }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#334155" }}>
                            {log.actorAdminId ? <span style={{ fontWeight: 700, color: "#7c3aed" }}>Admin</span> : log.actorUserId ? <span style={{ fontWeight: 600 }}>User</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                            {log.resourceType}{log.resourceId ? ` · ${log.resourceId.slice(0, 8)}...` : ""}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>{log.ipAddress || "—"}</td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>{formatDateTime(log.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 6: SETTINGS & SECURITY
             ================================================================ */}
          {activeTab === "settings" && (
            <div style={{ maxWidth: "800px" }}>
              <div style={{ marginBottom: "24px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                  Admin Profile & Security
                </h1>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Manage credentials, password hashing and security protocols.
                </p>
              </div>

              {/* Security Status Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <ShieldCheck size={20} color="#059669" />
                    <strong style={{ fontSize: "14px" }}>Admin Identity</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                    <p style={{ margin: "0 0 6px" }}>
                      Admin ID: <strong style={{ color: "#0f172a" }}>{admin.adminId}</strong>
                    </p>
                    <p style={{ margin: "0 0 6px" }}>
                      Role: <strong style={{ color: "#0f172a" }}>Super Administrator</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      Last Login: <strong style={{ color: "#0f172a" }}>{formatDateTime(admin.lastLoginAt)}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <Lock size={20} color="#2563eb" />
                    <strong style={{ fontSize: "14px" }}>Security Posture</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                    <p style={{ margin: "0 0 6px" }}>
                      Hash Algorithm: <strong style={{ color: "#0f172a" }}>scrypt (64-byte key)</strong>
                    </p>
                    <p style={{ margin: "0 0 6px" }}>
                      Cookie Protection: <strong style={{ color: "#0f172a" }}>HttpOnly · SameSite=Lax</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      Session Duration: <strong style={{ color: "#0f172a" }}>24 Hours Rolling</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Change Password Card */}
              <div style={{ background: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                  <KeyRound size={20} color="#0f172a" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Change Admin Password</h3>
                </div>

                {passwordSuccess && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "#ecfdf5",
                      border: "1px solid #d1fae5",
                      borderRadius: "8px",
                      color: "#065f46",
                      fontSize: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "#fef2f2",
                      border: "1px solid #fee2e2",
                      borderRadius: "8px",
                      color: "#991b1b",
                      fontSize: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{passwordError}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} style={{ display: "grid", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      New Password (min. 8 characters)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    style={{
                      height: "42px",
                      marginTop: "6px",
                      background: "#0f172a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      cursor: passwordLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {passwordLoading ? (
                      <>
                        <RefreshCw className="animate-spin" size={15} />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound size={15} />
                        <span>Update Admin Password</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 7: PACKAGES (Section 8)
             ================================================================ */}
          {activeTab === "packages" && <AdminPackagesTab onToast={showToast} />}

          {/* ================================================================
              TAB 8: OPERATIONS (Section 11 & 12)
             ================================================================ */}
          {activeTab === "operations" && <AdminOperationsTab onToast={showToast} />}

          {activeTab === "custom-trips" && <AdminCustomTripsTab onToast={showToast} />}

          {/* ================================================================
              TAB: SUPPLIERS / VENDORS MANAGEMENT
             ================================================================ */}
          {activeTab === "suppliers" && <AdminSuppliersTab onToast={showToast} />}

          {/* ================================================================
              TAB 9: VENDOR PORTAL (Section 9)
             ================================================================ */}
          {activeTab === "vendors" && <AdminVendorTab onToast={showToast} />}

          {/* ================================================================
              TAB 10: PARTNER NETWORK (Section 13)
             ================================================================ */}
          {activeTab === "partners" && <AdminPartnerTab onToast={showToast} />}

          {/* ================================================================
              TAB 11: FINANCE & LEDGER (Section 15 & 23)
             ================================================================ */}
          {activeTab === "finance" && <AdminFinanceTab onToast={showToast} />}
        </div>
      </main>

      {/* ================================================================
          CUSTOMER DETAIL MODAL (Profile + Complete Booking History)
         ================================================================ */}
      {selectedCustomer && (
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
            if (e.target === e.currentTarget) setSelectedCustomer(null);
          }}
        >
          <div
            style={{
              width: "min(100%, 720px)",
              maxHeight: "90vh",
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
                  Customer Profile
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  {selectedCustomer.customer.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {/* Profile Details Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "24px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ display: "block", color: "#64748b", marginBottom: "2px" }}>Customer ID</span>
                  <strong style={{ color: "#2563eb", fontSize: "13px" }}>
                    {selectedCustomer.customer.customerId}
                  </strong>
                </div>

                <div>
                  <span style={{ display: "block", color: "#64748b", marginBottom: "2px" }}>Account Status</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: selectedCustomer.customer.status === "active" ? "#ecfdf5" : "#fef3c7",
                      color: selectedCustomer.customer.status === "active" ? "#065f46" : "#92400e",
                    }}
                  >
                    {selectedCustomer.customer.status}
                  </span>
                </div>

                <div>
                  <span style={{ display: "block", color: "#64748b", marginBottom: "2px" }}>Email</span>
                  <strong style={{ color: "#0f172a" }}>{selectedCustomer.customer.email}</strong>
                </div>

                <div>
                  <span style={{ display: "block", color: "#64748b", marginBottom: "2px" }}>Phone</span>
                  <strong style={{ color: "#0f172a" }}>{selectedCustomer.customer.phone || "Not provided"}</strong>
                </div>

                <div>
                  <span style={{ display: "block", color: "#64748b", marginBottom: "2px" }}>Registered On</span>
                  <strong style={{ color: "#0f172a" }}>{formatDate(selectedCustomer.customer.createdAt)}</strong>
                </div>

                <div>
                  <span style={{ display: "block", color: "#64748b", marginBottom: "2px" }}>Last Login</span>
                  <strong style={{ color: "#0f172a" }}>{formatDateTime(selectedCustomer.customer.lastLoginAt)}</strong>
                </div>
              </div>

              {/* Booking History Header */}
              <div style={{ marginBottom: "12px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                  Flight Booking History ({selectedCustomer.bookings.length})
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                  Every flight journey and ticket issued to this customer.
                </p>
              </div>

              {/* Bookings List */}
              {selectedCustomer.bookings.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>No bookings made by this customer yet.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {selectedCustomer.bookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <strong style={{ fontSize: "13px", color: "#0f172a" }}>{b.pnr}</strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>· {b.route}</span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                          {b.flight} · {formatDate(b.travelDate)}
                        </span>
                        {b.ticketNumber && (
                          <span style={{ fontSize: "10px", color: "#059669", fontWeight: 600 }}>
                            Ticket: {b.ticketNumber}
                          </span>
                        )}
                        <span style={{ display: "block", fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", marginTop: "3px" }}>
                          Order: {b.paymentOrderId || "—"} · Payment: {b.paymentId || "—"}
                        </span>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: "14px", display: "block", color: "#0f172a" }}>
                          {formatCurrency(b.amount)}
                        </strong>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: b.status === "CONFIRMED" ? "#ecfdf5" : "#fef2f2",
                              color: b.status === "CONFIRMED" ? "#065f46" : "#991b1b",
                              fontWeight: 700,
                            }}
                          >
                            {b.status}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: b.paymentStatus === "CAPTURED" || b.paymentStatus === "PAID" ? "#ecfdf5" : "#fef2f2",
                              color: b.paymentStatus === "CAPTURED" || b.paymentStatus === "PAID" ? "#065f46" : "#991b1b",
                              fontWeight: 700,
                            }}
                          >
                            {b.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          BOOKING INSPECTION MODAL
         ================================================================ */}
      {selectedBookingDetail && (
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
            if (e.target === e.currentTarget) setSelectedBookingDetail(null);
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
                  Booking Details
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  PNR: {selectedBookingDetail.pnr || "Pending"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "24px", overflowY: "auto", flex: 1, fontSize: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <span style={{ display: "block", color: "#64748b" }}>Customer</span>
                  <strong style={{ color: "#0f172a", fontSize: "13px" }}>
                    {selectedBookingDetail.customer?.fullName}
                  </strong>
                  <span style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                    {selectedBookingDetail.customer?.email}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", color: "#64748b" }}>Booking Reference</span>
                  <strong style={{ color: "#0f172a" }}>{selectedBookingDetail.bookingReference}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "#64748b" }}>Payment Order ID</span>
                  <strong style={{ color: "#0f172a" }}>{selectedBookingDetail.paymentOrderId || "—"}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "#64748b" }}>Payment ID</span>
                  <strong style={{ color: "#0f172a" }}>{selectedBookingDetail.paymentId || "—"}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "#64748b" }}>Total Amount</span>
                  <strong style={{ color: "#059669", fontSize: "14px" }}>
                    {formatCurrency(selectedBookingDetail.amount)}
                  </strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "#64748b" }}>Status</span>
                  <strong style={{ color: selectedBookingDetail.status === "CONFIRMED" ? "#059669" : "#dc2626" }}>
                    {selectedBookingDetail.status}
                  </strong>
                </div>
              </div>

              {/* Passengers */}
              {Array.isArray(selectedBookingDetail.passengers) && (
                <div style={{ marginTop: "16px" }}>
                  <strong style={{ display: "block", marginBottom: "8px", color: "#0f172a" }}>
                    Passengers ({selectedBookingDetail.passengers.length})
                  </strong>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {selectedBookingDetail.passengers.map((p: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <strong style={{ color: "#0f172a" }}>
                          {p.title} {p.firstName} {p.lastName}
                        </strong>
                        <span style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                          Type: {p.type} · DOB: {p.dateOfBirth || "N/A"} · Gender: {p.gender || "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE USER DOSSIER MODAL */}
      {selectedDossierUserId && (
        <AdminUserDossierModal
          userId={selectedDossierUserId}
          onClose={() => setSelectedDossierUserId(null)}
          onToast={showToast}
        />
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            zIndex: 10000,
          }}
        >
          <Check size={16} color="#10b981" />
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast("")}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", marginLeft: "6px" }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
