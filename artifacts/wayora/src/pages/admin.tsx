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
} from "lucide-react";
import { useLocation } from "wouter";

type AdminProfile = {
  id: string;
  adminId: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type OverviewMetrics = {
  totalCustomers: number;
  newCustomers: number;
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
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard active tab
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "bookings" | "payments" | "audit" | "settings">("overview");

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

      const data = await res.json();
      if (!res.ok || !data.admin) {
        throw new Error(data.message || "Invalid credentials.");
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

  const reconcileHotelBooking = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/hotelbeds/bookings/${bookingId}/reconcile`, { method: "POST", credentials: "include" });
      const data = await res.json() as { message?: string; status?: string };
      if (!res.ok && res.status !== 202) throw new Error(data.message || "Reconciliation failed.");
      showToast(data.message || `Reconciliation status: ${data.status || "updated"}.`);
      await loadBookings();
      await viewBookingDetail(bookingId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Reconciliation failed.");
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
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          display: "grid",
          placeItems: "center",
          padding: "20px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            width: "min(100%, 420px)",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            padding: "36px 32px",
            position: "relative",
          }}
        >
          {/* Logo / Header */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "52px",
                height: "52px",
                background: "#0f172a",
                borderRadius: "14px",
                color: "#ffffff",
                marginBottom: "14px",
              }}
            >
              <ShieldCheck size={28} />
            </div>
            <span
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "#2563eb",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Zelevos Control Panel
            </span>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
              Admin Sign In
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
              Enter your credentials to access the central customer and booking system.
            </p>
          </div>

          {loginError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: "10px",
                color: "#991b1b",
                fontSize: "12px",
                marginBottom: "20px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Admin ID
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="zelevos-travelai00"
                  required
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "13px",
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Admin Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "13px",
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: "100%",
                height: "44px",
                marginTop: "6px",
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: loginLoading ? "not-allowed" : "pointer",
                transition: "opacity 0.2s ease",
              }}
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

          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid #e2e8f0",
              textAlign: "center",
              fontSize: "11px",
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "6px" }}>
              <Lock size={12} color="#059669" />
              <strong style={{ color: "#0f172a" }}>End-to-End Cryptographic Security</strong>
            </div>
            <span>Admin sessions are validated server-side. Passwords hashed using scrypt.</span>
          </div>

          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              type="button"
              onClick={() => setLocation("/")}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Return to Zelevos Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED: Admin Dashboard
  // --------------------------------------------------------------------------
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
          width: "260px",
          background: "#0f172a",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRight: "1px solid #1e293b",
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: "24px 20px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "#2563eb",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "16px",
              }}
            >
              W
            </div>
            <div>
              <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.02em" }}>Zelevos Admin</span>
              <span style={{ display: "block", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>
                Operations Console
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "overview" ? "#1e293b" : "transparent",
              color: activeTab === "overview" ? "#ffffff" : "#94a3b8",
              fontWeight: activeTab === "overview" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <LayoutDashboard size={18} color={activeTab === "overview" ? "#60a5fa" : "#94a3b8"} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "customers" ? "#1e293b" : "transparent",
              color: activeTab === "customers" ? "#ffffff" : "#94a3b8",
              fontWeight: activeTab === "customers" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <Users size={18} color={activeTab === "customers" ? "#60a5fa" : "#94a3b8"} />
            <span>Customers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "bookings" ? "#1e293b" : "transparent",
              color: activeTab === "bookings" ? "#ffffff" : "#94a3b8",
              fontWeight: activeTab === "bookings" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <Plane size={18} color={activeTab === "bookings" ? "#60a5fa" : "#94a3b8"} />
            <span>Bookings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "payments" ? "#1e293b" : "transparent",
              color: activeTab === "payments" ? "#ffffff" : "#94a3b8",
              fontWeight: activeTab === "payments" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <CreditCard size={18} color={activeTab === "payments" ? "#60a5fa" : "#94a3b8"} />
            <span>Payments</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "audit" ? "#1e293b" : "transparent",
              color: activeTab === "audit" ? "#ffffff" : "#94a3b8",
              fontWeight: activeTab === "audit" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <Clock size={18} color={activeTab === "audit" ? "#60a5fa" : "#94a3b8"} />
            <span>Audit Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "settings" ? "#1e293b" : "transparent",
              color: activeTab === "settings" ? "#ffffff" : "#94a3b8",
              fontWeight: activeTab === "settings" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <Settings size={18} color={activeTab === "settings" ? "#60a5fa" : "#94a3b8"} />
            <span>Settings & Security</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#1e293b",
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
                    color: "#ffffff",
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
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "6px",
              color: "#f87171",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        {/* Top Header */}
        <header
          style={{
            height: "64px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>Zelevos Admin</span>
            <span style={{ color: "#cbd5e1" }}>/</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
              {activeTab}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
              View Zelevos Site
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
              <div style={{ marginBottom: "24px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                  System Overview
                </h1>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Key metrics, customer activity and flight booking transactions.
                </p>
              </div>

              {/* KPI Cards Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "28px",
                }}
              >
                {/* 1. Total Customers */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Total Customers
                    </span>
                    <Users size={18} color="#2563eb" />
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px" }}>
                    {metrics?.totalCustomers ?? "—"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                    +{metrics?.newCustomers ?? 0} in last 30 days
                  </span>
                </div>

                {/* 2. Total Flight Bookings */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Total Bookings
                    </span>
                    <Plane size={18} color="#0891b2" />
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, display: "block", marginBottom: "4px" }}>
                    {(metrics as any)?.totalBookings ?? metrics?.totalFlightBookings ?? "—"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Across all routes</span>
                </div>

                {/* 3. Confirmed Bookings */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Confirmed
                    </span>
                    <CheckCircle2 size={18} color="#059669" />
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, color: "#059669", display: "block", marginBottom: "4px" }}>
                    {metrics?.confirmedBookings ?? "—"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Issued PNRs</span>
                </div>

                {/* 4. Cancelled Bookings */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Cancelled
                    </span>
                    <AlertCircle size={18} color="#dc2626" />
                  </div>
                  <strong style={{ fontSize: "26px", fontWeight: 800, color: "#dc2626", display: "block", marginBottom: "4px" }}>
                    {metrics?.cancelledBookings ?? "—"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Refund processed</span>
                </div>

                {/* 5. Gross Payment Revenue */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Gross Volume
                    </span>
                    <CreditCard size={18} color="#7c3aed" />
                  </div>
                  <strong style={{ fontSize: "22px", fontWeight: 800, display: "block", marginBottom: "4px" }}>
                    {metrics ? formatCurrency(metrics.totalPaymentAmount) : "—"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Confirmed ticket value</span>
                </div>

                {/* 6. Refund Amount */}
                <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Total Refunds
                    </span>
                    <RefreshCw size={18} color="#d97706" />
                  </div>
                  <strong style={{ fontSize: "22px", fontWeight: 800, color: "#d97706", display: "block", marginBottom: "4px" }}>
                    {metrics ? formatCurrency(metrics.refundAmount) : "—"}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Returned to customers</span>
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
              TAB 2: CUSTOMERS
             ================================================================ */}
          {activeTab === "customers" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
                    Customer Accounts
                  </h1>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Complete list of registered travellers, booking volume and profile activity.
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
                    placeholder="Search by Customer ID, name, email or phone..."
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
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                          No customers found matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#2563eb" }}>
                            {c.customerId}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                            {c.fullName}
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
                              onClick={() => viewCustomerDetail(c.customerId || c.id)}
                              style={{
                                padding: "5px 10px",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                color: "#0f172a",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              View
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
                            {((b as any).kind === "HOTEL" && ["RECONCILIATION_REQUIRED", "SUPPLIER_BOOKING_PENDING", "SUPPLIER_FAILED", "REFUND_FAILED"].includes((b as any).status)) && <button type="button" onClick={() => reconcileHotelBooking(b.id)} style={{ padding: "5px 10px", marginRight: "6px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: "6px", color: "#9a3412", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                              Reconcile
                            </button>}
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
