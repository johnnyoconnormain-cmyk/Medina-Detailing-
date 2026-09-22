import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { isServerless } from "@/db/client";

/**
 * Object storage seam. Callers only ever see a URL back.
 *
 * Local development writes to public/uploads. That cannot work on a serverless
 * host, where the filesystem is read-only and discarded between invocations, so
 * there the provider reports plainly that storage is not configured rather than
 * accepting a photo and losing it. The UI surfaces that message on the upload
 * button; the rest of the job flow is unaffected.
 */
export interface StorageProvider {
  readonly name: string;
  readonly available: boolean;
  put(input: { businessId: string; filename: string; contentType: string; bytes: Buffer }): Promise<{ url: string }>;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/avif"]);
const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/heic": "heic", "image/avif": "avif",
};

function validate(contentType: string, size: number) {
  if (!ALLOWED.has(contentType)) throw new Error(`Unsupported image type: ${contentType}`);
  if (size > MAX_BYTES) throw new Error("Image exceeds 10MB");
}

class LocalDiskStorage implements StorageProvider {
  readonly name = "local-disk";
  readonly available = true;

  async put(input: { businessId: string; filename: string; contentType: string; bytes: Buffer }) {
    validate(input.contentType, input.bytes.byteLength);
    // Never trust the client filename for a path — derive our own.
    const name = `${Date.now()}_${randomBytes(6).toString("hex")}.${EXT[input.contentType] ?? "bin"}`;
    const dir = join(process.cwd(), "public", "uploads", input.businessId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), input.bytes);
    return { url: `/uploads/${input.businessId}/${name}` };
  }
}

class UnconfiguredStorage implements StorageProvider {
  readonly name = "unconfigured";
  readonly available = false;

  async put(): Promise<{ url: string }> {
    throw new Error(
      "Photo storage isn't configured for this deployment. " +
      "Serverless hosts have a read-only filesystem, so uploads need object storage — " +
      "add Vercel Blob, S3 or Supabase Storage behind StorageProvider in lib/adapters/storage.ts.",
    );
  }
}

let storage: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storage) storage = isServerless() ? new UnconfiguredStorage() : new LocalDiskStorage();
  return storage;
}

export function isStorageAvailable(): boolean {
  return getStorage().available;
}
