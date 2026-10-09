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

/** Identifies a KPI tile, so the view can pair it with its icon. */
export type PlatformStatId = "admins" | "coordinators" | "teachers" | "students";

export type PlatformStatTile = { id: PlatformStatId; label: string; value: string; hint?: string };

/** The four KPI tiles of INS-04 in display order; a count is a dash until it is known. */
export function platformStatTiles(
  stats: PlatformUserStats | undefined,
  isError: boolean,
): PlatformStatTile[] {
  const tile = (id: PlatformStatId, label: string): PlatformStatTile => ({
    id,
    label,
    ...statTileDisplay(stats?.[id], isError),
  });
  return [
    tile("admins", "Administradores"),
    tile("coordinators", "Coordinadores"),
    tile("teachers", "Profesores"),
    tile("students", "Estudiantes"),
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
