import type {
  CrmAdapter,
  ConnectionTestResult,
  LeadSyncResult,
  PlaintextCredentials,
  CrmLeadRecord,
} from "../../types.js";

export class ZohoCrmAdapter implements CrmAdapter {
  providerName = "zoho" as const;

  async testConnection(
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<ConnectionTestResult> {
    const domain = config.api_domain || "https://www.zohoapis.com";
    const token = credentials.access_token || credentials.api_key;

    if (!token) {
      return {
        success: false,
        message: "Configuration Required: Zoho OAuth access token is required.",
      };
    }

    try {
      const response = await fetch(`${domain.replace(/\/$/, "")}/crm/v3/users?type=CurrentUser`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: "Successfully connected to Zoho CRM.",
        };
      } else {
        return {
          success: false,
          message: `Zoho authentication failed: HTTP ${response.status} ${response.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Unable to connect to Zoho CRM API: ${err.message}`,
      };
    }
  }

  async syncLeads(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<LeadSyncResult> {
    const domain = config.api_domain || "https://www.zohoapis.com";
    const token = credentials.access_token || credentials.api_key;
    if (!token) return { records: [], hasMore: false };

    const page = cursor ? Number(cursor) : 1;
    const perPage = options?.limit || 50;
    const url = `${domain.replace(/\/$/, "")}/crm/v3/Leads?page=${page}&per_page=${perPage}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`Zoho API Error: HTTP ${res.status}`);

      const data: any = await res.json();
      const records = (data.data || []).map((r: any) => this.normalizeLead(r));
      const moreRecords = data.info?.more_records ?? false;

      return {
        records,
        nextCursor: moreRecords ? String(page + 1) : undefined,
        hasMore: moreRecords,
      };
    } catch (err) {
      console.error("[Zoho Sync Error]", err);
      return { records: [], hasMore: false };
    }
  }

  normalizeLead(raw: any): Partial<CrmLeadRecord> {
    return {
      external_lead_id: String(raw.id || ""),
      first_name: raw.First_Name || "",
      last_name: raw.Last_Name || "Unknown",
      email: raw.Email || null,
      phone: raw.Phone || raw.Mobile || null,
      company: raw.Company || null,
      status: this.mapStatus(raw.Lead_Status),
      disposition: raw.Lead_Status || null,
      custom_fields: {
        zoho_id: raw.id,
        lead_source: raw.Lead_Source,
      },
    };
  }

  private mapStatus(status?: string): CrmLeadRecord["status"] {
    if (!status) return "new";
    const s = status.toLowerCase();
    if (s.includes("contacted") || s.includes("attempted")) return "contacted";
    if (s.includes("qualified")) return "qualified";
    if (s.includes("lost") || s.includes("junk")) return "lost";
    return "new";
  }
}
