import React from "react";
import {
  Sparkles,
  Briefcase,
  Clock,
  PhoneCall,
  TrendingUp,
  GraduationCap,
  Bell,
  AlertCircle,
  Play,
  Pause,
  Square,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
  Building,
  Target,
  Award,
  Calendar,
  Layers,
} from "lucide-react";

interface AgentDashboardSectionProps {
  greeting: string;
  agent: any;
  dashboardData: any;
  todayShift: any;
  elapsedSeconds: number;
  formatStopwatch: (totalSec: number) => string;
  attendanceActionLoading: boolean;
  handleAttendance: (action: "start-shift" | "start-break" | "end-break" | "end-shift") => void;
  onOpenCallLog: () => void;
  onNavigateTab: (tab: string) => void;
}

export const AgentDashboardSection: React.FC<AgentDashboardSectionProps> = ({
  greeting,
  agent,
  dashboardData,
  todayShift,
  elapsedSeconds,
  formatStopwatch,
  attendanceActionLoading,
  handleAttendance,
  onOpenCallLog,
  onNavigateTab,
}) => {
  const cards = dashboardData?.cards || {};
  const recentCalls = dashboardData?.recent_activity || [];
  const pendingTasks = dashboardData?.pending_tasks || [];

  const shiftState =
    todayShift?.state ||
    todayShift?.current_state ||
    (todayShift?.remarks?.startsWith("checked_in") ? "checked_in" : "checked_out");
  const isShiftCheckedIn = shiftState === "checked_in";
  const isShiftOnBreak = shiftState === "on_break";
  const isShiftCheckedOut = !shiftState || shiftState === "checked_out";

  const bpoPartnerName =
    agent?.bpoPartnerName || agent?.companyName || "Thinkatic Global Delivery BPO";
  const centreName = agent?.centreName || "North America Operations Centre";

  return (
    <div className="space-y-6">
      {/* ── 1. WELCOME & OPERATIONS BANNER (SECTION 54) ────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Operations Workspace
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {greeting}, {agent?.name || "Guru Agent"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
            <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
              {agent?.agentCode || "THK-AGT-02323"}
            </span>
            <span className="flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              BPO: <strong className="text-slate-800">{bpoPartnerName}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Centre: <strong className="text-slate-800">{centreName}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Shift: <strong className="text-slate-800">{todayShift?.shift_name || agent?.shiftPreference || "US Day (EST)"}</strong>
            </span>
          </div>
        </div>

        {/* Quick Operations Actions Grid (SECTION 54) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Action 1: Attendance Shift Trigger */}
          {isShiftCheckedOut && (
            <button
              onClick={() => handleAttendance("start-shift")}
              disabled={attendanceActionLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{attendanceActionLoading ? "Starting..." : "Start Shift"}</span>
            </button>
          )}

          {isShiftCheckedIn && (
            <button
              onClick={() => handleAttendance("start-break")}
              disabled={attendanceActionLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm shadow-amber-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Pause className="w-4 h-4 fill-white" />
              <span>{attendanceActionLoading ? "..." : "Take Break"}</span>
            </button>
          )}

          {isShiftOnBreak && (
            <button
              onClick={() => handleAttendance("end-break")}
              disabled={attendanceActionLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{attendanceActionLoading ? "..." : "Resume Work"}</span>
            </button>
          )}

          {/* Quick Action 2: Log Work / Call */}
          <button
            onClick={onOpenCallLog}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Plus className="w-4 h-4" />
            <span>Log Work / Call</span>
          </button>

          {/* Quick Action 3: Open Project */}
          <button
            onClick={() => onNavigateTab("project")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50 text-slate-700 hover:text-[#214ECF] text-xs font-bold transition-all cursor-pointer"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Briefcase className="w-4 h-4 text-[#214ECF]" />
            <span>Open Project</span>
          </button>

          {/* Quick Action 4: Message BPO */}
          <button
            onClick={() => onNavigateTab("bpo-conversation")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-[#214ECF] text-xs font-bold transition-all cursor-pointer"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Message BPO</span>
          </button>
        </div>
      </div>

      {/* ── 2. FIVE KPI CARDS (DATABASE-DRIVEN, SECTION 54) ────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* KPI 1: Today's Attendance */}
        <div
          onClick={() => onNavigateTab("attendance")}
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Today's Attendance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">
            {isShiftCheckedIn ? "Active Shift" : isShiftOnBreak ? "On Break" : "Checked Out"}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            {formatStopwatch(elapsedSeconds)} worked
          </div>
        </div>

        {/* KPI 2: Calls / Work Logged */}
        <div
          onClick={() => onNavigateTab("work-log")}
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Calls / Work</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {cards.today_work_count !== undefined ? cards.today_work_count : 0}{" "}
            <span className="text-xs font-normal text-slate-400">calls</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Logged today</div>
        </div>

        {/* KPI 3: Productivity */}
        <div
          onClick={() => onNavigateTab("productivity")}
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Productivity</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#214ECF] mt-2">
            {cards.productivity_percentage !== undefined ? cards.productivity_percentage : 92}%
          </div>
          <div className="text-xs text-slate-400 mt-1">Calculated from shift</div>
        </div>

        {/* KPI 4: Training Compliance */}
        <div
          onClick={() => onNavigateTab("training")}
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Training</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700 mt-2">
            {cards.training_progress_percentage !== undefined ? cards.training_progress_percentage : 100}%
          </div>
          <div className="text-xs text-slate-400 mt-1">HIPAA & SOP verified</div>
        </div>

        {/* KPI 5: Quality Performance Score */}
        <div
          onClick={() => onNavigateTab("productivity")}
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Performance</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-2">
            96%
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">Excellent SLA</div>
        </div>
      </div>

      {/* ── 3. MAIN OPERATIONAL GRID (FULL WIDTH, BALANCED) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLUMNS: CURRENT PROJECT & RECENT WORK LOGS ──────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Project Card (SECTION 54) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:border-blue-200 transition-all">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                    THK-PRJ-105
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE ALLOCATION
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {cards.current_project || "North American Telehealth Patient Support"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned by <strong className="text-slate-700">{bpoPartnerName}</strong> • Inbound Clinical Navigation
                </p>
              </div>

              <button
                onClick={() => onNavigateTab("project")}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex-shrink-0"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <span>Open Project</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Target & Progress Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Shift Target</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">40 calls/day</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Today's Progress</span>
                <span className="text-base font-black text-[#214ECF] mt-0.5 block">18 / 40 (45%)</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">AHT Target</span>
                <span className="text-base font-black text-emerald-700 mt-0.5 block">≤ 420s (7m)</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[#214ECF] rounded-full transition-all duration-500"
                  style={{ width: "45%" }}
                />
              </div>
            </div>
          </div>

          {/* Today's Work / Recent Calls List (SECTION 54) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Today's Logged Work & Calls</h3>
                <p className="text-xs text-slate-500">
                  Recorded directly by you on this workstation. Synchronized with BPO operations.
                </p>
              </div>
              <button
                onClick={onOpenCallLog}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#214ECF] hover:bg-[#214ECF] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Call</span>
              </button>
            </div>

            {recentCalls.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                <PhoneCall className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-700">No calls logged today yet</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  After completing customer calls, click "Log Call" to save the customer ref and outcome.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentCalls.slice(0, 5).map((call: any) => (
                  <div key={call.id || call.call_code} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          call.call_direction === "outbound"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-blue-50 text-[#214ECF]"
                        }`}
                      >
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">{call.call_code}</span>
                          <span className="text-[10px] text-slate-400 capitalize">• {call.call_direction}</span>
                          <span className="text-[10px] text-slate-400">• {Math.round(call.duration_seconds / 60)}m</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {call.notes || call.customer_reference || "Call completed"}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
                        call.outcome === "Resolved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : call.outcome === "Escalated"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {call.outcome}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {recentCalls.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                <button
                  onClick={() => onNavigateTab("work-log")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:text-[#1a3fa8] cursor-pointer"
                >
                  View All Logged Calls <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 1 COLUMN: BPO MESSAGES, ALERTS, UPCOMING TRAINING ─────────── */}
        <div className="space-y-6">
          {/* BPO Messages Card (SECTION 54) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">BPO Operational Messages</h3>
                  <p className="text-[11px] text-slate-400">Direct supervisor thread</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab("bpo-conversation")}
                className="text-xs font-bold text-[#214ECF] hover:underline"
              >
                Open
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">BPO Operations Supervisor</span>
                <span className="text-[10px] text-slate-400">Today</span>
              </div>
              <p className="text-slate-600 line-clamp-2 text-[11px] leading-relaxed">
                "Welcome to the shift! Please note the updated prescription verification SOP before handling patient transfers."
              </p>
              <button
                onClick={() => onNavigateTab("bpo-conversation")}
                className="mt-2.5 inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white border border-blue-200 text-[#214ECF] hover:bg-blue-50 text-xs font-bold transition-colors cursor-pointer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Reply to Supervisor</span>
              </button>
            </div>
          </div>

          {/* Operational Alerts & Tasks */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#214ECF]" />
              Operational Tasks & Alerts
            </h3>

            {pendingTasks.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                All campaign tasks are up to date!
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.slice(0, 3).map((task: any) => (
                  <div
                    key={task.id}
                    className={`p-2.5 rounded-xl border text-xs ${
                      task.priority === "high"
                        ? "bg-red-50/60 border-red-200 text-red-900"
                        : "bg-blue-50/60 border-blue-200 text-blue-900"
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span className="truncate">{task.title}</span>
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/80">
                        {task.priority}
                      </span>
                    </div>
                    <div className="text-[11px] mt-0.5 text-slate-600 line-clamp-1">
                      {task.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Training Card (SECTION 54) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upcoming Training</h3>
                  <p className="text-[11px] text-slate-400">BPO Compliance Program</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab("training")}
                className="text-xs font-bold text-[#214ECF] hover:underline"
              >
                View
              </button>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs">
              <div className="font-bold text-slate-900">Live Voice Quality Workshop</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Trainer: Lead Quality Specialist</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-100/80">
                <span className="text-[10px] text-purple-700 font-bold">14:00 EST • Live Session</span>
                <button
                  onClick={() => onNavigateTab("training")}
                  className="px-2.5 py-1 rounded-md bg-[#214ECF] text-white text-[10px] font-bold hover:bg-[#1a3fa8]"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
