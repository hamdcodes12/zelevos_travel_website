import React, { useState } from "react";
import {
  PhoneCall,
  X,
  Clock,
  Briefcase,
  User,
  Tag,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";

interface AgentCallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (callData: {
    callType: "inbound" | "outbound";
    duration: number;
    customerReference: string;
    outcome: string;
    notes: string;
    nextFollowupDate: string | null;
    projectId: number;
  }) => Promise<void>;
  submitting: boolean;
  projects?: any[];
  defaultProjectId?: number;
}

export const AgentCallLogModal: React.FC<AgentCallLogModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  projects = [],
  defaultProjectId = 105,
}) => {
  const [callType, setCallType] = useState<"inbound" | "outbound">("inbound");
  const [duration, setDuration] = useState<number>(180);
  const [customerRef, setCustomerRef] = useState("");
  const [outcome, setOutcome] = useState("Resolved");
  const [notes, setNotes] = useState("");
  const [followupRequired, setFollowupRequired] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [projectId, setProjectId] = useState<number>(defaultProjectId);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (duration <= 0) {
      setError("Please specify a valid call duration.");
      return;
    }

    try {
      await onSubmit({
        callType,
        duration: Number(duration),
        customerReference: customerRef.trim(),
        outcome,
        notes: notes.trim(),
        nextFollowupDate: followupRequired && followupDate ? followupDate : null,
        projectId: Number(projectId) || defaultProjectId,
      });
      // Reset form
      setCustomerRef("");
      setNotes("");
      setFollowupRequired(false);
      setFollowupDate("");
      setDuration(180);
    } catch (err: any) {
      setError(err?.message || "Failed to log call activity. Please try again.");
    }
  };

  const presetDurations = [
    { label: "1m", sec: 60 },
    { label: "3m", sec: 180 },
    { label: "5m", sec: 300 },
    { label: "7m", sec: 420 },
    { label: "10m", sec: 600 },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Log Work / Call Activity</h2>
              <p className="text-xs text-slate-500">Record frontline manual telephone operations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Call Direction Toggle */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Call Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCallType("inbound")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  callType === "inbound"
                    ? "bg-[#214ECF] text-white border-[#214ECF] shadow-sm shadow-blue-600/20"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <PhoneIncoming className="w-4 h-4" />
                <span>Inbound Call</span>
              </button>
              <button
                type="button"
                onClick={() => setCallType("outbound")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  callType === "outbound"
                    ? "bg-[#214ECF] text-white border-[#214ECF] shadow-sm shadow-blue-600/20"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <PhoneOutgoing className="w-4 h-4" />
                <span>Outbound Call</span>
              </button>
            </div>
          </div>

          {/* Campaign Selection */}
          {projects.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Assigned Campaign / Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF] transition-all cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.project_id} value={p.project_id}>
                    {p.name} (#{p.project_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Duration & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Duration (Seconds)</label>
              <span className="text-xs font-mono text-[#214ECF]">
                {Math.floor(duration / 60)}m {duration % 60}s
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min="1"
                max="7200"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF] transition-all"
              />
              <div className="flex items-center gap-1">
                {presetDurations.map((p) => (
                  <button
                    key={p.sec}
                    type="button"
                    onClick={() => setDuration(p.sec)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      duration === p.sec
                        ? "bg-blue-50 text-[#214ECF] border-blue-200 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Reference & Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Customer Reference / Case ID
              </label>
              <input
                type="text"
                placeholder="e.g. PT-94821 or REF-010"
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#214ECF] transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Outcome / Disposition
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF] transition-all cursor-pointer"
              >
                <option value="Resolved">Resolved</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Escalated">Escalated</option>
                <option value="Callback Requested">Callback Requested</option>
                <option value="No Response">No Response</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Follow-up Required Checkbox */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                checked={followupRequired}
                onChange={(e) => setFollowupRequired(e.target.checked)}
                className="w-4 h-4 rounded text-[#214ECF] focus:ring-[#214ECF] cursor-pointer"
              />
              <span>Follow-up action required for this caller</span>
            </label>

            {followupRequired && (
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Scheduled Follow-up Date
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                />
              </div>
            )}
          </div>

          {/* Call Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Call Notes & Operational Summary
            </label>
            <textarea
              rows={3}
              placeholder="Enter brief notes regarding patient inquiry, verified items, or next steps..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#214ECF] transition-all"
            />
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Do not enter sensitive financial or card data in notes.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving Call Activity..." : "Save Call Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
