import { parsePermissionString } from "@base-template/auth/permissions";
import {
  BookOpen,
  Building2,
  LayoutDashboard,
  Layers,
  MapPin,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  buildRoleCatalog,
  resolveCallerPermission,
  type PermissionsRecord,
} from "@/features/access-control";
import type { SectionNavItem } from "@/shared/components/layout/section-nav";
import { filterNavGroups, flattenNavItems, type NavGroup } from "@/shared/lib/navigation";
import type { RoleKind } from "@/shared/lib/role-label";

/** The SIGE caller kind `me.get` resolves from `member.role`; `custom` is any non-built-in role. */
export type NavKind = Exclude<RoleKind, "root">;

/** Inputs to the sidebar items' `visible` predicates. */
export type NavContext = {
  isSuperadmin: boolean;
  /**
   * Whether the user belongs to (or is still resolving) at least one organization. Org-scoped
   * links bounce a user with none to `/onboarding`, so they are hidden instead.
   */
  hasOrganization: boolean;
  /** `me.get` kind; `null` while it loads, when it failed, or for an account without a person. */
  kind: NavKind | null;
  /** The caller's resolved permissions; `null` while unresolved, which fails closed. */
  permissions: PermissionsRecord | null;
};

/**
 * `hasOrganization` for `NavContext`. Optimistic while the organization list is loading, so the
 * org links do not flash away on every page load, and while a failed list lookup is unresolved
 * (`hasError`): an unknown membership must not hide links a member may need. A member with organizations but none active
 * keeps the links: the `_org` route guard activates their first membership on arrival.
 */
export function resolveHasOrganization({
  activeOrganizationId,
  organizationCount,
  isLoading,
  hasError = false,
}: {
  activeOrganizationId: string | null | undefined;
  organizationCount: number | undefined;
  isLoading: boolean;
  hasError?: boolean;
}): boolean {
  return Boolean(activeOrganizationId) || isLoading || hasError || (organizationCount ?? 0) > 0;
}

/**
 * The caller's permissions from `me.get`'s role name: built-in roles resolve from the code-defined
 * catalog (no request); a custom role needs its organization role row (`customRoles`) and fails
 * closed (`null`) until that is loaded.
 */
export function resolveNavPermissions(
  me: { roleName: string } | null | undefined,
  customRoles: readonly { role: string; permission: PermissionsRecord }[] | undefined,
): PermissionsRecord | null {
  if (!me) {
    return null;
  }
  return resolveCallerPermission(me.roleName, buildRoleCatalog(customRoles ?? []));
}

/**
 * Whether the context holds a `feature:action` permission (R1.25). The module that adds a sidebar
 * entry gates it with `visible: can("report_card:deliver")`. UX only; procedures re-check.
 */
export function holds(ctx: NavContext, permission: string): boolean {
  const { feature, action } = parsePermissionString(permission);
  return ctx.permissions?.[feature]?.includes(action) ?? false;
}

/** Predicate factory for `NavItem.visible` / `NavGroup.visible`. */
export function can(permission: string): (ctx: NavContext) => boolean {
  return (ctx) => holds(ctx, permission);
}

const hasOrganization = (ctx: NavContext) => ctx.hasOrganization;

/** Institution management (rector and administrators): the audience of the organization settings. */
export const isInstitutionManager = (ctx: NavContext) =>
  ctx.hasOrganization && (ctx.kind === "owner" || ctx.kind === "admin");

/**
 * Sidebar navigation for the authenticated shell. Visibility is UX only: every page keeps its own
 * permission gate (`CanGate`, the admin layout check) and every procedure re-checks on the server
 * (R6.5).
 *
 * Registering a module's entry: add a `NavItem` to the matching group (or a new group) with
 * `visible: can("<feature>:<action>")` from sige/01 §5.2, in the same change that creates its
 * route. Entries whose route does not exist yet are not listed (no dead links).
 */
export const navGroups: NavGroup<NavContext>[] = [
  {
    label: "Dashboard",
    visible: hasOrganization,
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "institution",
    label: "Institución",
    visible: hasOrganization,
    items: [
      {
        // sige/02 §5.2: the profile screen is only in the admin nav; other roles see it in banners.
        label: "Configuración de Institución",
        to: "/configuracion-institucion",
        icon: Building2,
        visible: (ctx) => isInstitutionManager(ctx) && holds(ctx, "institution:read"),
      },
      { label: "Sedes", to: "/sedes", icon: MapPin, visible: can("campus:read") },
      { label: "Niveles", to: "/niveles", icon: Layers, visible: can("level:read") },
      { label: "Asignaturas", to: "/asignaturas", icon: BookOpen, visible: can("subject:read") },
    ],
  },
  {
    id: "settings",
    label: "Gestión",
    visible: isInstitutionManager,
    items: [
      {
        label: "Configuración",
        to: "/settings/general",
        icon: Settings,
        children: [
          { label: "General", to: "/settings/general" },
          { label: "Miembros", to: "/settings/members" },
          { label: "Invitaciones", to: "/settings/invitations" },
          { label: "Roles", to: "/settings/roles" },
          { label: "Actividad", to: "/settings/activity" },
        ],
      },
    ],
  },
  {
    id: "account",
    label: "Personal",
    items: [
      {
        label: "Mi cuenta",
        to: "/account/profile",
        icon: UserRound,
        children: [
          { label: "Mi Perfil", to: "/account/profile" },
          { label: "Seguridad", to: "/account/security" },
          { label: "Preferencias", to: "/account/preferences" },
          { label: "Zona de peligro", to: "/account/danger" },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Plataforma",
    visible: (ctx) => ctx.isSuperadmin,
    items: [
      {
        label: "Administración",
        to: "/admin/users",
        icon: ShieldCheck,
        children: [
          { label: "Usuarios", to: "/admin/users" },
          { label: "Organizaciones", to: "/admin/organizations" },
          { label: "Instituciones", to: "/admin/instituciones" },
          { label: "Actividad", to: "/admin/activity" },
        ],
      },
    ],
  },
];

/**
 * Tab items for a section layout (`settings`, `admin`), derived from the
 * sidebar config with the same visibility predicates and context, so both
 * navigations always list the same pages.
 */
export function getSectionItems(
  sectionId: "settings" | "account" | "admin",
  context: NavContext,
): SectionNavItem[] {
  return deriveSectionItems(navGroups, sectionId, context);
}

/** Pure core of `getSectionItems`, taking the config so tests can use a local fixture. */
export function deriveSectionItems(
  groups: NavGroup<NavContext>[],
  sectionId: string,
  context: NavContext,
): SectionNavItem[] {
  const group = filterNavGroups(groups, context).find((candidate) => candidate.id === sectionId);
  return flattenNavItems(group?.items ?? []).map(({ to, label }) => ({ to, label }));
}

/** The role to show in the sidebar badge: `root` for a platform superadmin, else the `me.get` kind. */
export function resolveDisplayRole(ctx: NavContext): RoleKind | null {
  return ctx.isSuperadmin ? "root" : ctx.kind;
}
