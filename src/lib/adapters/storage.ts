import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Object storage seam. Local disk under public/uploads for now; the interface is
 * what S3 / Supabase Storage / R2 would implement. Callers only ever see a URL.
 */
export interface StorageProvider {
  readonly name: string;
  put(input: { businessId: string; filename: string; contentType: string; bytes: Buffer }): Promise<{ url: string }>;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/avif"]);
const MAX_BYTES = 10 * 1024 * 1024;

class LocalDiskStorage implements StorageProvider {
  readonly name = "local-disk";

  async put(input: { businessId: string; filename: string; contentType: string; bytes: Buffer }) {
    if (!ALLOWED.has(input.contentType)) throw new Error(`Unsupported image type: ${input.contentType}`);
    if (input.bytes.byteLength > MAX_BYTES) throw new Error("Image exceeds 10MB");

    // Never trust the client filename for a path — derive our own.
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/avif": "avif" })[input.contentType] ?? "bin";
    const name = `${Date.now()}_${randomBytes(6).toString("hex")}.${ext}`;
    const dir = join(process.cwd(), "public", "uploads", input.businessId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), input.bytes);
    return { url: `/uploads/${input.businessId}/${name}` };
  }
}

let storage: StorageProvider | null = null;
export function getStorage(): StorageProvider {
  if (!storage) storage = new LocalDiskStorage();
  return storage;
}
