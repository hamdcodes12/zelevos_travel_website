function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const maskedLocal = local.length <= 2 ? `${local[0]}***` : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

import { logger } from "../lib/logger";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { and, eq } from "drizzle-orm";
import { bookingsTable, db, notificationsTable, type Booking } from "@workspace/db";

export type EmailSendResult = {
  success: boolean;
  messageId?: string;
  recipient: string;
  cc?: string;
  status: "SENT" | "FAILED" | "UNAVAILABLE";
  error?: string;
  previewUrl?: string;
};

export type EmailAttachment = {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
};

export type EmailConfig = {
  clientBookingEmail: string;
  resendApiKey?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string;
  isTestMode: boolean;
  provider: "resend" | "smtp" | "test";
};

export type ActiveEmailProvider = "resend" | "smtp" | "none";

export const USER_FRIENDLY_EMAIL_ERROR =
  "We couldn't send the verification email right now. Please try again later.";

/**
 * Resolves active email provider based on configuration.
 * Priority: RESEND_API_KEY takes priority, then SMTP credentials (SMTP_USER + SMTP_PASS).
 */
export function resolveEmailProvider(): ActiveEmailProvider {
  const explicit = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const hasResend = Boolean(resendApiKey);
  const hasSmtp = Boolean(smtpUser && smtpPass);

  if (explicit === "resend" && hasResend) return "resend";
  if (explicit === "smtp" && hasSmtp) return "smtp";

  // Priority: if RESEND_API_KEY exists use Resend, else if SMTP vars exist use SMTP
  if (hasResend) return "resend";
  if (hasSmtp) return "smtp";

  return "none";
}

/**
 * Resolves sender email address honoring EMAIL_FROM, RESEND_FROM_EMAIL, or provider defaults.
 */
export function getEmailFromAddress(provider?: ActiveEmailProvider): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;

  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (resendFrom) return resendFrom;

  const smtpUser = process.env.SMTP_USER?.trim();
  if (provider === "smtp" && smtpUser) {
    return `"Zelevos" <${smtpUser}>`;
  }

  return "Zelevos <no-reply@zelevos.com>";
}

/**
 * Validates email configuration once at server startup and logs clear status without leaking secrets.
 */
