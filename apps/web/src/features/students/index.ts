/**
 * Public API of the students feature (SIGE module 05, STU-01…05) and the shared per-student kit
 * other modules reuse (sige/05 §5.6). Features import each other only through this file.
 */
export { default as StudentProfilePage } from "./components/student-profile-page";
export { default as StudentsPage } from "./components/students-page";
export { studentSearchDefaults, studentSearchSchema, type StudentSearch } from "./lib/student-list";
export { default as GuardianCard, type GuardianCardGuardian } from "./components/guardian-card";
export { default as NoStudentBlock } from "./components/no-student-block";
export { default as StatusBadge } from "./components/status-badge";
export { default as StudentStrip, type StudentStripStudent } from "./components/student-strip";
export {
  default as StudentSwitcher,
  type StudentSwitcherProps,
} from "./components/student-switcher";
export { pickedCourseOptions, resolvePickedStudent, studentsOfCourse } from "./lib/student-picker";
export { STUDENT_STATUS_LABELS, STUDENT_STATUS_VARIANTS } from "./lib/student-status";
export type {
  GuardianLink,
  IncompleteStudentRow,
  PickedStudent,
  StudentDetail,
  StudentFilterOptions,
  StudentPickerMode,
  StudentRow,
  StudentStatus,
} from "./types";
