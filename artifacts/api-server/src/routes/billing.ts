import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import Decimal from "decimal.js";
import { supabase, plansRepository } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { requireUserAuth } from "./user.js";
import {
  Client,
  CheckoutPaymentIntent,
  Environment,
  LogLevel,
  OrdersController,
} from "@paypal/paypal-server-sdk";

import {
  getMaskedAccountForCurrency,
  getFullAccountForCurrency,
  getAllAdminAccounts,
  updateBankAccount,
  createBankAccount,
  auditBankAccountEvent,
  type SupportedCurrency,
} from "../lib/bankAccounts.js";

// Billing-specific PayPal controller — independent of the plan-purchase paypal.ts
// (paypal.ts must NOT be modified per project constraints)
let _billingOrdersController: OrdersController | undefined;
function getBillingPayPalController(): OrdersController {
  if (_billingOrdersController) return _billingOrdersController;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal is not configured");
  const env = (process.env.PAYPAL_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "sandbox")).toLowerCase();
  if (env !== "production" && env !== "sandbox") throw new Error("Invalid PAYPAL_ENVIRONMENT");
  const ppClient = new Client({
    clientCredentialsAuthCredentials: { oAuthClientId: clientId, oAuthClientSecret: clientSecret },
    timeout: 0,
    environment: env === "production" ? Environment.Production : Environment.Sandbox,
    logging: { logLevel: LogLevel.Info, logRequest: { logBody: false }, logResponse: { logHeaders: false } },
  });
  _billingOrdersController = new OrdersController(ppClient);
  return _billingOrdersController;
}

const router: IRouter = Router();

// ─── Constants ────────────────────────────────────────────────────────────────
const INVOICE_STATUSES = ["draft", "sent", "pending_payment", "partially_paid", "paid", "overdue", "cancelled", "refunded"] as const;
const PAYABLE_STATUSES: string[] = ["sent", "pending_payment", "partially_paid", "overdue"];
const EDITABLE_STATUSES: string[] = ["draft"];
const SENDABLE_STATUSES: string[] = ["draft"];
const CANCELLABLE_STATUSES: string[] = ["draft", "sent", "pending_payment", "partially_paid", "overdue"];
const PAYMENT_METHODS = ["paypal", "manual", "bank_transfer", "wallet", "other"] as const;
const CURRENCIES = ["USD"] as const; // extend when multi-currency is needed

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message, message });
}

function numId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function safeDecimal(value: unknown, allowZero = true): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (!allowZero && n <= 0) return null;
  if (n < 0) return null;
  return n;
}

async function billingModuleGuard(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data } = await supabase.from("module_settings").select("enabled").eq("module_key", "billing").maybeSingle();
    if (data?.enabled === false) return fail(res, 503, "Billing is currently disabled");
    return next();
  } catch {
    return res.status(500).json({ error: "Unable to verify billing module" });
  }
}

async function clientBillingGuard(req: UserRequest, res: Response, next: NextFunction) {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", req.user!.id).maybeSingle();
  if (error) return res.status(500).json({ error: "Unable to verify billing access" });
  if (data?.role === "partner" || data?.role === "bpo_partner") return fail(res, 403, "Partner users cannot access client billing data");
  return next();
}

async function audit(
  actor: { userId?: string; adminId?: number },
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from("audit_logs").insert({
    actor_user_id: actor.userId ?? null,
    actor_admin_id: actor.adminId ?? null,
    action,
    entity_type: "invoice",
    entity_id: entityId,
    metadata,
  }).throwOnError();
}

async function notifyUser(userId: string, type: string, title: string, body: string, entityId: string) {
  await supabase.from("notifications").insert({
    recipient_user_id: userId,
    type,
    title,
    body,
    entity_type: "invoice",
    entity_id: entityId,
  });
}

async function notifyAdmins(type: string, title: string, body: string, entityId: string) {
  const { data } = await supabase.from("admin_users").select("id");
  if (data?.length) {
    await supabase.from("notifications").insert(
      data.map((a: any) => ({
        recipient_admin_id: a.id,
        type,
        title,
        body,
        entity_type: "invoice",
        entity_id: entityId,
      }))
    );
  }
}

