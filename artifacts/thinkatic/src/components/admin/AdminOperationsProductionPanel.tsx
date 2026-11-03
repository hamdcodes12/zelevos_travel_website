import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  PhoneCall,
  MessageSquare,
  Mail,
  Ticket,
  Briefcase,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  Zap,
} from "lucide-react";

interface Props {
  adminApi: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminOperationsProductionPanel({ adminApi }: Props) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProcess, setSelectedProcess] = useState("all");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  async function loadData() {
    setLoading(true);
    try {
      let url = `/admin/bpo/production?from=${dateRange.from}&to=${dateRange.to}`;
      if (selectedProcess !== "all") url += `&process_type=${selectedProcess}`;
      const res = await adminApi(url);
      if (res.ok) {
        const d = await res.json();
        setRecords(d.records || []);
      }
    } catch (err) {
      console.error("Failed to load admin production logs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [dateRange, selectedProcess]);

  const totalUnits = records.reduce((acc, r) => {
    const m = r.metrics || {};
    const units =
      Number(m.calls_handled) ||
      Number(m.chats_handled) ||
      Number(m.emails_resolved) ||
      Number(m.tickets_resolved) ||
      Number(m.transactions_processed) ||
      0;
    return acc + units;
  }, 0);

  const totalProductiveHours = records.reduce((acc, r) => acc + (Number(r.productive_hours) || 0), 0);
  const avgProductivityRate =
    totalProductiveHours > 0 ? (totalUnits / totalProductiveHours).toFixed(1) : "0.0";

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      (r.agent_name?.toLowerCase() || "").includes(q) ||
      (r.project_name?.toLowerCase() || "").includes(q) ||
      (r.partner_name?.toLowerCase() || "").includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Network Output</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalUnits.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 font-medium">Logged units delivered</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Productive Hours Logged</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalProductiveHours.toFixed(1)}h</p>
          <span className="text-[11px] text-slate-500 font-medium">Floor operational time</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mean Productivity Rate</span>
          <p className="mt-2 text-2xl font-black text-emerald-700">{avgProductivityRate} <span className="text-xs font-bold text-slate-400">u/hr</span></p>
          <span className="text-[11px] text-slate-500 font-medium">Authoritatively calculated</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Logs Audited</span>
          <p className="mt-2 text-2xl font-black text-slate-900">{records.length}</p>
          <span className="text-[11px] text-slate-500 font-medium">Across all campaigns</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 bg-slate-50 text-xs">
              <span className="text-slate-400 font-bold">Window:</span>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="bg-transparent font-medium outline-none text-slate-700"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="bg-transparent font-medium outline-none text-slate-700"
              />
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search agent, campaign, or partner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-primary"
            >
              <option value="all">All Channels</option>
              <option value="voice">Voice</option>
              <option value="chat">Live Chat</option>
              <option value="email">Email</option>
              <option value="ticket">Tickets</option>
              <option value="back_office">Back Office</option>
            </select>

            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-2">Agent & Partner</th>
                  <th className="pb-3">Campaign Project</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Production Volume</th>
                  <th className="pb-3">Logged Floor Time</th>
                  <th className="pb-3">Rate (Units/Hr)</th>
                  <th className="pb-3 text-right pr-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const m = r.metrics || {};
                  const units =
                    m.calls_handled ??
                    m.chats_handled ??
                    m.emails_resolved ??
                    m.tickets_resolved ??
                    m.transactions_processed ??
                    0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-medium">
                        <div className="font-bold text-slate-900">{r.agent_name || `Agent #${r.agent_id}`}</div>
                        <div className="text-[11px] text-slate-400">{r.partner_name || "Delivery Partner"}</div>
                      </td>
                      <td className="py-3.5 font-medium text-slate-800">{r.project_name || `Project #${r.project_id}`}</td>
                      <td className="py-3.5">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold capitalize text-slate-700">
                          {r.process_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className="font-black text-slate-900 text-sm">{units}</span>{" "}
                        <span className="text-[11px] text-slate-400">units</span>
                      </td>
                      <td className="py-3.5 font-mono text-slate-700">{r.productive_hours} hrs</td>
                      <td className="py-3.5 font-mono font-bold text-emerald-700">
                        {r.productivity_rate ? `${r.productivity_rate}/hr` : "—"}
                      </td>
                      <td className="py-3.5 text-right pr-2 font-mono text-[11px] text-slate-500">
                        {r.production_date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No production logs recorded in this period.
          </div>
        )}
      </div>
    </div>
  );
}