export function validateEmailConfiguration(): void {
  const provider = resolveEmailProvider();
  if (provider === "resend") {
    logger.info({ provider: "resend", from: getEmailFromAddress("resend") }, "[Email Service] Configured with Resend provider.");
  } else if (provider === "smtp") {
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || "465");
    const user = process.env.SMTP_USER?.trim() ? maskEmail(process.env.SMTP_USER.trim()) : "";
    logger.info({ provider: "smtp", host, port, user }, "[Email Service] Configured with SMTP provider.");
  } else {
    if (process.env.NODE_ENV === "production") {
      logger.warn("[Email Service] WARNING: Neither RESEND_API_KEY nor SMTP credentials (SMTP_USER & SMTP_PASS) are configured. Outbound email delivery will fail in production.");
    } else {
      logger.info("[Email Service] Notice: No outbound email provider configured. Development console fallback is ACTIVE (verification codes and OTPs will be printed to terminal).");
    }
  }
}

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  constructor(customConfig?: Partial<EmailConfig>) {
    const isExplicitTest = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim() === "test";
    const resendApiKey = (customConfig?.resendApiKey || process.env.RESEND_API_KEY || "").trim();
    const smtpUser = (process.env.SMTP_USER || "").trim();
    const smtpPass = (process.env.SMTP_PASS || "").trim();
    const resolved = resolveEmailProvider();

    let provider: "resend" | "smtp" | "test" = isExplicitTest ? "test" : (resolved === "none" ? "test" : resolved);
    if (customConfig?.resendApiKey) {
      provider = "resend";
    }

    this.config = {
      clientBookingEmail: (
        customConfig?.clientBookingEmail ||
        process.env.CLIENT_BOOKING_EMAIL ||
        "client-bookings@zelevos.com"
      ).trim(),
      resendApiKey,
      smtpHost: (customConfig?.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com").trim(),
      smtpPort: customConfig?.smtpPort || Number(process.env.SMTP_PORT || "465"),
      smtpSecure:
        customConfig?.smtpSecure !== undefined
          ? customConfig.smtpSecure
          : (process.env.SMTP_SECURE || "true").toLowerCase() === "true",
      smtpUser: customConfig?.smtpUser || smtpUser,
      smtpPass: customConfig?.smtpPass || smtpPass,
      isTestMode: customConfig?.isTestMode ?? (provider === "test"),
      provider,
    };

    if (this.config.provider === "smtp" && this.config.smtpUser && this.config.smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPass,
        },
      });
    }
  }

  public getConfig(): EmailConfig {
    return { ...this.config };
  }

  /**
   * Generates clean plain text email representation
   */
  public generatePlainTextEmail(booking: Booking): string {
    const contact = (booking.contact || {}) as { email?: string; phone?: string; countryCode?: string };
    const passengers = Array.isArray(booking.passengers) ? (booking.passengers as any[]) : [];
    const segments = Array.isArray(booking.segments) ? (booking.segments as any[]) : [];
    const addons = (booking.addons || {}) as Record<string, any>;
    const fareSnapshot = (booking.fareSnapshot || {}) as Record<string, any>;

    const passengerLines = passengers.map((p, idx) => {
      const details = [
        `Passenger ${idx + 1}: ${p.title ? p.title + " " : ""}${p.firstName || ""} ${p.lastName || ""}`.trim(),
        `  Type: ${p.type || "ADULT"}`,
        p.dateOfBirth ? `  DOB: ${p.dateOfBirth}` : null,
        p.gender ? `  Gender: ${p.gender}` : null,
        p.passportNumber ? `  Passport: ${p.passportNumber} (Exp: ${p.passportExpiry || "N/A"})` : null,
      ].filter(Boolean);
      return details.join("\n");
    }).join("\n\n");

    const segmentLines = segments.map((s, idx) => {
      return [
        `Segment ${idx + 1}: ${s.carrier || ""} ${s.flightNumber || ""}`,
        `  From: ${s.origin || ""} -> To: ${s.destination || ""}`,
        `  Departure: ${s.departureTime || s.departure || "Scheduled"}`,
        `  Arrival: ${s.arrivalTime || s.arrival || "Scheduled"}`,
        s.duration ? `  Duration: ${s.duration}` : null,
        s.cabin ? `  Cabin: ${s.cabin}` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    const baseFare = fareSnapshot.baseFare || Math.round((booking.amount || 0) * 0.85);
    const taxes = fareSnapshot.taxes || ((booking.amount || 0) - baseFare);

    return `
ZELEVOS FLIGHT BOOKING CONFIRMATION
==================================
Booking Status: ${booking.status}
PNR / Booking Reference: ${booking.pnr || booking.bookingReference}
E-Ticket Number: ${booking.ticketNumber || "ELECTRONIC_ISSUED"}
Provider Reference: ${booking.providerReference}
Provider Mode: ${booking.providerMode}

PASSENGER DETAILS:
------------------
${passengerLines || "No passenger records listed"}

CONTACT DETAILS:
----------------
Email: ${contact.email || "N/A"}
Phone: ${contact.countryCode || ""}${contact.phone || "N/A"}

FLIGHT DETAILS:
---------------
${segmentLines || "Direct flight schedule"}

BAGGAGE & ADD-ONS:
------------------
Cabin Baggage: 7 kg included per passenger
Check-in Baggage: ${fareSnapshot.baggage || "15 kg included"}
${addons.extraBaggageKg ? `Extra Baggage: +${addons.extraBaggageKg} kg (₹${addons.extraBaggagePrice || 0})` : "Extra Baggage: None"}
${addons.seatCode ? `Selected Seat: ${addons.seatCode} (₹${addons.seatSelectionPrice || 0})` : "Seat: Standard allocation at web check-in"}
${addons.mealSelection ? `Meal Preference: ${addons.mealSelection}` : "Meals: As per airline policy"}

PAYMENT BREAKDOWN:
------------------
Base Fare: ₹${Number(baseFare).toLocaleString("en-IN")}
Taxes & Carrier Fees: ₹${Number(taxes).toLocaleString("en-IN")}
Add-ons Total: ₹${Number((addons.extraBaggagePrice || 0) + (addons.seatSelectionPrice || 0)).toLocaleString("en-IN")}
Total Amount Paid: ₹${Number(booking.amount).toLocaleString("en-IN")} (INR)
Payment ID: ${booking.paymentId || "N/A"}
Payment Status: ${booking.paymentStatus || "CAPTURED"}

BOOKING INFORMATION:
--------------------
Booking ID: ${booking.id}
Created At: ${booking.createdAt ? new Date(booking.createdAt).toISOString() : new Date().toISOString()}
Cancellation Policy: Standard airline cancellation fee applies up to 4 hours before departure.
Refund Policy: Cancellations via Zelevos portal automatically calculate eligible refunds credited to the original payment source.

Security Notice: All sensitive credentials, tokens, and payment secrets have been excluded.
Generated by Zelevos Travel Operations.
    `.trim();
  }

  /**
   * Generates rich HTML email representation
   */
  public generateHtmlEmail(booking: Booking): string {
    const contact = (booking.contact || {}) as { email?: string; phone?: string; countryCode?: string };
    const passengers = Array.isArray(booking.passengers) ? (booking.passengers as any[]) : [];
    const segments = Array.isArray(booking.segments) ? (booking.segments as any[]) : [];
    const addons = (booking.addons || {}) as Record<string, any>;
    const fareSnapshot = (booking.fareSnapshot || {}) as Record<string, any>;

    const baseFare = fareSnapshot.baseFare || Math.round((booking.amount || 0) * 0.85);
    const taxes = fareSnapshot.taxes || ((booking.amount || 0) - baseFare);

    const passengerRows = passengers.map((p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 14px; font-weight: 600; color: #1e293b;">${idx + 1}. ${p.title ? p.title + " " : ""}${p.firstName || ""} ${p.lastName || ""}</td>
        <td style="padding: 10px 14px; color: #475569;">${p.type || "ADULT"}</td>
        <td style="padding: 10px 14px; color: #475569;">${p.dateOfBirth || "N/A"}</td>
        <td style="padding: 10px 14px; color: #475569;">${p.passportNumber ? `${p.passportNumber} (Exp: ${p.passportExpiry || "-"})` : "National ID / Voter"}</td>
      </tr>
    `).join("");

    const segmentCards = segments.map((s, idx) => `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 700; color: #0284c7; font-size: 14px;">Flight Segment ${idx + 1}: ${s.carrier || "Airline"} ${s.flightNumber || ""}</span>
          <span style="background-color: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${s.cabin || "Economy"}</span>
        </div>
        <table style="width: 100%; font-size: 13px; color: #334155;">
          <tr>
            <td style="width: 45%;">
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${s.origin || "Origin"}</div>
              <div style="color: #64748b; font-size: 12px;">Departure: ${s.departureTime || s.departure || "Scheduled"}</div>
            </td>
            <td style="width: 10%; text-align: center; color: #94a3b8; font-weight: bold;">➔</td>
            <td style="width: 45%; text-align: right;">
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${s.destination || "Destination"}</div>
              <div style="color: #64748b; font-size: 12px;">Arrival: ${s.arrivalTime || s.arrival || "Scheduled"}</div>
            </td>
          </tr>
        </table>
        ${s.duration ? `<div style="margin-top: 6px; font-size: 12px; color: #64748b;">Duration: ${s.duration}</div>` : ""}
      </div>
    `).join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zelevos — Flight Booking Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ZELEVOS TRAVEL</h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">New Flight Booking Confirmed — Operations & Client Notification</p>
    </div>

    <!-- PNR Banner -->
    <div style="background-color: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 18px 32px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <div style="font-size: 12px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Airline PNR / Reference</div>
            <div style="font-size: 26px; font-weight: 800; color: #166534; letter-spacing: 1px;">${booking.pnr || booking.bookingReference}</div>
          </td>
          <td style="text-align: right;">
            <div style="font-size: 12px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Status</div>
            <span style="display: inline-block; background-color: #22c55e; color: #ffffff; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 9999px;">CONFIRMED</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Content Body -->
    <div style="padding: 28px 32px;">
      <!-- Key Meta -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b;">E-Ticket Number:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.ticketNumber || "ELECTRONIC_ISSUED"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Zelevos Reference:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.bookingReference}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Provider Reference:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.providerReference} (${booking.providerMode})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Booking Timestamp:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.createdAt ? new Date(booking.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : new Date().toLocaleString()}</td>
        </tr>
      </table>

      <!-- Flight Details -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Flight Segments</h2>
      ${segmentCards || "<p style='color: #64748b; font-size: 13px;'>Scheduled flight confirmation.</p>"}

      <!-- Passenger Details -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Traveller Information</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569;">
            <th style="padding: 8px 14px;">Name</th>
            <th style="padding: 8px 14px;">Type</th>
            <th style="padding: 8px 14px;">DOB</th>
            <th style="padding: 8px 14px;">ID / Passport</th>
          </tr>
        </thead>
        <tbody>
          ${passengerRows}
        </tbody>
      </table>

      <!-- Contact Info -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Contact Details</h2>
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-bottom: 20px;">
        <div><strong>Email:</strong> ${contact.email || "N/A"}</div>
        <div style="margin-top: 4px;"><strong>Phone:</strong> ${contact.countryCode || ""}${contact.phone || "N/A"}</div>
      </div>

      <!-- Baggage & Addons -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Baggage & Extras</h2>
      <ul style="font-size: 13px; color: #334155; line-height: 1.6; padding-left: 20px; margin: 0 0 20px 0;">
        <li><strong>Cabin Baggage:</strong> 7 kg complimentary</li>
        <li><strong>Check-in Baggage:</strong> ${fareSnapshot.baggage || "15 kg standard allowance"}</li>
        ${addons.extraBaggageKg ? `<li><strong>Extra Baggage:</strong> +${addons.extraBaggageKg} kg (₹${addons.extraBaggagePrice || 0})</li>` : ""}
        ${addons.seatCode ? `<li><strong>Seat Assigned:</strong> ${addons.seatCode} (₹${addons.seatSelectionPrice || 0})</li>` : "<li><strong>Seat:</strong> Allocation at web check-in</li>"}
        ${addons.mealSelection ? `<li><strong>Meal Option:</strong> ${addons.mealSelection}</li>` : ""}
      </ul>

      <!-- Payment Summary -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Payment Summary</h2>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Base Airfare:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${Number(baseFare).toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Taxes & Airline Surcharges:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${Number(taxes).toLocaleString("en-IN")}</td>
          </tr>
          ${((addons.extraBaggagePrice || 0) + (addons.seatSelectionPrice || 0)) > 0 ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Ancillaries / Add-ons:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${Number((addons.extraBaggagePrice || 0) + (addons.seatSelectionPrice || 0)).toLocaleString("en-IN")}</td>
          </tr>` : ""}
          <tr style="border-top: 1px solid #cbd5e1;">
            <td style="padding: 10px 0 4px 0; font-weight: 800; font-size: 15px; color: #0f172a;">Total Paid:</td>
            <td style="padding: 10px 0 4px 0; text-align: right; font-weight: 800; font-size: 16px; color: #0284c7;">₹${Number(booking.amount).toLocaleString("en-IN")} INR</td>
          </tr>
        </table>
        <div style="margin-top: 10px; font-size: 12px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
          <div><strong>Payment Reference:</strong> ${booking.paymentId || "Captured"}</div>
          <div><strong>Payment Status:</strong> ${booking.paymentStatus || "CAPTURED"}</div>
        </div>
      </div>

      <!-- Policy Info -->
      <div style="margin-top: 24px; padding: 14px; background-color: #f1f5f9; border-radius: 8px; font-size: 12px; color: #475569; line-height: 1.5;">
        <strong>Cancellation & Refund Rules:</strong>
        Changes or cancellations are permitted subject to airline fare conditions up to 4 hours before scheduled departure. Real-time refunds upon eligible cancellation are credited directly to the payer's original payment method via the Zelevos portal.
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #94a3b8; text-align: center;">
      <p style="margin: 0 0 4px 0;">This email is an automated confirmation sent by the Zelevos Booking Engine.</p>
      <p style="margin: 0;">Confidential &middot; Strictly for client operations &middot; Do not share payment credentials</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Sends the confirmed booking email to CLIENT_BOOKING_EMAIL (and optional CC to traveller)
   */
  public async sendBookingConfirmation(booking: Booking): Promise<EmailSendResult> {
    const recipient = this.config.clientBookingEmail;
    const contact = (booking.contact || {}) as { email?: string };
    const travellerEmail = (contact.email || "").trim();
    // CC traveller if valid and different from client
    const cc = (travellerEmail && travellerEmail !== recipient && travellerEmail.includes("@"))
      ? travellerEmail
      : undefined;

    const pnrRef = booking.pnr || booking.bookingReference;
    const subject = `Zelevos — New Flight Booking Confirmed — ${pnrRef}`;
    const text = this.generatePlainTextEmail(booking);
    const html = this.generateHtmlEmail(booking);

    // 1. Resend API Dispatch
    if (this.config.provider === "resend" && this.config.resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Zelevos Bookings <onboarding@resend.dev>",
            to: [recipient],
            cc: cc ? [cc] : undefined,
            subject,
            html,
            text,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ message: `HTTP ${response.status}` })) as any;
          return {
            success: false,
            recipient,
            cc,
            status: "FAILED",
            error: errBody.message || `Resend delivery failed with status ${response.status}`,
          };
        }

        const data = await response.json() as { id: string };
        return {
          success: true,
          messageId: data.id,
          recipient,
          cc,
          status: "SENT",
        };
      } catch (err: any) {
        return {
          success: false,
          recipient,
          cc,
          status: "FAILED",
          error: err?.message || "Failed to deliver email via Resend API.",
        };
      }
    }

    // 2. SMTP Nodemailer Dispatch
    if (this.config.provider === "smtp" && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: `"Zelevos Bookings" <${this.config.smtpUser}>`,
          to: recipient,
          cc,
          subject,
          text,
          html,
        });

        return {
          success: true,
          messageId: info.messageId,
          recipient,
          cc,
          status: "SENT",
        };
      } catch (err: any) {
        const errorMessage = err?.message || String(err);
        return {
          success: false,
          recipient,
          cc,
          status: "FAILED",
          error: errorMessage,
        };
      }
    }

    // When no external provider is configured:
    if (process.env.NODE_ENV !== "production") {
      logger.info({ recipient, subject }, "[DEV EMAIL FALLBACK] Email logged to server console in development.");
      return {
        success: true,
        recipient,
        cc,
        status: "SENT",
        messageId: `dev-console-${Date.now()}`,
      };
    }

    return {
      success: false,
      recipient,
      cc,
      status: "UNAVAILABLE",
      error: USER_FRIENDLY_EMAIL_ERROR,
    };
  }

  /**
   * Section 17: Dispatches one of the 10 defined platform notification events.
   */
  async sendNotificationEvent(params: {
    type:
      | "BOOKING_RECEIVED"
      | "PAYMENT_SUCCESSFUL"
      | "BOOKING_UNDER_CONFIRMATION"
      | "SUPPLIER_CONFIRMATION_RECEIVED"
      | "ACTION_REQUIRED_CUSTOMER"
      | "FINAL_TRIP_CONFIRMED"
      | "VOUCHER_AVAILABLE"
      | "UPCOMING_TRIP_REMINDER"
      | "CANCELLATION_REFUND_UPDATE"
      | "OPERATIONAL_ALERT_OVERDUE";
    recipientEmail: string;
    customerName?: string;
    bookingId: string;
    title?: string;
    message?: string;
    details?: Record<string, unknown>;
  }): Promise<EmailSendResult> {
    const { type, recipientEmail, customerName = "Valued Traveller", bookingId, details } = params;

    let subject = "";
    let htmlContent = "";

    switch (type) {
      case "BOOKING_RECEIVED":
        subject = `Booking Received: ${bookingId} — Zelevos`;
        htmlContent = `<h2>Booking Received</h2><p>Hello ${customerName},</p><p>We have received your booking request <strong>${bookingId}</strong>. Our operations team has initiated component reservations.</p>`;
        break;
      case "PAYMENT_SUCCESSFUL":
        subject = `Payment Confirmed for ${bookingId} — Zelevos`;
        htmlContent = `<h2>Payment Received</h2><p>Hello ${customerName},</p><p>Your payment for booking <strong>${bookingId}</strong> was successful. Fulfilment tasks have been assigned to our local partners.</p>`;
        break;
      case "BOOKING_UNDER_CONFIRMATION":
        subject = `Trip Under Confirmation: ${bookingId} — Zelevos`;
        htmlContent = `<h2>Under Confirmation</h2><p>Hello ${customerName},</p><p>Your trip <strong>${bookingId}</strong> is actively being confirmed with our vetted suppliers. You can track progress in real-time in My Trips.</p>`;
        break;
      case "SUPPLIER_CONFIRMATION_RECEIVED":
        subject = `Service Confirmed for ${bookingId} — Zelevos`;
        htmlContent = `<h2>Component Confirmed</h2><p>Hello ${customerName},</p><p>A service component for your trip <strong>${bookingId}</strong> has been verified by our operations team.</p>`;
        break;
      case "ACTION_REQUIRED_CUSTOMER":
        subject = `Action Required: ${bookingId} — Zelevos`;
        htmlContent = `<h2>Action Required</h2><p>Hello ${customerName},</p><p>We require additional information to complete your booking <strong>${bookingId}</strong>: ${params.message || "Please check your trip details in My Trips."}</p>`;
        break;
      case "FINAL_TRIP_CONFIRMED":
        subject = `🎉 Your Trip is Fully Confirmed! ${bookingId} — Zelevos`;
        htmlContent = `<h2>Trip Fully Confirmed!</h2><p>Hello ${customerName},</p><p>All mandatory components for your trip <strong>${bookingId}</strong> are confirmed. Your digital itinerary is ready!</p>`;
        break;
      case "VOUCHER_AVAILABLE":
        subject = `Vouchers Ready: ${bookingId} — Zelevos`;
        htmlContent = `<h2>Vouchers Ready</h2><p>Hello ${customerName},</p><p>Travel vouchers for your booking <strong>${bookingId}</strong> are now ready for secure download in My Trips.</p>`;
        break;
      case "UPCOMING_TRIP_REMINDER":
        subject = `Reminder: Your Trip ${bookingId} Starts Soon! — Zelevos`;
        htmlContent = `<h2>Upcoming Trip Reminder</h2><p>Hello ${customerName},</p><p>Your curated Zelevos journey is approaching. Review your packing list and digital itinerary under My Trips.</p>`;
        break;
      case "CANCELLATION_REFUND_UPDATE":
        subject = `Cancellation & Refund Update: ${bookingId} — Zelevos`;
        htmlContent = `<h2>Cancellation / Refund Update</h2><p>Hello ${customerName},</p><p>An update regarding your cancellation/refund request for <strong>${bookingId}</strong> has been processed: ${params.message || "Status updated."}</p>`;
        break;
      case "OPERATIONAL_ALERT_OVERDUE":
        subject = `[URGENT SLA ALERT] Supplier Response Overdue for ${bookingId}`;
        htmlContent = `<h2>Operational Alert: Overdue Task</h2><p>A supplier fulfilment task for booking <strong>${bookingId}</strong> has exceeded the SLA deadline. Operations review required immediately.</p>`;
        break;
    }

    const textContent = `${subject}\n\nBooking ID: ${bookingId}\n${params.message || ""}\nView details at: https://zelevos.com/my-trips`;

    return this.sendDirectEmail({
      to: recipientEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });
  }

  public async sendDirectEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    cc?: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailSendResult> {
    const { to, subject, html, text, cc, attachments } = params;
    const fromAddress = getEmailFromAddress(this.config.provider === "test" ? undefined : this.config.provider);

    if (this.config.provider === "resend" && this.config.resendApiKey) {
      try {
        const resendAttachments = attachments?.map((att) => ({
          filename: att.filename,
          content: att.content ? (Buffer.isBuffer(att.content) ? att.content.toString("base64") : att.content) : undefined,
          path: att.path,
        }));

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            cc: cc ? [cc] : undefined,
            subject,
            html,
            text: text || "",
            attachments: resendAttachments && resendAttachments.length > 0 ? resendAttachments : undefined,
          }),
        });

        if (!response.ok) {
          return { success: false, recipient: to, cc, status: "FAILED", error: `Resend failed HTTP ${response.status}` };
        }
        const data = (await response.json()) as { id: string };
        return { success: true, messageId: data.id, recipient: to, cc, status: "SENT" };
      } catch (err: any) {
        return { success: false, recipient: to, cc, status: "FAILED", error: err?.message };
      }
    }

    if (this.config.provider === "smtp" && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: fromAddress,
          to,
          cc,
          subject,
          text: text || "",
          html,
          attachments: attachments as any,
        });
        return { success: true, messageId: info.messageId, recipient: to, cc, status: "SENT" };
      } catch (err: any) {
        return { success: false, recipient: to, cc, status: "FAILED", error: err?.message };
      }
    }

    if (process.env.NODE_ENV !== "production") {
      return { success: true, messageId: `dev-console-${Date.now()}`, recipient: to, cc, status: "SENT" };
    }

    return {
      success: false,
      recipient: to,
      cc,
      status: "UNAVAILABLE",
      error: USER_FRIENDLY_EMAIL_ERROR,
    };
  }
}

