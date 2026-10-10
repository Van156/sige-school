import { classroomListConfig } from "@base-template/api/lib/classroom-list-config";
import { createListInput } from "@base-template/api/lib/list-input";
import { classroomTypeSchema } from "@base-template/api/sige/schemas/scheduling";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { ClassroomRow, ClassroomStats, ClassroomType } from "../types";

/** Server list input, built from the same allowlists as `classroom.list` (R3.8). */
export const classroomListInput = createListInput(classroomListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids; a test pins both.
 */
export const classroomSearchConfig = {
  columnIds: ["name", "code", "campus", "type", "capacity"],
  filterableColumnIds: ["name", "campusId", "type"],
  defaultSort: [{ id: "name", desc: false }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "name" | "code" | "campus" | "type" | "capacity",
  "name" | "campusId" | "type"
>;

const CLASSROOM_FILTER_VARIANTS = {
  name: "text",
  campusId: "select",
  type: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/salones`: always a search the server accepts. */
export const classroomSearchSchema = createDataTableSearchSchema(classroomSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, CLASSROOM_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(classroomListInput, filter),
    ),
);

export const classroomSearchDefaults = classroomSearchSchema.parse({});

export type ClassroomSearch = ReturnType<typeof classroomSearchSchema.parse>;

/** Route search to the `classroom.list` input. */
export function toClassroomListInput(search: ClassroomSearch) {
  return toListInput(classroomListInput, {
    ...search,
    filters: simpleSearchToFilters(search, CLASSROOM_FILTER_VARIANTS),
  });
}

/** Badge text of each classroom type (sige/04 §5.1). */
export const CLASSROOM_TYPE_LABELS: Readonly<Record<ClassroomType, string>> = {
  aula: "Aula",
  laboratorio: "Laboratorio",
  auditorio: "Auditorio",
  cancha: "Cancha",
};

/** The type select's / filter's choices, in the enum's declaration order. */
export const CLASSROOM_TYPE_OPTIONS: Option[] = classroomTypeSchema.options.map((type) => ({
  value: type,
  label: CLASSROOM_TYPE_LABELS[type],
}));

/** "{n} personas" cell of "Capacidad". */
export function formatCapacity(capacity: number): string {
  return `${capacity} personas`;
}

/** "Ubicación" cell: "Edificio {x}, Piso {n}", or "Piso {n}" without a building. */
export function formatLocation(room: Pick<ClassroomRow, "building" | "floor">): string {
  return room.building ? `Edificio ${room.building}, Piso ${room.floor}` : `Piso ${room.floor}`;
}

/** The empty state shows only when the institution has no classrooms at all (not a filter). */
export function hasNoClassrooms(stats: Pick<ClassroomStats, "total"> | undefined): boolean {
  return stats !== undefined && stats.total === 0;
}
