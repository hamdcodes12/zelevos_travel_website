import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  bookingsTable,
  packagesTable,
  vendorsTable,
  vendorServicesTable,
  tripFulfillmentsTable,
  tripFulfillmentItemsTable,
  notificationsTable,
  adminNotificationsTable,
  auditLogsTable,
  usersTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { requireAuthOrAdmin } from "../middlewares/authMiddleware";
import { generateTripVoucherPdf, type VoucherTripDetails } from "../services/voucher-pdf";
import { sendTripFulfillmentEmail } from "../services/email-service";
import { logAuditAction } from "../services/booking-engine";

const router: IRouter = Router();

// Validation helpers
export const INDIAN_PHONE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;
export const INDIAN_VEHICLE_REG_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i;

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function isBookingPaid(booking: any): boolean {
  if (!booking) return false;
  const payStatus = (booking.paymentStatus || "").toUpperCase();
  const status = (booking.status || "").toUpperCase();
  return (
    payStatus === "CAPTURED" ||
    payStatus === "SUCCESSFUL" ||
    payStatus === "PAID" ||
    status === "CONFIRMED" ||
    status === "PAID"
  );
}

async function resolveCurrentVendor(req: any) {
  if (req.user?.vendorId) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, req.user.vendorId)).limit(1);
    if (v) return v;
  }
  if (req.user?.email) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, req.user.email.toLowerCase())).limit(1);
    if (v) return v;
  }
  return null;
}

