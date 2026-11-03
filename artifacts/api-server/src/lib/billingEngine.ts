// ==============================================================================
// THINKATIC BPO GLOBAL DELIVERY PLATFORM — BILLING & FINANCIAL CALCULATION ENGINE
// Server-side deterministic financial calculations, exact decimal arithmetic,
// authoritative source aggregation, tax computation, and security sanitization.
// AI IS STRICTLY FORBIDDEN FROM MAKING AUTHORITATIVE FINANCIAL DECISIONS.
// ==============================================================================

import Decimal from "decimal.js";

// Configure standard enterprise commercial rounding (HALF_UP, 28-digit precision)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export interface BillableItemInput {
  description: string;
  quantity: number | string | Decimal;
  unitPrice: number | string | Decimal;
  billingUnit?: "hour" | "unit" | "seat" | "fixed" | "item";
  projectId?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  sourceReference?: string | null;
}

export interface CalculatedLineItem {
  sortOrder: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  billingUnit: "hour" | "unit" | "seat" | "fixed" | "item";
  projectId?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  sourceReference?: string | null;
}

export interface InvoiceTotalsResult {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  adjustmentsTotal: number;
  total: number;
  balanceDue: number;
  items: CalculatedLineItem[];
}

export interface PayoutCalculationInput {
  partnerId: string;
  centreId: number;
  projectId?: number | null;
  projectName?: string | null;
  periodStart: string;
  periodEnd: string;
  billableUnits: number | string | Decimal;
  unitType: "hour" | "unit" | "seat" | "fixed";
  unitRate: number | string | Decimal;
  adjustmentsAmount?: number | string | Decimal;
  deductionsAmount?: number | string | Decimal;
  currency?: Currency;
  sourceRecordsSummary?: Record<string, any>;
}

