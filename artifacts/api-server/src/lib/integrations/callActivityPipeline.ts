import crypto from "crypto";
import { supabase } from "@workspace/db";
import type { IntegrationRecord, CallActivityRecord, WebhookEventRecord } from "./types.js";
import { callActivitiesStore } from "./syncEngine.js";
import { logger } from "../logger.js";
import { logSecurityEvent } from "../security.js";

export const webhooksLedgerStore = new Map<string, WebhookEventRecord>();
let nextCallActivityId = 800;
let nextWebhookId = 800;

export interface IngestCallEventOptions {
  integration: IntegrationRecord;
  externalEventId: string;
  eventType: string;
  payload: any;
  signatureVerified: boolean;
  actorUserId?: string | null;
}

export interface IngestCallResult {
  success: boolean;
  deduplicated: boolean;
  call?: CallActivityRecord;
  error?: string;
}

/**
 * Ingests and processes a call event from a Telephony Webhook or Direct API Ingestion.
 * Implements strict deduplication, idempotency, tenant resolution, and data validation.
 */
export async function ingestCallActivity(options: IngestCallEventOptions): Promise<IngestCallResult> {
  const { integration, externalEventId, eventType, payload, signatureVerified, actorUserId } = options;

  // 1. Calculate payload hash for idempotency tracking
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const ledgerKey = `${integration.id}:${externalEventId}`;

  // 2. Check webhook deduplication ledger
  if (webhooksLedgerStore.has(ledgerKey)) {
    const existingLedger = webhooksLedgerStore.get(ledgerKey)!;
    logger.info(
      { integrationId: integration.id, externalEventId },
      "Duplicate webhook event ignored (idempotent response)"
    );
    return {
      success: true,
      deduplicated: true,
      call: Array.from(callActivitiesStore.values()).find(
        (c) => c.integration_id === integration.id && c.external_call_id === externalEventId
      ),
    };
  }

  // Record into webhook ledger
  const webhookRecord: WebhookEventRecord = {
    id: ++nextWebhookId,
    integration_id: integration.id,
    external_event_id: externalEventId,
    event_type: eventType,
    payload_hash: payloadHash,
    signature_verified: signatureVerified,
    status: "received",
    received_at: new Date().toISOString(),
  };
  webhooksLedgerStore.set(ledgerKey, webhookRecord);

  try {
    // 3. Extract and Validate Call Attributes
    const externalCallId = String(payload.call_id || payload.CallSid || externalEventId);

    // Check if call already exists in activities store (idempotency by external_call_id)
    for (const c of callActivitiesStore.values()) {
      if (c.integration_id === integration.id && c.external_call_id === externalCallId) {
        webhookRecord.status = "duplicate";
        webhookRecord.processed_at = new Date().toISOString();
        return {
          success: true,
          deduplicated: true,
          call: c,
        };
      }
    }

    const duration = Number(payload.duration || payload.CallDuration || payload.duration_seconds || 0);
    if (duration < 0) {
      webhookRecord.status = "failed";
      webhookRecord.error_message = "Invalid call duration: duration cannot be negative";
      return { success: false, deduplicated: false, error: webhookRecord.error_message };
    }

    const startTime = payload.start_time || payload.date_created || new Date().toISOString();
    const endTime =
      payload.end_time ||
      (duration > 0 ? new Date(new Date(startTime).getTime() + duration * 1000).toISOString() : null);

    const callId = ++nextCallActivityId;
    const callCode = `THK-CAL-${String(callId).padStart(5, "0")}`;

    // 4. Server-Side Tenant Resolution (NEVER trust payload client_id / partner_id directly)
    const resolvedClientId = integration.client_id || null;
    const resolvedPartnerId = integration.partner_id || null;
    const resolvedProjectId = integration.project_id || payload.project_id ? Number(payload.project_id) : null;

    const callRecord: CallActivityRecord = {
      id: callId,
      call_code: callCode,
      integration_id: integration.id,
      provider: integration.provider_name,
      client_id: resolvedClientId,
      partner_id: resolvedPartnerId,
      centre_id: payload.centre_id ? Number(payload.centre_id) : null,
      project_id: resolvedProjectId,
      agent_id: payload.agent_id ? Number(payload.agent_id) : null,
      lead_id: payload.lead_id ? Number(payload.lead_id) : null,
      external_call_id: externalCallId,
      call_direction:
        payload.direction === "outbound" || payload.Direction?.includes("outbound") ? "outbound" : "inbound",
      start_time: startTime,
      end_time: endTime,
      duration_seconds: duration,
      call_status: (payload.status || payload.CallStatus || "completed").toLowerCase(),
      disposition: payload.disposition || payload.CallStatus || "COMPLETED",
      transfer_status: payload.transfer_status || "none",
      recording_reference:
        payload.recording_reference ||
        payload.recording_url ||
        payload.recording_id ||
        payload.RecordingUrl ||
        payload.RecordingSid ||
        null,
      recording_duration_seconds: duration,
      caller_number: payload.from || payload.From || payload.caller_number || null,
      recipient_number: payload.to || payload.To || payload.recipient_number || null,
      qa_score: payload.qa_score !== undefined ? Number(payload.qa_score) : null,
      metadata: payload.metadata || {},
      created_at: new Date().toISOString(),
    };

    callActivitiesStore.set(callRecord.id, callRecord);
    webhookRecord.status = "processed";
    webhookRecord.processed_at = new Date().toISOString();

    try {
      await supabase.from("bpo_call_activities").insert(callRecord);
      await supabase.from("bpo_integration_webhooks").insert(webhookRecord);
    } catch {
      // dual-persistence in-memory fallback
    }

    await logSecurityEvent({
      action: "CALL_ACTIVITY_INGESTED",
      actorUserId: actorUserId || undefined,
      targetId: callRecord.call_code,
      details: {
        integrationCode: integration.integration_code,
        externalCallId,
        provider: integration.provider_name,
        duration,
        status: callRecord.call_status,
      },
    });

    return {
      success: true,
      deduplicated: false,
      call: callRecord,
    };
  } catch (err: any) {
    webhookRecord.status = "failed";
    webhookRecord.error_message = err.message || "Failed to process call event";
    webhookRecord.processed_at = new Date().toISOString();
    logger.error({ err, integrationId: integration.id }, "Failed to ingest call activity");

    return {
      success: false,
      deduplicated: false,
      error: webhookRecord.error_message || undefined,
    };
  }
}
