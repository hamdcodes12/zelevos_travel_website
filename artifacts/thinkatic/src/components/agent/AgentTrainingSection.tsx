import React, { useState } from "react";
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Award,
  Play,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Video,
  Upload,
  X,
  Check,
  UserCheck,
  Star,
  FileCheck,
  Layers,
  Calendar,
} from "lucide-react";

interface AgentTrainingSectionProps {
  trainingData: any[];
  onCompleteModule: (programId: number, moduleId: number) => Promise<void>;
  token: string;
}

export const AgentTrainingSection: React.FC<AgentTrainingSectionProps> = ({
  trainingData,
  onCompleteModule,
  token,
}) => {
  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(
    trainingData.length > 0 ? trainingData[0].id : null
  );
  const [completingModuleId, setCompletingModuleId] = useState<number | null>(null);

  // Live training join attendance state
  const [joiningTrainingId, setJoiningTrainingId] = useState<number | null>(null);
  const [liveJoinModal, setLiveJoinModal] = useState<any | null>(null);

  // Evidence upload modal state
  const [evidenceModalProgram, setEvidenceModalProgram] = useState<any | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceSuccess, setEvidenceSuccess] = useState("");
  const [evidenceError, setEvidenceError] = useState("");

  const handleMarkComplete = async (programId: number, moduleId: number) => {
    setCompletingModuleId(moduleId);
    try {
      await onCompleteModule(programId, moduleId);
    } finally {
      setCompletingModuleId(null);
    }
  };

  // Join live training session & record attendance
  const handleJoinTraining = async (program: any) => {
    setJoiningTrainingId(program.id);
    try {
      const res = await fetch(`/api/agent/training/${program.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setLiveJoinModal({
          program,
          attendance: data.attendance || {
            join_time: new Date().toISOString(),
            status: "Present",
          },
          meeting_link: data.meeting_link || program.meeting_link || "https://meet.thinkatic.com/training-session",
        });
      }
    } catch (err) {
      console.error("Error joining training:", err);
    } finally {
      setJoiningTrainingId(null);
    }
  };

  // Submit completion evidence
  const handleUploadEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceModalProgram) return;

    setEvidenceError("");
    setEvidenceSuccess("");

    if (!evidenceFile) {
      setEvidenceError("Please select a valid certificate, screenshot, or completion file.");
      return;
    }

    setUploadingEvidence(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch(`/api/agent/training/${evidenceModalProgram.id}/evidence`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              evidenceFileName: evidenceFile.name,
              evidenceBase64: base64,
              notes: evidenceNotes,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setEvidenceSuccess("Evidence submitted successfully and queued for BPO supervisor review!");
            setEvidenceFile(null);
            setEvidenceNotes("");
            setTimeout(() => {
              setEvidenceModalProgram(null);
              setEvidenceSuccess("");
            }, 1800);
          } else {
            setEvidenceError(data.error || "Failed to submit evidence");
          }
        } catch {
          setEvidenceError("Connection error while submitting evidence.");
        } finally {
          setUploadingEvidence(false);
        }
      };
      reader.readAsDataURL(evidenceFile);
    } catch {
      setEvidenceError("Failed to read file.");
      setUploadingEvidence(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <GraduationCap className="w-3.5 h-3.5 text-[#214ECF]" />
            BPO Operations Training & Compliance
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Training & Certifications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assigned live classes, recorded modules, and compliance assessments governed by your BPO partner.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-purple-700">
          <Award className="w-4 h-4" />
          <span>{trainingData.length} Assigned Programs</span>
        </div>
      </div>

      {/* ── TRAINING PROGRAMS LIST ───────────────────────────────────────── */}
      <div className="space-y-4">
        {trainingData.map((program) => {
          const isExpanded = expandedProgramId === program.id;
          const isComplete = program.status === "completed" || program.progress === 100;
          const isLive = program.type === "live_class" || program.type === "live";

          return (
            <div
              key={program.id}
              className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all"
            >
              {/* Card Header Summary */}
              <div
                onClick={() => setExpandedProgramId(isExpanded ? null : program.id)}
                className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isComplete
                        ? "bg-emerald-50 text-emerald-600"
                        : isLive
                        ? "bg-blue-50 text-[#214ECF]"
                        : "bg-purple-50 text-purple-600"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : isLive ? (
                      <Video className="w-6 h-6" />
                    ) : (
                      <GraduationCap className="w-6 h-6" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {program.code || `THK-TRN-${program.id}`}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {program.type?.replace("_", " ") || "Module"}
                      </span>
                      {isLive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#214ECF] border border-blue-200">
                          LIVE SESSION
                        </span>
                      )}
                      {program.bpo_score !== undefined && program.bpo_score !== null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-emerald-600" />
                          BPO Score: {program.bpo_score} / 10
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{program.title}</h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Trainer: <strong className="text-slate-700">{program.trainer || "BPO Specialist"}</strong>
                      </span>
                      <span>•</span>
                      <span>Due: <strong className="text-slate-700">{program.due_date || "2026-04-15"}</strong></span>
                      <span>•</span>
                      <span>{program.modules?.length || 1} Modules</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Progress, Buttons, and Expand */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Progress Bar & Percentage */}
                  <div className="w-36 text-right">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                      <span>Progress</span>
                      <span className={isComplete ? "text-emerald-700" : "text-[#214ECF]"}>
                        {program.progress || (isComplete ? 100 : 50)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isComplete ? "bg-emerald-500" : "bg-[#214ECF]"
                        }`}
                        style={{ width: `${program.progress || (isComplete ? 100 : 50)}%` }}
                      />
                    </div>
                  </div>

                  {/* Contextual Action Button */}
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinTraining(program);
                        }}
                        disabled={joiningTrainingId === program.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>{joiningTrainingId === program.id ? "Connecting..." : "Join Training"}</span>
                      </button>
                    )}

                    {!isComplete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEvidenceModalProgram(program);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        title="Upload Completion Evidence"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#214ECF]" />
                        <span>Evidence</span>
                      </button>
                    )}

                    <button className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Modules List & Feedback */}
              {isExpanded && (
                <div className="p-5 sm:p-6 bg-slate-50/60 border-t border-slate-100 space-y-4">
                  {/* BPO Supervisor Feedback / Score Box (if scored) */}
                  {program.bpo_feedback && (
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                      <div className="font-bold text-slate-900 flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#214ECF]" />
                          BPO Operations Supervisor Assessment:
                        </span>
                        <span className="font-mono text-[#214ECF] font-bold">
                          Rating: {program.bpo_score || 9.5} / 10
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed italic">
                        "{program.bpo_feedback}"
                      </p>
                    </div>
                  )}

                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Program Modules & Curriculum
                  </h4>

                  <div className="space-y-2">
                    {(program.modules || [
                      { id: 101, title: "Overview & Quality Compliance Guidelines", duration: "25m", completed: true },
                      { id: 102, title: "Practical Scenarios & Telephony Navigation", duration: "35m", completed: isComplete },
                    ]).map((module: any) => (
                      <div
                        key={module.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              module.completed
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {module.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <span>{module.id % 100}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{module.title}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{module.duration || "30m"}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          {module.completed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkComplete(program.id, module.id)}
                              disabled={completingModuleId === module.id}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>{completingModuleId === module.id ? "Saving..." : "Mark Completed"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isComplete && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 mt-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold">
                          Certification active and verified for this campaign.
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold bg-white/80 px-2 py-0.5 rounded">
                        CERT-VERIFIED
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── VERIFIED CERTIFICATIONS CARD ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#214ECF]" />
          Verified Frontline Certifications
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
                <span className="text-[10px] text-slate-400">Valid: 2026 - 2027</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">HIPAA Security & PHI Specialist 2026</h4>
              <p className="text-xs text-slate-500 mt-1">Healthcare Compliance Association</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400 text-[10px]">THK-CERT-02323-01</span>
              <span className="text-[#214ECF] font-bold">Verified</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
                <span className="text-[10px] text-slate-400">Valid: 2026 - 2027</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">Inbound Patient Support Professional</h4>
              <p className="text-xs text-slate-500 mt-1">Thinkatic Global Delivery Academy</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400 text-[10px]">THK-ACAD-AGT-02323</span>
              <span className="text-[#214ECF] font-bold">Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE TRAINING JOIN CONFIRMATION MODAL ───────────────────────── */}
      {liveJoinModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Live Training Attendance Confirmed</h3>
                  <div className="text-[11px] text-emerald-600 font-bold">Attendance: Present Recorded</div>
                </div>
              </div>
              <button
                onClick={() => setLiveJoinModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="font-bold text-slate-900">{liveJoinModal.program.title}</div>
              <div className="text-slate-500">
                Join Timestamp: <strong className="font-mono text-slate-800">{new Date(liveJoinModal.attendance.join_time).toLocaleTimeString()}</strong>
              </div>
              <div className="text-slate-500">
                Trainer: <strong className="text-slate-800">{liveJoinModal.program.trainer || "Lead Quality Coach"}</strong>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLiveJoinModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <a
                href={liveJoinModal.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Training Room</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD COMPLETION EVIDENCE MODAL ────────────────────────────── */}
      {evidenceModalProgram && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Completion Evidence</h3>
                  <div className="text-[11px] text-slate-400">{evidenceModalProgram.title}</div>
                </div>
              </div>
              <button
                onClick={() => setEvidenceModalProgram(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {evidenceError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{evidenceError}</span>
              </div>
            )}

            {evidenceSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{evidenceSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadEvidenceSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Evidence File
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#214ECF]"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Accepted formats: PDF, PNG, JPG (Certificate, screenshot, or scorecard)
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Agent Notes / Submission Comments
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Completed module 2 assessment with 100% quiz score..."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEvidenceModalProgram(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingEvidence}
                  className="px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  {uploadingEvidence ? "Submitting..." : "Submit to BPO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
