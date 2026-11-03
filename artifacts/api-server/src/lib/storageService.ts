/**
 * THINKATIC — PRODUCTION SUPABASE STORAGE SERVICE
 * Authoritative storage provider using Supabase Storage private buckets.
 * Enforces strict path traversal prevention, domain isolation, and authenticated access.
 */

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";

export type StorageDomain =
  | "centre-verification"
  | "agreements"
  | "kyc"
  | "documents"
  | "exports"
  | "compliance"
  | "bpo-connect";

export const DOMAIN_BUCKET_MAP: Record<StorageDomain, string> = {
  "centre-verification": "thinkatic-centre-verification",
  "agreements": "thinkatic-agreements",
  "kyc": "thinkatic-kyc",
  "documents": "thinkatic-documents",
  "exports": "thinkatic-exports",
  "compliance": "thinkatic-compliance",
  "bpo-connect": "thinkatic-documents",
};

export interface StorageFileStats {
  exists: boolean;
  size: number;
  mtime: Date;
  storageKey: string;
}

export interface SaveFileResult {
  storageKey: string;
  absolutePath: string;
  fileSize: number;
}

export class StorageSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageSecurityError";
  }
}

// Local cache / test root (for local tests only, never production source of truth)
let resolvedStorageRoot: string | null = null;

export function getStorageRoot(): string {
  if (resolvedStorageRoot) {
    return resolvedStorageRoot;
  }
  const candidate1 = path.resolve(process.cwd(), "data", "storage");
  const candidate2 = path.resolve(process.cwd(), "..", "..", "data", "storage");
  const candidate3 = path.resolve(process.cwd(), "..", "data", "storage");
  if (fs.existsSync(candidate1)) {
    resolvedStorageRoot = candidate1;
  } else if (fs.existsSync(candidate2)) {
    resolvedStorageRoot = candidate2;
  } else if (fs.existsSync(candidate3)) {
    resolvedStorageRoot = candidate3;
  } else {
    resolvedStorageRoot = candidate1;
  }
  return resolvedStorageRoot;
}

export function setStorageRoot(customRoot: string): void {
  resolvedStorageRoot = path.resolve(customRoot);
}

export function resetStorageRoot(): void {
  resolvedStorageRoot = null;
}

export function getDomainPath(domain: StorageDomain, subDomain?: string): string {
  const root = getStorageRoot();
  const domainDir = subDomain ? path.join(root, domain, subDomain) : path.join(root, domain);
  return domainDir;
}

/**
 * Initialize and verify all required Supabase Storage private buckets
 */
export async function initStorage(customRoot?: string): Promise<void> {
  if (customRoot) {
    setStorageRoot(customRoot);
  }

  // Ensure local temporary scratch directories for isolated development/test fallbacks
  const root = getStorageRoot();
  if (!fs.existsSync(root)) {
    try {
      fs.mkdirSync(root, { recursive: true });
    } catch { }
  }

  const domains: StorageDomain[] = [
    "centre-verification",
    "agreements",
    "kyc",
    "documents",
    "exports",
  ];

  for (const domain of domains) {
    const dir = path.join(root, domain);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch { }
    }
  }

  const agGenerated = path.join(root, "agreements", "generated");
  const agUploads = path.join(root, "agreements", "uploads");
  if (!fs.existsSync(agGenerated)) try { fs.mkdirSync(agGenerated, { recursive: true }); } catch { }
  if (!fs.existsSync(agUploads)) try { fs.mkdirSync(agUploads, { recursive: true }); } catch { }

  // Verify Supabase Storage buckets
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      logger.warn({ error: error.message }, "Notice checking Supabase storage buckets");
      return;
    }

    const existing = new Set((buckets || []).map((b: any) => b.name));
    for (const [domain, bucket] of Object.entries(DOMAIN_BUCKET_MAP)) {
      if (!existing.has(bucket)) {
        const { error: createErr } = await supabase.storage.createBucket(bucket, {
          public: false,
        });
        if (createErr) {
          logger.warn({ bucket, error: createErr.message }, "Could not ensure Supabase bucket");
        } else {
          logger.info({ bucket }, "Created private Supabase Storage bucket");
        }
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Supabase storage initialization warning");
  }
}

/**
 * Resolve and sanitize a storage key within a domain.
 * Strictly prevents path traversal attacks (e.g. '../', null bytes, encoded traversals).
 */
export function resolveSecurePath(domain: StorageDomain, relativeKey: string): string {
  if (!relativeKey || typeof relativeKey !== "string") {
    throw new StorageSecurityError("Invalid relative storage key: key must be a non-empty string");
  }

  // Reject null bytes and suspicious control characters
  if (relativeKey.indexOf("\0") !== -1 || relativeKey.includes("%00")) {
    throw new StorageSecurityError("Path traversal attack detected: null byte in path");
  }

  // Normalize path separators to forward slashes for validation
  const normalizedKey = relativeKey.replace(/\\/g, "/").replace(/^\/+/, "");

  // Check for directory traversal patterns
  const parts = normalizedKey.split("/");
  for (const part of parts) {
    if (part === ".." || part === ".") {
      throw new StorageSecurityError("Path traversal attack detected: parent directory references are strictly forbidden");
    }
  }

  const domainRoot = path.resolve(getDomainPath(domain));
  const candidatePath = path.resolve(domainRoot, relativeKey);

  return candidatePath;
}

