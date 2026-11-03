import fs from "fs";
import path from "path";
import dns from "dns";
import crypto from "crypto";
import bcrypt from "../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs/index.js";

dns.setDefaultResultOrder("ipv4first");

function loadEnv() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const JWT_SECRET = process.env.USER_SESSION_SECRET || "thinkatic-user-secret-2026";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment");
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// Test Account Credentials
const OWNER_EMAIL = "owner.test@thinkatic.com";
const OWNER_PASSWORD = "256b2#owner";

const BPO_EMAIL = "bpo.test@thinkatic.com";
const BPO_PASSWORD = "256b2#bpo";

const encryptionKey = () => crypto.createHash("sha256").update(process.env.WITHDRAWAL_ENCRYPTION_KEY || JWT_SECRET).digest();
function encryptPayoutDetails(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

async function supaGet(table, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GET ${table} failed (${res.status}): ${txt}`);
  }
  return res.json();
}

async function supaPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${table} failed (${res.status}): ${txt}`);
  }
  return res.json();
}

async function supaPatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH ${table}?${query} failed (${res.status}): ${txt}`);
  }
  return res.json();
}

async function main() {
  console.log("==================================================================");
  console.log("THINKATIC — SEEDING DEDICATED DATABASE-BACKED E2E TEST ACCOUNTS");
  console.log(`Endpoint: ${SUPABASE_URL}`);
  console.log("==================================================================\n");

  const saltRounds = 10;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SEED OWNER / ADMIN TEST ACCOUNT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("[1/2] Seeding OWNER / ADMIN Test Account...");
  console.log(`Owner Email: ${OWNER_EMAIL}`);
  const ownerHash = await bcrypt.hash(OWNER_PASSWORD, saltRounds);

  // A. admin_users table
  const existingAdminUsers = await supaGet("admin_users", `username=eq.${encodeURIComponent(OWNER_EMAIL)}&select=id,username`);
  let adminUserId;
  if (existingAdminUsers.length > 0) {
    adminUserId = existingAdminUsers[0].id;
    console.log(`  Updating existing admin_users record (ID: ${adminUserId})...`);
    await supaPatch("admin_users", `id=eq.${adminUserId}`, {
      password_hash: ownerHash,
      updated_at: new Date().toISOString(),
    });
  } else {
    console.log("  Inserting new admin_users record...");
    const created = await supaPost("admin_users", {
      username: OWNER_EMAIL,
      password_hash: ownerHash,
    });
    adminUserId = created[0].id;
  }
  console.log(`  ✓ admin_users verified with ID: ${adminUserId}`);

  // B. profiles table (for unified RBAC)
  const existingOwnerProfiles = await supaGet("profiles", `email=eq.${encodeURIComponent(OWNER_EMAIL)}&select=id,email,role`);
  let ownerProfileId;
  if (existingOwnerProfiles.length > 0) {
    ownerProfileId = existingOwnerProfiles[0].id;
    console.log(`  Updating existing owner profile (ID: ${ownerProfileId})...`);
    await supaPatch("profiles", `id=eq.${ownerProfileId}`, {
      password_hash: ownerHash,
      full_name: "Thinkatic Owner / Admin",
      role: "admin",
      account_type: "USER",
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  } else {
    ownerProfileId = crypto.randomUUID();
    console.log(`  Inserting new owner profile (ID: ${ownerProfileId})...`);
    await supaPost("profiles", {
      id: ownerProfileId,
      email: OWNER_EMAIL,
      password_hash: ownerHash,
      full_name: "Thinkatic Owner / Admin",
      role: "admin",
      account_type: "USER",
      is_active: true,
    });
  }
  console.log(`  ✓ profiles record verified with role: admin`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SEED BPO PARTNER TEST ACCOUNT & COMPLETE RELATIONSHIPS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[2/2] Seeding BPO PARTNER Test Account & Ecosystem...");
  console.log(`BPO Email: ${BPO_EMAIL}`);
  const bpoHash = await bcrypt.hash(BPO_PASSWORD, saltRounds);

  // A. profiles table
  const existingBpoProfiles = await supaGet("profiles", `email=eq.${encodeURIComponent(BPO_EMAIL)}&select=id,email,role,account_type`);
  let bpoProfileId;
  const bpoAppDetails = {
    phone: "+1-800-555-0199",
    companyName: "Thinkatic Global BPO Services Ltd (TEST)",
    companyDetails: "Dedicated Enterprise BPO Delivery Centre for Platform Manual QA",
    documentDetails: "CERT-TEST-BPO-2026",
  };

  if (existingBpoProfiles.length > 0) {
    bpoProfileId = existingBpoProfiles[0].id;
    console.log(`  Updating existing BPO profile (ID: ${bpoProfileId})...`);
    await supaPatch("profiles", `id=eq.${bpoProfileId}`, {
      password_hash: bpoHash,
      full_name: "BPO Test Partner Admin",
      role: "bpo_partner",
      account_type: "BPO",
      bpo_status: "APPROVED",
      is_active: true,
      bpo_application_details: bpoAppDetails,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    bpoProfileId = crypto.randomUUID();
    console.log(`  Inserting new BPO profile (ID: ${bpoProfileId})...`);
    await supaPost("profiles", {
      id: bpoProfileId,
      email: BPO_EMAIL,
      password_hash: bpoHash,
      full_name: "BPO Test Partner Admin",
      role: "bpo_partner",
      account_type: "BPO",
      bpo_status: "APPROVED",
      is_active: true,
      bpo_application_details: bpoAppDetails,
      approved_at: new Date().toISOString(),
    });
  }
  console.log(`  ✓ profiles record verified with role: bpo_partner, bpo_status: APPROVED`);

  // B. bpo_partners table
  const partnerCode = "THK-US-NY-00001";
  const existingPartners = await supaGet("bpo_partners", `partner_code=eq.${encodeURIComponent(partnerCode)}&select=id,partner_code`);
  let partnerId;
  const partnerPayload = {
    partner_code: partnerCode,
    name: "Thinkatic Global BPO Services Ltd (TEST)",
    legal_name: "Thinkatic Global BPO Services Ltd (TEST)",
    contact_name: "BPO Test Partner Admin",
    email: BPO_EMAIL,
    phone: "+1-800-555-0199",
    address: "100 Tech Park Blvd, Floor 4, Suite 400, New York, NY 10001",
    status: "active",
    updated_at: new Date().toISOString(),
  };

  if (existingPartners.length > 0) {
    partnerId = existingPartners[0].id;
    console.log(`  Updating existing bpo_partners record (ID: ${partnerId})...`);
    await supaPatch("bpo_partners", `id=eq.${partnerId}`, partnerPayload);
  } else {
    console.log("  Inserting new bpo_partners record...");
    const created = await supaPost("bpo_partners", partnerPayload);
    partnerId = created[0].id;
  }
  console.log(`  ✓ bpo_partners record verified with code: ${partnerCode} (ID: ${partnerId})`);

  // C. bpo_partner_users table
  const existingMembers = await supaGet("bpo_partner_users", `partner_id=eq.${partnerId}&user_id=eq.${bpoProfileId}&select=id,role`);
  let partnerUserId;
  if (existingMembers.length > 0) {
    partnerUserId = existingMembers[0].id;
    console.log(`  Updating existing bpo_partner_users record (ID: ${partnerUserId})...`);
    await supaPatch("bpo_partner_users", `id=eq.${partnerUserId}`, {
      role: "partner_admin",
      status: "active",
    });
  } else {
    console.log("  Inserting new bpo_partner_users record...");
    const created = await supaPost("bpo_partner_users", {
      partner_id: partnerId,
      user_id: bpoProfileId,
      role: "partner_admin",
      status: "active",
    });
    partnerUserId = created[0].id;
  }
  console.log(`  ✓ bpo_partner_users verified (role: partner_admin)`);

  // D. bpo_partner_user_permissions table
  const permissionsList = await supaGet("bpo_permissions", "select=permission_key");
  if (permissionsList.length > 0) {
    const currentGrants = await supaGet("bpo_partner_user_permissions", `partner_user_id=eq.${partnerUserId}&select=permission_key`);
    const grantedSet = new Set(currentGrants.map((g) => g.permission_key));
    const missingPermissions = permissionsList.filter((p) => !grantedSet.has(p.permission_key));
    if (missingPermissions.length > 0) {
      console.log(`  Granting ${missingPermissions.length} missing permissions to partner admin...`);
      await supaPost(
        "bpo_partner_user_permissions",
        missingPermissions.map((p) => ({
          partner_user_id: partnerUserId,
          permission_key: p.permission_key,
        }))
      );
    }
  }
  console.log(`  ✓ bpo_partner_user_permissions granted full permission matrix`);

  // E. bpo_centres table
  const existingCentres = await supaGet("bpo_centres", `partner_id=eq.${partnerId}&select=id,name`);
  let centreId;
  const centrePayload = {
    partner_id: partnerId,
    name: "Thinkatic Global Delivery Centre - NY-01",
    location: "New York, USA",
    contact_name: "BPO Test Partner Admin",
    contact_phone: "+1-800-555-0199",
    email: BPO_EMAIL,
    capacity: 50,
    operating_hours: "24/7 Shift Coverage",
    status: "active",
    updated_at: new Date().toISOString(),
  };
  if (existingCentres.length > 0) {
    centreId = existingCentres[0].id;
    console.log(`  Updating existing bpo_centres record (ID: ${centreId})...`);
    await supaPatch("bpo_centres", `id=eq.${centreId}`, centrePayload);
  } else {
    console.log("  Inserting new bpo_centres record...");
    const created = await supaPost("bpo_centres", centrePayload);
    centreId = created[0].id;
  }
  console.log(`  ✓ bpo_centres record verified with capacity 50 (ID: ${centreId})`);

  // F. bpo_agents table
  const agentsData = [
    { employee_id: "AGT-TEST-001", name: "Alex Miller (Test Agent)", email: "alex.miller.test@thinkatic.com", agent_role: "agent" },
    { employee_id: "AGT-TEST-002", name: "Sarah Jenkins (Test Team Leader)", email: "sarah.jenkins.test@thinkatic.com", agent_role: "team_leader" },
    { employee_id: "AGT-TEST-003", name: "David Chen (Test Senior Agent)", email: "david.chen.test@thinkatic.com", agent_role: "agent" },
  ];

  for (const ag of agentsData) {
    const existingAgent = await supaGet("bpo_agents", `partner_id=eq.${partnerId}&employee_id=eq.${ag.employee_id}&select=id`);
    if (existingAgent.length > 0) {
      await supaPatch("bpo_agents", `id=eq.${existingAgent[0].id}`, {
        name: ag.name,
        email: ag.email,
        agent_role: ag.agent_role,
        centre_id: centreId,
        status: "active",
        updated_at: new Date().toISOString(),
      });
    } else {
      await supaPost("bpo_agents", {
        partner_id: partnerId,
        centre_id: centreId,
        employee_id: ag.employee_id,
        name: ag.name,
        email: ag.email,
        agent_role: ag.agent_role,
        status: "active",
      });
    }
  }
  console.log(`  ✓ bpo_agents seeded with ${agentsData.length} active agents`);

  // G. bpo_partner_applications table
  const appNumber = "APP-THK-TEST-001";
  const existingApps = await supaGet("bpo_partner_applications", `application_number=eq.${appNumber}&select=id`);
  let applicationId;
  const appPayload = {
    application_number: appNumber,
    applicant_user_id: bpoProfileId,
    partner_id: partnerId,
    status: "approved",
    current_stage: "centre_id_generated",
    company_data: {
      companyName: "Thinkatic Global BPO Services Ltd (TEST)",
      legalEntity: "Thinkatic Global BPO Services Ltd (TEST)",
      ownerName: "BPO Test Partner Admin",
      email: BPO_EMAIL,
      phone: "+1-800-555-0199",
      address: "100 Tech Park Blvd, Floor 4, Suite 400",
      city: "New York",
      state: "NY",
      country: "US",
      postalCode: "10001",
    },
    centre_data: {
      centreId: partnerCode,
      centreName: "Thinkatic Global Delivery Centre - NY-01",
      address: "100 Tech Park Blvd, Floor 4",
      city: "New York",
      totalSeats: 50,
    },
    infrastructure_data: {
      workstations: 50,
      powerBackup: true,
      dualISP: true,
      cctv: true,
      biometricAccess: true,
    },
    process_experience: ["Customer Support", "Technical Support", "Back Office / Data Operations"],
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUserId,
  };

  if (existingApps.length > 0) {
    applicationId = existingApps[0].id;
    console.log(`  Updating existing bpo_partner_applications record (ID: ${applicationId})...`);
    await supaPatch("bpo_partner_applications", `id=eq.${applicationId}`, appPayload);
  } else {
    console.log("  Inserting new bpo_partner_applications record...");
    const created = await supaPost("bpo_partner_applications", appPayload);
    applicationId = created[0].id;
  }
  console.log(`  ✓ bpo_partner_applications approved and in stage 'centre_id_generated' (ID: ${applicationId})`);

  // H. bpo_centre_verification & bpo_centre_media
  const existingVerif = await supaGet("bpo_centre_verification", `partner_id=eq.${partnerId}&select=id,status`);
  let verificationId;
  const verifPayload = {
    partner_id: partnerId,
    application_id: applicationId,
    centre_id: partnerCode,
    applicant_user_id: bpoProfileId,
    office_name: "Thinkatic Global Delivery Centre - NY-01",
    address_line_1: "100 Tech Park Blvd, Floor 4",
    city: "New York",
    state: "New York",
    country: "United States",
    postal_code: "10001",
    contact_number: "+1-800-555-0199",
    centre_type: "Dedicated BPO Facility",
    ownership_type: "Commercial Lease",
    operating_since: "2024",
    total_area_sqft: 7500,
    number_of_floors: 1,
    status: "NOT_STARTED",
    submitted_at: null,
    submission_count: 0,
    reviewed_at: null,
    reviewed_by_admin_id: null,
    reviewed_by_admin_name: null,
    updated_at: new Date().toISOString(),
  };

  if (existingVerif.length > 0) {
    verificationId = existingVerif[0].id;
    console.log(`  Updating existing bpo_centre_verification record (ID: ${verificationId})...`);
    await supaPatch("bpo_centre_verification", `id=eq.${verificationId}`, verifPayload);
  } else {
    console.log("  Inserting new bpo_centre_verification record...");
    const created = await supaPost("bpo_centre_verification", verifPayload);
    verificationId = created[0].id;
  }
  console.log(`  ✓ bpo_centre_verification initialized with status: NOT_STARTED, ZERO photo evidence (ID: ${verificationId})`);

  // I. bpo_partner_agreements table
  const agreementCode = "THK-GDP-00001";
  const existingAgreements = await supaGet("bpo_partner_agreements", `agreement_code=eq.${agreementCode}&select=id`);
  let agreementId;
  const agreementPayload = {
    agreement_code: agreementCode,
    partner_id: partnerId,
    application_id: applicationId,
    centre_id: partnerCode,
    version: "1.0",
    status: "approved",
    partner_legal_name: "Thinkatic Global BPO Services Ltd (TEST)",
    partner_trade_name: "Thinkatic Global BPO Services",
    registration_number: "NY-CORP-98421",
    registered_address: "100 Tech Park Blvd, Floor 4, Suite 400, New York, NY 10001",
    authorized_signatory_name: "BPO Test Partner Admin",
    authorized_signatory_designation: "Managing Director",
    contact_email: BPO_EMAIL,
    contact_phone: "+1-800-555-0199",
    thinkatic_legal_entity: "Healweal LLC",
    thinkatic_signatory_name: "Harshad Chavandke",
    thinkatic_signatory_designation: "Director",
    term_months: 11,
    royalty_percentage: 25.0,
    signed_document_url: "https://thinkatic.com/agreements/THK-GDP-00001-signed.pdf",
    signed_document_file_name: "THK-GDP-00001-signed.pdf",
    signed_document_file_size: 450000,
    signed_submitted_at: new Date().toISOString(),
    signed_submitted_by: bpoProfileId,
    approved_at: new Date().toISOString(),
    approved_by_admin_id: adminUserId,
    approved_by_admin_name: "Thinkatic Owner / Admin",
    is_immutable: true,
    updated_at: new Date().toISOString(),
  };

  if (existingAgreements.length > 0) {
    agreementId = existingAgreements[0].id;
    console.log(`  Updating existing bpo_partner_agreements record (ID: ${agreementId})...`);
    await supaPatch("bpo_partner_agreements", `id=eq.${agreementId}`, agreementPayload);
  } else {
    console.log("  Inserting new bpo_partner_agreements record...");
    const created = await supaPost("bpo_partner_agreements", agreementPayload);
    agreementId = created[0].id;
  }
  console.log(`  ✓ bpo_partner_agreements verified as approved & immutable (Code: ${agreementCode})`);

  // J. purchases table (to satisfy requireBpoWithdrawal / hasPaidBpo)
  const existingPurchases = await supaGet("purchases", `user_id=eq.${bpoProfileId}&package_id=eq.bpo-enterprise&status=eq.PAID&select=id`);
  if (existingPurchases.length === 0) {
    console.log("  Inserting paid BPO enterprise package in purchases...");
    await supaPost("purchases", {
      user_id: bpoProfileId,
      package_id: "bpo-enterprise",
      package_name: "BPO Enterprise Delivery Package",
      paypal_order_id: `order-bpo-test-${Date.now()}`,
      amount: 499.0,
      currency: "USD",
      status: "PAID",
      purchased_at: new Date().toISOString(),
    });
  }
  console.log("  ✓ purchases verified with paid 'bpo-enterprise' package");

  // K. wallets table
  const existingWallets = await supaGet("wallets", `user_id=eq.${bpoProfileId}&select=id,balance`);
  if (existingWallets.length === 0) {
    console.log("  Creating funded wallet for BPO partner...");
    await supaPost("wallets", {
      user_id: bpoProfileId,
      balance: 1500.0,
      currency: "USD",
    });
  } else {
    console.log(`  Wallet already present with balance: $${existingWallets[0].balance}`);
  }
  console.log("  ✓ wallets verified for BPO partner");

  // L. payout_details table
  const existingPayouts = await supaGet("payout_details", `user_id=eq.${bpoProfileId}&method=eq.paypal&select=id`);
  if (existingPayouts.length === 0) {
    console.log("  Saving payout method in payout_details...");
    await supaPost("payout_details", {
      user_id: bpoProfileId,
      method: "paypal",
      details_encrypted: encryptPayoutDetails({ paypalEmail: BPO_EMAIL }),
      display_label: `PayPal ending ${BPO_EMAIL.slice(-18)}`,
    });
  }
  console.log("  ✓ payout_details verified for BPO partner withdrawals");

  console.log("\n==================================================================");
  console.log("✅ BOTH DEDICATED TEST ACCOUNTS SUCCESSFULLY SEEDED IN SUPABASE!");
  console.log("==================================================================");
  console.log("OWNER/ADMIN ACCOUNT:");
  console.log(`  Username: ${OWNER_EMAIL}`);
  console.log(`  Password: [REDACTED]`);
  console.log("BPO PARTNER ACCOUNT:");
  console.log(`  Username: ${BPO_EMAIL}`);
  console.log(`  Password: [REDACTED]`);
  console.log(`  Centre ID: ${partnerCode}`);
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("Fatal error during test account seeding:", err);
  process.exit(1);
});
