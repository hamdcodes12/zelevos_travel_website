import { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Users,
  Building2,
  FileText,
} from "lucide-react";

interface ReportData {
  timeframe: { from: string; to: string };
  attendance: {
    totalScheduled: number;
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
  };
  production: {
    totalUnits: number;
    totalProductiveHours: number;
    avgProductivityRate: number;
    channelBreakdown: Record<string, number>;
  };
  quality: {
    totalEvaluations: number;
    passedEvaluations: number;
    passRate: number;
    avgScore: number;
  };
  compliance: {
    totalChecks: number;
    compliantChecks: number;
    complianceHealth: number;
    openCapas: number;
  };
}

interface Props {
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function BpoReportsSection({ api }: Props) {
  const [loading, setLoading] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [preset, setPreset] = useState<"today" | "yesterday" | "week" | "month" | "custom">("week");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [report, setReport] = useState<ReportData | null>(null);

  function applyPreset(p: "today" | "yesterday" | "week" | "month" | "custom") {
    setPreset(p);
    const now = new Date();
    if (p === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      setDateRange({ from: todayStr, to: todayStr });
    } else if (p === "yesterday") {
      const yestStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      setDateRange({ from: yestStr, to: yestStr });
    } else if (p === "week") {
      setDateRange({
        from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      });
    } else if (p === "month") {
      setDateRange({
        from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      });
    }
  }

  async function loadReport() {
    setLoading(true);
    try {
      const res = await api(`/bpo/operations/reports?from=${dateRange.from}&to=${dateRange.to}`);
      if (res.ok) {
        const d = await res.json();
        setReport(d);
      }
    } catch (err) {
      console.error("Failed to load operations report:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, [dateRange]);

  async function downloadCsv(type: "attendance" | "production" | "qa" | "compliance") {
    setExportingType(type);
    try {
      const token = localStorage.getItem("user_token");
      const url = `/api/bpo/operations/export?type=${type}&from=${dateRange.from}&to=${dateRange.to}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to download export");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${type}_export_${dateRange.from}_to_${dateRange.to}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExportingType(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              Phase 4 Delivery Reporting & Analytics
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <BarChart3 size={12} /> Real-Time Operations Telemetry
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Operations Reporting Console</h2>
          <p className="mt-1 text-xs text-slate-500">
            Synthesized reporting across workforce attendance, multi-channel production, QA calibration, and regulatory compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadReport()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Preset Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Preset:</span>
          {(["today", "yesterday", "week", "month", "custom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                preset === p ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => {
              setPreset("custom");
              setDateRange({ ...dateRange, from: e.target.value });
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-primary"
          />
          <span className="text-slate-400 font-bold">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => {
              setPreset("custom");
              setDateRange({ ...dateRange, to: e.target.value });
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* 4 Core Pillars Overview */}
      {report && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pillar 1: Attendance Performance */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Workforce Attendance</h3>
                  <p className="text-[11px] text-slate-400">Roster adherence & punctuality</p>
                </div>
              </div>
              <span className="text-2xl font-black text-blue-700">
                {report.attendance?.attendanceRate ?? 0}%
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Scheduled</span>
                <p className="mt-1 font-bold text-slate-900">{report.attendance?.totalScheduled ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600">Present</span>
                <p className="mt-1 font-bold text-emerald-800">{report.attendance?.present ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600">Late</span>
                <p className="mt-1 font-bold text-amber-800">{report.attendance?.late ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600">Absent</span>
                <p className="mt-1 font-bold text-rose-800">{report.attendance?.absent ?? 0}</p>
              </div>
            </div>

            <button
              onClick={() => downloadCsv("attendance")}
              disabled={exportingType === "attendance"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-blue-600" />
              {exportingType === "attendance" ? "Exporting CSV..." : "Export Attendance Records (CSV)"}
            </button>
          </div>

          {/* Pillar 2: Production Throughput */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Delivery Production</h3>
                  <p className="text-[11px] text-slate-400">Total volume & hourly output rate</p>
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-700">
                {report.production?.avgProductivityRate ?? "0.0"}{" "}
                <span className="text-xs font-bold text-slate-400">u/hr</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Volume</span>
                <p className="mt-1 font-bold text-slate-900">
                  {(report.production?.totalUnits ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Floor Hours</span>
                <p className="mt-1 font-bold text-slate-900">
                  {Number(report.production?.totalProductiveHours ?? 0).toFixed(1)}h
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Channels</span>
                <p className="mt-1 font-bold text-slate-900">
                  {Object.keys(report.production?.channelBreakdown || {}).length || 1} Active
                </p>
              </div>
            </div>

            <button
              onClick={() => downloadCsv("production")}
              disabled={exportingType === "production"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              {exportingType === "production" ? "Exporting CSV..." : "Export Production Records (CSV)"}
            </button>
          </div>

          {/* Pillar 3: Quality Assurance */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-purple-50 p-2 text-purple-600">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Quality Assurance</h3>
                  <p className="text-[11px] text-slate-400">Calibrated scoring & pass benchmark</p>
                </div>
              </div>
              <span className="text-2xl font-black text-purple-700">
                {report.quality?.avgScore ?? "0.0"}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Evaluations</span>
                <p className="mt-1 font-bold text-slate-900">{report.quality?.totalEvaluations ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Passed</span>
                <p className="mt-1 font-bold text-emerald-800">{report.quality?.passedEvaluations ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Pass Rate</span>
                <p className="mt-1 font-bold text-purple-900">{report.quality?.passRate ?? 100}%</p>
              </div>
            </div>

            <button
              onClick={() => downloadCsv("qa")}
              disabled={exportingType === "qa"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-purple-600" />
              {exportingType === "qa" ? "Exporting CSV..." : "Export QA Evaluations (CSV)"}
            </button>
          </div>

          {/* Pillar 4: Regulatory & Compliance */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Compliance & Governance</h3>
                  <p className="text-[11px] text-slate-400">Audit checks & remediation CAPA</p>
                </div>
              </div>
              <span className="text-2xl font-black text-amber-800">
                {report.compliance?.complianceHealth ?? 100}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Checks</span>
                <p className="mt-1 font-bold text-slate-900">{report.compliance?.totalChecks ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Compliant</span>
                <p className="mt-1 font-bold text-emerald-800">{report.compliance?.compliantChecks ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Open CAPAs</span>
                <p className="mt-1 font-bold text-amber-900">{report.compliance?.openCapas ?? 0}</p>
              </div>
            </div>

            <button
              onClick={() => downloadCsv("compliance")}
              disabled={exportingType === "compliance"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-amber-600" />
              {exportingType === "compliance" ? "Exporting CSV..." : "Export Compliance Audits (CSV)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
