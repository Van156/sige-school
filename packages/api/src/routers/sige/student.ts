import { ORPCError } from "@orpc/server";

import { requireAnyPermission, requirePermission } from "../../index";
import { createListInput } from "../../lib/list-input";
import { incompleteStudentListConfig, studentListConfig } from "../../lib/student-list-config";
import { sigeProcedure } from "../../sige/procedure";
import {
  studentCompleteInput,
  studentCreateInput,
  studentIdInput,
  studentPickInput,
  studentUpdateInput,
} from "../../sige/schemas/student";
import {
  listIncompleteStudents,
  listStudentRows,
  loadStudentDetail,
  pickStudents,
} from "../../sige/student-queries";
import {
  completeStudent,
  createStudent,
  deleteStudent,
  STUDENT_NOT_FOUND_MESSAGE,
  updateStudent,
} from "../../sige/student-service";

/**
 * `student.*` (sige/05 §3.1, STU-01/02/03). Reads AND `ScopePolicy.studentWhere()` (STU-R1:
 * teacher own courses per D2, student self, parent linked children; managers unrestricted), so an
 * out-of-scope or other-tenant id is `NOT_FOUND` (R1.15). Writes live in `sige/student-service.ts`
 * (path A/B admission with STU-R3 enrollment, STU-R4/R5 edit, STU-R7 delete).
 *
 * `list` without a `status` filter returns every status; the web sends `status = activo` by
 * default (STU-01 "Activos"), so "Todos" stays expressible. `pick` is active-only (R2.10).
 */

const listInput = createListInput(studentListConfig);
const incompleteListInput = createListInput(incompleteStudentListConfig);

export const studentRouter = {
  /** Server-list mode (R3.8): `{ rows, total }`; `total` ignores paging. */
  list: sigeProcedure
    .use(requirePermission({ student: ["read"] }))
    .input(listInput)
    .handler(({ context, input }) =>
      listStudentRows(context.db, context.org.id, input, context.scope.studentWhere()),
    ),

  /** "Perfiles Académicos Incompletos": student logins without a profile (path B). */
  listIncomplete: sigeProcedure
    .use(requirePermission({ student: ["create"] }))
    .input(incompleteListInput)
    .handler(({ context, input }) => listIncompleteStudents(context.db, context.org.id, input)),

  get: sigeProcedure
    .use(requirePermission({ student: ["read"] }))
    .input(studentIdInput)
    .handler(async ({ context, input }) => {
      const detail = await loadStudentDetail(
        context.db,
        context.org.id,
        input.id,
        context.scope.studentWhere(),
      );
      if (!detail) throw new ORPCError("NOT_FOUND", { message: STUDENT_NOT_FOUND_MESSAGE });
      return detail;
    }),

  /** Shared per-student picker (R1.16): staff all/own, student self, parent linked children. */
  pick: sigeProcedure
    .use(
      requireAnyPermission(
        { student: ["read"] },
        { portal: ["read_self"] },
        { portal: ["read_child"] },
      ),
    )
    .input(studentPickInput)
    .handler(({ context, input }) =>
      pickStudents(context.db, context.org.id, input, context.scope.studentWhere()),
    ),

  /** STU-03 new (path A, STU-R2/R3). */
  create: sigeProcedure
    .use(requirePermission({ student: ["create"] }))
    .input(studentCreateInput)
    .handler(({ context, input }) => createStudent(context, input)),

  /** STU-03 complete (path B). */
  complete: sigeProcedure
    .use(requirePermission({ student: ["create"] }))
    .input(studentCompleteInput)
    .handler(({ context, input }) => completeStudent(context, input)),

  /** STU-03 edit (STU-R4/R5). */
  update: sigeProcedure
    .use(requirePermission({ student: ["update"] }))
    .input(studentUpdateInput)
    .handler(({ context, input }) => updateStudent(context, input)),

  /** STU-R7: empty profiles only; removes guardian links, the profile and the login. */
  delete: sigeProcedure
    .use(requirePermission({ student: ["delete"] }))
    .input(studentIdInput)
    .handler(({ context, input }) => deleteStudent(context, input.id)),
};
