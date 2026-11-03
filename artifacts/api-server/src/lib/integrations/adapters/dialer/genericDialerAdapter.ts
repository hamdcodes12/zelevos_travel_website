import type {
  DialerAdapter,
  ConnectionTestResult,
  CallSyncResult,
  PlaintextCredentials,
  CallActivityRecord,
} from "../../types.js";

export class GenericRestDialerAdapter implements DialerAdapter {
  providerName = "custom_rest_dialer" as const;

  async testConnection(
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const baseUrl = config.base_url || config.endpointUrl;
    if (!baseUrl) {
      return {
        success: false,
        message: "Configuration Required: Endpoint Base URL is required for Custom Telephony integration.",
      };
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(credentials.custom_headers || {}),
    };
    if (credentials.api_key) {
      headers["Authorization"] = `Bearer ${credentials.api_key}`;
    }

    try {
      const testUrl = config.health_endpoint
        ? `${baseUrl.replace(/\/$/, "")}/${config.health_endpoint.replace(/^\//, "")}`
        : `${baseUrl.replace(/\/$/, "")}/health`;

      const response = await fetch(testUrl, { headers });
      if (response.ok) {
        return {
          success: true,
          message: "Successfully connected to Custom Telephony system.",
        };
      } else {
        return {
          success: false,
          message: `Custom Telephony service returned HTTP ${response.status} ${response.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Connection to custom dialer failed: ${err.message}`,
      };
    }
  }

  async syncCallLogs(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<CallSyncResult> {
    const baseUrl = config.base_url || config.endpointUrl;
    if (!baseUrl) return { records: [], hasMore: false };

    const callsPath = config.calls_endpoint || "/api/calls";
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/${callsPath.replace(/^\//, "")}`);
    if (cursor) url.searchParams.set("cursor", cursor);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    if (options?.since) url.searchParams.set("since", options.since);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(credentials.custom_headers || {}),
    };
    if (credentials.api_key) {
      headers["Authorization"] = `Bearer ${credentials.api_key}`;
    }

    try {
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`Custom Telephony API error HTTP ${res.status}`);

      const data: any = await res.json();
      const rawRecords = Array.isArray(data) ? data : data.calls || data.records || [];
      const records = rawRecords.map((r: any) => this.normalizeCall(r));

      return {
        records,
        nextCursor: data.next_cursor || data.nextCursor || undefined,
        hasMore: !!(data.next_cursor || data.nextCursor),
      };
    } catch (err) {
      console.error("[Custom Telephony Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  async generateSignedRecordingUrl(
    recordingRef: string,
    config: Record<string, any>,
    _credentials: PlaintextCredentials
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const baseUrl = config.base_url || "https://telephony.thinkatic.internal";
    const signedToken = Buffer.from(`${recordingRef}:${Date.now() + 900000}`).toString("base64url");
    return {
      url: `${baseUrl.replace(/\/$/, "")}/recordings/${recordingRef}?token=${signedToken}`,
      expiresInSeconds: 900,
    };
  }

  normalizeCall(raw: any): Partial<CallActivityRecord> {
    const startTime = raw.start_time || raw.startTime || new Date().toISOString();
    const duration = Number(raw.duration_seconds || raw.duration || 0);
    const endTime = raw.end_time || raw.endTime || new Date(new Date(startTime).getTime() + duration * 1000).toISOString();

    return {
      provider: "custom_rest_dialer",
      external_call_id: String(raw.id || raw.call_id || raw.external_id || ""),
      call_direction: raw.direction === "outbound" ? "outbound" : "inbound",
      start_time: startTime,
      end_time: endTime,
      duration_seconds: duration,
      call_status: raw.status || "completed",
      disposition: raw.disposition || raw.status || "NONE",
      recording_reference: raw.recording_id || raw.recording_ref || null,
      recording_duration_seconds: duration,
      caller_number: raw.caller || raw.caller_number || null,
      recipient_number: raw.recipient || raw.recipient_number || null,
      metadata: raw.metadata || {},
    };
  }
}
