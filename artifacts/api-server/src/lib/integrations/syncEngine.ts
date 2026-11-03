import { supabase } from "@workspace/db";
import type {
  IntegrationRecord,
  SyncJobRecord,
  PlaintextCredentials,
  CrmLeadRecord,
  CallActivityRecord,
} from "./types.js";
import { getCrmAdapter, getDialerAdapter } from "./registry.js";
import { logger } from "../logger.js";
import { logSecurityEvent } from "../security.js";

// ─────────────────────────────────────────────────────────────────────────────
// SYNC ENGINE & DUAL PERSISTENCE STORES
// ─────────────────────────────────────────────────────────────────────────────

export const syncJobsStore = new Map<number, SyncJobRecord>();
export const crmLeadsStore = new Map<number, CrmLeadRecord>();
export const callActivitiesStore = new Map<number, CallActivityRecord>();

let nextSyncJobId = 500;
let nextLeadId = 500;
let nextCallId = 500;

export async function executeSyncJob(
  integration: IntegrationRecord,
  credentials: PlaintextCredentials,
  syncType: SyncJobRecord["sync_type"] = "manual"
): Promise<SyncJobRecord> {
  const jobId = ++nextSyncJobId;
  const jobCode = `THK-SNC-${String(jobId).padStart(5, "0")}`;

  const job: SyncJobRecord = {
    id: jobId,
    job_code: jobCode,
    integration_id: integration.id,
    sync_type: syncType,
    status: "running",
    records_processed: 0,
    records_succeeded: 0,
    records_failed: 0,
    cursor_checkpoint: integration.config?.last_cursor || null,
    retry_count: 0,
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  syncJobsStore.set(job.id, job);

  try {
    if (integration.provider_type === "CRM") {
      const adapter = getCrmAdapter(integration.provider_name);
      if (!adapter) {
        throw new Error(`No CRM adapter registered for provider: ${integration.provider_name}`);
      }

      const syncResult = await adapter.syncLeads(
        integration.config,
        credentials,
        job.cursor_checkpoint,
        { limit: 50 }
      );

      for (const rawLead of syncResult.records) {
        job.records_processed++;
        try {
          // In-memory / Supabase upsert
          const leadId = ++nextLeadId;
          const leadCode = `THK-LED-${String(leadId).padStart(5, "0")}`;

          // Check for existing lead by external_lead_id
          let existingLead: CrmLeadRecord | undefined;
          for (const l of crmLeadsStore.values()) {
            if (l.integration_id === integration.id && l.external_lead_id === rawLead.external_lead_id) {
              existingLead = l;
              break;
            }
          }

          const lead: CrmLeadRecord = {
            id: existingLead ? existingLead.id : leadId,
            lead_code: existingLead ? existingLead.lead_code : leadCode,
            integration_id: integration.id,
            client_id: integration.client_id || "00000000-0000-0000-0000-000000000101",
            project_id: integration.project_id || null,
            external_lead_id: rawLead.external_lead_id || `ext_${Date.now()}`,
            first_name: rawLead.first_name || "",
            last_name: rawLead.last_name || "Unknown",
            email: rawLead.email || null,
            phone: rawLead.phone || null,
            company: rawLead.company || null,
            status: rawLead.status || "new",
            disposition: rawLead.disposition || null,
            assigned_agent_id: rawLead.assigned_agent_id || null,
            custom_fields: rawLead.custom_fields || {},
            last_synced_at: new Date().toISOString(),
            created_at: existingLead ? existingLead.created_at : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          crmLeadsStore.set(lead.id, lead);
          job.records_succeeded++;

          try {
            await supabase.from("bpo_crm_leads").upsert({
              lead_code: lead.lead_code,
              integration_id: lead.integration_id,
              client_id: lead.client_id,
              project_id: lead.project_id,
              external_lead_id: lead.external_lead_id,
              first_name: lead.first_name,
              last_name: lead.last_name,
              email: lead.email,
              phone: lead.phone,
              company: lead.company,
              status: lead.status,
              disposition: lead.disposition,
              assigned_agent_id: lead.assigned_agent_id,
              custom_fields: lead.custom_fields,
              last_synced_at: lead.last_synced_at,
            });
          } catch {
            // fallback to in-memory store
          }
        } catch (itemErr: any) {
          job.records_failed++;
          logger.warn({ err: itemErr }, `Failed to process lead in sync job ${job.job_code}`);
        }
      }

      job.cursor_checkpoint = syncResult.nextCursor || null;
    } else if (integration.provider_type === "DIALER") {
      const adapter = getDialerAdapter(integration.provider_name);
      if (!adapter) {
        throw new Error(`No Dialer adapter registered for provider: ${integration.provider_name}`);
      }

      const syncResult = await adapter.syncCallLogs(
        integration.config,
        credentials,
        job.cursor_checkpoint,
        { limit: 50 }
      );

      for (const rawCall of syncResult.records) {
        job.records_processed++;
        try {
          const callId = ++nextCallId;
          const callCode = `THK-CAL-${String(callId).padStart(5, "0")}`;

          // Check for existing call by external_call_id
          let existingCall: CallActivityRecord | undefined;
          for (const c of callActivitiesStore.values()) {
            if (c.integration_id === integration.id && c.external_call_id === rawCall.external_call_id) {
              existingCall = c;
              break;
            }
          }

          if (existingCall) {
            job.records_succeeded++;
            continue; // Deduplicated
          }

          const call: CallActivityRecord = {
            id: callId,
            call_code: callCode,
            integration_id: integration.id,
            provider: rawCall.provider || integration.provider_name,
            client_id: integration.client_id || null,
            partner_id: integration.partner_id || null,
            centre_id: rawCall.centre_id || null,
            project_id: integration.project_id || rawCall.project_id || null,
            agent_id: rawCall.agent_id || null,
            lead_id: rawCall.lead_id || null,
            external_call_id: rawCall.external_call_id || `call_${Date.now()}`,
            call_direction: rawCall.call_direction || "inbound",
            start_time: rawCall.start_time || new Date().toISOString(),
            end_time: rawCall.end_time || null,
            duration_seconds: rawCall.duration_seconds || 0,
            call_status: rawCall.call_status || "completed",
            disposition: rawCall.disposition || null,
            transfer_status: rawCall.transfer_status || "none",
            recording_reference: rawCall.recording_reference || null,
            recording_duration_seconds: rawCall.recording_duration_seconds || 0,
            caller_number: rawCall.caller_number || null,
            recipient_number: rawCall.recipient_number || null,
            qa_score: rawCall.qa_score || null,
            metadata: rawCall.metadata || {},
            created_at: new Date().toISOString(),
          };

          callActivitiesStore.set(call.id, call);
          job.records_succeeded++;

          try {
            await supabase.from("bpo_call_activities").insert(call);
          } catch {
            // fallback to in-memory store
          }
        } catch (itemErr: any) {
          job.records_failed++;
          logger.warn({ err: itemErr }, `Failed to process call in sync job ${job.job_code}`);
        }
      }

      job.cursor_checkpoint = syncResult.nextCursor || null;
    }

    job.status = "completed";
    job.completed_at = new Date().toISOString();
    integration.last_synced_at = job.completed_at;
    integration.health_status = "healthy";
    integration.last_error = null;

    await logSecurityEvent({
      action: "SYNC_JOB_COMPLETED",
      targetId: integration.integration_code,
      details: {
        jobCode: job.job_code,
        provider: integration.provider_name,
        processed: job.records_processed,
        succeeded: job.records_succeeded,
        failed: job.records_failed,
      },
    });
  } catch (err: any) {
    job.status = "failed";
    job.error_details = err.message || "Unknown synchronization failure";
    job.completed_at = new Date().toISOString();
    integration.health_status = "degraded";
    integration.last_error = job.error_details;

    logger.error({ err, integrationId: integration.id }, `Sync job ${job.job_code} failed`);

    await logSecurityEvent({
      action: "SYNC_JOB_FAILED",
      targetId: integration.integration_code,
      details: {
        jobCode: job.job_code,
        error: job.error_details,
      },
    });
  }

  syncJobsStore.set(job.id, job);

  try {
    await supabase.from("bpo_integration_sync_jobs").insert(job);
  } catch {
    // fallback
  }

  return job;
}
