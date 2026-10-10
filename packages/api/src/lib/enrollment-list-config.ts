// Allowlists of the enrollment list input (sige/04 §3.3, SCH-01). Pure data shared by the oRPC
// procedure (`createListInput`) and the web table (columns, route search).
import { ENROLLMENT_STATUSES } from "@base-template/sige-core";

import type { ListInputConfig } from "./list-input";

/**
 * Enrollments (`enrollment.list`). The `student` text filter matches the student's name, the
 * document or the subject; `status` is one of the enrollment statuses. Default order: student
 * (last name), subject, course.
 */
export const enrollmentListConfig = {
  sortableColumns: ["student", "subject", "course", "enrollmentDate", "status", "finalScore"],
  filterableColumns: {
    student: "text",
    courseId: "select",
    subjectId: "select",
    status: { variant: "select", options: ENROLLMENT_STATUSES },
    academicYear: "select",
  },
  defaultSort: [
    { id: "student", desc: false },
    { id: "subject", desc: false },
    { id: "course", desc: false },
  ],
} as const satisfies ListInputConfig<string, string>;
