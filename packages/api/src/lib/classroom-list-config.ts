// Allowlists of the classroom list input (sige/04 §3.4, SCH-07). Pure data shared by the oRPC
// procedure (`createListInput`) and the web table (columns, route search).
import type { ListInputConfig } from "./list-input";

/** Mirrors the `classroom_type` enum (sige/04 §2). */
export const CLASSROOM_TYPES = ["aula", "laboratorio", "auditorio", "cancha"] as const;

/**
 * Classrooms (`classroom.list`). `name` is a case-insensitive text search; the campus and type
 * filters are exact matches. Default order: name, for a stable reading order.
 */
export const classroomListConfig = {
  sortableColumns: ["name", "code", "campus", "type", "capacity"],
  filterableColumns: {
    name: "text",
    campusId: "select",
    type: { variant: "select", options: CLASSROOM_TYPES },
  },
  defaultSort: [{ id: "name", desc: false }],
} as const satisfies ListInputConfig<string, string>;
