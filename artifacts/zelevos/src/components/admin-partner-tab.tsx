import React, { useState, useEffect } from "react";
import { Users2, Link2, DollarSign, Check, RefreshCw, Plus, Tag, ArrowRight } from "lucide-react";

export function AdminPartnerTab({ onToast }: { onToast: (msg: string) => void }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Register Form
  const [agencyName, setAgencyName] = useState("Voyage Holidays India");
  const [contactName, setContactName] = useState("Rohit Mehra");
  const [email, setEmail] = useState("partner.voyage@zelevos.travel");
  const [phone, setPhone] = useState("+91 91234 56789");
  const [registering, setRegistering] = useState(false);
  const [registeredResult, setRegisteredResult] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [partsRes, commsRes] = await Promise.all([
        fetch("/api/admin/customers", { credentials: "include" }).catch(() => null),
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
      setCommissions(Array.isArray(commsRes.commissions) ? commsRes.commissions : []);
    } catch (err) {
      onToast("Failed to load partner data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);

    try {
      const res = await fetch("/api/partners/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyName,
          contactName,
          email,
          phone,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text || `Server responded with status ${res.status}`);
      }

      if (!res.ok || !data.partner) {
        throw new Error(data.message || "Registration failed.");
      }

      setRegisteredResult(data);
      onToast(`Partner registered! Referral code: ${data.partner.referralCode}`);
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to register partner.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Partner & Travel Agent Network (Section 13)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Referral code tracking, automated booking attribution, and partner commission ledger.
          </p>
        </div>
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
      </div>

      {/* Register Partner Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
          Register Partner / Travel Agent Account
        </h3>

        <form onSubmit={handleRegisterPartner} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Agency Name *
            </label>
            <input
              type="text"
              id="partner-agency-name"
              required
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Contact Name *
            </label>
            <input
              type="text"
              id="partner-contact-name"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Email *
            </label>
            <input
              type="email"
              id="partner-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Phone Number *
            </label>
            <input
              type="tel"
              id="partner-phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="submit"
              id="submit-partner-register-btn"
              disabled={registering}
              style={{
                width: "100%",
                height: "38px",
                background: "#2563eb",
                border: "none",
                borderRadius: "8px",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: registering ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {registering ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={15} />}
              <span>Register Partner</span>
            </button>
          </div>
        </form>

        {registeredResult && (
          <div
            id="partner-registered-banner"
            style={{
              marginTop: "16px",
              padding: "16px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <strong style={{ color: "#1e40af", fontSize: "14px", display: "block" }}>
                ✓ Partner Registered: {registeredResult.partner?.agencyName}
              </strong>
              <span style={{ fontSize: "12px", color: "#3b82f6" }}>
                Referral Link: <code>{registeredResult.referralLink}</code>
              </span>
            </div>
            <div style={{ background: "#ffffff", padding: "6px 14px", borderRadius: "8px", border: "1px solid #93c5fd" }}>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                Referral Code
              </span>
              <div id="active-referral-code" style={{ fontSize: "16px", fontWeight: 800, color: "#1d4ed8", fontFamily: "monospace" }}>
                {registeredResult.partner?.referralCode}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Partner Commission Ledger */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
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
            Track every booking made via referral codes and automated commission payouts.
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Partner / Agency</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Booking ID</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Booking Amount</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Commission Rate</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Earned Commission</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Payout Status</th>
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
                  No referral bookings logged yet. Make a booking using code <code>VOYAGE10</code> to see the ledger update.
                </td>
              </tr>
            ) : (
              commissions.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 16px" }}>
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
    </div>
  );
}
