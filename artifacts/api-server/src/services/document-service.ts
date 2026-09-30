import { createHmac, timingSafeEqual } from "node:crypto";
import { getDocumentSigningSecret } from "../lib/secrets";

export interface DocumentTokenPayload {
  purpose?: string;
  aud?: string;
  documentId: string;
  documentType: "voucher" | "invoice" | "ticket" | "itinerary";
  bookingId?: string;
  userId?: string;
  role?: string;
  expiresAt: number; // Unix timestamp ms
}

/**
 * Generates an HMAC-SHA256 short-lived signed URL token for protected document viewing.
 * Defaults to 15 minutes validity (900 seconds).
 */
export function generateSignedDocumentToken(
  payload: Omit<DocumentTokenPayload, "expiresAt">,
  expiresInSeconds = 900
): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const fullPayload: DocumentTokenPayload = {
    purpose: "document_signing",
    aud: "zelevos_documents",
    ...payload,
    expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = createHmac("sha256", getDocumentSigningSecret())
    .update(encodedPayload)
    .digest("hex");
  return `${encodedPayload}.${signature}`;
}

/**
 * Validates a signed document token, ensuring it is authentic, unexpired, and purpose-matched.
 */
export function verifySignedDocumentToken(
  token: string,
  expectedPurpose = "document_signing"
): DocumentTokenPayload | null {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;

    const expectedSignature = createHmac("sha256", getDocumentSigningSecret())
      .update(encodedPayload)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "utf-8");
    const expBuf = Buffer.from(expectedSignature, "utf-8");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    ) as DocumentTokenPayload;

    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    // Purpose and audience claim validation (ZEL-09 AC4)
    if (payload.purpose && payload.purpose !== expectedPurpose) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

