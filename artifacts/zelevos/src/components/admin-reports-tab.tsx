import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  DollarSign,
  TrendingUp,
  Plane,
  RefreshCw,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

interface AdminReportsTabProps {
  onToast: (msg: string) => void;
}

interface AnalyticsData {
  metrics: {
    totalBookings: number;
    totalRevenue: number;
    confirmedCount: number;
    pendingCount: number;
    cancelledCount: number;
    refundedCount: number;
    averageOrderValue: number;
  };
  categoryBreakdown: Array<{
    name: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    key: string;
    name: string;
    bookings: number;
    revenue: number;
  }>;
  topDestinations: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
}

export function AdminReportsTab({ onToast }: AdminReportsTabProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports/analytics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
    } catch {
      onToast("Failed to fetch reports analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/reports/export-csv", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zelevos-bookings-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onToast("CSV Report downloaded successfully!");
    } catch {
      onToast("Failed to export CSV report.");
    } finally {
      setExporting(false);
    }
  };

  const metrics = data?.metrics || {
    totalBookings: 0,
    totalRevenue: 0,
    confirmedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    refundedCount: 0,
    averageOrderValue: 0,
  };

  const maxMonthlyRevenue = Math.max(...(data?.monthlyTrends.map((m) => m.revenue) || [1]), 1);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Top Header & Export Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={22} className="text-blue-600" />
            Executive Reports & Analytics
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Real-time multi-category revenue analytics, booking volume distribution, and financial trends.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
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
            id="admin-export-csv-btn"
            onClick={() => void handleExportCSV()}
            disabled={exporting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#059669",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: exporting ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(5, 150, 105, 0.2)",
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{exporting ? "Generating CSV..." : "Export Full CSV Report"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
            <span>Gross Platform Revenue</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "8px" }}>
            ₹{metrics.totalRevenue.toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>Realized customer collections</span>
        </div>

        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
            <span>Total Bookings</span>
            <Plane size={16} className="text-blue-600" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "8px" }}>
            {metrics.totalBookings}
          </div>
          <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 600 }}>
            {metrics.confirmedCount} Confirmed · {metrics.pendingCount} Pending
          </span>
        </div>

        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
            <span>Avg Order Value (AOV)</span>
            <TrendingUp size={16} className="text-indigo-600" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "8px" }}>
            ₹{metrics.averageOrderValue.toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Per confirmed itinerary</span>
        </div>

        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
            <span>Cancellation Rate</span>
            <AlertCircle size={16} className="text-amber-600" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "8px" }}>
            {metrics.totalBookings > 0 ? `${Math.round(((metrics.cancelledCount + metrics.refundedCount) / metrics.totalBookings) * 100)}%` : "0%"}
          </div>
          <span style={{ fontSize: "11px", color: "#d97706", fontWeight: 600 }}>
            {metrics.cancelledCount} cancelled, {metrics.refundedCount} refunded
          </span>
        </div>
      </div>

      {/* Two Columns: Revenue by Category & Monthly Trends */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px" }}>
        {/* 1. Revenue by Category */}
        <div style={{ background: "#ffffff", padding: "22px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={17} className="text-indigo-600" /> Revenue by Category
          </h3>

          <div style={{ display: "grid", gap: "14px" }}>
            {(data?.categoryBreakdown || []).map((cat, idx) => {
              const colors = ["#2563eb", "#7c3aed", "#059669", "#d97706"];
              const color = colors[idx % colors.length];
              return (
                <div key={cat.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, color: "#334155" }}>{cat.name}</span>
                    <span style={{ color: "#64748b" }}>
                      <strong>₹{cat.revenue.toLocaleString("en-IN")}</strong> ({cat.count} bookings · {cat.percentage}%)
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.max(cat.percentage, cat.count > 0 ? 5 : 0)}%`,
                        height: "100%",
                        background: color,
                        borderRadius: "4px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Monthly Revenue Trend Chart */}
        <div style={{ background: "#ffffff", padding: "22px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={17} className="text-blue-600" /> Monthly Revenue & Booking Trends
          </h3>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "180px", paddingTop: "20px" }}>
            {(data?.monthlyTrends || []).map((m) => {
              const heightPct = maxMonthlyRevenue > 0 ? Math.round((m.revenue / maxMonthlyRevenue) * 100) : 0;
              return (
                <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#2563eb", marginBottom: "4px" }}>
                    {m.revenue > 0 ? `₹${(m.revenue / 1000).toFixed(0)}k` : "—"}
                  </span>
                  <div
                    title={`${m.name}: ₹${m.revenue.toLocaleString("en-IN")} (${m.bookings} bookings)`}
                    style={{
                      width: "100%",
                      maxWidth: "36px",
                      height: `${Math.max(heightPct, 6)}%`,
                      background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
                      borderRadius: "6px 6px 0 0",
                      transition: "height 0.4s ease",
                      cursor: "pointer",
                    }}
                  />
                  <span style={{ fontSize: "10px", color: "#64748b", marginTop: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                    {m.name.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Destinations Leaderboard */}
      <div style={{ background: "#ffffff", padding: "22px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
          <MapPin size={17} className="text-rose-600" /> Top Destinations by Revenue Volume
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {(data?.topDestinations || []).length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "13px" }}>No destination volume records yet.</p>
          ) : (
            (data?.topDestinations || []).map((dest, i) => (
              <div
                key={dest.name}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb" }}>#{i + 1}</span>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>{dest.name}</strong>
                </div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#059669" }}>
                  ₹{dest.revenue.toLocaleString("en-IN")}
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>{dest.count} trips booked</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
