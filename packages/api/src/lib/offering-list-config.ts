// Allowlists of the offering list input (sige/04 §3.1, SCH-05). Pure data shared by the oRPC
// procedure (`createListInput`) and the web table (columns, route search).
import type { ListInputConfig } from "./list-input";

/** `teacher` filter values: whether the offering has a teacher yet. */
export const OFFERING_TEACHER_FILTERS = ["assigned", "unassigned"] as const;

/**
 * Offerings (`offering.list`). Sorting by `teacher` orders by the teacher's name; filtering by
 * `teacher` is the assigned/unassigned switch. Default order: course, then subject.
 */
export const offeringListConfig = {
  sortableColumns: ["subject", "course", "hoursPerWeek", "teacher"],
  filterableColumns: {
    courseId: "select",
    subjectId: "select",
    teacher: { variant: "select", options: OFFERING_TEACHER_FILTERS },
    academicYear: "select",
  },
  defaultSort: [
    { id: "course", desc: false },
    { id: "subject", desc: false },
  ],
} as const satisfies ListInputConfig<string, string>;
