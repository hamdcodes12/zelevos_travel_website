import React, { useState, useEffect } from "react";
import {
  Users2,
  Link2,
  DollarSign,
  Check,
  RefreshCw,
  Plus,
  Tag,
  Search,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Pause,
  Play,
  Ban,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  X,
  Percent,
} from "lucide-react";

interface AdminPartnerTabProps {
  onToast: (msg: string) => void;
}

type PartnerTabKey = "all" | "pending" | "approved" | "suspended" | "rejected" | "banned" | "removed";

export function AdminPartnerTab({ onToast }: AdminPartnerTabProps) {
  const [partners, setPartners] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    all: 0,
    pending: 0,
    approved: 0,
    suspended: 0,
    rejected: 0,
    banned: 0,
    removed: 0,
  });
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PartnerTabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Register Partner Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    agencyName: "",
    contactName: "",
    email: "",
    phone: "",
    commissionPercent: 10,
    discountPercent: 5,
  });

  // Action Confirmation Modal (approve, reject, suspend, lift_suspension, ban, unban, remove, restore)
  const [actionTarget, setActionTarget] = useState<{
    partner: any;
    action: "approve" | "reject" | "suspend" | "lift_suspension" | "ban" | "unban" | "remove" | "restore";
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [suspensionType, setSuspensionType] = useState<"TEMPORARY" | "PERMANENT">("TEMPORARY");
  const [suspensionUntil, setSuspensionUntil] = useState<string>(() => {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  });
  const [actionProcessing, setActionProcessing] = useState(false);

  // Edit Partner Terms Modal
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    commissionPercent: 10,
    discountType: "PERCENTAGE",
    discountValue: 5,
    discountEnabled: true,
  });
  const [editingProcessing, setEditingProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab && activeTab !== "all") params.append("status", activeTab);
      if (searchQuery) params.append("search", searchQuery);

      const [partsRes, commsRes] = await Promise.all([
        fetch(`/api/admin/partners?${params.toString()}`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : { partners: [], counts: {} }))
          .catch(() => ({ partners: [], counts: {} })),
        fetch("/api/partners/ledger", { credentials: "include" })
          .then(async (r) => {
            if (!r.ok) return { commissions: [] };
            const text = await r.text();
            try {
              return text ? JSON.parse(text) : { commissions: [] };
            } catch {
              return { commissions: [] };
            }
          })
          .catch(() => ({ commissions: [] })),
      ]);

      setPartners(Array.isArray(partsRes.partners) ? partsRes.partners : []);
      if (partsRes.counts) {
        setCounts(partsRes.counts);
      }
      setCommissions(Array.isArray(commsRes.commissions) ? commsRes.commissions : []);
    } catch {
      onToast("Failed to load partner network data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    onToast(`Copied "${text}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.agencyName.trim() || !regForm.contactName.trim() || !regForm.email.trim() || !regForm.phone.trim()) {
      onToast("Please fill all required partner fields.");
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch("/api/partners/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agencyName: regForm.agencyName.trim(),
          contactName: regForm.contactName.trim(),
          email: regForm.email.trim().toLowerCase(),
          phone: regForm.phone.trim(),
          commissionPercent: Number(regForm.commissionPercent) || 10,
          discountPercent: Number(regForm.discountPercent) || 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to register partner.");
      }

      onToast(`Partner "${data.partner?.agencyName}" registered with code: ${data.partner?.referralCode}`);
      setShowRegisterModal(false);
      setRegForm({
        agencyName: "",
        contactName: "",
        email: "",
        phone: "",
        commissionPercent: 10,
        discountPercent: 5,
      });
      loadData();
    } catch (err: any) {
      onToast(err.message || "Partner registration failed.");
    } finally {
      setRegistering(false);
    }
  };

  const handleExecuteStatusAction = async () => {
    if (!actionTarget) return;

    if ((actionTarget.action === "reject" || actionTarget.action === "ban") && !actionReason.trim()) {
      onToast(`Please provide a reason for ${actionTarget.action}.`);
      return;
    }
    if (actionTarget.action === "suspend" && suspensionType === "PERMANENT" && !actionReason.trim()) {
      onToast("Please provide a reason for permanent suspension.");
      return;
    }

    setActionProcessing(true);
    try {
      const res = await fetch(`/api/admin/partners/${actionTarget.partner.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: actionTarget.action,
          reason: actionReason.trim() || undefined,
          suspensionType: actionTarget.action === "suspend" ? suspensionType : undefined,
          suspensionUntil: actionTarget.action === "suspend" && suspensionType === "TEMPORARY" ? new Date(suspensionUntil).toISOString() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${actionTarget.action} partner.`);
      }

      onToast(data.message || `Partner updated successfully!`);
      setActionTarget(null);
      setActionReason("");
      loadData();
    } catch (err: any) {
      onToast(err.message || "Action failed.");
    } finally {
      setActionProcessing(false);
    }
  };

  const handleSavePartnerTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    setEditingProcessing(true);
    try {
      const res = await fetch(`/api/admin/partners/${editingPartner.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update",
          commissionPercent: Number(editForm.commissionPercent),
          discountType: editForm.discountType,
          discountValue: Number(editForm.discountValue),
          discountEnabled: Boolean(editForm.discountEnabled),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update partner terms.");

      onToast("Partner terms updated successfully!");
      setEditingPartner(null);
      loadData();
    } catch (err: any) {
      onToast(err.message || "Update failed.");
    } finally {
      setEditingProcessing(false);
    }
  };

  const renderStatusBadge = (partner: any) => {
    const s = (partner.status || "approved").toLowerCase();
    const isArchived = Boolean(partner.isArchived);

    if (isArchived || s === "removed") {
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
            color: "#64748b",
            border: "1px solid #cbd5e1",
          }}
        >
          <Trash2 size={12} />
          Archived / Removed
        </span>
      );
    }

    if (s === "approved" || s === "active") {
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
          <CheckCircle2 size={12} />
          Active / Approved
        </span>
      );
    }

    if (s === "pending") {
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
          <Clock size={12} />
          Pending Approval
        </span>
      );
    }

    if (s === "suspended") {
      let label = "Suspended";
      if (partner.suspensionUntil) {
        label = `Suspended until ${new Date(partner.suspensionUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      } else {
        label = "Permanently suspended";
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
            background: "#fff1f2",
            color: "#be123c",
            border: "1px solid #fecdd3",
          }}
        >
          <Pause size={12} />
          {label}
        </span>
      );
    }

    if (s === "banned") {
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
            background: "#450a0a",
            color: "#fecaca",
            border: "1px solid #7f1d1d",
          }}
        >
          <Ban size={12} />
          Banned
        </span>
      );
    }

    if (s === "rejected") {
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
          <XCircle size={12} />
          Rejected
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
          color: "#475569",
        }}
      >
        {s}
      </span>
    );
  };

  const tabs: { key: PartnerTabKey; label: string; count: number }[] = [
    { key: "all", label: "All Partners", count: counts.all || 0 },
    { key: "pending", label: "Pending", count: counts.pending || 0 },
    { key: "approved", label: "Approved / Active", count: counts.approved || 0 },
    { key: "suspended", label: "Suspended", count: counts.suspended || 0 },
    { key: "rejected", label: "Rejected", count: counts.rejected || 0 },
    { key: "banned", label: "Banned", count: counts.banned || 0 },
    { key: "removed", label: "Removed", count: counts.removed || 0 },
  ];

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Partner & Travel Agent Network
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Referral codes, commission contracts, customer discounts, and lifecycle management.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadData}
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

          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#2563eb",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Plus size={15} /> Add New Partner
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "4px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "8px 8px 0 0",
                fontSize: "13px",
                fontWeight: isActive ? 800 : 600,
                border: "none",
                background: isActive ? "#ffffff" : "transparent",
                color: isActive ? "#2563eb" : "#64748b",
                borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "9999px",
                  background: isActive ? "#eff6ff" : "#f1f5f9",
                  color: isActive ? "#2563eb" : "#64748b",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Directory Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "360px" }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search agency, code, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadData();
                }}
                style={{
                  width: "100%",
                  height: "36px",
                  padding: "0 12px 0 32px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="button"
              onClick={loadData}
              style={{
                height: "36px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Filter
            </button>
          </div>

          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Showing <strong>{partners.length}</strong> partners
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>Loading partner network...</p>
          </div>
        ) : partners.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
            <Users2 size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <h4 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>No partners found</h4>
            <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
              No partner records match the current status filter or search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
                loadData();
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
                  <th style={{ padding: "14px 18px" }}>Agency / Partner</th>
                  <th style={{ padding: "14px 16px" }}>Referral Code & Link</th>
                  <th style={{ padding: "14px 16px" }}>Contract Terms</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                  <th style={{ padding: "14px 16px" }}>Performance</th>
                  <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => {
                  const s = (p.status || "approved").toLowerCase();
                  const isArchived = Boolean(p.isArchived);
                  const refLink = `${window.location.origin}/?ref=${p.referralCode}`;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Agency Info */}
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                            {p.agencyName?.charAt(0)?.toUpperCase() || "P"}
                          </div>
                          <div>
                            <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>{p.agencyName}</strong>
                            <span style={{ fontSize: "12px", color: "#475569" }}>{p.contactName}</span>
                            <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", gap: "8px", marginTop: "2px" }}>
                              <span>{p.email}</span>
                              <span>·</span>
                              <span>{p.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Referral Code & Link */}
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "#f1f5f9",
                                color: "#1e40af",
                                fontWeight: 800,
                                fontFamily: "monospace",
                                fontSize: "12px",
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              {p.referralCode}
                            </span>
                            <button
                              type="button"
                              title="Copy Referral Code"
                              onClick={() => handleCopy(p.referralCode, `code-${p.id}`)}
                              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "2px" }}
                            >
                              {copiedCode === `code-${p.id}` ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "11px", color: "#64748b", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {refLink}
                            </span>
                            <button
                              type="button"
                              title="Copy Referral URL"
                              onClick={() => handleCopy(refLink, `link-${p.id}`)}
                              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "2px" }}
                            >
                              {copiedCode === `link-${p.id}` ? <Check size={13} color="#059669" /> : <Link2 size={13} />}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Financial Terms */}
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>
                            Commission: {p.commissionPercent ?? 10}%
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            Customer Discount: {p.discountEnabled !== false ? `${p.discountValue ?? 5}${p.discountType === "FLAT" ? " Flat" : "%"}` : "Disabled"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px" }}>
                        {renderStatusBadge(p)}
                        {p.rejectionReason && (
                          <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px" }}>
                            Reason: {p.rejectionReason}
                          </div>
                        )}
                        {p.banReason && (
                          <div style={{ fontSize: "11px", color: "#7f1d1d", marginTop: "4px" }}>
                            Ban Reason: {p.banReason}
                          </div>
                        )}
                        {p.suspensionReason && (
                          <div style={{ fontSize: "11px", color: "#b45309", marginTop: "4px" }}>
                            Note: {p.suspensionReason}
                          </div>
                        )}
                      </td>

                      {/* Performance */}
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>
                            {p.totalBookings || 0} Bookings
                          </span>
                          <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                            ₹{(p.totalEarned || 0).toLocaleString("en-IN")} Earned
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          {/* When Pending: Approve / Reject */}
                          {s === "pending" && !isArchived && (
                            <>
                              <button
                                type="button"
                                title="Approve Partner"
                                onClick={() => setActionTarget({ partner: p, action: "approve" })}
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
                                title="Reject Application"
                                onClick={() => setActionTarget({ partner: p, action: "reject" })}
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
                          )}

                          {/* When Active/Approved: Suspend / Ban / Edit / Remove */}
                          {(s === "approved" || s === "active") && !isArchived && (
                            <>
                              <button
                                type="button"
                                title="Edit Terms"
                                onClick={() => {
                                  setEditingPartner(p);
                                  setEditForm({
                                    commissionPercent: p.commissionPercent ?? 10,
                                    discountType: p.discountType || "PERCENTAGE",
                                    discountValue: p.discountValue ?? 5,
                                    discountEnabled: p.discountEnabled !== false,
                                  });
                                }}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  background: "#f8fafc",
                                  color: "#475569",
                                  border: "1px solid #cbd5e1",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                <Edit2 size={12} />
                                <span>Terms</span>
                              </button>

                              <button
                                type="button"
                                title="Suspend Partner"
                                onClick={() => setActionTarget({ partner: p, action: "suspend" })}
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
                                <Pause size={12} />
                                <span>Suspend</span>
                              </button>

                              <button
                                type="button"
                                title="Ban Partner"
                                onClick={() => setActionTarget({ partner: p, action: "ban" })}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  cursor: "pointer",
                                }}
                              >
                                <Ban size={13} />
                              </button>

                              <button
                                type="button"
                                title="Remove Partner"
                                onClick={() => setActionTarget({ partner: p, action: "remove" })}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  background: "#f8fafc",
                                  color: "#94a3b8",
                                  border: "1px solid #e2e8f0",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}

                          {/* When Suspended: Lift Suspension / Ban / Remove */}
                          {s === "suspended" && !isArchived && (
                            <>
                              <button
                                type="button"
                                title="Lift Suspension"
                                onClick={() => setActionTarget({ partner: p, action: "lift_suspension" })}
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
                                <Play size={12} />
                                <span>Lift Suspension</span>
                              </button>

                              <button
                                type="button"
                                title="Ban Partner"
                                onClick={() => setActionTarget({ partner: p, action: "ban" })}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  cursor: "pointer",
                                }}
                              >
                                <Ban size={13} />
                              </button>

                              <button
                                type="button"
                                title="Remove Partner"
                                onClick={() => setActionTarget({ partner: p, action: "remove" })}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  background: "#f8fafc",
                                  color: "#94a3b8",
                                  border: "1px solid #e2e8f0",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}

                          {/* When Banned: Unban / Remove */}
                          {s === "banned" && !isArchived && (
                            <>
                              <button
                                type="button"
                                title="Unban Partner"
                                onClick={() => setActionTarget({ partner: p, action: "unban" })}
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
                                <RotateCcw size={12} />
                                <span>Unban</span>
                              </button>

                              <button
                                type="button"
                                title="Remove Partner"
                                onClick={() => setActionTarget({ partner: p, action: "remove" })}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  background: "#f8fafc",
                                  color: "#94a3b8",
                                  border: "1px solid #e2e8f0",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}

                          {/* When Rejected: Re-Approve / Remove */}
                          {s === "rejected" && !isArchived && (
                            <>
                              <button
                                type="button"
                                title="Approve Partner"
                                onClick={() => setActionTarget({ partner: p, action: "approve" })}
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
                                <Check size={12} />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                title="Remove Partner"
                                onClick={() => setActionTarget({ partner: p, action: "remove" })}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  background: "#f8fafc",
                                  color: "#94a3b8",
                                  border: "1px solid #e2e8f0",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}

                          {/* When Removed / Archived: Restore */}
                          {isArchived && (
                            <button
                              type="button"
                              title="Restore Partner Account"
                              onClick={() => setActionTarget({ partner: p, action: "restore" })}
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
                              <RotateCcw size={12} />
                              <span>Restore</span>
                            </button>
                          )}
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

      {/* Action Confirmation Modal */}
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
                ? "Approve Partner"
                : actionTarget.action === "reject"
                ? "Reject Partner Application"
                : actionTarget.action === "suspend"
                ? "Suspend Partner"
                : actionTarget.action === "lift_suspension"
                ? "Lift Partner Suspension"
                : actionTarget.action === "ban"
                ? "Ban Partner Account"
                : actionTarget.action === "unban"
                ? "Unban Partner Account"
                : actionTarget.action === "remove"
                ? "Remove / Archive Partner"
                : "Restore Partner Account"}
            </h4>

            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
              {actionTarget.action === "approve"
                ? `Are you sure you want to approve "${actionTarget.partner.agencyName}"? Their referral code "${actionTarget.partner.referralCode}" will become active immediately.`
                : actionTarget.action === "lift_suspension"
                ? `Reactivating "${actionTarget.partner.agencyName}" will restore referral booking tracking and partner portal access.`
                : actionTarget.action === "unban"
                ? `Unbanning "${actionTarget.partner.agencyName}" will restore their approved status.`
                : actionTarget.action === "remove"
                ? `Removing "${actionTarget.partner.agencyName}" will archive the partner record and deactivate all associated referral links.`
                : actionTarget.action === "restore"
                ? `Restore "${actionTarget.partner.agencyName}" to active partner status?`
                : `Specify details for ${actionTarget.action} on "${actionTarget.partner.agencyName}".`}
            </p>

            {/* Suspend Options */}
            {actionTarget.action === "suspend" && (
              <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155" }}>
                  Suspension Duration:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: suspensionType === "TEMPORARY" ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                      background: suspensionType === "TEMPORARY" ? "#eff6ff" : "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="partnerSuspensionType"
                      checked={suspensionType === "TEMPORARY"}
                      onChange={() => setSuspensionType("TEMPORARY")}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Until a specific date</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Partner referral link and portal access will automatically regain active status on this date.</div>
                      {suspensionType === "TEMPORARY" && (
                        <div style={{ marginTop: "8px" }}>
                          <input
                            type="date"
                            value={suspensionUntil}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setSuspensionUntil(e.target.value)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                              background: "#ffffff",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: suspensionType === "PERMANENT" ? "1px solid #ef4444" : "1px solid #e2e8f0",
                      background: suspensionType === "PERMANENT" ? "#fef2f2" : "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="partnerSuspensionType"
                      checked={suspensionType === "PERMANENT"}
                      onChange={() => setSuspensionType("PERMANENT")}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Permanent / until manually lifted</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Referral code deactivated until admin manually restores account. Reason required.</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Reason Textarea */}
            {(actionTarget.action === "reject" || actionTarget.action === "ban" || actionTarget.action === "suspend") && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Reason / Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={
                    actionTarget.action === "reject"
                      ? "e.g. Unverified agency credentials or invalid registration."
                      : actionTarget.action === "ban"
                      ? "e.g. Serious policy violation, fraudulent bookings, or spam."
                      : "e.g. Investigation of referral misuse or temporary compliance hold."
                  }
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }}
                />
              </div>
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
                    actionTarget.action === "approve" || actionTarget.action === "lift_suspension" || actionTarget.action === "restore"
                      ? "#059669"
                      : actionTarget.action === "suspend"
                      ? "#d97706"
                      : "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: actionProcessing ? "not-allowed" : "pointer",
                }}
              >
                {actionProcessing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Terms Modal */}
      {editingPartner && (
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
            if (e.target === e.currentTarget && !editingProcessing) setEditingPartner(null);
          }}
        >
          <div style={{ width: "min(100%, 480px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                Edit Terms: {editingPartner.agencyName}
              </h4>
              <button type="button" onClick={() => setEditingPartner(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePartnerTerms} style={{ display: "grid", gap: "14px", fontSize: "13px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Partner Commission Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  value={editForm.commissionPercent}
                  onChange={(e) => setEditForm({ ...editForm, commissionPercent: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Customer Discount Type
                  </label>
                  <select
                    value={editForm.discountType}
                    onChange={(e) => setEditForm({ ...editForm, discountType: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editForm.discountValue}
                    onChange={(e) => setEditForm({ ...editForm, discountValue: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  checked={editForm.discountEnabled}
                  onChange={(e) => setEditForm({ ...editForm, discountEnabled: e.target.checked })}
                />
                <span style={{ fontSize: "12px", color: "#334155", fontWeight: 600 }}>Enable Customer Discount for this code</span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingProcessing}
                  style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#0f172a", color: "#ffffff", fontWeight: 700 }}
                >
                  {editingProcessing ? "Saving..." : "Save Terms"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Partner Modal */}
      {showRegisterModal && (
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
            if (e.target === e.currentTarget && !registering) setShowRegisterModal(false);
          }}
        >
          <div style={{ width: "min(100%, 520px)", background: "#ffffff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                Register Partner / Travel Agent Account
              </h3>
              <button type="button" onClick={() => setShowRegisterModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterPartner} style={{ display: "grid", gap: "12px", fontSize: "13px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Agency Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Voyage Holidays India"
                    value={regForm.agencyName}
                    onChange={(e) => setRegForm({ ...regForm, agencyName: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohit Mehra"
                    value={regForm.contactName}
                    onChange={(e) => setRegForm({ ...regForm, contactName: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="partner@agency.com"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Partner Commission (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={regForm.commissionPercent}
                    onChange={(e) => setRegForm({ ...regForm, commissionPercent: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Customer Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={regForm.discountPercent}
                    onChange={(e) => setRegForm({ ...regForm, discountPercent: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: registering ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {registering ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={15} />}
                  <span>Register Partner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partner Commission Ledger Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
            Partner Commission Ledger
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Real-time audit log of all bookings attributed to partner referral codes and automatic payout calculations.
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "12px 18px" }}>Partner / Agency</th>
              <th style={{ padding: "12px 16px" }}>Booking Ref</th>
              <th style={{ padding: "12px 16px" }}>Booking Amount</th>
              <th style={{ padding: "12px 16px" }}>Commission Rate</th>
              <th style={{ padding: "12px 16px" }}>Earned Commission</th>
              <th style={{ padding: "12px 18px" }}>Payout Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  Loading commission ledger...
                </td>
              </tr>
            ) : commissions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  No referral bookings logged yet. When customers book using partner codes, entries appear here automatically.
                </td>
              </tr>
            ) : (
              commissions.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 18px" }}>
                    <strong style={{ display: "block", color: "#0f172a" }}>{c.agencyName || "Partner Agency"}</strong>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>{c.contactName}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#2563eb", fontWeight: 700 }}>
                    {c.bookingRef || c.bookingId?.slice(0, 8)}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600 }}>
                    ₹{(c.bookingAmount || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>
                    {c.commissionPercent || 5}%
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <strong style={{ color: "#059669" }}>
                      ₹{(c.commissionAmount || 0).toLocaleString("en-IN")}
                    </strong>
                  </td>
                  <td style={{ padding: "14px 18px" }}>
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
    </div>
  );
}