let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

async function recordBookingNotification(input: {
  type: Parameters<EmailService["sendNotificationEvent"]>[0]["type"];
  title: string;
  body: string;
  bookingId: string;
  recipientEmail: string;
}): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.bookingId);
  const [booking] = await db
    .select({ id: bookingsTable.id, userId: bookingsTable.customerId })
    .from(bookingsTable)
    .where(isUuid ? eq(bookingsTable.id, input.bookingId) : eq(bookingsTable.bookingId, input.bookingId))
    .limit(1);

  if (!booking?.userId) return true;

  const [existing] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.userId, booking.userId),
      eq(notificationsTable.bookingId, booking.id),
      eq(notificationsTable.type, input.type),
    ))
    .limit(1);

  if (existing) return false;

  await db.insert(notificationsTable).values({
    userId: booking.userId,
    recipientEmail: input.recipientEmail,
    type: input.type,
    title: input.title,
    body: input.body,
    channel: "in_app",
    status: "RECORDED",
    bookingId: booking.id,
    metadata: { eventKey: `${booking.id}:${input.type}` },
  });
  return true;
}

/**
 * Multi-channel notification dispatcher (Section 17).
 * Dispatches email immediately and marks WhatsApp/SMS as 'coming soon' without faking delivery.
 */
export async function dispatchMultiChannelNotification(input: {
  type: Parameters<EmailService["sendNotificationEvent"]>[0]["type"];
  recipientEmail: string;
  recipientPhone?: string;
  customerName?: string;
  bookingId: string;
  message?: string;
  channels?: Array<"email" | "sms" | "whatsapp">;
}) {
  const channels = input.channels || ["email"];
  const emailService = getEmailService();

  const titles: Record<typeof input.type, string> = {
    BOOKING_RECEIVED: "Booking received",
    PAYMENT_SUCCESSFUL: "Payment successful",
    BOOKING_UNDER_CONFIRMATION: "Booking under confirmation",
    SUPPLIER_CONFIRMATION_RECEIVED: "Supplier confirmation received",
    ACTION_REQUIRED_CUSTOMER: "Action required",
    FINAL_TRIP_CONFIRMED: "Trip fully confirmed",
    VOUCHER_AVAILABLE: "Voucher available",
    UPCOMING_TRIP_REMINDER: "Upcoming trip reminder",
    CANCELLATION_REFUND_UPDATE: "Cancellation and refund update",
    OPERATIONAL_ALERT_OVERDUE: "Supplier task overdue",
  };
  let notificationRecorded = true;
  try {
    notificationRecorded = await recordBookingNotification({
      type: input.type,
      title: titles[input.type],
      body: input.message || `There is an update for booking ${input.bookingId}.`,
      bookingId: input.bookingId,
      recipientEmail: input.recipientEmail,
    });
  } catch (error) {
    console.error("[Notification] Failed to persist in-app event:", error);
  }

  const results: Record<string, { channel: string; status: string; error?: string }> = {};

  if (!notificationRecorded) {
    return { in_app: { channel: "in_app", status: "DUPLICATE" } };
  }

  if (channels.includes("email") && input.recipientEmail) {
    const emailRes = await emailService.sendNotificationEvent(input);
    results.email = {
      channel: "email",
      status: emailRes.status,
      error: emailRes.error,
    };
  }

  if (channels.includes("sms")) {
    results.sms = {
      channel: "sms",
      status: "COMING_SOON",
      error: "SMS gateway provider is currently under integration (coming soon).",
    };
  }

  if (channels.includes("whatsapp")) {
    results.whatsapp = {
      channel: "whatsapp",
      status: "COMING_SOON",
      error: "WhatsApp Business API provider is currently under integration (coming soon).",
    };
  }

  return results;
}

