// Allowlists of the teacher-assignment list input (sige/04 §3.2, SCH-03). Pure data shared by the
// oRPC procedure (`createListInput`) and the web table (columns, route search).
import type { ListInputConfig } from "./list-input";

/** Mirrors the `teacher_assignment_status` enum (sige/04 §2). */
export const ASSIGNMENT_STATUSES = ["activo", "inactivo", "temporal"] as const;

/**
 * Assignments (`assignment.list`). `teacher` is a case-insensitive text search over the teacher's
 * name; the other filters are exact matches. Default order: course, then subject.
 */
export const assignmentListConfig = {
  sortableColumns: ["teacher", "subject", "course", "assignmentDate", "status"],
  filterableColumns: {
    teacher: "text",
    courseId: "select",
    subjectId: "select",
    status: { variant: "select", options: ASSIGNMENT_STATUSES },
    academicYear: "select",
  },
  defaultSort: [
    { id: "course", desc: false },
    { id: "subject", desc: false },
  ],
} as const satisfies ListInputConfig<string, string>;
