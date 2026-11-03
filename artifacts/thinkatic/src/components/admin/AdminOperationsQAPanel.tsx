import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Clock,
  X,
  Send,
  Sliders,
  Trash2,
} from "lucide-react";

interface Props {
  adminApi: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminOperationsQAPanel({ adminApi }: Props) {
  const [loading, setLoading] = useState(false);
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"evaluations" | "scorecards" | "disputes">("evaluations");

  // Create Scorecard Modal State
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState({
    name: "",
    process_type: "voice",
    pass_threshold_percentage: 85,
    criteria: [
      { name: "Greeting & Verification", weight: 20, description: "Professional greeting, customer identity verification" },
      { name: "Process & Product Knowledge", weight: 40, description: "Accurate information provided, procedural steps followed" },
      { name: "Communication & Empathy", weight: 25, description: "Clear diction, polite tone, active listening" },
      { name: "Call Wrap & Documentation", weight: 15, description: "Proper disposition logged in CRM, closing remarks" },
    ],
  });

  // Conduct Evaluation Modal State
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({
    scorecard_id: "",
    agent_id: "",
    interaction_reference: "",
    critical_defects_count: 0,
    major_defects_count: 0,
    minor_defects_count: 0,
    feedback_notes: "",
    criteria_scores: {} as Record<string, number>,
  });

  // Resolve Dispute Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [disputeDecision, setDisputeDecision] = useState<"resolved_upheld" | "resolved_overturned">("resolved_overturned");
  const [adjustedScore, setAdjustedScore] = useState<number>(90);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [toastMsg, setToastMsg] = useState("");
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  async function loadData() {
    setLoading(true);
    try {
      const [scRes, evRes, dpRes, agRes] = await Promise.all([
        adminApi("/admin/bpo/qa/scorecards"),
        adminApi("/admin/bpo/qa/evaluations"),
        adminApi("/admin/bpo/qa/disputes"),
        adminApi("/admin/bpo/agents?limit=100"),
      ]);

      if (scRes.ok) {
        const d = await scRes.json();
        setScorecards(d.scorecards || []);
      }
      if (evRes.ok) {
        const d = await evRes.json();
        setEvaluations(d.evaluations || []);
      }
      if (dpRes.ok) {
        const d = await dpRes.json();
        setDisputes(d.disputes || []);
      }
      if (agRes.ok) {
        const d = await agRes.json();
        setAgents(d.agents || []);
      }
    } catch (err) {
      console.error("Failed to load QA studio data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateScorecard(e: React.FormEvent) {
    e.preventDefault();
    const totalWeight = cardForm.criteria.reduce((acc, c) => acc + Number(c.weight), 0);
    if (totalWeight !== 100) {
      alert(`Criteria weights must sum to exactly 100%. Current sum: ${totalWeight}%`);
      return;
    }

    try {
      const res = await adminApi("/admin/bpo/qa/scorecards", {
        method: "POST",
        body: JSON.stringify(cardForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create scorecard");
      showToast(`Scorecard "${cardForm.name}" created successfully.`);
      setCreateCardOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleScorecardSelection(scorecardId: string) {
    const sc = scorecards.find((c) => String(c.id) === scorecardId);
    const initialScores: Record<string, number> = {};
    if (sc && Array.isArray(sc.criteria)) {
      sc.criteria.forEach((crit: any) => {
        initialScores[crit.name] = crit.weight; // Default to full points
      });
    }
    setEvalForm({
      ...evalForm,
      scorecard_id: scorecardId,
      criteria_scores: initialScores,
    });
  }

  async function handleEvaluationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!evalForm.scorecard_id || !evalForm.agent_id) {
      alert("Please select a scorecard and agent.");
      return;
    }

    try {
      const res = await adminApi("/admin/bpo/qa/evaluations", {
        method: "POST",
        body: JSON.stringify({
          scorecard_id: Number(evalForm.scorecard_id),
          agent_id: Number(evalForm.agent_id),
          interaction_reference: evalForm.interaction_reference || `AUDIT-${Date.now().toString().slice(-6)}`,
          critical_defects_count: Number(evalForm.critical_defects_count),
          major_defects_count: Number(evalForm.major_defects_count),
          minor_defects_count: Number(evalForm.minor_defects_count),
          feedback_notes: evalForm.feedback_notes,
          scores_breakdown: evalForm.criteria_scores,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log evaluation");
      showToast(`Evaluation logged! Score: ${data.evaluation?.score_percentage}% (${data.evaluation?.status.toUpperCase()})`);
      setEvalModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function openResolveModal(disp: any) {
    setSelectedDispute(disp);
    setDisputeDecision("resolved_overturned");
    setAdjustedScore(Number(disp.original_score || 85));
    setResolutionNotes("Re-audited by QA Lead. Deduction overturned based on audio verification.");
    setResolveModalOpen(true);
  }

  async function handleResolveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDispute) return;
    try {
      const res = await adminApi(`/admin/bpo/qa/disputes/${selectedDispute.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          status: disputeDecision,
          resolution_notes: resolutionNotes,
          adjusted_score: disputeDecision === "resolved_overturned" ? Number(adjustedScore) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve dispute");
      showToast(`Dispute #${selectedDispute.id} resolved: ${disputeDecision.replace("_", " ").toUpperCase()}`);
      setResolveModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const selectedScDetails = scorecards.find((s) => String(s.id) === evalForm.scorecard_id);
  const pendingDisputes = disputes.filter((d) => d.status === "submitted" || d.status === "under_review").length;

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm transition">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Audits Conducted</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{evaluations.length}</p>
          <span className="text-[11px] text-slate-500 font-medium">All campaigns</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Scorecards</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{scorecards.length}</p>
          <span className="text-[11px] text-slate-500 font-medium">Weighted criteria sets</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending QA Disputes</span>
          <p className="mt-2 text-2xl font-black text-amber-900">{pendingDisputes}</p>
          <span className="text-[11px] text-amber-700 font-medium">Awaiting calibration decision</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Network Mean QA</span>
          <p className="mt-2 text-2xl font-black text-emerald-900">
            {evaluations.length > 0
              ? (
                  evaluations.reduce((acc, e) => acc + (Number(e.score_percentage) || 0), 0) /
                  evaluations.length
                ).toFixed(1)
              : "0.0"}
            %
          </p>
          <span className="text-[11px] text-emerald-700 font-medium">Quality benchmark</span>
        </div>
      </div>

      {/* Subtabs & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("evaluations")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "evaluations" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Evaluations Feed ({evaluations.length})
          </button>
          <button
            onClick={() => setActiveTab("disputes")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "disputes" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Disputes Board ({pendingDisputes})
          </button>
          <button
            onClick={() => setActiveTab("scorecards")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "scorecards" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Scorecard Architect ({scorecards.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setCreateCardOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <Plus size={14} />
            New Scorecard
          </button>
          <button
            onClick={() => setEvalModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
          >
            <ShieldCheck size={14} />
            Audit Interaction
          </button>
        </div>
      </div>

      {activeTab === "evaluations" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Completed Quality Evaluations</h3>
          {evaluations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Interaction Reference</th>
                    <th className="pb-3">Agent</th>
                    <th className="pb-3">Scorecard</th>
                    <th className="pb-3">Score %</th>
                    <th className="pb-3">Defects</th>
                    <th className="pb-3">Result</th>
                    <th className="pb-3 text-right pr-2">Audited Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluations.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-mono font-bold text-slate-900">
                        {ev.interaction_reference || `#${ev.id}`}
                      </td>
                      <td className="py-3.5 font-medium text-slate-800">{ev.agent_name || `Agent #${ev.agent_id}`}</td>
                      <td className="py-3.5 text-slate-600">{ev.scorecard_name || "Standard QA"}</td>
                      <td className="py-3.5 font-black text-sm text-slate-900">{ev.score_percentage}%</td>
                      <td className="py-3.5">
                        <span className="font-bold text-rose-700">Crit: {ev.critical_defects_count || 0}</span> ·{" "}
                        <span className="text-slate-500">Maj: {ev.major_defects_count || 0}</span>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            ev.status === "passed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2 font-mono text-[11px] text-slate-500">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Zero evaluations recorded yet. Use "Audit Interaction" to conduct an audit.
            </div>
          )}
        </div>
      )}

      {activeTab === "disputes" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">QA Dispute Resolution & Calibration Queue</h3>
          {disputes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Eval Reference</th>
                    <th className="pb-3">Agent & Centre</th>
                    <th className="pb-3">Contested Reason</th>
                    <th className="pb-3">Original Score</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {disputes.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-mono font-bold text-slate-900">Eval #{d.evaluation_id}</td>
                      <td className="py-3.5 font-medium text-slate-800">{d.agent_name || "Agent"}</td>
                      <td className="py-3.5 text-slate-600 max-w-xs">{d.reason}</td>
                      <td className="py-3.5 font-black text-slate-900">{d.original_score != null ? `${d.original_score}%` : "—"}</td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            d.status === "resolved_overturned"
                              ? "bg-emerald-100 text-emerald-800"
                              : d.status === "resolved_upheld"
                              ? "bg-slate-100 text-slate-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {d.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        {d.status === "submitted" || d.status === "under_review" ? (
                          <button
                            onClick={() => openResolveModal(d)}
                            className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-primary/90 transition"
                          >
                            Resolve Dispute
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Zero active disputes filed across all partner operations.
            </div>
          )}
        </div>
      )}

      {activeTab === "scorecards" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {scorecards.map((sc) => (
            <div key={sc.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                    {sc.process_type}
                  </span>
                  <h4 className="mt-1 font-black text-slate-900 text-base">{sc.name}</h4>
                  <p className="text-xs text-slate-500">Pass Threshold: {sc.pass_threshold_percentage}%</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3 space-y-2 text-xs">
                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Weighted Criteria:</span>
                {(sc.criteria || []).map((crit: any, idx: number) => (
                  <div key={idx} className="flex justify-between border-b border-slate-200/50 pb-1 text-slate-600">
                    <span>{crit.name}</span>
                    <span className="font-mono font-bold text-slate-900">{crit.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Scorecard Modal */}
      {createCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-6 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Design Calibrated QA Scorecard</h3>
              <button
                onClick={() => setCreateCardOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateScorecard} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Scorecard Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inbound Healthcare Support QA Standard"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Process Type</label>
                  <select
                    value={cardForm.process_type}
                    onChange={(e) => setCardForm({ ...cardForm, process_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-primary"
                  >
                    <option value="voice">Voice</option>
                    <option value="chat">Chat</option>
                    <option value="email">Email</option>
                    <option value="ticket">Ticket</option>
                    <option value="back_office">Back Office</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Pass Threshold Percentage (%) *</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  required
                  value={cardForm.pass_threshold_percentage}
                  onChange={(e) => setCardForm({ ...cardForm, pass_threshold_percentage: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-primary"
                />
              </div>

              {/* Dynamic Criteria items */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Scorecard Criteria (Weights must sum to 100%)
                  </label>
                  <span className="font-mono text-xs font-bold text-primary">
                    Sum: {cardForm.criteria.reduce((a, c) => a + Number(c.weight), 0)}%
                  </span>
                </div>

                {cardForm.criteria.map((crit, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Criterion Name"
                      value={crit.name}
                      onChange={(e) => {
                        const next = [...cardForm.criteria];
                        next[idx].name = e.target.value;
                        setCardForm({ ...cardForm, criteria: next });
                      }}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      placeholder="Weight %"
                      value={crit.weight}
                      onChange={(e) => {
                        const next = [...cardForm.criteria];
                        next[idx].weight = Number(e.target.value);
                        setCardForm({ ...cardForm, criteria: next });
                      }}
                      className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-mono outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (cardForm.criteria.length <= 1) return;
                        setCardForm({
                          ...cardForm,
                          criteria: cardForm.criteria.filter((_, i) => i !== idx),
                        });
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCardForm({
                      ...cardForm,
                      criteria: [...cardForm.criteria, { name: "New Criterion", weight: 10, description: "" }],
                    })
                  }
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  + Add Another Criterion
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateCardOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  <Send size={14} /> Save Scorecard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Interaction Modal */}
      {evalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-6 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Conduct Interaction Quality Audit</h3>
              <button
                onClick={() => setEvalModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEvaluationSubmit} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Select Scorecard *</label>
                  <select
                    required
                    value={evalForm.scorecard_id}
                    onChange={(e) => handleScorecardSelection(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  >
                    <option value="">Choose a scorecard...</option>
                    {scorecards.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name} ({sc.process_type}, pass threshold: {sc.pass_threshold_percentage}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Select Agent *</label>
                  <select
                    required
                    value={evalForm.agent_id}
                    onChange={(e) => setEvalForm({ ...evalForm, agent_id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  >
                    <option value="">Choose an agent...</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Interaction / Call Reference ID</label>
                <input
                  type="text"
                  placeholder="e.g. CALL-US-20260918-0042"
                  value={evalForm.interaction_reference}
                  onChange={(e) => setEvalForm({ ...evalForm, interaction_reference: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              {/* Criteria Scoring */}
              {selectedScDetails && Array.isArray(selectedScDetails.criteria) && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Criteria Scoring:</h4>
                  {selectedScDetails.criteria.map((crit: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-4">
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">{crit.name}</span>{" "}
                        <span className="text-[11px] text-slate-400">({crit.weight} pts max)</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={crit.weight}
                        required
                        value={evalForm.criteria_scores[crit.name] ?? crit.weight}
                        onChange={(e) =>
                          setEvalForm({
                            ...evalForm,
                            criteria_scores: {
                              ...evalForm.criteria_scores,
                              [crit.name]: Number(e.target.value),
                            },
                          })
                        }
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Defect Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 uppercase">Critical Defects</label>
                  <input
                    type="number"
                    min="0"
                    value={evalForm.critical_defects_count}
                    onChange={(e) => setEvalForm({ ...evalForm, critical_defects_count: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-rose-200 bg-rose-50/30 px-3 py-1.5 text-xs font-mono font-bold text-rose-700"
                  />
                  <span className="text-[10px] text-slate-400">&gt;0 triggers auto-fail</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-600 uppercase">Major Defects</label>
                  <input
                    type="number"
                    min="0"
                    value={evalForm.major_defects_count}
                    onChange={(e) => setEvalForm({ ...evalForm, major_defects_count: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/30 px-3 py-1.5 text-xs font-mono font-bold text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Minor Defects</label>
                  <input
                    type="number"
                    min="0"
                    value={evalForm.minor_defects_count}
                    onChange={(e) => setEvalForm({ ...evalForm, minor_defects_count: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Human Evaluator Feedback Notes *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail positive behaviors demonstrated, process compliance, and areas for supervisor follow-up..."
                  value={evalForm.feedback_notes}
                  onChange={(e) => setEvalForm({ ...evalForm, feedback_notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  <Send size={14} /> Calculate & Record Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolveModalOpen && selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Resolve QA Dispute</h3>
                <p className="text-xs text-slate-500 font-medium">Evaluation #{selectedDispute.evaluation_id}</p>
              </div>
              <button
                onClick={() => setResolveModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <span className="text-slate-400 font-bold">Partner Rebuttal:</span>
                <p className="text-slate-700">{selectedDispute.reason}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Calibration Decision *</label>
                <select
                  value={disputeDecision}
                  onChange={(e) => setDisputeDecision(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-primary"
                >
                  <option value="resolved_overturned">Overturn (Adjust Score & Clear Defect)</option>
                  <option value="resolved_upheld">Uphold Original Score (No Change)</option>
                </select>
              </div>

              {disputeDecision === "resolved_overturned" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Revised Score % *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={adjustedScore}
                    onChange={(e) => setAdjustedScore(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Resolution Audit Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  <Send size={14} /> Submit Final Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
