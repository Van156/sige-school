import type { z } from "zod";

import type {
  assignmentStatusSchema,
  classroomTypeSchema,
  timeBlockShiftSchema,
} from "@base-template/api/sige/schemas/scheduling";

/** `classroom_type` values (sige/04 §2). */
export type ClassroomType = z.infer<typeof classroomTypeSchema>;

/** Time block jornada values (sige/04 §4.1). */
export type TimeBlockShift = z.infer<typeof timeBlockShiftSchema>;

/** A row of `classroom.list` / the result of `classroom.get` (sige/04 §3.4). */
export type ClassroomRow = {
  id: string;
  campusId: string;
  campusName: string;
  name: string;
  code: string;
  capacity: number;
  floor: number;
  building: string | null;
  classroomType: ClassroomType;
  resources: Record<string, unknown> | null;
};

/** `classroom.stats` (sige/04 §3.4). */
export type ClassroomStats = { total: number; aulas: number; laboratorios: number };

/** A row of `timeBlock.list` / the result of `timeBlock.get`; times are `HH:MM` (sige/04 §3.4). */
export type TimeBlockRow = {
  id: string;
  campusId: string;
  campusName: string;
  name: string;
  shift: TimeBlockShift;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  orderNum: number;
  academicYear: string;
  inUse: boolean;
};

/** `teacher_assignment` status (sige/04 §2). */
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

/** A row of `offering.list` / the result of `offering.update` (sige/04 §3.1). */
export type OfferingRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  courseId: string;
  courseName: string;
  hoursPerWeek: number;
  teacherPersonId: string | null;
  teacherName: string | null;
  /** Status of the offering's assignment; `null` while it has no teacher. */
  assignmentStatus: AssignmentStatus | null;
};

/** `offering.stats` (sige/04 §3.1). */
export type OfferingStats = { assigned: number; weeklyHours: number; withoutTeacher: number };

/** A row of `assignment.list` / the result of `assignment.get` (sige/04 §3.2). */
export type AssignmentRow = {
  id: string;
  offeringId: string;
  teacherPersonId: string;
  teacherName: string;
  /** The teacher's login name; `null` for an account without one. */
  teacherUsername: string | null;
  subjectName: string;
  courseName: string;
  academicYear: string;
  /** `YYYY-MM-DD`. */
  assignmentDate: string;
  status: AssignmentStatus;
  notes: string | null;
};

/** `assignment.stats` (sige/04 §3.2). */
export type AssignmentStats = { total: number; active: number };