// --------------------------------------------------------------------------
// Email OTP Verification (Resend Integration)
// --------------------------------------------------------------------------

interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a 6-digit verification OTP email to a user using Resend or SMTP.
 */
export async function sendVerificationOtpEmail(
  toEmail: string,
  otp: string,
  fullName?: string | null
): Promise<SendOtpResult> {
  const provider = resolveEmailProvider();
  const name = fullName ? fullName.split(" ")[0] : "Traveller";
  const plainText = `Your Zelevos verification code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zelevos Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .header { background: #0b101e; padding: 28px 32px; text-align: left; }
    .brand { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.04em; text-decoration: none; }
    .brand span { color: #3b82f6; }
    .content { padding: 36px 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
    .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb; }
    .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand"><span>Z</span> Zelevos</div>
    </div>
    <div class="content">
      <h1>Verify Your Email Address</h1>
      <p>Hello ${name},</p>
      <p>Your Zelevos verification code is <strong>${otp}</strong>. It expires in 10 minutes. If you didn't request this, ignore this email.</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">This code will expire in <strong>10 minutes</strong>.</div>
      </div>
      
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        For your security, never share this code with anyone. If you didn't request this verification code, please ignore this email.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Zelevos. Curated Holiday Packages & Travel Marketplace.
    </div>
  </div>
</body>
</html>
  `.trim();

  // 1. Resend Dispatch (Priority 1)
  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY!.trim();
    const fromEmail = getEmailFromAddress("resend");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: "Your Zelevos verification code",
          html: htmlContent,
          text: plainText,
        }),
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        logger.error({ email: maskEmail(toEmail), status: res.status, error: data }, "[Resend API Error]");
        if (process.env.NODE_ENV !== "production") {
          return {
            success: true,
            messageId: `dev-resend-fallback-${Date.now()}`,
          };
        }
        return {
          success: false,
          error: USER_FRIENDLY_EMAIL_ERROR,
        };
      }

      logger.info({ email: maskEmail(toEmail), messageId: data.id }, "[Resend Email Sent Successfully]");
      return {
        success: true,
        messageId: data.id,
      };
    } catch (err: any) {
      logger.error({ err: err instanceof Error ? err.message : err, email: maskEmail(toEmail) }, "[Resend Network Error]");
      if (process.env.NODE_ENV !== "production") {
        return {
          success: true,
          messageId: `dev-network-fallback-${Date.now()}`,
        };
      }
      return {
        success: false,
        error: USER_FRIENDLY_EMAIL_ERROR,
      };
    }
  }

  // 2. SMTP Dispatch (Priority 2)
  if (provider === "smtp") {
    const smtpUser = process.env.SMTP_USER!.trim();
    const smtpPass = process.env.SMTP_PASS!.trim();
    const fromEmail = getEmailFromAddress("smtp");

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || "465"),
        secure: (process.env.SMTP_SECURE || "true").toLowerCase() === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: "Your Zelevos verification code",
        html: htmlContent,
        text: plainText,
      });
      logger.info({ email: maskEmail(toEmail), messageId: info.messageId }, "[SMTP Email Sent Successfully]");
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (smtpErr: any) {
      logger.error({ err: smtpErr, email: maskEmail(toEmail) }, "[SMTP Email Error]");
      if (process.env.NODE_ENV !== "production") {
        return {
          success: true,
          messageId: `dev-smtp-fallback-${Date.now()}`,
        };
      }
      return {
        success: false,
        error: USER_FRIENDLY_EMAIL_ERROR,
      };
    }
  }

  // 3. No Provider Configured
  if (process.env.NODE_ENV !== "production") {
    logger.info({ email: maskEmail(toEmail) }, "[Email Service] Dev console fallback: Verification OTP processed.");
    return {
      success: true,
      messageId: `dev-console-${Date.now()}`,
    };
  }

  logger.error({ email: maskEmail(toEmail) }, "[Email Service] Cannot deliver email: neither RESEND_API_KEY nor SMTP configured.");
  return {
    success: false,
    error: USER_FRIENDLY_EMAIL_ERROR,
  };
}

