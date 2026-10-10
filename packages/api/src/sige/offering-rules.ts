import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";

import { isActiveTeacher } from "./course-director";
import { onMember } from "./user-queries";

/** sige/04 §4.1 (SCH-04): the teacher of an assignment must be an active `teacher`. */
export const TEACHER_INACTIVE_MESSAGE = "El profesor debe estar activo.";

/** Weekdays of `schedule_slot.day_of_week` (0 = Monday ... 4 = Friday). */
export const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * The teacher must be an active person holding the `teacher` role in this institution. Unknown
 * ids, other tenants' people and non-teachers are indistinguishable (`BAD_REQUEST`).
 */
export async function assertAssignableTeacher(
  db: Pick<Database, "select">,
  organizationId: string,
  teacherPersonId: string,
): Promise<void> {
  const [teacher] = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .innerJoin(schema.member, onMember)
    .where(
      and(
        eq(schema.person.organizationId, organizationId),
        eq(schema.person.id, teacherPersonId),
        isActiveTeacher,
      ),
    )
    .limit(1);
  if (!teacher) {
    throw new ORPCError("BAD_REQUEST", { message: TEACHER_INACTIVE_MESSAGE });
  }
}

/**
 * SCH-R3: giving an offering that already has slots to `teacherPersonId` is refused when the
 * teacher teaches another offering at any of those times. The message names the first clashing
 * class (course, day and start hour), ordered by day and start. The teacher exclusion constraint
 * stays the backstop for a slot that lands after this check (mapped to the generic 23P01 text).
 */
export async function assertTeacherFreeForOffering(
  tx: Tx,
  organizationId: string,
  offeringId: string,
  teacherPersonId: string,
): Promise<void> {
  const result = await tx.execute(sql`
    select c.name as course_name, t.day_of_week, t.start_time
    from ${schema.scheduleSlot} s
    inner join ${schema.scheduleSlot} t
      on t.organization_id = s.organization_id
      and t.teacher_person_id = ${teacherPersonId}
      and t.offering_id <> s.offering_id
      and t.day_of_week = s.day_of_week
      and t.academic_year = s.academic_year
      and t.is_active
      and t.start_time < s.end_time
      and s.start_time < t.end_time
    inner join ${schema.course} c
      on c.organization_id = t.organization_id and c.id = t.course_id
    where s.organization_id = ${organizationId}
      and s.offering_id = ${offeringId}
      and s.is_active
    order by t.day_of_week, t.start_time, t.id
    limit 1
  `);
  const clash = result.rows[0] as
    | { course_name: string; day_of_week: number; start_time: string }
    | undefined;
  if (clash) {
    const day = WEEKDAY_NAMES[clash.day_of_week] ?? `Día ${clash.day_of_week + 1}`;
    throw new ORPCError("CONFLICT", {
      status: 409,
      message: `El profesor ya tiene clases en el mismo horario (${clash.course_name}, ${day} ${clash.start_time.slice(0, 5)}).`,
    });
  }
}
