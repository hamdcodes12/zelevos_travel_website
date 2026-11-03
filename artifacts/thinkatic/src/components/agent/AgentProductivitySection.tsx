import React from "react";
import {
  TrendingUp,
  Clock,
  PhoneCall,
  CheckCircle2,
  Target,
  BarChart3,
  Calendar,
  Layers,
  Award,
  AlertCircle,
} from "lucide-react";

interface AgentProductivitySectionProps {
  productivityData: any;
}

export const AgentProductivitySection: React.FC<AgentProductivitySectionProps> = ({
  productivityData,
}) => {
  const metrics = productivityData?.metrics || {};
  const weeklyTrend = productivityData?.weekly_trend || [];

  const totalCalls = metrics.total_calls_handled !== undefined ? metrics.total_calls_handled : 0;
  const overallProductivity = metrics.overall_productivity_percent !== undefined ? metrics.overall_productivity_percent : 0;
  const ahtFormatted = metrics.avg_handle_time_formatted || "0m 00s";
  const adherence = metrics.attendance_adherence_percent !== undefined ? metrics.attendance_adherence_percent : 0;
  const fcr = metrics.first_call_resolution_rate || "0%";
  const workedHours = metrics.total_working_hours || "00h 00m";

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Operations Analytics
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Productivity & Performance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real performance calculated dynamically from manual call dispositions, shift duration, and adherence benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#214ECF]">
          <BarChart3 className="w-4 h-4" />
          <span>Real Database Metrics</span>
        </div>
      </div>

      {/* ── METRIC CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Calls */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Calls Handled</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {totalCalls}{" "}
            <span className="text-xs font-normal text-slate-400">logged</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across active project assignments
          </div>
        </div>

        {/* Overall Productivity Rate */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Productivity Score</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#214ECF] mt-2">
            {overallProductivity}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Target benchmark: <strong className="text-slate-700">85%+</strong>
          </div>
        </div>

        {/* Average Handle Time (AHT) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Average Handle Time (AHT)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {ahtFormatted}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Target SLA: <strong className="text-slate-700">≤ 7m 00s (420s)</strong>
          </div>
        </div>

        {/* First Call Resolution Rate */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">First Call Resolution (FCR)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-2">
            {fcr}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Resolved without escalation
          </div>
        </div>

        {/* Attendance Adherence */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Attendance Adherence</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {adherence}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Scheduled vs actual logged shift adherence
          </div>
        </div>

        {/* Total Working Hours */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Worked Time</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {workedHours}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Recorded in past 7 operational cycles
          </div>
        </div>
      </div>

      {/* ── 7-DAY PERFORMANCE BREAKDOWN CHART / BARS ─────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">7-Day Daily Operational Trend</h3>
            <p className="text-xs text-slate-500">
              Calls logged and productivity percentages recorded per operational date.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">Past 7 Days</span>
        </div>

        {weeklyTrend.length === 0 || totalCalls === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">No Historical Performance Data Yet</div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              As you complete shifts and log manual calls, your daily performance trends will dynamically generate here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {weeklyTrend.map((day: any) => {
              const pct = day.productivity_percent || 0;
              return (
                <div key={day.date} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">{day.date}</span>
                      <span className="text-slate-400 font-normal">({day.day})</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-slate-600 font-normal">{day.calls} calls</span>
                      <span className="font-mono text-[#214ECF] font-bold">{pct}%</span>
                    </span>
                  </div>

                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 85
                          ? "bg-[#214ECF]"
                          : pct >= 50
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TARGET VS ACTUAL QUALITY BENCHMARKS ──────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#214ECF]" />
          Campaign SLA Benchmarks (Target vs Actual)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-slate-500 font-medium">Hourly Throughput Target</div>
            <div className="text-xl font-black text-slate-900 mt-1">6.5 cph</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Assigned Target: 6.5 calls/hour</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-slate-500 font-medium">Resolution Target</div>
            <div className="text-xl font-black text-slate-900 mt-1">88.0%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Current Actual: {fcr}</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-slate-500 font-medium">Maximum Handle Time (AHT)</div>
            <div className="text-xl font-black text-slate-900 mt-1">420s (7m)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Current Actual: {ahtFormatted}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
