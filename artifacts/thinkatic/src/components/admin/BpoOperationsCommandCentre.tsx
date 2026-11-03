import { useEffect, useState, type FormEvent } from "react";
import {
  Users,
  Award,
  GraduationCap,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Plus,
  FileText,
  FileCheck,
  Check,
  Ban,
  Building2,
  HelpCircle,
  Sparkles,
  CalendarDays,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import AdminOperationsAttendancePanel from "./AdminOperationsAttendancePanel";
import AdminOperationsProductionPanel from "./AdminOperationsProductionPanel";
import AdminOperationsQAPanel from "./AdminOperationsQAPanel";
import AdminOperationsCompliancePanel from "./AdminOperationsCompliancePanel";
import AdminOperationsReportsPanel from "./AdminOperationsReportsPanel";

interface AdminAgentDoc {
  id: number;
  agent_id: number;
  document_type: string;
  document_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason?: string;
  uploaded_at: string;
}

interface AdminAgent {
  id: number;
  partner_id: string;
  centre_id?: number | null;
  employee_id: string;
  agent_code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string;
  department?: string;
  experience_years?: number;
  languages?: string[];
  skills?: string[];
  shift_preference?: string;
  joining_date?: string;
  status: string;
  onboarding_status?: string;
  training_status?: string;
  certification_status?: string;
  documents?: AdminAgentDoc[];
  created_at: string;
}

interface AdminTrainingProgram {
  id: number;
  title: string;
  training_code: string;
  category: string;
  description: string;
  duration_hours: number;
  passing_score: number;
  status: string;
  modules?: any[];
  questions?: any[];
  enrolled_count?: number;
}

interface AdminCert {
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

function adminApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("admin_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

export default function BpoOperationsCommandCentre() {
  const [subTab, setSubTab] = useState<
    "agents" | "training" | "certifications" | "attendance" | "production" | "qa" | "compliance" | "reports"
  >("agents");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Agents State
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<AdminAgent | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [updatingAgentStatus, setUpdatingAgentStatus] = useState(false);

  // Training Programs State
  const [programs, setPrograms] = useState<AdminTrainingProgram[]>([]);
  const [createProgOpen, setCreateProgOpen] = useState(false);
  const [progForm, setProgForm] = useState({
    title: "",
    category: "Compliance & Security",
    description: "",
    duration_hours: 8,
    passing_score: 80,
  });

  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [selectedProgForModule, setSelectedProgForModule] = useState<number | "">("");
  const [moduleForm, setModuleForm] = useState({
    title: "",
    content: "",
    duration_minutes: 30,
    order_index: 1,
    is_mandatory: true,
  });

  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [selectedProgForQuestion, setSelectedProgForQuestion] = useState<number | "">("");
  const [questionForm, setQuestionForm] = useState({
    question: "",
    option1: "",
    option2: "",
    option3: "",
    option4: "",
    correct_option: 1,
  });

  // Certifications State
  const [certifications, setCertifications] = useState<AdminCert[]>([]);
  const [revokeCertOpen, setRevokeCertOpen] = useState(false);
  const [selectedCertForRevoke, setSelectedCertForRevoke] = useState<AdminCert | null>(null);
  const [revocationReason, setRevocationReason] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4500);
  };

  async function loadData() {
    setLoading(true);
    try {
      const [agentsRes, progRes, certsRes] = await Promise.all([
        adminApi("/admin/bpo/agents?limit=100"),
        adminApi("/admin/bpo/training/programs"),
        adminApi("/admin/bpo/certifications"),
      ]);

      if (agentsRes.ok) {
        const d = await agentsRes.json();
        setAgents(d.agents || []);
      }
      if (progRes.ok) {
        const d = await progRes.json();
        setPrograms(Array.isArray(d) ? d : d.programs || []);
      }
      if (certsRes.ok) {
        const d = await certsRes.json();
        setCertifications(d.certifications || []);
      }
    } catch (err) {
      console.error("Failed to load operations data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function openReviewModal(agent: AdminAgent) {
    setSelectedAgent(agent);
    setReviewModalOpen(true);
    try {
      const res = await adminApi(`/admin/bpo/agents/${agent.id}`);
      if (res.ok) setSelectedAgent(await res.json());
    } catch {}
  }

  async function handleVerifyDoc(docId: number, status: "verified" | "rejected") {
    let notes = "";
    if (status === "rejected") {
      notes = prompt("Enter reason for document rejection:") || "Document does not meet compliance standards";
    }

    try {
      const res = await adminApi(`/admin/bpo/agents/documents/${docId}/verify`, {
        method: "POST",
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        showToast(`Document #${docId} marked as ${status}`);
        if (selectedAgent) {
          const updatedAgentRes = await adminApi(`/admin/bpo/agents/${selectedAgent.id}`);
          if (updatedAgentRes.ok) setSelectedAgent(await updatedAgentRes.json());
        }
        await loadData();
      }
    } catch (err) {
      alert("Failed to update document status");
    }
  }

  async function handleSetAgentStatus(newStatus: "active" | "suspended" | "rejected") {
    if (!selectedAgent) return;
    setUpdatingAgentStatus(true);

    try {
      const res = await adminApi(`/admin/bpo/agents/${selectedAgent.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Agent ${selectedAgent.agent_code} transitioned to "${newStatus}"`);
        setReviewModalOpen(false);
        await loadData();
      } else {
        const b = await res.json();
        alert(b.error || "Failed to transition status");
      }
    } finally {
      setUpdatingAgentStatus(false);
    }
  }

  async function handleCreateProgram(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await adminApi("/admin/bpo/training/programs", {
        method: "POST",
        body: JSON.stringify(progForm),
      });
      if (res.ok) {
        showToast("Training program created successfully");
        setCreateProgOpen(false);
        setProgForm({
          title: "",
          category: "Compliance & Security",
          description: "",
          duration_hours: 8,
          passing_score: 80,
        });
        await loadData();
      }
    } catch (err) {
      alert("Failed to create program");
    }
  }

  async function handleAddModule(e: FormEvent) {
    e.preventDefault();
    if (!selectedProgForModule) return;
    try {
      const res = await adminApi(`/admin/bpo/training/programs/${selectedProgForModule}/modules`, {
        method: "POST",
        body: JSON.stringify(moduleForm),
      });
      if (res.ok) {
        showToast("Module added to program curriculum");
        setAddModuleOpen(false);
        setModuleForm({
          title: "",
          content: "",
          duration_minutes: 30,
          order_index: 1,
          is_mandatory: true,
        });
        await loadData();
      }
    } catch (err) {
      alert("Failed to add module");
    }
  }

  async function handleAddQuestion(e: FormEvent) {
    e.preventDefault();
    if (!selectedProgForQuestion) return;
    try {
      const res = await adminApi(`/admin/bpo/training/programs/${selectedProgForQuestion}/questions`, {
        method: "POST",
        body: JSON.stringify({
          question: questionForm.question,
          options: [
            questionForm.option1,
            questionForm.option2,
            questionForm.option3,
            questionForm.option4,
          ],
          correct_option: Number(questionForm.correct_option),
        }),
      });
      if (res.ok) {
        showToast("Assessment question added to program question bank");
        setAddQuestionOpen(false);
        setQuestionForm({
          question: "",
          option1: "",
          option2: "",
          option3: "",
          option4: "",
          correct_option: 1,
        });
        await loadData();
      }
    } catch (err) {
      alert("Failed to add question");
    }
  }

  async function handleRevokeCertSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedCertForRevoke) return;

    try {
      const res = await adminApi(`/admin/bpo/certifications/${selectedCertForRevoke.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({
          reason: revocationReason || "Quality / compliance failure",
        }),
      });
      if (res.ok) {
        showToast(`Certificate ${selectedCertForRevoke.certificate_code} has been revoked`);
        setRevokeCertOpen(false);
        setSelectedCertForRevoke(null);
        setRevocationReason("");
        await loadData();
      }
    } catch (err) {
      alert("Failed to revoke certificate");
    }
  }

  // Filtered agents
  const filteredAgents = agents.filter((a) => {
    const q = agentSearch.toLowerCase();
    const matchesSearch =
      !agentSearch ||
      a.name.toLowerCase().includes(q) ||
      a.agent_code?.toLowerCase().includes(q) ||
      a.employee_id.toLowerCase().includes(q);
    const matchesStatus =
      agentStatusFilter === "all" ||
      a.status === agentStatusFilter ||
      a.onboarding_status === agentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm transition">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── HEADER & SUBTAB PILLS ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            Thinkatic Delivery Network · Operations Hub
          </span>
          <h2 className="mt-1.5 text-2xl font-black text-slate-900">
            BPO Operations & Agent Command Centre
          </h2>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 text-xs font-bold">
          <button
            onClick={() => setSubTab("agents")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "agents"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users size={13} />
            Agents ({agents.length})
          </button>

          <button
            onClick={() => setSubTab("training")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "training"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GraduationCap size={13} />
            Training ({programs.length})
          </button>

          <button
            onClick={() => setSubTab("certifications")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "certifications"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Award size={13} />
            Certs ({certifications.length})
          </button>

          <button
            onClick={() => setSubTab("attendance")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "attendance"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarDays size={13} />
            Attendance
          </button>

          <button
            onClick={() => setSubTab("production")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "production"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 size={13} />
            Production
          </button>

          <button
            onClick={() => setSubTab("qa")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "qa"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck size={13} />
            QA Studio
          </button>

          <button
            onClick={() => setSubTab("compliance")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "compliance"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldAlert size={13} />
            Compliance
          </button>

          <button
            onClick={() => setSubTab("reports")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
              subTab === "reports"
                ? "bg-white text-primary shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText size={13} />
            Reports & Export
          </button>
        </div>
      </div>

      {/* ── SUBTAB 1: AGENT DIRECTORY & ONBOARDING VERIFICATION ───────── */}
      {subTab === "agents" && (
        <div className="space-y-5">
          {/* Metrics summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Network Headcount</span>
              <p className="mt-2 text-2xl font-black text-slate-900">{agents.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active & Deployed</span>
              <p className="mt-2 text-2xl font-black text-emerald-700">
                {agents.filter((a) => a.status === "active").length}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending Review</span>
              <p className="mt-2 text-2xl font-black text-amber-700">
                {agents.filter((a) => a.status === "pending_verification").length}
              </p>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Issued Certifications</span>
              <p className="mt-2 text-2xl font-black text-purple-700">{certifications.length}</p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Filter by Agent Code, Name, Employee ID..."
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs outline-none focus:border-primary focus:bg-white"
                />
              </div>

              <select
                value={agentStatusFilter}
                onChange={(e) => setAgentStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active & Verified</option>
                <option value="pending_verification">Pending Review</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Agent Code</th>
                  <th className="px-4 py-3">Full Profile</th>
                  <th className="px-4 py-3">Partner Centre</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold whitespace-nowrap">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-white">
                        {agent.agent_code || `THK-AGT-${agent.id}`}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">Emp: {agent.employee_id}</span>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      <p className="font-bold">{agent.name}</p>
                      <p className="text-[11px] text-slate-400">{agent.email || "No email"}</p>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="font-mono text-[11px] text-primary font-bold">
                        {agent.partner_id ? agent.partner_id.slice(0, 8) + "..." : "Default Centre"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {agent.department || "Operations"}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{agent.designation || "Agent"}</p>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {agent.status === "active" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : agent.status === "suspended" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                          <AlertCircle size={10} /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <Clock size={10} /> Pending Review
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => openReviewModal(agent)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-primary shadow-2xs"
                      >
                        <ShieldCheck size={13} />
                        Review & Onboard
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBTAB 2: TRAINING PROGRAMS & QUESTION BANKS ───────────────── */}
      {subTab === "training" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Platform Curriculum Directory</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddQuestionOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <HelpCircle size={14} />
                + Add Exam Question
              </button>

              <button
                onClick={() => setAddModuleOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <Plus size={14} />
                + Add Module
              </button>

              <button
                onClick={() => setCreateProgOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
              >
                <Sparkles size={14} />
                + Create Program
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {programs.map((program) => (
              <div key={program.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {program.category}
                    </span>
                    <h4 className="text-base font-black text-slate-900 mt-1.5">{program.title}</h4>
                  </div>
                  <span className="font-mono text-xs font-black text-slate-400">{program.training_code}</span>
                </div>

                <p className="text-xs text-slate-600 leading-5">{program.description}</p>

                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Duration</span>
                    <p className="font-black text-slate-800">{program.duration_hours} Hours</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Pass Benchmark</span>
                    <p className="font-black text-emerald-700">{program.passing_score}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Modules</span>
                    <p className="font-black text-slate-800">{(program.modules || []).length} Units</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUBTAB 3: CERTIFICATIONS REGISTRY ─────────────────────────── */}
      {subTab === "certifications" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Issued Network Credentials</h3>
            <span className="text-xs text-slate-400">Total Valid Certificates: {certifications.length}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Credential Code</th>
                  <th className="px-4 py-3">Accredited Agent</th>
                  <th className="px-4 py-3">Program Qualification</th>
                  <th className="px-4 py-3">Issued On</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Revocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certifications.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-black text-purple-900">
                      {cert.certificate_code}
                    </td>

                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      {cert.agent_name || `Agent #${cert.agent_id}`}
                      <span className="block font-mono text-[10px] text-slate-400 font-normal">
                        {cert.agent_code || "Direct ID"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {cert.program_title || `Program #${cert.program_id}`}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(cert.issued_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(cert.expires_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {cert.status === "active" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                          <Ban size={10} /> Revoked
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {cert.status === "active" && (
                        <button
                          onClick={() => {
                            setSelectedCertForRevoke(cert);
                            setRevocationReason("");
                            setRevokeCertOpen(true);
                          }}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBTAB 4: ATTENDANCE & PUNCH CORRECTIONS OVERSIGHT ────────── */}
      {subTab === "attendance" && (
        <AdminOperationsAttendancePanel adminApi={adminApi} />
      )}

      {/* ── SUBTAB 5: PRODUCTION & PRODUCTIVITY CONSOLE ───────────────── */}
      {subTab === "production" && (
        <AdminOperationsProductionPanel adminApi={adminApi} />
      )}

      {/* ── SUBTAB 6: QA STUDIO, EVALUATIONS & CALIBRATION ────────────── */}
      {subTab === "qa" && (
        <AdminOperationsQAPanel adminApi={adminApi} />
      )}

      {/* ── SUBTAB 7: COMPLIANCE, EXCEPTIONS & CAPA COMMAND ───────────── */}
      {subTab === "compliance" && (
        <AdminOperationsCompliancePanel adminApi={adminApi} />
      )}

      {/* ── SUBTAB 8: GLOBAL OPERATIONS REPORTING & EXPORT ────────────── */}
      {subTab === "reports" && (
        <AdminOperationsReportsPanel adminApi={adminApi} />
      )}

      {/* ── MODAL: ADMIN REVIEW & ONBOARDING DECISION ─────────────────── */}
      {reviewModalOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-6 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-black text-primary">
                  {selectedAgent.agent_code || `THK-AGT-${selectedAgent.id}`}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Review Agent Compliance Dossier</h3>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="rounded-full border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Agent info */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-400">Agent Name</span>
                  <p className="font-bold text-slate-900">{selectedAgent.name}</p>
                </div>
                <div>
                  <span className="text-slate-400">Employee ID</span>
                  <p className="font-mono font-bold text-slate-900">{selectedAgent.employee_id}</p>
                </div>
                <div>
                  <span className="text-slate-400">Department & Designation</span>
                  <p className="font-bold text-slate-900">
                    {selectedAgent.department} · {selectedAgent.designation}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Current Status</span>
                  <p className="font-bold capitalize text-primary">{selectedAgent.status}</p>
                </div>
              </div>

              {/* Compliance Documents Verification */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Uploaded Compliance Documents ({(selectedAgent.documents || []).length})
                </h4>

                <div className="space-y-2">
                  {(selectedAgent.documents || []).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <div>
                          <p className="font-bold text-slate-800">{doc.document_name}</p>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {doc.document_type.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {doc.verification_status === "verified" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 size={10} /> Verified
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleVerifyDoc(doc.id, "verified")}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerifyDoc(doc.id, "rejected")}
                              className="rounded-lg border border-rose-300 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {!selectedAgent.documents?.length && (
                    <p className="text-xs text-slate-400 italic">No documents attached.</p>
                  )}
                </div>
              </div>

              {/* Onboarding Decision */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Onboarding Decision & Operational Transition
                </h4>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleSetAgentStatus("suspended")}
                    disabled={updatingAgentStatus}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    Suspend Agent
                  </button>

                  <button
                    onClick={() => handleSetAgentStatus("active")}
                    disabled={updatingAgentStatus}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {updatingAgentStatus ? "Processing..." : "Approve & Activate Agent →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE PROGRAM ──────────────────────────────────────── */}
      {createProgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900">Create Training Program</h4>
              <button onClick={() => setCreateProgOpen(false)} className="rounded-full p-1 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProgram} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600">Program Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Healthcare BPO & Patient Data Protection"
                  value={progForm.title}
                  onChange={(e) => setProgForm({ ...progForm, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Category *</label>
                <select
                  value={progForm.category}
                  onChange={(e) => setProgForm({ ...progForm, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  <option value="Compliance & Security">Compliance & Security</option>
                  <option value="Customer Experience">Customer Experience</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Campaign Operations">Campaign Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Description</label>
                <textarea
                  rows={2}
                  value={progForm.description}
                  onChange={(e) => setProgForm({ ...progForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600">Duration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={progForm.duration_hours}
                    onChange={(e) => setProgForm({ ...progForm, duration_hours: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600">Passing Score (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={progForm.passing_score}
                    onChange={(e) => setProgForm({ ...progForm, passing_score: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateProgOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  Create Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD MODULE ──────────────────────────────────────────── */}
      {addModuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900">Add Curriculum Module</h4>
              <button onClick={() => setAddModuleOpen(false)} className="rounded-full p-1 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddModule} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600">Target Program *</label>
                <select
                  required
                  value={selectedProgForModule}
                  onChange={(e) => setSelectedProgForModule(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  <option value="">-- Choose Program --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.training_code} · {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Module Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HIPAA Security Standards & Protocol Execution"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Content / Syllabus Summary</label>
                <textarea
                  rows={2}
                  value={moduleForm.content}
                  onChange={(e) => setModuleForm({ ...moduleForm, content: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    value={moduleForm.duration_minutes}
                    onChange={(e) => setModuleForm({ ...moduleForm, duration_minutes: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600">Sequence Order</label>
                  <input
                    type="number"
                    min="1"
                    value={moduleForm.order_index}
                    onChange={(e) => setModuleForm({ ...moduleForm, order_index: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModuleOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedProgForModule}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  Add Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD QUESTION ────────────────────────────────────────── */}
      {addQuestionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900">Add Exam Question</h4>
              <button onClick={() => setAddQuestionOpen(false)} className="rounded-full p-1 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddQuestion} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600">Target Program *</label>
                <select
                  required
                  value={selectedProgForQuestion}
                  onChange={(e) => setSelectedProgForQuestion(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  <option value="">-- Choose Program --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.training_code} · {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Question Text *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Which of the following constitutes PHI under HIPAA?"
                  value={questionForm.question}
                  onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  placeholder="Option 1"
                  value={questionForm.option1}
                  onChange={(e) => setQuestionForm({ ...questionForm, option1: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
                <input
                  type="text"
                  required
                  placeholder="Option 2"
                  value={questionForm.option2}
                  onChange={(e) => setQuestionForm({ ...questionForm, option2: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
                <input
                  type="text"
                  required
                  placeholder="Option 3"
                  value={questionForm.option3}
                  onChange={(e) => setQuestionForm({ ...questionForm, option3: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
                <input
                  type="text"
                  required
                  placeholder="Option 4"
                  value={questionForm.option4}
                  onChange={(e) => setQuestionForm({ ...questionForm, option4: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Correct Option (1-4)</label>
                <select
                  value={questionForm.correct_option}
                  onChange={(e) => setQuestionForm({ ...questionForm, correct_option: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  <option value={1}>Option 1</option>
                  <option value={2}>Option 2</option>
                  <option value={3}>Option 3</option>
                  <option value={4}>Option 4</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddQuestionOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedProgForQuestion}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REVOKE CERTIFICATE ──────────────────────────────────── */}
      {revokeCertOpen && selectedCertForRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-rose-900">Revoke Network Credential</h4>
              <button onClick={() => setRevokeCertOpen(false)} className="rounded-full p-1 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRevokeCertSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to revoke credential{" "}
                <b className="font-mono text-slate-900">{selectedCertForRevoke.certificate_code}</b>? This will permanently invalidate the agent's delivery accreditation.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-600">Reason for Revocation *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Critical QA breach, regulatory non-compliance, or misconduct."
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokeCertOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
                >
                  Confirm Revocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
