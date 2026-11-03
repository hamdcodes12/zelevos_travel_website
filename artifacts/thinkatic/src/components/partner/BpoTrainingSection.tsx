import { useState, type FormEvent } from "react";
import {
  GraduationCap,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  UserPlus,
  PlayCircle,
  FileCheck,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Search,
  Sparkles,
  ShieldCheck,
  QrCode,
  Download,
  Share2,
} from "lucide-react";
import type { AgentDetail } from "./BpoAgentManagement";

export interface TrainingProgram {
  id: number;
  title: string;
  training_code: string;
  category: string;
  description: string;
  duration_hours: number;
  passing_score: number;
  status: string;
  modules?: Array<{
    id: number;
    title: string;
    content: string;
    duration_minutes: number;
    order_index: number;
    is_mandatory: boolean;
  }>;
  questions?: Array<{
    id: number;
    question: string;
    options: string[];
  }>;
}

export interface TrainingAssignment {
  id: number;
  partner_id: string;
  centre_id?: number | null;
  agent_id: number;
  program_id: number;
  status: "enrolled" | "in_progress" | "completed";
  completion_percent: number;
  enrolled_at: string;
  completed_at?: string | null;
  assessment_score?: number | null;
  passed?: boolean | null;
  agent_name?: string;
  agent_code?: string;
  program_title?: string;
  training_code?: string;
  completed_module_ids?: number[];
}

export interface Certification {
  id: number;
  agent_id: number;
  agent_name?: string;
  agent_code?: string;
  program_id: number;
  program_title?: string;
  certificate_code: string;
  issuing_authority: string;
  issued_at: string;
  expires_at: string;
  status: string;
  revocation_reason?: string;
}

interface BpoTrainingSectionProps {
  programs: TrainingProgram[];
  agents: AgentDetail[];
  certifications: Certification[];
  api: (path: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
  viewCertificate: Certification | null;
  setViewCertificate: (cert: Certification | null) => void;
}

export default function BpoTrainingSection({
  programs,
  agents,
  certifications,
  api,
  onRefresh,
  viewCertificate,
  setViewCertificate,
}: BpoTrainingSectionProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Enrollment Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollProgram, setEnrollProgram] = useState<TrainingProgram | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  // Curriculum & Exam Console Modal
  const [consoleModalOpen, setConsoleModalOpen] = useState(false);
  const [activeProgram, setActiveProgram] = useState<TrainingProgram | null>(null);
  const [selectedAgentForConsole, setSelectedAgentForConsole] = useState<AgentDetail | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<TrainingAssignment | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [consoleTab, setConsoleTab] = useState<"modules" | "assessment">("modules");

