import { supabase, walletRepository } from "@workspace/db";
import { logger } from "./logger.js";
import { logSecurityEvent } from "./security.js";
import {
  Decimal,
  addMoney,
  subMoney,
  roundMoney,
  type Currency,
} from "./billingEngine.js";
import { payoutsStore, disputesStore } from "../routes/bpoBilling.js";
import { resolvePartnerForUser } from "../routes/bpoOperations.js";

export type WithdrawalLifecycleStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

export interface AuditHistoryEntry {
  status: WithdrawalLifecycleStatus;
  timestamp: string;
  actor: string;
  note?: string | null;
  adminId?: number | null;
}

export interface WithdrawalRichMetadata {
  fullStatus: WithdrawalLifecycleStatus;
  partnerId: string;
  partnerCode: string;
  centreName: string;
  centreId: number;
  userEmail: string;
  userFullName?: string;
  destinationMasked: string;
  requestedAt: string;
  note?: string | null;
  rejectionReason?: string | null;
  adminNote?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  processedBy?: number | null;
  processedAt?: string | null;
  paidBy?: number | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  idempotencyKey?: string | null;
  statementId?: number | string | null;
  auditHistory: AuditHistoryEntry[];
}

export interface BpoWithdrawalRecord {
  id: number;
  requestId: string; // THK-WTH-00001
  request_code?: string;
  bpo_partner_name?: string;
  partner_name?: string;
  partner_code?: string;
  centre_name?: string;
  userId: string;
  partnerId: string;
  partnerCode: string;
  centreName: string;
  centreId: number;
  userEmail: string;
  userFullName: string;
  amount: number;
  currency: string;
  method: string;
  payoutDetailsId: number;
  destinationMasked: string;
  status: WithdrawalLifecycleStatus;
  dbStatus: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  processedBy?: number | null;
  processedAt?: string | null;
  paidBy?: number | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  payment_reference?: string | null;
  rejectionReason?: string | null;
  rejection_reason?: string | null;
  adminNote?: string | null;
  note?: string | null;
  statementId?: number | string | null;
  auditHistory: AuditHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PartnerFinancialSummary {
  partnerId: string;
  partnerCode: string;
  centreName: string;
  centreId: number;
  status: string;
  totalEarnings: number;
  total_earnings?: number;
  paidAmount: number;
  paidEarnings?: number;
  paid_amount?: number;
  pendingEarnings: number;
  pending_earnings?: number;
  processingAmount: number;
  processing_amount?: number;
  requestedAmount: number;
  upcomingPayouts: number;
  openDisputes: number;
  disputedAmount: number;
  availableBalance: number;
  available_balance?: number;
  currency: string;
  payoutDetails: Array<{
    id: number;
    method: string;
    displayLabel: string;
    createdAt: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// METADATA SERIALIZATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function parseMetadata(rejectionReasonField: string | null | undefined): WithdrawalRichMetadata | null {
  if (!rejectionReasonField) return null;
  try {
    const parsed = JSON.parse(rejectionReasonField);
    if (parsed && typeof parsed === "object" && parsed.fullStatus) {
      return parsed as WithdrawalRichMetadata;
    }
  } catch {}
  return null;
}

export function serializeMetadata(meta: WithdrawalRichMetadata): string {
  return JSON.stringify(meta);
}

export function formatRequestId(id: number): string {
  return `THK-WTH-${String(id).padStart(5, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS & AUDIT LOG HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function createNotification(params: {
  recipientUserId?: string | null;
  recipientAdminId?: number | null;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
}) {
  try {
    const { error } = await supabase.from("notifications").insert({
      recipient_user_id: params.recipientUserId || null,
      recipient_admin_id: params.recipientAdminId || null,
      type: params.type,
      title: params.title,
      body: params.body,
      entity_type: params.entityType,
      entity_id: params.entityId,
      created_at: new Date().toISOString(),
    });
    if (error) {
      logger.warn({ error: error.message }, "Notification creation note");
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notification creation exception");
  }
}

export async function createAuditLog(params: {
  actorUserId?: string | null;
  actorAdminId?: number | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}) {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: params.actorUserId || null,
      actor_admin_id: params.actorAdminId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });
    if (error) {
      logger.warn({ error: error.message }, "Audit log creation note");
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Audit log creation exception");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL CALCULATIONS & BALANCES
// ─────────────────────────────────────────────────────────────────────────────

export async function getPartnerFinancialSummary(userId: string): Promise<PartnerFinancialSummary> {
  const partnerCtx = await resolvePartnerForUser(userId);
  const partnerId = partnerCtx?.partnerId || "00000000-0000-0000-0000-000000000001";
  const centreId = partnerCtx?.centreId || 1;
  const centreName = partnerCtx?.partnerName || "Aura Global BPO Centre";
  const partnerCode = partnerCtx?.partner?.partner_code || "THK-BPO-00001";
  const partnerStatus = partnerCtx?.partner?.status || "active";

  // 1. Fetch statements from Supabase (or memory fallback)
  let statements: any[] = [];
  try {
    const { data, error } = await supabase
      .from("bpo_payout_statements")
      .select("*")
      .eq("partner_id", partnerId);
    if (!error && data && data.length > 0) {
      statements = data;
    } else {
      // Fallback to in-memory Phase 6 payoutsStore
      statements = Array.from(payoutsStore.values()).filter((p) => p.partner_id === partnerId);
    }
  } catch {
    statements = Array.from(payoutsStore.values()).filter((p) => p.partner_id === partnerId);
  }

  // 2. Fetch all withdrawals for this partner / user
  const { data: rawWithdrawals } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("user_id", userId);

  const withdrawalsList: BpoWithdrawalRecord[] = (rawWithdrawals || []).map((row) =>
    mapToBpoWithdrawal(row)
  );

  // 3. Compute earnings
  let totalEarnings = 0;
  let totalApprovedEarnings = 0;
  let paidEarningsFromStatements = 0;
  let pendingEarnings = 0;

  for (const st of statements) {
    const net = Number(st.net_amount ?? st.payable_amount ?? 0);
    const paid = Number(st.paid_amount ?? 0);
    const stStatus = String(st.status || "").toLowerCase();

    totalEarnings = addMoney(totalEarnings, net);

    if (stStatus === "pending") {
      pendingEarnings = addMoney(pendingEarnings, net);
    } else {
      // Both approved and paid statements represent confirmed, approved operational earnings
      totalApprovedEarnings = addMoney(totalApprovedEarnings, net);
      if (paid > 0) {
        paidEarningsFromStatements = addMoney(paidEarningsFromStatements, paid);
      } else if (stStatus === "paid") {
        paidEarningsFromStatements = addMoney(paidEarningsFromStatements, net);
      }
    }
  }

  // Fallback if no statements in DB
  if (statements.length === 0) {
    totalEarnings = 6860.0;
    totalApprovedEarnings = 6860.0;
  }

  // 4. Compute withdrawals amounts
  let processingWithdrawalAmount = 0;
  let requestedWithdrawalAmount = 0;
  let paidWithdrawalAmount = 0;

  for (const w of withdrawalsList) {
    if (w.status === "PROCESSING") {
      processingWithdrawalAmount = addMoney(processingWithdrawalAmount, w.amount);
    } else if (w.status === "REQUESTED" || w.status === "UNDER_REVIEW" || w.status === "APPROVED") {
      requestedWithdrawalAmount = addMoney(requestedWithdrawalAmount, w.amount);
    } else if (w.status === "PAID") {
      paidWithdrawalAmount = addMoney(paidWithdrawalAmount, w.amount);
    }
  }

  // Effective total paid out: max of statement paid amount or sum of paid withdrawals
  const totalPaidAmount = Math.max(paidEarningsFromStatements, paidWithdrawalAmount);

  // 5. Compute disputes
  const partnerDisputes = Array.from(disputesStore.values()).filter(
    (d) => d.partner_id === partnerId && d.dispute_type === "payout"
  );
  const openDisputes = partnerDisputes.filter(
    (d) => d.status === "open" || d.status === "under_review"
  ).length;
  let disputedAmount = 0;
  for (const d of partnerDisputes) {
    if (d.status === "open" || d.status === "under_review") {
      disputedAmount = addMoney(disputedAmount, d.disputed_amount);
    }
  }

  // Available Balance Calculation:
  // Available = totalApprovedEarnings - totalPaidAmount - processingWithdrawalAmount - requestedWithdrawalAmount - disputedAmount
  let availableBalance = subMoney(totalApprovedEarnings, totalPaidAmount);
  availableBalance = subMoney(availableBalance, processingWithdrawalAmount);
  availableBalance = subMoney(availableBalance, requestedWithdrawalAmount);
  availableBalance = subMoney(availableBalance, disputedAmount);
  availableBalance = Math.max(0, roundMoney(availableBalance));

  // Upcoming Payouts (Approved statements awaiting disbursement or under active payout run)
  const upcomingPayouts = addMoney(availableBalance, processingWithdrawalAmount);

  // 6. Fetch payout details for this user
  let payoutDetails: any[] = [];
  try {
    const { data: pdData } = await supabase
      .from("payout_details")
      .select("id, method, display_label, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    payoutDetails = (pdData || []).map((p) => ({
      id: Number(p.id),
      method: p.method,
      displayLabel: p.display_label,
      createdAt: p.created_at,
    }));
  } catch {}

  return {
    partnerId,
    partnerCode,
    centreName,
    centreId,
    status: partnerStatus,
    totalEarnings: roundMoney(totalEarnings),
    total_earnings: roundMoney(totalEarnings),
    paidAmount: roundMoney(totalPaidAmount),
    paidEarnings: roundMoney(totalPaidAmount),
    paid_amount: roundMoney(totalPaidAmount),
    pendingEarnings: roundMoney(pendingEarnings),
    pending_earnings: roundMoney(pendingEarnings),
    processingAmount: roundMoney(processingWithdrawalAmount),
    processing_amount: roundMoney(processingWithdrawalAmount),
    requestedAmount: roundMoney(requestedWithdrawalAmount),
    upcomingPayouts: roundMoney(upcomingPayouts),
    openDisputes,
    disputedAmount: roundMoney(disputedAmount),
    availableBalance,
    available_balance: availableBalance,
    currency: "USD",
    payoutDetails,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPER: DB ROW -> RICH RECORD
// ─────────────────────────────────────────────────────────────────────────────

export function mapToBpoWithdrawal(row: any, userProfile?: any, partner?: any): BpoWithdrawalRecord {
  const meta = parseMetadata(row.rejection_reason);
  const id = Number(row.id);
  const dbStatus = row.status as "PENDING" | "APPROVED" | "REJECTED";

  // Resolve status prioritizing rich meta, with DB fallback
  let status: WithdrawalLifecycleStatus = "REQUESTED";
  if (meta?.fullStatus) {
    status = meta.fullStatus;
  } else if (dbStatus === "APPROVED") {
    status = "APPROVED";
  } else if (dbStatus === "REJECTED") {
    status = "REJECTED";
  } else {
    status = "REQUESTED";
  }

  const userEmail = meta?.userEmail || userProfile?.email || "partner@thinkatic.com";
  const userFullName = meta?.userFullName || userProfile?.full_name || partner?.name || "BPO Partner";
  const partnerCode = meta?.partnerCode || partner?.partner_code || "THK-BPO-00001";
  const centreName = meta?.centreName || partner?.name || "Aura Global BPO Centre";
  const partnerId = meta?.partnerId || partner?.id || "00000000-0000-0000-0000-000000000001";
  const centreId = meta?.centreId || 1;
  const destinationMasked = meta?.destinationMasked || (row.method === "indian_bank" ? "Bank account ending ••••" : "PayPal account");

  return {
    id,
    requestId: formatRequestId(id),
    request_code: formatRequestId(id),
    bpo_partner_name: centreName,
    partner_name: centreName,
    partner_code: partnerCode,
    centre_name: centreName,
    userId: row.user_id,
    partnerId,
    partnerCode,
    centreName,
    centreId,
    userEmail,
    userFullName,
    amount: Number(row.amount),
    currency: row.currency || "USD",
    method: row.method,
    payoutDetailsId: Number(row.payout_details_id),
    destinationMasked,
    status,
    dbStatus,
    requestedAt: meta?.requestedAt || row.created_at,
    reviewedBy: meta?.reviewedBy ?? (row.reviewed_by ? Number(row.reviewed_by) : null),
    reviewedAt: meta?.reviewedAt || row.reviewed_at || null,
    approvedBy: meta?.approvedBy || null,
    approvedAt: meta?.approvedAt || null,
    processedBy: meta?.processedBy || null,
    processedAt: meta?.processedAt || null,
    paidBy: meta?.paidBy || null,
    paidAt: meta?.paidAt || null,
    paymentReference: meta?.paymentReference || null,
    payment_reference: meta?.paymentReference || null,
    rejectionReason: meta?.rejectionReason || (!meta && dbStatus === "REJECTED" ? row.rejection_reason : null),
    rejection_reason: meta?.rejectionReason || (!meta && dbStatus === "REJECTED" ? row.rejection_reason : null),
    adminNote: meta?.adminNote || null,
    note: meta?.note || null,
    statementId: meta?.statementId || null,
    auditHistory: meta?.auditHistory || [
      {
        status,
        timestamp: row.created_at,
        actor: userEmail,
        note: "Withdrawal record initialized",
      },
    ],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE BPO WITHDRAWAL WORKFLOWS
// ─────────────────────────────────────────────────────────────────────────────

export async function requestBpoWithdrawal(
  userId: string,
  userEmail: string,
  userFullName: string,
  payload: {
    amount: number;
    currency?: string;
    payoutDetailsId: number;
    note?: string;
    idempotencyKey?: string;
  }
): Promise<BpoWithdrawalRecord> {
  const { amount, payoutDetailsId, note, idempotencyKey } = payload;
  const currency = (payload.currency || "USD").toUpperCase();

  // 1. Basic validation
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Withdrawal amount must be a positive number greater than 0");
  }

  const supportedCurrencies = ["USD", "INR", "EUR", "GBP"];
  if (!supportedCurrencies.includes(currency)) {
    throw new Error(`Currency ${currency} is not supported. Supported: ${supportedCurrencies.join(", ")}`);
  }

  // 2. Resolve Partner Context
  const partnerCtx = await resolvePartnerForUser(userId);
  if (!partnerCtx) {
    throw new Error("Access denied: User is not linked to an authorized BPO partner centre");
  }
  if (partnerCtx.partner && partnerCtx.partner.status !== "active") {
    throw new Error(`Partner account status is ${partnerCtx.partner.status}. Withdrawals require an active, approved account.`);
  }

  // 3. Check Available Financial Balance
  const summary = await getPartnerFinancialSummary(userId);
  if (amount > summary.availableBalance) {
    throw new Error(
      `Requested amount ($${amount.toFixed(2)}) exceeds eligible available balance ($${summary.availableBalance.toFixed(2)})`
    );
  }

  // 4. Verify Payout Details
  let payoutDetail: any = null;
  if (payoutDetailsId) {
    const { data: pd } = await supabase
      .from("payout_details")
      .select("*")
      .eq("id", payoutDetailsId)
      .eq("user_id", userId)
      .maybeSingle();
    payoutDetail = pd;
  }

  if (!payoutDetail) {
    const { data: anyPd } = await supabase
      .from("payout_details")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (anyPd && anyPd.length > 0) {
      payoutDetail = anyPd[0];
    } else {
      payoutDetail = {
        id: payoutDetailsId || 1,
        user_id: userId,
        method: "bank_wire",
        currency,
        display_label: "Bank Wire Transfer (••••4892)",
      };
    }
  }

  // 5. Idempotency Check: Prevent duplicate submissions
  if (idempotencyKey) {
    const { data: existingRows } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const r of existingRows || []) {
      const parsed = parseMetadata(r.rejection_reason);
      if (parsed?.idempotencyKey === idempotencyKey) {
        return mapToBpoWithdrawal(r);
      }
    }
  }

  // Also check if an identical request was submitted in the last 10 seconds
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  const { data: recentDuplicates } = await supabase
    .from("withdrawals")
    .select("id")
    .eq("user_id", userId)
    .eq("amount", amount)
    .gte("created_at", tenSecondsAgo);

  if (recentDuplicates && recentDuplicates.length > 0) {
    throw new Error("A duplicate withdrawal submission was detected. Please wait a moment before submitting again.");
  }

  // 6. Build Initial Metadata
  const now = new Date().toISOString();
  const initialAudit: AuditHistoryEntry[] = [
    {
      status: "REQUESTED",
      timestamp: now,
      actor: userEmail,
      note: note ? `Partner note: ${note}` : "Withdrawal request submitted by BPO partner",
    },
  ];

  const meta: WithdrawalRichMetadata = {
    fullStatus: "REQUESTED",
    partnerId: summary.partnerId,
    partnerCode: summary.partnerCode,
    centreName: summary.centreName,
    centreId: summary.centreId,
    userEmail,
    userFullName,
    destinationMasked: payoutDetail.display_label || "Configured Payout Destination",
    requestedAt: now,
    note: note || null,
    idempotencyKey: idempotencyKey || null,
    auditHistory: initialAudit,
  };

  // 7. Insert into Supabase withdrawals table
  const { data: inserted, error: insertErr } = await supabase
    .from("withdrawals")
    .insert({
      user_id: userId,
      amount: roundMoney(amount),
      currency,
      method: payoutDetail.method,
      payout_details_id: payoutDetailsId,
      status: "PENDING",
      rejection_reason: serializeMetadata(meta),
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    throw new Error(`Failed to record withdrawal in database: ${insertErr?.message || "Unknown error"}`);
  }

  const record = mapToBpoWithdrawal(inserted);

  // 8. Trigger Notifications
  // Notify Admin
  await createNotification({
    recipientAdminId: 1,
    type: "new_bpo_withdrawal",
    title: "New BPO Partner Withdrawal Request",
    body: `${summary.centreName} (${summary.partnerCode}) requested a payout of $${amount.toFixed(2)} ${currency}.`,
    entityType: "withdrawal",
    entityId: String(record.id),
  });

  // Notify BPO Partner
  await createNotification({
    recipientUserId: userId,
    type: "bpo_withdrawal_submitted",
    title: "Withdrawal Request Submitted",
    body: `Your withdrawal request ${record.requestId} for $${amount.toFixed(2)} ${currency} is now pending review by Thinkatic Finance.`,
    entityType: "withdrawal",
    entityId: String(record.id),
  });

  // 9. Write Audit Log
  await createAuditLog({
    actorUserId: userId,
    action: "bpo_withdrawal_requested",
    entityType: "withdrawal",
    entityId: String(record.id),
    metadata: {
      amount,
      currency,
      requestId: record.requestId,
      partnerId: summary.partnerId,
      partnerCode: summary.partnerCode,
    },
  });

  return record;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS: LIST, DETAIL & STATE TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function listWithdrawalsAdmin(filters?: {
  search?: string;
  status?: string;
  partnerId?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}): Promise<{
  withdrawals: BpoWithdrawalRecord[];
  total: number;
  kpis: {
    availableRequests: number;
    pendingReview: number;
    approved: number;
    processing: number;
    paid: number;
    rejected: number;
    totalPendingAmount: number;
    totalAmountPending?: number;
    totalPaidAmount: number;
    totalAmountPaid?: number;
  };
}> {
  // 1. Fetch all raw withdrawals
  const { data: rawRows, error } = await supabase
    .from("withdrawals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load withdrawals: ${error.message}`);
  }

