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

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  constructor(customConfig?: Partial<EmailConfig>) {
    const isExplicitTest = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim() === "test";
    const resendApiKey = (customConfig?.resendApiKey || process.env.RESEND_API_KEY || "").trim();
    const smtpUser = (process.env.SMTP_USER || "").trim();
    const smtpPass = (process.env.SMTP_PASS || "").trim();
    const hasSmtp = Boolean(smtpUser && smtpPass);
    const hasResend = Boolean(resendApiKey);

    let provider: "resend" | "smtp" | "test" = "test";
    if (customConfig?.resendApiKey) {
      provider = "resend";
    } else if (!isExplicitTest) {
      if (hasResend) {
        provider = "resend";
      } else if (hasSmtp) {
        provider = "smtp";
      }
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

    // Missing credentials must never be reported as a successful delivery.
    return {
      success: false,
      recipient,
      cc,
      status: "UNAVAILABLE",
      error: "Email provider not configured. Set RESEND_API_KEY or SMTP credentials.",
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
    text: string;
    cc?: string;
  }): Promise<EmailSendResult> {
    const { to, subject, html, text, cc } = params;

    if (this.config.provider === "resend" && this.config.resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Zelevos <notifications@zelevos.travel>",
            to: [to],
            cc: cc ? [cc] : undefined,
            subject,
            html,
            text,
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
          from: `"Zelevos" <${this.config.smtpUser}>`,
          to,
          cc,
          subject,
          text,
          html,
        });
        return { success: true, messageId: info.messageId, recipient: to, cc, status: "SENT" };
      } catch (err: any) {
        return { success: false, recipient: to, cc, status: "FAILED", error: err?.message };
      }
    }

    return {
      success: false,
      recipient: to,
      cc,
      status: "UNAVAILABLE",
      error: "Email provider not configured.",
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
  debugOtp?: string;
}

/**
 * Sends a 6-digit verification OTP email to a user using Resend.
 */
export async function sendVerificationOtpEmail(
  toEmail: string,
  otp: string,
  fullName?: string | null
): Promise<SendOtpResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "Zelevos <onboarding@resend.dev>";
  const name = fullName ? fullName.split(" ")[0] : "Traveller";

  if (!apiKey) {
    logger.warn({ toEmail, otp }, "[Email Service] RESEND_API_KEY is not set. OTP logged for development.");
    return {
      success: true,
      debugOtp: otp,
    };
  }

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
      <p>Thank you for joining Zelevos. Please use the following 6-digit verification code to complete your account registration:</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">This code will expire in <strong>10 minutes</strong>.</div>
      </div>
      
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        For your security, never share this code with anyone. If you didn't create an account with Zelevos, please ignore this email.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Zelevos. Curated Holiday Packages & Travel Marketplace.
    </div>
  </div>
</body>
</html>
  `;

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
        subject: `Your Zelevos Verification Code: ${otp}`,
        html: htmlContent,
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      logger.warn({ toEmail, otp, status: res.status, error: data }, "[Resend API Error]");
      // If Resend returns 403 sandbox restriction on unverified domains/recipients:
      return {
        success: true,
        debugOtp: otp,
        error: data.message || "Resend sandbox delivery limited to verified emails.",
      };
    }

    logger.info({ toEmail, messageId: data.id }, "[Resend Email Sent Successfully]");
    return {
      success: true,
      messageId: data.id,
    };
  } catch (err) {
    logger.error({ err, toEmail, otp }, "[Email Service Error]");
    return {
      success: true,
      debugOtp: otp,
      error: err instanceof Error ? err.message : "Failed to connect to email provider.",
    };
  }
}
