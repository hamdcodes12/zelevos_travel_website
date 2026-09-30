import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { packagesTable } from "./inventory";
import { vendorsTable } from "./vendors";

export const BOOKING_STATUSES = [
  "PAYMENT_PENDING",
  "PAID",
  "PROCESSING",
  "PARTIALLY_CONFIRMED",
  "CONFIRMED",
  "ACTION_REQUIRED",
  "FAILED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const SERVICE_TASK_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "VERIFIED",
  "CONFIRMED",
  "CANCELLED",
] as const;
export type ServiceTaskStatus = typeof SERVICE_TASK_STATUSES[number];

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: text("booking_id").unique(), // ZL{YYMMDD}{seq} e.g. ZL2609180001
  customerId: uuid("customer_id").references(() => usersTable.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => packagesTable.id, { onDelete: "set null" }),
  partnerId: uuid("partner_id"),
  status: text("status").notNull().default("PAYMENT_PENDING"),
  travelDate: text("travel_date").default(""), // YYYY-MM-DD
  adultsCount: integer("adults_count").notNull().default(1),
  childrenCount: integer("children_count").notNull().default(0),
  infantsCount: integer("infants_count").notNull().default(0),
  roomsCount: integer("rooms_count").notNull().default(1),
  roomConfiguration: jsonb("room_configuration").$type<Array<{ roomNumber: number; adults: number; children: number; childAges?: number[] }>>().notNull().default([]),
  selectedAddons: jsonb("selected_addons").$type<string[]>().notNull().default([]),
  specialRequests: text("special_requests"),

  // Flight handling without API (Section 13)
  flightRequired: boolean("flight_required").notNull().default(false),
  flightRequirementDetails: jsonb("flight_requirement_details").$type<{
    preferredRoute?: string;
    preferredDates?: string;
    passengerNames?: string[];
    baggageRequirements?: string;
  }>(),
  flightPnr: text("flight_pnr"), // Uploaded manual PNR
  flightTicketUrl: text("flight_ticket_url"),
  flightStatus: text("flight_status").notNull().default("NONE"), // NONE, SUBJECT_TO_CONFIRMATION, TICKETED, CANCELLED

  // Pricing & Margins (Section 5 & 23)
  totalPrice: integer("total_price").notNull().default(0), // Customer final price in INR
  totalBaseCost: integer("total_base_cost").notNull().default(0), // Total supplier net cost in INR
  totalMarkup: integer("total_markup").notNull().default(0), // Expected markup in INR
  serviceFee: integer("service_fee").notNull().default(0),
  actualSupplierCost: integer("actual_supplier_cost"), // Actual supplier cost after fulfillment
  actualGrossMargin: integer("actual_gross_margin"), // Actual margin

  // Payment tracking
  paymentId: text("payment_id"),
  paymentOrderId: text("payment_order_id"),
  paymentStatus: text("payment_status").notNull().default("PENDING"), // PENDING, SUCCESSFUL, FAILED, REFUNDED

  // Timeline tracking (Section 11)
  timeline: jsonb("timeline").$type<Array<{
    event: string;
    timestamp: string;
    actor?: string;
    notes?: string;
  }>>().notNull().default([]),

  cancellationReason: text("cancellation_reason"),
  cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true }),
  refundAmount: integer("refund_amount"),
  itineraryUrl: text("itinerary_url"),
  customerContact: jsonb("customer_contact").$type<{ name: string; email: string; phone: string }>(),

  // Compatibility fields for legacy tests & flight routes
  ownerId: uuid("owner_id").references(() => usersTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key"),
  kind: text("kind").default("PACKAGE"),
  providerMode: text("provider_mode").default("DEMO"),
  providerReference: text("provider_reference").default(""),
  bookingReference: text("booking_reference").default(""),
  pnr: text("pnr"),
  ticketNumber: text("ticket_number"),
  offerId: text("offer_id"),
  flightOfferId: text("flight_offer_id"),
  emailStatus: text("email_status").default("PENDING"),
  clientEmail: text("client_email"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  emailError: text("email_error"),
  amount: integer("amount").default(0),
  passengers: jsonb("passengers").$type<any[]>().default([]),
  contact: jsonb("contact").$type<Record<string, any>>().default({}),
  fareSnapshot: jsonb("fare_snapshot").$type<Record<string, any>>().default({}),
  segments: jsonb("segments").$type<any[]>().default([]),
  addons: jsonb("addons").$type<Record<string, any>>().default({}),
  payload: jsonb("payload").$type<Record<string, any>>().default({}),
  cancellationDetails: jsonb("cancellation_details").$type<Record<string, any>>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookingServicesTable = pgTable("booking_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(), // hotel, transfer, activity, guide, flight_partner
  title: text("title").notNull(),
  serviceId: uuid("service_id"),
  hotelId: uuid("hotel_id"),
  transferId: uuid("transfer_id"),
  activityId: uuid("activity_id"),
  assignedVendorId: uuid("assigned_vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
  assignedOwner: text("assigned_owner").default("Operations Team"), // Ops user handle
  status: text("status").notNull().default("PENDING"), // PENDING, ASSIGNED, REQUESTED, ACCEPTED, REJECTED, VERIFIED, CONFIRMED, CANCELLED
  deadline: timestamp("deadline", { withTimezone: true }), // SLA deadline
  supplierNetCost: integer("supplier_net_cost").notNull().default(0),
  retailPrice: integer("retail_price").notNull().default(0),
  supplierConfirmationRef: text("supplier_confirmation_ref"),
  voucherUrl: text("voucher_url"),
  invoiceUrl: text("invoice_url"),
  customerFacingVerified: boolean("customer_facing_verified").notNull().default(false), // Gate: only true after ops verification
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const travellersTable = pgTable("travellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(), // Male, Female, Other
  isLead: boolean("is_lead").notNull().default(false),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  passportNumber: text("passport_number"),
  specialRequests: text("special_requests"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vouchersTable = pgTable("vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  bookingServiceId: uuid("booking_service_id").references(() => bookingServicesTable.id, { onDelete: "cascade" }),
  voucherCode: text("voucher_code").notNull().unique(), // e.g. VCH-ZL2609180001-HOTEL
  title: text("title").notNull(),
  serviceType: text("service_type").notNull(),
  vendorName: text("vendor_name"),
  documentUrl: text("document_url"),
  validFrom: text("valid_from"),
  validUntil: text("valid_until"),
  status: text("status").notNull().default("ISSUED"), // ISSUED, USED, CANCELLED
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingServiceSchema = createInsertSchema(bookingServicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTravellerSchema = createInsertSchema(travellersTable).omit({ id: true, createdAt: true });
export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, issuedAt: true });

export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type BookingService = typeof bookingServicesTable.$inferSelect;
export type InsertBookingService = z.infer<typeof insertBookingServiceSchema>;
export type Traveller = typeof travellersTable.$inferSelect;
export type Voucher = typeof vouchersTable.$inferSelect;