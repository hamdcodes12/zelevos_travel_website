/**
 * THINKATIC — BPO PERMANENT DELETION & COMPLETE DATABASE CLEANUP SERVICE
 * Authoritative, transactional-style multi-system cleanup for BPO Partners.
 *
 * Enforces:
 * 1. Exact entity graph resolution (resolves user profile, applications, centres, agreements, media)
 * 2. Cascading deletion adhering to strict FK dependencies (removes agreements before partners/apps)
 * 3. Exclusive private storage purging (photos, videos, agreements, KYC; never shared/global)
 * 4. Supabase Auth user permanent deletion via service-role admin API
 * 5. Persistent JSON and in-memory cache purging
 * 6. Minimum immutable security audit logging
 */

import fs from "fs";
import path from "path";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import { invalidateAdminBpoCache } from "../routes/admin.js";
import { invalidateUserPartnerCache } from "../routes/bpoAgents.js";
import { removeVerificationForUser } from "./centreVerificationService.js";
import { removeApplicationFromMemory } from "../routes/partnerApplications.js";

export interface BpoCleanupTarget {
  userId: string;
  email: string;
  fullName: string;
  companyName: string;
  applicationIds: number[];
  partnerIds: string[];
  verificationIds: number[];
  agreementIds: number[];
  mediaStorageKeys: string[];
}

export interface BpoCleanupResult {
  success: boolean;
  targetUserId: string;
  targetEmail: string;
  companyName: string;
  cleaned: {
    applications: number;
    partners: number;
    verifications: number;
    agreements: number;
    mediaFiles: number;
    documents: number;
    profile: boolean;
    authUser: boolean;
  };
  auditLogId?: number;
}

/**
 * Resolve the complete entity graph starting from any valid identifier:
 * - Profile UUID (user ID)
 * - Formal Application ID (numeric or string)
 * - Application Number (e.g. THK-APP-12345)
 * - Centre ID (e.g. THK-BPO-001)
 * - Partner ID (UUID)
 */
