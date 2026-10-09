import { describe, expect, test } from "bun:test";

import { createFileRoutes } from "./file-routes";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const storage = {
  async read(key: string) {
    return key === "logos/org_1/abc.png" ? { bytes: PNG, contentType: "image/png" } : null;
  },
};

describe("GET /files/*", () => {
  const routes = createFileRoutes(storage);

  test("serves the stored bytes with type, nosniff and an immutable cache header", async () => {
    const response = await routes.request("/files/logos/org_1/abc.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  test("a missing object is 404", async () => {
    expect((await routes.request("/files/logos/org_1/missing.png")).status).toBe(404);
  });

  test("traversal and invalid keys are 404 and never reach the storage with a raw path", async () => {
    const seen: string[] = [];
    const spy = createFileRoutes({
      read: async (key) => {
        seen.push(key);
        return null;
      },
    });
    for (const path of [
      "/files/../etc/passwd",
      "/files/logos/../../secret.png",
      "/files/%2e%2e/%2e%2e/secret.png",
      "/files/logos//x.png",
      "/files/",
    ]) {
      expect((await spy.request(path)).status).toBe(404);
    }
    expect(seen.every((key) => !key.includes(".."))).toBe(true);
  });

  test("other paths are not served", async () => {
    expect((await routes.request("/other")).status).toBe(404);
  });
});

describe("GET /files/* over the local adapter", () => {
  test("serves a stored object and refuses keys that would leave the directory", async () => {
    const { mkdtemp, rm, writeFile, mkdir } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { createLocalFileStorage } = await import("@base-template/api/storage/local");
    const root = await mkdtemp(join(tmpdir(), "sige-files-"));
    try {
      const storageDir = join(root, "storage");
      await mkdir(storageDir, { recursive: true });
      await writeFile(join(root, "secret.png"), PNG);
      const local = createLocalFileStorage({
        directory: storageDir,
        publicBaseUrl: "http://localhost/files",
      });
      await local.put("logos/org_1/abc.png", PNG, "image/png");
      const routes = createFileRoutes(local);
      const ok = await routes.request("/files/logos/org_1/abc.png");
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toBe("image/png");
      for (const path of [
        "/files/%2e%2e/secret.png",
        "/files/logos/%2e%2e/%2e%2e/secret.png",
        "/files/logos%2f..%2f..%2fsecret.png",
        "/files/logos/org_1/abc.png%00.png",
      ]) {
        expect((await routes.request(path)).status).toBe(404);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
