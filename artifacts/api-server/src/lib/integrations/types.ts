// ─────────────────────────────────────────────────────────────────────────────
// THINKATIC PHASE 8: INTEGRATIONS CORE TYPES & CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationProviderType = "CRM" | "DIALER" | "WEBHOOK";

export type IntegrationProviderName =
  | "salesforce"
  | "hubspot"
  | "zoho"
  | "custom_rest_crm"
  | "vicidial"
  | "genesys"
  | "twilio"
  | "custom_rest_dialer"
  | "generic_webhook";

export type IntegrationLifecycleStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTH_EXPIRED"
  | "ERROR"
  | "DISCONNECTED";

export type IntegrationStatus = "active" | "paused" | "error" | "disconnected" | "connected" | IntegrationLifecycleStatus;
export type IntegrationHealth = "healthy" | "degraded" | "down" | "unknown";
export type IntegrationAuthType = "api_key" | "oauth2" | "basic_auth" | "webhook_secret" | "token";

export interface IntegrationRecord {
  id: number;
  integration_code: string; // THK-INT-XXXXX
  tenant_type: "client" | "partner" | "admin";
  client_id?: string | null;
  partner_id?: string | null;
  project_id?: number | null;
  provider_type: IntegrationProviderType;
  provider_name: IntegrationProviderName;
  display_name: string;
  description?: string | null;
  status: IntegrationStatus;
  lifecycle_status?: IntegrationLifecycleStatus;
  configuration_required?: boolean;
  health_status: IntegrationHealth;
  auth_type: IntegrationAuthType;
  base_url?: string | null;
  webhook_url?: string | null;
  webhook_secret_hash?: string | null;
  sync_interval_minutes: number;
  auto_sync_enabled: boolean;
  records_synced?: number;
  last_synced_at?: string | null;
  last_successful_sync_at?: string | null;
  last_health_check_at?: string | null;
  last_connection_test_at?: string | null;
  last_connection_test_result?: { success: boolean; latency_ms?: number; message: string } | null;
  last_error?: string | null;
  config: Record<string, any>;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EncryptedCredentialRecord {
  id: number;
  integration_id: number;
  encrypted_data: string; // AES-256-GCM hex
  iv: string;             // 12-byte IV hex
  auth_tag: string;       // 16-byte Auth Tag hex
  key_masked: string;     // e.g. ••••••••1234
  token_type?: string;
  expires_at?: string | null;
  refresh_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaintextCredentials {
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  webhook_secret?: string;
  username?: string;
  password?: string;
  custom_headers?: Record<string, string>;
}

export interface MaskedCredentials {
  key_masked: string;
  auth_type: IntegrationAuthType;
  has_secret: boolean;
  expires_at?: string | null;
  token_type?: string;
}

export interface SyncJobRecord {
  id: number;
  job_code: string; // THK-SNC-XXXXX
  integration_id: number;
  sync_type: "initial" | "incremental" | "manual" | "webhook_triggered";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  cursor_checkpoint?: string | null;
  retry_count: number;
  error_details?: string | null;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
}

export interface CrmLeadRecord {
  id: number;
  lead_code: string; // THK-LED-XXXXX
  integration_id: number;
  client_id: string;
  project_id?: number | null;
  external_lead_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost" | "dnc";
  disposition?: string | null;
  assigned_agent_id?: number | null;
  custom_fields: Record<string, any>;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CallActivityRecord {
  id: number;
  call_code: string; // THK-CAL-XXXXX
  integration_id: number;
  provider: string;
  client_id?: string | null;
  partner_id?: string | null;
  centre_id?: number | null;
  project_id?: number | null;
  agent_id?: number | null;
  lead_id?: number | null;
  external_call_id: string;
  call_direction: "inbound" | "outbound";
  start_time: string;
  end_time?: string | null;
  duration_seconds: number;
  call_status: "completed" | "missed" | "busy" | "failed" | "dropped" | "in_progress" | "transferred";
  disposition?: string | null;
  transfer_status?: string | null;
  recording_reference?: string | null;
  recording_duration_seconds?: number;
  caller_number?: string | null;
  recipient_number?: string | null;
  qa_score?: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WebhookEventRecord {
  id: number;
  integration_id: number;
  external_event_id: string;
  event_type: string;
  payload_hash: string;
  signature_verified: boolean;
  status: "received" | "processed" | "duplicate" | "failed" | "rejected";
  error_message?: string | null;
  received_at: string;
  processed_at?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER ADAPTER INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface LeadSyncResult {
  records: Partial<CrmLeadRecord>[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface CallSyncResult {
  records: Partial<CallActivityRecord>[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface CrmAdapter {
  providerName: IntegrationProviderName;
  testConnection(config: Record<string, any>, credentials: PlaintextCredentials): Promise<ConnectionTestResult>;
  syncLeads(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<LeadSyncResult>;
  normalizeLead(raw: any): Partial<CrmLeadRecord>;
}

export interface DialerAdapter {
  providerName: IntegrationProviderName;
  testConnection(config: Record<string, any>, credentials: PlaintextCredentials): Promise<ConnectionTestResult>;
  syncCallLogs(
    config: Record<string, any>,
    credentials: PlaintextCredentials,
    cursor?: string | null,
    options?: { limit?: number; since?: string }
  ): Promise<CallSyncResult>;
  generateSignedRecordingUrl(
    recordingRef: string,
    config: Record<string, any>,
    credentials: PlaintextCredentials
  ): Promise<{ url: string; expiresInSeconds: number }>;
  normalizeCall(raw: any): Partial<CallActivityRecord>;
}

export interface WebhookAdapter {
  providerName: IntegrationProviderName;
  verifySignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    secret: string
  ): boolean;
  parseEvent(payload: any): {
    eventType: string;
    externalId: string;
    data: any;
    leadData?: Partial<CrmLeadRecord>;
    callData?: Partial<CallActivityRecord>;
  };
}
