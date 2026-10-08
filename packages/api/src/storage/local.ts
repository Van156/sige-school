import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

import type { FileStoragePort } from "./port";

/**
 * Local-disk adapter for dev/test. Keys must be `segment/segment/.../name.ext` made of
 * `[A-Za-z0-9_-]` segments (no dots except the extension, no empty segments), so a key can never
 * leave `directory`; the resolved path is checked as a second guard.
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export type LocalFileStorageOptions = {
  /** Absolute or cwd-relative root directory. */
  directory: string;
  /** Public prefix the static route is mounted at, without a trailing slash. */
  publicBaseUrl: string;
};

export type LocalFileStorage = FileStoragePort & {
  /** Reads an object for the static route; `null` for an invalid key or a missing object. */
  read(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
};

export function createLocalFileStorage(options: LocalFileStorageOptions): LocalFileStorage {
  const root = resolve(options.directory);
  const baseUrl = options.publicBaseUrl.replace(/\/+$/, "");

  const pathFor = (key: string): string | null => {
    if (!KEY_PATTERN.test(key)) return null;
    const path = resolve(join(root, key));
    return path.startsWith(root + sep) ? path : null;
  };
  const requirePath = (key: string): string => {
    const path = pathFor(key);
    if (!path) throw new Error(`Invalid storage key: ${key}`);
    return path;
  };

  return {
    async put(key, bytes) {
      const path = requirePath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
      return { url: `${baseUrl}/${key}` };
    },
    async delete(key) {
      await rm(requirePath(key), { force: true });
    },
    async read(key) {
      const path = pathFor(key);
      if (!path) return null;
      try {
        const bytes = await readFile(path);
        return {
          bytes,
          contentType: CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
  };
}