// --------------------------------------------------------------------------
// 1. ADMIN: GET / INITIALIZE FULFILLMENT FOR A BOOKING
// --------------------------------------------------------------------------
router.get("/admin/bookings/:bookingId/fulfillment", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const bookingId = typeof req.params.bookingId === "string" ? req.params.bookingId : String(req.params.bookingId || "");

  try {
    const bookingQuery = isUuid(bookingId)
      ? eq(bookingsTable.id, bookingId)
      : eq(bookingsTable.bookingId, bookingId);

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(bookingQuery)
      .limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    const paid = isBookingPaid(booking);

    // Look for existing fulfillment
    let [fulfillment] = await db
      .select()
      .from(tripFulfillmentsTable)
      .where(eq(tripFulfillmentsTable.bookingId, booking.id))
      .limit(1);

    // If no fulfillment exists and booking is paid, auto-initialize draft components based on package
    if (!fulfillment && paid) {
      const [newFulfillment] = await db
        .insert(tripFulfillmentsTable)
        .values({
          bookingId: booking.id,
          status: "DRAFT",
          version: 1,
        })
        .returning();

      fulfillment = newFulfillment;

      // Inspect package for inclusions to populate default components
      let pkg: any = null;
      if (booking.packageId) {
        const [foundPkg] = await db.select().from(packagesTable).where(eq(packagesTable.id, booking.packageId)).limit(1);
        pkg = foundPkg;
      }

      const initialComponents: Array<{
        componentType: string;
        title: string;
        dayNumber: number;
        sequence: number;
        details: Record<string, any>;
      }> = [];

      let seq = 1;

      // 1. Hotel Component
      const durationNights = pkg?.durationNights || (pkg?.durationDays ? pkg.durationDays - 1 : 1);
      initialComponents.push({
        componentType: "HOTEL",
        title: `${pkg?.title || "Destination"} Hotel Accommodations`,
        dayNumber: 1,
        sequence: seq++,
        details: {
          hotelName: "",
          fullAddress: pkg?.locations?.[0] ? `${pkg.locations[0]} City Center` : "Main City Center",
          hotelPhone: "",
          checkInDate: booking.travelDate || "",
          checkInTime: "14:00",
          checkOutDate: "",
          checkOutTime: "11:00",
          nights: durationNights,
          roomType: "Deluxe Room",
          numberOfRooms: booking.roomsCount || 1,
          mealPlan: "CP (Breakfast Included)",
          confirmationNumber: "",
        },
      });

      // 2. Cab / Dedicated Transfer Component
      initialComponents.push({
        componentType: "CAB",
        title: "Dedicated Private Chauffeur & Transfers",
        dayNumber: 1,
        sequence: seq++,
        details: {
          driverName: "",
          driverPhone: "",
          vehicleModel: "Toyota Innova Crysta / Sedan",
          vehicleRegistrationNumber: "",
          pickupPoint: "Airport / Railway Station",
          pickupDateTime: `${booking.travelDate || ""} 10:00 AM`,
          dropPoint: "Full Circuit Tour & Departure Airport",
        },
      });

      // 3. Guide / Local Experience Component (if inclusions mention guide, shikara, tour or sightseeing)
      const inclusionsStr = JSON.stringify(pkg?.inclusions || []).toLowerCase();
      if (inclusionsStr.includes("guide") || inclusionsStr.includes("shikara") || inclusionsStr.includes("safari") || inclusionsStr.includes("gondola")) {
        initialComponents.push({
          componentType: "GUIDE",
          title: "Local Sightseeing & Cultural Guide",
          dayNumber: 2,
          sequence: seq++,
          details: {
            guideName: "",
            phone: "",
            languages: "English, Hindi",
            meetingPoint: "Hotel Lobby",
            dateTime: `${booking.travelDate || ""} 09:30 AM`,
          },
        });
      }

      // 4. Flight component if requested
      if (booking.flightRequired) {
        initialComponents.push({
          componentType: "FLIGHT",
          title: "Flight Tickets & Boarding Passes",
          dayNumber: 1,
          sequence: seq++,
          details: {
            airline: "IndiGo / Air India",
            flightNumber: "",
            pnr: booking.flightPnr || "",
            fromAirport: "DEL",
            toAirport: "SXR",
            departureDateTime: `${booking.travelDate || ""} 07:00 AM`,
            arrivalDateTime: `${booking.travelDate || ""} 08:30 AM`,
            baggage: "15kg Check-in + 7kg Cabin",
            ticketUrl: booking.flightTicketUrl || "",
          },
        });
      }

      for (const comp of initialComponents) {
        await db.insert(tripFulfillmentItemsTable).values({
          fulfillmentId: fulfillment.id,
          componentType: comp.componentType,
          title: comp.title,
          dayNumber: comp.dayNumber,
          sequence: comp.sequence,
          status: "PENDING",
          details: comp.details,
        });
      }
    }

    // Fetch items with assigned vendor details
    let items: any[] = [];
    if (fulfillment) {
      const rawItems = await db
        .select({
          item: tripFulfillmentItemsTable,
          vendorBusinessName: vendorsTable.businessName,
          vendorContact: vendorsTable.contactName,
          vendorEmail: vendorsTable.email,
          vendorPhone: vendorsTable.phone,
          vendorStatus: vendorsTable.status,
        })
        .from(tripFulfillmentItemsTable)
        .leftJoin(vendorsTable, eq(tripFulfillmentItemsTable.vendorId, vendorsTable.id))
        .where(eq(tripFulfillmentItemsTable.fulfillmentId, fulfillment.id))
        .orderBy(tripFulfillmentItemsTable.dayNumber, tripFulfillmentItemsTable.sequence);

      items = rawItems.map((r: any) => ({
        ...r.item,
        assignedVendor: r.item.vendorId
          ? {
              id: r.item.vendorId,
              businessName: r.vendorBusinessName,
              contactName: r.vendorContact,
              email: r.vendorEmail,
              phone: r.vendorPhone,
              status: r.vendorStatus,
            }
          : null,
      }));
    }

    res.json({
      status: "success",
      booking: {
        id: booking.id,
        bookingId: booking.bookingId,
        destination: booking.specialRequests?.includes("Destination:") ? booking.specialRequests : "Kashmir",
        travelDate: booking.travelDate,
        adultsCount: booking.adultsCount,
        childrenCount: booking.childrenCount,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
        isPaid: paid,
      },
      fulfillment,
      items,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to load booking fulfillment." });
  }
});

// --------------------------------------------------------------------------
// 2. ADMIN: GET ELIGIBLE APPROVED VENDORS FOR A COMPONENT
// --------------------------------------------------------------------------
router.get("/admin/fulfillment/vendors", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const category = typeof req.query.category === "string" ? req.query.category.trim().toLowerCase() : "";
  const destination = typeof req.query.destination === "string" ? req.query.destination.trim().toLowerCase() : "";

  try {
    // Only approved, non-suspended vendors
    const allVendors = await db
      .select()
      .from(vendorsTable)
      .where(
        and(
          or(eq(vendorsTable.approvalStatus, "approved"), eq(vendorsTable.status, "APPROVED")),
          or(eq(vendorsTable.status, "APPROVED"), eq(vendorsTable.status, "active"))
        )
      );

    // Filter by matching category
    const catSearch = category === "cab" ? ["cab", "transfer"] : [category];

    const matchedVendors = allVendors.filter((v: any) => {
      // Exclude suspended
      const vStatus = (v.status || v.approvalStatus || "").toUpperCase();
      if (vStatus === "SUSPENDED" || v.suspensionType === "TEMPORARY" || v.suspensionType === "PERMANENT") {
        return false;
      }

      if (!category) return true;
      const cats: string[] = Array.isArray(v.serviceCategories) ? v.serviceCategories.map((c: string) => c.toLowerCase()) : [];
      return catSearch.some((cs) => cats.some((c) => c === cs || c.includes(cs)));
    });

    // Fetch vendor services for rates and location matching
    const vendorIds = matchedVendors.map((v: any) => v.id);
    const services = vendorIds.length > 0
      ? await db
          .select()
          .from(vendorServicesTable)
          .where(and(inArray(vendorServicesTable.vendorId, vendorIds), eq(vendorServicesTable.status, "active")))
      : [];

    // Map and prioritize vendors with service location matching destination ("Suggested")
    const enriched = matchedVendors.map((v: any) => {
      const vServices = services.filter((s: any) => s.vendorId === v.id);
      const matchingService = vServices.find((s: any) => {
        const sType = s.serviceType.toLowerCase();
        return catSearch.some((cs) => sType === cs || sType.includes(cs));
      });

      const locations: string[] = Array.isArray(v.operatingLocations)
        ? v.operatingLocations.map((l: string) => l.toLowerCase())
        : [];

      const locMatch =
        destination &&
        (locations.some((l) => l.includes(destination) || destination.includes(l)) ||
          (matchingService && matchingService.location.toLowerCase().includes(destination)));

      return {
        id: v.id,
        vendorId: v.vendorId,
        businessName: v.businessName,
        contactName: v.contactName,
        email: v.email,
        phone: v.phone,
        categories: v.serviceCategories,
        locations: v.operatingLocations,
        suggested: Boolean(locMatch),
        matchedService: matchingService
          ? {
              id: matchingService.id,
              title: matchingService.title,
              location: matchingService.location,
              rate: matchingService.rate,
            }
          : null,
        listedRate: matchingService?.rate || null,
      };
    });

    // Sort: Suggested first, then alphabetical
    enriched.sort((a: any, b: any) => {
      if (a.suggested && !b.suggested) return -1;
      if (!a.suggested && b.suggested) return 1;
      return a.businessName.localeCompare(b.businessName);
    });

    res.json({
      status: "success",
      vendors: enriched,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch fulfillment vendors." });
  }
});

// --------------------------------------------------------------------------
// 3. ADMIN: ADD COMPONENT MANUALLY
// --------------------------------------------------------------------------
router.post("/admin/bookings/:bookingId/fulfillment/items", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const bookingId = typeof req.params.bookingId === "string" ? req.params.bookingId : String(req.params.bookingId || "");
  const { componentType, title, dayNumber, sequence, notes } = req.body;

  if (!componentType || !title) {
    res.status(400).json({ status: "invalid_request", message: "Component type and title are required." });
    return;
  }

  try {
    const bookingQuery = isUuid(bookingId) ? eq(bookingsTable.id, bookingId) : eq(bookingsTable.bookingId, bookingId);
    const [booking] = await db.select().from(bookingsTable).where(bookingQuery).limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    let [fulfillment] = await db.select().from(tripFulfillmentsTable).where(eq(tripFulfillmentsTable.bookingId, booking.id)).limit(1);
    if (!fulfillment) {
      const [newF] = await db.insert(tripFulfillmentsTable).values({ bookingId: booking.id, status: "DRAFT", version: 1 }).returning();
      fulfillment = newF;
    }

    const [item] = await db
      .insert(tripFulfillmentItemsTable)
      .values({
        fulfillmentId: fulfillment.id,
        componentType: componentType.toUpperCase(),
        title,
        dayNumber: Number(dayNumber) || 1,
        sequence: Number(sequence) || 1,
        status: "PENDING",
        details: {},
        notes: notes || null,
      })
      .returning();

    res.status(201).json({ status: "success", item });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to add component." });
  }
});

// --------------------------------------------------------------------------
// 4. ADMIN: ASSIGN VENDOR TO COMPONENT
// --------------------------------------------------------------------------
router.post("/admin/bookings/:bookingId/fulfillment/items/:itemId/assign", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");
  const { vendorId } = req.body;

  if (!vendorId) {
    res.status(400).json({ status: "invalid_request", message: "Vendor ID is required." });
    return;
  }

  try {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId)).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Selected vendor not found in portal catalog." });
      return;
    }

    const vStatus = (vendor.status || vendor.approvalStatus || "").toUpperCase();
    if (vStatus !== "APPROVED" || vendor.suspensionType === "TEMPORARY" || vendor.suspensionType === "PERMANENT") {
      res.status(400).json({ status: "vendor_ineligible", message: "Vendor must be active, approved and non-suspended." });
      return;
    }

    const [updated] = await db
      .update(tripFulfillmentItemsTable)
      .set({
        vendorId: vendor.id,
        status: "ASSIGNED",
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tripFulfillmentItemsTable.id, itemId))
      .returning();

    if (!updated) {
      res.status(404).json({ status: "not_found", message: "Component item not found." });
      return;
    }

    // Create vendor notification
    await db.insert(notificationsTable).values({
      userId: vendor.userId || undefined,
      recipientEmail: vendor.email || undefined,
      type: "BOOKING_ASSIGNED",
      category: "BOOKING",
      title: `New Assignment: ${updated.title}`,
      body: `You have been assigned to arrange ${updated.componentType} for an upcoming trip. Open Booking Tasks to accept.`,
      channel: "in_app",
      status: "SENT",
      metadata: { fulfillmentItemId: updated.id, vendorId: vendor.id },
    });

    res.json({
      status: "success",
      item: updated,
      message: `Assigned to ${vendor.businessName}. Task dispatched to vendor portal.`,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to assign vendor." });
  }
});