// Recalculate invoice totals server-side (calls the DB function + Decimal.js precision synchronization)
async function recalcTotals(invoiceId: number) {
  try {
    await supabase.rpc("recalculate_invoice_totals", { p_invoice_id: invoiceId });
  } catch (e) {
    console.warn("[billing] RPC recalculate_invoice_totals notice:", e);
  }

  // Authoritative Decimal.js synchronization
  try {
    const { data: inv } = await supabase.from("invoices").select("id,tax_rate,discount_amount,amount_paid").eq("id", invoiceId).maybeSingle();
    const { data: items } = await supabase.from("invoice_items").select("quantity,unit_price").eq("invoice_id", invoiceId);
    if (inv && items) {
      let subtotalDec = new Decimal(0);
      for (const it of items) {
        const q = new Decimal(it.quantity || 0);
        const u = new Decimal(it.unit_price || 0);
        subtotalDec = subtotalDec.plus(q.times(u));
      }
      const taxRateDec = new Decimal(inv.tax_rate || 0);
      const discountDec = new Decimal(inv.discount_amount || 0);
      const paidDec = new Decimal(inv.amount_paid || 0);
      const taxAmountDec = subtotalDec.times(taxRateDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const totalDec = Decimal.max(0, subtotalDec.plus(taxAmountDec).minus(discountDec)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const balanceDec = Decimal.max(0, totalDec.minus(paidDec)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      await supabase.from("invoices").update({
        subtotal: subtotalDec.toNumber(),
        tax_amount: taxAmountDec.toNumber(),
        total: totalDec.toNumber(),
        balance_due: balanceDec.toNumber(),
        updated_at: new Date().toISOString(),
      }).eq("id", invoiceId);
    }
  } catch (syncErr) {
    console.warn("[billing] Decimal precision sync notice:", syncErr);
  }
}

// Mark overdue invoices (called on every list fetch)
async function markOverdue() {
  await supabase.rpc("mark_overdue_invoices");
}

// Fetch a complete invoice (with items + payments) scoped to a client
async function getClientInvoice(invoiceId: number, clientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), invoice_payments(*), invoice_receipts(*)")
    .eq("id", invoiceId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Fetch a complete invoice (admin — no client scope)
async function getAdminInvoice(invoiceId: number) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), invoice_payments(*), invoice_receipts(*)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Strip internal_notes from a client-facing invoice object
function clientSafeInvoice(inv: any) {
  if (!inv) return inv;
  const { internal_notes: _internal, ...safe } = inv;
  return safe;
}

// Thinkatic Official Corporate Information (authoritative project configuration)
const THINKATIC_COMPANY_INFO = {
  companyName: "Thinkatic",
  legalName: "Thinkatic AI Agency",
  tagline: "Global AI & Autonomous Delivery Platform",
  email: "Thinkaticai@gmail.com",
  phone: "+91 72638 74459",
  website: "https://thinkatic.com",
  address: "Tower B, Magarpatta City, Hadapsar, Pune – 411028",
  jurisdiction: "Pune, Maharashtra, India",
};

// Authoritative joined SQL query for complete receipt records
const RECEIPT_SELECT_QUERY = `
  id,
  receipt_number,
  invoice_id,
  payment_id,
  client_id,
  amount,
  currency,
  created_at,
  document_id,
  invoices (
    id,
    invoice_number,
    invoice_date,
    due_date,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    amount_paid,
    status,
    purchase_id,
    notes,
    invoice_items (
      id,
      description,
      quantity,
      unit_price,
      line_total
    )
  ),
  invoice_payments (
    id,
    payment_method,
    gateway,
    gateway_order_id,
    gateway_capture_id,
    status,
    paid_at,
    notes
  ),
  profiles (
    id,
    full_name,
    email,
    role,
    selected_plan,
    bpo_application_details
  )
`;

// Format an authoritative receipt record with all required client, purchase, payment & company metadata
async function formatClientReceipt(row: any) {
  const invoice = row.invoices || {};
  const payment = row.invoice_payments || {};
  const profile = row.profiles || {};
  const item = (invoice.invoice_items && invoice.invoice_items[0]) || {};

  let purchase: any = null;
  if (invoice.purchase_id) {
    try {
      const { data: p } = await supabase.from("purchases").select("*").eq("id", invoice.purchase_id).maybeSingle();
      purchase = p;
    } catch {}
  }

  const packageId = purchase?.package_id || profile.selected_plan || "";
  let plan: any = null;
  if (packageId) {
    try {
      plan = await plansRepository.getByServiceId(packageId);
    } catch {}
  }

  const createdAtDate = new Date(row.created_at || payment.paid_at || Date.now());
  const paymentDate = createdAtDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const paymentTime = createdAtDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const appDetails = (profile.bpo_application_details || {});

  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    invoiceId: row.invoice_id,
    invoiceNumber: invoice.invoice_number || `INV-${row.invoice_id}`,
    paymentId: row.payment_id,
    transactionId: payment.gateway_capture_id || payment.gateway_order_id || purchase?.paypal_capture_id || `TXN-${row.id}`,
    paymentDate,
    paymentTime,
    paymentTimestamp: row.created_at,
    paymentStatus: "PAID",
    paymentMethod: payment.payment_method === "paypal" ? "PayPal (Verified Capture)" : (payment.payment_method || "Electronic Transfer"),
    currency: row.currency || "USD",
    amountPaid: Number(row.amount),
    subtotal: Number(invoice.subtotal || row.amount),
    taxRate: Number(invoice.tax_rate || 0),
    taxAmount: Number(invoice.tax_amount || 0),
    totalAmount: Number(row.amount),
    purchase: {
      packageId: purchase?.package_id || plan?.serviceId || "enterprise-service",
      packageName: purchase?.package_name || plan?.name || (item.description ? item.description.replace(/ Package$/, "") : "AI Enterprise Plan"),
      packageCategory: plan?.category || "AI Solutions",
      packageDescription: plan?.description || item.description || "Thinkatic Enterprise Service Plan",
      billingType: plan?.billingInterval === "monthly" ? "Subscription (Monthly)" : "One-Time Payment",
      billingPeriod: plan?.deliveryTimeline || "Standard Delivery",
      orderReference: payment.gateway_order_id || purchase?.paypal_order_id || invoice.invoice_number || `ORD-${row.id}`,
    },
    client: {
      id: profile.id || row.client_id,
      name: profile.full_name || "Enterprise Client",
      companyName: appDetails.companyName || profile.full_name || "Enterprise Client Co.",
      email: profile.email || "—",
      phone: appDetails.phone || "—",
      country: appDetails.country || "Global",
      accountStatus: profile.account_status || "Active",
    },
    company: THINKATIC_COMPANY_INFO,
  };
}

// Generate a unique sequential receipt number: THK-RCPT-YYYY-XXXXXX
async function makeReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { count } = await supabase
      .from("invoice_receipts")
      .select("id", { count: "exact", head: true });

    const { data: latestThk } = await supabase
      .from("invoice_receipts")
      .select("receipt_number")
      .ilike("receipt_number", `THK-RCPT-${year}-%`)
      .order("receipt_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextVal = (count || 0) + 1;
    if (latestThk?.receipt_number) {
      const match = latestThk.receipt_number.match(/THK-RCPT-\d{4}-(\d+)/);
      if (match) {
        nextVal = Math.max(nextVal, parseInt(match[1], 10) + 1);
      }
    }
    return `THK-RCPT-${year}-${String(nextVal).padStart(6, "0")}`;
  } catch {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `THK-RCPT-${year}-${rand}`;
  }
}

// After a payment is recorded as successful, recalculate amount_paid on the invoice
// and transition status accordingly, then create a receipt idempotently
async function finalizePayment(invoiceId: number, paymentId: number, amount: number, clientId: string) {
  // Sum all successful payments
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("status", "successful");

  const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const { data: inv } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("id", invoiceId)
    .single();

  if (!inv) return;

  const total = Number(inv.total);
  let newStatus: string;
  if (totalPaid >= total) {
    newStatus = "paid";
  } else if (totalPaid > 0) {
    newStatus = "partially_paid";
  } else {
    newStatus = inv.status;
  }

  const paidAt = newStatus === "paid" ? new Date().toISOString() : undefined;

  await supabase
    .from("invoices")
    .update({
      amount_paid: totalPaid,
      status: newStatus,
      ...(paidAt ? { paid_at: paidAt } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  // Check if receipt already exists for this invoice (idempotent)
  const { data: existingReceipt } = await supabase
    .from("invoice_receipts")
    .select("id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (!existingReceipt) {
    // Create receipt for this payment with collision retry
    let receiptNumber = await makeReceiptNumber();
    for (let i = 0; i < 5; i++) {
      const { data: receipt, error: rErr } = await supabase
        .from("invoice_receipts")
        .insert({
          receipt_number: receiptNumber,
          invoice_id: invoiceId,
          payment_id: paymentId,
          client_id: clientId,
          amount,
          currency: "USD",
        })
        .select()
        .single();
      if (!rErr && receipt) break;
      const rand = Math.floor(100000 + Math.random() * 900000);
      receiptNumber = `THK-RCPT-${new Date().getFullYear()}-${rand}`;
    }
  }

  return newStatus;
}

// ─── User / Client Routes ─────────────────────────────────────────────────────

// GET /invoices — list client's own invoices
router.get("/invoices", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    await markOverdue();
    let query = supabase
      .from("invoices")
      .select("id,invoice_number,project_id,invoice_date,due_date,currency,subtotal,tax_amount,discount_amount,total,amount_paid,balance_due,status,sent_at,paid_at,notes,created_at")
      .eq("client_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (typeof req.query.status === "string" && INVOICE_STATUSES.includes(req.query.status as any)) {
      query = query.eq("status", req.query.status);
    }
    if (typeof req.query.projectId === "string" && numId(req.query.projectId)) {
      query = query.eq("project_id", numId(req.query.projectId)!);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load invoices", details: e?.message });
  }
});

// GET /invoices/summary — billing summary cards for the client
router.get("/invoices/summary", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    await markOverdue();
    const { data, error } = await supabase
      .from("invoices")
      .select("total,amount_paid,balance_due,status")
      .eq("client_id", req.user!.id);
    if (error) throw error;

    const rows = data || [];
    const summary = {
      totalBilled: 0,
      totalPaid: 0,
      totalPending: 0,
      totalOverdue: 0,
      outstandingBalance: 0,
      invoiceCount: rows.length,
    };

    for (const r of rows) {
      const total = Number(r.total);
      const paid = Number(r.amount_paid);
      const balance = Number(r.balance_due);
      if (r.status !== "cancelled" && r.status !== "draft") {
        summary.totalBilled += total;
        summary.totalPaid += paid;
      }
      if (r.status === "overdue") summary.totalOverdue += balance;
      if (["sent", "pending_payment", "partially_paid"].includes(r.status)) summary.totalPending += balance;
      if (!["cancelled", "paid", "refunded", "draft"].includes(r.status)) summary.outstandingBalance += balance;
    }

    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load billing summary", details: e?.message });
  }
});

// GET /invoices/:id — invoice detail (client)
router.get("/invoices/:id", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");
    res.json(clientSafeInvoice(inv));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load invoice", details: e?.message });
  }
});

