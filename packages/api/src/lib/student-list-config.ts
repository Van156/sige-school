// Allowlists of the student list inputs (sige/05 §3.1, STU-01). Pure data shared by the oRPC
// procedures (`createListInput`) and the web tables (columns, route search).
import { STUDENT_STATUSES } from "@base-template/sige-core";

import type { ListInputConfig } from "./list-input";

/**
 * Students with a profile (`student.list`). The `name` text filter matches the student's name,
 * document or "Acudiente Principal" name; without a `status` filter every status is listed (the
 * web sends `status = activo` by default, STU-01). Default order: name (last name, first name).
 */
export const studentListConfig = {
  sortableColumns: ["name", "document", "course", "campus", "status"],
  filterableColumns: {
    name: "text",
    campusId: "select",
    courseId: "select",
    status: { variant: "select", options: STUDENT_STATUSES },
  },
  defaultSort: [{ id: "name", desc: false }],
} as const satisfies ListInputConfig<string, string>;

/** "Perfiles Académicos Incompletos" (`student.listIncomplete`): student logins without a profile. */
export const incompleteStudentListConfig = {
  sortableColumns: ["name", "createdAt"],
  filterableColumns: { name: "text" },
  defaultSort: [{ id: "name", desc: false }],
} as const satisfies ListInputConfig<string, string>;