// --------------------------------------------------------------------------
// 5. ADMIN: EDIT / APPROVE COMPONENT DETAILS
// --------------------------------------------------------------------------
router.put("/admin/bookings/:bookingId/fulfillment/items/:itemId", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");
  const { title, dayNumber, sequence, status, details, notes } = req.body;

  try {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (dayNumber !== undefined) updateData.dayNumber = Number(dayNumber);
    if (sequence !== undefined) updateData.sequence = Number(sequence);
    if (status !== undefined) {
      updateData.status = status;
      if (status === "APPROVED") updateData.approvedAt = new Date();
    }
    if (details !== undefined) updateData.details = details;
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db
      .update(tripFulfillmentItemsTable)
      .set(updateData)
      .where(eq(tripFulfillmentItemsTable.id, itemId))
      .returning();

    if (!updated) {
      res.status(404).json({ status: "not_found", message: "Component item not found." });
      return;
    }

    res.json({ status: "success", item: updated });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to update component." });
  }
});

// --------------------------------------------------------------------------
// 6. ADMIN: DELETE COMPONENT
// --------------------------------------------------------------------------
router.delete("/admin/bookings/:bookingId/fulfillment/items/:itemId", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");
  try {
    await db.delete(tripFulfillmentItemsTable).where(eq(tripFulfillmentItemsTable.id, itemId));
    res.json({ status: "success", message: "Component removed." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to delete component." });
  }
});

// --------------------------------------------------------------------------
// 7. VENDOR: GET ASSIGNED FULFILLMENT TASKS (SANITIZED — NO CUSTOMER CONTACT)
// --------------------------------------------------------------------------
router.get("/vendor/portal/fulfillment-tasks", requireRole(["vendor", "admin", "operations_manager"]), async (req, res): Promise<void> => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found." });
      return;
    }

    const rows = await db
      .select({
        item: tripFulfillmentItemsTable,
        fulfillmentStatus: tripFulfillmentsTable.status,
        bookingRef: bookingsTable.bookingId,
        destination: bookingsTable.specialRequests, // We'll extract destination cleanly
        travelDate: bookingsTable.travelDate,
        adults: bookingsTable.adultsCount,
        children: bookingsTable.childrenCount,
        specialRequests: bookingsTable.specialRequests,
        packageId: bookingsTable.packageId,
      })
      .from(tripFulfillmentItemsTable)
      .innerJoin(tripFulfillmentsTable, eq(tripFulfillmentItemsTable.fulfillmentId, tripFulfillmentsTable.id))
      .innerJoin(bookingsTable, eq(tripFulfillmentsTable.bookingId, bookingsTable.id))
      .where(eq(tripFulfillmentItemsTable.vendorId, vendor.id))
      .orderBy(desc(tripFulfillmentItemsTable.createdAt));

    // PRIVACY ENFORCEMENT: Never attach customerPhone or customerEmail!
    const tasks = rows.map((r: any) => ({
      id: r.item.id,
      componentType: r.item.componentType,
      title: r.item.title,
      status: r.item.status,
      dayNumber: r.item.dayNumber,
      sequence: r.item.sequence,
      details: r.item.details,
      notes: r.item.notes,
      assignedAt: r.item.assignedAt,
      submittedAt: r.item.submittedAt,
      approvedAt: r.item.approvedAt,
      // Trip requirements context (NO client email / phone!)
      bookingRef: r.bookingRef,
      destination: "Kashmir",
      travelDate: r.travelDate,
      adultsCount: r.adults,
      childrenCount: r.children,
      totalTravellers: (r.adults || 1) + (r.children || 0),
      tripRequirements: r.specialRequests || "Standard confirmed booking inclusions.",
    }));

    res.json({ status: "success", tasks });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch fulfillment tasks." });
  }
});