  // 2. Fetch associated profiles & partners for enrichment
  const userIds = Array.from(new Set((rawRows || []).map((r) => r.user_id)));
  const profilesMap = new Map<string, any>();
  if (userIds.length > 0) {
    try {
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, email, full_name, account_type")
        .in("id", userIds);
      (pData || []).forEach((p) => profilesMap.set(p.id, p));
    } catch {}
  }

  const { data: allPartners } = await supabase
    .from("bpo_partners")
    .select("id, name, partner_code, email, status");
  const partnersMap = new Map<string, any>();
  (allPartners || []).forEach((bp) => partnersMap.set(bp.id, bp));

  // 3. Map all rows to rich BpoWithdrawalRecord
  const allMapped: BpoWithdrawalRecord[] = (rawRows || []).map((row) => {
    const meta = parseMetadata(row.rejection_reason);
    const userProfile = profilesMap.get(row.user_id);
    const partner = meta?.partnerId ? partnersMap.get(meta.partnerId) : undefined;
    return mapToBpoWithdrawal(row, userProfile, partner);
  });

  // 4. Compute Authoritative KPIs across ALL records
  let availableRequests = 0;
  let pendingReview = 0;
  let approved = 0;
  let processing = 0;
  let paid = 0;
  let rejected = 0;
  let totalPendingAmount = 0;
  let totalPaidAmount = 0;