interface SendResetResult {
  success: boolean;
  messageId?: string;
  error?: string;
  debugResetUrl?: string;
}

/**
 * Sends a password reset link. The reset link is a credential: it is only ever handed back to the
 * caller in explicit local debug mode (NODE_ENV !== "production" AND ALLOW_DEBUG_OTP === "true").
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
  fullName?: string | null
): Promise<SendResetResult> {
  const isDebugAllowed = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEBUG_OTP === "true";
  const isDev = process.env.NODE_ENV !== "production";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = getEmailFromAddress("resend");
  const name = fullName ? fullName.split(" ")[0] : "Traveller";

  if (isDev) {
    console.log(`\n========================================\n[ZELEVOS RESET LINK DISPATCH]\nRecipient: ${toEmail}\nReset URL: ${resetUrl}\n========================================\n`);
  }

  if (!apiKey) {
    if (isDev) {
      logger.info({ email: maskEmail(toEmail) }, "[Email Service] Dev debug reset link generated.");
      return { success: true, debugResetUrl: resetUrl, messageId: `dev-console-${Date.now()}` };
    }
    logger.warn({ email: maskEmail(toEmail) }, "[Email Service] RESEND_API_KEY is not set; password reset e-mail not sent.");
    return { success: false, error: "We couldn't send the password reset email right now. Please try again later." };
  }

  const safeName = name.replace(/[<>&"']/g, "");
  const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset your Zelevos password</title></head>
<body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f8fafc; margin:0; padding:24px;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:32px;">
    <h1 style="font-size:20px; color:#0f172a; margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:14px; line-height:1.6; color:#475569;">Hello ${safeName},</p>
    <p style="font-size:14px; line-height:1.6; color:#475569;">We received a request to reset your Zelevos password. This link works once and expires in 15 minutes.</p>
    <p style="margin:28px 0;"><a href="${resetUrl}" style="background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:10px; font-weight:600; font-size:14px;">Choose a new password</a></p>
    <p style="font-size:12px; color:#64748b;">If the button does not work, copy this address into your browser:<br>${resetUrl}</p>
    <p style="font-size:12px; color:#64748b;">If you did not ask for this, you can ignore this e-mail. Your password stays the same.</p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [toEmail], subject: "Reset your Zelevos password", html: htmlContent }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.warn({ email: maskEmail(toEmail), status: res.status, error: data }, "[Resend API Error] password reset");
      if (isDev) {
        return { success: true, debugResetUrl: resetUrl, error: data.message || "Resend delivery failed." };
      }
      return { success: false, error: "We couldn't send the password reset email right now. Please try again later." };
    }
    logger.info({ email: maskEmail(toEmail), messageId: data.id }, "[Resend Email Sent Successfully] password reset");
    return { success: true, messageId: data.id, ...(isDebugAllowed ? { debugResetUrl: resetUrl } : {}) };
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err, email: maskEmail(toEmail) }, "[Email Service Error] password reset");
    if (isDev) {
      return { success: true, debugResetUrl: resetUrl, error: err instanceof Error ? err.message : "Failed to connect to email provider." };
    }
    return { success: false, error: "We couldn't send the password reset email right now. Please try again later." };
  }
}

export interface SendResetOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a 6-digit password reset OTP email using Resend or SMTP.
 */
