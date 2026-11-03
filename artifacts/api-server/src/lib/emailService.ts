/**
 * THINKATIC PRODUCTION EMAIL NOTIFICATION SERVICE
 * Provides secure, idempotent, server-side transactional email dispatch.
 * Supports Resend API (RESEND_API_KEY) and Nodemailer SMTP (SMTP_HOST).
 * Enforces duplicate transmission protection, immutable audit trails, and privacy.
 */

import nodemailer from "nodemailer";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";

type Transporter = ReturnType<typeof nodemailer.createTransport>;

export interface BpoApprovalEmailParams {
  applicantUserId: string;
  applicantName: string;
  recipientEmail: string;
  companyName: string;
  centreId: string;
  agreementId?: string | null;
  partnerId?: string | null;
  forceResend?: boolean;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  skippedDuplicate?: boolean;
  configured: boolean;
  provider?: "resend" | "smtp" | "none";
  error?: string;
}

/**
 * Mask an email address to protect privacy in UI and logs (e.g. "g***************@gmail.com")
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "registered email";
  }
  const [localPart, domain] = email.trim().split("@");
  if (!localPart || !domain) return "registered email";
  if (localPart.length <= 1) {
    return `${localPart}***@${domain}`;
  }
  const maskedLocal = localPart[0] + "*".repeat(Math.max(localPart.length - 1, 3));
  return `${maskedLocal}@${domain}`;
}


/**
 * Get configured nodemailer transporter if SMTP credentials are provided in environment
 */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Check whether an approval email has already been dispatched for this applicant (Idempotency)
 */
async function hasApprovalEmailBeenSent(applicantUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("entity_id", applicantUserId)
      .eq("action", "bpo_approval_email_sent")
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      return true;
    }
  } catch (err: any) {
    logger.warn({ error: err.message, applicantUserId }, "Error checking approval email idempotency");
  }
  return false;
}

/**
 * Record delivery attempt in audit_logs and optional email_deliveries table
 */
