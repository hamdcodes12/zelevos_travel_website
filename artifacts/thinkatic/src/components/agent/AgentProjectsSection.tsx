import React, { useState } from "react";
import {
  Briefcase,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  ExternalLink,
  Target,
  UserCheck,
  Building,
  Layers,
  ChevronRight,
  TrendingUp,
  Play,
  Check,
  Plus,
  X,
  PhoneCall,
  Loader2,
  List,
  LayoutGrid,
  Headphones,
  Award,
  AlertTriangle,
} from "lucide-react";

interface AgentProjectsSectionProps {
  projects: any[];
  agent: any;
  onOpenCallLog?: () => void;
}

export const AgentProjectsSection: React.FC<AgentProjectsSectionProps> = ({
  projects,
  agent,
  onOpenCallLog,
}) => {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    projects.length > 0 ? projects[0].project_id : 105
  );

  // Workspace modal state
  const [workspaceProject, setWorkspaceProject] = useState<any | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workSubmitting, setWorkSubmitting] = useState(false);
  const [workSuccessMsg, setWorkSuccessMsg] = useState("");
  const [workErrorMsg, setWorkErrorMsg] = useState("");

  // Work form inputs inside workspace
  const [taskName, setTaskName] = useState("");
  const [workType, setWorkType] = useState("Inbound Call");
  const [unitsCompleted, setUnitsCompleted] = useState<number>(1);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [workOutcome, setWorkOutcome] = useState("Resolved");
  const [workStatus, setWorkStatus] = useState<"completed" | "in_progress" | "blocked">("completed");
  const [workNotes, setWorkNotes] = useState("");

  const activeProject =
    projects.find((p) => p.project_id === selectedProjectId) || projects[0] || null;

  // Handle clicking [ Work ] button
  const handleOpenWorkspace = (proj: any) => {
    setWorkspaceLoading(true);
    setWorkSuccessMsg("");
    setWorkErrorMsg("");
    setSelectedProjectId(proj.project_id);

    // Simulate snappy open transition with state
    setTimeout(() => {
      setWorkspaceProject(proj);
      setWorkspaceLoading(false);
    }, 150);
  };

  // Submit direct work update inside project workspace
  const handleLogWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceProject) return;

    setWorkErrorMsg("");
    setWorkSuccessMsg("");
    setWorkSubmitting(true);

    const token = localStorage.getItem("agent_token");
    try {
      const res = await fetch(`/api/agent/projects/${workspaceProject.project_id}/work`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskName: taskName || `${workType} Task`,
          workType,
          unitsCompleted: Number(unitsCompleted) || 1,
          durationMinutes: Number(durationMinutes) || 15,
          outcome: workOutcome,
          status: workStatus,
          notes: workNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWorkSuccessMsg("Work activity recorded successfully & synced with BPO operations!");
        // Update local workspace project activity
        if (data.activity) {
          setWorkspaceProject((prev: any) => ({
            ...prev,
            recent_activity: [data.activity, ...(prev?.recent_activity || [])],
            completed_today: (prev?.completed_today || 0) + (Number(unitsCompleted) || 1),
          }));
        }
        // Reset form
        setTaskName("");
        setWorkNotes("");
        setUnitsCompleted(1);
      } else {
        setWorkErrorMsg(data.error || "Failed to log work activity");
      }
    } catch {
      setWorkErrorMsg("Network error connecting to BPO server.");
    } finally {
      setWorkSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <Briefcase className="w-3.5 h-3.5 text-[#214ECF]" />
            BPO Partner Project & Campaign Allocations
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Allocated Projects
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review assigned campaigns, daily targets, real-time performance scores, and enter the active operational workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-[#214ECF] shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Table / Card Hybrid View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Operations Table</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white text-[#214ECF] shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Detailed Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Detailed Cards</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#214ECF]">
            <Layers className="w-4 h-4" />
            <span>{projects.length} Active {projects.length === 1 ? "Campaign" : "Campaigns"}</span>
          </div>
        </div>
      </div>

      {/* ── KPI HIGHLIGHTS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Allocated Campaigns</span>
            <Briefcase className="w-4 h-4 text-[#214ECF]" />
          </div>
          <div className="text-2xl font-black text-slate-900">{projects.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Assigned by BPO Partner</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Daily Call Target</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {activeProject?.productivity_expectations?.target_calls_per_hour
              ? `${Math.round(activeProject.productivity_expectations.target_calls_per_hour * 8)}/day`
              : "40/day"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Shift workload expectation</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Target Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">
            {activeProject?.productivity_expectations?.target_resolution_rate || "88%"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">FCR benchmark target</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Adherence Target</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {activeProject?.productivity_expectations?.attendance_adherence || "95%"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Shift adherence SLA</div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No Projects Currently Assigned</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Your BPO Operations Lead will assign your campaign and shift schedule here.
          </p>
        </div>
      ) : (
        <>
          {/* ────────────────────────────────────────────────────────────────
              VIEW 1: PROFESSIONAL TABLE / CARD HYBRID (SECTION 10 REQUIRED)
             ──────────────────────────────────────────────────────────────── */}
          {viewMode === "table" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Campaign Operations Roster</h3>
                  <p className="text-xs text-slate-500">
                    Direct assignment metrics, target throughput, and workspace launch actions.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  {projects.length} Total Records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Campaign</th>
                      <th className="py-3 px-4">Work Type</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Completed</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Performance</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projects.map((proj) => {
                      const targetCalls = proj.productivity_expectations?.target_calls_per_hour
                        ? Math.round(proj.productivity_expectations.target_calls_per_hour * 8)
                        : 40;
                      const completed = proj.completed_today || 18;
                      const score = proj.score || 94;
                      const performanceLabel =
                        score >= 90 ? "Excellent" : score >= 75 ? "Good" : "Needs Review";

                      return (
                        <tr
                          key={proj.project_id}
                          className="hover:bg-blue-50/30 transition-colors group"
                        >
                          {/* Project */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                                <Briefcase className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{proj.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ID: #{proj.project_id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Campaign */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                              {proj.campaign_code || `THK-PRJ-${proj.project_id}`}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {proj.client_reference || "Thinkatic Client"}
                            </div>
                          </td>

                          {/* Work Type */}
                          <td className="py-3.5 px-4 font-medium text-slate-700">
                            {proj.work_type || "Customer Support"}
                          </td>

                          {/* Channel */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                              <Headphones className="w-3 h-3 text-[#214ECF]" />
                              {proj.channel || "Inbound Voice"}
                            </span>
                          </td>

                          {/* Target */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            {targetCalls} calls/day
                          </td>

                          {/* Completed */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">
                                {completed} / {targetCalls}
                              </span>
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-[#214ECF] rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.round((completed / targetCalls) * 100))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                            {score}%
                          </td>

                          {/* Performance */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                performanceLabel === "Excellent"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : performanceLabel === "Good"
                                  ? "bg-blue-50 text-[#214ECF] border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {performanceLabel}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {proj.status?.toUpperCase() || "ACTIVE"}
                            </span>
                          </td>

                          {/* Action Button: [ Work ] perfectly centered */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenWorkspace(proj)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer mx-auto"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>Work</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              VIEW 2: DETAILED CARDS VIEW
             ──────────────────────────────────────────────────────────────── */}
          {viewMode === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((proj) => {
                const targetCalls = proj.productivity_expectations?.target_calls_per_hour
                  ? Math.round(proj.productivity_expectations.target_calls_per_hour * 8)
                  : 40;
                const completed = proj.completed_today || 18;
                const score = proj.score || 94;

                return (
                  <div
                    key={proj.project_id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                          {proj.campaign_code || `THK-PRJ-${proj.project_id}`}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {proj.status?.toUpperCase() || "ACTIVE"}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900">{proj.name}</h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          Client: <strong className="text-slate-700">{proj.client_reference}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Headphones className="w-3.5 h-3.5 text-slate-400" />
                          Channel: <strong className="text-slate-700">{proj.channel || "Inbound Voice"}</strong>
                        </span>
                      </div>

                      {/* Shift & Supervisor */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Shift</span>
                          <span className="font-bold text-slate-800">{proj.shift || "General Day Shift"}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Supervisor</span>
                          <span className="font-bold text-slate-800">{proj.supervisor || "Operations Lead"}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                          <span>Today's Work Progress</span>
                          <span className="font-mono text-[#214ECF]">
                            {completed} / {targetCalls} calls ({Math.round((completed / targetCalls) * 100)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-[#214ECF] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.round((completed / targetCalls) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action: Centered Button */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-slate-500">Quality Score:</span>
                        <strong className="text-emerald-700 font-bold">{score}%</strong>
                      </div>

                      <button
                        onClick={() => handleOpenWorkspace(proj)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Work Workspace</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              ACTIVE PROJECT DEEP DIVE (SOPs, INSTRUCTIONS, ESCALATIONS)
             ──────────────────────────────────────────────────────────────── */}
          {activeProject && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#214ECF]" />
                  <h3 className="text-base font-bold text-slate-900">
                    Campaign Operating Guidelines & SOPs: {activeProject.name}
                  </h3>
                </div>
                <button
                  onClick={() => handleOpenWorkspace(activeProject)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:text-[#1a3fa8] cursor-pointer"
                >
                  <span>Launch Workspace</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Work Instructions */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                    Authorized Work Instructions
                  </h4>
                  <div className="space-y-2">
                    {(activeProject.work_instructions || []).map((instruction: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-[#214ECF] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-slate-700 leading-relaxed">{instruction}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Escalation Rules & SOPs */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 text-xs text-red-900">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Campaign Escalation Rule:
                    </div>
                    <div className="text-[11px] text-red-800 mt-1 leading-relaxed">
                      {activeProject.escalation_procedure ||
                        "For high-severity patient questions or billing disputes, flag call disposition as 'Escalated' and tag the assigned supervisor immediately."}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Authorized SOP Documents
                    </h4>
                    <div className="space-y-2">
                      {(activeProject.sops || []).map((sop: any) => (
                        <div
                          key={sop.id}
                          className="p-3 rounded-xl border border-slate-200 hover:border-blue-200 bg-slate-50/50 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#214ECF]" />
                            <span className="font-semibold text-slate-800">{sop.title}</span>
                          </div>
                          <a
                            href={sop.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-[#214ECF] hover:text-[#1a3fa8]"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────────────────────────────────────────────
          WORKSPACE DRAWER / MODAL (SECTION 11 REQUIRED)
         ──────────────────────────────────────────────────────────────────── */}
      {workspaceProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                      {workspaceProject.campaign_code || `THK-PRJ-${workspaceProject.project_id}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      OPERATIONAL WORKSPACE
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mt-1">{workspaceProject.name}</h2>
                </div>
              </div>

              <button
                onClick={() => setWorkspaceProject(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Close Workspace"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Feedback */}
            {workSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{workSuccessMsg}</span>
              </div>
            )}
            {workErrorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{workErrorMsg}</span>
              </div>
            )}

            {/* Quick Metrics Bar inside Workspace */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Today's Target</span>
                <span className="text-base font-black text-slate-900">40 Calls / Shift</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Completed Work</span>
                <span className="text-base font-black text-[#214ECF]">
                  {workspaceProject.completed_today || 18} Calls
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Remaining Work</span>
                <span className="text-base font-black text-slate-700">
                  {Math.max(0, 40 - (workspaceProject.completed_today || 18))} Calls
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Performance Score</span>
                <span className="text-base font-black text-emerald-700">
                  {workspaceProject.score || 94}% (Excellent)
                </span>
              </div>
            </div>

            {/* Workspace 2-Column: Live Work Logger + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Form: Record Project Work Activity */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Play className="w-4 h-4 text-[#214ECF]" />
                    Record Completed Work / Call Task
                  </h3>
                  {onOpenCallLog && (
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceProject(null);
                        onOpenCallLog();
                      }}
                      className="text-[11px] font-bold text-[#214ECF] hover:underline"
                    >
                      Use Full Call Logger
                    </button>
                  )}
                </div>

                <form onSubmit={handleLogWorkSubmit} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Task / Item Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patient Prescription Refill Verification"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Work Type
                      </label>
                      <select
                        value={workType}
                        onChange={(e) => setWorkType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                      >
                        <option value="Inbound Call">Inbound Call</option>
                        <option value="Outbound Follow-up">Outbound Follow-up</option>
                        <option value="Patient Verification">Patient Verification</option>
                        <option value="Ticket Resolution">Ticket Resolution</option>
                        <option value="Back-office Processing">Back-office Processing</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Outcome
                      </label>
                      <select
                        value={workOutcome}
                        onChange={(e) => setWorkOutcome(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                      >
                        <option value="Resolved">Resolved</option>
                        <option value="Follow-up Required">Follow-up Required</option>
                        <option value="Escalated">Escalated to Supervisor</option>
                        <option value="Pending Customer Callback">Pending Customer Callback</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Units Completed
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={unitsCompleted}
                        onChange={(e) => setUnitsCompleted(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="240"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Operational Notes & Reference
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter customer reference, verification details, or supervisor follow-up notes..."
                      value={workNotes}
                      onChange={(e) => setWorkNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={workSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  >
                    {workSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Logging Work to BPO Operations...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Submit Work Activity</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right: Operational Details & SOP quick references */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Campaign Supervisor & Escalation
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Assigned Supervisor:</span>
                      <strong className="text-slate-800">{workspaceProject.supervisor || "Operations Lead"}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Scheduled Shift:</span>
                      <strong className="text-slate-800">{workspaceProject.shift || "General Day Shift"}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">BPO Centre:</span>
                      <strong className="text-slate-800">Thinkatic Delivery Hub</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                  <h4 className="text-xs font-bold text-[#214ECF] uppercase tracking-wider mb-2">
                    Immediate SOP Documents
                  </h4>
                  <div className="space-y-2">
                    {(workspaceProject.sops || []).map((sop: any) => (
                      <div
                        key={sop.id}
                        className="flex items-center justify-between text-xs p-2 bg-white rounded-lg border border-blue-100"
                      >
                        <span className="font-medium text-slate-800 truncate max-w-[200px]">{sop.title}</span>
                        <a
                          href={sop.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#214ECF] hover:underline flex items-center gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setWorkspaceProject(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
