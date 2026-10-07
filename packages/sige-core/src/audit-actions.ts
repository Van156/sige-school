/**
 * SIGE organization-scoped audit actions (spec §6.9, R3.26), `entity.verb`, as runtime values.
 * Pure (no drizzle or better-auth import) so the browser can import it. `packages/auth` appends
 * them to `ORGANIZATION_AUDIT_ACTIONS`, which keeps the `AuditEvent` types and the list
 * allowlists in sync. Events must never carry secrets, passwords or full grade matrices.
 */
export const SIGE_AUDIT_ACTIONS = [
  // Institution
  "institution.profile_updated",
  "campus.created",
  "campus.updated",
  "campus.deleted",
  "course.created",
  "course.updated",
  "course.deleted",
  "level.created",
  "level.updated",
  "level.deleted",
  "subject.created",
  "subject.updated",
  "subject.deleted",
  "period.created",
  "period.updated",
  "period.deleted",
  "period.activated",
  "criterion.created",
  "criterion.updated",
  "criterion.deleted",
  // People
  "user.created",
  "user.updated",
  "user.deleted",
  "user.deactivated",
  "user.reactivated",
  "user.password_reset",
  "user.imported",
  "student.created",
  "student.updated",
  "student.deleted",
  "student.status_changed",
  "student.imported",
  "guardian.linked",
  "guardian.unlinked",
  // Academic ops
  "offering.created",
  "offering.updated",
  "offering.deleted",
  "classroom.created",
  "classroom.updated",
  "classroom.deleted",
  "time_block.created",
  "time_block.updated",
  "time_block.deleted",
  "teacher.assigned",
  "enrollment.bulk_created",
  "enrollment.updated",
  "enrollment.deleted",
  "schedule.generated",
  "schedule.slot_deleted",
  // Grades
  "grade.sheet_saved",
  "grade.imported",
  "grade.locked",
  "grade.unlocked",
  "grade.recalculated",
  // Records
  "attendance.saved",
  "observation.updated",
  "observation.deleted",
  "observation.notified",
  "report_card.generated",
  "report_card.regenerated",
  "report_card.updated",
  "report_card.delivered",
  "report_card.deleted",
  "alert.resolved",
  "alert.engine_run",
  "achievement.awarded",
  "achievement.engine_run",
  // Access
  "qr.regenerated",
  "qr.reader_created",
  "qr.reader_revoked",
] as const;

export type SigeAuditAction = (typeof SIGE_AUDIT_ACTIONS)[number];

const KNOWN = new Set<string>(SIGE_AUDIT_ACTIONS);

export function isSigeAuditAction(value: string): value is SigeAuditAction {
  return KNOWN.has(value);
}
