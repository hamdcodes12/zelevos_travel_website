import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  User,
  StickyNote,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  Globe,
  Phone,
  Tag,
  Share2,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";

export interface SubmissionItem {
  id: number;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface AdminLeadDetailDrawerProps {
  lead: SubmissionItem | null;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => Promise<void>;
  onSaveNote: (id: number, notes: string) => Promise<void>;
  onAssign?: (id: number, assignee: string) => Promise<void>;
  onScheduleFollowUp?: (id: number, date: string, notes?: string) => Promise<void>;
  onConvert?: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const STATUS_OPTIONS = [
  { key: "new", label: "New Inquiry", color: "bg-blue-50 text-[#214ECF] border-blue-200" },
  { key: "contacted", label: "Contacted", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "qualified", label: "Qualified", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "proposal", label: "Proposal Sent", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "closed_won", label: "Closed / Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "closed_lost", label: "Closed / Lost", color: "bg-rose-50 text-rose-700 border-rose-200" },
];

export function AdminLeadDetailDrawer({
  lead,
  onClose,
  onStatusChange,
  onSaveNote,
  onAssign,
  onScheduleFollowUp,
  onConvert,
  onDelete,
}: AdminLeadDetailDrawerProps) {
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "notes" | "timeline">("details");

  useEffect(() => {
    if (lead) {
      setNoteText(lead.notes || "");
      setShowDeleteConfirm(false);
      setShowConvertConfirm(false);
    }
  }, [lead]);

  if (!lead) return null;

  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.key === lead.status) || STATUS_OPTIONS[0];

  const handleStatusSelect = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);
      await onStatusChange(lead.id, newStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleNoteSave = async () => {
    try {
      setSavingNote(true);
      await onSaveNote(lead.id, noteText);
    } finally {
      setSavingNote(false);
    }
  };

  const handleAssign = async () => {
    if (!assigneeInput.trim() || !onAssign) return;
    try {
      setAssigning(true);
      await onAssign(lead.id, assigneeInput.trim());
      setAssigneeInput("");
    } finally {
      setAssigning(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!followUpDate || !onScheduleFollowUp) return;
    try {
      setSchedulingFollowUp(true);
      await onScheduleFollowUp(lead.id, followUpDate, followUpNote.trim());
      setFollowUpDate("");
      setFollowUpNote("");
    } finally {
      setSchedulingFollowUp(false);
    }
  };

  const handleConvert = async () => {
    if (!onConvert) return;
    try {
      setConverting(true);
      await onConvert(lead.id);
      setShowConvertConfirm(false);
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onDelete(lead.id);
      onClose();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Derive simple timeline items from creation and notes
  const timelineItems = [
    {
      title: "Inbound Lead Submitted",
      desc: `Received via ${lead.source?.replace(/_/g, " ") || "Contact Form"}`,
      time: new Date(lead.createdAt).toLocaleString(),
      type: "created",
    },
  ];

  if (lead.notes && lead.notes.includes("[Assigned to:")) {
    timelineItems.push({
      title: "Owner Assigned",
      desc: "Lead ownership updated in audit log",
      time: "Logged in Notes",
      type: "assigned",
    });
  }

  if (lead.notes && lead.notes.includes("[Follow-up scheduled:")) {
    timelineItems.push({
      title: "Follow-up Scheduled",
      desc: "Scheduled follow-up reminder",
      time: "Scheduled",
      type: "followup",
    });
  }

  if (lead.status === "closed_won" || (lead.notes && lead.notes.includes("converted"))) {
    timelineItems.push({
      title: "Converted to Client",
      desc: "Opportunity successfully won",
      time: "Won",
      type: "converted",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 flex-shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base bg-blue-50 text-[#214ECF] border border-blue-200/80 shadow-2xs flex-shrink-0">
              {lead.name ? lead.name.charAt(0).toUpperCase() : "L"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 truncate">{lead.name}</h2>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-2xs capitalize ${currentStatusObj.color}`}
                >
                  {currentStatusObj.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate flex items-center gap-2 mt-0.5">
                <span>{lead.email}</span>
                {lead.company && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600 font-medium">{lead.company}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 px-6 gap-6 bg-white text-xs font-semibold text-slate-500">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "details"
                ? "border-[#214ECF] text-[#214ECF]"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            Overview & Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "notes"
                ? "border-[#214ECF] text-[#214ECF]"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <span>Notes & Follow-up</span>
            {lead.notes && <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "timeline"
                ? "border-[#214ECF] text-[#214ECF]"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            Activity Timeline
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Quick Status Bar */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/80 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#214ECF] mb-1">
                    Pipeline Stage
                  </div>
                  <div className="text-xs text-slate-600">
                    Update lead status across enterprise workflow
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={lead.status}
                    disabled={updatingStatus}
                    onChange={(e) => handleStatusSelect(e.target.value)}
                    className="appearance-none pl-3.5 pr-8 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Building2 size={11} className="text-slate-400" />
                    <span>Company</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate">
                    {lead.company || "Not Specified"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <DollarSign size={11} className="text-emerald-600" />
                    <span>Budget Range</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-700 truncate">
                    {lead.budget || "Pending Discussion"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Tag size={11} className="text-slate-400" />
                    <span>Channel / Source</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 capitalize truncate">
                    {lead.source?.replace(/_/g, " ") || "Website Inbound"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar size={11} className="text-slate-400" />
                    <span>Received Date</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate">
                    {new Date(lead.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>

              {/* Inquiry Message */}
              <div>
                <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Inquiry Message / Request Scope</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    Original Form Payload
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                  {lead.message || "No custom message provided."}
                </div>
              </div>

              {/* Quick Contact Box */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                  Direct Contact Actions
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${lead.email}?subject=${encodeURIComponent(
                      "Thinkatic Enterprise Consultation — Next Steps"
                    )}`}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#214ECF] text-white hover:bg-[#1a3db3] transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Send Email to {lead.name.split(" ")[0]}</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-6">
              {/* Internal Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <StickyNote size={13} className="text-[#214ECF]" />
                    <span>Private Internal Notes</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Visible only to Thinkatic Admins
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record call logs, qualification notes, client budget details, or negotiation milestones..."
                  className="w-full p-4 rounded-2xl text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] resize-none transition-all placeholder:text-slate-400 leading-relaxed"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNoteSave}
                    disabled={savingNote}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#214ECF] text-white hover:bg-[#1a3db3] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {savingNote ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>{savingNote ? "Saving..." : "Save Notes"}</span>
                  </button>
                </div>
              </div>

              {/* Assignment Box */}
              {onAssign && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User size={13} className="text-[#214ECF]" />
                    <span>Assign Lead Owner</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Gurpreet Singh / Senior Account Exec"
                      value={assigneeInput}
                      onChange={(e) => setAssigneeInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                    />
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={assigning || !assigneeInput.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {assigning ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Follow-up Box */}
              {onScheduleFollowUp && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock size={13} className="text-[#214ECF]" />
                    <span>Schedule Client Follow-up</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                    />
                    <input
                      type="text"
                      placeholder="Agenda or reminder notes..."
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleScheduleFollowUp}
                        disabled={schedulingFollowUp || !followUpDate}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#214ECF] text-white hover:bg-[#1a3db3] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {schedulingFollowUp ? "Scheduling..." : "Save Follow-up"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                Operational Audit & History
              </div>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timelineItems.map((item, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#214ECF] ring-4 ring-white" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{item.desc}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {onConvert && lead.status !== "closed_won" && (
              <button
                type="button"
                onClick={() => setShowConvertConfirm(true)}
                className="py-2.5 px-3.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>Mark Converted</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
              title="Delete Lead"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Convert Confirmation Modal */}
        <AnimatePresence>
          {showConvertConfirm && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl max-w-sm w-full space-y-4"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Convert Lead to Won?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    This will update <strong>{lead.name}</strong> to Closed / Won status and record a conversion audit log.
                  </p>
                </div>
                <div className="flex items-center gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConvertConfirm(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConvert}
                    disabled={converting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {converting ? "Converting..." : "Confirm Conversion"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl max-w-sm w-full space-y-4"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Delete Lead?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Are you sure you want to delete <strong>{lead.name}</strong>? This action creates an audit trail entry.
                  </p>
                </div>
                <div className="flex items-center gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Lead"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default AdminLeadDetailDrawer;
