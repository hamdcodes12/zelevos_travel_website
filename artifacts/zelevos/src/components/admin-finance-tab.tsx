import React, { useState, useEffect } from "react";
import { DollarSign, TrendingUp, CheckCircle2, AlertCircle, RefreshCw, Check, ArrowRight } from "lucide-react";

export function AdminFinanceTab({ onToast }: { onToast: (msg: string) => void }) {
  const [overview, setOverview] = useState<any | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, ledRes, refRes] = await Promise.all([
        fetch("/api/finance/overview", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/finance/bookings", { credentials: "include" }).then((r) => (r.ok ? r.json() : { ledger: [] })),
        fetch("/api/finance/refunds", { credentials: "include" }).then((r) => (r.ok ? r.json() : { refunds: [] })),
      ]);
      setOverview(ovRes?.overview || null);
      setLedger(Array.isArray(ledRes.ledger) ? ledRes.ledger : []);
      setRefunds(Array.isArray(refRes.refunds) ? refRes.refunds : []);
    } catch (err) {
      onToast("Failed to load financial records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveRefund = async (refundId: string) => {
    setApprovingId(refundId);
    try {
      const res = await fetch(`/api/finance/refunds/${refundId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: "Refund approved by Finance Executive." }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to approve refund.");
      }

      onToast("Refund approved successfully!");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Approval failed.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Financial Overview & Booking Margin Ledger (Section 15 & 23)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Customer payments, verified supplier net costs, realized gross margins, and refund processing.
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

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Customer Collections
          </span>
          <div id="finance-total-collections" style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
            ₹{Number(overview?.totalCustomerCollections || 0).toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 600 }}>Total received</span>
        </div>

        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Supplier Net Costs
          </span>
          <div id="finance-supplier-costs" style={{ fontSize: "26px", fontWeight: 800, color: "#64748b", marginTop: "4px" }}>
            ₹{Number(overview?.totalSupplierBaseCost || 0).toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Supplier payables</span>
        </div>

        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Realized Gross Margin
          </span>
          <div id="finance-gross-margin" style={{ fontSize: "26px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
            ₹{Number(overview?.totalRealizedGrossMargin || 0).toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>
            Margin: {overview?.marginPercent || 0}%
          </span>
        </div>

        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Pending Refunds
          </span>
          <div id="finance-pending-refunds" style={{ fontSize: "26px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>
            {overview?.pendingRefundsCount || 0}
          </div>
          <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>Awaiting approval</span>
        </div>
      </div>

      {/* REFUND APPROVAL QUEUE */}
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
            Refund Approval Queue
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Customer cancellation requests requiring finance authorization.
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Refund ID / Booking</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Refund Amount</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Cancellation Reason</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: "0 auto 6px" }} />
                  Loading refund requests...
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                  No pending refund requests. Cancel a booking in My Trips to test this flow.
                </td>
              </tr>
            ) : (
              refunds.map((r) => {
                const isRequested = r.status === "REQUESTED";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ display: "block", color: "#2563eb", fontFamily: "monospace" }}>
                        {r.bookingId?.slice(0, 8) || "ZL-BOOKING"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>ID: {r.id.slice(0, 8)}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#dc2626" }}>₹{(r.amount || 0).toLocaleString("en-IN")}</strong>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155" }}>
                      {r.reason || "Customer initiated cancellation"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: isRequested ? "#fef2f2" : "#ecfdf5",
                          color: isRequested ? "#b91c1c" : "#047857",
                          fontWeight: 700,
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      {isRequested ? (
                        <button
                          type="button"
                          id={`finance-approve-refund-btn-${r.id}`}
                          onClick={() => handleApproveRefund(r.id)}
                          disabled={approvingId === r.id}
                          style={{
                            padding: "6px 14px",
                            background: "#059669",
                            border: "none",
                            borderRadius: "6px",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: approvingId === r.id ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {approvingId === r.id ? <RefreshCw size={12} className="animate-spin" /> : <Check size={14} />}
                          <span>Approve Refund</span>
                        </button>
                      ) : (
                        <span style={{ color: "#059669", fontWeight: 700, fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={14} /> Approved
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* BOOKINGS MARGIN LEDGER TABLE */}
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
            Booking Margin & Supplier Cost Ledger
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Individual trip breakdown comparing customer collection against supplier net cost.
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Booking ID</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Travel Date</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Customer Paid</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Supplier Net Cost</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Realized Margin</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: "0 auto 6px" }} />
                  Loading margin ledger...
                </td>
              </tr>
            ) : ledger.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                  No bookings found in ledger.
                </td>
              </tr>
            ) : (
              ledger.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#2563eb", fontWeight: 800 }}>
                    {b.bookingId}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>
                    {b.travelDate || "2026-10-15"}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                    ₹{(b.totalPrice || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>
                    ₹{(b.computedSupplierCost || b.totalBaseCost || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <strong style={{ color: "#059669" }}>
                      ₹{(b.computedMargin || b.totalMarkup || 0).toLocaleString("en-IN")}
                    </strong>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontWeight: 700, color: "#059669" }}>
                      {b.computedMarginPercent || 25}%
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
