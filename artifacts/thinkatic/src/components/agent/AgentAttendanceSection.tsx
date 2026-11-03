import React, { useState, useMemo } from "react";
import {
  Clock,
  Play,
  Pause,
  Square,
  Calendar,
  RotateCw,
  Coffee,
  History,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

interface AgentAttendanceSectionProps {
  todayShift: any;
  elapsedSeconds: number;
  formatStopwatch: (totalSec: number) => string;
  attendanceActionLoading: boolean;
  handleAttendance: (action: "start-shift" | "start-break" | "end-break" | "end-shift") => void;
  attendanceHistory: any[];
  agent: any;
  isRefreshingAttendance?: boolean;
  onRefreshAttendance?: () => void;
  lastRefreshedAt?: Date | null;
}

export const AgentAttendanceSection: React.FC<AgentAttendanceSectionProps> = ({
  todayShift,
  elapsedSeconds,
  formatStopwatch,
  attendanceActionLoading,
  handleAttendance,
  attendanceHistory,
  agent,
  isRefreshingAttendance = false,
  onRefreshAttendance,
  lastRefreshedAt,
}) => {
  const [historyFilter, setHistoryFilter] = useState<"today" | "7days" | "30days" | "all">("7days");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const currentState =
    todayShift?.state ||
    todayShift?.current_state ||
    (todayShift?.remarks?.startsWith("on_break")
      ? "on_break"
      : todayShift?.remarks === "checked_in"
      ? "checked_in"
      : "checked_out");

  const isCheckedIn = currentState === "checked_in";
  const isOnBreak = currentState === "on_break";
  const isCheckedOut = !currentState || currentState === "checked_out";

  const breakDisplay =
    todayShift?.total_break_minutes > 0
      ? `${todayShift.total_break_minutes}m`
      : todayShift?.total_break_seconds > 0
      ? `${todayShift.total_break_seconds}s`
      : "0m";

  // Filter history based on selected range
  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return attendanceHistory;
    const now = new Date();

    if (historyFilter === "today") {
      const todayStr = now.toISOString().split("T")[0];
      return attendanceHistory.filter((item) => item.date === todayStr);
    }

    if (historyFilter === "7days") {
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 7);
      return attendanceHistory.filter((item) => new Date(item.date) >= cutoff);
    }

    if (historyFilter === "30days") {
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 30);
      return attendanceHistory.filter((item) => new Date(item.date) >= cutoff);
    }

    return attendanceHistory;
  }, [attendanceHistory, historyFilter]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* ── HEADER WITH REFRESH BUTTON ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <Clock className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Shift Adherence & Attendance
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Attendance Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Check-in timestamps, break tracking, and daily shift hours are synchronized with authoritative server records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Manual Refresh Control */}
          <button
            onClick={onRefreshAttendance}
            disabled={isRefreshingAttendance}
            title="Refresh attendance"
            className="group relative inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#214ECF] hover:bg-blue-50/70 hover:border-blue-200 active:scale-95 transition-all duration-200 shadow-2xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <RotateCw
              className={`w-3.5 h-3.5 text-[#214ECF] transition-transform duration-300 ${
                isRefreshingAttendance ? "animate-spin" : "group-hover:rotate-45"
              }`}
            />
            <span>{isRefreshingAttendance ? "Refreshing..." : "Refresh"}</span>
          </button>

          {/* Today Date Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <Calendar className="w-4 h-4 text-[#214ECF]" />
            <span className="text-slate-500 font-medium">Today:</span>
            <span className="font-bold text-slate-900">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {lastRefreshedAt && (
            <span className="text-[11px] font-medium text-slate-400 hidden lg:inline-block">
              Updated just now
            </span>
          )}
        </div>
      </div>

      {/* ── LIVE SHIFT CLOCK CARD ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs text-center relative overflow-hidden">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold border mx-auto">
            <span
              className={`w-2 h-2 rounded-full ${
                isCheckedIn
                  ? "bg-emerald-500 animate-pulse"
                  : isOnBreak
                  ? "bg-amber-500"
                  : "bg-slate-400"
              }`}
            />
            <span
              className={
                isCheckedIn
                  ? "text-emerald-700"
                  : isOnBreak
                  ? "text-amber-700"
                  : "text-slate-600"
              }
            >
              {isCheckedIn
                ? "Active Shift (Working Time Counting)"
                : isOnBreak
                ? "Shift On Break (Timer Paused)"
                : "Shift Checked Out"}
            </span>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Today's Net Worked Duration
            </div>
            <div className="font-mono text-5xl sm:text-6xl font-black text-slate-900 tracking-tight mt-2">
              {isCheckedOut ? "00:00:00" : formatStopwatch(elapsedSeconds)}
            </div>

            {isOnBreak && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 mt-3">
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                <span>Break in-progress • Working timer paused</span>
              </div>
            )}
            {isCheckedIn && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 mt-3">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active operations • Live time recording</span>
              </div>
            )}
          </div>

          {/* Action Buttons (Perfect Centering Guaranteed) */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {isCheckedOut && (
              <button
                onClick={() => handleAttendance("start-shift")}
                disabled={attendanceActionLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{attendanceActionLoading ? "Starting Shift..." : "Start Shift"}</span>
              </button>
            )}

            {isCheckedIn && (
              <>
                <button
                  onClick={() => handleAttendance("start-break")}
                  disabled={attendanceActionLoading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm shadow-amber-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <Pause className="w-4 h-4 fill-white" />
                  <span>{attendanceActionLoading ? "Pausing..." : "Take Break"}</span>
                </button>
                <button
                  onClick={() => handleAttendance("end-shift")}
                  disabled={attendanceActionLoading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>{attendanceActionLoading ? "Checking Out..." : "End Shift"}</span>
                </button>
              </>
            )}

            {isOnBreak && (
              <button
                onClick={() => handleAttendance("end-break")}
                disabled={attendanceActionLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-sm font-bold shadow-md shadow-[#214ECF]/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{attendanceActionLoading ? "Resuming..." : "Resume Work"}</span>
              </button>
            )}
          </div>

          {/* Today's Timestamps Breakdown */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Check-In Time</span>
              <span className="font-mono font-bold text-slate-800">
                {!isCheckedOut && todayShift?.check_in_time
                  ? new Date(todayShift.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Check-Out Time</span>
              <span className="font-mono font-bold text-slate-800">
                {!isCheckedOut && todayShift?.check_out_time
                  ? new Date(todayShift.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Break Duration</span>
              <span className="font-mono font-bold text-amber-700">
                {isCheckedOut ? "0m" : breakDisplay}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scheduled Shift</span>
              <span className="font-bold text-slate-800">{agent?.shiftPreference || "US Day (EST)"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HISTORICAL ATTENDANCE RECORDS (SECTION 17) ─────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#214ECF]" />
              Attendance History
            </h3>
            <p className="text-xs text-slate-500">
              Authoritative operational check-in records stored in Supabase.
            </p>
          </div>

          {/* Range Filter Tabs (SECTION 17: Today, 7 Days, 30 Days, All) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => {
                setHistoryFilter("today");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                historyFilter === "today" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                setHistoryFilter("7days");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                historyFilter === "7days" ? "bg-white text-[#214ECF] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => {
                setHistoryFilter("30days");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                historyFilter === "30days" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => {
                setHistoryFilter("all");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                historyFilter === "all" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {paginatedHistory.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">No Past Attendance Records Found</div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Your attendance history will automatically populate as you start and complete shifts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Break</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Worked Time</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedHistory.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{row.date}</td>
                    <td className="py-3 px-4 text-slate-600">{row.shift}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {row.check_in ? new Date(row.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="py-3 px-4 text-amber-700 font-mono">
                      {row.break_display || (row.break_minutes > 0 ? `${row.break_minutes}m` : row.break_seconds > 0 ? `${row.break_seconds}s` : "0m")}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {row.check_out ? new Date(row.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {row.working_hours}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          row.status === "PRESENT"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : row.status === "WEEK_OFF"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages} ({filteredHistory.length} total records)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