// GET /invoices/:id/payments — payment history for an invoice (client)
router.get("/invoices/:id/payments", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");
    // IDOR: verify ownership first
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");

    const { data, error } = await supabase
      .from("invoice_payments")
      .select("id,amount,currency,payment_method,gateway,gateway_order_id,reference,status,paid_at,notes,created_at")
      .eq("invoice_id", invoiceId)
      .eq("client_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load payment history", details: e?.message });
  }
});

// GET /invoices/:id/receipts — receipts for an invoice (client)
router.get("/invoices/:id/receipts", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");

    const { data: rows, error } = await supabase
      .from("invoice_receipts")
      .select(RECEIPT_SELECT_QUERY)
      .eq("invoice_id", invoiceId)
      .eq("client_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const receipts = await Promise.all((rows || []).map(formatClientReceipt));
    res.json(receipts);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load receipts", details: e?.message });
  }
});

// GET /receipts or /client/receipts — list all authoritative payment receipts for authenticated client
router.get(["/receipts", "/client/receipts"], requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const { data: rows, error } = await supabase
      .from("invoice_receipts")
      .select(RECEIPT_SELECT_QUERY)
      .eq("client_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const receipts = await Promise.all((rows || []).map(formatClientReceipt));
    res.json({
      success: true,
      receipts,
      data: receipts,
    });
  } catch (e: any) {
    console.error("[billing] Error fetching client payment receipts:", e);
    res.status(500).json({ error: "Failed to load payment receipts", details: e?.message });
  }
});

// GET /receipts/:id — single detailed receipt (client Anti-IDOR protected)
router.get("/receipts/:id", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const receiptId = numId(req.params.id);
    if (!receiptId) return fail(res, 400, "Invalid receipt ID");
    const { data: row, error } = await supabase
      .from("invoice_receipts")
      .select(RECEIPT_SELECT_QUERY)
      .eq("id", receiptId)
      .eq("client_id", req.user!.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) return fail(res, 404, "Receipt not found");

    const receipt = await formatClientReceipt(row);
    res.json({
      success: true,
      receipt,
      data: receipt,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load receipt", details: e?.message });
  }
});

// GET /invoices/:id/bank-details — retrieve masked bank transfer details for authorized invoice
router.get("/invoices/:id/bank-details", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    // Strict Anti-IDOR: Client can only access bank details for their own invoice
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");

    const requestedCurrency = typeof req.query.currency === "string" ? req.query.currency.toUpperCase() : (inv.currency || "USD");
    const maskedAccount = getMaskedAccountForCurrency(requestedCurrency);

    return res.json({
      success: true,
      invoice: {
        id: inv.id,
        invoice_number: inv.invoice_number,
        currency: inv.currency,
        total: Number(inv.total),
        balance_due: Number(inv.balance_due),
        status: inv.status,
        payment_reference: inv.invoice_number,
      },
      supported_currencies: ["USD", "GBP", "EUR", "INR"],
      selected_currency: requestedCurrency,
      bank_account: maskedAccount,
      reference_notice: `Please include Payment Reference ${inv.invoice_number} in your bank transfer narration/remarks.`,
      status_notice: "Payment status will remain Pending / Awaiting Payment until our Finance team confirms receipt of funds in the bank ledger.",
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load bank details", details: e?.message });
  }
});

// POST /invoices/:id/bank-details/reveal — reveal full unmasked bank account for authorized client wire transfer
router.post("/invoices/:id/bank-details/reveal", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    // Strict Anti-IDOR: Verify invoice ownership
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");

    const currency = typeof req.body?.currency === "string" ? req.body.currency.toUpperCase() : (inv.currency || "USD");

    const fullAccount = getFullAccountForCurrency(currency);
    if (!fullAccount) {
      if (currency === "INR") {
        return fail(res, 404, "INR payment account details are currently unavailable. Please contact Thinkatic Finance.");
      }
      return fail(res, 404, `No active bank account configured for currency ${currency}`);
    }

    // AUDIT: Record that authorized user viewed full details (NEVER log raw account numbers)
    await auditBankAccountEvent({
      actorUserId: req.user!.id,
      action: "bank_account_full_details_viewed",
      currency,
      invoiceId: inv.id,
      metadata: {
        invoiceNumber: inv.invoice_number,
        bankName: fullAccount.bankName,
      },
    });

    return res.json({
      success: true,
      currency: fullAccount.currency,
      bank_name: fullAccount.bankName,
      bank_address: fullAccount.bankAddress,
      beneficiary: fullAccount.beneficiary,
      account_type: fullAccount.accountType,
      account_number: fullAccount.accountNumber,
      routing_aba: fullAccount.routingAba,
      swift: fullAccount.swift,
      sort_code: fullAccount.sortCode,
      iban: fullAccount.iban,
      bic: fullAccount.bic,
      payment_reference: inv.invoice_number,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to reveal bank details", details: e?.message });
  }
});

