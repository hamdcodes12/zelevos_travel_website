import React, { useState } from "react";
import {
  LifeBuoy,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  Tag,
  X,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

interface AgentSupportSectionProps {
  tickets: any[];
  onCreateTicket: (ticketData: {
    subject: string;
    category: string;
    priority: string;
    description: string;
    projectId?: number;
  }) => Promise<void>;
  submitting: boolean;
  projects?: any[];
}

export const AgentSupportSection: React.FC<AgentSupportSectionProps> = ({
  tickets,
  onCreateTicket,
  submitting,
  projects = [],
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Technical Issue");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!subject.trim() || subject.trim().length < 3) {
      setError("Subject must be at least 3 characters.");
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setError("Description must be at least 5 characters.");
      return;
    }

    try {
      await onCreateTicket({
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
      });
      setShowCreateModal(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
    } catch (err: any) {
      setError(err?.message || "Failed to create support ticket.");
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "open").toUpperCase();
    switch (s) {
      case "RESOLVED":
      case "CLOSED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "IN_PROGRESS":
        return "bg-blue-50 text-[#214ECF] border-blue-200";
      case "WAITING_FOR_AGENT":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <LifeBuoy className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Operations Support Desk
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Support & Ticket Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Open human assistance tickets with your BPO supervisor for technical workstation issues, shift adjustments, or operational questions.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* ── TICKETS LIST ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {tickets.length === 0 ? (
          <div className="py-16 text-center">
            <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">No Support Tickets Found</div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              You haven't opened any support tickets. If you encounter any technical or operational hurdles, click "Create Ticket".
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-[#1a3fa8] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Open Your First Ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <div
                key={ticket.id || ticket.ticket_number}
                onClick={() => setSelectedTicket(ticket)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-[#214ECF]">
                        {ticket.ticket_number}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {ticket.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{ticket.subject}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{ticket.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                      ticket.status
                    )}`}
                  >
                    {ticket.status?.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {ticket.created_at
                      ? new Date(ticket.created_at).toLocaleDateString([], { month: "short", day: "numeric" })
                      : "Recently"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE TICKET MODAL ─────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Create Support Ticket</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Headset audio crackling on Station 14"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="Shift / Attendance">Shift / Attendance</option>
                    <option value="Quality / Dispute">Quality / Dispute</option>
                    <option value="Workstation / Equipment">Workstation / Equipment</option>
                    <option value="General Support">General Support</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={4}
                  placeholder="Provide detailed information regarding the issue so your supervisor can assist quickly..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TICKET DETAILS MODAL ────────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold text-[#214ECF]">
                  {selectedTicket.ticket_number}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] block font-semibold">Category</span>
                <span className="font-bold text-slate-800">{selectedTicket.category}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] block font-semibold">Status</span>
                <span className="font-bold uppercase text-[#214ECF]">{selectedTicket.status}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <span className="text-slate-400 uppercase text-[10px] block font-semibold mb-1">
                Description
              </span>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.description}
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