// --------------------------------------------------------------------------
// 8. VENDOR: ACCEPT FULFILLMENT TASK
// --------------------------------------------------------------------------
router.post("/vendor/portal/fulfillment-tasks/:itemId/accept", requireRole(["vendor", "admin", "operations_manager"]), async (req, res): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found." });
      return;
    }

    const [item] = await db.select().from(tripFulfillmentItemsTable).where(eq(tripFulfillmentItemsTable.id, itemId)).limit(1);
    if (!item) {
      res.status(404).json({ status: "not_found", message: "Task item not found." });
      return;
    }

    // IDOR Protection: Vendor must own this task
    if (item.vendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to accept tasks assigned to another vendor." });
      return;
    }

    // Check suspension
    const vStatus = (vendor.status || vendor.approvalStatus || "").toUpperCase();
    if (vStatus === "SUSPENDED" || vendor.suspensionType === "TEMPORARY" || vendor.suspensionType === "PERMANENT") {
      res.status(403).json({ status: "account_suspended", message: "Your supplier account is suspended and cannot accept tasks." });
      return;
    }

    const [updated] = await db
      .update(tripFulfillmentItemsTable)
      .set({
        notes: item.notes ? `${item.notes}\n[Vendor Accepted at ${new Date().toISOString()}]` : `[Vendor Accepted at ${new Date().toISOString()}]`,
        updatedAt: new Date(),
      })
      .where(eq(tripFulfillmentItemsTable.id, itemId))
      .returning();

    await logAuditAction({
      action: "VENDOR_ACCEPTED_FULFILLMENT_TASK",
      resourceType: "trip_fulfillment_item",
      resourceId: item.id,
      actorName: vendor.businessName,
      actorRole: "vendor",
    });

    res.json({
      status: "success",
      item: updated,
      message: "Task accepted. Please submit the arrangement details.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to accept task." });
  }
});

