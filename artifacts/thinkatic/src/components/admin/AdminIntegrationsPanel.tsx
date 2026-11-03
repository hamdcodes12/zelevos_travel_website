import React, { useState, useEffect } from "react";
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
  Layers,
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
  Sliders,
  Sparkles,
} from "lucide-react";
import IntegrationConnectionModal from "../integrations/IntegrationConnectionModal";

interface Props {
  adminToken: string;
}

export default function AdminIntegrationsPanel({ adminToken }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"catalog" | "calls" | "leads" | "syncJobs">("catalog");
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [syncJobs, setSyncJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters
  const [callFilter, setCallFilter] = useState({ status: "all", disposition: "all" });
  const [leadFilter, setLeadFilter] = useState({ status: "all", search: "" });

  // Modals
  const [connectModalProvider, setConnectModalProvider] = useState<any | null>(null);
  const [selectedIntegrationForModal, setSelectedIntegrationForModal] = useState<any | null>(null);
  const [activeRecordingModal, setActiveRecordingModal] = useState<{ call: any; url: string } | null>(null);

  async function apiCall(path: string, options: RequestInit = {}) {
    const token = adminToken || localStorage.getItem("admin_token") || "";
    const normalizedPath = path.startsWith("/api") ? path : `/api${path}`;
    return fetch(normalizedPath, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  }

  async function loadData() {
    setLoading(true);
    try {
      const [provRes, intRes, callsRes, leadsRes, syncRes] = await Promise.all([
        apiCall("/api/integrations/providers"),
        apiCall("/api/integrations"),
        apiCall("/api/integrations/dialer/calls?limit=50"),
        apiCall("/api/integrations/crm/leads?limit=50"),
        apiCall("/api/integrations/sync-jobs"),
      ]);

      if (provRes.ok) {
        const d = await provRes.json();
        setProviders(d.providers || []);
      }
      if (intRes.ok) {
        const d = await intRes.json();
        setIntegrations(d.integrations || []);
      }
      if (callsRes.ok) {
        const d = await callsRes.json();
        setCalls(d.calls || []);
      }
      if (leadsRes.ok) {
        const d = await leadsRes.json();
        setLeads(d.leads || []);
      }
      if (syncRes.ok) {
        const d = await syncRes.json();
        setSyncJobs(d.jobs || []);
      }
    } catch (err) {
      console.error("Failed to load integration data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleTestConnection(intId: number) {
    setActionLoading(`test-${intId}`);
    setFeedback(null);
    try {
      const res = await apiCall(`/api/integrations/${intId}/test`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data.message || data.error });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: `Connection test failed: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTriggerSync(intId: number) {
    setActionLoading(`sync-${intId}`);
    setFeedback(null);
    try {
      const res = await apiCall(`/api/integrations/${intId}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data.error || data.message });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: `Sync failed: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisconnect(intId: number) {
    if (!window.confirm("Are you sure you want to disconnect this integration?")) return;
    setActionLoading(`disc-${intId}`);
    try {
      const res = await apiCall(`/api/integrations/${intId}/disconnect`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data.error || data.message });
      }
      await loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReconnect(intId: number) {
    setActionLoading(`reconnect-${intId}`);
    setFeedback(null);
    try {
      const res = await apiCall(`/api/integrations/${intId}/reconnect`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data.error || data.message });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: `Reconnect failed: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefreshToken(intId: number) {
    setActionLoading(`refresh-token-${intId}`);
    setFeedback(null);
    try {
      const res = await apiCall(`/api/integrations/${intId}/oauth/refresh`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data.error || data.message });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: `Token refresh failed: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePlaybackRecording(call: any) {
    try {
      const res = await apiCall(`/api/integrations/dialer/calls/${call.id}/recording-url`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.recording_url) {
        setActiveRecordingModal({ call, url: data.recording_url });
      } else {
        alert(data.error || "Unable to retrieve recording playback token.");
      }
    } catch (err) {
      alert("Playback request failed");
    }
  }
  const connectedCount = integrations.filter((i) => i.status === "active").length;

  return (
    <div className="space-y-6">
      {/* ── Top Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Phase 8 Operational Gateway
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Zero-Trust AES-256-GCM
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cable className="w-5 h-5 text-blue-400" />
            Enterprise Integrations & Telephony Hub
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Connect external client CRM systems and BPO telephony clusters into Thinkatic. Ingested operational data
            acts as transparent reporting and QA evidence without altering authoritative human decisions.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* ── Feedback Banner ───────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* ── Quick KPI Stat Cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Connected Integrations</span>
            <Cable className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{connectedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {integrations.length} total registered gateways
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Ingested Call Logs</span>
            <PhoneCall className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{calls.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-blue-400" /> Deduplicated & idempotency-protected
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Synced CRM Leads</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{leads.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" /> Bidirectional external ID mapped
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Telephony Health</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            100% Operational
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Zero automated billing mutations</div>
        </div>
      </div>

      {/* ── Sub-Tab Navigation Bar ─────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab("catalog")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeSubTab === "catalog"
              ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Integration Catalog ({integrations.length})
        </button>

        <button
          onClick={() => setActiveSubTab("calls")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeSubTab === "calls"
              ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          Telephony Activities ({calls.length})
        </button>

        <button
          onClick={() => setActiveSubTab("leads")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeSubTab === "leads"
              ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          CRM Leads & Contacts ({leads.length})
        </button>

        <button
          onClick={() => setActiveSubTab("syncJobs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeSubTab === "syncJobs"
              ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Sync History ({syncJobs.length})
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          SUB-TAB 1: INTEGRATION CATALOG & CARDS
          ════════════════════════════════════════════════════════════ */}
      {activeSubTab === "catalog" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((prov) => {
              const connected = integrations.find((i) => i.provider_name === prov.providerName);
              const isDialer = prov.providerType === "DIALER";
              const lifecycleStatus = connected
                ? (connected.lifecycle_status || (connected.status === "active" && !connected.configuration_required ? "CONNECTED" : "NOT_CONNECTED"))
                : "NOT_CONNECTED";
              const isConnected = lifecycleStatus === "CONNECTED";

              return (
                <div
                  key={prov.providerName}
                  className={`bg-slate-900/70 border rounded-2xl p-5 flex flex-col justify-between transition ${
                    connected
                      ? "border-blue-500/30 shadow-lg shadow-blue-500/5"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            isDialer
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          }`}
                        >
                          {isDialer ? <PhoneCall className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white">{prov.displayName}</h3>
                          <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                            {prov.providerType}
                          </span>
                        </div>
                      </div>

                      {connected ? (
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
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          NOT_CONNECTED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mb-4 min-h-[36px]">{prov.description}</p>

                    {connected && (
                      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 mb-4 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Health Status:</span>
                          <span
                            className={`font-semibold ${
                              connected.health_status === "healthy"
                                ? "text-emerald-400"
                                : connected.health_status === "degraded"
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            ● {connected.health_status?.toUpperCase() || "UNKNOWN"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Masked Key:</span>
                          <span className="font-mono text-slate-300">
                            {connected.credentials?.key_masked || "••••••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Last Successful Sync:</span>
                          <span className="text-slate-300">
                            {connected.last_successful_sync_at
                              ? new Date(connected.last_successful_sync_at).toLocaleTimeString()
                              : connected.last_synced_at
                              ? new Date(connected.last_synced_at).toLocaleTimeString()
                              : "Never"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Records Synced:</span>
                          <span className="font-mono text-slate-300">
                            {connected.records_synced !== undefined ? connected.records_synced : (isDialer ? calls.length : leads.length)}
                          </span>
                        </div>
                        {connected.last_connection_test_at && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Last Connection Test:</span>
                            <span className={connected.last_connection_test_result === "SUCCESS" ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                              {connected.last_connection_test_result} ({new Date(connected.last_connection_test_at).toLocaleTimeString()})
                            </span>
                          </div>
                        )}
                        {connected.last_error && (
                          <div className="text-rose-400 text-[10px] pt-1 truncate bg-rose-950/20 px-2 py-1 rounded border border-rose-900/30" title={connected.last_error}>
                            ⚠ {connected.last_error}
                          </div>
                        )}
                        {connected.configuration_required && (
                          <div className="text-amber-400 text-[10px] pt-1 flex items-center gap-1 bg-amber-950/20 px-2 py-1 rounded border border-amber-900/30">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Configuration Required</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                    {connected ? (
                      <>
                        <button
                          onClick={() => handleTestConnection(connected.id)}
                          disabled={actionLoading === `test-${connected.id}`}
                          className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                          title="Test Connection"
                        >
                          {actionLoading === `test-${connected.id}` ? "Testing..." : "Test Connection"}
                        </button>
                        <button
                          onClick={() => handleTriggerSync(connected.id)}
                          disabled={!isConnected || actionLoading === `sync-${connected.id}`}
                          className={`py-1.5 px-3 text-xs font-medium rounded-lg border transition flex items-center gap-1 ${
                            isConnected
                              ? "bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-blue-500/20 cursor-pointer"
                              : "bg-slate-800/60 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-60"
                          }`}
                          title={
                            isConnected
                              ? "Trigger Immediate Sync"
                              : "Sync unavailable: Connection required. Please configure and test credentials first."
                          }
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${actionLoading === `sync-${connected.id}` ? "animate-spin" : ""}`}
                          />
                          Sync Now
                        </button>
                        <button
                          onClick={() => {
                            setConnectModalProvider(prov);
                            setSelectedIntegrationForModal(connected);
                          }}
                          className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                          title="Configure Credentials"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        {connected.auth_type === "oauth2" && (lifecycleStatus === "AUTH_EXPIRED" || lifecycleStatus === "ERROR") && (
                          <button
                            onClick={() => handleRefreshToken(connected.id)}
                            disabled={actionLoading === `refresh-token-${connected.id}`}
                            className="py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs rounded-lg border border-indigo-500/30 transition cursor-pointer"
                            title="Refresh OAuth Token"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(connected.id)}
                          className="py-1.5 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg border border-red-500/20 transition cursor-pointer"
                          title="Disconnect Integration"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setConnectModalProvider(prov);
                          setSelectedIntegrationForModal(null);
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Connect {prov.displayName}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SUB-TAB 2: TELEPHONY & CALL ACTIVITIES
          ════════════════════════════════════════════════════════════ */}
      {activeSubTab === "calls" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Call Activity Ledger</h3>
              <span className="text-xs text-slate-500">({calls.length} events logged)</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={callFilter.status}
                onChange={(e) => setCallFilter({ ...callFilter, status: e.target.value })}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
                <option value="busy">Busy</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Call ID</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Disposition</th>
                  <th className="py-3 px-4 text-right">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {calls
                  .filter((c) => callFilter.status === "all" || c.call_status.toLowerCase() === callFilter.status)
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-medium text-white">{c.call_code}</td>
                      <td className="py-3 px-4 uppercase text-[11px] font-mono text-slate-400">{c.provider}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.call_direction === "outbound"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          }`}
                        >
                          {c.call_direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(c.start_time).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.call_status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}
                        >
                          {c.call_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {c.disposition || "NONE"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.recording_reference ? (
                          <button
                            onClick={() => handlePlaybackRecording(c)}
                            className="p-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/20 transition inline-flex items-center gap-1 text-[11px]"
                            title="Play Recording (Signed Token)"
                          >
                            <Volume2 className="w-3.5 h-3.5" /> Play
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                {calls.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      No telephony call records ingested yet. Trigger a dialer sync or post a webhook event.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SUB-TAB 3: CRM LEADS & CONTACTS
          ════════════════════════════════════════════════════════════ */}
      {activeSubTab === "leads" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-sm text-white">Synced CRM Leads & Contacts</h3>
              <span className="text-xs text-slate-500">({leads.length} records)</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, company, email..."
                  value={leadFilter.search}
                  onChange={(e) => setLeadFilter({ ...leadFilter, search: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Lead Code</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">External ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Disposition</th>
                  <th className="py-3 px-4">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads
                  .filter((l) => {
                    if (!leadFilter.search) return true;
                    const q = leadFilter.search.toLowerCase();
                    return (
                      l.first_name.toLowerCase().includes(q) ||
                      l.last_name.toLowerCase().includes(q) ||
                      (l.email && l.email.toLowerCase().includes(q)) ||
                      (l.company && l.company.toLowerCase().includes(q))
                    );
                  })
                  .map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-medium text-white">{l.lead_code}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {l.first_name} {l.last_name}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{l.company || "—"}</td>
                      <td className="py-3 px-4 text-slate-400">
                        <div>{l.email || "No email"}</div>
                        {l.phone && <div className="text-[10px] text-slate-500 font-mono">{l.phone}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{l.external_lead_id}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            l.status === "converted" || l.status === "qualified"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : l.status === "contacted"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{l.disposition || "None"}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(l.last_synced_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}

                {leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      No CRM lead records synchronized yet. Trigger a CRM sync job to import leads.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SUB-TAB 4: SYNC JOBS & AUDIT
          ════════════════════════════════════════════════════════════ */}
      {activeSubTab === "syncJobs" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm text-white">Synchronization Execution Log</h3>
              <span className="text-xs text-slate-500">({syncJobs.length} runs recorded)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Job Code</th>
                  <th className="py-3 px-4">Sync Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Processed</th>
                  <th className="py-3 px-4">Succeeded</th>
                  <th className="py-3 px-4">Failed</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {syncJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-medium text-white">{j.job_code}</td>
                    <td className="py-3 px-4 uppercase text-[11px] font-mono text-slate-400">{j.sync_type}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          j.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : j.status === "failed"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {j.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{j.records_processed}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400">{j.records_succeeded}</td>
                    <td className="py-3 px-4 font-mono text-red-400">{j.records_failed}</td>
                    <td className="py-3 px-4 text-slate-400">{new Date(j.started_at).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {j.completed_at ? new Date(j.completed_at).toLocaleTimeString() : "In progress"}
                    </td>
                  </tr>
                ))}

                {syncJobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      No synchronization jobs logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Integration Connection & Configuration Modal ────────── */}
      <IntegrationConnectionModal
        isOpen={!!connectModalProvider}
        onClose={() => {
          setConnectModalProvider(null);
          setSelectedIntegrationForModal(null);
        }}
        provider={connectModalProvider}
        existingIntegration={selectedIntegrationForModal}
        onSaveSuccess={(updated) => {
          setFeedback({
            type: "success",
            message: `Integration "${updated.display_name || updated.provider_name}" configuration saved and secured with AES-256-GCM.`,
          });
          loadData();
        }}
        apiFetch={apiCall}
      />

      {/* ── Secure Recording Playback Modal ───────────────────────── */}
      {activeRecordingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Call Recording Playback</h3>
              </div>
              <button
                onClick={() => setActiveRecordingModal(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Call Identifier:</span>
                <span className="font-mono text-white">{activeRecordingModal.call.call_code}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duration:</span>
                <span className="font-mono text-white">{activeRecordingModal.call.duration_seconds}s</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Security Notice:</span>
                <span className="text-emerald-400 font-semibold">Authorized Signed Token (15m expiry)</span>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center gap-3">
              <audio controls autoPlay className="w-full" src={activeRecordingModal.url}>
                Your browser does not support audio playback.
              </audio>
              <span className="text-[10px] text-slate-400">
                Access to this recording has been securely audited in platform logs.
              </span>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setActiveRecordingModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
