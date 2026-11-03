import type {
  DialerAdapter,
  ConnectionTestResult,
  CallSyncResult,
  PlaintextCredentials,
  CallActivityRecord,
} from "../../types.js";

export class TwilioDialerAdapter implements DialerAdapter {
  providerName = "twilio" as const;

  async testConnection(
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const accountSid = config.account_sid || credentials.client_id || credentials.username;
    const authToken = credentials.api_key || credentials.password || credentials.client_secret;

    if (!accountSid || !authToken) {
      return {
        success: false,
        message: "Configuration Required: Twilio Account SID and Auth Token are required.",
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;

      const res = await fetch(url, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });

      if (res.ok) {
        const account: any = await res.json();
        return {
          success: true,
          message: `Successfully connected to Twilio Account (${account.friendly_name || accountSid})`,
          details: { status: account.status, type: account.type },
        };
      } else {
        return {
          success: false,
          message: `Twilio connection failed: HTTP ${res.status} ${res.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Unable to connect to Twilio API: ${err.message}`,
      };
    }
  }

  async syncCallLogs(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<CallSyncResult> {
    const accountSid = config.account_sid || credentials.client_id || credentials.username;
    const authToken = credentials.api_key || credentials.password || credentials.client_secret;
    if (!accountSid || !authToken) return { records: [], hasMore: false };

    const limit = options?.limit || 50;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
    const url = cursor
      ? `https://api.twilio.com${cursor}`
      : `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?PageSize=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`Twilio API Error HTTP ${res.status}`);

      const data: any = await res.json();
      const rawRecords = data.calls || [];
      const records = rawRecords.map((r: any) => this.normalizeCall(r));

      return {
        records,
        nextCursor: data.next_page_uri || undefined,
        hasMore: !!data.next_page_uri,
      };
    } catch (err) {
      console.error("[Twilio Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  async generateSignedRecordingUrl(
    recordingRef: string,
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const accountSid = config.account_sid || credentials.client_id || "AC_thinkatic_master";
    const signedToken = Buffer.from(`${recordingRef}:${Date.now() + 900000}`).toString("base64url");
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingRef}.mp3?token=${signedToken}`;
    return {
      url,
      expiresInSeconds: 900,
    };
  }

  normalizeCall(raw: any): Partial<CallActivityRecord> {
    const duration = Number(raw.duration || 0);
    const startTime = raw.start_time || raw.date_created || new Date().toISOString();
    const endTime = raw.end_time || new Date(new Date(startTime).getTime() + duration * 1000).toISOString();

    return {
      provider: "twilio",
      external_call_id: raw.sid || "",
      call_direction: raw.direction?.includes("outbound") ? "outbound" : "inbound",
      start_time: startTime,
      end_time: endTime,
      duration_seconds: duration,
      call_status: this.mapStatus(raw.status),
      disposition: raw.status || "COMPLETED",
      caller_number: raw.from || null,
      recipient_number: raw.to || null,
      metadata: {
        twilio_sid: raw.sid,
        price: raw.price,
        queue_time: raw.queue_time,
      },
    };
  }

  private mapStatus(status?: string): CallActivityRecord["call_status"] {
    if (!status) return "completed";
    const s = status.toLowerCase();
    if (s === "completed") return "completed";
    if (s === "busy") return "busy";
    if (s === "no-answer" || s === "canceled") return "missed";
    if (s === "failed") return "failed";
    if (s === "in-progress" || s === "ringing") return "in_progress";
    return "completed";
  }
}