// --------------------------------------------------------------------------
// 9. VENDOR: DECLINE FULFILLMENT TASK
// --------------------------------------------------------------------------
router.post("/vendor/portal/fulfillment-tasks/:itemId/decline", requireRole(["vendor", "admin", "operations_manager"]), async (req, res): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");
  const { reason } = req.body;

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found." });
      return;
    }

    const [item] = await db.select().from(tripFulfillmentItemsTable).where(eq(tripFulfillmentItemsTable.id, itemId)).limit(1);
    if (!item || item.vendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Not authorized for this task." });
      return;
    }

    // Reset task to PENDING and unassign vendor
    const [updated] = await db
      .update(tripFulfillmentItemsTable)
      .set({
        vendorId: null,
        status: "PENDING",
        notes: `Vendor ${vendor.businessName} declined: ${reason || "Capacity constraint"}`,
        updatedAt: new Date(),
      })
      .where(eq(tripFulfillmentItemsTable.id, itemId))
      .returning();

    // Notify admin to reassign
    await db.insert(notificationsTable).values({
      type: "TASK_DECLINED",
      title: `Vendor Declined: ${item.title}`,
      body: `Vendor "${vendor.businessName}" declined task (${item.componentType}). Reason: ${reason || "Unspecified"}. Please reassign.`,
      channel: "in_app",
      status: "SENT",
    });

    res.json({
      status: "success",
      message: "Task declined. Admin has been notified for reassignment.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to decline task." });
  }
});

// --------------------------------------------------------------------------
// 10. VENDOR: SUBMIT ARRANGEMENT FORM
// --------------------------------------------------------------------------
router.post("/vendor/portal/fulfillment-tasks/:itemId/submit", requireRole(["vendor", "admin", "operations_manager"]), async (req, res): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");
  const details = req.body?.details || {};

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found." });
      return;
    }

    const [item] = await db.select().from(tripFulfillmentItemsTable).where(eq(tripFulfillmentItemsTable.id, itemId)).limit(1);
    if (!item || item.vendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Not authorized for this task." });
      return;
    }

    // Component-specific validation
    const typeUpper = (item.componentType || "").toUpperCase();

    if (typeUpper === "HOTEL") {
      if (!details.hotelName?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Hotel name is required." });
        return;
      }
      if (!details.fullAddress?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Hotel address is required." });
        return;
      }
      if (details.hotelPhone && !INDIAN_PHONE_REGEX.test(details.hotelPhone.replace(/\s+/g, ""))) {
        res.status(400).json({ status: "invalid_request", message: "Invalid Indian phone number for hotel." });
        return;
      }
    } else if (typeUpper === "CAB") {
      if (!details.driverName?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Driver name is required." });
        return;
      }
      if (!details.driverPhone?.trim() || !INDIAN_PHONE_REGEX.test(details.driverPhone.replace(/\s+/g, ""))) {
        res.status(400).json({ status: "invalid_request", message: "Valid 10-digit Indian driver phone number is required." });
        return;
      }
      if (!details.vehicleRegistrationNumber?.trim() || !INDIAN_VEHICLE_REG_REGEX.test(details.vehicleRegistrationNumber.replace(/\s+/g, ""))) {
        res.status(400).json({ status: "invalid_request", message: "Valid Indian vehicle registration number is required (e.g. JK01AB1234)." });
        return;
      }
    } else if (typeUpper === "BUS") {
      if (!details.operatorName?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Bus operator name is required." });
        return;
      }
      if (details.busRegistrationNumber && !INDIAN_VEHICLE_REG_REGEX.test(details.busRegistrationNumber.replace(/\s+/g, ""))) {
        res.status(400).json({ status: "invalid_request", message: "Valid Indian bus registration number is required." });
        return;
      }
    } else if (typeUpper === "GUIDE") {
      if (!details.guideName?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Guide name is required." });
        return;
      }
      if (details.phone && !INDIAN_PHONE_REGEX.test(details.phone.replace(/\s+/g, ""))) {
        res.status(400).json({ status: "invalid_request", message: "Valid Indian phone number is required for guide." });
        return;
      }
    } else if (typeUpper === "MEALS") {
      if (!details.providerName?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Dining provider / restaurant name is required." });
        return;
      }
    } else if (typeUpper === "FLIGHT") {
      if (!details.airline?.trim() || !details.pnr?.trim()) {
        res.status(400).json({ status: "invalid_request", message: "Airline and PNR reference are required." });
        return;
      }
    }

    const [updated] = await db
      .update(tripFulfillmentItemsTable)
      .set({
        details,
        status: "SUBMITTED",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tripFulfillmentItemsTable.id, itemId))
      .returning();

    // Notify Admin of submission
    try {
      await db.insert(adminNotificationsTable).values({
        type: "SUPPLIER_APPLICATION",
        module: "operations",
        relatedId: updated.id,
        title: `Arrangements Submitted: ${updated.title}`,
        message: `Vendor "${vendor.businessName}" submitted arrangement details for ${updated.componentType}. Ready for admin review and approval.`,
        priority: "NORMAL",
      });
    } catch (notifErr) {
      console.warn("[Admin Notification Error]", notifErr);
    }

    try {
      await logAuditAction({
        action: "VENDOR_SUBMITTED_FULFILLMENT_DETAILS",
        resourceType: "trip_fulfillment_item",
        resourceId: updated.id,
        actorName: vendor.businessName,
        actorRole: "vendor",
      });
    } catch (auditErr) {
      console.warn("[Audit Log Error]", auditErr);
    }

    res.json({
      status: "success",
      item: updated,
      message: "Details submitted successfully to Zelevos Operations Desk.",
    });
  } catch (error: any) {
    console.error("[Submit Vendor Task Error]", error);
    res.status(500).json({ status: "error", message: error.message || "Failed to submit arrangement details." });
  }
});