// POST /invoices/:id/bank-details/copy-audit — record copy event for security audit
router.post("/invoices/:id/bank-details/copy-audit", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");

    const currency = typeof req.body?.currency === "string" ? req.body.currency.toUpperCase() : (inv.currency || "USD");

    await auditBankAccountEvent({
      actorUserId: req.user!.id,
      action: "bank_account_details_copied",
      currency,
      invoiceId: inv.id,
      metadata: {
        invoiceNumber: inv.invoice_number,
      },
    });

    res.json({ success: true });
  } catch {
    res.json({ success: true }); // non-blocking
  }
});

// POST /invoices/:id/pay/paypal — initiate a PayPal payment for an invoice
router.post("/invoices/:id/pay/paypal", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    // IDOR + ownership
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");
    if (!PAYABLE_STATUSES.includes(inv.status)) return fail(res, 409, `Invoice cannot be paid in status: ${inv.status}`);
    if (Number(inv.balance_due) <= 0) return fail(res, 409, "Invoice balance is already zero");
    if (inv.currency !== "USD") return fail(res, 422, "Only USD invoices can be paid via PayPal");

    // Amount to pay — either full balance_due or partial amount from body
    const bodyAmount = safeDecimal(req.body?.amount, false);
    const payableAmount = bodyAmount !== null
      ? Math.min(bodyAmount, Number(inv.balance_due))
      : Number(inv.balance_due);

    if (payableAmount <= 0) return fail(res, 400, "Payment amount must be greater than zero");
    if (payableAmount > Number(inv.balance_due)) return fail(res, 422, "Payment amount exceeds invoice balance");

    // Try to use PayPal
    let ordersController: OrdersController;
    try {
      ordersController = getBillingPayPalController();
    } catch {
      return fail(res, 503, "PayPal is not configured. Please use manual payment or contact support.");
    }

    const { body: orderBody, statusCode } = await ordersController.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [{
          customId: `inv-${inv.id}`,
          description: `Invoice ${inv.invoice_number}`,
          amount: {
            currencyCode: "USD",
            value: payableAmount.toFixed(2),
          },
        }],
      },
      prefer: "return=representation",
    });

    const order = typeof orderBody === "string" ? JSON.parse(orderBody) : orderBody;
    if (!order?.id) return fail(res, 502, "PayPal did not return an order ID");

    // Create initiated payment record
    const { data: payment, error: pErr } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoiceId,
        client_id: req.user!.id,
        amount: payableAmount,
        currency: "USD",
        payment_method: "paypal",
        gateway: "paypal",
        gateway_order_id: order.id,
        status: "initiated",
      })
      .select()
      .single();
    if (pErr) throw pErr;

    await audit({ userId: req.user!.id }, "payment_initiated", String(invoiceId), {
      paymentId: payment.id,
      orderId: order.id,
      amount: payableAmount,
    });

    res.status(statusCode ?? 201).json({
      orderId: order.id,
      paymentId: payment.id,
      amount: payableAmount.toFixed(2),
      currency: "USD",
    });
  } catch (e: any) {
    console.error("[billing] PayPal initiate error:", e?.message);
    res.status(502).json({ error: "Unable to initiate payment. Please try again.", details: e?.message });
  }
});

// POST /invoices/:id/pay/paypal/:orderId/capture — capture a PayPal payment for an invoice
router.post("/invoices/:id/pay/paypal/:orderId/capture", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    if (!invoiceId || !orderId) return fail(res, 400, "Invalid invoice or order ID");

    // IDOR
    const inv = await getClientInvoice(invoiceId, req.user!.id);
    if (!inv) return fail(res, 404, "Invoice not found");

    // Find the pending payment record — must belong to this invoice + client + orderId
    const { data: payment, error: pErr } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("client_id", req.user!.id)
      .eq("gateway_order_id", orderId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!payment) return fail(res, 404, "Payment record not found");

    // Idempotency — already captured
    if (payment.status === "successful") {
      return res.json({ success: true, status: "successful", paymentId: payment.id, alreadyCaptured: true });
    }
    if (payment.status === "failed" || payment.status === "cancelled") {
      return fail(res, 409, `Payment is already in status: ${payment.status}`);
    }

    let ordersController: OrdersController;
    try {
      ordersController = getBillingPayPalController();
    } catch {
      return fail(res, 503, "PayPal is not configured");
    }

    // Verify the PayPal order before capturing
    const { body: orderBody } = await ordersController.getOrder({ id: orderId });
    const approvedOrder = typeof orderBody === "string" ? JSON.parse(orderBody) : orderBody;
    const unit = approvedOrder?.purchase_units?.[0];

    if (
      approvedOrder?.status !== "APPROVED" ||
      unit?.custom_id !== `inv-${inv.id}` ||
      unit?.amount?.value !== Number(payment.amount).toFixed(2) ||
      unit?.amount?.currency_code !== "USD"
    ) {
      await supabase.from("invoice_payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
      return fail(res, 409, "Payment order verification failed");
    }

    // Capture
    const { body: captureBody } = await ordersController.captureOrder({ id: orderId, prefer: "return=representation" });
    const captured = typeof captureBody === "string" ? JSON.parse(captureBody) : captureBody;
    const captureUnit = captured?.purchase_units?.[0];
    const captureRecord = captureUnit?.payments?.captures?.[0];

    if (
      captured?.status !== "COMPLETED" ||
      captureRecord?.status !== "COMPLETED" ||
      captureUnit?.custom_id !== `inv-${inv.id}` ||
      captureRecord?.amount?.value !== Number(payment.amount).toFixed(2) ||
      captureRecord?.amount?.currency_code !== "USD"
    ) {
      await supabase.from("invoice_payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
      await audit({ userId: req.user!.id }, "payment_failed", String(invoiceId), { paymentId: payment.id, orderId });
      await notifyUser(req.user!.id, "payment_failed", "Payment failed", `Payment for invoice ${inv.invoice_number} could not be completed`, String(invoiceId));
      return fail(res, 502, "Payment capture verification failed");
    }

    // Mark payment successful
    const now = new Date().toISOString();
    await supabase.from("invoice_payments").update({
      status: "successful",
      gateway_capture_id: captureRecord.id,
      paid_at: now,
      updated_at: now,
    }).eq("id", payment.id);

    // Update invoice totals + status + create receipt
    const newStatus = await finalizePayment(invoiceId, payment.id, Number(payment.amount), req.user!.id);

    await audit({ userId: req.user!.id }, "payment_successful", String(invoiceId), {
      paymentId: payment.id,
      amount: payment.amount,
      captureId: captureRecord.id,
    });

    await notifyUser(req.user!.id, "payment_successful", "Payment successful", `Payment of $${Number(payment.amount).toFixed(2)} received for invoice ${inv.invoice_number}`, String(invoiceId));
    await notifyAdmins("payment_received", "Payment received", `$${Number(payment.amount).toFixed(2)} received for invoice ${inv.invoice_number}`, String(invoiceId));

    res.json({
      success: true,
      status: "successful",
      paymentId: payment.id,
      captureId: captureRecord.id,
      amount: Number(payment.amount).toFixed(2),
      invoiceStatus: newStatus,
    });
  } catch (e: any) {
    console.error("[billing] PayPal capture error:", e?.message);
    res.status(502).json({ error: "Payment capture failed. Please contact support.", details: e?.message });
  }
});

