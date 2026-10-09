import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalFileStorage } from "./local";

const BASE_URL = "http://localhost:3000/files";
let directory: string;
let storage: ReturnType<typeof createLocalFileStorage>;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "sige-storage-"));
  storage = createLocalFileStorage({ directory, publicBaseUrl: BASE_URL });
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe("local file storage", () => {
  test("put writes the bytes under the key and returns the public URL", async () => {
    const result = await storage.put("logos/org_1/abc.png", new Uint8Array([1, 2, 3]), "image/png");
    expect(result.url).toBe(`${BASE_URL}/logos/org_1/abc.png`);
    expect([...(await readFile(join(directory, "logos/org_1/abc.png")))]).toEqual([1, 2, 3]);
  });

  test("put is idempotent for the same key", async () => {
    await storage.put("logos/org_1/same.png", new Uint8Array([9]), "image/png");
    await storage.put("logos/org_1/same.png", new Uint8Array([9]), "image/png");
    expect(await exists(join(directory, "logos/org_1/same.png"))).toBe(true);
  });

  test("delete removes the object and tolerates a missing one", async () => {
    await storage.put("logos/org_1/gone.png", new Uint8Array([1]), "image/png");
    await storage.delete("logos/org_1/gone.png");
    expect(await exists(join(directory, "logos/org_1/gone.png"))).toBe(false);
    await storage.delete("logos/org_1/gone.png");
  });

  test("read returns bytes and content type, or null when absent", async () => {
    await storage.put("logos/org_1/read.webp", new Uint8Array([7, 7]), "image/webp");
    const found = await storage.read("logos/org_1/read.webp");
    expect(found?.contentType).toBe("image/webp");
    expect([...found!.bytes]).toEqual([7, 7]);
    expect(await storage.read("logos/org_1/none.png")).toBeNull();
  });

  test.each([
    "../escape.png",
    "logos/../../escape.png",
    "/abs/path.png",
    "logos//double.png",
    "logos/org_1/..%2Fx.png",
    "logos\\org_1\\x.png",
    "logos/org_1/a b.png",
    "",
    "logos/org_1/noext",
  ])("rejects the unsafe key %p on every operation", async (key) => {
    await expect(storage.put(key, new Uint8Array([1]), "image/png")).rejects.toThrow(
      "Invalid storage key",
    );
    await expect(storage.delete(key)).rejects.toThrow("Invalid storage key");
    expect(await storage.read(key)).toBeNull();
  });
});
