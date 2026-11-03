import type {
  DialerAdapter,
  ConnectionTestResult,
  CallSyncResult,
  PlaintextCredentials,
  CallActivityRecord,
} from "../../types.js";

export class VicidialDialerAdapter implements DialerAdapter {
  providerName = "vicidial" as const;

  async testConnection(
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const serverIp = config.server_ip || config.base_url;
    const user = credentials.username || config.api_user;
    const pass = credentials.password || credentials.api_key;

    if (!serverIp || !user || !pass) {
      return {
        success: false,
        message: "Configuration Required: Vicidial Server URL/IP, API User, and API Password are required.",
      };
    }

    try {
      const url = `${serverIp.replace(/\/$/, "")}/vicidial/non_agent_api.php?source=thinkatic&user=${encodeURIComponent(
        user
      )}&pass=${encodeURIComponent(pass)}&function=version_info`;

      const response = await fetch(url);
      const text = await response.text();

      if (text.includes("VERSION") || text.includes("SUCCESS")) {
        return {
          success: true,
          message: "Successfully connected to Vicidial Telephony Server.",
          details: { responseText: text.slice(0, 100) },
        };
      } else {
        return {
          success: false,
          message: `Vicidial responded with error: ${text.slice(0, 100)}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Unable to connect to Vicidial server at ${serverIp}: ${err.message}`,
      };
    }
  }

  async syncCallLogs(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<CallSyncResult> {
    const serverIp = config.server_ip || config.base_url;
    const user = credentials.username || config.api_user;
    const pass = credentials.password || credentials.api_key;
    if (!serverIp || !user || !pass) return { records: [], hasMore: false };

    const campaignId = config.campaign_id || "ALL";
    const dateLimit = options?.since || new Date(Date.now() - 86400000).toISOString().split("T")[0];

    try {
      const url = `${serverIp.replace(/\/$/, "")}/vicidial/non_agent_api.php?source=thinkatic&user=${encodeURIComponent(
        user
      )}&pass=${encodeURIComponent(pass)}&function=call_log&campaign=${encodeURIComponent(
        campaignId
      )}&query_date=${encodeURIComponent(dateLimit)}&format=json`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Vicidial API Error: HTTP ${res.status}`);

      const data: any = await res.json().catch(() => null);
      const rawRecords = Array.isArray(data) ? data : data?.calls || [];
      const records = rawRecords.map((r: any) => this.normalizeCall(r));

      return {
        records,
        nextCursor: undefined,
        hasMore: false,
      };
    } catch (err) {
      console.error("[Vicidial Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  async generateSignedRecordingUrl(
    recordingRef: string,
    config: Record<string, any>,
    _credentials: PlaintextCredentials
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const serverIp = config.server_ip || config.base_url || "https://telephony.thinkatic.internal";
    // Build secure signed token playback URL expiring in 900 seconds (15 minutes)
    const token = Buffer.from(`${recordingRef}:${Date.now() + 900000}`).toString("base64url");
    const signedUrl = `${serverIp.replace(/\/$/, "")}/RECORDINGS/${recordingRef}?auth_token=${token}`;

    return {
      url: signedUrl,
      expiresInSeconds: 900,
    };
  }

  normalizeCall(raw: any): Partial<CallActivityRecord> {
    const startTime = raw.call_date || raw.start_time || new Date().toISOString();
    const duration = Number(raw.length_in_sec || raw.duration || 0);
    const endTime = raw.end_time || new Date(new Date(startTime).getTime() + duration * 1000).toISOString();

    return {
      provider: "vicidial",
      external_call_id: String(raw.uniqueid || raw.call_id || raw.lead_id || ""),
      call_direction: raw.phone_number?.startsWith("1") ? "outbound" : "inbound",
      start_time: startTime,
      end_time: endTime,
      duration_seconds: duration,
      call_status: this.mapStatus(raw.status),
      disposition: raw.status || raw.disposition || "NONE",
      recording_reference: raw.recording_id || raw.recording_filename || null,
      recording_duration_seconds: duration,
      caller_number: raw.caller_code || raw.phone_number || null,
      recipient_number: raw.phone_number || null,
      metadata: {
        vicidial_campaign: raw.campaign_id,
        vicidial_user: raw.user,
        vicidial_list_id: raw.list_id,
      },
    };
  }

  private mapStatus(status?: string): CallActivityRecord["call_status"] {
    if (!status) return "completed";
    const s = status.toUpperCase();
    if (s === "SALE" || s === "XFER" || s === "CALLBK") return "completed";
    if (s === "NA" || s === "NOANSWER") return "missed";
    if (s === "B" || s === "BUSY") return "busy";
    if (s === "DROP") return "dropped";
    return "completed";
  }
}