// GET /billing/payments — payment history across all invoices for authenticated client
router.get("/billing/payments", requireUserAuth, clientBillingGuard, billingModuleGuard, async (req: UserRequest, res) => {
  try {
    const { data, error } = await supabase
      .from("invoice_payments")
      .select("id,invoice_id,amount,currency,payment_method,gateway,gateway_order_id,reference,status,paid_at,notes,created_at,invoices(invoice_number)")
      .eq("client_id", req.user!.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load payment history", details: e?.message });
  }
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /admin/invoices — list all invoices with filters
router.get("/admin/invoices", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    await markOverdue();
    let query = supabase
      .from("invoices")
      .select("id,invoice_number,client_id,project_id,invoice_date,due_date,currency,subtotal,tax_amount,discount_amount,total,amount_paid,balance_due,status,sent_at,paid_at,created_at,created_by_admin_id")
      .order("created_at", { ascending: false });

    if (typeof req.query.clientId === "string") query = query.eq("client_id", req.query.clientId);
    if (typeof req.query.projectId === "string" && numId(req.query.projectId)) query = query.eq("project_id", numId(req.query.projectId)!);
    if (typeof req.query.status === "string" && INVOICE_STATUSES.includes(req.query.status as any)) query = query.eq("status", req.query.status);
    if (typeof req.query.search === "string" && req.query.search.trim()) query = query.ilike("invoice_number", `%${req.query.search.trim()}%`);
    if (typeof req.query.from === "string") query = query.gte("invoice_date", req.query.from);
    if (typeof req.query.to === "string") query = query.lte("invoice_date", req.query.to);

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load invoices", details: e?.message });
  }
});

// GET /admin/invoices/metrics — billing dashboard metrics
router.get("/admin/invoices/metrics", requireAuth, billingModuleGuard, async (_req: AdminRequest, res) => {
  try {
    await markOverdue();
    const { data, error } = await supabase
      .from("invoices")
      .select("total,amount_paid,balance_due,status");
    if (error) throw error;

    const rows = data || [];
    let totalInvoicedDec = new Decimal(0);
    let totalCollectedDec = new Decimal(0);
    let pendingAmountDec = new Decimal(0);
    let overdueAmountDec = new Decimal(0);
    let partiallyPaidCount = 0;
    let draftCount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let cancelledCount = 0;

    for (const r of rows) {
      const total = new Decimal(r.total || 0);
      const paid = new Decimal(r.amount_paid || 0);
      const balance = new Decimal(r.balance_due ?? (total.minus(paid).toNumber()) ?? 0);

      if (!["draft", "cancelled"].includes(r.status)) {
        totalInvoicedDec = totalInvoicedDec.plus(total);
      }
      if (["paid", "partially_paid"].includes(r.status)) {
        totalCollectedDec = totalCollectedDec.plus(paid);
      }
      if (["sent", "pending_payment", "partially_paid"].includes(r.status)) {
        pendingAmountDec = pendingAmountDec.plus(balance);
        pendingCount++;
      }
      if (r.status === "overdue") {
        overdueAmountDec = overdueAmountDec.plus(balance);
        pendingAmountDec = pendingAmountDec.plus(balance);
        overdueCount++;
      }
      if (r.status === "partially_paid") partiallyPaidCount++;
      if (r.status === "draft") draftCount++;
      if (r.status === "paid") paidCount++;
      if (r.status === "cancelled") cancelledCount++;
    }

    // Recent payments
    const { data: recentPayments } = await supabase
      .from("invoice_payments")
      .select("id,invoice_id,client_id,amount,currency,payment_method,status,paid_at,created_at,invoices(invoice_number)")
      .eq("status", "successful")
      .order("paid_at", { ascending: false })
      .limit(10);

    // Failed payments
    const { data: failedPayments } = await supabase
      .from("invoice_payments")
      .select("id,invoice_id,client_id,amount,currency,payment_method,status,created_at,invoices(invoice_number)")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(10);

    // Partner Payouts total and count
    const { data: payoutRows } = await supabase
      .from("bpo_payout_statements")
      .select("payable_amount,paid_amount,pending_amount,status");

    let totalPayoutsDec = new Decimal(0);
    let pendingPayoutsDec = new Decimal(0);
    const payoutCount = (payoutRows || []).length;
    for (const p of payoutRows || []) {
      totalPayoutsDec = totalPayoutsDec.plus(new Decimal(p.paid_amount || p.payable_amount || 0));
      if (p.status === "pending" || p.status === "approved" || p.status === "processing") {
        pendingPayoutsDec = pendingPayoutsDec.plus(new Decimal(p.pending_amount || p.payable_amount || 0));
      }
    }

    // Disputes count & amount
    const { data: disputeRows } = await supabase
      .from("financial_disputes")
      .select("disputed_amount, status")
      .in("status", ["open", "under_review"]);

    let disputedAmountDec = new Decimal(0);
    for (const d of disputeRows || []) {
      disputedAmountDec = disputedAmountDec.plus(new Decimal(d.disputed_amount || 0));
    }
    const disputeCount = (disputeRows || []).length;
    const disputedAmount = disputedAmountDec.toDecimalPlaces(2).toNumber();

    const totalInvoiced = totalInvoicedDec.toDecimalPlaces(2).toNumber();
    const totalCollected = totalCollectedDec.toDecimalPlaces(2).toNumber();
    const pendingAmount = pendingAmountDec.toDecimalPlaces(2).toNumber();
    const overdueAmount = overdueAmountDec.toDecimalPlaces(2).toNumber();
    const totalPayouts = totalPayoutsDec.toDecimalPlaces(2).toNumber();
    const pendingPayouts = pendingPayoutsDec.toDecimalPlaces(2).toNumber();

    const metricsPayload = {
      totalInvoiced,
      totalCollected,
      totalPaid: totalCollected, // alias for frontend compatibility
      pendingAmount,
      totalOutstanding: pendingAmount, // alias for frontend compatibility
      overdueAmount,
      totalOverdue: overdueAmount, // alias for frontend compatibility
      totalCount: rows.length,
      paidCount,
      pendingCount,
      overdueCount,
      partiallyPaidCount,
      draftCount,
      cancelledCount,
      totalPayouts,
      pendingPayouts,
      payoutCount,
      disputeCount: disputeCount || 0,
      disputedAmount,
      recentPayments: recentPayments || [],
      failedPayments: failedPayments || [],
    };

    res.json({
      success: true,
      metrics: metricsPayload,
      data: metricsPayload,
      ...metricsPayload,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load billing metrics", details: e?.message });
  }
});

// GET /admin/invoices/report — billing report with filters
router.get("/admin/invoices/report", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    await markOverdue();
    let invQuery = supabase
      .from("invoices")
      .select("id,invoice_number,client_id,project_id,invoice_date,due_date,total,amount_paid,balance_due,status,currency");

    if (typeof req.query.clientId === "string") invQuery = invQuery.eq("client_id", req.query.clientId);
    if (typeof req.query.projectId === "string" && numId(req.query.projectId)) invQuery = invQuery.eq("project_id", numId(req.query.projectId)!);
    if (typeof req.query.status === "string" && INVOICE_STATUSES.includes(req.query.status as any)) invQuery = invQuery.eq("status", req.query.status);
    if (typeof req.query.from === "string") invQuery = invQuery.gte("invoice_date", req.query.from);
    if (typeof req.query.to === "string") invQuery = invQuery.lte("invoice_date", req.query.to);

    const { data: invoices, error } = await invQuery.order("invoice_date", { ascending: false }).limit(500);
    if (error) throw error;

    const rows = invoices || [];
    const totals = {
      invoicedAmount: rows.reduce((s, r) => s + Number(r.total), 0),
      collectedAmount: rows.reduce((s, r) => s + Number(r.amount_paid), 0),
      outstandingAmount: rows.filter(r => !["paid","cancelled","refunded"].includes(r.status)).reduce((s, r) => s + Number(r.balance_due), 0),
      overdueAmount: rows.filter(r => r.status === "overdue").reduce((s, r) => s + Number(r.balance_due), 0),
    };

    res.json({ totals, invoices: rows });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to generate billing report", details: e?.message });
  }
});

// GET /admin/invoices/:id — full invoice detail (admin)
router.get("/admin/invoices/:id", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");
    const inv = await getAdminInvoice(invoiceId);
    if (!inv) return fail(res, 404, "Invoice not found");
    res.json(inv);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load invoice", details: e?.message });
  }
});

