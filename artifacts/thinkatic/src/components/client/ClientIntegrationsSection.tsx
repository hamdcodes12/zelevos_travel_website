import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cable,
  PhoneCall,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Volume2,
  Plus,
  ShieldCheck,
  Search,
  Filter,
  Lock,
  ExternalLink,
  ChevronRight,
  Clock,
  User,
  Building2,
  FileText,
  Activity,
  XCircle,
  PauseCircle,
  Key,
  X,
  Sliders,
  Send,
  Sparkles,
} from "lucide-react";
import IntegrationConnectionModal from "../integrations/IntegrationConnectionModal";

interface Props {
  clientApi: (endpoint: string, options?: RequestInit) => Promise<Response>;
  userRole?: "client_admin" | "client_manager" | "client_viewer";
}

export default function ClientIntegrationsSection({ clientApi, userRole }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"connections" | "leads" | "calls" | "history">("connections");
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [syncJobs, setSyncJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals & Drawers
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any | null>(null);
  const [selectedProviderForConnect, setSelectedProviderForConnect] = useState<any | null>(null);
  const [recordingPlayer, setRecordingPlayer] = useState<{ callId: number; url: string; expiresAt: string } | null>(null);

  // Filters & Search
  const [leadSearch, setLeadSearch] = useState("");
  const [callFilter, setCallFilter] = useState({ status: "all", disposition: "all" });

  const getAuthToken = () => localStorage.getItem("user_token") || "";

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = getAuthToken();
      const normalizedPath = path.startsWith("/api") ? path : `/api${path}`;
      return fetch(normalizedPath, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
    },
    []
  );

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [provRes, intRes, leadRes, callRes, jobRes] = await Promise.all([
        apiFetch("/integrations/providers"),
        apiFetch("/integrations"),
        apiFetch("/integrations/crm/leads"),
        apiFetch("/integrations/dialer/calls"),
        apiFetch("/integrations/jobs"),
      ]);

      if (provRes.ok) {
        const d = await provRes.json();
        setProviders(d.providers || []);
      }
      if (intRes.ok) {
        const d = await intRes.json();
        setIntegrations(d.integrations || []);
      }
      if (leadRes.ok) {
        const d = await leadRes.json();
        setLeads(d.leads || []);
      }
      if (callRes.ok) {
        const d = await callRes.json();
        setCalls(d.calls || []);
      }
      if (jobRes.ok) {
        const d = await jobRes.json();
        setSyncJobs(d.jobs || []);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to load telemetry integrations." });
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Testing Integration Connection
  const handleTestConnection = async (id: number) => {
    setActionLoading(`test-${id}`);
    setFeedback(null);
    try {
      const res = await apiFetch(`/integrations/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          message: `Connection successful: ${data.message} (Latency: ${data.latency_ms || 0}ms)`,
        });
        loadAllData();
      } else {
        setFeedback({
          type: "error",
          message: data.message || data.error || "Integration connection test failed.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Connection test failed." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Manual CRM Sync
  const handleTriggerSync = async (id: number) => {
    setActionLoading(`sync-${id}`);
    setFeedback(null);
    try {
      const res = await apiFetch(`/integrations/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          message: `Sync completed: ${data.records_fetched || 0} fetched, ${data.records_created || 0} created, ${data.records_updated || 0} updated.`,
        });
        loadAllData();
      } else {
        setFeedback({
          type: "error",
          message: data.message || data.error || "Sync execution failed.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Sync execution failed." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Requesting Authorized Playback URL
  const handlePlayRecording = async (callId: number) => {
    setActionLoading(`audio-${callId}`);
    try {
      const res = await apiFetch(`/integrations/dialer/calls/${callId}/recording-url`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success && data.recording_url) {
        setRecordingPlayer({
          callId,
          url: data.recording_url,
          expiresAt: data.expires_at,
        });
      } else {
        alert(data.message || data.error || "Recording playback URL authorization failed.");
      }
    } catch (err: any) {
      alert(err.message || "Could not retrieve call recording.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered leads
  const filteredLeads = leads.filter((l) => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return (
      l.lead_external_id?.toLowerCase().includes(q) ||
      l.status?.toLowerCase().includes(q) ||
      l.source_system?.toLowerCase().includes(q) ||
      JSON.stringify(l.enriched_data || {}).toLowerCase().includes(q)
    );
  });

  // Filtered calls
  const filteredCalls = calls.filter((c) => {
    if (callFilter.status !== "all" && c.status !== callFilter.status) return false;
    if (callFilter.disposition !== "all" && c.disposition !== callFilter.disposition) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header & Telemetry Overview ────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cable className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white">Client Integrations & Telemetry Layer</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Secure bidirectional synchronization between client CRM systems, BPO dialer feeds, and Thinkatic operational analytics.
            All credentials stored with AES-256-GCM authenticated encryption.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAllData()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            Refresh Telemetry
          </button>

          {userRole !== "client_viewer" && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Connect Integration
            </button>
          )}
        </div>
      </div>

      {/* ── Feedback Message Banner ─────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-xs font-medium border ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Sub-navigation Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("connections")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "connections"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Connected Systems ({integrations.length})
        </button>

        <button
          onClick={() => setActiveSubTab("leads")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "leads"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Synced CRM Leads ({leads.length})
        </button>

        <button
          onClick={() => setActiveSubTab("calls")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "calls"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          Telephony Activities ({calls.length})
        </button>

        <button
          onClick={() => setActiveSubTab("history")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "history"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Sync Execution History ({syncJobs.length})
        </button>
      </div>

      {/* ── TAB 1: CONNECTED SYSTEMS ─────────────────────────────────── */}
      {activeSubTab === "connections" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((item) => {
              const lifecycleStatus = item.lifecycle_status || (item.status === "active" && !item.configuration_required ? "CONNECTED" : "NOT_CONNECTED");
              const isConnected = lifecycleStatus === "CONNECTED";
              const isDialer = item.provider_type === "DIALER";

              return (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-slate-800 text-blue-400 font-mono text-xs font-bold uppercase">
                          {item.provider_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 uppercase">
                          {item.provider_type}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                          lifecycleStatus === "CONNECTED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : lifecycleStatus === "CONNECTING"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                            : lifecycleStatus === "AUTH_EXPIRED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : lifecycleStatus === "ERROR"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : lifecycleStatus === "DISCONNECTED"
                            ? "bg-slate-800 text-slate-400 border-slate-700"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        }`}
                      >
                        {lifecycleStatus === "CONNECTED" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {lifecycleStatus === "AUTH_EXPIRED" && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                        {lifecycleStatus === "ERROR" && <XCircle className="w-3 h-3 text-red-400" />}
                        {lifecycleStatus === "CONNECTING" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        {lifecycleStatus === "DISCONNECTED" && <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                        {lifecycleStatus === "NOT_CONNECTED" && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                        {lifecycleStatus}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mt-3">{item.display_name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description || "No description provided."}</p>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Lifecycle Status:</span>
                        <span className={`font-semibold ${isConnected ? "text-emerald-400" : lifecycleStatus === "CONNECTING" ? "text-amber-400" : "text-rose-400"}`}>
                          {lifecycleStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Health Status:</span>
                        <span
                          className={`capitalize font-semibold ${
                            item.health_status === "healthy"
                              ? "text-emerald-400"
                              : item.health_status === "degraded"
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          ● {item.health_status?.toUpperCase() || "UNKNOWN"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Security:</span>
                        <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> AES-256-GCM
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Masked Credential:</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {item.credentials?.key_masked || "••••••••"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Last Successful Sync:</span>
                        <span className="text-slate-300">
                          {item.last_successful_sync_at
                            ? new Date(item.last_successful_sync_at).toLocaleTimeString()
                            : item.last_synced_at
                            ? new Date(item.last_synced_at).toLocaleTimeString()
                            : "Never"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Records Synced:</span>
                        <span className="font-mono text-slate-300">
                          {item.records_synced !== undefined ? item.records_synced : (isDialer ? calls.length : leads.length)}
                        </span>
                      </div>

                      {item.last_connection_test_at && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Last Connection Test:</span>
                          <span className={item.last_connection_test_result === "SUCCESS" ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                            {item.last_connection_test_result} ({new Date(item.last_connection_test_at).toLocaleTimeString()})
                          </span>
                        </div>
                      )}

                      {item.last_error && (
                        <div className="text-rose-400 text-[10px] pt-1 truncate bg-rose-950/20 px-2 py-1 rounded border border-rose-900/30" title={item.last_error}>
                          ⚠ {item.last_error}
                        </div>
                      )}

                      {item.configuration_required && (
                        <div className="text-amber-400 text-[10px] pt-1 flex items-center gap-1 bg-amber-950/20 px-2 py-1 rounded border border-amber-900/30">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Configuration Required before synchronization can run.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(item.id)}
                      disabled={actionLoading === `test-${item.id}`}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      title="Test Connection"
                    >
                      <RefreshCw className={`w-3 h-3 ${actionLoading === `test-${item.id}` ? "animate-spin text-blue-400" : ""}`} />
                      Test Ping
                    </button>

                    {item.provider_type === "CRM" && userRole !== "client_viewer" && (
                      <button
                        onClick={() => handleTriggerSync(item.id)}
                        disabled={!isConnected || actionLoading === `sync-${item.id}`}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-colors ${
                          isConnected
                            ? "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30 cursor-pointer"
                            : "bg-slate-800/60 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-60"
                        }`}
                        title={
                          isConnected
                            ? "Trigger Immediate Sync"
                            : "Sync unavailable: Connection required. Please configure and test credentials first."
                        }
                      >
                        <RefreshCw className={`w-3 h-3 ${actionLoading === `sync-${item.id}` ? "animate-spin text-blue-400" : ""}`} />
                        Sync CRM
                      </button>
                    )}

                    {userRole !== "client_viewer" && (
                      <button
                        onClick={() => {
                          setSelectedIntegration(item);
                          setSelectedProviderForConnect(
                            providers.find((p) => p.providerName === item.provider_name) || {
                              providerName: item.provider_name,
                              displayName: item.display_name,
                              providerType: item.provider_type,
                            }
                          );
                          setShowConfigModal(true);
                        }}
                        className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                        title="Configure Credentials & Settings"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {integrations.length === 0 && !loading && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <Cable className="w-12 h-12 mx-auto text-slate-600" />
              <h3 className="text-base font-bold text-slate-200">No Integrations Configured</h3>
              <p className="text-xs max-w-md mx-auto text-slate-400">
                Connect your CRM (Salesforce, HubSpot, Zoho, or Generic REST) or Telephony dialer to allow real-time lead and call telemetry to flow securely into Thinkatic.
              </p>
              {userRole !== "client_viewer" && (
                <button
                  onClick={() => {
                    setSelectedIntegration(null);
                    setSelectedProviderForConnect(providers[0] || null);
                    setShowConfigModal(true);
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Connect Your First CRM / Dialer
                </button>
              )}
            </div>
          )}

          {/* Available Integration Providers */}
          {providers.length > 0 && userRole !== "client_viewer" && (
            <div className="pt-6 border-t border-slate-800/80">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cable className="w-4 h-4 text-blue-400" />
                  Available Integration Gateways ({providers.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select an enterprise CRM or dialer provider to configure a new operational connection.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {providers.map((prov) => {
                  const alreadyConfigured = integrations.some(
                    (i) => i.provider_name === prov.providerName
                  );
                  const isDialer = prov.providerType === "DIALER";

                  return (
                    <div
                      key={prov.providerName}
                      className="bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span
                            className={`p-1.5 rounded-lg text-xs font-mono font-bold uppercase ${
                              isDialer
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {prov.providerType}
                          </span>
                          {alreadyConfigured && (
                            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Configured
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white">{prov.displayName}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {prov.description}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedIntegration(null);
                          setSelectedProviderForConnect(prov);
                          setShowConfigModal(true);
                        }}
                        className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {alreadyConfigured ? "Add Another" : `Connect ${prov.displayName}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: SYNCED CRM LEADS ──────────────────────────────────── */}
      {activeSubTab === "leads" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search leads by ID, status..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="font-bold text-white">{filteredLeads.length}</span> synchronized leads
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Lead External ID</th>
                    <th className="p-3.5">Source System</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Enriched Metadata</th>
                    <th className="p-3.5">Last Synchronized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono text-blue-400 font-medium">{lead.lead_external_id}</td>
                      <td className="p-3.5 capitalize font-semibold text-slate-200">{lead.source_system}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                          {lead.status || "NEW"}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                        {JSON.stringify(lead.enriched_data || {})}
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(lead.last_synced_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No synced CRM leads found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: TELEPHONY ACTIVITIES ──────────────────────────────── */}
      {activeSubTab === "calls" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Filter Disposition:</span>
                <select
                  value={callFilter.disposition}
                  onChange={(e) => setCallFilter({ ...callFilter, disposition: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Dispositions</option>
                  <option value="ANSWERED">ANSWERED</option>
                  <option value="VOICEMAIL">VOICEMAIL</option>
                  <option value="BUSY">BUSY</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Total Ingested Calls: <span className="font-bold text-white">{filteredCalls.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Call Session SID</th>
                    <th className="p-3.5">Direction</th>
                    <th className="p-3.5">Agent / Staff</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5">Disposition</th>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5 text-right">Audit & Audio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono text-emerald-400 font-medium">{call.call_sid}</td>
                      <td className="p-3.5 uppercase font-bold text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            call.direction === "inbound"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {call.direction}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{call.agent_id || "IVR/Bot"}</td>
                      <td className="p-3.5 font-mono text-slate-200">{call.duration_seconds}s</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            call.disposition === "ANSWERED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {call.disposition}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(call.start_time).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        {call.has_recording ? (
                          <button
                            onClick={() => handlePlayRecording(call.id)}
                            disabled={actionLoading === `audio-${call.id}`}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Volume2 className="w-3 h-3" />
                            {actionLoading === `audio-${call.id}` ? "Authorizing..." : "Playback"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">No recording</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCalls.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No call activity records found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audio Player Drawer / Modal if authorized */}
          {recordingPlayer && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Volume2 className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    Authorized Recording Playback (Call #{recordingPlayer.callId})
                    <span className="text-[10px] text-emerald-400 font-mono">Token valid 15 mins</span>
                  </div>
                  <audio controls className="mt-2 h-8 max-w-md" src={recordingPlayer.url}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              </div>
              <button
                onClick={() => setRecordingPlayer(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SYNC EXECUTION HISTORY ───────────────────────────── */}
      {activeSubTab === "history" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Job ID</th>
                    <th className="p-3.5">Trigger Mode</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Fetched / Created / Updated</th>
                    <th className="p-3.5">Error Message</th>
                    <th className="p-3.5">Execution Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {syncJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono text-blue-400">#{job.id}</td>
                      <td className="p-3.5 uppercase font-bold text-[10px]">{job.trigger_mode}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : job.status === "running"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-200">
                        {job.records_fetched || 0} / {job.records_created || 0} / {job.records_updated || 0}
                      </td>
                      <td className="p-3.5 text-rose-400 text-[11px] max-w-xs truncate">
                        {job.error_message || "—"}
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(job.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {syncJobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No synchronization jobs executed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Integration Connection & Configuration Modal ────────── */}
      <IntegrationConnectionModal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setSelectedIntegration(null);
          setSelectedProviderForConnect(null);
        }}
        provider={
          selectedProviderForConnect ||
          (selectedIntegration
            ? {
                providerName: selectedIntegration.provider_name,
                displayName: selectedIntegration.display_name,
                providerType: selectedIntegration.provider_type,
              }
            : null) ||
          providers[0] || {
            providerName: "salesforce",
            displayName: "Salesforce CRM",
            providerType: "CRM",
          }
        }
        existingIntegration={selectedIntegration}
        onSaveSuccess={(updated) => {
          setFeedback({
            type: "success",
            message: `Integration "${updated.display_name || updated.provider_name}" configuration saved and secured with AES-256-GCM.`,
          });
          loadAllData();
        }}
        apiFetch={apiFetch}
      />
    </div>
  );
}
