import { Hono } from "hono";

type ReadableStorage = {
  /** `null` for an invalid key or a missing object (the adapter validates the key). */
  read(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
};

const PREFIX = "/files/";

/**
 * Local file storage route (sige/02 §2.2): logos are public like any institution branding asset.
 * Keys are validated by the adapter, so a path can never leave the storage directory.
 */
export function createFileRoutes(storage: ReadableStorage) {
  const routes = new Hono();
  routes.get("/files/*", async (c) => {
    const object = await storage.read(c.req.path.slice(PREFIX.length));
    if (!object) return c.notFound();
    return c.body(new Uint8Array(object.bytes).buffer, 200, {
      "Content-Type": object.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
  });
  return routes;
}
