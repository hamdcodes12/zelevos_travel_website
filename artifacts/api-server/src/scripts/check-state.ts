import { db, partnersTable, commissionsTable, bookingsTable, refundsTable, type Booking, type Partner } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

async function main() {
  const partners = await db.select().from(partnersTable);
  console.log("=== PARTNERS ===");
  console.log(partners.map((p: Partner) => ({ id: p.id, name: p.agencyName, code: p.referralCode, status: p.status })));

  // If Starlight Voyages is pending, approve it
  for (const p of partners) {
    if (p.status !== "approved") {
      await db.update(partnersTable).set({ status: "approved" }).where(eq(partnersTable.id, p.id));
      console.log(`Approved partner: ${p.agencyName} (${p.referralCode})`);
    }
  }

  const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
  console.log("=== BOOKINGS ===");
  console.log(bookings.map((b: Booking) => ({ id: b.id, bookingId: b.bookingId, status: b.status, total: b.totalPrice, partnerId: b.partnerId })));

  // Ensure Starlight Voyages India partner exists
  let [starlight] = await db.select().from(partnersTable).where(eq(partnersTable.agencyName, "Starlight Voyages India")).limit(1);
  if (!starlight) {
    [starlight] = await db.insert(partnersTable).values({
      partnerId: "PRT-STARLIGHT-01",
      agencyName: "Starlight Voyages India",
      contactName: "Rhea Kapoor",
      email: "rhea@starlight.travel",
      phone: "+91 98334 11223",
      referralCode: "STARLIGHT10",
      status: "approved",
      commissionRatePercent: "5.0",
      totalBookingsCount: 0,
      totalCommissionEarned: 0,
    }).returning();
    console.log("Created partner Starlight Voyages India:", starlight.referralCode);
  }

  // Create commission for booking if none exists
  const commissions = await db.select().from(commissionsTable);
  if (commissions.length === 0 && bookings.length > 0) {
    const b = bookings[0];
    const rate = 5.0;
    const commissionAmount = Math.round((b.totalPrice * rate) / 100);
    await db.insert(commissionsTable).values({
      partnerId: starlight.id,
      bookingId: b.id,
      bookingAmount: b.totalPrice,
      commissionPercent: String(rate),
      commissionAmount,
      status: "pending",
    });
    await db.update(bookingsTable).set({ partnerId: starlight.id }).where(eq(bookingsTable.id, b.id));
    await db.update(partnersTable).set({
      totalBookingsCount: 1,
      totalCommissionEarned: commissionAmount,
    }).where(eq(partnersTable.id, starlight.id));
    console.log(`Created commission of ₹${commissionAmount} for booking ${b.bookingId} linked to Starlight Voyages India`);
  }

  // If a booking is cancelled / cancel requested, ensure refund row exists
  const cancelledBookings = bookings.filter((b: Booking) => b.status === "cancel_requested" || b.status === "cancelled");
  const refunds = await db.select().from(refundsTable);
  if (refunds.length === 0 && cancelledBookings.length > 0) {
    const cb = cancelledBookings[0];
    const refundAmount = Math.round(cb.totalPrice * 0.9);
    await db.insert(refundsTable).values({
      bookingId: cb.id,
      refundAmount,
      cancellationFee: cb.totalPrice - refundAmount,
      reason: "Customer requested cancellation via portal",
      status: "pending",
    });
    console.log(`Created refund record of ₹${refundAmount} for cancelled booking ${cb.bookingId}`);
  }

  const finalCommissions = await db.select().from(commissionsTable);
  console.log("=== FINAL COMMISSIONS ===");
  console.log(finalCommissions);

  const finalRefunds = await db.select().from(refundsTable);
  console.log("=== FINAL REFUNDS ===");
  console.log(finalRefunds);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
