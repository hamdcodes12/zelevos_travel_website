// ==============================================================================
// THINKATIC GLOBAL DELIVERY PARTNER AGREEMENT — PDF ENGINE
// Single Source of Truth Template: Agreement/Agreement.pdf (23 Pages)
// Preserves: 23 pages, ReportLab layout, Thinkatic branding, headers, footers,
//            page numbering, tables, clauses 1-58, Schedules A through E.
// Populates: Verified Partner details, Agreement ID, Effective Date, Schedule A
// Invariant: Strictly NO E-Sign, Strictly NO AI. Output is an authentic, valid PDF.
// ==============================================================================

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { getDomainPath, saveFile } from "./storageService.js";
export { PDFDocument };

const logger = {
  info: (obj: any, msg?: string) => {
    if (process.env.NODE_ENV !== "test") console.log(`[PDFEngine] ${msg || ""}`, obj || "");
  },
  warn: (obj: any, msg?: string) => {
    console.warn(`[PDFEngine WARN] ${msg || ""}`, obj || "");
  },
  error: (obj: any, msg?: string) => {
    console.error(`[PDFEngine ERROR] ${msg || ""}`, obj || "");
  },
};

// ASCII85 Decoder for ReportLab streams
export function decodeAscii85(str: string): Buffer {
  str = str.replace(/\s+/g, "");
  if (str.endsWith("~>")) str = str.slice(0, -2);
  const out: number[] = [];
  for (let i = 0; i < str.length; i += 5) {
    const chunk = str.slice(i, i + 5);
    if (chunk === "z") {
      out.push(0, 0, 0, 0);
      continue;
    }
    let val = 0;
    const pad = 5 - chunk.length;
    let paddedChunk = chunk;
    for (let p = 0; p < pad; p++) paddedChunk += "u";
    for (let j = 0; j < 5; j++) {
      val = val * 85 + (paddedChunk.charCodeAt(j) - 33);
    }
    const b = [
      (val >>> 24) & 255,
      (val >>> 16) & 255,
      (val >>> 8) & 255,
      val & 255,
    ];
    out.push(...b.slice(0, 4 - pad));
  }
  return Buffer.from(out);
}

// Escape strings for PDF literal parenthesis text syntax ( ... )
export function escapePdfText(text: any): string {
  if (text === null || text === undefined) return "";
  const s = String(text).trim();
  // Escape backslash, then parens
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// Format date into standard DD/MM/YYYY format
export function formatAgreementDate(dateInput?: string | Date | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Locate official 23-page source agreement PDF
 * Single Source of Truth: Agreement/Agreement.pdf
 */
export function getOfficialAgreementPdfPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "Agreement", "BPO Agreement.pdf"),
    path.resolve(process.cwd(), "..", "..", "Agreement", "BPO Agreement.pdf"),
    path.resolve(process.cwd(), "Agreement", "Agreement.pdf"),
    path.resolve(process.cwd(), "..", "..", "Agreement", "Agreement.pdf"),
    path.resolve(process.cwd(), "data", "Thinkatic_Global_Delivery_Partner_Agreement.pdf"),
    path.resolve(process.cwd(), "attached_assets", "Thinkatic_Global_Delivery_Partner_Agreement.pdf"),
    path.resolve(process.cwd(), "..", "..", "attached_assets", "Thinkatic_Global_Delivery_Partner_Agreement.pdf"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const buf = fs.readFileSync(c);
        if (buf.length > 100000 && buf.indexOf(Buffer.from("/Count 23")) !== -1) {
          return c;
        }
      } catch {}
    }
  }

  // Fallback to first existing candidate
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  throw new Error("Official Agreement PDF template not found at Agreement/BPO Agreement.pdf");
}

export interface PopulatePartnerData {
  legalName: string;
  tradeName?: string;
  registrationNumber?: string;
  registeredAddress?: string;
  operationalAddress?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
  ownerDirector?: string;
  centreId?: string;
  totalSeats?: number | string;
  availableSeats?: number | string;
  currentAgents?: number | string;
  supervisors?: number | string;
  languages?: string;
  countriesServed?: string;
  workingHours?: string;
  internetCapacity?: string;
  powerBackup?: string;
  crmSoftware?: string;
  dialerPlatform?: string;
  otherTechnology?: string;
  scheduleAData?: Record<string, any>;
  scheduleBProjectData?: Record<string, any>;
}

export interface GeneratedAgreementResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  agreementCode: string;
  pageCount: number;
}

