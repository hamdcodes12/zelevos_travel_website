import React, { useState, useEffect } from "react";
import {
  Users2,
  Copy,
  Check,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Clock,
  Briefcase,
  Share2,
  Plus,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  ExternalLink,
  Send,
} from "lucide-react";
import { useLocation } from "wouter";

interface PartnerData {
  id: string;
  partnerId: string;
  agencyName: string;
  contactName: string;
  email: string;
  phone: string;
  referralCode: string;
  referralLink: string;
  commissionRatePercent: string;
  status: string;
  totalBookingsCount?: number;
  totalCommissionEarned?: number;
  totalCommissionPaid?: number;
}

interface CommissionItem {
  id: string;
  bookingId: string;
  bookingAmount: number;
  commissionPercent: string | number;
  commissionAmount: number;
  status: string;
  createdAt: string;
  agencyName?: string;
  contactName?: string;
  bookingRef?: string;
}

export function PartnerPortalPage() {
  const [, setLocation] = useLocation();
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toast, setToast] = useState("");

  // Auth / Login Form state
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Register Form state
  const [regAgency, setRegAgency] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  // Lead Form state
  const [leadCustomerName, setLeadCustomerName] = useState("");
  const [leadCustomerEmail, setLeadCustomerEmail] = useState("");
  const [leadCustomerPhone, setLeadCustomerPhone] = useState("");
  const [leadDestination, setLeadDestination] = useState("Kashmir");
  const [leadTravellers, setLeadTravellers] = useState(2);
  const [leadBudget, setLeadBudget] = useState("50000");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState("");

  // Active dashboard tab
  const [activeTab, setActiveTab] = useState<"ledger" | "leads" | "payouts">("ledger");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Check if partner session is active
  const checkPartnerSession = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partners/dashboard", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.partner) {
          setPartner(data.partner);
          setCommissions(Array.isArray(data.commissions) ? data.commissions : []);
        }
      } else {
        setPartner(null);
      }
    } catch {
      setPartner(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void checkPartnerSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) return;

    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/partners/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: loginIdentifier.trim() }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Partner sign in failed.");
      }

      setPartner(data.partner);
      setCommissions(Array.isArray(data.commissions) ? data.commissions : []);
      showToast(`Welcome back, ${data.partner.agencyName}!`);
    } catch (err: any) {
      setLoginError(err.message || "Failed to sign in. Check your email or referral code.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");

    try {
      const res = await fetch("/api/partners/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agencyName: regAgency.trim(),
          contactName: regContact.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Registration failed.");
      }

      setPartner(data.partner);
      setCommissions([]);
      showToast(`Congratulations! Account activated with code ${data.partner.referralCode}`);
    } catch (err: any) {
      setRegError(err.message || "Registration failed. Try with different details.");
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/partners/logout", { method: "POST", credentials: "include" });
      setPartner(null);
      setCommissions([]);
      showToast("Logged out from Partner Portal.");
    } catch {
      setPartner(null);
    }
  };

  const copyToClipboard = (text: string, isLink = false) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast("Referral link copied to clipboard!");
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showToast("Referral code copied!");
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadLoading(true);
    setLeadSuccess("");

    try {
      const res = await fetch("/api/partners/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: leadCustomerName.trim(),
          customerEmail: leadCustomerEmail.trim(),
          customerPhone: leadCustomerPhone.trim(),
          destinations: [leadDestination],
          travellersCount: Number(leadTravellers),
          budgetPerPerson: Number(leadBudget),
          specialRequests: leadNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Failed to submit lead.");
      }

      setLeadSuccess(`Client lead submitted! Tracking ID: ${data.lead?.leadNumber || "LEAD-CONFIRMED"}. Zelevos Operations will follow up.`);
      setLeadCustomerName("");
      setLeadCustomerEmail("");
      setLeadCustomerPhone("");
      setLeadNotes("");
    } catch (err: any) {
      showToast(err.message || "Lead submission failed.");
    } finally {
      setLeadLoading(false);
    }
  };

  // Metrics calculation
  const totalEarned = commissions.reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
  const paidOut = commissions.filter(c => c.status === "paid").reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
  const pendingPayout = totalEarned - paidOut;
  const totalBookingValue = commissions.reduce((acc, c) => acc + (c.bookingAmount || 0), 0);

  // --------------------------------------------------------------------------
  // 1. Unauthenticated Login & Application Screen
  // --------------------------------------------------------------------------
  if (!partner && !loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", display: "flex", flexDirection: "column" }}>
        {/* Top Header */}
        <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.04em", color: "#2563eb" }}>Zelevos</span>
            <span style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Authorised Partner Portal
            </span>
          </div>
          <button
            onClick={() => setLocation("/")}
            style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: 700, transition: "all 0.15s ease" }}
          >
            ← Back to Zelevos
          </button>
        </header>

        {/* Hero / Login Container */}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ width: "min(100%, 500px)", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "36px 32px", boxShadow: "0 20px 45px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              {/* Prestigious Zelevos Partner 3D Gold Crest Logo */}
              <img
                src="/zelevos-partner-logo.png"
                alt="Zelevos Authorised Partner"
                style={{ width: "135px", height: "auto", margin: "0 auto 12px", display: "block", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.12))" }}
              />
              <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>
                Authorised Partner Workspace
              </h1>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 }}>
                Independent portal for travel agents, tour operators, and creators to track referrals & commissions.
              </p>
            </div>

            {/* Tab switch */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "4px", marginBottom: "24px" }}>
              <button
                type="button"
                onClick={() => setAuthTab("login")}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  background: authTab === "login" ? "#2563eb" : "transparent",
                  color: authTab === "login" ? "#ffffff" : "#64748b",
                  boxShadow: authTab === "login" ? "0 2px 6px rgba(37,99,235,0.25)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                Partner Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("register")}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  background: authTab === "register" ? "#2563eb" : "transparent",
                  color: authTab === "register" ? "#ffffff" : "#64748b",
                  boxShadow: authTab === "register" ? "0 2px 6px rgba(37,99,235,0.25)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                Apply as New Partner
              </button>
            </div>

            {authTab === "login" ? (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {loginError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#b91c1c", fontWeight: 600 }}>
                    {loginError}
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Registered Email or Referral Code
                  </label>
                  <input
                    id="partner-login-input"
                    type="text"
                    required
                    placeholder="e.g. partner.voyage@zelevos.travel or ZELVOYAGE17"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    style={{ width: "100%", height: "44px", padding: "0 12px", background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: "10px", color: "#0f172a", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <button
                  id="partner-login-btn"
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    height: "46px",
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "10px",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: loginLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {loginLoading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  <span>Sign In to Partner Portal</span>
                </button>

                {/* Quick Test Demo Chips */}
                <div style={{ marginTop: "14px", borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "8px", textTransform: "uppercase", fontWeight: 700 }}>
                    Quick Demo Accounts (Click to test):
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      id="demo-chip-zelvoyage17"
                      type="button"
                      onClick={() => setLoginIdentifier("ZELVOYAGE17")}
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: 700 }}
                    >
                      Voyage Luxury (ZELVOYAGE17)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginIdentifier("partner.voyage@zelevos.travel")}
                      style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: 700 }}
                    >
                      Voyage Holidays Email
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {regError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#b91c1c", fontWeight: 600 }}>
                    {regError}
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Agency / Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Escapes India"
                    value={regAgency}
                    onChange={(e) => setRegAgency(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Primary Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Singhania"
                    value={regContact}
                    onChange={(e) => setRegContact(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ananya@royalescapes.in"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98200 11223"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={regLoading}
                  style={{
                    height: "44px",
                    background: "#059669",
                    border: "none",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: regLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    marginTop: "6px",
                    boxShadow: "0 4px 10px rgba(5,150,105,0.25)",
                  }}
                >
                  {regLoading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Activate Partner Account & Get Referral Code</span>
                </button>
              </form>
            )}

            {/* Privacy notice */}
            <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <ShieldCheck size={16} color="#059669" />
              <span>Strict Privacy: You only see your own referral earnings. Corporate admin operations remain completely isolated.</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. Authenticated Dedicated Partner Portal Dashboard
  // --------------------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", display: "flex", flexDirection: "column" }}>
      {/* Top Navbar */}
      <header style={{ background: "#0f172a", color: "#ffffff", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "20px", fontWeight: 900, color: "#38bdf8", cursor: "pointer" }} onClick={() => setLocation("/")}>
            Zelevos
          </span>
          <span style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
            Partner Workspace
          </span>
          <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
            {partner?.agencyName} <span style={{ opacity: 0.5 }}>({partner?.contactName})</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", background: "#065f46", color: "#a7f3d0", padding: "4px 10px", borderRadius: "20px", fontWeight: 700 }}>
            ● ACTIVE PARTNER
          </span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#ffffff",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "28px 20px", flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Hero Referral Banner Card */}
        <div style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", borderRadius: "16px", padding: "24px", color: "#ffffff", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "20px", boxShadow: "0 10px 25px -5px rgba(29,78,216,0.3)" }}>
          <div style={{ maxWidth: "580px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(255,255,255,0.15)", padding: "3px 8px", borderRadius: "6px" }}>
              YOUR OFFICIAL ATTRIBUTION KIT
            </span>
            <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "10px 0 6px" }}>
              Share with Travellers. Earn {partner?.commissionRatePercent || "5.0"}% Real-Time Commission.
            </h2>
            <p style={{ fontSize: "13px", opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
              Whenever a customer books any curated holiday or custom tour using your code or link, commission is automatically logged in your private ledger.
            </p>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "16px 20px", color: "#0f172a", display: "flex", flexDirection: "column", gap: "10px", minWidth: "260px" }}>
            <div>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 800, display: "block" }}>
                REFERRAL CODE
              </span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <strong style={{ fontSize: "20px", fontFamily: "monospace", color: "#1d4ed8", letterSpacing: "0.05em" }}>
                  {partner?.referralCode}
                </strong>
                <button
                  type="button"
                  onClick={() => copyToClipboard(partner?.referralCode || "")}
                  style={{ background: copiedCode ? "#ecfdf5" : "#eff6ff", border: "1px solid #bfdbfe", color: copiedCode ? "#059669" : "#2563eb", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 800, display: "block" }}>
                SHAREABLE LINK
              </span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <span style={{ fontSize: "11px", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                  {partner?.referralLink}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(partner?.referralLink || "", true)}
                  style={{ background: copiedLink ? "#ecfdf5" : "#eff6ff", border: "1px solid #bfdbfe", color: copiedLink ? "#059669" : "#2563eb", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  {copiedLink ? <Check size={12} /> : <Share2 size={12} />}
                  <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Financial & KPI Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Total Attributed Trips</span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px" }}>
              {commissions.length}
            </div>
            <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600 }}>Active referral tracking</span>
          </div>

          <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Gross Booking Value</span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px" }}>
              ₹{totalBookingValue.toLocaleString("en-IN")}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Total holiday sales generated</span>
          </div>

          <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Total Commission Earned</span>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#059669", margin: "6px 0 2px" }}>
              ₹{totalEarned.toLocaleString("en-IN")}
            </div>
            <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>Calculated at {partner?.commissionRatePercent || "5.0"}% rate</span>
          </div>

          <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Payout Status</span>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#1d4ed8", margin: "8px 0 4px" }}>
              ₹{paidOut.toLocaleString("en-IN")} <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>Paid</span>
            </div>
            <span style={{ fontSize: "11px", color: pendingPayout > 0 ? "#d97706" : "#64748b", fontWeight: 600 }}>
              {pendingPayout > 0 ? `₹${pendingPayout.toLocaleString("en-IN")} Pending Settlement` : "All commissions cleared"}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" }}>
          <button
            id="tab-btn-ledger"
            type="button"
            onClick={() => setActiveTab("ledger")}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "ledger" ? "3px solid #2563eb" : "3px solid transparent",
              color: activeTab === "ledger" ? "#2563eb" : "#64748b",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            My Referral Bookings & Commission Ledger ({commissions.length})
          </button>
          <button
            id="tab-btn-leads"
            type="button"
            onClick={() => setActiveTab("leads")}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "leads" ? "3px solid #2563eb" : "3px solid transparent",
              color: activeTab === "leads" ? "#2563eb" : "#64748b",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Submit Client Holiday Request (Concierge)
          </button>
          <button
            id="tab-btn-payouts"
            type="button"
            onClick={() => setActiveTab("payouts")}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "payouts" ? "3px solid #2563eb" : "3px solid transparent",
              color: activeTab === "payouts" ? "#2563eb" : "#64748b",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Bank & Payout Details
          </button>
        </div>

        {/* Tab 1: Commission Ledger Table */}
        {activeTab === "ledger" && (
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>Private Commission Ledger</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Live record of customer bookings tracked under code <strong>{partner?.referralCode}</strong>.</span>
              </div>
              <button
                type="button"
                onClick={checkPartnerSession}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Booking Ref</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Booking Amount</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Commission Rate</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Your Earned Commission</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Payout Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "36px 20px", textAlign: "center", color: "#64748b" }}>
                      <Briefcase size={28} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                      <p style={{ margin: "4px 0", fontWeight: 600, color: "#334155" }}>No bookings logged under your referral code yet.</p>
                      <p style={{ margin: 0, fontSize: "12px" }}>Share your referral link <code>{partner?.referralLink}</code> with clients to see real-time earnings here.</p>
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#2563eb", fontWeight: 700 }}>
                        {c.bookingRef || c.bookingId?.slice(0, 10)}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>
                        ₹{(c.bookingAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>
                        {c.commissionPercent || partner?.commissionRatePercent || "5.0"}%
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <strong style={{ color: "#059669", fontSize: "14px" }}>
                          ₹{(c.commissionAmount || 0).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: c.status === "paid" ? "#ecfdf5" : "#eff6ff",
                            color: c.status === "paid" ? "#047857" : "#1d4ed8",
                            fontWeight: 700,
                            fontSize: "11px",
                            textTransform: "uppercase",
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Submit Client Holiday Lead */}
        {activeTab === "leads" && (
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Submit Custom Holiday Request for a Client</h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Planning a trip for your VIP customer? Submit their travel requirements here. Zelevos Concierge will craft the itinerary and attribute the booking to your partner account.
              </p>
            </div>

            {leadSuccess && (
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, marginBottom: "18px" }}>
                ✓ {leadSuccess}
              </div>
            )}

            <form onSubmit={handleLeadSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Client Full Name *</label>
                <input
                  id="lead-name-input"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={leadCustomerName}
                  onChange={(e) => setLeadCustomerName(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Client Email *</label>
                <input
                  id="lead-email-input"
                  type="email"
                  required
                  placeholder="e.g. ramesh.chandra@gmail.com"
                  value={leadCustomerEmail}
                  onChange={(e) => setLeadCustomerEmail(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Client Phone Number *</label>
                <input
                  id="lead-phone-input"
                  type="tel"
                  required
                  placeholder="e.g. +91 98111 22334"
                  value={leadCustomerPhone}
                  onChange={(e) => setLeadCustomerPhone(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Destination *</label>
                <select
                  id="lead-destination-select"
                  value={leadDestination}
                  onChange={(e) => setLeadDestination(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="Kashmir">Kashmir (Srinagar, Gulmarg, Pahalgam)</option>
                  <option value="Ladakh">Ladakh (Leh, Nubra, Pangong)</option>
                  <option value="Kerala">Kerala (Munnar, Alleppey, Kovalam)</option>
                  <option value="Rajasthan">Rajasthan (Jaipur, Udaipur, Jodhpur)</option>
                  <option value="Goa">Goa (North & South Luxury Villas)</option>
                  <option value="Himachal">Himachal Pradesh (Manali, Shimla)</option>
                  <option value="Andaman">Andaman & Nicobar Islands</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Travellers Count</label>
                <input
                  id="lead-travellers-input"
                  type="number"
                  min={1}
                  max={50}
                  value={leadTravellers}
                  onChange={(e) => setLeadTravellers(Number(e.target.value))}
                  style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Approx Budget (₹ per person)</label>
                <input
                  id="lead-budget-input"
                  type="number"
                  min={5000}
                  step={5000}
                  value={leadBudget}
                  onChange={(e) => setLeadBudget(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Special Requirements / Hotels Preference</label>
                <textarea
                  id="lead-notes-textarea"
                  rows={3}
                  placeholder="e.g. 5-star hotel in Gulmarg with heated rooms, private Innova cab throughout, vegetarian meal plan..."
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", resize: "vertical" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button
                  id="lead-submit-btn"
                  type="submit"
                  disabled={leadLoading}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 24px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: leadLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {leadLoading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  <span>Submit Client Request to Zelevos Concierge</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Bank & Payout Information */}
        {activeTab === "payouts" && (
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Direct Commission Payout Details</h3>
            <p style={{ margin: "4px 0 20px", fontSize: "13px", color: "#64748b" }}>
              Commissions are settled directly to your registered bank account or UPI ID every Monday.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", maxWidth: "700px" }}>
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, display: "block" }}>REGISTERED AGENCY</span>
                <strong style={{ fontSize: "15px", color: "#0f172a" }}>{partner?.agencyName}</strong>
              </div>
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, display: "block" }}>ACCOUNT CONTACT</span>
                <strong style={{ fontSize: "15px", color: "#0f172a" }}>{partner?.contactName}</strong>
              </div>
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, display: "block" }}>PHONE / UPI LINKED</span>
                <strong style={{ fontSize: "15px", color: "#0f172a" }}>{partner?.phone}</strong>
              </div>
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, display: "block" }}>CURRENT COMMISSION RATE</span>
                <strong style={{ fontSize: "15px", color: "#059669" }}>{partner?.commissionRatePercent || "5.0"}% Per Booking</strong>
              </div>
            </div>

            <div style={{ marginTop: "24px", padding: "14px", background: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe", fontSize: "12px", color: "#1e40af", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={18} />
              <span>To update your bank account or GSTIN details, contact Zelevos Partner Desk at <strong>partners@zelevos.com</strong>.</span>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)", zIndex: 99999 }}>
          <Check size={16} color="#10b981" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