  // Assessment State
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submittingExam, setSubmittingExam] = useState(false);
  const [examResult, setExamResult] = useState<{
    score: number;
    passed: boolean;
    passingScore: number;
    message?: string;
  } | null>(null);
  const [mintingCert, setMintingCert] = useState(false);

  // Filter programs
  const filteredPrograms = programs.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      p.title.toLowerCase().includes(q) ||
      p.training_code?.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    const matchesCat =
      selectedCategory === "all" ||
      p.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  // Open Course Console for specific agent & program
  async function openConsole(program: TrainingProgram, targetAgent?: AgentDetail) {
    setActiveProgram(program);
    setConsoleModalOpen(true);
    setConsoleTab("modules");
    setExamResult(null);
    setAnswers({});

    // Choose agent
    const agent = targetAgent || agents[0];
    setSelectedAgentForConsole(agent || null);

    if (agent) {
      setLoadingAssignment(true);
      try {
        // Find existing assignment or enroll agent
        const agentFullRes = await api(`/bpo/agents/${agent.id}`);
        if (agentFullRes.ok) {
          const fullAgent = await agentFullRes.json();
          let asgn = (fullAgent.training_assignments || []).find(
            (a: any) => a.program_id === program.id
          );

          if (!asgn) {
            // Auto-enroll if not enrolled
            const enrollRes = await api(`/bpo/training/programs/${program.id}/enroll`, {
              method: "POST",
              body: JSON.stringify({ agentIds: [agent.id] }),
            });
            if (enrollRes.ok) {
              const enrolledData = await enrollRes.json();
              asgn = enrolledData.enrolled?.[0];
            }
          }

          if (asgn) {
            // Fetch fresh assignment state
            const asgnRes = await api(`/bpo/training/assignments/${asgn.id}`);
            if (asgnRes.ok) {
              setActiveAssignment(await asgnRes.json());
            } else {
              setActiveAssignment(asgn);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load assignment:", err);
      } finally {
        setLoadingAssignment(false);
      }
    }
  }

  async function handleSwitchAgentInConsole(agentId: number) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent || !activeProgram) return;
    setSelectedAgentForConsole(agent);
    setLoadingAssignment(true);
    setExamResult(null);
    setAnswers({});

    try {
      const agentFullRes = await api(`/bpo/agents/${agent.id}`);
      if (agentFullRes.ok) {
        const fullAgent = await agentFullRes.json();
        let asgn = (fullAgent.training_assignments || []).find(
          (a: any) => a.program_id === activeProgram.id
        );

        if (!asgn) {
          const enrollRes = await api(`/bpo/training/programs/${activeProgram.id}/enroll`, {
            method: "POST",
            body: JSON.stringify({ agentIds: [agent.id] }),
          });
          if (enrollRes.ok) {
            const data = await enrollRes.json();
            asgn = data.enrolled?.[0];
          }
        }

        if (asgn) {
          const asgnRes = await api(`/bpo/training/assignments/${asgn.id}`);
          if (asgnRes.ok) setActiveAssignment(await asgnRes.json());
          else setActiveAssignment(asgn);
        }
      }
    } finally {
      setLoadingAssignment(false);
    }
  }

  async function handleCompleteModule(moduleId: number) {
    if (!activeAssignment) return;
    try {
      const res = await api(
        `/bpo/training/assignments/${activeAssignment.id}/modules/${moduleId}/complete`,
        { method: "POST" }
      );
      if (res.ok) {
        const updated = await res.json();
        setActiveAssignment((prev) => (prev ? { ...prev, ...updated } : updated));
        await onRefresh();
      }
    } catch (err) {
      alert("Unable to complete module");
    }
  }

  async function handleSubmitAssessment(e: FormEvent) {
    e.preventDefault();
    if (!activeAssignment || !activeProgram) return;
    setSubmittingExam(true);

    try {
      const res = await api(`/bpo/training/assignments/${activeAssignment.id}/assessment`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to submit assessment");

      setExamResult(body);
      setActiveAssignment((prev) =>
        prev
          ? {
              ...prev,
              assessment_score: body.score,
              passed: body.passed,
            }
          : prev
      );
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingExam(false);
    }
  }

  async function handleMintCertificate() {
    if (!activeAssignment) return;
    setMintingCert(true);

    try {
      const res = await api(`/bpo/training/assignments/${activeAssignment.id}/certify`, {
        method: "POST",
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to issue certification");

      setViewCertificate(body.certification);
      setConsoleModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMintingCert(false);
    }
  }

  async function handleEnrollSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enrollProgram || !selectedAgentIds.length) return;
    setEnrolling(true);

    try {
      const res = await api(`/bpo/training/programs/${enrollProgram.id}/enroll`, {
        method: "POST",
        body: JSON.stringify({ agentIds: selectedAgentIds }),
      });

      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error || "Enrollment failed");
      }

      setEnrollModalOpen(false);
      setSelectedAgentIds([]);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── TOOLBAR: SEARCH & CATEGORIES ──────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search training programs or course codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs outline-none focus:border-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Compliance">Compliance & Security</option>
              <option value="Customer Experience">Customer Experience</option>
              <option value="Technical Support">Technical Support</option>
              <option value="Campaign Operations">Campaign Operations</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 flex items-center gap-1.5">
            <Award size={14} />
            <span>{certifications.length} Active Credentials Issued</span>
          </div>
        </div>
      </div>

      {/* ── TRAINING PROGRAM CATALOG CARDS ─────────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2">
        {filteredPrograms.map((program) => {
          const modules = program.modules || [];
          return (
            <div
              key={program.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                    {program.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {program.training_code}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-black text-slate-900">{program.title}</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-5">{program.description}</p>

                {/* Course Metadata Grid */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Duration</span>
                    <p className="font-black text-slate-800">{program.duration_hours}h Course</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Passing Score</span>
                    <p className="font-black text-emerald-700">{program.passing_score}% Benchmark</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Curriculum</span>
                    <p className="font-black text-slate-800">{modules.length} Modules</p>
                  </div>
                </div>

                {/* Modules preview */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Core Learning Modules
                  </p>
                  <div className="space-y-1">
                    {modules.slice(0, 3).map((m, idx) => (
                      <div key={m.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <span className="font-medium truncate">{m.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({m.duration_minutes}m)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={() => {
                    setEnrollProgram(program);
                    setSelectedAgentIds([]);
                    setEnrollModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <UserPlus size={13} />
                  Enroll Agents
                </button>

                <button
                  onClick={() => openConsole(program)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  <BookOpen size={13} />
                  Launch Course Console →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL: ENROLL AGENTS ───────────────────────────────────────── */}
      {enrollModalOpen && enrollProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-primary">{enrollProgram.training_code}</span>
                <h4 className="font-black text-slate-900">Enroll Agents in {enrollProgram.title}</h4>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Select agents from your centre roster to register for this training qualification.
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 rounded-2xl border border-slate-200 p-3">
                {agents.map((agent) => {
                  const isChecked = selectedAgentIds.includes(agent.id);
                  return (
                    <label
                      key={agent.id}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition cursor-pointer ${
                        isChecked ? "border-primary bg-primary/5" : "border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgentIds([...selectedAgentIds, agent.id]);
                            } else {
                              setSelectedAgentIds(selectedAgentIds.filter((id) => id !== agent.id));
                            }
                          }}
                          className="rounded text-primary"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{agent.name}</p>
                          <span className="font-mono text-[10px] text-slate-400">
                            {agent.agent_code || `THK-AGT-${agent.id}`} · {agent.department}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-slate-500 capitalize">
                        {agent.training_status || "Not Enrolled"}
                      </span>
                    </label>
                  );
                })}

                {!agents.length && (
                  <p className="text-center py-6 text-xs text-slate-400">No agents registered in centre yet.</p>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-slate-600">
                  {selectedAgentIds.length} Agents Selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEnrollModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={enrolling || !selectedAgentIds.length}
                    className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {enrolling ? "Enrolling..." : "Confirm Enrollment"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE TRAINING & EXAM CONSOLE MODAL ───────────────────── */}
      {consoleModalOpen && activeProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {activeProgram.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">{activeProgram.training_code}</span>
                </div>
                <h3 className="mt-1.5 text-xl font-black text-slate-900">{activeProgram.title}</h3>
              </div>
              <button
                onClick={() => setConsoleModalOpen(false)}
                className="rounded-full border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Agent Switcher & Progress Bar */}
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Learner:</span>
                  <select
                    value={selectedAgentForConsole?.id || ""}
                    onChange={(e) => handleSwitchAgentInConsole(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-900 outline-none"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.agent_code || `THK-AGT-${a.id}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400">Assignment ID: </span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeAssignment?.id ? `#${activeAssignment.id}` : "Auto-enrolling..."}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Curriculum Completion</span>
                  <span className="text-primary">{activeAssignment?.completion_percent || 0}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${activeAssignment?.completion_percent || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Console Subtabs */}
            <div className="mt-5 flex gap-2 border-b border-slate-100 pb-2 text-xs font-bold">
              <button
                onClick={() => setConsoleTab("modules")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 transition ${
                  consoleTab === "modules"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <BookOpen size={14} />
                1. Modules Curriculum ({(activeProgram.modules || []).length})
              </button>

              <button
                onClick={() => setConsoleTab("assessment")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 transition ${
                  consoleTab === "assessment"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <FileCheck size={14} />
                2. Certification Assessment ({activeProgram.passing_score}% Required)
              </button>
            </div>

            {/* TAB 1: MODULES */}
            {consoleTab === "modules" && (
              <div className="mt-5 space-y-4">
                <div className="space-y-3">
                  {(activeProgram.modules || []).map((m, idx) => {
                    const isDone = (activeAssignment?.completed_module_ids || []).includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`rounded-2xl border p-4 transition ${
                          isDone ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                isDone ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isDone ? <Check size={12} /> : idx + 1}
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{m.title}</h4>
                              <p className="mt-1 text-xs text-slate-600 leading-5">{m.content}</p>
                              <span className="mt-2 inline-block text-[10px] text-slate-400">
                                Estimated: {m.duration_minutes} mins · Mandatory: {m.is_mandatory ? "Yes" : "No"}
                              </span>
                            </div>
                          </div>

                          <div>
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                                <CheckCircle2 size={12} /> Done
                              </span>
                            ) : (
                              <button
                                onClick={() => handleCompleteModule(m.id)}
                                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800"
                              >
                                Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Next Step Banner */}
                {activeAssignment?.completion_percent === 100 ? (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={20} className="text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900">All Modules 100% Completed!</p>
                        <p className="text-[11px] text-emerald-700">
                          The qualification exam has now unlocked.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConsoleTab("assessment")}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
                    >
                      Proceed to Assessment →
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center italic">
                    Complete all modules above to unlock the official assessment examination.
                  </p>
                )}
              </div>
            )}

            {/* TAB 2: ASSESSMENT */}
            {consoleTab === "assessment" && (
              <div className="mt-5 space-y-5">
                {activeAssignment?.completion_percent !== 100 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
                    <AlertCircle size={28} className="mx-auto text-amber-600" />
                    <h4 className="font-bold text-amber-900">Assessment Locked</h4>
                    <p className="text-xs text-amber-700 max-w-md mx-auto">
                      All training modules must be marked completed before the assessment can be attempted. Return to the Modules tab to finish coursework.
                    </p>
                    <button
                      onClick={() => setConsoleTab("modules")}
                      className="mt-2 rounded-xl border border-amber-300 bg-white px-4 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                    >
                      Back to Modules
                    </button>
                  </div>
                ) : examResult ? (
                  /* Exam Result View */
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center space-y-4">
                    <div
                      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white ${
                        examResult.passed ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    >
                      {examResult.passed ? <Award size={32} /> : <AlertCircle size={32} />}
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Official Server-Scored Result
                      </span>
                      <h4 className="text-3xl font-black text-slate-900 mt-1">
                        {examResult.score}%{" "}
                        <span
                          className={`text-lg font-bold ${
                            examResult.passed ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          ({examResult.passed ? "PASSED" : "FAILED"})
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Benchmark passing threshold: {activeProgram.passing_score}%
                      </p>
                    </div>

                    {examResult.passed ? (
                      <div className="space-y-3 pt-2">
                        <p className="text-xs text-emerald-800 font-medium">
                          Congratulations! This agent has met all Thinkatic quality benchmarks for official delivery accreditation.
                        </p>
                        <button
                          onClick={handleMintCertificate}
                          disabled={mintingCert}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:from-purple-700 hover:to-indigo-700"
                        >
                          <Sparkles size={16} />
                          {mintingCert ? "Issuing Qualification..." : "Issue & Mint Official Credential (THK-CERT-XXXXX)"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs text-rose-700">
                          Score fell below the passing threshold. Review the module materials and retake the assessment.
                        </p>
                        <button
                          onClick={() => {
                            setExamResult(null);
                            setAnswers({});
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Retake Assessment
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Interactive Exam Form */
                  <form onSubmit={handleSubmitAssessment} className="space-y-5">
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
                      <p className="font-bold text-primary">Examination Protocol & Answer Submission</p>
                      <p className="text-slate-600 mt-0.5">
                        Answer all questions below. Answers are verified and deterministically scored server-side against protected answer keys.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {(activeProgram.questions || []).map((q, qIndex) => (
                        <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                          <p className="font-bold text-xs text-slate-900">
                            Q{qIndex + 1}. {q.question}
                          </p>

                          <div className="space-y-2">
                            {q.options.map((opt, optIndex) => {
                              const optionNumber = optIndex + 1;
                              const isSelected = answers[String(q.id)] === optionNumber;
                              return (
                                <label
                                  key={optIndex}
                                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-xs transition cursor-pointer ${
                                    isSelected
                                      ? "border-primary bg-primary/5 text-primary font-bold"
                                      : "border-slate-100 hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`question_${q.id}`}
                                    checked={isSelected}
                                    onChange={() =>
                                      setAnswers({
                                        ...answers,
                                        [String(q.id)]: optionNumber,
                                      })
                                    }
                                    className="text-primary"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setConsoleTab("modules")}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Back to Modules
                      </button>
                      <button
                        type="submit"
                        disabled={
                          submittingExam ||
                          Object.keys(answers).length < (activeProgram.questions || []).length
                        }
                        className="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                      >
                        {submittingExam ? "Scoring Assessment..." : "Submit Examination for Scoring →"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── THINKATIC OFFICIAL CREDENTIAL / CERTIFICATE MODAL ───────────── */}
      {viewCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-3xl border-4 border-amber-300/60 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 text-white shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setViewCertificate(null)}
              className="absolute right-4 top-4 rounded-full border border-white/20 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>

            {/* Certificate Header */}
            <div className="text-center space-y-2 border-b border-white/10 pb-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 shadow-lg">
                <Award size={30} />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-amber-300">
                Thinkatic Global Delivery Network
              </h2>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Certificate of Professional Qualification
              </h1>
              <p className="font-mono text-xs font-bold text-amber-200/80">
                Credential ID: {viewCertificate.certificate_code}
              </p>
            </div>

            {/* Certificate Body */}
            <div className="py-6 text-center space-y-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">This certifies that</p>
              <h3 className="text-2xl font-black text-white">
                {viewCertificate.agent_name || "Certified Operational Agent"}
              </h3>
              {viewCertificate.agent_code && (
                <span className="inline-block rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs text-slate-300">
                  {viewCertificate.agent_code}
                </span>
              )}
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-5">
                has successfully satisfied all rigorous curriculum requirements, comprehensive hands-on simulations,
                and passed the operational compliance examination for:
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <h4 className="text-sm font-black text-amber-300">
                  {viewCertificate.program_title || "Accredited Delivery Program"}
                </h4>
              </div>
            </div>

            {/* Certificate Footer */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 text-[11px] text-slate-400">
              <div>
                <span className="block uppercase text-[9px] font-bold text-slate-500">Issued On</span>
                <p className="font-semibold text-slate-200">
                  {new Date(viewCertificate.issued_at).toLocaleDateString()}
                </p>
                <span className="block uppercase text-[9px] font-bold text-slate-500 mt-2">Expires</span>
                <p className="font-semibold text-slate-200">
                  {new Date(viewCertificate.expires_at).toLocaleDateString()}
                </p>
              </div>

              <div className="text-right">
                <span className="block uppercase text-[9px] font-bold text-slate-500">Issuing Authority</span>
                <p className="font-bold text-amber-300">
                  {viewCertificate.issuing_authority || "Thinkatic Global Operations"}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30 mt-2">
                  <ShieldCheck size={10} /> Active & Verified
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                <Download size={14} /> Print / Save PDF
              </button>
              <button
                onClick={() => setViewCertificate(null)}
                className="rounded-xl bg-amber-400 px-6 py-2 text-xs font-black text-slate-950 hover:bg-amber-300"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