// POST /admin/invoices — create a new invoice
router.post("/admin/invoices", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const body = req.body ?? {};
    const clientId = body.clientId || body.client_id;
    const projectId = body.projectId !== undefined ? body.projectId : body.project_id;
    const invoiceDate = body.invoiceDate || body.invoice_date;
    const dueDate = body.dueDate || body.due_date;
    const currency = (body.currency || "USD").toUpperCase();
    const taxRate = body.taxRate !== undefined ? body.taxRate : body.tax_rate;
    const discountAmount = body.discountAmount !== undefined ? body.discountAmount : (body.discount !== undefined ? body.discount : 0);
    const {
      notes,
      terms,
      internalNotes,
      items = [],
      lineItems = [],
      relatedTicketId,
      purchaseId,
    } = body;

    // Validate client
    if (typeof clientId !== "string" || !clientId) return fail(res, 400, "Client ID is required");
    const { data: clientProfile } = await supabase.from("profiles").select("id,full_name,email").eq("id", clientId).maybeSingle();
    if (!clientProfile) return fail(res, 404, "Client not found");

    // Validate dates
    if (!invoiceDate || !dueDate) return fail(res, 400, "Invoice date and due date are required");
    if (new Date(dueDate) < new Date(invoiceDate)) return fail(res, 400, "Due date must be on or after invoice date");

    // Validate currency
    if (!CURRENCIES.includes(currency as any)) return fail(res, 422, "Only USD invoices are supported");

    // Validate and normalize tax rate (handles both 20 as 20% and 0.2 as 20%)
    const rawTax = safeDecimal(taxRate ?? 0);
    if (rawTax === null) return fail(res, 400, "Tax rate must be a non-negative number");
    const taxRateNum = rawTax > 1 ? rawTax / 100 : rawTax;
    if (taxRateNum < 0 || taxRateNum > 1) return fail(res, 400, "Tax rate must be between 0% and 100%");

    const discountNum = safeDecimal(discountAmount);
    if (discountNum === null) return fail(res, 400, "Discount must be a non-negative number");

    // Validate items
    const rawItems = (Array.isArray(items) && items.length > 0) ? items : (Array.isArray(lineItems) && lineItems.length > 0 ? lineItems : []);
    if (!Array.isArray(rawItems) || rawItems.length === 0) return fail(res, 400, "At least one line item is required");
    for (const item of rawItems) {
      if (!item.description?.trim()) return fail(res, 400, "Each line item must have a description");
      if (safeDecimal(item.quantity, false) === null) return fail(res, 400, "Each line item must have a positive quantity");
      const uPrice = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
      if (safeDecimal(uPrice) === null) return fail(res, 400, "Each line item must have a valid unit price");
    }

    // Validate project ownership & associate if explicitly assigned by Admin
    if (projectId) {
      const projId = numId(projectId);
      if (!projId) return fail(res, 400, "Invalid project ID");
      const { data: project } = await supabase.from("projects").select("id,client_id").eq("id", projId).maybeSingle();
      if (!project) return fail(res, 404, "Project not found");
      if (project.client_id !== clientId) {
        // Admin authorization: link or update project's client_id to the selected client
        await supabase.from("projects").update({ client_id: clientId }).eq("id", projId);
      }
    }

    // Create the invoice (totals will be calculated below)
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        client_id: clientId,
        project_id: numId(projectId) ?? null,
        related_ticket_id: numId(relatedTicketId) ?? null,
        purchase_id: numId(purchaseId) ?? null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        currency,
        tax_rate: taxRateNum,
        discount_amount: discountNum,
        notes: notes?.trim() || null,
        terms: terms?.trim() || null,
        internal_notes: internalNotes?.trim() || null,
        status: "draft",
        created_by_admin_id: req.admin!.id,
        updated_by_admin_id: req.admin!.id,
      })
      .select()
      .single();
    if (invErr) throw invErr;

    // Insert line items
    const itemRows = rawItems.map((item: any, index: number) => {
      const q = Number(item.quantity) || 1;
      const u = Number(item.unitPrice !== undefined ? item.unitPrice : item.unit_price) || 0;
      return {
        invoice_id: invoice.id,
        sort_order: index,
        description: String(item.description).trim(),
        quantity: q,
        unit_price: u,
        line_total: Math.round(q * u * 100) / 100,
      };
    });
    const { error: itemErr } = await supabase.from("invoice_items").insert(itemRows);
    if (itemErr) throw itemErr;

    // Server-side total recalculation via DB function & Decimal.js sync
    await recalcTotals(invoice.id);

    const created = await getAdminInvoice(invoice.id);
    await audit({ adminId: req.admin!.id }, "invoice_created", String(invoice.id), {
      clientId,
      invoiceNumber: invoice.invoice_number,
    });

    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create invoice", details: e?.message });
  }
});

