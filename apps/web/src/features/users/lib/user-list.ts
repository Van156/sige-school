import { createListInput } from "@base-template/api/lib/list-input";
import { USER_STATUS_FILTERS, userListConfig } from "@base-template/api/lib/user-list-config";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";
import { roleKindLabel } from "@/shared/lib/role-label";

import type { UserRow, UserStats } from "../types";
import {
  ROLE_FILTER_TOKENS,
  isProtectedRole,
  toAssignableRole,
  type AssignableRole,
} from "./user-roles";

/** Server list input, built from the same allowlists as `user.list` (R3.8). */
export const userListInput = createListInput(userListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` are the sortable ids the table
 * renders (`lastLoginAt` is sortable on the server but has no USR-01 column); `filterableColumnIds`
 * mirror the server's filter ids. A test pins both against `userListConfig`.
 */
export const userSearchConfig = {
  columnIds: ["username", "name", "role", "status", "createdAt"],
  filterableColumnIds: ["name", "username", "role", "status"],
  defaultSort: [{ id: "createdAt", desc: true }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "username" | "name" | "role" | "status" | "createdAt",
  "name" | "username" | "role" | "status"
>;

const USER_FILTER_VARIANTS = {
  name: "text",
  username: "text",
  role: "select",
  status: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/usuarios`: always a search the server accepts (`?role=teacher`, ...). */
export const userSearchSchema = createDataTableSearchSchema(userSearchConfig).transform((search) =>
  normalizeSimpleSearch(search, USER_FILTER_VARIANTS, (filter) =>
    isFilterAccepted(userListInput, filter),
  ),
);

export const userSearchDefaults = userSearchSchema.parse({});

export type UserSearch = ReturnType<typeof userSearchSchema.parse>;

/** Route search to the `user.list` input. */
export function toUserListInput(search: UserSearch) {
  return toListInput(userListInput, {
    ...search,
    filters: simpleSearchToFilters(search, USER_FILTER_VARIANTS),
  });
}

/** Options of the "Rol" filter (default state is "Todos los roles", i.e. no filter). */
export const USER_ROLE_FILTER_OPTIONS: Option[] = ROLE_FILTER_TOKENS.map((token) => ({
  value: token,
  label: roleKindLabel(token),
}));

const STATUS_LABELS: Record<(typeof USER_STATUS_FILTERS)[number], string> = {
  active: "Activo",
  inactive: "Inactivo",
};

export const USER_STATUS_FILTER_OPTIONS: Option[] = USER_STATUS_FILTERS.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

/** USR-01 headers by role filter (sige/03 §5.1); the plural also feeds the description. */
const ROLE_PLURALS: Record<(typeof ROLE_FILTER_TOKENS)[number], string> = {
  admin: "Administradores",
  coordinator: "Coordinadores",
  teacher: "Profesores",
  student: "Estudiantes",
  parent: "Acudientes",
  viewer: "Usuarios de Consulta",
};

function pluralFor(role: string | undefined): string | undefined {
  return role !== undefined && role in ROLE_PLURALS
    ? ROLE_PLURALS[role as keyof typeof ROLE_PLURALS]
    : undefined;
}

export function userListTitle(role: string | undefined): string {
  return pluralFor(role) ?? "Gestión de Usuarios";
}

export function userListDescription(role: string | undefined, institutionName: string | undefined) {
  const plural = pluralFor(role);
  if (plural) {
    return `Mostrando ${plural.toLowerCase()}`;
  }
  return `Usuarios de ${institutionName ?? "tu institución"}`;
}

/** The USR-01 empty state shows only when the institution has no users at all (not a filter). */
export function hasNoUsers(stats: Pick<UserStats, "total"> | undefined) {
  return stats !== undefined && stats.total === 0;
}

/** Whether any filter narrows the list (changes the empty copy). */
export function hasActiveFilters(search: UserSearch) {
  return simpleSearchToFilters(search, USER_FILTER_VARIANTS).length > 0;
}

/** Row-action permissions of the caller (`user:update`, `user:delete`); UX only. */
export type UserRowPermissions = { canUpdate: boolean; canDelete: boolean };

export type UserRowAccess = { canEdit: boolean; canActivate: boolean; canDelete: boolean };

/** Shown by the USR-01 list when `user.list` fails. */
export const USERS_LOAD_ERROR = "No se pudieron cargar los usuarios.";

/**
 * Which row actions to offer (sige/03 §5.1, USR-R4): none on `owner`/`admin` rows, and no delete
 * or deactivation on the caller's own row. UX only; the procedures re-check and the API messages
 * stay authoritative.
 */
export function userRowAccess(
  row: Pick<UserRow, "role" | "isSelf">,
  permissions: UserRowPermissions,
): UserRowAccess {
  const editable = !isProtectedRole(row.role);
  const manageable = editable && !row.isSelf;
  return {
    canEdit: permissions.canUpdate && editable,
    canActivate: permissions.canUpdate && manageable,
    canDelete: permissions.canDelete && manageable,
  };
}

const STAT_PLACEHOLDER = "—";

/**
 * What a KPI tile shows for a `user.stats` count: a dash while the query is pending and a dash
 * with a hint when it failed, never a misleading 0.
 */
export function statTileDisplay(
  count: number | undefined,
  isError: boolean,
): { value: string; hint?: string } {
  if (count !== undefined) {
    return { value: String(count) };
  }
  return isError ? { value: STAT_PLACEHOLDER, hint: "No disponible" } : { value: STAT_PLACEHOLDER };
}

/**
 * The USR-01 create action for the active role filter (sige/03 §5.1): "Nuevo {Rol}" preselecting
 * that role in USR-02, or "Nuevo Usuario" for no filter or the `admin` filter (platform-managed).
 */
export function newUserAction(role: string | undefined): {
  label: string;
  role: AssignableRole | undefined;
} {
  const assignable = toAssignableRole(role);
  return assignable
    ? { label: `Nuevo ${roleKindLabel(assignable)}`, role: assignable }
    : { label: "Nuevo Usuario", role: undefined };
}
