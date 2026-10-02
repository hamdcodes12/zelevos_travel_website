import { Router, type IRouter } from "express";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import {
  db,
  bookingsTable,
  destinationsTable,
  packagesTable,
  partnersTable,
  vendorsTable,
  customTripRequestsTable,
  type Booking as BookingRow,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /api/admin/reports/analytics
 * Comprehensive real-time reporting analytics (Task 3)
 * Breakdown of revenue by category, booking volume, monthly trends, and performance.
 */
router.get(["/admin/reports/analytics", "/reports/analytics"], requireRole(["admin", "finance"]), async (req, res) => {
  try {
    const allBookings = await db
      .select()
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.createdAt));

    // 1. Overall Totals
    const totalBookings = allBookings.length;
    let totalRevenue = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let refundedCount = 0;

    // 2. Revenue & Volume by Category
    const categoryStats: Record<string, { count: number; revenue: number }> = {
      "Holiday Packages": { count: 0, revenue: 0 },
      "Custom Trips": { count: 0, revenue: 0 },
      "Flight Bookings": { count: 0, revenue: 0 },
      "Hotel Stays": { count: 0, revenue: 0 },
    };

    // 3. Monthly Trends (Map of 'YYYY-MM' -> stats)
    const monthMap = new Map<string, { bookings: number; revenue: number }>();

    // Generate past 6 calendar months for consistent charting
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, { bookings: 0, revenue: 0 });
    }

    // 4. Destination breakdown
    const destinationStats = new Map<string, { count: number; revenue: number }>();

    for (const b of allBookings) {
      const price = Number(b.totalPrice || b.amount || 0);
      const status = (b.status || "").toUpperCase();
      const isPaidOrConfirmed = status === "CONFIRMED" || status === "COMPLETED" || b.paymentStatus === "PAID" || b.paymentStatus === "SUCCESSFUL";

      if (isPaidOrConfirmed) {
        totalRevenue += price;
      }

      if (status === "CONFIRMED" || status === "COMPLETED") {
        confirmedCount++;
      } else if (status === "CANCELLED") {
        cancelledCount++;
      } else if (status === "REFUNDED") {
        refundedCount++;
      } else {
        pendingCount++;
      }

      // Categorize
      const payload = (b.payload || {}) as Record<string, any>;
      const isCustomTrip = Boolean(payload.leadNumber || b.providerReference?.startsWith("LEAD-") || b.bookingReference?.startsWith("CT-"));
      const isFlight = Boolean(b.flightRequired || b.kind === "FLIGHT");
      const isHotel = b.kind === "HOTEL";

      if (isCustomTrip) {
        categoryStats["Custom Trips"].count++;
        categoryStats["Custom Trips"].revenue += price;
      } else if (isHotel) {
        categoryStats["Hotel Stays"].count++;
        categoryStats["Hotel Stays"].revenue += price;
      } else if (isFlight && b.kind === "FLIGHT") {
        categoryStats["Flight Bookings"].count++;
        categoryStats["Flight Bookings"].revenue += price;
      } else {
        categoryStats["Holiday Packages"].count++;
        categoryStats["Holiday Packages"].revenue += price;
      }

      // Monthly Trend aggregation
      if (b.createdAt) {
        const cDate = new Date(b.createdAt);
        const mKey = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthMap.get(mKey) || { bookings: 0, revenue: 0 };
        existing.bookings += 1;
        if (isPaidOrConfirmed) {
          existing.revenue += price;
        }
        monthMap.set(mKey, existing);
      }

      // Destination aggregation
      const destName = payload.destinations?.[0] || payload.proposalTitle || "Curated India";
      const destEntry = destinationStats.get(destName) || { count: 0, revenue: 0 };
      destEntry.count += 1;
      destEntry.revenue += price;
      destinationStats.set(destName, destEntry);
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrends = Array.from(monthMap.entries()).map(([key, data]) => {
      const [year, month] = key.split("-");
      const name = `${monthNames[Number(month) - 1]} ${year}`;
      return {
        key,
        name,
        bookings: data.bookings,
        revenue: data.revenue,
      };
    });

    const categoryBreakdown = Object.entries(categoryStats).map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    }));

    const topDestinations = Array.from(destinationStats.entries())
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({
      status: "success",
      metrics: {
        totalBookings,
        totalRevenue,
        confirmedCount,
        pendingCount,
        cancelledCount,
        refundedCount,
        averageOrderValue: totalBookings > 0 ? Math.round(totalRevenue / (confirmedCount || 1)) : 0,
      },
      categoryBreakdown,
      monthlyTrends,
      topDestinations,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to generate analytics report");
    res.status(500).json({ status: "error", message: "Failed to generate analytics report." });
  }
});

/**
 * GET /api/admin/reports/export-csv
 * Streams authoritative CSV report of all booking transactions (Task 3)
 */
router.get(["/admin/reports/export-csv", "/admin/reports/export", "/reports/export-csv"], requireRole(["admin", "finance"]), async (req, res) => {
  try {
    const bookings = await db
      .select({
        id: bookingsTable.id,
        bookingId: bookingsTable.bookingId,
        kind: bookingsTable.kind,
        status: bookingsTable.status,
        paymentStatus: bookingsTable.paymentStatus,
        totalPrice: bookingsTable.totalPrice,
        travelDate: bookingsTable.travelDate,
        adultsCount: bookingsTable.adultsCount,
        roomsCount: bookingsTable.roomsCount,
        flightRequired: bookingsTable.flightRequired,
        partnerId: bookingsTable.partnerId,
        customerContact: bookingsTable.customerContact,
        createdAt: bookingsTable.createdAt,
        payload: bookingsTable.payload,
      })
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.createdAt));

    const csvEscape = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Booking Reference",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Booking Type",
      "Travel Date",
      "Adults",
      "Rooms",
      "Flight Required",
      "Booking Status",
      "Payment Status",
      "Total Price (INR)",
      "Created At",
    ];

    const rows = bookings.map((b: any) => {
      const contact = (b.customerContact || {}) as Record<string, string>;
      const payload = (b.payload || {}) as Record<string, any>;
      const type = payload.leadNumber ? "Custom Trip" : b.flightRequired ? "Flight + Holiday" : b.kind || "Package";
      return [
        csvEscape(b.bookingId),
        csvEscape(contact.name || "Customer"),
        csvEscape(contact.email || ""),
        csvEscape(contact.phone || ""),
        csvEscape(type),
        csvEscape(b.travelDate || "Flexible"),
        csvEscape(b.adultsCount || 1),
        csvEscape(b.roomsCount || 1),
        csvEscape(b.flightRequired ? "YES" : "NO"),
        csvEscape(b.status),
        csvEscape(b.paymentStatus),
        csvEscape(b.totalPrice || 0),
        csvEscape(b.createdAt ? new Date(b.createdAt).toISOString() : ""),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");

    const filename = `zelevos-bookings-report-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to export bookings CSV");
    res.status(500).json({ status: "error", message: "Failed to export CSV report." });
  }
});

export default router;