export async function sendPasswordResetOtpEmail(
  toEmail: string,
  otp: string,
  fullName?: string | null,
  directToken?: string
): Promise<SendResetOtpResult> {
  const provider = resolveEmailProvider();
  const name = fullName ? fullName.split(" ")[0] : "Traveller";
  const safeName = name.replace(/[<>&"']/g, "");

  const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";
  const linkToken = directToken || otp;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Zelevos password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); }
    .logo { font-size: 20px; font-weight: 800; color: #2563eb; letter-spacing: -0.03em; margin-bottom: 24px; display: inline-block; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; letter-spacing: -0.02em; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .otp-box { margin: 28px 0; padding: 20px; background: #f0f7ff; border: 1.5px dashed #2563eb; border-radius: 12px; text-align: center; }
    .otp-label { font-size: 11px; font-weight: 800; color: #2563eb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ZELEVOS</div>
    <h1>Reset your password</h1>
    <p>Hello ${safeName},</p>
    <p>We received a request to reset your Zelevos account password.</p>
    <div class="otp-box">
      <div class="otp-label">Verification Code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">This code expires in 10 minutes.</div>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${frontendUrl}/reset-password?token=${encodeURIComponent(linkToken)}" class="btn">Reset Password Directly</a>
    </div>
    <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: -12px;">Or enter the 6-digit verification code above into the verification screen.</p>
    <p>If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    <p style="margin-top: 24px;">Regards,<br><strong>Zelevos Team</strong></p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Zelevos. Curated Holiday Packages & Travel Marketplace.
    </div>
  </div>
</body>
</html>`;

  // 1. Resend Dispatch (Priority 1)
  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY!.trim();
    const fromEmail = getEmailFromAddress("resend");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: "Reset your Zelevos password",
          html: htmlContent,
        }),
      });

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn({ email: maskEmail(toEmail), status: res.status, error: data }, "[Resend API Error] Password Reset OTP");
        if (process.env.NODE_ENV !== "production") {
          return { success: true, messageId: `dev-resend-fallback-${Date.now()}` };
        }
        return { success: false, error: "We couldn't send the password reset email right now. Please try again later." };
      }

      logger.info({ email: maskEmail(toEmail), messageId: data.id }, "[Resend Email Sent] Password Reset OTP");
      return {
        success: true,
        messageId: data.id,
      };
    } catch (err: any) {
      logger.error({ err: err instanceof Error ? err.message : err, email: maskEmail(toEmail) }, "[Email Service Error] Password Reset OTP");
      if (process.env.NODE_ENV !== "production") {
        return { success: true, messageId: `dev-network-fallback-${Date.now()}` };
      }
      return { success: false, error: "We couldn't send the password reset email right now. Please try again later." };
    }
  }

  // 2. SMTP Dispatch (Priority 2)
  if (provider === "smtp") {
    const smtpUser = process.env.SMTP_USER!.trim();
    const smtpPass = process.env.SMTP_PASS!.trim();
    const fromEmail = getEmailFromAddress("smtp");

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || "465"),
        secure: (process.env.SMTP_SECURE || "true").toLowerCase() === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: "Reset your Zelevos password",
        html: htmlContent,
      });
      logger.info({ email: maskEmail(toEmail), messageId: info.messageId }, "[SMTP Email Sent] Password Reset OTP");
      return { success: true, messageId: info.messageId };
    } catch (smtpErr: any) {
      logger.error({ err: smtpErr, email: maskEmail(toEmail) }, "[SMTP Email Error] Password Reset OTP");
      if (process.env.NODE_ENV !== "production") {
        return { success: true, messageId: `dev-smtp-fallback-${Date.now()}` };
      }
      return { success: false, error: "We couldn't send the password reset email right now. Please try again later." };
    }
  }

  // 3. No Provider Configured
  if (process.env.NODE_ENV !== "production") {
    logger.info({ email: maskEmail(toEmail) }, "[Email Service] Dev console fallback: Password reset OTP processed.");
    return {
      success: true,
      messageId: `dev-console-${Date.now()}`,
    };
  }

  logger.error({ email: maskEmail(toEmail) }, "[Email Service] Neither RESEND_API_KEY nor SMTP credentials are set.");
  return {
    success: false,
    error: "We couldn't send the password reset email right now. Please try again later.",
  };
}

/**
 * Sends a confirmation email after password reset has succeeded.
 */
export async function sendPasswordResetConfirmationEmail(
  toEmail: string,
  fullName?: string | null
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "Zelevos <onboarding@resend.dev>";
  const name = fullName ? fullName.split(" ")[0] : "Traveller";
  const safeName = name.replace(/[<>&"']/g, "");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Your Zelevos password has been updated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
    <h2 style="color: #0f172a; margin-top: 0;">Password Updated Successfully</h2>
    <p>Hello ${safeName},</p>
    <p>Your Zelevos account password was recently updated.</p>
    <p style="color: #64748b; font-size: 13px;">If you performed this action, no further steps are needed.</p>
    <p style="color: #b91c1c; font-size: 13px; font-weight: 600;">If you did NOT make this change, please contact Zelevos support immediately at support@zelevos.com.</p>
    <p style="margin-top: 24px;">Regards,<br><strong>Zelevos Team</strong></p>
  </div>
</body>
</html>`;

  // Non-blocking fire-and-forget: failure must not roll back password reset
  try {
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || "465"),
        secure: (process.env.SMTP_SECURE || "true").toLowerCase() === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `"Zelevos" <${smtpUser}>`,
        to: toEmail,
        subject: "Your Zelevos password has been updated",
        html: htmlContent,
      });
      return { success: true };
    }

    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: "Your Zelevos password has been updated",
          html: htmlContent,
        }),
      });
      return { success: true };
    }
  } catch (err) {
    logger.warn({ email: maskEmail(toEmail), err }, "Failed to send password reset confirmation email");
  }
  return { success: true };
}