// PATCH /admin/invoices/:id — edit a draft invoice
router.patch("/admin/invoices/:id", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    const { data: existing } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!existing) return fail(res, 404, "Invoice not found");
    if (!EDITABLE_STATUSES.includes(existing.status)) return fail(res, 409, `Cannot edit invoice in status: ${existing.status}`);

    const { dueDate, invoiceDate, taxRate, discountAmount, notes, terms, internalNotes, items } = req.body ?? {};

    const patch: Record<string, unknown> = { updated_by_admin_id: req.admin!.id };
    if (invoiceDate !== undefined) patch.invoice_date = invoiceDate;
    if (dueDate !== undefined) {
      const effectiveInvoiceDate = invoiceDate ?? existing.invoice_date;
      if (new Date(dueDate) < new Date(effectiveInvoiceDate)) return fail(res, 400, "Due date must be on or after invoice date");
      patch.due_date = dueDate;
    }
    if (taxRate !== undefined) {
      const r = safeDecimal(taxRate);
      if (r === null || r > 1) return fail(res, 400, "Tax rate must be between 0 and 1");
      patch.tax_rate = r;
    }
    if (discountAmount !== undefined) {
      const d = safeDecimal(discountAmount);
      if (d === null) return fail(res, 400, "Discount must be non-negative");
      patch.discount_amount = d;
    }
    if (notes !== undefined) patch.notes = notes?.trim() || null;
    if (terms !== undefined) patch.terms = terms?.trim() || null;
    if (internalNotes !== undefined) patch.internal_notes = internalNotes?.trim() || null;

    const { error: invoiceUpdateError } = await supabase.from("invoices").update(patch).eq("id", invoiceId);
    if (invoiceUpdateError) throw invoiceUpdateError;

    // Replace line items if provided
    if (Array.isArray(items)) {
      if (items.length === 0) return fail(res, 400, "At least one line item is required");
      for (const item of items) {
        if (!item.description?.trim()) return fail(res, 400, "Each item must have a description");
        if (safeDecimal(item.quantity, false) === null) return fail(res, 400, "Each item must have a positive quantity");
        if (safeDecimal(item.unitPrice) === null) return fail(res, 400, "Each item must have a valid unit price");
      }
      const { error: deleteItemsError } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
      if (deleteItemsError) throw deleteItemsError;
      const { error: insertItemsError } = await supabase.from("invoice_items").insert(
        items.map((item: any, i: number) => ({
          invoice_id: invoiceId,
          sort_order: i,
          description: String(item.description).trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
          line_total: Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100,
        }))
      );
      if (insertItemsError) throw insertItemsError;
    }

    await recalcTotals(invoiceId);
    const updated = await getAdminInvoice(invoiceId);
    await audit({ adminId: req.admin!.id }, "invoice_updated", String(invoiceId), { changes: Object.keys(patch) });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to update invoice", details: e?.message });
  }
});

// POST /admin/invoices/:id/send — send a draft invoice to the client
router.post("/admin/invoices/:id/send", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    const { data: existing } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!existing) return fail(res, 404, "Invoice not found");
    if (!SENDABLE_STATUSES.includes(existing.status)) return fail(res, 409, `Invoice is already in status: ${existing.status}`);
    if (Number(existing.total) <= 0) return fail(res, 422, "Cannot send an invoice with zero total");

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: now,
        updated_by_admin_id: req.admin!.id,
        updated_at: now,
      })
      .eq("id", invoiceId)
      .select()
      .single();
    if (error) throw error;

    await notifyUser(
      existing.client_id,
      "invoice_sent",
      "New invoice",
      `Invoice ${existing.invoice_number} for $${Number(existing.total).toFixed(2)} is ready for payment. Due: ${existing.due_date}`,
      String(invoiceId)
    );

    await audit({ adminId: req.admin!.id }, "invoice_sent", String(invoiceId), { invoiceNumber: existing.invoice_number });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to send invoice", details: e?.message });
  }
});

// POST /admin/invoices/:id/cancel — cancel an invoice
router.post("/admin/invoices/:id/cancel", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    const { data: existing } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!existing) return fail(res, 404, "Invoice not found");
    if (!CANCELLABLE_STATUSES.includes(existing.status)) return fail(res, 409, `Cannot cancel invoice in status: ${existing.status}`);

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : null;
    const now = new Date().toISOString();
    await supabase.from("invoices").update({
      status: "cancelled",
      cancelled_at: now,
      cancellation_reason: reason,
      updated_by_admin_id: req.admin!.id,
      updated_at: now,
    }).eq("id", invoiceId);

    await notifyUser(
      existing.client_id,
      "invoice_cancelled",
      "Invoice cancelled",
      `Invoice ${existing.invoice_number} has been cancelled`,
      String(invoiceId)
    );

    await audit({ adminId: req.admin!.id }, "invoice_cancelled", String(invoiceId), { reason });
    res.json({ success: true, invoiceId, status: "cancelled" });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to cancel invoice", details: e?.message });
  }
});

// POST /admin/invoices/:id/payments — record a manual / offline payment
router.post("/admin/invoices/:id/payments", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");

    const { data: existing } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!existing) return fail(res, 404, "Invoice not found");
    if (!PAYABLE_STATUSES.includes(existing.status)) return fail(res, 409, `Invoice cannot receive payments in status: ${existing.status}`);
    if (Number(existing.balance_due) <= 0) return fail(res, 409, "Invoice balance is already zero");

    const amount = safeDecimal(req.body?.amount, false);
    if (amount === null) return fail(res, 400, "Payment amount must be a positive number");
    if (amount > Number(existing.balance_due)) return fail(res, 422, `Amount ($${amount}) exceeds balance due ($${existing.balance_due})`);

    const paymentMethod = req.body?.paymentMethod ?? "manual";
    if (!PAYMENT_METHODS.includes(paymentMethod)) return fail(res, 400, "Invalid payment method");
    const reference = typeof req.body?.reference === "string" ? req.body.reference.trim() || null : null;
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() || null : null;

    const { data: payment, error: pErr } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoiceId,
        client_id: existing.client_id,
        amount,
        currency: existing.currency,
        payment_method: paymentMethod,
        reference,
        status: "successful",
        paid_at: new Date().toISOString(),
        recorded_by_admin_id: req.admin!.id,
        notes,
      })
      .select()
      .single();
    if (pErr) throw pErr;

    const newStatus = await finalizePayment(invoiceId, payment.id, amount, existing.client_id);

    await notifyUser(
      existing.client_id,
      "payment_recorded",
      "Payment recorded",
      `A payment of $${amount.toFixed(2)} has been recorded for invoice ${existing.invoice_number}`,
      String(invoiceId)
    );
    await audit({ adminId: req.admin!.id }, "manual_payment_recorded", String(invoiceId), {
      paymentId: payment.id,
      amount,
      paymentMethod,
    });

    res.status(201).json({ payment, invoiceStatus: newStatus });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to record payment", details: e?.message });
  }
});