export async function resolveBpoCleanupGraph(rawId: string): Promise<BpoCleanupTarget | null> {
  const sanitized = String(rawId || "").trim();
  if (!sanitized || sanitized === "undefined" || sanitized === "null") {
    return null;
  }

  // Reject malicious input / SQL injection attempts in ID
  if (/[\;\<\>\"\'\`\\]/.test(sanitized)) {
    return null;
  }

  let resolvedUserId: string | null = null;
  let targetProfile: any = null;

  // 1. Direct match on profiles.id (UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitized);
  if (isUuid) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, account_type, bpo_status, bpo_application_details")
      .eq("id", sanitized)
      .maybeSingle();

    if (prof && prof.account_type === "BPO") {
      resolvedUserId = prof.id;
      targetProfile = prof;
    }
  }

  // 2. If not resolved yet, check bpo_partner_applications
  if (!resolvedUserId) {
    let appQuery = /^\d+$/.test(sanitized)
      ? supabase.from("bpo_partner_applications").select("id, applicant_user_id").eq("id", parseInt(sanitized, 10)).maybeSingle()
      : isUuid
      ? supabase.from("bpo_partner_applications").select("id, applicant_user_id").eq("applicant_user_id", sanitized).maybeSingle()
      : supabase.from("bpo_partner_applications").select("id, applicant_user_id").eq("application_number", sanitized).maybeSingle();

    const { data: formalApp } = await appQuery;
    if (formalApp?.applicant_user_id) {
      resolvedUserId = formalApp.applicant_user_id;
    }
  }

  // 3. If not resolved yet, check bpo_centre_verification
  if (!resolvedUserId) {
    let verQuery = /^\d+$/.test(sanitized)
      ? supabase.from("bpo_centre_verification").select("id, applicant_user_id").eq("id", parseInt(sanitized, 10)).maybeSingle()
      : supabase.from("bpo_centre_verification").select("id, applicant_user_id").eq("centre_id", sanitized).maybeSingle();

    const { data: ver } = await verQuery;
    if (ver?.applicant_user_id) {
      resolvedUserId = ver.applicant_user_id;
    }
  }

  // 4. If not resolved yet, check bpo_partners
  if (!resolvedUserId && isUuid) {
    const { data: partnerUser } = await supabase
      .from("bpo_partner_users")
      .select("user_id")
      .eq("partner_id", sanitized)
      .maybeSingle();

    if (partnerUser?.user_id) {
      resolvedUserId = partnerUser.user_id;
    }
  }

  // 5. If not resolved yet, check bpo_partner_agreements
  if (!resolvedUserId) {
    let agrQuery = /^\d+$/.test(sanitized)
      ? supabase.from("bpo_partner_agreements").select("id, application_id, partner_id").eq("id", parseInt(sanitized, 10)).maybeSingle()
      : supabase.from("bpo_partner_agreements").select("id, application_id, partner_id").eq("agreement_code", sanitized).maybeSingle();

    const { data: agr } = await agrQuery;
    if (agr?.application_id) {
      const { data: appRec } = await supabase
        .from("bpo_partner_applications")
        .select("applicant_user_id")
        .eq("id", agr.application_id)
        .maybeSingle();
      if (appRec?.applicant_user_id) {
        resolvedUserId = appRec.applicant_user_id;
      }
    }
  }

  // 6. If not resolved yet, check profiles by exact email
  if (!resolvedUserId && sanitized.includes("@")) {
    const { data: profByEmail } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, account_type, bpo_status, bpo_application_details")
      .ilike("email", sanitized)
      .maybeSingle();

    if (profByEmail && profByEmail.account_type === "BPO") {
      resolvedUserId = profByEmail.id;
      targetProfile = profByEmail;
    }
  }

  if (!resolvedUserId) {
    return null;
  }

  // Fetch or confirm target profile
  if (!targetProfile) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, account_type, bpo_status, bpo_application_details")
      .eq("id", resolvedUserId)
      .maybeSingle();

    if (!prof) {
      return null;
    }
    targetProfile = prof;
  }

  // Security guard: Admin accounts must NEVER be deleted through BPO deletion
  if (targetProfile.role === "admin" || targetProfile.account_type === "ADMIN") {
    logger.warn({ targetUserId: resolvedUserId }, "[BpoCleanup] Refusing to delete administrative profile");
    return null;
  }

  const userId = targetProfile.id;
  const email = targetProfile.email;
  const fullName = targetProfile.full_name || email;
  const appDetails = (targetProfile.bpo_application_details || {}) as Record<string, any>;

  // Discover all linked applications
  const { data: apps } = await supabase
    .from("bpo_partner_applications")
    .select("id, partner_id, company_data")
    .eq("applicant_user_id", userId);

  const applicationIds = (apps || []).map((a: any) => Number(a.id)).filter(Boolean);
  const rawPartnerIds: string[] = (apps || []).map((a: any) => a.partner_id).filter(Boolean);

  // Discover partner IDs from bpo_partner_users
  const { data: pUsers } = await supabase
    .from("bpo_partner_users")
    .select("partner_id")
    .eq("user_id", userId);

  if (pUsers) {
    for (const pu of pUsers) {
      if (pu.partner_id && !rawPartnerIds.includes(pu.partner_id)) {
        rawPartnerIds.push(pu.partner_id);
      }
    }
  }

  // Discover partner records matching email
  const { data: pByEmail } = await supabase
    .from("bpo_partners")
    .select("id, name")
    .eq("email", email);

  if (pByEmail) {
    for (const pb of pByEmail) {
      if (pb.id && !rawPartnerIds.includes(pb.id)) {
        rawPartnerIds.push(pb.id);
      }
    }
  }

  const partnerIds = Array.from(new Set(rawPartnerIds));

  // Determine authoritative company name for logs & UI
  let companyName = appDetails.companyName || "";
  if (!companyName && apps && apps.length > 0) {
    companyName = apps[0].company_data?.companyName || apps[0].company_data?.company_name || "";
  }
  if (!companyName && pByEmail && pByEmail.length > 0) {
    companyName = pByEmail[0].name || "";
  }
  if (!companyName) {
    companyName = fullName || "BPO Partner";
  }

  // Discover all centre verifications
  let verQuery = supabase.from("bpo_centre_verification").select("id").eq("applicant_user_id", userId);
  const { data: verData } = await verQuery;
  const verificationIds = (verData || []).map((v: any) => Number(v.id)).filter(Boolean);

  // Also query verifications by application IDs if not already captured
  if (applicationIds.length > 0) {
    const { data: extraVer } = await supabase
      .from("bpo_centre_verification")
      .select("id")
      .in("application_id", applicationIds);
    if (extraVer) {
      for (const ev of extraVer) {
        const numId = Number(ev.id);
        if (numId && !verificationIds.includes(numId)) {
          verificationIds.push(numId);
        }
      }
    }
  }

  // Discover all media items and storage keys
  const mediaStorageKeys: string[] = [];
  const { data: mediaItems } = await supabase
    .from("bpo_centre_media")
    .select("id, storage_key")
    .or(`applicant_user_id.eq.${userId}${verificationIds.length > 0 ? `,verification_id.in.(${verificationIds.join(",")})` : ""}`);

  if (mediaItems) {
    for (const m of mediaItems) {
      if (m.storage_key) {
        mediaStorageKeys.push(m.storage_key);
        const stripped = m.storage_key.replace(/^(thinkatic-)?centre-verification\//, "");
        const parts = stripped.split("/");
        if (parts.length > 1 && parts[0] && parts[0] !== userId && !partnerIds.includes(parts[0])) {
          partnerIds.push(parts[0]);
        }
      }
    }
  }

  // Discover all agreements
  const agreementIds: number[] = [];
  let agrQuery = supabase.from("bpo_partner_agreements").select("id, signed_document_url");
  if (applicationIds.length > 0 && partnerIds.length > 0) {
    agrQuery = agrQuery.or(`application_id.in.(${applicationIds.join(",")}),partner_id.in.(${partnerIds.join(",")})`);
  } else if (applicationIds.length > 0) {
    agrQuery = agrQuery.in("application_id", applicationIds);
  } else if (partnerIds.length > 0) {
    agrQuery = agrQuery.in("partner_id", partnerIds);
  } else {
    agrQuery = agrQuery.eq("contact_email", email);
  }

  const { data: agrs } = await agrQuery;
  if (agrs) {
    for (const ag of agrs) {
      agreementIds.push(Number(ag.id));
    }
  }

  return {
    userId,
    email,
    fullName,
    companyName,
    applicationIds,
    partnerIds,
    verificationIds,
    agreementIds,
    mediaStorageKeys,
  };
}

