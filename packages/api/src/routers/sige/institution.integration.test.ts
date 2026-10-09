import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import type { FileStoragePort } from "../../storage/port";
import { institutionRouter } from "./institution";

/** `institution.*` (sige/02 INS-06, §3.2, §2.2, INS-R10): profile, logo rules, audit. */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const MB = 1024 * 1024;

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof ORPCError ? error : (error as Error)),
  );

const fileOf = (bytes: Uint8Array, type: string, name = "logo.bin") =>
  new File([new Uint8Array(bytes)], name, { type });

class FakeStorage implements FileStoragePort {
  readonly objects = new Map<string, string>();
  readonly deleted: string[] = [];
  failDelete = false;

  async put(key: string, _bytes: Uint8Array, contentType: string) {
    this.objects.set(key, contentType);
    return { url: `https://files.test/${key}` };
  }

  async delete(key: string) {
    if (this.failDelete) throw new Error("storage down");
    this.deleted.push(key);
    this.objects.delete(key);
  }
}

const sha256Hex = async (bytes: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const orgRow = async (fx: SigeTestFixture, tenant: TestTenant) => {
  const [row] = await fx.db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, tenant.orgId));
  return row!;
};

await sigeSuite("institution router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let viewer: Context;
  let audit: RecordingAuditLogger;
  let storage: FakeStorage;

  describe("setup", () => {
    test("provisions a tenant", async () => {
      tenant = await fx.provisionTenant("Colegio", ["owner", "coordinator", "viewer"]);
      storage = new FakeStorage();
      owner = { ...(await fx.contextFor(tenant.people.owner!, tenant)), fileStorage: storage };
      coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
      viewer = await fx.contextFor(tenant.people.viewer!, tenant);
      audit = owner.auditLogger as RecordingAuditLogger;
    });
  });

  describe("get", () => {
    test("without a profile row returns empty fields and defaults", async () => {
      await fx.db
        .delete(schema.institutionProfile)
        .where(eq(schema.institutionProfile.organizationId, tenant.orgId));
      const dto = await call(institutionRouter.get, undefined, { context: owner });
      expect(dto).toEqual({
        name: (await orgRow(fx, tenant)).name,
        logo: null,
        nit: null,
        phone: null,
        email: null,
        address: null,
        municipality: null,
        department: null,
        resolution: null,
        currentAcademicYear: String(new Date().getFullYear()),
        timezone: "America/Bogota",
      });
    });

    test("viewer and coordinator can read", async () => {
      expect(await call(institutionRouter.get, undefined, { context: viewer })).toHaveProperty(
        "name",
      );
      expect(await call(institutionRouter.get, undefined, { context: coordinator })).toHaveProperty(
        "name",
      );
    });
  });

  describe("update", () => {
    test("creates the profile when absent, renames the org, trims and nulls blanks; one audit event", async () => {
      audit.reset();
      const dto = await call(
        institutionRouter.update,
        {
          name: "  Colegio Nuevo  ",
          nit: "900.123.456-7",
          phone: "",
          address: "Calle 1",
          academicYear: "2025",
        },
        { context: owner },
      );
      expect(dto).toMatchObject({
        name: "Colegio Nuevo",
        nit: "900.123.456-7",
        phone: null,
        address: "Calle 1",
        currentAcademicYear: "2025",
        timezone: "America/Bogota",
      });
      expect((await orgRow(fx, tenant)).name).toBe("Colegio Nuevo");
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]).toMatchObject({
        scope: "organization",
        organizationId: tenant.orgId,
        actorUserId: tenant.people.owner!.userId,
        action: "institution.profile_updated",
        targetType: "institution",
        targetId: tenant.orgId,
      });
      const changed = (audit.events[0]!.metadata as { changed: string[] }).changed;
      expect(changed.sort()).toEqual(["address", "currentAcademicYear", "name", "nit"].sort());
    });

    test("updating an existing profile reports only changed field names", async () => {
      audit.reset();
      await call(
        institutionRouter.update,
        {
          name: "Colegio Nuevo",
          nit: "900.123.456-7",
          address: "Calle 2",
          academicYear: "2025",
        },
        { context: owner },
      );
      expect((audit.events[0]!.metadata as { changed: string[] }).changed).toEqual(["address"]);
      expect(JSON.stringify(audit.events[0]!.metadata)).not.toContain("Calle");
    });

    test("duplicate NIT is CONFLICT and leaves the organization name untouched", async () => {
      const other = await fx.provisionTenant("Otro", ["owner"]);
      await fx.db
        .insert(schema.institutionProfile)
        .values({ organizationId: other.orgId, nit: "800.000.000-1" })
        .onConflictDoUpdate({
          target: schema.institutionProfile.organizationId,
          set: { nit: "800.000.000-1" },
        });
      audit.reset();
      const error = (await errorOf(
        call(
          institutionRouter.update,
          { name: "Renombrado", nit: "800.000.000-1", academicYear: "2026" },
          { context: owner },
        ),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Ya existe una institución con este NIT.");
      expect((await orgRow(fx, tenant)).name).toBe("Colegio Nuevo");
      expect(audit.events).toHaveLength(0);
    });

    test("coordinator cannot update", async () => {
      const error = (await errorOf(
        call(
          institutionRouter.update,
          { name: "x", academicYear: "2026" },
          { context: coordinator },
        ),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("FORBIDDEN");
    });
  });

  describe("setLogo", () => {
    test("stores a PNG under logos/{org}/{hash}.png, saves the URL, audits without values", async () => {
      audit.reset();
      const result = await call(
        institutionRouter.setLogo,
        { logo: fileOf(PNG, "image/png", "a.png") },
        { context: owner },
      );
      const key = `logos/${tenant.orgId}/${await sha256Hex(PNG)}.png`;
      expect(result).toEqual({ logo: `https://files.test/${key}` });
      expect(storage.objects.get(key)).toBe("image/png");
      expect((await orgRow(fx, tenant)).logo).toBe(result.logo);
      expect((await call(institutionRouter.get, undefined, { context: owner })).logo).toBe(
        result.logo,
      );
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]).toMatchObject({
        action: "institution.profile_updated",
        metadata: { changed: ["logo"] },
      });
      expect(JSON.stringify(audit.events[0]!.metadata)).not.toContain("files.test");
    });

    test("re-uploading identical bytes keeps the object", async () => {
      storage.deleted.length = 0;
      await call(institutionRouter.setLogo, { logo: fileOf(PNG, "image/png") }, { context: owner });
      expect(storage.deleted).toEqual([]);
      expect(storage.objects.size).toBe(1);
    });

    test("replacing deletes the previous object after the new one is stored", async () => {
      const oldKey = `logos/${tenant.orgId}/${await sha256Hex(PNG)}.png`;
      const result = await call(
        institutionRouter.setLogo,
        { logo: fileOf(JPG, "image/jpeg") },
        { context: owner },
      );
      const newKey = `logos/${tenant.orgId}/${await sha256Hex(JPG)}.jpg`;
      expect(result.logo).toBe(`https://files.test/${newKey}`);
      expect(storage.deleted).toEqual([oldKey]);
      expect([...storage.objects.keys()]).toEqual([newKey]);
    });

    test("a failing delete of the old object does not fail the request", async () => {
      storage.failDelete = true;
      const result = await call(
        institutionRouter.setLogo,
        { logo: fileOf(PNG, "image/png") },
        { context: owner },
      );
      storage.failDelete = false;
      expect(result.logo).toContain(await sha256Hex(PNG));
      expect((await orgRow(fx, tenant)).logo).toBe(result.logo);
    });

    test("declared type outside the allowlist is rejected", async () => {
      const before = storage.objects.size;
      for (const type of ["image/svg+xml", "application/pdf", "text/html", ""]) {
        const error = (await errorOf(
          call(institutionRouter.setLogo, { logo: fileOf(PNG, type) }, { context: owner }),
        )) as ORPCError<string, unknown>;
        expect(error.code).toBe("BAD_REQUEST");
        expect(error.message).toBe("Formato no permitido. Use PNG, JPG, JPEG, GIF o WEBP.");
      }
      expect(storage.objects.size).toBe(before);
    });

    test("allowed declared type with non-image bytes is rejected (sniffing)", async () => {
      const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
      const error = (await errorOf(
        call(institutionRouter.setLogo, { logo: fileOf(html, "image/png") }, { context: owner }),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Formato no permitido. Use PNG, JPG, JPEG, GIF o WEBP.");
    });

    test("bytes of a different allowed type than declared are accepted by their real type", async () => {
      const result = await call(
        institutionRouter.setLogo,
        { logo: fileOf(JPG, "image/png") },
        { context: owner },
      );
      expect(result.logo.endsWith(".jpg")).toBe(true);
    });

    test("over 2 MB is rejected; exactly 2 MB is accepted", async () => {
      const big = new Uint8Array(2 * MB + 1);
      big.set(PNG);
      const error = (await errorOf(
        call(institutionRouter.setLogo, { logo: fileOf(big, "image/png") }, { context: owner }),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("El logo supera 2 MB.");

      const edge = new Uint8Array(2 * MB);
      edge.set(PNG);
      const ok = await call(
        institutionRouter.setLogo,
        { logo: fileOf(edge, "image/png") },
        { context: owner },
      );
      expect(ok.logo.endsWith(".png")).toBe(true);
    });

    test("without a configured storage it fails with a server error, not a partial write", async () => {
      const { fileStorage: _omit, ...withoutStorage } = owner;
      const before = (await orgRow(fx, tenant)).logo;
      const error = (await errorOf(
        call(
          institutionRouter.setLogo,
          { logo: fileOf(PNG, "image/png") },
          { context: withoutStorage as Context },
        ),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect((await orgRow(fx, tenant)).logo).toBe(before);
    });
  });

  describe("removeLogo", () => {
    test("clears the column, deletes the object and audits", async () => {
      await call(institutionRouter.setLogo, { logo: fileOf(PNG, "image/png") }, { context: owner });
      const key = `logos/${tenant.orgId}/${await sha256Hex(PNG)}.png`;
      storage.deleted.length = 0;
      audit.reset();
      expect(await call(institutionRouter.removeLogo, undefined, { context: owner })).toEqual({
        logo: null,
      });
      expect((await orgRow(fx, tenant)).logo).toBeNull();
      expect(storage.deleted).toEqual([key]);
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]).toMatchObject({
        action: "institution.profile_updated",
        metadata: { changed: ["logo"] },
      });
    });

    test("with no logo it is a no-op without an audit event", async () => {
      audit.reset();
      storage.deleted.length = 0;
      expect(await call(institutionRouter.removeLogo, undefined, { context: owner })).toEqual({
        logo: null,
      });
      expect(storage.deleted).toEqual([]);
      expect(audit.events).toHaveLength(0);
    });
  });

  describe("concurrent logo changes", () => {
    test("two simultaneous uploads leave exactly one object, the one the column points to", async () => {
      await call(institutionRouter.removeLogo, undefined, { context: owner });
      // Both uploads store their object before either commits, so each would see the same old key.
      const gated = new FakeStorage();
      let arrived = 0;
      let release!: () => void;
      const bothArrived = new Promise<void>((resolve) => (release = resolve));
      const put = gated.put.bind(gated);
      gated.put = async (key, bytes, contentType) => {
        const result = await put(key, bytes, contentType);
        arrived += 1;
        if (arrived === 2) release();
        await bothArrived;
        return result;
      };
      const racing: Context = { ...owner, fileStorage: gated };
      const [first, second] = await Promise.all([
        call(institutionRouter.setLogo, { logo: fileOf(PNG, "image/png") }, { context: racing }),
        call(institutionRouter.setLogo, { logo: fileOf(JPG, "image/jpeg") }, { context: racing }),
      ]);
      const column = (await orgRow(fx, tenant)).logo!;
      expect([first.logo, second.logo]).toContain(column);
      expect([...gated.objects.keys()]).toHaveLength(1);
      expect(column.endsWith([...gated.objects.keys()][0]!)).toBe(true);
    });

    test("removeLogo racing a replacement never leaves an unreferenced object", async () => {
      await call(institutionRouter.removeLogo, undefined, { context: owner });
      const racing: Context = { ...owner, fileStorage: storage };
      storage.objects.clear();
      await call(
        institutionRouter.setLogo,
        { logo: fileOf(PNG, "image/png") },
        { context: racing },
      );
      await Promise.all([
        call(institutionRouter.removeLogo, undefined, { context: racing }),
        call(institutionRouter.setLogo, { logo: fileOf(JPG, "image/jpeg") }, { context: racing }),
      ]);
      const column = (await orgRow(fx, tenant)).logo;
      const keys = [...storage.objects.keys()];
      if (column === null) expect(keys).toHaveLength(0);
      else {
        expect(keys).toHaveLength(1);
        expect(column.endsWith(keys[0]!)).toBe(true);
      }
    });
  });
});

const matrixStorage = new FakeStorage();
await testPermissionMatrix({
  name: "institution",
  procedures: [
    {
      name: "institution.get",
      permissions: { institution: ["read"] },
      run: (context) => call(institutionRouter.get, undefined, { context }),
    },
    {
      name: "institution.update",
      permissions: { institution: ["update"] },
      run: (context) =>
        call(institutionRouter.update, { name: "Matriz", academicYear: "2026" }, { context }),
    },
    {
      name: "institution.setLogo",
      permissions: { institution: ["update"] },
      run: (context) =>
        call(
          institutionRouter.setLogo,
          { logo: fileOf(PNG, "image/png") },
          { context: { ...context, fileStorage: matrixStorage } },
        ),
    },
    {
      name: "institution.removeLogo",
      permissions: { institution: ["update"] },
      run: (context) =>
        call(institutionRouter.removeLogo, undefined, {
          context: { ...context, fileStorage: matrixStorage },
        }),
    },
  ],
});

await testTenantIsolation({
  name: "institution",
  cases: [
    isolationCase({
      name: "institution.get returns only the caller's institution",
      seed: async (tenant, fx) => {
        const row = await orgRow(fx, tenant);
        await fx.db
          .insert(schema.institutionProfile)
          .values({ organizationId: tenant.orgId, address: `Dir ${tenant.slug}` })
          .onConflictDoNothing();
        return { name: row.name, address: `Dir ${tenant.slug}` };
      },
      run: ({ context }) => call(institutionRouter.get, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.name, foreign.address],
    }),
    isolationCase({
      name: "institution.update never touches the other institution",
      seed: async (tenant, fx) => ({ name: (await orgRow(fx, tenant)).name, tenant }),
      run: ({ context }) =>
        call(institutionRouter.update, { name: "Propia", academicYear: "2026" }, { context }),
      expectation: "noLeak",
      verifyForeignUnchanged: async (foreign, fx) => {
        expect((await orgRow(fx, foreign.tenant)).name).toBe(foreign.name);
      },
    }),
  ],
});