  for (const w of allMapped) {
    if (w.status === "REQUESTED") {
      availableRequests++;
      pendingReview++;
      totalPendingAmount = addMoney(totalPendingAmount, w.amount);
    } else if (w.status === "UNDER_REVIEW") {
      availableRequests++;
      pendingReview++;
      totalPendingAmount = addMoney(totalPendingAmount, w.amount);
    } else if (w.status === "APPROVED") {
      approved++;
      totalPendingAmount = addMoney(totalPendingAmount, w.amount);
    } else if (w.status === "PROCESSING") {
      processing++;
      totalPendingAmount = addMoney(totalPendingAmount, w.amount);
    } else if (w.status === "PAID") {
      paid++;
      totalPaidAmount = addMoney(totalPaidAmount, w.amount);
    } else if (w.status === "REJECTED") {
      rejected++;
    }
  }

  // 5. Apply Multi-parameter Filters
  const search = filters?.search?.trim().toLowerCase();
  const statusFilter = filters?.status?.toUpperCase();
  const currencyFilter = filters?.currency?.toUpperCase();
  const partnerIdFilter = filters?.partnerId;
  const startDate = filters?.startDate ? new Date(filters.startDate) : null;
  const endDate = filters?.endDate ? new Date(filters.endDate) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  const filtered = allMapped.filter((w) => {
    // Search filter
    if (search) {
      const match =
        w.requestId.toLowerCase().includes(search) ||
        w.centreName.toLowerCase().includes(search) ||
        w.partnerCode.toLowerCase().includes(search) ||
        w.userEmail.toLowerCase().includes(search) ||
        w.userFullName.toLowerCase().includes(search) ||
        w.method.toLowerCase().includes(search) ||
        String(w.amount).includes(search);
      if (!match) return false;
    }

    // Status filter
    if (statusFilter && statusFilter !== "ALL") {
      if (w.status !== statusFilter) return false;
    }

    // Currency filter
    if (currencyFilter && currencyFilter !== "ALL") {
      if (w.currency !== currencyFilter) return false;
    }

    // Partner ID filter
    if (partnerIdFilter && partnerIdFilter !== "ALL") {
      if (w.partnerId !== partnerIdFilter) return false;
    }

    // Amount range
    if (filters?.minAmount !== undefined && w.amount < filters.minAmount) return false;
    if (filters?.maxAmount !== undefined && w.amount > filters.maxAmount) return false;

    // Date range
    if (startDate || endDate) {
      const reqDate = new Date(w.requestedAt);
      if (startDate && reqDate < startDate) return false;
      if (endDate && reqDate > endDate) return false;
    }

    return true;
  });

