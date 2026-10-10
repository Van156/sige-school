import type { StudentStatus } from "@base-template/sige-core";

export type { StudentStatus };

/** A row of `student.list` (sige/05 §3.1, `StudentRow`). */
export type StudentRow = {
  id: string;
  personId: string;
  name: string;
  documentType: string;
  documentNumber: string;
  courseId: string | null;
  courseName: string | null;
  campusId: string;
  campusName: string;
  status: StudentStatus;
  /** The "Acudiente Principal" contact name of the profile, not a linked account. */
  guardianName: string | null;
};

/** A guardian account linked to a student (sige/05 §3.1, `GuardianLink`). */
export type GuardianLink = {
  guardianPersonId: string;
  name: string;
  username: string;
  relationship: string;
  /** `null` for placeholder addresses (OD-1). */
  email: string | null;
  phone: string | null;
};

/** A row of `guardian.candidates`: an active `parent` person not yet linked to the student. */
export type GuardianCandidate = {
  personId: string;
  name: string;
  username: string;
  document: string;
};

/** `student.get` (sige/05 §3.1, `StudentDetail`). */
export type StudentDetail = StudentRow & {
  /** Name parts (STU-03 edit); `name` is the display name. */
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: "M" | "F" | "Otro" | null;
  address: string | null;
  neighborhood: string | null;
  stratum: number | null;
  bloodType: string | null;
  eps: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  enrolledYear: string;
  guardians: GuardianLink[];
};

/** A row of `student.pick`: the shared per-student picker (R1.16). */
export type PickedStudent = {
  id: string;
  name: string;
  document: string;
  courseId: string | null;
  courseName: string | null;
  status: StudentStatus;
};

/** A row of `student.listIncomplete`: a student login without an academic profile (path B). */
export type IncompleteStudentRow = {
  personId: string;
  name: string;
  documentType: string;
  documentNumber: string;
  username: string;
  /** `null` for placeholder addresses (OD-1). */
  email: string | null;
};

/** `student.filterOptions`: STU-01 campus/course choices within the caller's scope. */
export type StudentFilterOptions = {
  campuses: { id: string; name: string }[];
  courses: { id: string; name: string; campusId: string }[];
};

/**
 * Who a per-student screen is for (sige/05 §5.6, R1.16): a student sees only themselves, a parent
 * switches between their children, staff pick any student in scope.
 */
export type StudentPickerMode = "self" | "children" | "staff";
