import { requirePermission } from "../../index";
import { linkGuardian, listGuardianCandidates, unlinkGuardian } from "../../sige/guardian-service";
import { sigeProcedure } from "../../sige/procedure";
import {
  guardianCandidatesInput,
  guardianLinkInput,
  guardianUnlinkInput,
} from "../../sige/schemas/student";

/**
 * `guardian.*` (sige/05 §3.1, STU-04, STU-R6, D5, D8): candidates, link and unlink, all behind
 * `student:guardians`. The student is looked up through `ScopePolicy.studentWhere()`, so an
 * out-of-scope or other-tenant student is `NOT_FOUND` (R1.15); guardians are persons of the
 * caller's institution only. Accounts are created in USR-02; this router only links them.
 */
export const guardianRouter = {
  /** Active `parent` persons not yet linked to the student (search by name, username, document). */
  candidates: sigeProcedure
    .use(requirePermission({ student: ["guardians"] }))
    .input(guardianCandidatesInput)
    .handler(({ context, input }) => listGuardianCandidates(context, input)),

  /** STU-R6: active `parent` person, not already linked; audited `guardian.linked`. */
  link: sigeProcedure
    .use(requirePermission({ student: ["guardians"] }))
    .input(guardianLinkInput)
    .handler(({ context, input }) => linkGuardian(context, input)),

  /** Removes one link (the guardian's account is untouched); audited `guardian.unlinked`. */
  unlink: sigeProcedure
    .use(requirePermission({ student: ["guardians"] }))
    .input(guardianUnlinkInput)
    .handler(({ context, input }) => unlinkGuardian(context, input)),
};
