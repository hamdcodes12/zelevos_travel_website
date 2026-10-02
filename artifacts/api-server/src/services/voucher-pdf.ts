import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

export interface VoucherTripDetails {
  bookingId: string;
  bookingRef: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  destination: string;
  travelDate: string;
  adultsCount: number;
  childrenCount: number;
  travellers?: Array<{ name: string; age?: number; gender?: string; isLead?: boolean }>;
  version: number;
  sentAt?: Date | string;
  components: Array<{
    type: string;
    title: string;
    dayNumber?: number;
    details: Record<string, any>;
    notes?: string;
  }>;
}

export async function generateTripVoucherPdf(data: VoucherTripDetails): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const brandBlue = rgb(0.145, 0.388, 0.922); // #2563eb
  const darkNavy = rgb(0.059, 0.09, 0.165); // #0f172a
  const slateGray = rgb(0.392, 0.455, 0.545); // #64748b
  const lightBg = rgb(0.965, 0.976, 0.988); // #f8fafc
  const cardBorder = rgb(0.886, 0.91, 0.941); // #e2e8f0
  const emeraldGreen = rgb(0.02, 0.588, 0.412); // #059669
  const white = rgb(1, 1, 1);

  let currentY = height - 40;

  const checkPageOverflow = (neededHeight: number) => {
    if (currentY - neededHeight < 50) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = height - 40;
      // Repeat simple header on continuation page
      page.drawText("ZELEVOS TRIP VOUCHER (Continuation)", {
        x: 40,
        y: currentY,
        size: 10,
        font: fontBold,
        color: slateGray,
      });
      page.drawText(`Booking Ref: ${data.bookingRef}`, {
        x: width - 180,
        y: currentY,
        size: 10,
        font: fontBold,
        color: slateGray,
      });
      currentY -= 25;
    }
  };

  // Header Banner
  page.drawRectangle({
    x: 40,
    y: currentY - 55,
    width: width - 80,
    height: 65,
    color: brandBlue,

  });

  page.drawText("ZELEVOS", {
    x: 56,
    y: currentY - 24,
    size: 22,
    font: fontBold,
    color: white,
  });

  page.drawText("OFFICIAL CONFIRMED TRIP VOUCHER", {
    x: 56,
    y: currentY - 42,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.92, 1),
  });

  page.drawText(`VOUCHER REF: ${data.bookingRef}`, {
    x: width - 240,
    y: currentY - 24,
    size: 11,
    font: fontBold,
    color: white,
  });

  page.drawText(`STATUS: CONFIRMED (v${data.version})`, {
    x: width - 240,
    y: currentY - 42,
    size: 9,
    font: fontBold,
    color: rgb(0.85, 1, 0.85),
  });

  currentY -= 75;

  // Booking Summary Box
  page.drawRectangle({
    x: 40,
    y: currentY - 70,
    width: width - 80,
    height: 70,
    color: lightBg,
    borderColor: cardBorder,
    borderWidth: 1,
  });

  const totalPax = (data.adultsCount || 1) + (data.childrenCount || 0);

  // Column 1: Customer info
  page.drawText("PRIMARY TRAVELLER", { x: 56, y: currentY - 18, size: 8, font: fontBold, color: slateGray });
  page.drawText(data.customerName || "Valued Guest", { x: 56, y: currentY - 32, size: 12, font: fontBold, color: darkNavy });
  page.drawText(data.customerPhone || data.customerEmail || "Confirmed via Zelevos", { x: 56, y: currentY - 46, size: 9, font: fontRegular, color: slateGray });

  // Column 2: Destination & Dates
  page.drawText("DESTINATION & TRAVEL DATES", { x: 230, y: currentY - 18, size: 8, font: fontBold, color: slateGray });
  page.drawText(data.destination || "Holiday Destination", { x: 230, y: currentY - 32, size: 12, font: fontBold, color: darkNavy });
  page.drawText(`Travel Date: ${data.travelDate || "Scheduled"}`, { x: 230, y: currentY - 46, size: 9, font: fontRegular, color: slateGray });

  // Column 3: Party size & issuance
  page.drawText("TRAVELLERS", { x: 420, y: currentY - 18, size: 8, font: fontBold, color: slateGray });
  page.drawText(`${totalPax} Person${totalPax > 1 ? "s" : ""} (${data.adultsCount || 1}A${data.childrenCount ? `, ${data.childrenCount}C` : ""})`, { x: 420, y: currentY - 32, size: 11, font: fontBold, color: darkNavy });
  page.drawText(`Issued: ${new Date(data.sentAt || Date.now()).toLocaleDateString("en-IN")}`, { x: 420, y: currentY - 46, size: 9, font: fontRegular, color: emeraldGreen });

  currentY -= 90;

  // Section Title: Day-wise & Component Fulfillment Details
  page.drawText("CONFIRMED ITINERARY & GROUND ARRANGEMENTS", {
    x: 40,
    y: currentY,
    size: 12,
    font: fontBold,
    color: darkNavy,
  });

  page.drawLine({
    start: { x: 40, y: currentY - 6 },
    end: { x: width - 40, y: currentY - 6 },
    thickness: 1,
    color: cardBorder,
  });

  currentY -= 20;

  // Render each component
  for (let i = 0; i < data.components.length; i++) {
    const comp = data.components[i];
    const details = comp.details || {};
    const typeUpper = (comp.type || "OTHER").toUpperCase();

    // Estimate box height
    let boxHeight = 65;
    if (typeUpper === "HOTEL") boxHeight = 85;
    else if (typeUpper === "CAB") boxHeight = 78;
    else if (typeUpper === "BUS") boxHeight = 78;
    else if (typeUpper === "GUIDE" || typeUpper === "MEALS") boxHeight = 68;
    else if (typeUpper === "FLIGHT") boxHeight = 80;

    checkPageOverflow(boxHeight + 16);

    // Component Card
    page.drawRectangle({
      x: 40,
      y: currentY - boxHeight,
      width: width - 80,
      height: boxHeight,
      color: white,
      borderColor: cardBorder,
      borderWidth: 1,
    });

    // Tag badge
    const badgeColor =
      typeUpper === "HOTEL"
        ? rgb(0.145, 0.388, 0.922)
        : typeUpper === "CAB"
        ? rgb(0.02, 0.588, 0.412)
        : typeUpper === "BUS"
        ? rgb(0.792, 0.376, 0.035)
        : typeUpper === "FLIGHT"
        ? rgb(0.49, 0.235, 0.933)
        : rgb(0.392, 0.455, 0.545);

    page.drawRectangle({
      x: 50,
      y: currentY - 20,
      width: 70,
      height: 16,
      color: badgeColor,
    });

    page.drawText(typeUpper, {
      x: 56,
      y: currentY - 16,
      size: 8,
      font: fontBold,
      color: white,
    });

    // Title / Header
    page.drawText(comp.title || `${typeUpper} Arrangement`, {
      x: 130,
      y: currentY - 16,
      size: 11,
      font: fontBold,
      color: darkNavy,
    });

    if (comp.dayNumber) {
      page.drawText(`Day ${comp.dayNumber}`, {
        x: width - 100,
        y: currentY - 16,
        size: 9,
        font: fontBold,
        color: slateGray,
      });
    }

    // Specific component details
    const textStartY = currentY - 34;

    if (typeUpper === "HOTEL") {
      page.drawText(`Hotel: ${details.hotelName || "Confirmed Partner Hotel"}`, { x: 52, y: textStartY, size: 9, font: fontBold, color: darkNavy });
      page.drawText(`Room: ${details.roomType || "Standard Deluxe"} (${details.numberOfRooms || 1} Room${(details.numberOfRooms || 1) > 1 ? "s" : ""}) · Plan: ${details.mealPlan || "CP (Breakfast)"}`, { x: 52, y: textStartY - 12, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Address: ${details.fullAddress || "City Center"}`, { x: 52, y: textStartY - 24, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Check-in: ${details.checkInDate || data.travelDate} (${details.checkInTime || "14:00"}) · Check-out: ${details.checkOutDate || "Flexible"} (${details.checkOutTime || "11:00"})`, { x: 52, y: textStartY - 36, size: 8.5, font: fontRegular, color: slateGray });
      if (details.hotelPhone || details.confirmationNumber) {
        page.drawText(`Hotel Phone: ${details.hotelPhone || "N/A"} · Conf #: ${details.confirmationNumber || data.bookingRef}`, { x: 52, y: textStartY - 48, size: 8.5, font: fontBold, color: brandBlue });
      }
    } else if (typeUpper === "CAB") {
      page.drawText(`Chauffeur: ${details.driverName || "Assigned Chauffeur"}  ·  Phone: ${details.driverPhone || "Provided on Arrival"}`, { x: 52, y: textStartY, size: 9, font: fontBold, color: darkNavy });
      page.drawText(`Vehicle: ${details.vehicleModel || "Dedicated Private Vehicle"}  ·  Reg #: ${details.vehicleRegistrationNumber || "Verified Commercial"}`, { x: 52, y: textStartY - 13, size: 8.5, font: fontBold, color: emeraldGreen });
      page.drawText(`Pickup: ${details.pickupPoint || "Airport / Designated Station"} at ${details.pickupDateTime || "Arrival"}`, { x: 52, y: textStartY - 26, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Drop: ${details.dropPoint || "Hotel / Full Circuit Tour"}`, { x: 52, y: textStartY - 38, size: 8.5, font: fontRegular, color: slateGray });
    } else if (typeUpper === "BUS") {
      page.drawText(`Operator: ${details.operatorName || "Express Line"}  ·  Bus Type: ${details.busType || "Volvo AC Multi-Axle"}`, { x: 52, y: textStartY, size: 9, font: fontBold, color: darkNavy });
      page.drawText(`Bus Reg: ${details.busRegistrationNumber || "N/A"}  ·  Seat(s): ${details.seatNumbers || "Reserved"}  ·  PNR: ${details.ticketPnr || data.bookingRef}`, { x: 52, y: textStartY - 13, size: 8.5, font: fontBold, color: darkNavy });
      page.drawText(`Boarding: ${details.boardingPoint || "Main Depot"} at ${details.departureDateTime || "Scheduled"}`, { x: 52, y: textStartY - 26, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Arrival: ${details.arrivalPoint || "Destination"} at ${details.arrivalDateTime || "Scheduled"}  ·  Phone: ${details.operatorPhone || "N/A"}`, { x: 52, y: textStartY - 38, size: 8.5, font: fontRegular, color: slateGray });
    } else if (typeUpper === "GUIDE") {
      page.drawText(`Certified Guide: ${details.guideName || "Local Cultural Guide"}  ·  Phone: ${details.phone || "Provided on Arrival"}`, { x: 52, y: textStartY, size: 9, font: fontBold, color: darkNavy });
      page.drawText(`Meeting Point: ${details.meetingPoint || "Hotel Lobby / Monument Entrance"} at ${details.dateTime || "Morning"}`, { x: 52, y: textStartY - 13, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Languages: ${details.languages || "English, Hindi"}`, { x: 52, y: textStartY - 26, size: 8.5, font: fontRegular, color: slateGray });
    } else if (typeUpper === "MEALS") {
      page.drawText(`Dining Partner: ${details.providerName || "Curated Restaurant Partner"}`, { x: 52, y: textStartY, size: 9, font: fontBold, color: darkNavy });
      page.drawText(`Address: ${details.address || "Destination Center"}  ·  Timings: ${details.timings || "Meal Hours"}`, { x: 52, y: textStartY - 13, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Included: ${details.mealsIncluded || "As per package meal plan"}`, { x: 52, y: textStartY - 26, size: 8.5, font: fontRegular, color: slateGray });
    } else if (typeUpper === "FLIGHT") {
      page.drawText(`Airline: ${details.airline || "Scheduled Carrier"}  ·  Flight: ${details.flightNumber || "Direct"}  ·  PNR: ${details.pnr || data.bookingRef}`, { x: 52, y: textStartY, size: 9, font: fontBold, color: darkNavy });
      page.drawText(`Route: ${details.fromAirport || "Origin"} ➔ ${details.toAirport || "Destination"}`, { x: 52, y: textStartY - 13, size: 9, font: fontBold, color: brandBlue });
      page.drawText(`Departure: ${details.departureDateTime || "Scheduled"}  ·  Arrival: ${details.arrivalDateTime || "Scheduled"}`, { x: 52, y: textStartY - 26, size: 8.5, font: fontRegular, color: slateGray });
      page.drawText(`Baggage Allowance: ${details.baggage || "15kg Check-in + 7kg Cabin"}`, { x: 52, y: textStartY - 39, size: 8.5, font: fontRegular, color: slateGray });
    } else {
      page.drawText(comp.notes || "Service details confirmed by Zelevos operations team.", { x: 52, y: textStartY, size: 8.5, font: fontRegular, color: slateGray });
    }

    currentY -= boxHeight + 12;
  }

  // Emergency & Support Footer Box
  checkPageOverflow(90);

  page.drawRectangle({
    x: 40,
    y: currentY - 75,
    width: width - 80,
    height: 75,
    color: rgb(0.98, 0.98, 1),
    borderColor: rgb(0.75, 0.85, 1),
    borderWidth: 1,
  });

  page.drawText("ZELEVOS 24/7 TRIP CONCIERGE & EMERGENCY SUPPORT", {
    x: 52,
    y: currentY - 18,
    size: 9,
    font: fontBold,
    color: brandBlue,
  });

  page.drawText("National Helpline: 1800-ZELEVOS (Toll-Free)  ·  Ground Hotline: +91 98765 00000  ·  Email: support@zelevos.com", {
    x: 52,
    y: currentY - 32,
    size: 8.5,
    font: fontBold,
    color: darkNavy,
  });

  page.drawText("Important Note: Please present this voucher along with valid government photo ID upon check-in and boarding.", {
    x: 52,
    y: currentY - 45,
    size: 8,
    font: fontOblique,
    color: slateGray,
  });

  page.drawText("All drivers, hotels and suppliers listed in this voucher have been verified and approved by Zelevos.", {
    x: 52,
    y: currentY - 57,
    size: 8,
    font: fontRegular,
    color: slateGray,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