// GET /admin/invoices/:id/payments — all payments for an invoice (admin)
router.get("/admin/invoices/:id/payments", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const invoiceId = numId(req.params.id);
    if (!invoiceId) return fail(res, 400, "Invalid invoice ID");
    const inv = await getAdminInvoice(invoiceId);
    if (!inv) return fail(res, 404, "Invoice not found");

    const { data, error } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load payments", details: e?.message });
  }
});

// GET /admin/payments — all payments across all invoices
router.get("/admin/payments", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    let query = supabase
      .from("invoice_payments")
      .select("id,invoice_id,client_id,amount,currency,payment_method,gateway,reference,status,paid_at,created_at,invoices(invoice_number)")
      .order("created_at", { ascending: false });

    if (typeof req.query.status === "string") query = query.eq("status", req.query.status);
    if (typeof req.query.clientId === "string") query = query.eq("client_id", req.query.clientId);
    if (typeof req.query.method === "string") query = query.eq("payment_method", req.query.method);

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load payments", details: e?.message });
  }
});

// GET /admin/receipts — list all receipts (admin)
router.get("/admin/receipts", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    let query = supabase
      .from("invoice_receipts")
      .select(RECEIPT_SELECT_QUERY)
      .order("created_at", { ascending: false });

    if (typeof req.query.clientId === "string") {
      query = query.eq("client_id", req.query.clientId);
    }
    const { data: rows, error } = await query;
    if (error) throw error;

    const receipts = await Promise.all((rows || []).map(formatClientReceipt));
    res.json({ success: true, receipts, data: receipts });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load admin receipts", details: e?.message });
  }
});

// GET /admin/receipts/:id — get a receipt (admin)
router.get("/admin/receipts/:id", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const receiptId = numId(req.params.id);
    if (!receiptId) return fail(res, 400, "Invalid receipt ID");
    const { data: row, error } = await supabase
      .from("invoice_receipts")
      .select(RECEIPT_SELECT_QUERY)
      .eq("id", receiptId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return fail(res, 404, "Receipt not found");
    const receipt = await formatClientReceipt(row);
    res.json({ success: true, receipt, data: receipt });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load receipt", details: e?.message });
  }
});

// GET /admin/billing/client/:clientId — full billing history for a specific client
router.get("/admin/billing/client/:clientId", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const clientId = req.params.clientId;
    if (!clientId) return fail(res, 400, "Client ID required");

    await markOverdue();
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,project_id,invoice_date,due_date,total,amount_paid,balance_due,status,currency,sent_at,paid_at,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: payments } = await supabase
      .from("invoice_payments")
      .select("id,invoice_id,amount,currency,payment_method,status,paid_at,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);

    const summary = {
      totalInvoiced: (invoices || []).filter(i => i.status !== "draft" && i.status !== "cancelled").reduce((s, i) => s + Number(i.total), 0),
      totalPaid: (invoices || []).reduce((s, i) => s + Number(i.amount_paid), 0),
      outstanding: (invoices || []).filter(i => !["paid","cancelled","refunded","draft"].includes(i.status)).reduce((s, i) => s + Number(i.balance_due), 0),
    };

    res.json({ summary, invoices: invoices || [], payments: payments || [] });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load client billing history", details: e?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BANK ACCOUNT MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /admin/bank-accounts — list all bank accounts configured for wire transfer
router.get(["/admin/bank-accounts", "/admin/billing/bank-accounts"], requireAuth, billingModuleGuard, async (_req: AdminRequest, res) => {
  try {
    const rawAccounts = getAllAdminAccounts();
    const accounts = rawAccounts.map((a: any) => ({
      ...a,
      beneficiary: a.beneficiary || "HEALWEAL LLC",
      beneficiaryName: a.beneficiary || "HEALWEAL LLC",
      beneficiary_name: a.beneficiary || "HEALWEAL LLC",
    }));
    res.json({
      success: true,
      bank_accounts: accounts,
      data: accounts,
      accounts: accounts,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load admin bank accounts", details: e?.message });
  }
});

// PATCH /admin/bank-accounts/:id — update or toggle bank account status
router.patch("/admin/bank-accounts/:id", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};
    const isActive = body.isActive !== undefined ? body.isActive : body.is_active;
    const { bankName, bankAddress, beneficiary, routingAba, swift, sortCode, iban, bic, accountType, unavailableMessage, notes } = body;

    const updated = updateBankAccount(id, {
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(bankName ? { bankName } : {}),
      ...(bankAddress ? { bankAddress } : {}),
      ...(beneficiary ? { beneficiary } : {}),
      ...(routingAba !== undefined ? { routingAba } : {}),
      ...(swift !== undefined ? { swift } : {}),
      ...(sortCode !== undefined ? { sortCode } : {}),
      ...(iban !== undefined ? { iban } : {}),
      ...(bic !== undefined ? { bic } : {}),
      ...(accountType !== undefined ? { accountType } : {}),
      ...(unavailableMessage !== undefined ? { unavailableMessage } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });

    if (!updated) return fail(res, 404, "Bank account not found");

    await auditBankAccountEvent({
      actorAdminId: req.admin?.id,
      action: typeof isActive === "boolean" ? "bank_account_status_changed" : "bank_account_updated",
      currency: updated.currency,
      metadata: {
        accountId: id,
        isActive: updated.isActive,
      },
    });

    const accountWithAliases = {
      ...updated,
      beneficiary: updated.beneficiary || "HEALWEAL LLC",
      beneficiaryName: updated.beneficiary || "HEALWEAL LLC",
      beneficiary_name: updated.beneficiary || "HEALWEAL LLC",
    };

    res.json({
      success: true,
      bank_account: accountWithAliases,
      account: accountWithAliases,
      data: accountWithAliases,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to update bank account", details: e?.message });
  }
});

// POST /admin/bank-accounts — create a new bank account (e.g. when approved INR account is configured)
router.post("/admin/bank-accounts", requireAuth, billingModuleGuard, async (req: AdminRequest, res) => {
  try {
    const { currency, bankName, bankAddress, beneficiary, accountNumber, routingAba, swift, sortCode, iban, bic, accountType, isActive, isVerified } = req.body || {};
    if (!currency || !bankName || !beneficiary) {
      return fail(res, 400, "Currency, bankName, and beneficiary are required");
    }

    const created = createBankAccount({
      currency: currency.toUpperCase(),
      bankName,
      bankAddress: bankAddress || "",
      beneficiary,
      accountNumber: accountNumber || "",
      routingAba,
      swift,
      sortCode,
      iban,
      bic,
      accountType: accountType || "CHECKING",
      isActive: !!isActive,
      isVerified: !!isVerified,
    });

    await auditBankAccountEvent({
      actorAdminId: req.admin?.id,
      action: "bank_account_created",
      currency: created.currency,
      metadata: {
        accountId: created.id,
        bankName: created.bankName,
      },
    });

    res.status(201).json({ success: true, bank_account: created });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create bank account", details: e?.message });
  }
});

export default router;
