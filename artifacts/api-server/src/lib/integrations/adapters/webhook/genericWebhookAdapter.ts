import type { WebhookAdapter, CallActivityRecord, CrmLeadRecord } from "../../types.js";
import { verifyHmacSignature } from "../../encryption.js";

export class GenericWebhookAdapter implements WebhookAdapter {
  providerName = "generic_webhook" as const;

  verifySignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    secret: string
  ): boolean {
    const signature =
      (headers["x-thinkatic-signature"] as string) ||
      (headers["x-webhook-signature"] as string) ||
      (headers["x-hubspot-signature-v3"] as string) ||
      (headers["x-twilio-signature"] as string) ||
      (headers["x-signature"] as string);

    if (!signature || !secret || !rawBody) return false;

    // Check Hex HMAC
    const isHexMatch = verifyHmacSignature(rawBody, secret, signature, "hex");
    if (isHexMatch) return true;

    // Check Base64 HMAC (Twilio, HubSpot)
    return verifyHmacSignature(rawBody, secret, signature, "base64");
  }

  parseEvent(payload: any): {
    eventType: string;
    externalId: string;
    data: any;
    leadData?: Partial<CrmLeadRecord>;
    callData?: Partial<CallActivityRecord>;
  } {
    const eventType = payload.event_type || payload.type || payload.event || "unknown";
    const externalId =
      payload.event_id ||
      payload.id ||
      payload.call_id ||
      payload.lead_id ||
      payload.CallSid ||
      `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    let leadData: Partial<CrmLeadRecord> | undefined;
    let callData: Partial<CallActivityRecord> | undefined;

    // If payload contains call activity information
    if (
      payload.call_id ||
      payload.CallSid ||
      payload.duration !== undefined ||
      eventType.includes("call") ||
      eventType.includes("voice")
    ) {
      const duration = Number(payload.duration || payload.CallDuration || payload.duration_seconds || 0);
      const startTime = payload.start_time || payload.created_at || new Date().toISOString();
      const endTime = payload.end_time || new Date(new Date(startTime).getTime() + duration * 1000).toISOString();

      callData = {
        external_call_id: String(payload.call_id || payload.CallSid || externalId),
        call_direction: payload.direction === "outbound" || payload.Direction?.includes("outbound") ? "outbound" : "inbound",
        start_time: startTime,
        end_time: endTime,
        duration_seconds: duration,
        call_status: (payload.status || payload.CallStatus || "completed").toLowerCase(),
        disposition: payload.disposition || payload.CallStatus || "COMPLETED",
        recording_reference: payload.recording_id || payload.RecordingUrl || payload.RecordingSid || null,
        recording_duration_seconds: duration,
        caller_number: payload.from || payload.From || payload.caller_number || null,
        recipient_number: payload.to || payload.To || payload.recipient_number || null,
        metadata: payload,
      };
    }

    // If payload contains lead information
    if (
      payload.lead_id ||
      payload.email ||
      eventType.includes("lead") ||
      eventType.includes("contact")
    ) {
      leadData = {
        external_lead_id: String(payload.lead_id || payload.contact_id || externalId),
        first_name: payload.first_name || payload.firstName || "",
        last_name: payload.last_name || payload.lastName || "Unknown",
        email: payload.email || null,
        phone: payload.phone || null,
        company: payload.company || null,
        status: (payload.status || "new").toLowerCase(),
        disposition: payload.disposition || payload.status || null,
        custom_fields: payload.custom_fields || payload,
      };
    }

    return {
      eventType,
      externalId,
      data: payload,
      leadData,
      callData,
    };
  }
}
