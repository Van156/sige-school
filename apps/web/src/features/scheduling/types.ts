import type { EnrollmentStatus } from "@base-template/sige-core";
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

/** `schedule.generate` (sige/04 §3.5): what the run placed and the courses it left out. */
export type ScheduleGenerationResult = {
  assigned: number;
  conflicts: number;
  courses: number;
  skipped: { courseId: string; courseName: string; reason: string }[];
};

/** `enrollment.status` values (sige/04 §2). */
export type { EnrollmentStatus };

/** A row of `enrollment.list` / the result of `enrollment.get` (sige/04 §3.3). */
export type EnrollmentRow = {
  id: string;
  studentId: string;
  studentName: string;
  document: string;
  subjectName: string;
  courseId: string;
  courseName: string;
  /** `YYYY-MM-DD`. */
  enrollmentDate: string;
  status: EnrollmentStatus;
  /** Hand-edited administrative score, 1.0–5.0 (SCH-R8); `null` while unset. */
  finalScore: number | null;
  statusNote: string | null;
  /** The enrollment's course is not the student's current course (SCH-R7). */
  isStale: boolean;
};

/** `enrollment.stats` (sige/04 §3.3). */
export type EnrollmentStats = { total: number; active: number };

/** The course summary of `enrollment.candidates` (sige/04 §3.3): drives the SCH-02 callout. */
export type EnrollmentCandidateCourse = {
  id: string;
  name: string;
  maxStudents: number;
  /** Active students whose current course is this one. */
  currentStudents: number;
  offeringCount: number;
};

/** An active student not already in the course (`enrollment.candidates`). */
export type EnrollmentCandidate = {
  id: string;
  name: string;
  document: string;
  currentCourseName: string | null;
};

/** `enrollment.createBulk` (sige/04 §3.3). */
export type BulkEnrollmentResult = {
  students: number;
  created: number;
  skipped: number;
  overCapacity: boolean;
};
