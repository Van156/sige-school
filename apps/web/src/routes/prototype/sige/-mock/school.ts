import { enrollments, schedules, subjectGrades, teacherAssignments } from "./academics";
import { classrooms, scheduleBlocks } from "./base";
import { parentStudents, students } from "./people";
import { createMockCollection } from "./store";
import type { SubjectGrade } from "./types";

/**
 * Editable copies of the student, enrollment and scheduling collections (T3). Like `admin.ts`, the
 * static arrays stay untouched for the read-only dashboards; the SCH and STU screens read and
 * write these stores, so edits live until the page reloads.
 */

/** A subject taught in a course; the teacher is optional ("Sin asignar" in the legacy list). */
export type SubjectGradeRecord = Omit<SubjectGrade, "teacherId"> & { teacherId?: number };

export const studentStore = createMockCollection(students);
export const parentLinkStore = createMockCollection(parentStudents);
export const enrollmentStore = createMockCollection(enrollments);
export const assignmentStore = createMockCollection(teacherAssignments);
export const subjectGradeStore = createMockCollection<SubjectGradeRecord>(subjectGrades);
export const classroomStore = createMockCollection(classrooms);
export const blockStore = createMockCollection(scheduleBlocks);
export const scheduleStore = createMockCollection(schedules);