/**
 * Execute the permanent deletion workflow across PostgreSQL, Storage, JSON files, and Supabase Auth.
 */
export async function executePermanentBpoDeletion(
  target: BpoCleanupTarget,
  adminActor: { id: number; username: string },
  reason?: string
): Promise<BpoCleanupResult> {
  const {
    userId,
    email,
    fullName,
    companyName,
    applicationIds,
    partnerIds,
    verificationIds,
    agreementIds,
    mediaStorageKeys,
  } = target;

  logger.info(
    { userId, email, companyName, applicationIds, partnerIds, verificationIds, agreementIds },
    "[BpoCleanup] Initiating permanent deletion of BPO partner"
  );

  let cleanedMediaCount = 0;
  let cleanedDocCount = 0;

  // ============================================================================
  // STEP 1: PRIVATE STORAGE PURGE (Exclusively owned by this BPO)
  // ============================================================================
  try {
    async function purgeStoragePrefixRecursively(bucket: string, prefix: string): Promise<number> {
      let count = 0;
      try {
        const { data: items, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
        if (error || !items || items.length === 0) return 0;
        const filePaths: string[] = [];
        for (const it of items) {
          const fullPath = prefix ? `${prefix}/${it.name}` : it.name;
          if (it.id) {
            filePaths.push(fullPath);
          } else {
            count += await purgeStoragePrefixRecursively(bucket, fullPath);
          }
        }
        if (filePaths.length > 0) {
          await supabase.storage.from(bucket).remove(filePaths);
          count += filePaths.length;
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, bucket, prefix }, "[BpoCleanup] Notice purging storage prefix");
      }
      return count;
    }

    // 1.1 Purge explicit media storage keys from thinkatic-centre-verification
    if (mediaStorageKeys.length > 0) {
      const keysToRemove = mediaStorageKeys.map((k) =>
        k.replace(/^(thinkatic-)?centre-verification\//, "")
      );
      try {
        await supabase.storage.from("thinkatic-centre-verification").remove(keysToRemove);
        cleanedMediaCount += keysToRemove.length;
      } catch (stErr: any) {
        logger.warn({ err: stErr?.message }, "[BpoCleanup] Notice removing centre media storage keys");
      }
    }

    // 1.2 Recursively purge entire user/partner folders from private buckets
    const candidatePrefixes = Array.from(new Set([userId, ...partnerIds])).filter(Boolean);
    for (const pref of candidatePrefixes) {
      cleanedMediaCount += await purgeStoragePrefixRecursively("thinkatic-centre-verification", pref);
      await purgeStoragePrefixRecursively("thinkatic-agreements", pref);
      cleanedDocCount += await purgeStoragePrefixRecursively("thinkatic-kyc", pref);
      cleanedDocCount += await purgeStoragePrefixRecursively("thinkatic-documents", pref);
    }

    // 1.5 Local storage filesystem purge (safe directory removal for this user only)
    const localUserDirs = [
      path.resolve(process.cwd(), "data", "storage", "centre-verification", userId),
      path.resolve(process.cwd(), "data", "centre_verification", userId),
      path.resolve(process.cwd(), "data", "storage", "agreements", userId),
      path.resolve(process.cwd(), "data", "storage", "kyc", userId),
      path.resolve(process.cwd(), "data", "storage", "documents", userId),
    ];

    for (const dir of localUserDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (dirErr: any) {
          logger.warn({ dir, err: dirErr?.message }, "[BpoCleanup] Notice removing local storage directory");
        }
      }
    }

    // 1.6 Clean persistent JSON files
    // Clean centre_verification_store.json
    const centreStoreFile = path.resolve(process.cwd(), "data", "storage", "centre-verification", "centre_verification_store.json");
    if (fs.existsSync(centreStoreFile)) {
      try {
        const content = fs.readFileSync(centreStoreFile, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.verifications)) {
          const before = parsed.verifications.length;
          parsed.verifications = parsed.verifications.filter(
            (v: any) => v.applicantUserId !== userId && !verificationIds.includes(Number(v.id))
          );
          if (parsed.verifications.length !== before) {
            fs.writeFileSync(centreStoreFile, JSON.stringify(parsed, null, 2), "utf-8");
          }
        }
      } catch {}
    }

    // Clean agreements.json
    const agrStoreFile = path.resolve(process.cwd(), "data", "storage", "agreements", "agreements.json");
    if (fs.existsSync(agrStoreFile)) {
      try {
        const content = fs.readFileSync(agrStoreFile, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const before = parsed.length;
          const filtered = parsed.filter(
            (ag: any) =>
              !agreementIds.includes(Number(ag.id)) &&
              ag.contactEmail !== email &&
              !partnerIds.includes(ag.partnerId)
          );
          if (filtered.length !== before) {
            fs.writeFileSync(agrStoreFile, JSON.stringify(filtered, null, 2), "utf-8");
          }
        }
      } catch {}
    }

    // Purge in-memory state
    try {
      removeVerificationForUser(userId);
    } catch {}
    try {
      removeApplicationFromMemory(userId, applicationIds);
    } catch {}
  } catch (storageErr: any) {
    logger.warn({ err: storageErr?.message }, "[BpoCleanup] Storage cleanup warning");
  }

  // ============================================================================
  // STEP 2: DATABASE TRANSACTIONAL CLEANUP (Strict Dependency Ordering)
  // ============================================================================
  try {
    // 2.1 bpo_agreement_submissions (Foreign key to bpo_partner_agreements)
    if (agreementIds.length > 0) {
      await supabase.from("bpo_agreement_submissions").delete().in("agreement_id", agreementIds);
    }

    // 2.2 bpo_partner_agreements (CRITICAL: has RESTRICT on partner_id and application_id)
    if (agreementIds.length > 0) {
      await supabase.from("bpo_partner_agreements").delete().in("id", agreementIds);
    }
    if (applicationIds.length > 0) {
      await supabase.from("bpo_partner_agreements").delete().in("application_id", applicationIds);
    }
    if (partnerIds.length > 0) {
      await supabase.from("bpo_partner_agreements").delete().in("partner_id", partnerIds);
    }

    // 2.3 bpo_centre_media
    if (verificationIds.length > 0) {
      await supabase.from("bpo_centre_media").delete().in("verification_id", verificationIds);
    }
    await supabase.from("bpo_centre_media").delete().eq("applicant_user_id", userId);

    // 2.4 bpo_centre_verification_history
    if (verificationIds.length > 0) {
      await supabase.from("bpo_centre_verification_history").delete().in("verification_id", verificationIds);
    }

    // 2.5 bpo_centre_verification
    if (verificationIds.length > 0) {
      await supabase.from("bpo_centre_verification").delete().in("id", verificationIds);
    }
    await supabase.from("bpo_centre_verification").delete().eq("applicant_user_id", userId);

    // 2.6 bpo_application_documents & bpo_application_events
    if (applicationIds.length > 0) {
      await supabase.from("bpo_application_documents").delete().in("application_id", applicationIds);
      await supabase.from("bpo_application_events").delete().in("application_id", applicationIds);
    }
    await supabase.from("bpo_application_events").delete().eq("actor_user_id", userId);

    // 2.7 Partner operational records (if partnerIds exist)
    if (partnerIds.length > 0) {
      await Promise.all([
        supabase.from("bpo_shifts").delete().in("partner_id", partnerIds),
        supabase.from("bpo_agent_attendance").delete().in("partner_id", partnerIds),
        supabase.from("bpo_attendance_corrections").delete().in("partner_id", partnerIds),
        supabase.from("bpo_production_records").delete().in("partner_id", partnerIds),
        supabase.from("bpo_production_daily").delete().in("partner_id", partnerIds),
        supabase.from("bpo_qa_disputes").delete().in("partner_id", partnerIds),
        supabase.from("bpo_qa_evaluations").delete().in("partner_id", partnerIds),
        supabase.from("bpo_compliance_checks").delete().in("partner_id", partnerIds),
        supabase.from("bpo_compliance_exceptions").delete().in("partner_id", partnerIds),
        supabase.from("bpo_corrective_actions").delete().in("partner_id", partnerIds),
        supabase.from("bpo_capacity_matches").delete().in("partner_id", partnerIds),
        supabase.from("bpo_capacity_reservations").delete().in("partner_id", partnerIds),
        supabase.from("bpo_capacity_snapshots").delete().in("partner_id", partnerIds),
        supabase.from("bpo_centre_capacity").delete().in("partner_id", partnerIds),
        supabase.from("bpo_payout_statements").delete().in("partner_id", partnerIds),
        supabase.from("bpo_call_activities").delete().in("partner_id", partnerIds),
        supabase.from("bpo_integrations").delete().in("partner_id", partnerIds),
        supabase.from("bpo_agent_documents").delete().in("partner_id", partnerIds),
        supabase.from("bpo_agents").delete().in("partner_id", partnerIds),
        supabase.from("bpo_training_programs").delete().in("partner_id", partnerIds),
        supabase.from("bpo_partner_projects").delete().in("partner_id", partnerIds),
        supabase.from("bpo_project_applications").delete().in("partner_id", partnerIds),
        supabase.from("bpo_partner_meeting_users").delete().in("partner_id", partnerIds),
        supabase.from("bpo_partner_meetings").delete().in("partner_id", partnerIds),
        supabase.from("bpo_partner_documents").delete().in("partner_id", partnerIds),
        supabase.from("bpo_centres").delete().in("partner_id", partnerIds),
      ]);

      // Permissions & partner users
      const { data: puData } = await supabase.from("bpo_partner_users").select("id").in("partner_id", partnerIds);
      if (puData && puData.length > 0) {
        const puIds = puData.map((p: any) => p.id);
        await supabase.from("bpo_partner_user_permissions").delete().in("partner_user_id", puIds);
      }
      await supabase.from("bpo_partner_users").delete().in("partner_id", partnerIds);
    }

    // Direct user-linked partner rows
    await supabase.from("bpo_partner_users").delete().eq("user_id", userId);
    await supabase.from("bpo_partner_meeting_users").delete().eq("user_id", userId);
    await supabase.from("bpo_agents").delete().eq("profile_id", userId);
    await supabase.from("bpo_project_application_events").delete().eq("actor_user_id", userId);

    // 2.8 bpo_partner_applications
    if (applicationIds.length > 0) {
      await supabase.from("bpo_partner_applications").delete().in("id", applicationIds);
    }
    await supabase.from("bpo_partner_applications").delete().eq("applicant_user_id", userId);

    // 2.9 bpo_partners
    if (partnerIds.length > 0) {
      await supabase.from("bpo_partners").delete().in("id", partnerIds);
    }
    await supabase.from("bpo_partners").delete().eq("email", email);

    // 2.10 Conversations & messaging
    await supabase.from("agent_bpo_messages").delete().eq("sender_user_id", userId);
    await supabase.from("agent_bpo_conversations").delete().eq("bpo_user_id", userId);
    if (partnerIds.length > 0) {
      await supabase.from("agent_bpo_conversations").delete().in("bpo_partner_id", partnerIds);
    }

    // 2.11 Auxiliary user records
    await Promise.all([
      supabase.from("notifications").delete().eq("recipient_user_id", userId),
      supabase.from("notifications").delete().eq("user_id", userId),
      supabase.from("wallet_transactions").delete().eq("user_id", userId),
      supabase.from("wallets").delete().eq("user_id", userId),
      supabase.from("affiliate_referrals").delete().eq("referred_user_id", userId),
      supabase.from("documents").delete().eq("uploaded_by", userId),
    ]);

    // 2.12 profiles row
    const { error: profDeleteErr } = await supabase.from("profiles").delete().eq("id", userId);
    if (profDeleteErr) {
      logger.error({ err: profDeleteErr, userId }, "[BpoCleanup] Error deleting profile row");
      throw new Error(`Failed to delete profile record: ${profDeleteErr.message}`);
    }
    await supabase.from("profiles").delete().eq("email", email);
  } catch (dbErr: any) {
    logger.error({ err: dbErr?.message, userId }, "[BpoCleanup] Database cleanup failure");
    throw dbErr;
  }

  // ============================================================================
  // STEP 3: SUPABASE AUTH DELETION (Authoritative Admin API)
  // ============================================================================
  let authUserDeleted = false;
  try {
    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      const errMsg = authErr.message.toLowerCase();
      // If user is not found in auth.users, they were already removed or never registered in auth.users
      if (errMsg.includes("not found") || errMsg.includes("user not found")) {
        logger.info({ userId }, "[BpoCleanup] User not found in Supabase Auth (already purged)");
        authUserDeleted = true;
      } else {
        logger.error({ err: authErr, userId }, "[BpoCleanup] Supabase Auth deleteUser error");
        throw new Error(`Failed to delete Supabase Auth user: ${authErr.message}`);
      }
    } else {
      authUserDeleted = true;
      logger.info({ userId }, "[BpoCleanup] Supabase Auth user permanently deleted");
    }
  } catch (authEx: any) {
    logger.warn({ err: authEx?.message, userId }, "[BpoCleanup] Notice during Supabase Auth deleteUser");
    // If auth client error indicates user not found, accept as deleted
    if (authEx?.message?.toLowerCase()?.includes("not found")) {
      authUserDeleted = true;
    } else {
      throw authEx;
    }
  }

  // ============================================================================
  // STEP 4: IMMUTABLE AUDIT LOG PRESERVATION
  // ============================================================================
  let auditLogId: number | undefined;
  try {
    const { data: auditData } = await supabase
      .from("audit_logs")
      .insert({
        actor_admin_id: adminActor.id,
        action: "bpo_permanently_deleted",
        entity_type: "bpo_partner",
        entity_id: userId,
        metadata: {
          admin_username: adminActor.username,
          deleted_user_id: userId,
          deleted_email: email,
          deleted_company_name: companyName,
          deleted_full_name: fullName,
          deleted_application_ids: applicationIds,
          deleted_partner_ids: partnerIds,
          deleted_verification_ids: verificationIds,
          deleted_agreement_ids: agreementIds,
          media_files_purged: cleanedMediaCount,
          deletion_reason: reason || "Admin permanent deletion",
          timestamp: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (auditData?.id) {
      auditLogId = auditData.id;
    }
  } catch (auditErr: any) {
    logger.warn({ err: auditErr?.message }, "[BpoCleanup] Notice creating immutable audit log");
  }

  // ============================================================================
  // STEP 5: CACHE INVALIDATION
  // ============================================================================
  try {
    invalidateAdminBpoCache(userId);
    invalidateUserPartnerCache(userId);
  } catch {}

  logger.info({ userId, email, companyName }, "[BpoCleanup] Permanent deletion completed successfully");

  return {
    success: true,
    targetUserId: userId,
    targetEmail: email,
    companyName,
    cleaned: {
      applications: applicationIds.length,
      partners: partnerIds.length,
      verifications: verificationIds.length,
      agreements: agreementIds.length,
      mediaFiles: cleanedMediaCount,
      documents: cleanedDocCount,
      profile: true,
      authUser: authUserDeleted,
    },
    auditLogId,
  };
}
