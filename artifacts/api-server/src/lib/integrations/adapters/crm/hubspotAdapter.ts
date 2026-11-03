import type {
  CrmAdapter,
  ConnectionTestResult,
  LeadSyncResult,
  PlaintextCredentials,
  CrmLeadRecord,
} from "../../types.js";

export class HubSpotCrmAdapter implements CrmAdapter {
  providerName = "hubspot" as const;

  async testConnection(
    _config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const token = credentials.access_token || credentials.api_key;

    if (!token) {
      return {
        success: false,
        message: "Configuration Required: HubSpot Private App Token or OAuth access token is required.",
      };
    }

    try {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: "Successfully connected to HubSpot CRM.",
        };
      } else {
        return {
          success: false,
          message: `HubSpot connection failed: HTTP ${response.status} ${response.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Unable to connect to HubSpot API: ${err.message}`,
      };
    }
  }

  async syncLeads(
    _config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<LeadSyncResult> {
    const token = credentials.access_token || credentials.api_key;
    if (!token) return { records: [], hasMore: false };

    const limit = options?.limit || 50;
    const afterParam = cursor ? `&after=${encodeURIComponent(cursor)}` : "";
    const properties = "firstname,lastname,email,phone,company,lifecyclestage,hs_lead_status";
    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=${properties}${afterParam}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`HubSpot API Error: HTTP ${res.status}`);

      const data: any = await res.json();
      const records = (data.results || []).map((r: any) => this.normalizeLead(r));

      return {
        records,
        nextCursor: data.paging?.next?.after || undefined,
        hasMore: !!data.paging?.next?.after,
      };
    } catch (err) {
      console.error("[HubSpot Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  normalizeLead(raw: any): Partial<CrmLeadRecord> {
    const props = raw.properties || raw;
    return {
      external_lead_id: String(raw.id || props.hs_object_id || ""),
      first_name: props.firstname || "",
      last_name: props.lastname || "Unknown",
      email: props.email || null,
      phone: props.phone || null,
      company: props.company || null,
      status: this.mapStatus(props.lifecyclestage || props.hs_lead_status),
      disposition: props.hs_lead_status || props.lifecyclestage || null,
      custom_fields: {
        hubspot_id: raw.id,
        lifecycle_stage: props.lifecyclestage,
        lead_status: props.hs_lead_status,
      },
    };
  }

  private mapStatus(hsStatus?: string): CrmLeadRecord["status"] {
    if (!hsStatus) return "new";
    const s = hsStatus.toLowerCase();
    if (s.includes("lead") || s.includes("subscriber")) return "new";
    if (s.includes("connected") || s.includes("attempted") || s.includes("in_progress")) return "contacted";
    if (s.includes("qualif") || s.includes("opportunity")) return "qualified";
    if (s.includes("customer") || s.includes("won")) return "converted";
    if (s.includes("unqualified") || s.includes("lost")) return "lost";
    return "new";
  }
}