async function recordDeliveryAttempt(record: {
  recipient: string;
  eventType: string;
  status: "PENDING" | "SENT" | "FAILED";
  provider: "resend" | "smtp" | "none";
  providerMessageId?: string | null;
  error?: string | null;
  applicantUserId: string;
  partnerId?: string | null;
  centreId?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  const now = new Date().toISOString();

  // 1. Immutable audit_logs entry (Authoritative Supabase audit trail)
  try {
    await supabase.from("audit_logs").insert({
      actor_admin_id: 1,
      action: record.status === "SENT" ? "bpo_approval_email_sent" : "bpo_approval_email_failed",
      entity_type: "user",
      entity_id: record.applicantUserId,
      metadata: {
        event_type: record.eventType,
        recipient_masked: maskEmail(record.recipient),
        status: record.status,
        provider: record.provider,
        provider_message_id: record.providerMessageId || null,
        centre_id: record.centreId || null,
        partner_id: record.partnerId || null,
        error: record.error || null,
        created_at: now,
        sent_at: record.status === "SENT" ? now : null,
        ...(record.metadata || {}),
      },
    });
  } catch (auditErr: any) {
    logger.warn({ err: auditErr?.message }, "Notice inserting email audit log");
  }

  // 2. Persistent email_deliveries entry (if table exists)
  try {
    await supabase.from("email_deliveries").insert({
      recipient: record.recipient,
      event_type: record.eventType,
      status: record.status,
      provider: record.provider,
      provider_message_id: record.providerMessageId || null,
      error: record.error || null,
      applicant_user_id: record.applicantUserId,
      partner_id: record.partnerId || null,
      centre_id: record.centreId || null,
      created_at: now,
      sent_at: record.status === "SENT" ? now : null,
    });
  } catch {
    // Graceful fallback if schema does not have email_deliveries table yet
  }
}

/**
 * Send official BPO Partner Approval Email
 * Strictly idempotent: will NOT send multiple emails if called repeatedly for the same applicant,
 * unless forceResend is explicitly true (e.g. Admin [Retry Approval Email] action).
 */
export async function sendBpoApprovalEmail(
  params: BpoApprovalEmailParams
): Promise<EmailDispatchResult> {
  const {
    applicantUserId,
    applicantName,
    recipientEmail,
    companyName,
    centreId,
    agreementId,
    partnerId,
    forceResend = false,
  } = params;

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return {
      success: false,
      configured: false,
      error: "Invalid recipient email address",
    };
  }

  // 1. Idempotency Check: Prevent duplicate approval emails
  if (!forceResend) {
    const alreadySent = await hasApprovalEmailBeenSent(applicantUserId);
    if (alreadySent) {
      logger.info(
        { applicantUserId, recipientMasked: maskEmail(recipientEmail) },
        "Approval email already recorded for applicant. Skipping duplicate transmission."
      );
      return {
        success: true,
        skippedDuplicate: true,
        configured: true,
        messageId: "already_sent",
      };
    }
  }

  // 2. Resolve Environment Configuration
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const transporter = getTransporter();

  // If no email provider is configured, do NOT fake success. Return clear server-side configuration error.
  if (!resendApiKey && !transporter) {
    const configError = "Email provider credentials are not configured in the server environment (Resend API or SMTP required).";
    logger.warn({ applicantUserId, recipientMasked: maskEmail(recipientEmail) }, configError);

    await recordDeliveryAttempt({
      recipient: recipientEmail,
      eventType: "BPO_PARTNER_APPROVED",
      status: "FAILED",
      provider: "none",
      error: configError,
      applicantUserId,
      partnerId,
      centreId,
      metadata: {
        company_name: companyName,
        agreement_id: agreementId || null,
        force_resend: forceResend,
      },
    });

    return {
      success: false,
      configured: false,
      provider: "none",
      error: configError,
    };
  }

  // 3. Resolve Sender Address & Application Portal Link
  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    "https://www.thinkatic.com"
  ).replace(/\/+$/, "");

  const portalUrl = `${appBaseUrl}/partner`;

  const senderAddress = resendApiKey
    ? (process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM || "Thinkatic <noreply@thinkatic.com>")
    : (process.env.SMTP_FROM || process.env.EMAIL_FROM || '"Thinkatic Global Operations" <support@thinkatic.com>');

  const subject = "Thinkatic Partner Approval — Your Partner Account Has Been Approved";

  // 4. Construct Plain Text Fallback
  const plainTextBody = `Hello ${applicantName || "Partner"},

Congratulations!

Your Thinkatic BPO Partner application has been approved.

Company:
${companyName || "BPO Partner"}

Centre ID:
${centreId || "Assigned upon onboarding"}
${agreementId ? `\nAgreement ID:\n${agreementId}\n` : ""}
Portal:
${portalUrl}

You can now access your Thinkatic Partner Portal and continue the onboarding process.

Regards,
Thinkatic Team`;

  // 5. Construct Professional Enterprise HTML Template
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 16px; }
    .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(11, 23, 48, 0.05); }
    .banner { background-color: #0B1730; padding: 32px 32px; text-align: left; border-bottom: 3px solid #214ECF; }
    .logo-badge { display: inline-block; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; }
    .logo-sub { font-size: 11px; font-weight: 700; color: #60a5fa; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; }
    .body-content { padding: 36px 32px; color: #1e293b; line-height: 1.6; font-size: 15px; }
    .salutation { font-size: 20px; font-weight: 800; color: #0B1730; margin-bottom: 12px; }
    .success-alert { background-color: #eff6ff; border-left: 4px solid #214ECF; padding: 16px 20px; border-radius: 8px; margin: 20px 0; color: #1e3a8a; }
    .success-alert-title { font-weight: 800; font-size: 15px; margin-bottom: 4px; }
    .success-alert-desc { font-size: 13px; line-height: 1.5; color: #1d4ed8; }
    .details-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
    .details-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 14px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
    .detail-label { color: #64748b; font-weight: 600; }
    .detail-value { color: #0B1730; font-weight: 700; text-align: right; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .cta-btn { display: inline-block; background-color: #214ECF; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(33, 78, 207, 0.25); }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="banner">
        <div class="logo-badge">THINKATIC</div>
        <div class="logo-sub">Technology & Business Process Outsourcing</div>
      </div>
      <div class="body-content">
        <div class="salutation">Hello ${applicantName || "Partner"},</div>
        
        <p style="font-size: 16px; font-weight: 700; color: #214ECF; margin: 12px 0;">Congratulations!</p>
        
        <p>Your Thinkatic BPO Partner application has been approved.</p>
        
        <div class="success-alert">
          <div class="success-alert-title">Account Activation Confirmed</div>
          <div class="success-alert-desc">Your partner account is now approved and your operational portal access has been activated.</div>
        </div>

        <div class="details-box">
          <div class="details-title">Partner Details</div>
          <div class="detail-row">
            <span class="detail-label">Company:</span>
            <span class="detail-value">${companyName || "BPO Partner"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Centre ID:</span>
            <span class="detail-value" style="font-family: monospace;">${centreId || "THK-CTR-001"}</span>
          </div>
          ${agreementId ? `
          <div class="detail-row">
            <span class="detail-label">Agreement ID:</span>
            <span class="detail-value" style="font-family: monospace;">${agreementId}</span>
          </div>` : ""}
          <div class="detail-row">
            <span class="detail-label">Portal:</span>
            <span class="detail-value"><a href="${portalUrl}" style="color: #214ECF; text-decoration: none;">${portalUrl}</a></span>
          </div>
        </div>

        <p>You can now access your Thinkatic Partner Portal and continue the onboarding process.</p>

        <div class="btn-container">
          <a href="${portalUrl}" class="cta-btn" target="_blank" rel="noopener noreferrer">Open BPO Partner Portal &rarr;</a>
        </div>

        <p style="margin-top: 32px; font-size: 13px; color: #64748b; line-height: 1.6;">
          If you have any operational or onboarding questions, please reach out to your designated Thinkatic partner representative.
        </p>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #edf2f7; font-size: 13px; color: #334155;">
          Regards,<br>
          <strong style="color: #0B1730;">Thinkatic Team</strong><br>
          Technology &amp; Business Process Outsourcing
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Thinkatic Global Operations. All rights reserved.<br>
        Confidential transactional notification intended strictly for the registered recipient.
      </div>
    </div>
  </div>
</body>
</html>`;

  let messageId: string | undefined;
  let activeProvider: "resend" | "smtp" = resendApiKey ? "resend" : "smtp";

  // 6. Execute Provider Dispatch
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderAddress,
          to: [recipientEmail.trim()],
          subject,
          text: plainTextBody,
          html: htmlBody,
        }),
      });

      const responseBody = (await res.json().catch(() => null)) as Record<string, any> | null;

      if (!res.ok) {
        const providerError = responseBody?.message || responseBody?.error || `Resend HTTP ${res.status}`;
        const domain = recipientEmail.includes("@") ? recipientEmail.split("@")[1] : "unknown";
        logger.error({ err: providerError, recipientMasked: maskEmail(recipientEmail), recipientDomain: domain }, "Resend API delivery error");

        await recordDeliveryAttempt({
          recipient: recipientEmail,
          eventType: "BPO_PARTNER_APPROVED",
          status: "FAILED",
          provider: "resend",
          error: providerError,
          applicantUserId,
          partnerId,
          centreId,
          metadata: { company_name: companyName, agreement_id: agreementId || null, force_resend: forceResend },
        });

        return {
          success: false,
          configured: true,
          provider: "resend",
          error: `Resend error: ${providerError}`,
        };
      }

      messageId = responseBody?.id || `resend_${Date.now()}`;
      const domain = recipientEmail.includes("@") ? recipientEmail.split("@")[1] : "unknown";
      logger.info(
        {
          partnerId: partnerId || null,
          applicantUserId,
          recipientDomain: domain,
          providerMessageId: messageId,
          status: "accepted",
        },
        "Approval email accepted by Resend provider"
      );
    } catch (apiErr: any) {
      const networkError = apiErr?.message || "Network error contacting Resend API";
      logger.error({ err: networkError }, "Resend API request exception");

      await recordDeliveryAttempt({
        recipient: recipientEmail,
        eventType: "BPO_PARTNER_APPROVED",
        status: "FAILED",
        provider: "resend",
        error: networkError,
        applicantUserId,
        partnerId,
        centreId,
      });

      return {
        success: false,
        configured: true,
        provider: "resend",
        error: networkError,
      };
    }
  } else if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: senderAddress,
        to: recipientEmail,
        subject,
        text: plainTextBody,
        html: htmlBody,
      });
      messageId = info.messageId;
      logger.info({ messageId, recipientMasked: maskEmail(recipientEmail) }, "Successfully sent BPO approval email via SMTP");
    } catch (smtpErr: any) {
      const errorMsg = smtpErr?.message || "SMTP transmission failure";
      logger.error({ err: errorMsg, recipientMasked: maskEmail(recipientEmail) }, "SMTP transport failed to send approval email");

      await recordDeliveryAttempt({
        recipient: recipientEmail,
        eventType: "BPO_PARTNER_APPROVED",
        status: "FAILED",
        provider: "smtp",
        error: errorMsg,
        applicantUserId,
        partnerId,
        centreId,
        metadata: { company_name: companyName, agreement_id: agreementId || null, force_resend: forceResend },
      });

      return {
        success: false,
        configured: true,
        provider: "smtp",
        error: `SMTP error: ${errorMsg}`,
      };
    }
  }

  // 7. Record Successful Delivery in Audit Logs & Delivery Records
  await recordDeliveryAttempt({
    recipient: recipientEmail,
    eventType: "BPO_PARTNER_APPROVED",
    status: "SENT",
    provider: activeProvider,
    providerMessageId: messageId,
    applicantUserId,
    partnerId,
    centreId,
    metadata: {
      company_name: companyName,
      agreement_id: agreementId || null,
      force_resend: forceResend,
    },
  });

  return {
    success: true,
    messageId,
    configured: true,
    provider: activeProvider,
  };
}