export interface CalculatedPayoutResult {
  partnerId: string;
  centreId: number;
  projectId?: number | null;
  projectName?: string | null;
  periodStart: string;
  periodEnd: string;
  billableUnits: number;
  unitType: "hour" | "unit" | "seat" | "fixed";
  unitRate: number;
  grossAmount: number;
  adjustmentsAmount: number;
  deductionsAmount: number;
  netAmount: number;
  currency: Currency;
  sourceRecordsSummary: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXACT DECIMAL CURRENCY & MONEY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely converts any numeric, string, or Decimal representation into a safe Decimal instance.
 */
export function toDecimal(val: unknown, fallback: number | string | Decimal = "0"): Decimal {
  if (val instanceof Decimal) return val;
  if (val === null || val === undefined || val === "") return new Decimal(fallback);
  try {
    const d = new Decimal(String(val).trim());
    return d.isFinite() ? d : new Decimal(fallback);
  } catch {
    return new Decimal(fallback);
  }
}

/**
 * Rounds any monetary value to exact 2 decimal places using Decimal.ROUND_HALF_UP.
 * Eliminates binary floating point precision artifacts.
 */
export function roundMoney(amount: number | string | Decimal): number {
  return toDecimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Formats any monetary value as a normalized 2-decimal-place currency string (e.g. "1250.50").
 */
export function roundMoneyStr(amount: number | string | Decimal): string {
  return toDecimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Safely parses and validates a positive monetary decimal.
 * Returns null if invalid or negative (or zero when allowZero is false).
 */
export function parseMoney(val: unknown, allowZero = true): number | null {
  if (val === null || val === undefined || val === "") return null;
  try {
    const d = new Decimal(String(val).trim());
    if (!d.isFinite()) return null;
    if (d.isNegative()) return null;
    if (!allowZero && d.isZero()) return null;
    return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return null;
  }
}

/**
 * Parses and returns a Decimal instance with exact 2 decimal places.
 */
export function parseMoneyDecimal(val: unknown, allowZero = true): Decimal | null {
  if (val === null || val === undefined || val === "") return null;
  try {
    const d = new Decimal(String(val).trim());
    if (!d.isFinite()) return null;
    if (d.isNegative()) return null;
    if (!allowZero && d.isZero()) return null;
    return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } catch {
    return null;
  }
}

/**
 * Exact decimal addition: a + b
 */
export function addMoney(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).plus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact decimal subtraction: a - b
 */
export function subMoney(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).minus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact decimal multiplication: a * b
 */
export function mulMoney(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).times(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact decimal division: a / b
 */
export function divMoney(a: number | string | Decimal, b: number | string | Decimal): number {
  const divisor = toDecimal(b);
  if (divisor.isZero()) return 0;
  return toDecimal(a).dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact decimal maximum
 */
export function maxMoney(...values: (number | string | Decimal)[]): number {
  if (values.length === 0) return 0;
  const decimals = values.map((v) => toDecimal(v));
  return Decimal.max(...decimals).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact decimal minimum
 */
export function minMoney(...values: (number | string | Decimal)[]): number {
  if (values.length === 0) return 0;
  const decimals = values.map((v) => toDecimal(v));
  return Decimal.min(...decimals).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Extracts a numeric hourly or unit rate from a commercial contract string.
 * Example: "$16.00 / hour / agent" -> 16.00
 *          "$14.00 - $18.00 / hour" -> 16.00 (midpoint or base)
 */
export function parseRateFromString(rateStr: string | undefined | null, fallback = 15.0): number {
  if (!rateStr) return fallback;
  const matches = rateStr.match(/\$?(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return fallback;
  if (matches.length === 1) {
    const clean = matches[0].replace("$", "");
    const d = toDecimal(clean, fallback);
    return d.isFinite() && d.greaterThan(0) ? roundMoney(d) : fallback;
  }
  // If range "$14.00 - $18.00", take midpoint
  const r1 = toDecimal(matches[0].replace("$", ""), fallback);
  const r2 = toDecimal(matches[1].replace("$", ""), fallback);
  if (r1.isFinite() && r2.isFinite() && r1.greaterThan(0) && r2.greaterThan(0)) {
    return r1.plus(r2).dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }
  return r1.isFinite() && r1.greaterThan(0) ? roundMoney(r1) : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INVOICE CALCULATION ENGINE (DECIMAL-SAFE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates complete invoice totals server-side using arbitrary precision Decimal arithmetic.
 * Never trusts subtotals, tax amounts, or totals received from frontend.
 *
 * Formulas:
 *   Line Total: quantity * unit_price
 *   Subtotal: sum(line totals)
 *   Tax Amount: subtotal * tax_rate
 *   Total: max(0, subtotal + tax + adjustments - discounts)
 *   Balance Due: max(0, total - amount_paid)
 */
export function calculateInvoiceTotals(
  rawItems: BillableItemInput[],
  options: {
    taxRate?: number | string | Decimal;
    discountAmount?: number | string | Decimal;
    adjustmentsTotal?: number | string | Decimal;
    amountPaid?: number | string | Decimal;
  } = {}
): InvoiceTotalsResult {
  const rawTax = toDecimal(options.taxRate ?? 0);
  const taxRateDecimal = rawTax.greaterThan(1)
    ? Decimal.max(0, Decimal.min(1, rawTax.dividedBy(100)))
    : Decimal.max(0, Decimal.min(1, rawTax));
  const taxRate = taxRateDecimal.toNumber();

  const discountAmount = Decimal.max(0, toDecimal(options.discountAmount ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  const adjustmentsTotal = toDecimal(options.adjustmentsTotal ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const amountPaid = Decimal.max(0, toDecimal(options.amountPaid ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));

  let subtotalDecimal = new Decimal(0);
  const items: CalculatedLineItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const rawQty = toDecimal(raw.quantity ?? 1);
    const qty = Decimal.max(new Decimal("0.001"), rawQty.abs());
    const price = Decimal.max(0, toDecimal(raw.unitPrice ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    const lineTotal = qty.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    subtotalDecimal = subtotalDecimal.plus(lineTotal);

    items.push({
      sortOrder: i + 1,
      description: String(raw.description || `Billing Item ${i + 1}`).trim().slice(0, 500),
      quantity: qty.toNumber(),
      unitPrice: price.toNumber(),
      lineTotal: lineTotal.toNumber(),
      billingUnit: raw.billingUnit || "hour",
      projectId: raw.projectId ?? null,
      periodStart: raw.periodStart ?? null,
      periodEnd: raw.periodEnd ?? null,
      sourceReference: raw.sourceReference ?? null,
    });
  }

  const subtotal = subtotalDecimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const taxAmount = subtotal.times(taxRateDecimal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const rawTotal = subtotal.plus(taxAmount).plus(adjustmentsTotal).minus(discountAmount);
  const total = Decimal.max(0, rawTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const balanceDue = Decimal.max(0, total.minus(amountPaid)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    subtotal: subtotal.toNumber(),
    taxRate,
    taxAmount: taxAmount.toNumber(),
    discountAmount: discountAmount.toNumber(),
    adjustmentsTotal: adjustmentsTotal.toNumber(),
    total: total.toNumber(),
    balanceDue: balanceDue.toNumber(),
    items,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CENTRE PAYOUT CALCULATION ENGINE (DECIMAL-SAFE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates deterministic centre earnings and payout statements using Decimal arithmetic.
 * Formulas:
 *   Gross Amount: billable_units * unit_rate
 *   Net Payout: max(0, gross + adjustments - deductions)
 */
export function calculateCentrePayout(input: PayoutCalculationInput): CalculatedPayoutResult {
  const rawUnits = toDecimal(input.billableUnits ?? 0);
  const billableUnits = Decimal.max(0, rawUnits.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  const unitRate = Decimal.max(0, toDecimal(input.unitRate ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  const grossAmount = billableUnits.times(unitRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const adjustmentsAmount = toDecimal(input.adjustmentsAmount ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const deductionsAmount = Decimal.max(0, toDecimal(input.deductionsAmount ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));

  const rawNet = grossAmount.plus(adjustmentsAmount).minus(deductionsAmount);
  const netAmount = Decimal.max(0, rawNet).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    partnerId: input.partnerId,
    centreId: input.centreId,
    projectId: input.projectId ?? null,
    projectName: input.projectName ?? null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    billableUnits: billableUnits.toNumber(),
    unitType: input.unitType,
    unitRate: unitRate.toNumber(),
    grossAmount: grossAmount.toNumber(),
    adjustmentsAmount: adjustmentsAmount.toNumber(),
    deductionsAmount: deductionsAmount.toNumber(),
    netAmount: netAmount.toNumber(),
    currency: input.currency || "USD",
    sourceRecordsSummary: input.sourceRecordsSummary || {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIFECYCLE & STATUS TRANSITION VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "void", "cancelled"],
  issued: ["partially_paid", "paid", "overdue", "void", "cancelled"],
  partially_paid: ["paid", "overdue", "void"],
  overdue: ["partially_paid", "paid", "void"],
  paid: ["void"], // only via exceptional audited void/refund
  void: [],
  cancelled: [],
};

export function isValidInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_INVOICE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export const PAYOUT_STATUSES = [
  "pending",
  "approved",
  "processing",
  "paid",
  "failed",
  "on_hold",
  "disputed",
  "cancelled",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

const VALID_PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["approved", "on_hold", "disputed", "cancelled"],
  approved: ["processing", "on_hold", "disputed", "cancelled"],
  processing: ["paid", "failed", "on_hold", "disputed"],
  on_hold: ["pending", "approved", "disputed", "cancelled"],
  disputed: ["pending", "approved", "processing", "on_hold", "cancelled"],
  failed: ["pending", "cancelled"],
  paid: [],
  cancelled: [],
};

export function isValidPayoutTransition(from: PayoutStatus, to: PayoutStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_PAYOUT_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export const DISPUTE_STATUSES = ["open", "under_review", "resolved", "rejected"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

const VALID_DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["under_review", "resolved", "rejected"],
  under_review: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};

export function isValidDisputeTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_DISPUTE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECURITY & ANTI-FORMULA CSV INJECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes any field to prevent Spreadsheet Formula Injection (CSV Injection).
 * Any cell value starting with '=', '+', '-', '@', tab, or carriage return
 * is prefixed with a single quote (') so spreadsheets treat it strictly as text.
 */
export function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();
  if (str.length > 0) {
    const firstChar = str[0];
    if (firstChar === "=" || firstChar === "+" || firstChar === "-" || firstChar === "@" || firstChar === "\t" || firstChar === "\r") {
      str = `'${str}`;
    }
  }
  // Escape embedded double quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds a valid RFC 4180 CSV string with anti-formula injection sanitization.
 */
export function buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map((h) => sanitizeCsvField(h)).join(",");
  const dataLines = rows.map((row) => row.map((cell) => sanitizeCsvField(cell)).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}