/**
 * Generate real partner-specific PDF from Agreement/Agreement.pdf
 * Preserves all 23 pages, headers, footers, page numbers, tables, legal clauses.
 */
export async function generatePartnerAgreementPdf(params: {
  agreementCode: string;
  effectiveDate?: string | Date;
  partnerData: PopulatePartnerData;
}): Promise<GeneratedAgreementResult> {
  const templatePath = getOfficialAgreementPdfPath();
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const totalPages = pdfDoc.getPageCount();

  if (totalPages !== 23) {
    logger.warn({ totalPages }, "Template page count does not equal expected 23 pages");
  }

  const code = params.agreementCode || "THK-GDP-00001";
  const effectiveDateFormatted = formatAgreementDate(params.effectiveDate);
  const pData = params.partnerData;
  const schedA = pData.scheduleAData || {};

  const legalName = pData.legalName || "Global Delivery Partner";
  const tradeName = pData.tradeName || schedA.tradeName || legalName;
  const registrationNumber = pData.registrationNumber || schedA.registrationNumber || "As per MCA Records";
  const registeredAddress = pData.registeredAddress || schedA.registeredAddress || "Corporate Registered Address";
  const operationalAddress = pData.operationalAddress || schedA.operatingAddress || registeredAddress;
  const signatoryName = pData.authorizedSignatoryName || schedA.authorizedContact || "Authorized Representative";
  const signatoryDesignation = pData.authorizedSignatoryDesignation || schedA.designation || "Director";
  const contactEmail = pData.contactEmail || schedA.email || "partner@thinkatic.com";
  const contactPhone = pData.contactPhone || schedA.phone || "+1-000-000-0000";
  const centreId = pData.centreId || schedA.centreId || "THK-CTR-PENDING";
  const ownerDirector = pData.ownerDirector || schedA.ownerDirector || signatoryName;

  // Capacity & Infrastructure
  const totalSeats = pData.totalSeats !== undefined ? String(pData.totalSeats) : (schedA.totalSeats ? String(schedA.totalSeats) : "50 Seats");
  const availableSeats = pData.availableSeats !== undefined ? String(pData.availableSeats) : (schedA.availableSeats ? String(schedA.availableSeats) : "25 Seats");
  const currentAgents = pData.currentAgents !== undefined ? String(pData.currentAgents) : (schedA.currentAgents ? String(schedA.currentAgents) : "35 Agents");
  const supervisors = pData.supervisors !== undefined ? String(pData.supervisors) : (schedA.supervisors ? String(schedA.supervisors) : "3 Supervisors (Ratio 1:12)");
  const languages = pData.languages || schedA.languages || "English, Hindi, Regional";
  const countriesServed = pData.countriesServed || schedA.countriesServed || "USA, UK, Canada, Australia, India";
  const workingHours = pData.workingHours || schedA.workingHours || "24/7/365 Rotational Shifts";
  const internetCapacity = pData.internetCapacity || schedA.internetCapacity || schedA.primaryIsp || "Dual Redundant High Speed Fiber (100+ Mbps)";
  const powerBackup = pData.powerBackup || schedA.powerBackup || "Online UPS + Automatic DG Generator Backup";
  const crmSoftware = pData.crmSoftware || schedA.crmSoftware || "Thinkatic CRM / Client Certified CRM";
  const dialerPlatform = pData.dialerPlatform || schedA.dialerPlatform || "Certified Predictive & Progressive Dialer (Vicidial)";
  const otherTechnology = pData.otherTechnology || schedA.otherTechnology || "Dual-Channel 100% Call Recording, Clean Desk Enforced";

  // Helper to update a page content stream
  function updatePageStream(pageIndex: number, replacer: (unzipped: string) => string) {
    if (pageIndex >= pdfDoc.getPageCount()) return;
    const page = pdfDoc.getPage(pageIndex);
    const contentsRef = page.node.get(PDFName.of("Contents"));
    if (!contentsRef) return;

    const rawStreamObj: any = pdfDoc.context.lookup(contentsRef);
    if (!rawStreamObj || typeof rawStreamObj.getContents !== "function") return;

    const rawData = rawStreamObj.getContents();
    const rawStr = Buffer.from(rawData).toString("latin1");

    let unzipped: string;
    try {
      const decodedA85 = decodeAscii85(rawStr);
      unzipped = zlib.inflateSync(decodedA85).toString("latin1");
    } catch {
      try {
        unzipped = zlib.inflateSync(Buffer.from(rawData)).toString("latin1");
      } catch {
        unzipped = rawStr;
      }
    }

    const modified = replacer(unzipped);
    const newStream = pdfDoc.context.flateStream(Buffer.from(modified, "latin1"));
    const newRef = pdfDoc.context.register(newStream);
    page.node.set(PDFName.of("Contents"), newRef);
  }

  // 1. PAGE 1: Agreement ID and Effective Date
  updatePageStream(0, (content) => {
    return content
      .replace("[THK-GDP-XXXX]", code)
      .replace("[DD/MM/YYYY]", effectiveDateFormatted);
  });

  // 2. PAGE 2: Thinkatic registered address & Partner Profile in preamble
  updatePageStream(1, (content) => {
    let c = content;
    c = c.replace("[Thinkatic Registered Office Address]", "30 N Gould St Ste R, Sheridan, WY 82801, USA");
    c = c.replace("[Partner Company Legal Name]", escapePdfText(legalName));
    c = c.replace("Business/Trade Name: [Name]", "Business/Trade Name: " + escapePdfText(tradeName));
    c = c.replace("Registration No.: [Registration Number]", "Registration No.: " + escapePdfText(registrationNumber));
    c = c.replace("Registered Address: [Address]", "Registered Address: " + escapePdfText(registeredAddress));
    c = c.replace("Authorized Representative: [Name]", "Authorized Representative: " + escapePdfText(signatoryName));
    c = c.replace("Designation: [Designation]", "Designation: " + escapePdfText(signatoryDesignation));
    c = c.replace("Email: [Email]", "Email: " + escapePdfText(contactEmail));
    c = c.replace("Phone: [Phone]", "Phone: " + escapePdfText(contactPhone));
    return c;
  });

  // 3. PDF PAGE 16 (Internal 0-based page index: 15):
  //    Target: Clause 45 — NOTICES section contact information
  //    Safety Invariant: Clause 44 — DISPUTE RESOLUTION (which precedes Clause 45 on Page 16)
  //    remains 100% UNTOUCHED and pristine. Page 17 (index 16) contains Clauses 48-52.
  //    Replacements:
  //      - "[Thinkatic Registered Office Address]" -> "30 N Gould St Ste R, Sheridan, WY 82801, USA"
  //      - "[Partner Email]" -> contactEmail
  //      - "[Partner Registered Address]" -> registeredAddress
  updatePageStream(15, (content) => {
    let c = content;
    c = c.replace("[Thinkatic Registered Office Address]", "30 N Gould St Ste R, Sheridan, WY 82801, USA");
    c = c.replace("[Partner Email]", escapePdfText(contactEmail));
    c = c.replace("[Partner Registered Address]", escapePdfText(registeredAddress));
    return c;
  });

  // 4. PAGE 20: Clause 58 Signatures section
  // Thinkatic signature block is fixed: Healweal LLC, Harshad Chavandke, Director.
  // Partner signature block: Populate Legal Entity, Signatory Name, Designation;
  // leave Signature and Date lines blank (_______________________________) for offline signature.
  updatePageStream(19, (content) => {
    let c = content;
    const partnerSectionStart = c.indexOf("FOR GLOBAL DELIVERY PARTNER");
    if (partnerSectionStart !== -1) {
      const before = c.substring(0, partnerSectionStart);
      let after = c.substring(partnerSectionStart);

      after = after.replace(
        "BT 1 0 0 1 166 97.5 Tm (_______________________________) Tj",
        `BT 1 0 0 1 166 97.5 Tm (${escapePdfText(legalName)}) Tj`
      );
      after = after.replace(
        "BT 1 0 0 1 166 75.5 Tm (_______________________________) Tj",
        `BT 1 0 0 1 166 75.5 Tm (${escapePdfText(signatoryName)}) Tj`
      );
      after = after.replace(
        "BT 1 0 0 1 166 53.5 Tm (_______________________________) Tj",
        `BT 1 0 0 1 166 53.5 Tm (${escapePdfText(signatoryDesignation)}) Tj`
      );

      c = before + after;
    }
    return c;
  });

  // 5. PAGE 21: SCHEDULE A — PARTNER PROFILE (All 19 Rows at exact table coordinates x=166)
  updatePageStream(20, (content) => {
    const fields = [
      { y: "403.7", val: legalName },
      { y: "381.7", val: tradeName },
      { y: "359.7", val: centreId },
      { y: "337.7", val: registeredAddress },
      { y: "315.7", val: operationalAddress },
      { y: "293.7", val: ownerDirector },
      { y: "271.7", val: `${signatoryName} (${contactPhone})` },
      { y: "249.7", val: totalSeats },
      { y: "227.7", val: availableSeats },
      { y: "205.7", val: currentAgents },
      { y: "183.7", val: supervisors },
      { y: "161.7", val: languages },
      { y: "139.7", val: countriesServed },
      { y: "117.7", val: workingHours },
      { y: "95.7", val: internetCapacity },
      { y: "73.7", val: powerBackup },
      { y: "51.7", val: crmSoftware },
      { y: "29.7", val: dialerPlatform },
      { y: "7.7", val: otherTechnology },
    ];

    let c = content;
    for (const f of fields) {
      const target = `BT 1 0 0 1 166 ${f.y} Tm  T* ET`;
      const replacement = `BT 1 0 0 1 166 ${f.y} Tm (${escapePdfText(f.val)}) Tj T* ET`;
      c = c.replace(target, replacement);
    }
    return c;
  });

  // 6. PAGE 22: SCHEDULE B — PROJECT COMMERCIAL TERMS
  // If approved project data is provided, populate the matching row; otherwise preserve template placeholders.
  if (pData.scheduleBProjectData && Object.keys(pData.scheduleBProjectData).length > 0) {
    const proj = pData.scheduleBProjectData;
    updatePageStream(21, (content) => {
      let c = content;
      if (proj.projectName) {
        c = c.replace(
          "BT 1 0 0 1 6 306.7 Tm (Project) Tj T* ET\nBT 1 0 0 1 216 306.7 Tm ([) Tj /F4 9.3 Tf 12 TL (l) Tj /F1 9.3 Tf 12 TL (]) Tj T* ET",
          `BT 1 0 0 1 6 306.7 Tm (Project) Tj T* ET\nBT 1 0 0 1 216 306.7 Tm (${escapePdfText(proj.projectName)}) Tj T* ET`
        );
      }
      if (proj.clientName) {
        c = c.replace(
          "BT 1 0 0 1 6 286.7 Tm (Client) Tj T* ET\nBT 1 0 0 1 216 286.7 Tm ([) Tj /F4 9.3 Tf 12 TL (l) Tj /F1 9.3 Tf 12 TL (]) Tj T* ET",
          `BT 1 0 0 1 6 286.7 Tm (Client) Tj T* ET\nBT 1 0 0 1 216 286.7 Tm (${escapePdfText(proj.clientName)}) Tj T* ET`
        );
      }
      if (proj.rate) {
        c = c.replace(
          "BT 1 0 0 1 6 186.7 Tm (Rate) Tj T* ET\nBT 1 0 0 1 216 186.7 Tm ([) Tj /F4 9.3 Tf 12 TL (l) Tj /F1 9.3 Tf 12 TL (]) Tj T* ET",
          `BT 1 0 0 1 6 186.7 Tm (Rate) Tj T* ET\nBT 1 0 0 1 216 186.7 Tm (${escapePdfText(proj.rate)}) Tj T* ET`
        );
      }
      if (proj.currency) {
        c = c.replace(
          "BT 1 0 0 1 6 166.7 Tm (Currency) Tj T* ET\nBT 1 0 0 1 216 166.7 Tm ([) Tj /F4 9.3 Tf 12 TL (l) Tj /F1 9.3 Tf 12 TL (]) Tj T* ET",
          `BT 1 0 0 1 6 166.7 Tm (Currency) Tj T* ET\nBT 1 0 0 1 216 166.7 Tm (${escapePdfText(proj.currency)}) Tj T* ET`
        );
      }
      return c;
    });
  }

  // Save generated PDF
  const outputBytes = await pdfDoc.save();

  const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Thinkatic_Global_Delivery_Partner_Agreement_${safeCode}.pdf`;
  const relativeKey = `generated/${fileName}`;

  // Save generated PDF to authoritative Supabase Storage bucket: thinkatic-agreements/generated/
  const saveRes = await saveFile("agreements", relativeKey, Buffer.from(outputBytes), "application/pdf");
  const filePath = saveRes.absolutePath;

  logger.info(
    { agreementCode: code, fileName, sizeBytes: outputBytes.length, pageCount: pdfDoc.getPageCount() },
    "Generated Partner Agreement PDF successfully and uploaded to Supabase Storage"
  );

  return {
    filePath,
    fileName,
    fileSize: outputBytes.length,
    agreementCode: code,
    pageCount: pdfDoc.getPageCount(),
  };
}

export const populateAgreementPdf = generatePartnerAgreementPdf;

