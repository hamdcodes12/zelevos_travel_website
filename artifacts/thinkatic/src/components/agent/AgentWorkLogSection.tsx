import React, { useState, useMemo } from "react";
import {
  PhoneCall,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  User,
  Tag,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
} from "lucide-react";

interface AgentWorkLogSectionProps {
  calls: any[];
  onOpenCallLog: () => void;
  projects?: any[];
}

export const AgentWorkLogSection: React.FC<AgentWorkLogSectionProps> = ({
  calls,
  onOpenCallLog,
  projects = [],
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedCall, setSelectedCall] = useState<any | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      if (typeFilter !== "all" && c.call_direction !== typeFilter) return false;
      if (outcomeFilter !== "all" && c.outcome?.toLowerCase() !== outcomeFilter.toLowerCase()) return false;
      if (dateFilter && !c.start_time?.startsWith(dateFilter)) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const codeMatch = c.call_code?.toLowerCase().includes(lower);
        const refMatch = c.customer_reference?.toLowerCase().includes(lower);
        const notesMatch = c.notes?.toLowerCase().includes(lower);
        if (!codeMatch && !refMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [calls, typeFilter, outcomeFilter, dateFilter, searchTerm]);

  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage) || 1;
  const paginatedCalls = filteredCalls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <PhoneCall className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Work & Manual Telephony Logs
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Work / Call Log History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Operational call activity recorded manually after customer interactions. Synchronized with BPO and client reporting.
          </p>
        </div>

        <button
          onClick={onOpenCallLog}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Log Work / Call</span>
        </button>
      </div>

      {/* ── FILTER & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Call ID, Customer Ref, Notes..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF] transition-all"
            />
          </div>

          {/* Direction Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF] transition-all cursor-pointer"
            >
              <option value="all">All Directions (Inbound & Outbound)</option>
              <option value="inbound">Inbound Calls Only</option>
              <option value="outbound">Outbound Calls Only</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div>
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF] transition-all cursor-pointer"
            >
              <option value="all">All Outcomes / Dispositions</option>
              <option value="Resolved">Resolved</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Escalated">Escalated</option>
              <option value="Callback Requested">Callback Requested</option>
              <option value="No Response">No Response</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF] transition-all cursor-pointer"
            />
          </div>
        </div>

        {(searchTerm || typeFilter !== "all" || outcomeFilter !== "all" || dateFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredCalls.length} of {calls.length} total call records
            </span>
            <button
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("all");
                setOutcomeFilter("all");
                setDateFilter("");
                setCurrentPage(1);
              }}
              className="text-[#214ECF] font-bold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── CALL LOG DATA TABLE ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {paginatedCalls.length === 0 ? (
          <div className="py-16 text-center">
            <PhoneCall className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">No Call Records Found</div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No manual call logs match your current filter settings. Click "Log Work / Call" to create a new record.
            </p>
            <button
              onClick={onOpenCallLog}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-[#1a3fa8] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Work / Call
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Call ID</th>
                  <th className="py-3.5 px-4">Direction</th>
                  <th className="py-3.5 px-4">Customer Ref</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Outcome</th>
                  <th className="py-3.5 px-4">Follow-up</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCalls.map((call) => (
                  <tr
                    key={call.id || call.call_code}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => setSelectedCall(call)}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {call.call_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                          call.call_direction === "outbound"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-blue-50 text-[#214ECF] border-blue-200"
                        }`}
                      >
                        {call.call_direction}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {call.customer_reference || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {call.start_time
                        ? new Date(call.start_time).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          call.outcome === "Resolved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : call.outcome === "Escalated"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {call.outcome}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {call.next_followup_date || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate" title={call.notes}>
                      {call.notes || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                        }}
                        className="text-[#214ECF] hover:text-[#1a3fa8] font-bold p-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredCalls.length} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CALL DETAILS MODAL ──────────────────────────────────────────── */}
      {selectedCall && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Call Record Details</h3>
                  <div className="font-mono text-xs text-[#214ECF]">{selectedCall.call_code}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Direction</span>
                <span className="font-bold text-slate-900 capitalize">{selectedCall.call_direction}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Outcome</span>
                <span className="font-bold text-slate-900">{selectedCall.outcome}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Customer Reference</span>
                <span className="font-bold text-slate-900">{selectedCall.customer_reference || "—"}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Duration</span>
                <span className="font-mono font-bold text-slate-900">
                  {Math.floor(selectedCall.duration_seconds / 60)}m {selectedCall.duration_seconds % 60}s
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Call Timestamp</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedCall.start_time
                    ? new Date(selectedCall.start_time).toLocaleString()
                    : "—"}
                </span>
              </div>
              {selectedCall.next_followup_date && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 col-span-2 text-amber-900">
                  <span className="uppercase font-semibold text-[10px] block">Scheduled Follow-up Date</span>
                  <span className="font-mono font-bold">{selectedCall.next_followup_date}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">Call Notes & Summary</span>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedCall.notes || "No additional notes provided."}
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedCall(null)}
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