// --------------------------------------------------------------------------
// 11. ADMIN: SEND EVERYTHING TO CUSTOMER (ONE BUTTON DISPATCH)
// --------------------------------------------------------------------------
router.post("/admin/bookings/:bookingId/fulfillment/send", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const bookingId = typeof req.params.bookingId === "string" ? req.params.bookingId : String(req.params.bookingId || "");

  try {
    const bookingQuery = isUuid(bookingId) ? eq(bookingsTable.id, bookingId) : eq(bookingsTable.bookingId, bookingId);
    const [booking] = await db.select().from(bookingsTable).where(bookingQuery).limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    // Step 6 Rule: Only enabled when payment is captured
    if (!isBookingPaid(booking)) {
      res.status(400).json({
        status: "payment_required",
        message: "Payment must be captured before sending trip fulfillment to customer.",
      });
      return;
    }

    const [fulfillment] = await db.select().from(tripFulfillmentsTable).where(eq(tripFulfillmentsTable.bookingId, booking.id)).limit(1);
    if (!fulfillment) {
      res.status(400).json({ status: "no_fulfillment", message: "No fulfillment found for this booking." });
      return;
    }

    const items = await db
      .select()
      .from(tripFulfillmentItemsTable)
      .where(eq(tripFulfillmentItemsTable.fulfillmentId, fulfillment.id))
      .orderBy(tripFulfillmentItemsTable.dayNumber, tripFulfillmentItemsTable.sequence);

    if (items.length === 0) {
      res.status(400).json({ status: "empty_fulfillment", message: "Cannot send empty fulfillment. Add components first." });
      return;
    }

    // Step 6 Rule: All components must be approved
    const unapproved = items.filter((i: any) => i.status !== "APPROVED");
    if (unapproved.length > 0) {
      res.status(400).json({
        status: "components_pending_approval",
        message: `All components must be approved before sending. (${unapproved.length} component(s) still ${unapproved[0].status}).`,
      });
      return;
    }

    // a) Save fulfillment as SENT (version 1) or UPDATED (version + 1)
    const nextVersion = fulfillment.status === "SENT" || fulfillment.status === "UPDATED" ? (fulfillment.version || 1) + 1 : 1;
    const nextStatus = nextVersion > 1 ? "UPDATED" : "SENT";

    // Destination determination
    let destination = "Kashmir";
    if (booking.packageId) {
      const [pkg] = await db.select().from(packagesTable).where(eq(packagesTable.id, booking.packageId)).limit(1);
      if (pkg?.locations?.[0]) destination = pkg.locations[0];
      else if (pkg?.title) destination = pkg.title.split(":")[0];
    }

    // Resolve customer contact
    const contact = (booking.customerContact || {}) as { name?: string; email?: string; phone?: string };
    let customerName = contact.name || "Valued Traveller";
    let customerEmail = contact.email || booking.clientEmail || "";
    let customerPhone = contact.phone || "";

    if ((!customerEmail || !customerName) && booking.customerId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, booking.customerId)).limit(1);
      if (user) {
        customerName = customerName || user.fullName || "Traveller";
        customerEmail = customerEmail || user.email;
        customerPhone = customerPhone || user.phone || "";
      }
    }

    // b) Generate server-side PDF Trip Voucher
    const voucherData: VoucherTripDetails = {
      bookingId: booking.id,
      bookingRef: booking.bookingId || "ZL-TRIP",
      customerName,
      customerEmail,
      customerPhone,
      destination,
      travelDate: booking.travelDate || "Confirmed",
      adultsCount: booking.adultsCount || 1,
      childrenCount: booking.childrenCount || 0,
      version: nextVersion,
      sentAt: new Date(),
      components: items.map((i: any) => ({
        type: i.componentType,
        title: i.title,
        dayNumber: i.dayNumber,
        details: i.details || {},
        notes: i.notes || undefined,
      })),
    };

    const pdfBuffer = await generateTripVoucherPdf(voucherData);

    // c) Store PDF privately
    const uploadsDir = path.resolve(process.cwd(), "artifacts/api-server/uploads/vouchers");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const safePdfFileName = `voucher-${booking.id}-v${nextVersion}.pdf`;
    const fullPdfPath = path.join(uploadsDir, safePdfFileName);
    fs.writeFileSync(fullPdfPath, pdfBuffer);

    // Update fulfillment record
    const [updatedFulfillment] = await db
      .update(tripFulfillmentsTable)
      .set({
        status: nextStatus,
        version: nextVersion,
        sentAt: new Date(),
        sentBy: req.admin?.adminId || "admin",
        pdfPath: `/uploads/vouchers/${safePdfFileName}`,
        lastEmailStatus: "SENT",
        lastEmailError: null,
        updatedAt: new Date(),
      })
      .where(eq(tripFulfillmentsTable.id, fulfillment.id))
      .returning();

    // d) Email customer with PDF attached
    let emailFailed = false;
    let emailErrorMsg = "";
    if (customerEmail && customerEmail.includes("@")) {
      try {
        const emailRes = await sendTripFulfillmentEmail({
          toEmail: customerEmail,
          customerName,
          bookingRef: booking.bookingId || "ZL-TRIP",
          destination,
          travelDate: booking.travelDate || "Confirmed",
          components: items.map((i: any) => ({
            type: i.componentType,
            title: i.title,
            details: i.details || {},
          })),
          pdfBuffer,
        });

        if (!emailRes.success) {
          emailFailed = true;
          emailErrorMsg = emailRes.error || "Email delivery unsuccessful";
        }
      } catch (err: any) {
        emailFailed = true;
        emailErrorMsg = err.message || "Failed to dispatch email";
      }
    }

    if (emailFailed) {
      await db
        .update(tripFulfillmentsTable)
        .set({ lastEmailStatus: "FAILED", lastEmailError: emailErrorMsg })
        .where(eq(tripFulfillmentsTable.id, fulfillment.id));
    }

    // e) Create in-app TRIP_DETAILS notification in customer's bell panel
    const targetUserId = booking.customerId || booking.ownerId;
    if (targetUserId) {
      await db.insert(notificationsTable).values({
        userId: targetUserId,
        type: "TRIP_DETAILS",
        title: "Your trip details are ready — tap to view",
        body: `All hotel, driver and itinerary arrangements for ${destination} are finalized. Tap to view your confirmed details and download voucher.`,
        channel: "in_app",
        status: "SENT",
        metadata: {
          bookingId: booking.id,
          bookingRef: booking.bookingId,
          version: nextVersion,
        },
      });
    }

    // f) Write audit log entry
    await logAuditAction({
      action: "FULFILLMENT_SENT_TO_CUSTOMER",
      resourceType: "trip_fulfillment",
      resourceId: updatedFulfillment.id,
      newValue: {
        version: nextVersion,
        status: nextStatus,
        customerEmail,
        componentsCount: items.length,
        emailFailed,
      },
      actorName: req.admin?.adminId || "Admin",
      actorRole: "admin",
    });

    res.json({
      status: "success",
      fulfillment: updatedFulfillment,
      emailFailed,
      error: emailFailed ? emailErrorMsg : undefined,
      message: emailFailed
        ? "Saved, but email failed — Retry email"
        : `Trip fulfillment successfully sent to ${customerEmail || "customer"}. Version: v${nextVersion}.`,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to send fulfillment." });
  }
});