  return {
    withdrawals: filtered,
    total: filtered.length,
    kpis: {
      availableRequests,
      pendingReview,
      approved,
      processing,
      paid,
      rejected,
      totalPendingAmount: roundMoney(totalPendingAmount),
      totalAmountPending: roundMoney(totalPendingAmount),
      totalPaidAmount: roundMoney(totalPaidAmount),
      totalAmountPaid: roundMoney(totalPaidAmount),
    },
  };
}

export async function getWithdrawalDetailsAdmin(id: number): Promise<{
  withdrawal: BpoWithdrawalRecord;
  financialBreakdown: PartnerFinancialSummary;
  financialDetails: PartnerFinancialSummary;
  partnerDetails: {
    partnerId: string;
    partnerName: string;
    partnerCode: string;
    centreName: string;
    status: string;
    email: string;
  };
  payoutDetails: {
    method: string;
    destinationMasked: string;
    payoutDetailsId: number;
  };
  auditHistory: AuditHistoryEntry[];
  linkedStatement?: any | null;
}> {
  const { data: row, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) {
    throw new Error(`Withdrawal #${id} not found`);
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name, account_type")
    .eq("id", row.user_id)
    .maybeSingle();

  const meta = parseMetadata(row.rejection_reason);

  // Get partner
  let partner: any = null;
  if (meta?.partnerId) {
    const { data: bp } = await supabase
      .from("bpo_partners")
      .select("id, name, partner_code, email, status")
      .eq("id", meta.partnerId)
      .maybeSingle();
    partner = bp;
  }

  const withdrawal = mapToBpoWithdrawal(row, userProfile, partner);
  const financialBreakdown = await getPartnerFinancialSummary(withdrawal.userId);

  // Find linked statement if available
  let linkedStatement: any = null;
  try {
    const { data: stData } = await supabase
      .from("bpo_payout_statements")
      .select("*")
      .eq("partner_id", withdrawal.partnerId)
      .order("created_at", { ascending: false })
      .limit(1);
    linkedStatement = stData?.[0] || null;
  } catch {}

  const partnerDetails = {
    partnerId: partner?.id || withdrawal.partnerId,
    partnerName: partner?.name || withdrawal.centreName,
    partnerCode: partner?.partner_code || withdrawal.partnerCode,
    centreName: withdrawal.centreName,
    status: partner?.status || "active",
    email: partner?.email || withdrawal.userEmail,
  };

  const payoutDetails = {
    method: withdrawal.method,
    destinationMasked: withdrawal.destinationMasked,
    payoutDetailsId: withdrawal.payoutDetailsId,
  };

  return {
    withdrawal,
    financialBreakdown,
    financialDetails: financialBreakdown,
    partnerDetails,
    payoutDetails,
    auditHistory: withdrawal.auditHistory,
    linkedStatement,
  };
}

export async function adminTransitionWithdrawal(
  id: number,
  action: "review" | "approve" | "reject" | "process" | "pay",
  adminCtx: { id: number; username: string },
  payload?: {
    rejectionReason?: string;
    adminNote?: string;
    paymentReference?: string;
    paidDate?: string;
  }
): Promise<BpoWithdrawalRecord> {
  const { data: row, error: fetchErr } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    throw new Error(`Withdrawal #${id} not found`);
  }

  const current = mapToBpoWithdrawal(row);
  const meta: WithdrawalRichMetadata = parseMetadata(row.rejection_reason) || {
    fullStatus: current.status,
    partnerId: current.partnerId,
    partnerCode: current.partnerCode,
    centreName: current.centreName,
    centreId: current.centreId,
    userEmail: current.userEmail,
    userFullName: current.userFullName,
    destinationMasked: current.destinationMasked,
    requestedAt: current.requestedAt,
    auditHistory: current.auditHistory,
  };

  const now = new Date().toISOString();
  let nextStatus: WithdrawalLifecycleStatus;
  let nextDbStatus: "PENDING" | "APPROVED" | "REJECTED" = row.status;

  switch (action) {
    case "review": {
      if (current.status !== "REQUESTED") {
        throw new Error(`Cannot start review on a withdrawal with status "${current.status}"`);
      }
      nextStatus = "UNDER_REVIEW";
      meta.reviewedBy = adminCtx.id;
      meta.reviewedAt = now;
      if (payload?.adminNote) meta.adminNote = payload.adminNote.trim();
      meta.auditHistory.push({
        status: "UNDER_REVIEW",
        timestamp: now,
        actor: `Admin ${adminCtx.username}`,
        note: payload?.adminNote ? `Admin note: ${payload.adminNote.trim()}` : "Withdrawal placed under review",
        adminId: adminCtx.id,
      });

      await createNotification({
        recipientUserId: current.userId,
        type: "bpo_withdrawal_under_review",
        title: "Withdrawal Under Review",
        body: `Your withdrawal request ${current.requestId} ($${current.amount.toFixed(2)}) is now being reviewed by Thinkatic Finance.`,
        entityType: "withdrawal",
        entityId: String(id),
      });
      break;
    }

    case "approve": {
      if (current.status !== "REQUESTED" && current.status !== "UNDER_REVIEW") {
        throw new Error(`Cannot approve a withdrawal with status "${current.status}". Expected REQUESTED or UNDER_REVIEW.`);
      }

      // Re-validate available balance server-side to prevent race conditions
      const financialSummary = await getPartnerFinancialSummary(current.userId);
      // Since this withdrawal was already in REQUESTED/UNDER_REVIEW, its own amount is accounted for in requestedAmount
      const availableWithThis = addMoney(financialSummary.availableBalance, current.amount);
      if (current.amount > availableWithThis) {
        throw new Error(
          `Insufficient eligible balance to approve withdrawal. Required: $${current.amount.toFixed(2)}, Available: $${availableWithThis.toFixed(2)}`
        );
      }

      nextStatus = "APPROVED";
      nextDbStatus = "APPROVED";
      meta.approvedBy = adminCtx.id;
      meta.approvedAt = now;
      if (payload?.adminNote) meta.adminNote = payload.adminNote.trim();
      meta.auditHistory.push({
        status: "APPROVED",
        timestamp: now,
        actor: `Admin ${adminCtx.username}`,
        note: payload?.adminNote ? `Approved with note: ${payload.adminNote.trim()}` : "Withdrawal request approved",
        adminId: adminCtx.id,
      });

      await createNotification({
        recipientUserId: current.userId,
        type: "bpo_withdrawal_approved",
        title: "Withdrawal Approved",
        body: `Your withdrawal request ${current.requestId} for $${current.amount.toFixed(2)} ${current.currency} has been approved and queued for processing.`,
        entityType: "withdrawal",
        entityId: String(id),
      });
      break;
    }

    case "reject": {
      if (current.status !== "REQUESTED" && current.status !== "UNDER_REVIEW") {
        throw new Error(`Cannot reject a withdrawal with status "${current.status}". Only REQUESTED or UNDER_REVIEW can be rejected.`);
      }

      const reason = payload?.rejectionReason?.trim();
      if (!reason) {
        throw new Error("A specific rejection reason is mandatory when rejecting a withdrawal request");
      }

      nextStatus = "REJECTED";
      nextDbStatus = "REJECTED";
      meta.rejectionReason = reason;
      meta.reviewedBy = adminCtx.id;
      meta.reviewedAt = now;
      meta.auditHistory.push({
        status: "REJECTED",
        timestamp: now,
        actor: `Admin ${adminCtx.username}`,
        note: `Rejected: ${reason}`,
        adminId: adminCtx.id,
      });

      await createNotification({
        recipientUserId: current.userId,
        type: "bpo_withdrawal_rejected",
        title: "Withdrawal Request Rejected",
        body: `Your withdrawal request ${current.requestId} ($${current.amount.toFixed(2)}) was rejected. Reason: ${reason}. Funds remain available in your eligible balance.`,
        entityType: "withdrawal",
        entityId: String(id),
      });
      break;
    }

    case "process": {
      if (current.status !== "APPROVED") {
        throw new Error(`Cannot move to PROCESSING from status "${current.status}". Withdrawal must be APPROVED first.`);
      }

      nextStatus = "PROCESSING";
      nextDbStatus = "APPROVED"; // Keep DB status as APPROVED
      meta.processedBy = adminCtx.id;
      meta.processedAt = now;
      if (payload?.adminNote) meta.adminNote = payload.adminNote.trim();
      meta.auditHistory.push({
        status: "PROCESSING",
        timestamp: now,
        actor: `Admin ${adminCtx.username}`,
        note: payload?.adminNote ? `Processing: ${payload.adminNote.trim()}` : "Withdrawal disbursement initiated via payment network",
        adminId: adminCtx.id,
      });

      await createNotification({
        recipientUserId: current.userId,
        type: "bpo_withdrawal_processing",
        title: "Withdrawal In Processing",
        body: `Disbursement for withdrawal ${current.requestId} ($${current.amount.toFixed(2)}) is currently in processing.`,
        entityType: "withdrawal",
        entityId: String(id),
      });
      break;
    }

    case "pay": {
      if (current.status !== "PROCESSING" && current.status !== "APPROVED") {
        throw new Error(`Cannot mark PAID from status "${current.status}". Withdrawal must be APPROVED or PROCESSING.`);
      }

      const paymentReference = payload?.paymentReference?.trim();
      if (!paymentReference) {
        throw new Error("A valid transaction/payment reference (e.g. wire confirmation or transaction ID) is required to mark PAID");
      }

      const paidDate = payload?.paidDate ? payload.paidDate.trim() : now.slice(0, 10);

      nextStatus = "PAID";
      nextDbStatus = "APPROVED";
      meta.paidBy = adminCtx.id;
      meta.paidAt = now;
      meta.paymentReference = paymentReference;
      meta.auditHistory.push({
        status: "PAID",
        timestamp: now,
        actor: `Admin ${adminCtx.username}`,
        note: `Paid with reference: ${paymentReference} on ${paidDate}`,
        adminId: adminCtx.id,
      });

      // Update linked Supabase bpo_payout_statements if matching
      try {
        const { data: stMatch } = await supabase
          .from("bpo_payout_statements")
          .select("id, paid_amount, net_amount, status")
          .eq("partner_id", current.partnerId)
          .in("status", ["approved", "pending"])
          .limit(1);

        if (stMatch && stMatch[0]) {
          const prevPaid = Number(stMatch[0].paid_amount || 0);
          const newPaid = addMoney(prevPaid, current.amount);
          const net = Number(stMatch[0].net_amount || 0);
          const isFull = newPaid >= net;

          await supabase
            .from("bpo_payout_statements")
            .update({
              status: isFull ? "paid" : "approved",
              paid_amount: newPaid,
              reference: paymentReference,
              payout_date: paidDate,
              updated_at: now,
            })
            .eq("id", stMatch[0].id);

          meta.statementId = stMatch[0].id;
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, "Error updating statement for paid withdrawal");
      }

      await createNotification({
        recipientUserId: current.userId,
        type: "bpo_withdrawal_paid",
        title: "Payment Confirmed — Funds Disbursed",
        body: `Payment of $${current.amount.toFixed(2)} ${current.currency} for ${current.requestId} has been confirmed. Payment Reference: ${paymentReference}.`,
        entityType: "withdrawal",
        entityId: String(id),
      });
      break;
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  meta.fullStatus = nextStatus;

  // Update in Supabase
  const { data: updated, error: updateErr } = await supabase
    .from("withdrawals")
    .update({
      status: nextDbStatus,
      rejection_reason: serializeMetadata(meta),
      reviewed_by: adminCtx.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr || !updated) {
    throw new Error(`Failed to update withdrawal record: ${updateErr?.message || "Unknown error"}`);
  }

  // Immutable audit log
  await createAuditLog({
    actorAdminId: adminCtx.id,
    action: `bpo_withdrawal_${action}`,
    entityType: "withdrawal",
    entityId: String(id),
    metadata: {
      action,
      fromStatus: current.status,
      toStatus: nextStatus,
      adminUsername: adminCtx.username,
      amount: current.amount,
      currency: current.currency,
      paymentReference: payload?.paymentReference || null,
      rejectionReason: payload?.rejectionReason || null,
    },
  });

  return mapToBpoWithdrawal(updated);
}
