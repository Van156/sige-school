import {
  studentAcademicInput,
  studentCompleteInput,
  studentCreateInput,
  studentEditInput,
  studentUpdateInput,
} from "@base-template/api/sige/schemas/student";
import {
  canChangeStudentStatus,
  courseAfterCampusChange,
  DEFAULT_STUDENT_DOCUMENT_TYPE,
  enrollmentMessages,
  STUDENT_DOCUMENT_TYPES,
  STUDENT_STATUSES,
  studentMessages,
} from "@base-template/sige-core";
import type { StandardSchemaV1 } from "@tanstack/react-form";
import { z } from "zod";

import type { Option } from "@/shared/lib/data-table/types";

import type { StudentDetail, StudentStatus } from "../types";
import { STUDENT_STATUS_LABELS } from "./student-status";

/** The three STU-03 modes (sige/05 §5.3): path A, path B and edit. */
export type StudentFormMode = "create" | "complete" | "edit";

/** Form state: every control holds a string (`courseId` "" = "Sin asignar", `stratum` "" = none). */
export type StudentFormValues = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  campusId: string;
  courseId: string;
  neighborhood: string;
  stratum: string;
  bloodType: string;
  eps: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  status: string;
};

/** A number input holds text: blank is "no stratum" (`null`), anything else must be 1..6. */
function stratumValue(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

const stratumField = z
  .string()
  .transform(stratumValue)
  .pipe(studentAcademicInput.shape.stratum.unwrap().unwrap().nullable());

/**
 * A select's string value checked against an API enum fragment. Selects hold `string`, which the
 * literal-typed enum does not accept as input, so the rule is a refinement, not a pipe.
 */
function selectOf(schema: z.ZodType, message: string) {
  return z.string().refine((value) => schema.safeParse(value).success, message);
}

/** Every form key unchecked: each mode overlays the rules of the fields it renders. */
const unchecked = {
  firstName: z.string(),
  lastName: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  phone: z.string(),
  birthDate: z.string(),
  gender: z.string(),
  address: z.string(),
  campusId: z.string(),
  courseId: z.string(),
  neighborhood: z.string(),
  stratum: z.string(),
  bloodType: z.string(),
  eps: z.string(),
  guardianName: z.string(),
  guardianPhone: z.string(),
  guardianEmail: z.string(),
  status: z.string(),
} satisfies Record<keyof StudentFormValues, z.ZodType<string, string>>;

/**
 * STU-03 client rules (sige/05 §4.1), from the API fragments so the messages are the server's:
 * new checks personal + academic data, complete only the academic data (personal fields are not
 * rendered), edit personal + academic + status (the document is immutable).
 */
export const studentFormSchemas = {
  create: z.object({
    ...unchecked,
    ...studentCreateInput.shape,
    documentType: selectOf(studentCreateInput.shape.documentType, "Tipo de documento inválido."),
    gender: selectOf(studentCreateInput.shape.gender, "Género inválido."),
    stratum: stratumField,
  }),
  complete: z.object({ ...unchecked, ...studentAcademicInput.shape, stratum: stratumField }),
  edit: z.object({
    ...unchecked,
    ...studentEditInput.shape,
    gender: selectOf(studentEditInput.shape.gender, "Género inválido."),
    status: selectOf(studentEditInput.shape.status, "Debes seleccionar un estado."),
    stratum: stratumField,
  }),
} as const;

/** Fails to compile when a mode's schema would not accept the form's all-string values. */
type AcceptsFormValues<S extends z.ZodType> = StudentFormValues extends z.input<S> ? S : never;

const checkedSchemas: {
  [M in StudentFormMode]: AcceptsFormValues<(typeof studentFormSchemas)[M]>;
} = studentFormSchemas;

/**
 * The form validator of a mode. The API fragments mark blank-able fields optional, so a schema's
 * input is wider than `StudentFormValues`; `checkedSchemas` proves every mode accepts the form
 * values, which makes the narrowing to the form's value type safe.
 */
export function studentFormValidator(
  mode: StudentFormMode,
): StandardSchemaV1<StudentFormValues, unknown> {
  return checkedSchemas[mode] as StandardSchemaV1<StudentFormValues, unknown>;
}

/** The form values with the stratum as the API takes it. */
function withStratum(values: StudentFormValues) {
  return { ...values, stratum: stratumValue(values.stratum) };
}

/** `student.create` input (path A); blank optional fields are omitted. */
export function toStudentCreateInput(values: StudentFormValues) {
  return studentCreateInput.parse(withStratum(values));
}

/** `student.complete` input (path B): only the academic and guardian fields. */
export function toStudentCompleteInput(personId: string, values: StudentFormValues) {
  return studentCompleteInput.parse({ ...withStratum(values), personId });
}

/**
 * `student.update` input. The procedure replaces the profile, so a blank optional field is sent
 * as absent and cleared to `null` by the server; the document is not part of it (immutable).
 */
export function toStudentUpdateInput(id: string, values: StudentFormValues) {
  return studentUpdateInput.parse({ ...withStratum(values), id });
}

/** Blank new/complete form: TI is the default document type (sige/05 §4.1). */
export function emptyStudentForm(): StudentFormValues {
  return {
    firstName: "",
    lastName: "",
    documentType: DEFAULT_STUDENT_DOCUMENT_TYPE,
    documentNumber: "",
    phone: "",
    birthDate: "",
    gender: "",
    address: "",
    campusId: "",
    courseId: "",
    neighborhood: "",
    stratum: "",
    bloodType: "",
    eps: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    status: "activo",
  };
}

/** Edit form state from `student.get`; empty values become empty strings. */
export function studentToFormValues(student: StudentDetail): StudentFormValues {
  return {
    firstName: student.firstName,
    lastName: student.lastName,
    documentType: student.documentType,
    documentNumber: student.documentNumber,
    phone: student.phone ?? "",
    birthDate: student.birthDate ?? "",
    gender: student.gender ?? "",
    address: student.address ?? "",
    campusId: student.campusId,
    courseId: student.courseId ?? "",
    neighborhood: student.neighborhood ?? "",
    stratum: student.stratum === null ? "" : String(student.stratum),
    bloodType: student.bloodType ?? "",
    eps: student.eps ?? "",
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "",
    guardianEmail: student.guardianEmail ?? "",
    status: student.status,
  };
}

/** A course the "Grado" select may offer (`course.options`). */
export type StudentCourseOption = { id: string; name: string; campusId: string };

/**
 * The courses a student may be placed in: those of the institution's current academic year
 * (admission enrolls for that year, STU-R3), reduced to what the select needs.
 */
export function currentYearCourses(
  courses: readonly (StudentCourseOption & { academicYear: string })[],
  currentAcademicYear: string,
): StudentCourseOption[] {
  return courses
    .filter((course) => course.academicYear === currentAcademicYear)
    .map(({ id, name, campusId }) => ({ id, name, campusId }));
}

/**
 * The "Grado" choices: the courses of the chosen campus (none before a campus is chosen). In edit
 * mode the student's current course stays offered even when `course.options` no longer lists it
 * (e.g. a course of a previous academic year), so it is never silently replaced.
 */
export function courseChoices(
  courses: readonly StudentCourseOption[],
  campusId: string,
  current?: StudentCourseOption | null,
): Option[] {
  const listed = current && !courses.some((course) => course.id === current.id) ? [current] : [];
  return [...courses, ...listed]
    .filter((course) => campusId !== "" && course.campusId === campusId)
    .map((course) => ({ value: course.id, label: course.name }));
}

/**
 * The course to keep after the "Sede" select changed (STU-R4): the chosen course only when it
 * belongs to the new campus, else "Sin asignar".
 */
export function courseAfterCampusSelect(
  courseId: string,
  campusId: string,
  courses: readonly StudentCourseOption[],
): string {
  const course = courses.find((item) => item.id === courseId);
  return courseAfterCampusChange(course, campusId) ?? "";
}

/**
 * "Estado" choices on edit (STU-R5, D9): the current status and the ones it may move to, so a
 * refused transition (retirado <-> graduado) is never offered.
 */
export function statusChoices(current: StudentStatus): Option[] {
  return STUDENT_STATUSES.filter((status) => canChangeStudentStatus(current, status)).map(
    (status) => ({ value: status, label: STUDENT_STATUS_LABELS[status] }),
  );
}

/** STU-R4: the help shows once the edited course differs from the stored one. */
export function hasCourseChanged(initialCourseId: string, courseId: string): boolean {
  return initialCourseId !== courseId;
}

export const COURSE_CHANGE_HELP =
  "Cambiar el grado no modifica las matrículas existentes. Use Matrículas para inscribir al estudiante en el nuevo grado.";

/** Fields the student form may render; issues on other paths show on the form instead. */
export const STUDENT_FORM_FIELDS = Object.keys(unchecked) as readonly (keyof StudentFormValues)[];

/** Server messages that belong under a specific field (sige/05 §4.1, STU-R4/R5). */
export const STUDENT_FIELD_BY_MESSAGE: Readonly<Record<string, keyof StudentFormValues>> = {
  "Ya existe un usuario con este documento.": "documentNumber",
  "Ya existe un estudiante con este documento.": "documentNumber",
  [studentMessages.courseCampusMismatch]: "courseId",
  "El grado no existe.": "courseId",
  "La sede no existe.": "campusId",
  "La sede seleccionada está inactiva.": "campusId",
};

export const STUDENT_CREATE_FALLBACK = "No se pudo crear el estudiante. Intente nuevamente.";
export const STUDENT_UPDATE_FALLBACK = "No se pudo actualizar el estudiante. Intente nuevamente.";

/** What `student.create` / `student.complete` report about the admission enrollment (STU-R3). */
export type AdmissionEnrolled = { created: number; overCapacity: boolean } | null;

/**
 * The STU-R3 success toast: title "Matrícula completada"; with a course the student was enrolled
 * in its subjects, without one the next step is Matrículas.
 */
export function admissionNotice(enrolled: AdmissionEnrolled): {
  title: string;
  description: string;
} {
  return {
    title: "Matrícula completada",
    description:
      enrolled === null
        ? "Asigna un grado desde Matrículas para inscribirlo en materias."
        : "El estudiante quedó inscrito en las materias de su grado.",
  };
}

/**
 * The STU-R3 over-capacity warning, shown after the success toast; `null` when the course is
 * within capacity. `maxStudents` is the course capacity (`null` when it could not be read).
 */
export function overCapacityWarning(
  enrolled: AdmissionEnrolled,
  maxStudents: number | null,
): string | null {
  if (!enrolled?.overCapacity) {
    return null;
  }
  return maxStudents === null
    ? OVER_CAPACITY_FALLBACK
    : enrollmentMessages.admissionOverCapacity(maxStudents);
}

/** Authored: the capacity warning when the course capacity could not be read. */
export const OVER_CAPACITY_FALLBACK = "El grado supera su capacidad máxima.";

/** "Tipo de Documento" choices (sige/05 §5.3): TI (default), RC, CC. */
export const STUDENT_DOCUMENT_TYPE_OPTIONS: Option[] = STUDENT_DOCUMENT_TYPES.map((type) => ({
  value: type,
  label: type,
}));

/** "Género" choices (sige/05 §5.3): "Seleccionar..." is no value. */
export const STUDENT_GENDER_OPTIONS: Option[] = [
  { value: "", label: "Seleccionar..." },
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "Otro", label: "Otro" },
];
