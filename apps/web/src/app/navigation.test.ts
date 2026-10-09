import { describe, expect, test } from "bun:test";

import { filterNavGroups, getBreadcrumbs, type NavGroup } from "@/shared/lib/navigation";

import {
  can,
  deriveSectionItems,
  getSectionItems,
  holds,
  type NavContext,
  navGroups,
  resolveDisplayRole,
  resolveHasOrganization,
  resolveNavPermissions,
} from "./navigation";

const member: NavContext = {
  isSuperadmin: false,
  hasOrganization: true,
  kind: "owner",
  permissions: null,
};
const superadmin: NavContext = { ...member, isSuperadmin: true, kind: null };
const noOrganization: NavContext = { ...member, hasOrganization: false };
const teacher: NavContext = { ...member, kind: "teacher" };

describe("getSectionItems", () => {
  test("derives the settings tabs from the sidebar config, in order", () => {
    expect(getSectionItems("settings", member)).toEqual([
      { to: "/settings/general", label: "General" },
      { to: "/settings/members", label: "Miembros" },
      { to: "/settings/invitations", label: "Invitaciones" },
      { to: "/settings/roles", label: "Roles" },
      { to: "/settings/activity", label: "Actividad" },
    ]);
  });

  test("derives the account tabs from the sidebar config, in order", () => {
    expect(getSectionItems("account", member)).toEqual([
      { to: "/account/profile", label: "Mi Perfil" },
      { to: "/account/security", label: "Seguridad" },
      { to: "/account/preferences", label: "Preferencias" },
      { to: "/account/danger", label: "Zona de peligro" },
    ]);
  });

  test("derives the admin tabs from the sidebar config, in order", () => {
    expect(getSectionItems("admin", superadmin)).toEqual([
      { to: "/admin/users", label: "Usuarios" },
      { to: "/admin/organizations", label: "Organizaciones" },
      { to: "/admin/instituciones", label: "Instituciones" },
      { to: "/admin/instituciones/seleccionar", label: "Seleccionar Institución" },
      { to: "/admin/activity", label: "Actividad" },
    ]);
  });

  test("honors the group visibility predicate with the sidebar context", () => {
    expect(getSectionItems("admin", member)).toEqual([]);
  });

  test("every section id in the config is unique", () => {
    const ids = navGroups.map((group) => group.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("navGroups visibility", () => {
  test("institution management sees dashboard, configuration and account but not the platform group", () => {
    const labels = filterNavGroups(navGroups, member).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual(["Dashboard", "Configuración", "Mi cuenta"]);
  });

  test("an admin kind sees the same sections as the owner", () => {
    const labels = filterNavGroups(navGroups, { ...member, kind: "admin" }).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual(["Dashboard", "Configuración", "Mi cuenta"]);
  });

  test.each(["coordinator", "teacher", "student", "parent", "viewer", "custom"] as const)(
    "a %s sees only dashboard and account (no management settings)",
    (kind) => {
      const labels = filterNavGroups(navGroups, { ...member, kind }).flatMap((group) =>
        group.items.map((item) => item.label),
      );
      expect(labels).toEqual(["Dashboard", "Mi cuenta"]);
    },
  );

  test("the settings tabs are empty for a non-manager", () => {
    expect(getSectionItems("settings", teacher)).toEqual([]);
  });

  test("a user whose kind is still unresolved sees no management settings", () => {
    const groups = filterNavGroups(navGroups, { ...member, kind: null });
    expect(groups.map((group) => group.id)).toEqual([undefined, "account"]);
  });

  test("a user without an organization sees only the personal account group", () => {
    const groups = filterNavGroups(navGroups, noOrganization);
    expect(groups.map((group) => group.id)).toEqual(["account"]);
  });

  test("a superadmin without an organization keeps the platform group", () => {
    const groups = filterNavGroups(navGroups, { ...superadmin, hasOrganization: false });
    expect(groups.map((group) => group.id)).toEqual(["account", "admin"]);
  });

  test("the organization settings tabs are empty without an organization", () => {
    expect(getSectionItems("settings", noOrganization)).toEqual([]);
  });

  test("a superadmin additionally sees the admin parent with its children", () => {
    const groups = filterNavGroups(navGroups, superadmin);
    expect(groups.map((group) => group.id)).toEqual([undefined, "account", "admin"]);
    const admin = groups.find((group) => group.id === "admin");
    expect(admin?.items[0]?.children?.map((child) => child.to)).toEqual([
      "/admin/users",
      "/admin/organizations",
      "/admin/instituciones",
      "/admin/instituciones/seleccionar",
      "/admin/activity",
    ]);
  });

  test("the institution group lists the profile for managers and campuses for any reader", () => {
    const withPermissions = (kind: NavContext["kind"], permissions: Record<string, string[]>) =>
      filterNavGroups(navGroups, { ...member, kind, permissions }).find(
        (group) => group.id === "institution",
      );
    const owner = withPermissions("owner", {
      institution: ["read"],
      campus: ["read"],
      level: ["read"],
      course: ["read"],
      subject: ["read"],
      period: ["read"],
      criterion: ["read"],
    });
    expect(owner?.items.map((item) => item.to)).toEqual([
      "/configuracion-institucion",
      "/sedes",
      "/niveles",
      "/cursos",
      "/asignaturas",
      "/periodos",
      "/criterios",
    ]);
    const coordinator = withPermissions("coordinator", {
      institution: ["read"],
      campus: ["read"],
      course: ["read"],
    });
    expect(coordinator?.items.map((item) => item.to)).toEqual(["/sedes", "/cursos"]);
    expect(withPermissions("teacher", {})).toBeUndefined();
    // Teachers read subjects and criteria but not levels or periods (sige/02 permission matrix).
    expect(
      withPermissions("teacher", { subject: ["read"], criterion: ["read"] })?.items.map(
        (item) => item.to,
      ),
    ).toEqual(["/asignaturas", "/criterios"]);
  });

  test("the users group lists Usuarios only for holders of user:read", () => {
    const usersGroup = (kind: NavContext["kind"], permissions: Record<string, string[]>) =>
      filterNavGroups(navGroups, { ...member, kind, permissions }).find(
        (group) => group.id === "users",
      );
    expect(usersGroup("owner", { user: ["read"] })?.items.map((item) => item.to)).toEqual([
      "/usuarios",
    ]);
    expect(usersGroup("coordinator", { campus: ["read"] })).toBeUndefined();
  });

  test("breadcrumbs resolve through the real config", () => {
    expect(getBreadcrumbs(filterNavGroups(navGroups, member), "/settings/roles")).toEqual([
      { label: "Gestión" },
      { label: "Configuración", to: "/settings/general" },
      { label: "Roles" },
    ]);
  });
});

describe("deriveSectionItems with parents (local fixture)", () => {
  const fixture: NavGroup<NavContext>[] = [
    {
      id: "settings",
      label: "Settings",
      items: [
        {
          label: "Org",
          to: "/settings/general",
          children: [
            { label: "General", to: "/settings/general" },
            { label: "Secret", to: "/settings/activity", visible: (ctx) => ctx.isSuperadmin },
          ],
        },
        { label: "Roles", to: "/settings/roles" },
      ],
    },
  ];

  test("flattens parents into their visible children", () => {
    expect(deriveSectionItems(fixture, "settings", member)).toEqual([
      { to: "/settings/general", label: "General" },
      { to: "/settings/roles", label: "Roles" },
    ]);
  });

  test("includes children that the context allows", () => {
    expect(deriveSectionItems(fixture, "settings", superadmin).map((item) => item.label)).toEqual([
      "General",
      "Secret",
      "Roles",
    ]);
  });
});

describe("permission-gated entries", () => {
  const gated: NavGroup<NavContext>[] = [
    {
      label: "Académico",
      items: [
        { label: "Boletines", to: "/boletines" as never, visible: can("report_card:deliver") },
        { label: "Notas", to: "/notas" as never, visible: can("grade:read") },
      ],
    },
  ];
  const withPermissions = (permissions: NavContext["permissions"]): NavContext => ({
    ...member,
    permissions,
  });

  test("an entry shows only when the caller holds its permission", () => {
    const labels = (ctx: NavContext) =>
      filterNavGroups(gated, ctx).flatMap((group) => group.items.map((item) => item.label));
    expect(labels(withPermissions({ report_card: ["deliver"] }))).toEqual(["Boletines"]);
    expect(labels(withPermissions({ grade: ["read"], report_card: ["read"] }))).toEqual(["Notas"]);
    expect(labels(withPermissions({}))).toEqual([]);
  });

  test("unresolved permissions fail closed", () => {
    expect(holds(withPermissions(null), "report_card:deliver")).toBe(false);
  });
});

describe("resolveNavPermissions", () => {
  test("built-in roles resolve from the code catalog without a request", () => {
    expect(resolveNavPermissions({ roleName: "admin" }, undefined)?.report_card).toContain(
      "deliver",
    );
    expect(resolveNavPermissions({ roleName: "teacher" }, undefined)?.report_card).not.toContain(
      "deliver",
    );
  });

  test("a custom role resolves from its organization role row and fails closed until loaded", () => {
    const rows = [{ role: "secretaria", permission: { report_card: ["deliver"] } }];
    expect(resolveNavPermissions({ roleName: "secretaria" }, rows)).toEqual({
      report_card: ["deliver"],
    });
    expect(resolveNavPermissions({ roleName: "secretaria" }, undefined)).toBeNull();
  });

  test("no identity yet means no permissions", () => {
    expect(resolveNavPermissions(undefined, undefined)).toBeNull();
    expect(resolveNavPermissions(null, undefined)).toBeNull();
  });
});

describe("resolveDisplayRole", () => {
  test("a platform superadmin shows as root, anyone else as their kind", () => {
    expect(resolveDisplayRole(superadmin)).toBe("root");
    expect(resolveDisplayRole(teacher)).toBe("teacher");
    expect(resolveDisplayRole({ ...member, kind: null })).toBeNull();
  });
});

describe("resolveHasOrganization", () => {
  const base = { activeOrganizationId: null, organizationCount: 0, isLoading: false };

  test("is false with no active organization and no memberships", () => {
    expect(resolveHasOrganization(base)).toBe(false);
    expect(resolveHasOrganization({ ...base, organizationCount: undefined })).toBe(false);
  });

  test("is true with an active organization", () => {
    expect(resolveHasOrganization({ ...base, activeOrganizationId: "org_1" })).toBe(true);
  });

  test("is true with memberships but none active (the org guard activates the first)", () => {
    expect(resolveHasOrganization({ ...base, organizationCount: 2 })).toBe(true);
  });

  test("is optimistic while the organization list loads", () => {
    expect(resolveHasOrganization({ ...base, organizationCount: undefined, isLoading: true })).toBe(
      true,
    );
  });

  test("keeps the links when the organization list failed to load", () => {
    expect(resolveHasOrganization({ ...base, organizationCount: undefined, hasError: true })).toBe(
      true,
    );
  });
});
