import { createAuth } from "@base-template/auth";
import {
  cookieHeaderFromSetCookie,
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { createBetterAuthAuthorization } from "../../authorization";
import type { Context } from "../../context";
import { createBetterAuthPlatformAdmin } from "../../platform-admin";
import { sigeProcedure } from "../../sige/procedure";
import { racingDb } from "../../sige/testing/racing-db";
import type { FileStoragePort } from "../../storage/port";
import { institutionAdminRouter } from "./institution-admin";
import { meRouter } from "./me";

/**
 * `institutionAdmin.create|list` (sige/02 INS-02 minimal, sige/00 §4.4) against a real Postgres:
 * root creates an institution plus its rector; the rector signs in with username + document.
 */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "institutionAdmin (INS-02)");

const rector: {
  firstName: string;
  lastName: string;
  documentType: "CC" | "TI" | "CE";
  documentNumber: string;
  email: string;
} = {
  firstName: "Marta",
  lastName: "Gómez",
  documentType: "CC",
  documentNumber: "52123456",
  email: "marta@colegio.example.com",
};

describe.skipIf(!reachable)("institutionAdmin (INS-02)", () => {
  let handle: TestDatabaseHandle;
  let auth: ReturnType<typeof createAuth>;
  let helpers: TestHelpers;
  let auditLogger: RecordingAuditLogger;

  beforeAll(async () => {
    handle = createTestDatabase(url);
    auditLogger = new RecordingAuditLogger();
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: "http://localhost:3001",
        DEFAULT_MAX_ORGS_PER_USER: 3,
      },
      handle.db,
      new RecordingEmailSender(),
      auditLogger,
      { extraPlugins: [testUtils()] },
    );
    helpers = ((await auth.$context) as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await truncateAllTables(handle.db);
    await handle.close();
  });

  beforeEach(async () => {
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  async function contextFor(
    headers: Headers,
    logger: Context["auditLogger"] = auditLogger,
  ): Promise<Context> {
    return {
      db: handle.db,
      session: await auth.api.getSession({ headers }),
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      auditLogger: logger,
      defaultMaxOrganizationsPerUser: 3,
    };
  }

  async function rootContext(logger?: Context["auditLogger"]) {
    const root = helpers.createUser({ role: "superadmin" });
    await helpers.saveUser(root);
    const { headers } = await helpers.login({ userId: root.id });
    return { root, context: await contextFor(headers, logger) };
  }

  const create = (context: Context, name = "Colegio Sol", admin = rector) =>
    call(institutionAdminRouter.create, { institution: { name }, admin }, { context });

  const codeOf = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (error: unknown) => (error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR"),
    );

  async function residue() {
    const [orgs, users, people, members, profiles] = await Promise.all([
      handle.db.select().from(schema.organization),
      handle.db.select().from(schema.user),
      handle.db.select().from(schema.person),
      handle.db.select().from(schema.member),
      handle.db.select().from(schema.institutionProfile),
    ]);
    return {
      orgs: orgs.length,
      users: users.length,
      people: people.length,
      members: members.length,
      profiles: profiles.length,
    };
  }

  test("root creates an institution and its rector (owner, forced change armed)", async () => {
    const { root, context } = await rootContext();
    const baseline = await residue();

    const result = await create(context);

    expect(result.institution.name).toBe("Colegio Sol");
    expect(result.institution.slug).toBe("colegio-sol");
    expect(result.rector.username).toBe("mgomez3456");

    const [person] = await handle.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, result.rector.personId));
    expect(person?.organizationId).toBe(result.institution.id);
    expect(person?.mustChangePassword).toBe(true);
    const [member] = await handle.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, result.rector.userId));
    expect(member).toMatchObject({ organizationId: result.institution.id, role: "owner" });
    const [rectorUser] = await handle.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, result.rector.userId));
    expect(rectorUser?.maxOrganizations).toBe(1);

    const after = await residue();
    expect(after.orgs).toBe(baseline.orgs + 1);

    const created = auditLogger.eventsFor("organization.created");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      actorUserId: root.id,
      organizationId: result.institution.id,
      targetId: result.institution.id,
    });
    expect(auditLogger.eventsFor("user.created")).toHaveLength(1);
    expect(auditLogger.eventsFor("user.created")[0]?.actorUserId).toBe(root.id);
  });

  test("the rector signs in with username + document number and hits PASSWORD_CHANGE_REQUIRED", async () => {
    const { context } = await rootContext();
    const result = await create(context);

    const response = await auth.api.signInUsername({
      body: { username: result.rector.username, password: rector.documentNumber },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const headers = cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
    // The session has no active organization yet: set it as the web does after sign-in.
    await auth.api.setActiveOrganization({
      body: { organizationId: result.institution.id },
      headers,
    });
    const activeContext = await contextFor(headers);

    const me = await call(meRouter.get, undefined, { context: activeContext });
    expect(me.kind).toBe("owner");
    expect(me.person.mustChangePassword).toBe(true);

    const gated = sigeProcedure.handler(() => "reached");
    expect(await codeOf(call(gated, undefined, { context: activeContext }))).toBe(
      "PASSWORD_CHANGE_REQUIRED",
    );

    const changed = await auth.api.changePassword({
      body: { currentPassword: rector.documentNumber, newPassword: "nueva-clave-2026" },
      headers,
      asResponse: true,
    });
    // The change issues a fresh session (other sessions are revoked).
    const refreshed = cookieHeaderFromSetCookie(changed.headers.get("set-cookie"));
    await auth.api.setActiveOrganization({
      body: { organizationId: result.institution.id },
      headers: refreshed,
    });
    expect(await call(gated, undefined, { context: await contextFor(refreshed) })).toBe("reached");
  });

  test("slug collisions get a numeric suffix", async () => {
    const { context } = await rootContext();
    const first = await create(context);
    const second = await create(context, "Colegio Sol", {
      ...rector,
      documentNumber: "52999999",
      email: "otra@colegio.example.com",
    });
    expect(first.institution.slug).toBe("colegio-sol");
    expect(second.institution.slug).toBe("colegio-sol-2");
  });

  test("non-root callers are FORBIDDEN, including an institution owner", async () => {
    const { context: rootCtx } = await rootContext();
    const result = await create(rootCtx);
    await handle.db
      .update(schema.person)
      .set({ mustChangePassword: false })
      .where(eq(schema.person.id, result.rector.personId));
    const { headers } = await helpers.login({
      userId: result.rector.userId,
      session: { activeOrganizationId: result.institution.id },
    });
    const ownerContext = await contextFor(headers);
    expect(
      await codeOf(
        create(ownerContext, "Otro", {
          ...rector,
          documentNumber: "11111111",
          email: "x@y.example.com",
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(await codeOf(call(institutionAdminRouter.list, {}, { context: ownerContext }))).toBe(
      "FORBIDDEN",
    );
  });

  test("unauthenticated callers are UNAUTHORIZED", async () => {
    const context = await contextFor(new Headers());
    expect(await codeOf(create(context))).toBe("UNAUTHORIZED");
  });

  test("a taken rector email leaves no partial institution", async () => {
    const { context } = await rootContext();
    await create(context);
    const before = await residue();
    const code = await codeOf(
      create(context, "Colegio Luna", { ...rector, documentNumber: "52777777" }),
    );
    expect(code).toBe("CONFLICT");
    expect(await residue()).toEqual(before);
  });

  test("a failing organization audit write compensates org, rector and membership", async () => {
    const failing: Context["auditLogger"] = {
      record: (event) =>
        event.action === "organization.created"
          ? Promise.reject(new Error("audit down"))
          : auditLogger.record(event),
    };
    const { context } = await rootContext(failing);
    const before = await residue();
    expect(await codeOf(create(context))).toBe("NOT_AN_ORPC_ERROR");
    expect(await residue()).toEqual(before);
  });

  test("invalid rector input is BAD_REQUEST and writes nothing", async () => {
    const { context } = await rootContext();
    const before = await residue();
    expect(
      await codeOf(
        create(context, "Colegio Luna", { ...rector, documentType: "TI", email: "no-email" }),
      ),
    ).toBe("BAD_REQUEST");
    expect(await codeOf(create(context, "  ", rector))).toBe("BAD_REQUEST");
    expect(await residue()).toEqual(before);
  });

  // ---- T9: profile, list contract, stats/get/update/logo/delete/manage -------------------------

  class FakeStorage implements FileStoragePort {
    readonly objects = new Set<string>();
    async put(key: string) {
      this.objects.add(key);
      return { url: `https://files.test/${key}` };
    }
    async delete(key: string) {
      this.objects.delete(key);
    }
  }

  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
  const fileOf = (bytes: Uint8Array, type: string) =>
    new File([new Uint8Array(bytes)], "logo.bin", { type });

  let seq = 0;
  const nextRector = () => {
    seq += 1;
    return {
      ...rector,
      documentNumber: `5${String(seq).padStart(7, "0")}`,
      email: `rector${seq}@colegio.example.com`,
    };
  };
  const createFull = (context: Context, name: string, fields: Record<string, unknown> = {}) =>
    call(
      institutionAdminRouter.create,
      { institution: { name, ...fields }, admin: nextRector() },
      { context },
    );

  /** A database whose inserts into `table` fail, to inject a fault at one creation step. */
  function failingInsert(table: object): Context["db"] {
    return new Proxy(handle.db, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target) as unknown;
        if (prop === "insert") {
          return (into: object) => {
            if (into === table) throw new Error("injected insert failure");
            return (value as (t: object) => unknown).call(target, into);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Context["db"];
  }

  describe("create with profile (INS-02)", () => {
    test("inserts the institution profile and returns the institution detail", async () => {
      const { context } = await rootContext();
      const result = await createFull(context, "Colegio Perfil", {
        nit: "900.123.456-7",
        phone: "6011234567",
        email: "info@perfil.example.com",
        address: "Calle 1 # 2-3",
        municipality: "Bogotá",
        department: "Cundinamarca",
        resolution: "Res. 123",
        academicYear: "2026",
      });
      const [profile] = await handle.db
        .select()
        .from(schema.institutionProfile)
        .where(eq(schema.institutionProfile.organizationId, result.institution.id));
      expect(profile).toMatchObject({
        nit: "900.123.456-7",
        municipality: "Bogotá",
        currentAcademicYear: "2026",
      });
      expect(result.institution).toMatchObject({
        id: result.institution.id,
        name: "Colegio Perfil",
        slug: "colegio-perfil",
        nit: "900.123.456-7",
        academicYear: "2026",
        counts: { campuses: 0, students: 0, admins: 1 },
        rector: { userId: result.rector.userId, username: result.rector.username },
      });
      expect(result.rector.personId).toBeTruthy();
    });

    test("the academic year defaults to the current year", async () => {
      const { context } = await rootContext();
      const result = await createFull(context, "Colegio Año");
      expect(result.institution.academicYear).toBe(String(new Date().getFullYear()));
    });

    test("a duplicate NIT is a CONFLICT with the spec message and leaves no residue", async () => {
      const { context } = await rootContext();
      await createFull(context, "Colegio Uno", { nit: "900123456" });
      const before = await residue();
      const error = await call(
        institutionAdminRouter.create,
        { institution: { name: "Colegio Dos", nit: "900123456" }, admin: nextRector() },
        { context },
      ).then(
        () => null,
        (e: unknown) => e as ORPCError<string, unknown>,
      );
      expect(error?.code).toBe("CONFLICT");
      expect(error?.message).toBe("Ya existe una institución con este NIT.");
      expect(await residue()).toEqual(before);
    });

    test("fault after the organization (rector rejected) leaves no organization or profile", async () => {
      const { context } = await rootContext();
      await create(context, "Colegio Base");
      const before = await residue();
      const code = await codeOf(
        call(
          institutionAdminRouter.create,
          {
            institution: { name: "Colegio Falla" },
            admin: { ...rector, documentNumber: "52000999" },
          },
          { context },
        ),
      );
      expect(code).toBe("CONFLICT");
      expect(await residue()).toEqual(before);
    });

    test("fault after the user (profile insert fails) removes organization, rector and member", async () => {
      const { context } = await rootContext();
      const before = await residue();
      const failing: Context = { ...context, db: failingInsert(schema.institutionProfile) };
      expect(await codeOf(createFull(failing, "Colegio Falla"))).toBe("NOT_AN_ORPC_ERROR");
      expect(await residue()).toEqual(before);
    });

    test("fault after the profile (audit write fails) removes the profile too", async () => {
      const failingAudit: Context["auditLogger"] = {
        record: (event) =>
          event.action === "organization.created"
            ? Promise.reject(new Error("audit down"))
            : auditLogger.record(event),
      };
      const { context } = await rootContext(failingAudit);
      const before = await residue();
      expect(await codeOf(createFull(context, "Colegio Falla"))).toBe("NOT_AN_ORPC_ERROR");
      expect(await residue()).toEqual(before);
    });
  });

  describe("list (INS-01, list contract)", () => {
    test("returns { rows, total } with the InstitutionRow fields and counts", async () => {
      const { context } = await rootContext();
      const one = await createFull(context, "Colegio Uno", {
        nit: "800111222",
        municipality: "Cali",
        department: "Valle",
        academicYear: "2026",
      });
      await handle.db.insert(schema.campus).values({
        organizationId: one.institution.id,
        name: "Sede A",
        jornada: "completa",
      });
      await createFull(context, "Colegio Dos");
      const result = await call(institutionAdminRouter.list, {}, { context });
      expect(result.total).toBe(2);
      expect(result.rows.map((row) => row.name)).toEqual(["Colegio Dos", "Colegio Uno"]);
      const row = result.rows.find((r) => r.id === one.institution.id)!;
      expect(row).toMatchObject({
        slug: "colegio-uno",
        logo: null,
        nit: "800111222",
        municipality: "Cali",
        department: "Valle",
        academicYear: "2026",
        counts: { campuses: 1, students: 0, admins: 1 },
      });
      expect(row.rector).toMatchObject({ userId: one.rector.userId });
    });

    test("filters by name/nit/municipality, sorts, pages and reports the unpaged total", async () => {
      const { context } = await rootContext();
      await createFull(context, "Alfa", { nit: "100000001", municipality: "Cali" });
      await createFull(context, "Beta", { nit: "100000002", municipality: "Bogotá" });
      await createFull(context, "Gamma", { nit: "200000003", municipality: "Cali" });
      const text = (id: "name" | "nit" | "municipality", value: string) => ({
        id,
        variant: "text" as const,
        operator: "iLike" as const,
        value,
      });
      const byName = await call(
        institutionAdminRouter.list,
        { filters: [text("name", "ta")] },
        { context },
      );
      expect(byName.rows.map((r) => r.name)).toEqual(["Beta"]);
      const byNit = await call(
        institutionAdminRouter.list,
        { filters: [text("nit", "1000000")], sort: [{ id: "name", desc: true }] },
        { context },
      );
      expect(byNit.rows.map((r) => r.name)).toEqual(["Beta", "Alfa"]);
      const byCity = await call(
        institutionAdminRouter.list,
        { filters: [text("municipality", "cali")], sort: [{ id: "name", desc: false }] },
        { context },
      );
      expect(byCity.rows.map((r) => r.name)).toEqual(["Alfa", "Gamma"]);
      const page = await call(
        institutionAdminRouter.list,
        { perPage: 2, page: 2, sort: [{ id: "name", desc: false }] },
        { context },
      );
      expect(page.rows.map((r) => r.name)).toEqual(["Gamma"]);
      expect(page.total).toBe(3);
    });

    test("sorts by the campuses count", async () => {
      const { context } = await rootContext();
      const a = await createFull(context, "Sin sedes");
      const b = await createFull(context, "Con sedes");
      await handle.db.insert(schema.campus).values([
        { organizationId: b.institution.id, name: "S1", jornada: "completa" },
        { organizationId: b.institution.id, name: "S2", jornada: "completa" },
      ]);
      const result = await call(
        institutionAdminRouter.list,
        { sort: [{ id: "campuses", desc: true }] },
        { context },
      );
      expect(result.rows.map((r) => r.id)).toEqual([b.institution.id, a.institution.id]);
    });

    test("rejects columns outside the allowlist", async () => {
      const { context } = await rootContext();
      expect(
        await codeOf(
          call(
            institutionAdminRouter.list,
            { sort: [{ id: "slug; drop table", desc: false }] } as never,
            { context },
          ),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("is gated on institution:read (D7); stats/get/update on institution:update", async () => {
      const asked: Record<string, string[]>[] = [];
      const { context } = await rootContext();
      const real = context.authorization;
      const spying: Context = {
        ...context,
        authorization: {
          ...real,
          hasPlatformPermission: (userId: string, permissions: Record<string, string[]>) => {
            asked.push(permissions);
            return real.hasPlatformPermission(userId, permissions);
          },
        } as Context["authorization"],
      };
      await call(institutionAdminRouter.list, {}, { context: spying });
      expect(asked.at(-1)).toEqual({ institution: ["read"] });
      await call(institutionAdminRouter.stats, undefined, { context: spying });
      expect(asked.at(-1)).toEqual({ institution: ["update"] });
    });
  });

  describe("stats, get, update (INS-01/02)", () => {
    test("stats totals institutions, campuses, students and admins", async () => {
      const { context } = await rootContext();
      expect(await call(institutionAdminRouter.stats, undefined, { context })).toEqual({
        institutions: 0,
        campuses: 0,
        students: 0,
        admins: 0,
      });
      const one = await createFull(context, "Colegio Uno");
      await createFull(context, "Colegio Dos");
      await handle.db.insert(schema.campus).values({
        organizationId: one.institution.id,
        name: "Sede A",
        jornada: "completa",
      });
      expect(await call(institutionAdminRouter.stats, undefined, { context })).toEqual({
        institutions: 2,
        campuses: 1,
        students: 0,
        admins: 2,
      });
    });

    test("get returns the detail with phone, address, resolution and rector; unknown id is NOT_FOUND", async () => {
      const { context } = await rootContext();
      const created = await createFull(context, "Colegio Uno", {
        phone: "300",
        address: "Calle 9",
        resolution: "R-1",
      });
      const detail = await call(
        institutionAdminRouter.get,
        { id: created.institution.id },
        { context },
      );
      expect(detail).toMatchObject({
        id: created.institution.id,
        phone: "300",
        address: "Calle 9",
        resolution: "R-1",
        rector: { userId: created.rector.userId, name: "Marta Gómez" },
      });
      expect(
        await codeOf(call(institutionAdminRouter.get, { id: "does-not-exist" }, { context })),
      ).toBe("NOT_FOUND");
    });

    test("update changes name and profile without touching the slug, audits, and spares other institutions", async () => {
      const { root, context } = await rootContext();
      const one = await createFull(context, "Colegio Uno", { nit: "900111111" });
      const two = await createFull(context, "Colegio Dos", { nit: "900222222" });
      auditLogger.reset();
      const updated = await call(
        institutionAdminRouter.update,
        {
          id: one.institution.id,
          name: "Colegio Uno Renovado",
          nit: "900333333",
          municipality: "Medellín",
          academicYear: "2027",
        },
        { context },
      );
      expect(updated).toMatchObject({
        name: "Colegio Uno Renovado",
        slug: "colegio-uno",
        nit: "900333333",
        municipality: "Medellín",
        academicYear: "2027",
      });
      const events = auditLogger.eventsFor("organization.updated");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        organizationId: one.institution.id,
        actorUserId: root.id,
        targetId: one.institution.id,
      });
      const untouched = await call(
        institutionAdminRouter.get,
        { id: two.institution.id },
        { context },
      );
      expect(untouched).toMatchObject({ name: "Colegio Dos", nit: "900222222" });
    });

    test("update upserts a missing profile; a taken NIT is CONFLICT; unknown id is NOT_FOUND", async () => {
      const { context } = await rootContext();
      const one = await createFull(context, "Colegio Uno");
      await createFull(context, "Colegio Dos", { nit: "900222222" });
      await handle.db
        .delete(schema.institutionProfile)
        .where(eq(schema.institutionProfile.organizationId, one.institution.id));
      const ok = await call(
        institutionAdminRouter.update,
        { id: one.institution.id, name: "Colegio Uno", academicYear: "2026", phone: "1234567" },
        { context },
      );
      expect(ok.phone).toBe("1234567");
      const conflict = await call(
        institutionAdminRouter.update,
        { id: one.institution.id, name: "Colegio Uno", academicYear: "2026", nit: "900222222" },
        { context },
      ).then(
        () => null,
        (e: unknown) => e as ORPCError<string, unknown>,
      );
      expect(conflict?.code).toBe("CONFLICT");
      expect(conflict?.message).toBe("Ya existe una institución con este NIT.");
      expect(
        await codeOf(
          call(
            institutionAdminRouter.update,
            { id: "nope", name: "X", academicYear: "2026" },
            { context },
          ),
        ),
      ).toBe("NOT_FOUND");
    });
  });

  describe("platform logo", () => {
    test("a failed replacement with identical bytes keeps the live logo object and column", async () => {
      const storage = new FakeStorage();
      const { context: base } = await rootContext();
      const context: Context = { ...base, fileStorage: storage };
      const one = await createFull(context, "Colegio Uno");
      const first = await call(
        institutionAdminRouter.setLogo,
        { id: one.institution.id, logo: fileOf(PNG, "image/png") },
        { context },
      );
      const failing: Context = {
        ...context,
        db: racingDb(handle.db, () => Promise.reject(new Error("injected update failure"))),
      };
      await expect(
        call(
          institutionAdminRouter.setLogo,
          { id: one.institution.id, logo: fileOf(PNG, "image/png") },
          { context: failing },
        ),
      ).rejects.toThrow();
      const [row] = await handle.db
        .select({ logo: schema.organization.logo })
        .from(schema.organization)
        .where(eq(schema.organization.id, one.institution.id));
      expect(row?.logo).toBe(first.logo);
      expect(storage.objects.size).toBe(1);
      expect(first.logo).toContain([...storage.objects][0] as string);
    });

    test("setLogo stores under the target institution and replaces the previous object; removeLogo clears it", async () => {
      const storage = new FakeStorage();
      const { context: base } = await rootContext();
      const context: Context = { ...base, fileStorage: storage };
      const one = await createFull(context, "Colegio Uno");
      const other = await createFull(context, "Colegio Dos");
      const first = await call(
        institutionAdminRouter.setLogo,
        { id: one.institution.id, logo: fileOf(PNG, "image/png") },
        { context },
      );
      expect(first.logo).toContain(`logos/${one.institution.id}/`);
      expect(storage.objects.size).toBe(1);
      const second = await call(
        institutionAdminRouter.setLogo,
        { id: one.institution.id, logo: fileOf(JPG, "image/jpeg") },
        { context },
      );
      expect(second.logo).not.toBe(first.logo);
      expect(storage.objects.size).toBe(1);
      expect(
        (await call(institutionAdminRouter.get, { id: other.institution.id }, { context })).logo,
      ).toBeNull();
      expect(
        await call(institutionAdminRouter.removeLogo, { id: one.institution.id }, { context }),
      ).toEqual({ logo: null });
      expect(storage.objects.size).toBe(0);
    });

    test("unknown institution is NOT_FOUND and bad bytes are BAD_REQUEST", async () => {
      const storage = new FakeStorage();
      const { context: base } = await rootContext();
      const context: Context = { ...base, fileStorage: storage };
      const one = await createFull(context, "Colegio Uno");
      expect(
        await codeOf(
          call(
            institutionAdminRouter.setLogo,
            { id: "nope", logo: fileOf(PNG, "image/png") },
            { context },
          ),
        ),
      ).toBe("NOT_FOUND");
      expect(storage.objects.size).toBe(0);
      expect(
        await codeOf(
          call(
            institutionAdminRouter.setLogo,
            { id: one.institution.id, logo: fileOf(new Uint8Array([1, 2, 3]), "image/png") },
            { context },
          ),
        ),
      ).toBe("BAD_REQUEST");
      expect(
        await codeOf(call(institutionAdminRouter.removeLogo, { id: "nope" }, { context })),
      ).toBe("NOT_FOUND");
    });
  });

  describe("delete (INS-R4)", () => {
    test("removes the institution, its profile and its logo object, and spares others", async () => {
      const storage = new FakeStorage();
      const { root, context: base } = await rootContext();
      const context: Context = { ...base, fileStorage: storage };
      const one = await createFull(context, "Colegio Uno");
      const two = await createFull(context, "Colegio Dos");
      await call(
        institutionAdminRouter.setLogo,
        { id: one.institution.id, logo: fileOf(PNG, "image/png") },
        { context },
      );
      await call(
        institutionAdminRouter.setLogo,
        { id: two.institution.id, logo: fileOf(JPG, "image/jpeg") },
        { context },
      );
      auditLogger.reset();
      expect(
        await call(institutionAdminRouter.delete, { id: one.institution.id }, { context }),
      ).toEqual({ deleted: true });
      expect(await handle.db.select().from(schema.organization)).toHaveLength(1);
      const profiles = await handle.db.select().from(schema.institutionProfile);
      expect(profiles.map((p) => p.organizationId)).toEqual([two.institution.id]);
      expect(storage.objects.size).toBe(1);
      expect([...storage.objects][0]).toContain(`logos/${two.institution.id}/`);
      const deleted = auditLogger.eventsFor("organization.deleted");
      expect(deleted).toHaveLength(1);
      expect(deleted[0]).toMatchObject({ actorUserId: root.id, targetId: one.institution.id });
      expect(
        await codeOf(call(institutionAdminRouter.delete, { id: one.institution.id }, { context })),
      ).toBe("NOT_FOUND");
    });

    test("a delete that loses the race records no organization.deleted event", async () => {
      const { context: base } = await rootContext();
      const one = await createFull(base, "Colegio Uno");
      auditLogger.reset();
      const racing: Context = {
        ...base,
        db: racingDb(handle.db, async () => {
          await handle.db
            .delete(schema.organization)
            .where(eq(schema.organization.id, one.institution.id));
        }),
      };
      expect(
        await codeOf(
          call(institutionAdminRouter.delete, { id: one.institution.id }, { context: racing }),
        ),
      ).toBe("NOT_FOUND");
      expect(auditLogger.eventsFor("organization.deleted")).toHaveLength(0);
    });

    test("a failing audit write still removes the logo object and surfaces the error", async () => {
      const storage = new FakeStorage();
      const { context: base } = await rootContext();
      const setup: Context = { ...base, fileStorage: storage };
      const one = await createFull(setup, "Colegio Uno");
      await call(
        institutionAdminRouter.setLogo,
        { id: one.institution.id, logo: fileOf(PNG, "image/png") },
        { context: setup },
      );
      expect(storage.objects.size).toBe(1);
      const context: Context = {
        ...setup,
        auditLogger: {
          record: (event) =>
            event.action === "organization.deleted"
              ? Promise.reject(new Error("audit down"))
              : auditLogger.record(event),
        },
      };
      expect(
        await codeOf(call(institutionAdminRouter.delete, { id: one.institution.id }, { context })),
      ).toBe("NOT_AN_ORPC_ERROR");
      expect(await handle.db.select().from(schema.organization)).toHaveLength(0);
      expect(storage.objects.size).toBe(0);
    });

    test("a failing logo deletion does not fail the delete", async () => {
      const storage = new FakeStorage();
      storage.delete = () => Promise.reject(new Error("storage down"));
      const { context: base } = await rootContext();
      const context: Context = { ...base, fileStorage: storage };
      const one = await createFull(context, "Colegio Uno");
      await call(
        institutionAdminRouter.setLogo,
        { id: one.institution.id, logo: fileOf(PNG, "image/png") },
        { context },
      );
      expect(
        await call(institutionAdminRouter.delete, { id: one.institution.id }, { context }),
      ).toEqual({ deleted: true });
    });
  });

  describe("manage (INS-03)", () => {
    test("returns the rector (oldest owner) of the target institution", async () => {
      const { context } = await rootContext();
      const one = await createFull(context, "Colegio Uno");
      await createFull(context, "Colegio Dos");
      expect(
        await call(institutionAdminRouter.manage, { id: one.institution.id }, { context }),
      ).toEqual({ userId: one.rector.userId });
    });

    test("NOT_FOUND for an unknown id or an institution with no owner", async () => {
      const { context } = await rootContext();
      const one = await createFull(context, "Colegio Uno");
      await handle.db
        .delete(schema.member)
        .where(eq(schema.member.organizationId, one.institution.id));
      expect(
        await codeOf(call(institutionAdminRouter.manage, { id: one.institution.id }, { context })),
      ).toBe("NOT_FOUND");
      expect(await codeOf(call(institutionAdminRouter.manage, { id: "nope" }, { context }))).toBe(
        "NOT_FOUND",
      );
    });
  });

  describe("a rector can call none of institutionAdmin.* (INS-R12)", () => {
    test("every procedure is FORBIDDEN for an institution owner", async () => {
      const { context: rootCtx } = await rootContext();
      const one = await createFull(rootCtx, "Colegio Uno");
      await handle.db
        .update(schema.person)
        .set({ mustChangePassword: false })
        .where(eq(schema.person.id, one.rector.personId));
      const { headers } = await helpers.login({
        userId: one.rector.userId,
        session: { activeOrganizationId: one.institution.id },
      });
      const owner = { ...(await contextFor(headers)), fileStorage: new FakeStorage() };
      const id = one.institution.id;
      const calls: [string, () => Promise<unknown>][] = [
        ["list", () => call(institutionAdminRouter.list, {}, { context: owner })],
        ["stats", () => call(institutionAdminRouter.stats, undefined, { context: owner })],
        ["get", () => call(institutionAdminRouter.get, { id }, { context: owner })],
        [
          "update",
          () =>
            call(
              institutionAdminRouter.update,
              { id, name: "X", academicYear: "2026" },
              { context: owner },
            ),
        ],
        [
          "setLogo",
          () =>
            call(
              institutionAdminRouter.setLogo,
              { id, logo: fileOf(PNG, "image/png") },
              { context: owner },
            ),
        ],
        ["removeLogo", () => call(institutionAdminRouter.removeLogo, { id }, { context: owner })],
        ["delete", () => call(institutionAdminRouter.delete, { id }, { context: owner })],
        ["manage", () => call(institutionAdminRouter.manage, { id }, { context: owner })],
      ];
      for (const [name, run] of calls) {
        expect([name, await codeOf(run())]).toEqual([name, "FORBIDDEN"]);
      }
      expect(await handle.db.select().from(schema.organization)).toHaveLength(1);
    });
  });
});
