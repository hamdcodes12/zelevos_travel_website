import type {
  DialerAdapter,
  ConnectionTestResult,
  CallSyncResult,
  PlaintextCredentials,
  CallActivityRecord,
} from "../../types.js";

export class GenesysDialerAdapter implements DialerAdapter {
  providerName = "genesys" as const;

  async testConnection(
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const environment = config.environment || "mypurecloud.com";
    const token = credentials.access_token || credentials.api_key;

    if (!token) {
      return {
        success: false,
        message: "Configuration Required: Genesys Cloud OAuth bearer token is required.",
      };
    }

    try {
      const url = `https://api.${environment}/api/v2/users/me`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const user: any = await response.json();
        return {
          success: true,
          message: `Successfully connected to Genesys Cloud organization (${user.organization?.name || "Active"})`,
        };
      } else {
        return {
          success: false,
          message: `Genesys Cloud returned HTTP ${response.status} ${response.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Unable to connect to Genesys Cloud API: ${err.message}`,
      };
    }
  }

  async syncCallLogs(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<CallSyncResult> {
    const environment = config.environment || "mypurecloud.com";
    const token = credentials.access_token || credentials.api_key;
    if (!token) return { records: [], hasMore: false };

    const pageNumber = cursor ? Number(cursor) : 1;
    const pageSize = options?.limit || 50;
    const interval = options?.since
      ? `${options.since}/${new Date().toISOString()}`
      : `${new Date(Date.now() - 86400000).toISOString()}/${new Date().toISOString()}`;

    try {
      const url = `https://api.${environment}/api/v2/analytics/conversations/details/query`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interval,
          paging: { pageSize, pageNumber },
        }),
      });

      if (!res.ok) throw new Error(`Genesys API HTTP ${res.status}`);

      const data: any = await res.json();
      const rawRecords = data.conversations || [];
      const records = rawRecords.map((r: any) => this.normalizeCall(r));

      return {
        records,
        nextCursor: rawRecords.length === pageSize ? String(pageNumber + 1) : undefined,
        hasMore: rawRecords.length === pageSize,
      };
    } catch (err) {
      console.error("[Genesys Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  async generateSignedRecordingUrl(
    recordingRef: string,
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const environment = config.environment || "mypurecloud.com";
    const token = credentials.access_token || credentials.api_key;

    if (!token) {
      throw new Error("Missing Genesys Cloud credentials to retrieve recording media URL");
    }

    // In Genesys Cloud, recordings are fetched through /api/v2/conversations/{id}/recordings
    const res = await fetch(
      `https://api.${environment}/api/v2/conversations/${recordingRef}/recordings?formatId=WAV`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      const data: any = await res.json();
      const mediaUri = data[0]?.mediaUris?.S?.mediaUri || data[0]?.fileState || "";
      return {
        url: mediaUri || `https://api.${environment}/recordings/${recordingRef}`,
        expiresInSeconds: 900,
      };
    }

    return {
      url: `https://api.${environment}/recordings/${recordingRef}`,
      expiresInSeconds: 900,
    };
  }

  normalizeCall(raw: any): Partial<CallActivityRecord> {
    const startTime = raw.conversationStart || new Date().toISOString();
    const endTime = raw.conversationEnd || new Date().toISOString();
    const duration = Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000));

    return {
      provider: "genesys",
      external_call_id: raw.conversationId || "",
      call_direction: raw.originatingDirection === "outbound" ? "outbound" : "inbound",
      start_time: startTime,
      end_time: endTime,
      duration_seconds: duration,
      call_status: "completed",
      disposition: raw.divisionId ? "HANDLED" : "UNKNOWN",
      recording_reference: raw.conversationId,
      metadata: {
        genesys_conversation_id: raw.conversationId,
        genesys_division: raw.divisionId,
      },
    };
  }
}
