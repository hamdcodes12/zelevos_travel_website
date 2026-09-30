import fs from "node:fs";
import path from "node:path";
import {
  db,
  usersTable,
  packagesTable,
  destinationsTable,
  vendorsTable,
  bookingsTable,
  bookingServicesTable,
  paymentsTable,
  refundsTable,
  partnersTable,
  slaSettingsTable,
  auditLogsTable,
} from "../lib/db/src/index.ts";

async function runBackup() {
  console.log("==================================================");
  console.log("  ZELEVOS DATABASE BACKUP RUNNER (GAP 6)");
  console.log("==================================================");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(process.cwd(), "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `zelevos-backup-${timestamp}.json`);
  console.log(`[Backup] Exporting data to: ${backupFilePath}`);

  try {
    const [
      users,
      packages,
      destinations,
      vendors,
      bookings,
      bookingServices,
      payments,
      refunds,
      partners,
      slaSettings,
      auditLogs,
    ] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(packagesTable),
      db.select().from(destinationsTable),
      db.select().from(vendorsTable),
      db.select().from(bookingsTable),
      db.select().from(bookingServicesTable),
      db.select().from(paymentsTable),
      db.select().from(refundsTable),
      db.select().from(partnersTable),
      db.select().from(slaSettingsTable),
      db.select().from(auditLogsTable),
    ]);

    const snapshot = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      metadata: {
        totalTables: 11,
        counts: {
          users: users.length,
          packages: packages.length,
          destinations: destinations.length,
          vendors: vendors.length,
          bookings: bookings.length,
          bookingServices: bookingServices.length,
          payments: payments.length,
          refunds: refunds.length,
          partners: partners.length,
          slaSettings: slaSettings.length,
          auditLogs: auditLogs.length,
        },
      },
      data: {
        users,
        packages,
        destinations,
        vendors,
        bookings,
        bookingServices,
        payments,
        refunds,
        partners,
        slaSettings,
        auditLogs,
      },
    };

    const jsonStr = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(backupFilePath, jsonStr, "utf-8");

    const stat = fs.statSync(backupFilePath);
    console.log(`[Backup] ✅ Backup successfully created!`);
    console.log(`[Backup] File Size: ${(stat.size / 1024).toFixed(2)} KB`);
    console.log(`[Backup] Entities Dumped:`, snapshot.metadata.counts);
    console.log("==================================================");
    return { success: true, filePath: backupFilePath, sizeBytes: stat.size };
  } catch (err) {
    console.error("[Backup] ❌ Failed to create database snapshot:", err);
    process.exit(1);
  }
}

// Execute if run directly
if (process.argv[1]?.endsWith("backup-database.ts") || process.argv[1]?.endsWith("backup-database.js")) {
  runBackup().then(() => process.exit(0));
}

export { runBackup };