// --------------------------------------------------------------------------
// 12. ADMIN: RETRY EMAIL
// --------------------------------------------------------------------------
router.post("/admin/bookings/:bookingId/fulfillment/retry-email", requireRole(["admin", "operations_manager"]), async (req, res): Promise<void> => {
  const bookingId = typeof req.params.bookingId === "string" ? req.params.bookingId : String(req.params.bookingId || "");

  try {
    const bookingQuery = isUuid(bookingId) ? eq(bookingsTable.id, bookingId) : eq(bookingsTable.bookingId, bookingId);
    const [booking] = await db.select().from(bookingsTable).where(bookingQuery).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    const [fulfillment] = await db.select().from(tripFulfillmentsTable).where(eq(tripFulfillmentsTable.bookingId, booking.id)).limit(1);
    if (!fulfillment || !fulfillment.pdfPath) {
      res.status(400).json({ status: "invalid_state", message: "No sent voucher exists to retry." });
      return;
    }

    const items = await db.select().from(tripFulfillmentItemsTable).where(eq(tripFulfillmentItemsTable.fulfillmentId, fulfillment.id));
    const fullPdfPath = path.resolve(process.cwd(), "artifacts/api-server", fulfillment.pdfPath.replace(/^\//, ""));
    let pdfBuffer: Buffer;
    if (fs.existsSync(fullPdfPath)) {
      pdfBuffer = fs.readFileSync(fullPdfPath);
    } else {
      res.status(404).json({ status: "file_not_found", message: "Voucher PDF file missing." });
      return;
    }

    const contact = (booking.customerContact || {}) as { name?: string; email?: string };
    const customerEmail = contact.email || booking.clientEmail || "";
    const customerName = contact.name || "Valued Guest";

    const emailRes = await sendTripFulfillmentEmail({
      toEmail: customerEmail,
      customerName,
      bookingRef: booking.bookingId || "ZL-TRIP",
      destination: "Kashmir",
      travelDate: booking.travelDate || "Confirmed",
      components: items.map((i: any) => ({ type: i.componentType, title: i.title, details: i.details || {} })),
      pdfBuffer,
    });

    if (emailRes.success) {
      await db.update(tripFulfillmentsTable).set({ lastEmailStatus: "SENT", lastEmailError: null }).where(eq(tripFulfillmentsTable.id, fulfillment.id));
      res.json({ status: "success", message: `Email delivered to ${customerEmail}.` });
    } else {
      res.status(500).json({ status: "error", message: emailRes.error || "Retry failed." });
    }
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to retry email." });
  }
});

// --------------------------------------------------------------------------
// 13. CUSTOMER / OWNER: GET TRIP DETAILS CARDS FOR MY TRIPS
// --------------------------------------------------------------------------
router.get("/bookings/:idOrBookingId/fulfillment", requireAuthOrAdmin, async (req, res): Promise<void> => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

  try {
    const isStaff =
      Boolean(req.admin) ||
      req.user?.role === "admin" ||
      req.user?.role === "operations_manager" ||
      req.user?.role === "finance";

    const queryConditions = [
      isUuid(idOrBookingId) ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId),
    ];

    if (!isStaff) {
      queryConditions.push(
        or(
          eq(bookingsTable.ownerId, req.user!.id),
          eq(bookingsTable.customerId, req.user!.id)
        )!
      );
    }

    const [booking] = await db.select().from(bookingsTable).where(and(...queryConditions)).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    const paid = isBookingPaid(booking);
    if (!paid) {
      res.json({
        status: "unpaid",
        message: "Payment pending. Trip fulfillment begins once payment is captured.",
      });
      return;
    }

    const [fulfillment] = await db.select().from(tripFulfillmentsTable).where(eq(tripFulfillmentsTable.bookingId, booking.id)).limit(1);

    // If not sent yet, show arranging message
    if (!fulfillment || (fulfillment.status !== "SENT" && fulfillment.status !== "UPDATED" && !isStaff)) {
      res.json({
        status: "arranging",
        message: "Our team is arranging your trip. Hotel, driver and transport details will appear here and in your email.",
      });
      return;
    }

    const items = await db
      .select()
      .from(tripFulfillmentItemsTable)
      .where(eq(tripFulfillmentItemsTable.fulfillmentId, fulfillment.id))
      .orderBy(tripFulfillmentItemsTable.dayNumber, tripFulfillmentItemsTable.sequence);

    res.json({
      status: "confirmed",
      confirmationMessage: "Your booking is fully confirmed from A to Z — you're all set to travel.",
      fulfillment: {
        id: fulfillment.id,
        status: fulfillment.status,
        version: fulfillment.version,
        sentAt: fulfillment.sentAt,
        hasVoucher: Boolean(fulfillment.pdfPath),
      },
      items: items.map((i: any) => ({
        id: i.id,
        componentType: i.componentType,
        title: i.title,
        dayNumber: i.dayNumber,
        status: i.status,
        details: i.details || {},
        notes: i.notes,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch fulfillment details." });
  }
});

// --------------------------------------------------------------------------
// 14. SECURE PDF VOUCHER DOWNLOAD (IDOR PROTECTED)
// --------------------------------------------------------------------------
router.get("/bookings/:idOrBookingId/trip-voucher", requireAuthOrAdmin, async (req, res): Promise<void> => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

  try {
    const isStaff =
      Boolean(req.admin) ||
      req.user?.role === "admin" ||
      req.user?.role === "operations_manager" ||
      req.user?.role === "finance";

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(isUuid(idOrBookingId) ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId))
      .limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    if (!isStaff) {
      // STRICT IDOR: Only the verified owner of this booking can download
      const isOwner =
        Boolean(req.user?.id && booking.ownerId === req.user.id) ||
        Boolean(req.user?.id && booking.customerId === req.user.id);

      if (!isOwner) {
        res.status(403).json({
          status: "forbidden",
          message: "You are not authorized to access this trip voucher.",
        });
        return;
      }
    }

    const [fulfillment] = await db.select().from(tripFulfillmentsTable).where(eq(tripFulfillmentsTable.bookingId, booking.id)).limit(1);
    if (!fulfillment || !fulfillment.pdfPath) {
      res.status(404).send("Trip voucher has not been issued yet.");
      return;
    }

    const fullPdfPath = path.resolve(process.cwd(), "artifacts/api-server", fulfillment.pdfPath.replace(/^\//, ""));
    if (!fs.existsSync(fullPdfPath)) {
      res.status(404).send("Voucher file could not be found on server.");
      return;
    }

    const pdfBuffer = fs.readFileSync(fullPdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Zelevos-Voucher-${booking.bookingId || "TRIP"}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).send("Error reading trip voucher.");
  }
});

export default router;