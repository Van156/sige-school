// Allowlists of the course list input (sige/02 §3.3, INS-11). Pure data shared by the oRPC
// procedure (`createListInput`) and the web table (columns, route search).
import type { ListInputConfig } from "./list-input";

/** Mirrors the `course_shift` enum (sige/02 §2). */
export const COURSE_SHIFTS = ["Mañana", "Tarde", "Nocturna", "Única", "Sabatina"] as const;

/**
 * Courses (`course.list`). `name` is a case-insensitive text search; the campus, level, shift and
 * academic year filters are exact matches on ids or values. Default order: academic year (newest
 * first is the caller's choice), so the default is by name for a stable reading order.
 */
export const courseListConfig = {
  sortableColumns: [
    "name",
    "campus",
    "director",
    "academicYear",
    "shift",
    "maxStudents",
    "studentCount",
  ],
  filterableColumns: {
    name: "text",
    campusId: "select",
    levelId: "select",
    shift: { variant: "select", options: COURSE_SHIFTS },
    academicYear: "select",
  },
  defaultSort: [{ id: "name", desc: false }],
} as const satisfies ListInputConfig<string, string>;
