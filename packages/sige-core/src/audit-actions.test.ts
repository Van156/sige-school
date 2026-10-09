import { describe, expect, test } from "bun:test";

import { SIGE_AUDIT_ACTIONS, isSigeAuditAction } from "./audit-actions";

/** Spec §6.9 (R3.26) with every wildcard expanded. */
const EXPECTED = [
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
  "grade.sheet_saved",
  "grade.imported",
  "grade.locked",
  "grade.unlocked",
  "grade.recalculated",
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
  "qr.regenerated",
  "qr.reader_created",
  "qr.reader_revoked",
];

describe("SIGE_AUDIT_ACTIONS (spec §6.9)", () => {
  test("contains exactly the listed actions", () => {
    expect([...SIGE_AUDIT_ACTIONS].map(String).sort()).toEqual([...EXPECTED].sort());
  });

  test("has no duplicates and follows entity.verb naming", () => {
    expect(new Set(SIGE_AUDIT_ACTIONS).size).toBe(SIGE_AUDIT_ACTIONS.length);
    for (const action of SIGE_AUDIT_ACTIONS) {
      expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  test("isSigeAuditAction accepts every listed action and rejects unknown ones", () => {
    for (const action of EXPECTED) {
      expect(isSigeAuditAction(action)).toBe(true);
    }
    for (const bad of ["grade.deleted", "user.exploded", "grade", "", "__proto__", "toString"]) {
      expect(isSigeAuditAction(bad)).toBe(false);
    }
  });
});
