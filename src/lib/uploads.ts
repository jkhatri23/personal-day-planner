import { promises as fs } from "node:fs";
import path from "node:path";

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads", "donations");
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Whitelist anything plausible for a donation confirmation: PDFs, common email
// exports, screenshots, plain text. The file itself is only ever served back
// to the user who uploaded it, so we're conservative for tidiness, not safety.
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/", "message/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/octet-stream", // some .eml exports use this
  "application/vnd.ms-outlook",
]);

export function isAllowedMime(mime: string): boolean {
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[\\/]+/g, "_").trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned || "upload";
}

export async function saveUpload(debtId: string, file: File) {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${file.size} bytes, max ${MAX_BYTES}).`);
  }
  if (file.size <= 0) {
    throw new Error("Empty file.");
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error(`Unsupported file type: ${mime}`);
  }
  await fs.mkdir(UPLOADS_ROOT, { recursive: true });
  const filename = `${debtId}-${Date.now()}-${sanitizeFilename(file.name)}`;
  const full = path.join(UPLOADS_ROOT, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(full, buf);
  return {
    relativePath: filename, // stored under uploads/donations/<filename>
    name: file.name,
    mime,
    size: file.size,
  };
}

export async function readUpload(relativePath: string) {
  if (relativePath.includes("..") || relativePath.includes("/")) {
    throw new Error("invalid path");
  }
  const full = path.join(UPLOADS_ROOT, relativePath);
  return fs.readFile(full);
}
