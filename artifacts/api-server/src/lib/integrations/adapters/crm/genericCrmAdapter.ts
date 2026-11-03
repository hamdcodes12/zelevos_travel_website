import type {
  CrmAdapter,
  ConnectionTestResult,
  LeadSyncResult,
  PlaintextCredentials,
  CrmLeadRecord,
} from "../../types.js";

export class GenericRestCrmAdapter implements CrmAdapter {
  providerName = "custom_rest_crm" as const;

  async testConnection(
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const baseUrl = config.base_url || config.endpointUrl;
    if (!baseUrl) {
      return {
        success: false,
        message: "Configuration Required: Endpoint Base URL is required for Custom REST CRM.",
      };
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(credentials.custom_headers || {}),
    };

    if (credentials.api_key) {
      headers["Authorization"] = `Bearer ${credentials.api_key}`;
      headers["X-API-Key"] = credentials.api_key;
    }

    try {
      const testUrl = config.health_endpoint
        ? `${baseUrl.replace(/\/$/, "")}/${config.health_endpoint.replace(/^\//, "")}`
        : `${baseUrl.replace(/\/$/, "")}/health`;

      const response = await fetch(testUrl, { headers });
      if (response.ok) {
        return {
          success: true,
          message: "Successfully connected to custom REST CRM service.",
        };
      } else {
        return {
          success: false,
          message: `Custom CRM returned HTTP ${response.status} ${response.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Connection to custom CRM failed: ${err.message}`,
      };
    }
  }

  async syncLeads(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<LeadSyncResult> {
    const baseUrl = config.base_url || config.endpointUrl;
    if (!baseUrl) return { records: [], hasMore: false };

    const leadsPath = config.leads_endpoint || "/api/leads";
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/${leadsPath.replace(/^\//, "")}`);
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
      if (!res.ok) throw new Error(`Custom CRM API error HTTP ${res.status}`);

      const data: any = await res.json();
      const rawRecords = Array.isArray(data) ? data : data.records || data.leads || data.data || [];
      const records = rawRecords.map((r: any) => this.normalizeLead(r));

      return {
        records,
        nextCursor: data.next_cursor || data.nextCursor || undefined,
        hasMore: !!(data.next_cursor || data.nextCursor),
      };
    } catch (err) {
      console.error("[Custom CRM Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  normalizeLead(raw: any): Partial<CrmLeadRecord> {
    return {
      external_lead_id: String(raw.id || raw.lead_id || raw.external_id || ""),
      first_name: raw.first_name || raw.firstName || "",
      last_name: raw.last_name || raw.lastName || "Unknown",
      email: raw.email || null,
      phone: raw.phone || raw.phoneNumber || null,
      company: raw.company || raw.companyName || null,
      status: (raw.status || "new").toLowerCase(),
      disposition: raw.disposition || raw.status || null,
      custom_fields: raw.custom_fields || raw.metadata || {},
    };
  }
}
