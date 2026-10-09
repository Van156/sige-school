import {
  isProtectedRole,
  statTileDisplay,
  toUserListInput,
  type UserSearch,
} from "@/features/users";

/** Placeholder of the INS-04 toolbar search (the "Nombre Completo" text filter). */
export const PLATFORM_USERS_SEARCH_PLACEHOLDER = "Buscar por nombre, email o usuario";

export const PLATFORM_USERS_LOAD_ERROR = "No se pudieron cargar los usuarios.";

/** `platformUser.list` input: the shared user list input with the institution fixed. */
export function toPlatformUserListInput(institutionId: string, search: UserSearch) {
  return { institutionId, ...toUserListInput(search) };
}

/** `platformUser.stats`: the INS-04 KPI tiles. */
export type PlatformUserStats = {
  admins: number;
  coordinators: number;
  teachers: number;
  students: number;
};

/** The four KPI tiles of INS-04 in display order; a count is a dash until it is known. */
export function platformStatTiles(
  stats: PlatformUserStats | undefined,
  isError: boolean,
): { label: string; value: string; hint?: string }[] {
  const tile = (label: string, count: number | undefined) => ({
    label,
    ...statTileDisplay(count, isError),
  });
  return [
    tile("Administradores", stats?.admins),
    tile("Coordinadores", stats?.coordinators),
    tile("Profesores", stats?.teachers),
    tile("Estudiantes", stats?.students),
  ];
}

/**
 * The INS-04 empty state shows when the institution has no users at all. The role counters of
 * `platformUser.stats` leave out acudientes and consulta, so the unfiltered list total decides.
 */
export function hasNoPlatformUsers(total: number | undefined, filtersActive: boolean): boolean {
  return total === 0 && !filtersActive;
}

/**
 * Whether the row can be opened in USR-03 through "Editar". Owner and admin rows are refused
 * there for institution callers (USR-R4), and "Editar" impersonates one, so it is not offered.
 */
export function canEditThroughImpersonation(row: { role: string }): boolean {
  return !isProtectedRole(row.role);
}