export interface TripFulfillmentEmailParams {
  toEmail: string;
  customerName: string;
  bookingRef: string;
  destination: string;
  travelDate: string;
  components: Array<{
    type: string;
    title: string;
    details: Record<string, any>;
  }>;
  pdfBuffer: Buffer;
}

export async function sendTripFulfillmentEmail(params: TripFulfillmentEmailParams): Promise<EmailSendResult> {
  const subject = `Your Zelevos trip is confirmed — ${params.destination} (${params.travelDate})`;
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "Zelevos <onboarding@resend.dev>";
  const filename = `Zelevos-Trip-Voucher-${params.bookingRef}.pdf`;

  const componentRows = params.components.map((c) => {
    const d = c.details || {};
    let info = "";
    if (c.type === "HOTEL") info = `Hotel: ${d.hotelName || "Confirmed"} · Room: ${d.roomType || "Deluxe"} · Check-in: ${d.checkInDate || params.travelDate} (${d.checkInTime || "14:00"})`;
    else if (c.type === "CAB") info = `Chauffeur: ${d.driverName || "Assigned"} (${d.driverPhone || ""}) · Vehicle: ${d.vehicleModel || ""} (${d.vehicleRegistrationNumber || ""}) · Pickup: ${d.pickupPoint || ""}`;
    else if (c.type === "BUS") info = `Bus: ${d.operatorName || ""} · Reg: ${d.busRegistrationNumber || ""} · Seat: ${d.seatNumbers || ""} · Departure: ${d.departureDateTime || ""}`;
    else if (c.type === "GUIDE") info = `Guide: ${d.guideName || ""} (${d.phone || ""}) · Meeting: ${d.meetingPoint || ""}`;
    else if (c.type === "MEALS") info = `Provider: ${d.providerName || ""} · Meals: ${d.mealsIncluded || ""}`;
    else if (c.type === "FLIGHT") info = `Flight: ${d.airline || ""} ${d.flightNumber || ""} · PNR: ${d.pnr || ""}`;
    else info = JSON.stringify(d);

    return `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;">
        <span style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${c.type}</span>
        <strong style="margin-left: 8px; font-size: 14px; color: #0f172a;">${c.title}</strong>
        <p style="margin: 6px 0 0; font-size: 13px; color: #475569;">${info}</p>
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 800;">ZELEVOS</h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">Trip Confirmation & Official Ground Voucher</p>
    </div>

    <div style="padding: 28px 32px;">
      <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">Your trip is confirmed, ${params.customerName}!</h2>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        All accommodations, chauffeur transfers, and itinerary components for your trip to <strong>${params.destination}</strong> have been finalized and approved. Your official printable Trip Voucher PDF is attached to this email.
      </p>

      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
        <table style="width: 100%; font-size: 13px;">
          <tr>
            <td style="color: #64748b;">Booking Reference:</td>
            <td style="text-align: right; font-weight: 700; color: #1e40af;">${params.bookingRef}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Destination:</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">${params.destination}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Travel Date:</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">${params.travelDate}</td>
          </tr>
        </table>
      </div>

      <h3 style="font-size: 16px; margin: 24px 0 12px; color: #0f172a;">Arrangement Summary</h3>
      ${componentRows}

      <div style="margin-top: 24px; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 13px; color: #166534; line-height: 1.5;">
        <strong>Trip Voucher Attached:</strong> Please keep the attached PDF handy on your phone or print a physical copy for check-in at hotels and driver meetup.
      </div>

      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <strong>24/7 Concierge Support:</strong> 1800-ZELEVOS &middot; ground.support@zelevos.com
      </div>
    </div>
  </div>
</body>
</html>`;

  // 1. Dispatch via Resend if API key is provided
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.toEmail],
          subject,
          html,
          attachments: [
            {
              filename,
              content: params.pdfBuffer.toString("base64"),
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { id?: string };
        logger.info({ to: maskEmail(params.toEmail), messageId: data.id }, "[Email Service] Trip fulfillment email sent via Resend.");
        return { success: true, recipient: params.toEmail, status: "SENT", messageId: data.id };
      } else {
        const errText = await response.text();
        logger.warn({ to: maskEmail(params.toEmail), errText }, "[Email Service] Resend dispatch returned non-200.");
      }
    } catch (err: any) {
      logger.warn({ to: maskEmail(params.toEmail), err: err.message }, "[Email Service] Resend dispatch failed.");
    }
  }

  // 2. Dispatch via SMTP if configured
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || "465"),
        secure: (process.env.SMTP_SECURE || "true").toLowerCase() === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const info = await transporter.sendMail({
        from: `"Zelevos" <${smtpUser}>`,
        to: params.toEmail,
        subject,
        html,
        attachments: [
          {
            filename,
            content: params.pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      logger.info({ to: maskEmail(params.toEmail), messageId: info.messageId }, "[Email Service] Trip fulfillment email sent via SMTP.");
      return { success: true, recipient: params.toEmail, status: "SENT", messageId: info.messageId };
    } catch (err: any) {
      logger.warn({ to: maskEmail(params.toEmail), err: err.message }, "[Email Service] SMTP dispatch failed.");
    }
  }

  // Fallback: development simulation
  logger.info(
    { to: maskEmail(params.toEmail), attachmentBytes: params.pdfBuffer.length, subject },
    "[Email Service] Development fallback: Trip fulfillment email simulated with PDF attachment."
  );
  return {
    success: true,
    recipient: params.toEmail,
    status: "SENT",
    messageId: `dev-sim-${Date.now()}`,
  };
}