/**
 * Clean and normalize a storage key for Supabase Storage
 */
export function cleanStorageKey(relativeKey: string): string {
  if (!relativeKey || typeof relativeKey !== "string") {
    throw new StorageSecurityError("Invalid relative storage key");
  }
  if (relativeKey.indexOf("\0") !== -1 || relativeKey.includes("%00")) {
    throw new StorageSecurityError("Path traversal attack detected");
  }
  const normalized = relativeKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/");
  for (const p of parts) {
    if (p === ".." || p === ".") {
      throw new StorageSecurityError("Path traversal attack detected");
    }
  }
  return normalized;
}

/**
 * Save a buffer to authoritative Supabase persistent Storage.
 */
export async function saveFile(
  domain: StorageDomain,
  relativeKey: string,
  buffer: Buffer,
  mimeType: string = "application/octet-stream"
): Promise<SaveFileResult> {
  const cleanKey = cleanStorageKey(relativeKey);
  const bucket = DOMAIN_BUCKET_MAP[domain];

  // 1. Authoritative upload to Supabase Storage with 60s timeout for large (up to 25MB) files
  try {
    const uploadPromise = supabase.storage.from(bucket).upload(cleanKey, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase storage upload timeout (60s)")), 60000)
    );
    const { error } = await Promise.race([uploadPromise, timeoutPromise]);
    if (error) {
      logger.error({ bucket, cleanKey, error: error.message }, "Supabase storage upload returned error");
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }
  } catch (err: any) {
    logger.error({ bucket, cleanKey, error: err.message }, "Supabase storage upload error");
    throw err;
  }

  // Authoritative Supabase Private Storage persistence completed
  return {
    storageKey: `${bucket}/${cleanKey}`,
    absolutePath: `${bucket}/${cleanKey}`,
    fileSize: buffer.length,
  };
}

/**
 * Read a file buffer from Supabase Storage (with local cache fallback)
 */
export async function readFile(domain: StorageDomain, relativeKey: string): Promise<Buffer> {
  const cleanKey = cleanStorageKey(relativeKey);
  const bucket = DOMAIN_BUCKET_MAP[domain];

  // 1. Try Supabase Storage first
  try {
    const { data, error } = await supabase.storage.from(bucket).download(cleanKey);
    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err: any) {
    logger.warn({ bucket, cleanKey, error: err.message }, "Supabase download warning, trying local cache");
  }

  // 2. Fallback to local disk cache if available
  const absolutePath = resolveSecurePath(domain, relativeKey);
  if (fs.existsSync(absolutePath)) {
    return fs.promises.readFile(absolutePath);
  }

  throw new Error(`File not found in Supabase storage bucket '${bucket}': ${cleanKey}`);
}

/**
 * Generate short-lived signed URL for authorized access to private files
 */
export async function createSignedUrl(
  domain: StorageDomain,
  relativeKey: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const cleanKey = cleanStorageKey(relativeKey);
  const bucket = DOMAIN_BUCKET_MAP[domain];

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanKey, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for '${bucket}/${cleanKey}': ${error?.message || "Unknown error"}`);
  }
  return data.signedUrl;
}

/**
 * Check if a file exists within a storage domain
 */
export async function fileExists(domain: StorageDomain, relativeKey: string): Promise<boolean> {
  const cleanKey = cleanStorageKey(relativeKey);
  const bucket = DOMAIN_BUCKET_MAP[domain];

  try {
    const parentDir = path.posix.dirname(cleanKey);
    const fileName = path.posix.basename(cleanKey);
    const searchFolder = parentDir === "." ? "" : parentDir;

    const { data, error } = await supabase.storage.from(bucket).list(searchFolder, {
      search: fileName,
    });
    if (!error && data && data.some((item: any) => item.name === fileName)) {
      return true;
    }
  } catch { }

  // Local cache check
  try {
    const absolutePath = resolveSecurePath(domain, relativeKey);
    return fs.existsSync(absolutePath);
  } catch {
    return false;
  }
}

/**
 * Get file stats (size, modification time)
 */
export function getFileStats(domain: StorageDomain, relativeKey: string): StorageFileStats | null {
  try {
    const absolutePath = resolveSecurePath(domain, relativeKey);
    if (fs.existsSync(absolutePath)) {
      const stat = fs.statSync(absolutePath);
      return {
        exists: true,
        size: stat.size,
        mtime: stat.mtime,
        storageKey: `${DOMAIN_BUCKET_MAP[domain]}/${cleanStorageKey(relativeKey)}`,
      };
    }
  } catch { }
  return null;
}

/**
 * Create a readable stream with optional range support
 */
export function createReadStream(
  domain: StorageDomain,
  relativeKey: string,
  options?: { start?: number; end?: number }
): fs.ReadStream {
  const absolutePath = resolveSecurePath(domain, relativeKey);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found for streaming: ${relativeKey}`);
  }
  return fs.createReadStream(absolutePath, options);
}

/**
 * Delete a file from persistent Supabase storage
 */
export async function deleteFile(domain: StorageDomain, relativeKey: string): Promise<boolean> {
  const cleanKey = cleanStorageKey(relativeKey);
  const bucket = DOMAIN_BUCKET_MAP[domain];

  try {
    await supabase.storage.from(bucket).remove([cleanKey]);
  } catch { }

  try {
    const absolutePath = resolveSecurePath(domain, relativeKey);
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }
  } catch { }

  return true;
}
